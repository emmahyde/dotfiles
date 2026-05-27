// Visual-diff utilities for the Sector MCP server.
//
// Three problems this solves:
//   1. Screenshot payloads are huge (~200 KB base64 PNG per call). Crop to a
//      named widget or rect server-side; return a tiny region instead.
//   2. "Did anything change?" — compare a fresh shot against the last one and
//      return a structured summary (changed_pct, bbox, region name) instead of
//      two raw frames.
//   3. Anchor matching for non-UI elements (asteroids, shader effects). A
//      bundled template image is located in the frame; we crop around the hit.
//
// The MCP-side tools are wired in index.ts. Live widget bounds come from the
// existing /hud endpoint (filter=name → LastDrawnBounds rectangle).

import sharp from "sharp";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

export type Rect = { x: number; y: number; w: number; h: number };

// In-memory cache of the most recent screenshot bytes. Used for "diff against
// previous" — call sector_screenshot_diff twice and the second call computes a
// delta rather than dumping a full PNG into context. Cleared on process exit.
let lastShot: Buffer | null = null;
let lastShotMeta: { width: number; height: number; takenAt: number } | null = null;

export function setLastShot(bytes: Buffer, width: number, height: number): void {
  lastShot = bytes;
  lastShotMeta = { width, height, takenAt: Date.now() };
}

export function getLastShot(): { bytes: Buffer; width: number; height: number; ageMs: number } | null {
  if (!lastShot || !lastShotMeta) return null;
  return {
    bytes: lastShot,
    width: lastShotMeta.width,
    height: lastShotMeta.height,
    ageMs: Date.now() - lastShotMeta.takenAt,
  };
}

// Crop a PNG buffer to a rectangle. Clamps to image bounds; returns the cropped
// buffer plus the actual rect used (post-clamp) so callers can report it.
export async function cropToRect(png: Buffer, rect: Rect): Promise<{ bytes: Buffer; rect: Rect }> {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const x = Math.max(0, Math.min(rect.x, W));
  const y = Math.max(0, Math.min(rect.y, H));
  const w = Math.max(1, Math.min(rect.w, W - x));
  const h = Math.max(1, Math.min(rect.h, H - y));
  const bytes = await sharp(png).extract({ left: x, top: y, width: w, height: h }).png().toBuffer();
  return { bytes, rect: { x, y, w, h } };
}

// Compute a 64-bit perceptual hash (dHash variant). Compare with hammingDistance.
// Robust against minor noise; defeated by significant motion or large color shifts.
export async function phash(png: Buffer): Promise<bigint> {
  const raw = await sharp(png).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = raw[y * 9 + x] ?? 0;
      const right = raw[y * 9 + x + 1] ?? 0;
      const bit = left > right ? 1n : 0n;
      bits = (bits << 1n) | bit;
    }
  }
  return bits;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

// Pixel diff with bounding box. Returns the rectangle enclosing all pixels that
// differ by more than `threshold` (per-channel sum). Caller can crop to bbox if
// they want a "what changed" thumbnail.
export type DiffResult = {
  changed_pct: number;          // 0–100
  bbox: Rect | null;            // null when no change
  total_pixels: number;
  changed_pixels: number;
  phash_distance: number;       // 0 = identical, 64 = inverse
  size: { w: number; h: number };
};

export async function pixelDiff(a: Buffer, b: Buffer, threshold: number = 30): Promise<DiffResult> {
  const aMeta = await sharp(a).metadata();
  const bMeta = await sharp(b).metadata();
  const W = Math.min(aMeta.width ?? 0, bMeta.width ?? 0);
  const H = Math.min(aMeta.height ?? 0, bMeta.height ?? 0);

  // Downscale both to a workable size — saves memory; bbox resolution stays
  // good enough to pick the right widget. Threshold normalised on full range.
  const TARGET_W = Math.min(W, 480);
  const TARGET_H = Math.round((TARGET_W / W) * H);

  const aRaw = await sharp(a).resize(TARGET_W, TARGET_H, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const bRaw = await sharp(b).resize(TARGET_W, TARGET_H, { fit: "fill" }).removeAlpha().raw().toBuffer();

  let minX = TARGET_W, minY = TARGET_H, maxX = -1, maxY = -1;
  let changed = 0;

  for (let y = 0; y < TARGET_H; y++) {
    for (let x = 0; x < TARGET_W; x++) {
      const i = (y * TARGET_W + x) * 3;
      const dr = Math.abs((aRaw[i] ?? 0) - (bRaw[i] ?? 0));
      const dg = Math.abs((aRaw[i + 1] ?? 0) - (bRaw[i + 1] ?? 0));
      const db = Math.abs((aRaw[i + 2] ?? 0) - (bRaw[i + 2] ?? 0));
      if (dr + dg + db > threshold) {
        changed++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const total = TARGET_W * TARGET_H;
  const phA = await phash(a);
  const phB = await phash(b);

  // Scale bbox back up to source resolution.
  const sx = W / TARGET_W;
  const sy = H / TARGET_H;
  const bbox = maxX < 0 ? null : {
    x: Math.round(minX * sx),
    y: Math.round(minY * sy),
    w: Math.round((maxX - minX + 1) * sx),
    h: Math.round((maxY - minY + 1) * sy),
  };

  return {
    changed_pct: Math.round((changed / total) * 1000) / 10,
    bbox,
    total_pixels: total,
    changed_pixels: changed,
    phash_distance: hammingDistance(phA, phB),
    size: { w: W, h: H },
  };
}

// Anchor crop via naive normalised-cross-correlation on a downscaled grayscale.
// Cheap, no opencv dep. Good enough for distinct silhouettes (asteroid outline,
// shield bubble); not robust for arbitrary natural images. Returns null when no
// match exceeds confidence.
export type AnchorMatch = {
  anchor: string;
  confidence: number;
  rect: Rect;
};

export async function findAnchor(
  shot: Buffer,
  templatePath: string,
  pad: number = 16,
  minConfidence: number = 0.6
): Promise<AnchorMatch | null> {
  if (!existsSync(templatePath)) return null;
  const tplBuf = readFileSync(templatePath);

  // Work at quarter resolution for speed.
  const SCALE = 4;
  const shotMeta = await sharp(shot).metadata();
  const tplMeta = await sharp(tplBuf).metadata();
  const SW = Math.floor((shotMeta.width ?? 0) / SCALE);
  const SH = Math.floor((shotMeta.height ?? 0) / SCALE);
  const TW = Math.floor((tplMeta.width ?? 0) / SCALE);
  const TH = Math.floor((tplMeta.height ?? 0) / SCALE);

  if (TW < 4 || TH < 4 || TW > SW || TH > SH) return null;

  const shotRaw = await sharp(shot).resize(SW, SH, { fit: "fill" }).grayscale().raw().toBuffer();
  const tplRaw = await sharp(tplBuf).resize(TW, TH, { fit: "fill" }).grayscale().raw().toBuffer();

  // Template mean.
  let tplMean = 0;
  for (let i = 0; i < TW * TH; i++) tplMean += tplRaw[i] ?? 0;
  tplMean /= TW * TH;
  let tplVar = 0;
  for (let i = 0; i < TW * TH; i++) {
    const d = (tplRaw[i] ?? 0) - tplMean;
    tplVar += d * d;
  }
  const tplStd = Math.sqrt(tplVar / (TW * TH)) || 1;

  let best = -Infinity;
  let bestX = 0, bestY = 0;

  for (let y = 0; y <= SH - TH; y += 2) {
    for (let x = 0; x <= SW - TW; x += 2) {
      let sum = 0;
      let sumSq = 0;
      for (let ty = 0; ty < TH; ty++) {
        for (let tx = 0; tx < TW; tx++) {
          const v = shotRaw[(y + ty) * SW + (x + tx)] ?? 0;
          sum += v;
          sumSq += v * v;
        }
      }
      const mean = sum / (TW * TH);
      const variance = sumSq / (TW * TH) - mean * mean;
      const std = Math.sqrt(Math.max(variance, 0)) || 1;

      let corr = 0;
      for (let ty = 0; ty < TH; ty++) {
        for (let tx = 0; tx < TW; tx++) {
          const sv = (shotRaw[(y + ty) * SW + (x + tx)] ?? 0) - mean;
          const tv = (tplRaw[ty * TW + tx] ?? 0) - tplMean;
          corr += sv * tv;
        }
      }
      const score = corr / (TW * TH * std * tplStd);

      if (score > best) {
        best = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  if (best < minConfidence) return null;

  const rect: Rect = {
    x: Math.max(0, bestX * SCALE - pad),
    y: Math.max(0, bestY * SCALE - pad),
    w: TW * SCALE + pad * 2,
    h: TH * SCALE + pad * 2,
  };
  return { anchor: templatePath, confidence: best, rect };
}

// Downscale a PNG so its long edge ≤ maxEdge before returning to the model.
// Image tokens cost ~1 per 750 px²: a 1644×1063 frame ≈ 2330 tokens, the same
// frame capped at 1280 ≈ 1400. No-op when the image is already small enough.
export async function downscaleForModel(png: Buffer, maxEdge: number = 1280): Promise<Buffer> {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const longEdge = Math.max(W, H);
  if (longEdge <= maxEdge || longEdge === 0) return png;
  const scale = maxEdge / longEdge;
  return sharp(png)
    .resize(Math.max(1, Math.round(W * scale)), Math.max(1, Math.round(H * scale)), { fit: "fill" })
    .png()
    .toBuffer();
}

// Capture "what changed" between two frames: diff them, take the bounding box
// enclosing every altered pixel, pad it generously, and crop the AFTER frame to
// that rect. `bytes` is null when nothing changed.
export type ChangedRegion = {
  bytes: Buffer | null;
  rect: Rect | null;
  diff: DiffResult;
};

export async function changedRegionCrop(
  before: Buffer,
  after: Buffer,
  pad: number = 48,
  threshold: number = 30
): Promise<ChangedRegion> {
  const diff = await pixelDiff(before, after, threshold);
  if (!diff.bbox) return { bytes: null, rect: null, diff };
  const padded: Rect = {
    x: diff.bbox.x - pad,
    y: diff.bbox.y - pad,
    w: diff.bbox.w + pad * 2,
    h: diff.bbox.h + pad * 2,
  };
  const { bytes, rect } = await cropToRect(after, padded);
  return { bytes, rect, diff };
}

// Render a PNG as a plaintext ASCII-luminance grid. For `convert_to_text` mode —
// gives the model a structural sense of the frame for a few chars per cell
// instead of paying the full image token cost.
const ASCII_RAMP = " .:-=+*#%@";

export async function imageToText(png: Buffer, cols: number = 120): Promise<string> {
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 1;
  const H = meta.height ?? 1;
  // Terminal cells are ~2:1 (h:w); halve the row count to preserve aspect.
  const rows = Math.max(1, Math.round((cols * (H / W)) / 2));
  const raw = await sharp(png).resize(cols, rows, { fit: "fill" }).grayscale().raw().toBuffer();
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const lum = raw[y * cols + x] ?? 0;
      const idx = Math.min(ASCII_RAMP.length - 1, Math.floor((lum / 256) * ASCII_RAMP.length));
      line += ASCII_RAMP[idx];
    }
    lines.push(line);
  }
  return lines.join("\n");
}

// Catalog the bundled anchor templates so the agent can list what's available.
export function listAnchors(anchorDir: string): string[] {
  if (!existsSync(anchorDir)) return [];
  return readdirSync(anchorDir).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
}

export function anchorPath(anchorDir: string, name: string): string {
  return join(anchorDir, name.endsWith(".png") || name.endsWith(".jpg") ? name : `${name}.png`);
}
