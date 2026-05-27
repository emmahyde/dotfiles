#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync, readdirSync, mkdirSync, statSync } from "fs";
import { OutlineSym, outlineJsx, formatOutline, readFileWithRange, compileQuery, capOutline, capHits, capSymbols } from "./outline.ts";
import { join, resolve, dirname, relative } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { $ } from "bun";
import {
  cropToRect, pixelDiff, findAnchor, anchorPath, listAnchors,
  setLastShot, getLastShot,
  downscaleForModel, changedRegionCrop, imageToText,
  type Rect,
} from "./visual.js";
import {
  rectCenter, buildElicitChoices, buildGumTree, gumToHudNodes,
  type GumFlatNode, type GumTreeNode,
} from "./hud.ts";
import { formatInputResult, buildStatusResult } from "./format.ts";
import { astCacheKey } from "./astcache.ts";

const PORT_FILE = join(homedir(), ".sector", "debug-port");

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "../..");
const GUMX_PATH = resolve(REPO_ROOT, "Sector/Assets/UI/SectorHud/SectorHud.gumx");
const DESIGN_DIR = resolve(REPO_ROOT, ".claude/design/sector-hud");
const RENDER_TMP = "/tmp/sector-mcp-render";
const INPUT_TMP = "/tmp/sector-mcp-input";
const ANCHOR_DIR = resolve(REPO_ROOT, ".claude/anchors");

// Build MCP content for an image result. Downscales the PNG so it doesn't blow
// the context budget; with convertToText, returns an ASCII-luminance rendering
// instead of the image entirely. `textPrefix` is prepended as a separate block.
async function imageResult(
  bytes: Buffer,
  convertToText: boolean,
  textPrefix?: string
): Promise<any[]> {
  if (convertToText) {
    const ascii = await imageToText(bytes);
    return [{ type: "text", text: (textPrefix ? textPrefix + "\n" : "") + ascii }];
  }
  const small = await downscaleForModel(bytes);
  const content: any[] = [];
  if (textPrefix) content.push({ type: "text", text: textPrefix });
  content.push({ type: "image", data: small.toString("base64"), mimeType: "image/png" });
  return content;
}

// Resolve a widget name to its LastDrawnBounds via the existing /hud endpoint.
async function widgetBounds(name: string): Promise<Rect | null> {
  const result = await fetchJson(`/hud?filter=${encodeURIComponent(name)}&format=json`);
  // /hud returns { elements: [{ TypeName, LastDrawnBounds: { X, Y, Width, Height }, ... }] }
  const list = result?.elements ?? result?.rows ?? [];
  if (!Array.isArray(list) || list.length === 0) return null;
  // Prefer exact (case-insensitive) name match; fall back to first hit.
  const lc = name.toLowerCase();
  const exact = list.find((e: any) => (e?.TypeName ?? "").toLowerCase() === lc);
  const hit = exact ?? list[0];
  const b = hit?.LastDrawnBounds ?? hit?.bounds ?? null;
  if (!b) return null;
  return {
    x: b.X ?? b.x ?? 0,
    y: b.Y ?? b.y ?? 0,
    w: b.Width ?? b.w ?? 0,
    h: b.Height ?? b.h ?? 0,
  };
}

async function rawScreenshot(): Promise<{ bytes: Buffer; contentType: string }> {
  const resp = await fetch(`${baseUrl()}/screenshot`);
  const contentType = resp.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await resp.arrayBuffer());
  return { bytes, contentType };
}

function getPort(): number {
  if (!existsSync(PORT_FILE)) {
    throw new Error(`Sector debug bridge not running — ${PORT_FILE} not found. Launch the game in Debug mode first.`);
  }
  return parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
}

function baseUrl(): string {
  return `http://localhost:${getPort()}`;
}

async function fetchJson(path: string, options?: RequestInit): Promise<any> {
  const resp = await fetch(`${baseUrl()}${path}`, options);
  return resp.json();
}

async function fetchBytes(path: string): Promise<{ bytes: Buffer; contentType: string }> {
  const resp = await fetch(`${baseUrl()}${path}`);
  const contentType = resp.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await resp.arrayBuffer());
  return { bytes, contentType };
}

const server = new McpServer({
  name: "sector",
  version: "0.1.0",
});

server.registerTool(
  "sector_status",
  {
    description: "Check if the Sector debug bridge is running and reachable",
    inputSchema: {},
    outputSchema: {
      running: z.boolean(),
      port: z.number().optional(),
      pid: z.number().optional(),
      scene: z.string().optional(),
    },
  },
  async () => {
    try {
      const result = await fetchJson("/status");
      const { text, structured } = buildStatusResult(result);
      return {
        content: [{ type: "text", text }],
        structuredContent: structured,
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Bridge unreachable: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "sector_eval",
  "Evaluate a C# expression on the live game's main thread.",
  { code: z.string().describe("C# expression or statement to evaluate") },
  async ({ code }) => {
    const result = await fetchJson("/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    let text = JSON.stringify(result);
    const CAP = 8192;
    if (text.length > CAP) {
      text = text.slice(0, CAP) + `\n…[truncated, ${text.length} chars total]`;
    }
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "sector_screenshot",
  "Capture the current frame as PNG (≤1280px), caching baseline for sector_screenshot_diff.",
  {
    convert_to_text: z.boolean().default(false).describe("Return an ASCII-luminance rendering instead of the PNG image — a cheap structural view."),
  },
  async ({ convert_to_text }) => {
    try {
      const { bytes, contentType } = await rawScreenshot();
      if (contentType.includes("json")) {
        return { content: [{ type: "text", text: bytes.toString("utf-8") }], isError: true };
      }
      // Cache the FULL-resolution frame for diff. Best-effort metadata read.
      try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(bytes).metadata();
        setLastShot(bytes, meta.width ?? 0, meta.height ?? 0);
      } catch { /* metadata best-effort */ }
      return { content: await imageResult(bytes, convert_to_text) };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Screenshot failed: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "sector_screenshot_region",
  "Crop the current frame to a widget (by HUD name), explicit rect, or anchor template match.",
  {
    widget: z.string().optional().describe("HUD widget/element name. Resolved via /hud LastDrawnBounds. Mutually exclusive with rect/anchor."),
    rect: z.object({
      x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    }).optional().describe("Explicit crop rectangle in screen pixels."),
    anchor: z.string().optional().describe("Anchor template name under .claude/anchors/ (e.g. 'asteroid_outline'). Locates the template in the frame and crops with padding."),
    pad: z.number().default(16).describe("Padding around the resolved rect, in pixels."),
    convert_to_text: z.boolean().default(false).describe("Return an ASCII-luminance rendering instead of the PNG image."),
  },
  async ({ widget, rect, anchor, pad, convert_to_text }) => {
    const provided = [widget, rect, anchor].filter(v => v != null).length;
    if (provided !== 1) {
      return { content: [{ type: "text", text: "Provide exactly one of widget, rect, or anchor." }], isError: true };
    }
    try {
      const { bytes, contentType } = await rawScreenshot();
      if (contentType.includes("json")) {
        return { content: [{ type: "text", text: bytes.toString("utf-8") }], isError: true };
      }

      let cropRect: Rect | null = null;
      let label = "";
      if (widget) {
        const b = await widgetBounds(widget);
        if (!b) {
          return { content: [{ type: "text", text: `No HUD element matched "${widget}". Try sector_hud filter='${widget}' to list candidates.` }], isError: true };
        }
        cropRect = { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
        label = `widget=${widget} bounds=${JSON.stringify(b)}`;
      } else if (rect) {
        cropRect = rect;
        label = `rect=${JSON.stringify(rect)}`;
      } else if (anchor) {
        const tplPath = anchorPath(ANCHOR_DIR, anchor);
        const match = await findAnchor(bytes, tplPath, pad);
        if (!match) {
          const available = listAnchors(ANCHOR_DIR);
          return {
            content: [{ type: "text", text: `Anchor "${anchor}" not found in current frame (or template missing).\nAvailable: ${available.join(", ") || "(none in .claude/anchors/)"}` }],
            isError: true,
          };
        }
        cropRect = match.rect;
        label = `anchor=${anchor} confidence=${match.confidence.toFixed(2)}`;
      }

      const { bytes: cropped, rect: actual } = await cropToRect(bytes, cropRect!);
      // Cache the FULL frame so diff still works.
      try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(bytes).metadata();
        setLastShot(bytes, meta.width ?? 0, meta.height ?? 0);
      } catch { /* best effort */ }

      return {
        content: [
          { type: "text", text: `${label} → cropped to ${JSON.stringify(actual)} (${cropped.length} bytes)` },
          ...(await imageResult(cropped, convert_to_text)),
        ],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Region capture failed: ${e.message}` }], isError: true };
    }
  }
);

server.tool(
  "sector_screenshot_diff",
  "Diff the current frame against the cached baseline; returns changed_pct, bbox, and phash distance.",
  {
    widget: z.string().optional().describe("Restrict diff to this widget's bounds — typical for HUD iteration."),
    rect: z.object({
      x: z.number(), y: z.number(), w: z.number(), h: z.number(),
    }).optional().describe("Restrict diff to this explicit rect."),
    threshold: z.number().default(30).describe("Per-channel sum threshold for 'changed' (0-765). Higher = noisier-tolerant."),
    return_thumb: z.boolean().default(false).describe("Include a small cropped thumbnail of the bbox region. Off by default to keep payload tiny."),
    convert_to_text: z.boolean().default(false).describe("If a thumbnail is returned, render it as ASCII-luminance text instead of an image."),
  },
  async ({ widget, rect, threshold, return_thumb, convert_to_text }) => {
    try {
      const { bytes: curr, contentType } = await rawScreenshot();
      if (contentType.includes("json")) {
        return { content: [{ type: "text", text: curr.toString("utf-8") }], isError: true };
      }

      const prev = getLastShot();
      // Update cache regardless of whether we had a baseline.
      try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(curr).metadata();
        setLastShot(curr, meta.width ?? 0, meta.height ?? 0);
      } catch { /* best effort */ }

      if (!prev) {
        return { content: [{ type: "text", text: "No baseline cached. Took fresh shot — call this tool again after the change to compare." }] };
      }

      let a = prev.bytes;
      let b = curr;
      let scope = "full-frame";
      if (widget) {
        const wb = await widgetBounds(widget);
        if (!wb) {
          return { content: [{ type: "text", text: `Widget "${widget}" not found.` }], isError: true };
        }
        a = (await cropToRect(a, wb)).bytes;
        b = (await cropToRect(b, wb)).bytes;
        scope = `widget=${widget}`;
      } else if (rect) {
        a = (await cropToRect(a, rect)).bytes;
        b = (await cropToRect(b, rect)).bytes;
        scope = `rect=${JSON.stringify(rect)}`;
      }

      const diff = await pixelDiff(a, b, threshold);
      const summary = {
        scope,
        baseline_age_ms: prev.ageMs,
        ...diff,
      };

      const content: any[] = [{ type: "text", text: JSON.stringify(summary) }];
      if (return_thumb && diff.bbox) {
        const { bytes: thumb, rect: thumbRect } = await cropToRect(b, diff.bbox);
        // bbox/thumbRect are native render-target pixels — give the crop→native
        // mapping so a click can be aimed at anything visible in the thumb.
        const prefix = `thumb region (native px) ${JSON.stringify(thumbRect)} — native = (crop_x + ${thumbRect.x}, crop_y + ${thumbRect.y})`;
        content.push(...(await imageResult(thumb, convert_to_text, prefix)));
      }
      return { content };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Diff failed: ${e.message}` }], isError: true };
    }
  }
);

type InjectCapture = {
  result: any;
  before: Buffer | null;
  after: Buffer;
  beforePath: string | null;
  afterPath: string;
  region: Awaited<ReturnType<typeof changedRegionCrop>> | null;
};

// POST /input with the given body, then capture before/after frames and the
// changed-region crop. Shared by every sector_input target path.
async function injectAndCapture(body: any): Promise<InjectCapture> {
  let before: Buffer | null = null;
  try {
    const shot = await rawScreenshot();
    if (!shot.contentType.includes("json")) before = shot.bytes;
  } catch { /* before is best-effort */ }

  const result = await fetchJson("/input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Wait out the hold duration plus a settle margin so the after-frame
  // reflects the input's effect (edge detection + a render tick or two).
  await new Promise((r) => setTimeout(r, (body.duration_ms ?? 0) + 350));

  const { bytes: after, contentType: afterCt } = await rawScreenshot();
  if (afterCt.includes("json")) {
    throw new Error(`after-screenshot failed: ${after.toString("utf-8")}`);
  }
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(after).metadata();
    setLastShot(after, meta.width ?? 0, meta.height ?? 0);
  } catch { /* best effort */ }

  const ts = Date.now();
  mkdirSync(INPUT_TMP, { recursive: true });
  const beforePath = before ? join(INPUT_TMP, `before-${ts}.png`) : null;
  const afterPath = join(INPUT_TMP, `after-${ts}.png`);
  if (before && beforePath) await Bun.write(beforePath, before);
  await Bun.write(afterPath, after);

  const region = before ? await changedRegionCrop(before, after) : null;
  return { result, before, after, beforePath, afterPath, region };
}

// Live Gum render tree, flattened to depth-tagged clickable nodes.
async function listGumNodes() {
  const result = await fetchJson(`/gum`);
  const flat: GumFlatNode[] = result?.nodes ?? [];
  return gumToHudNodes(flat);
}

server.tool(
  "sector_input",
  "Inject a key, action, or click — by x/y or HUD widget name. Terse by default. Interactive element picker: sector_interact.",
  {
    key: z.string().optional().describe("Key name (e.g. 'W', 'Space', 'Enter')"),
    action: z.string().optional().describe("Input action name (e.g. 'PilotingMoveUp')"),
    widget: z.string().optional().describe("HUD element name — clicks its bounds centre. Resolved via /hud. Alternative to x/y."),
    x: z.number().optional().describe("Mouse click X in native render-target pixels. Requires y."),
    y: z.number().optional().describe("Mouse click Y in native render-target pixels. Requires x."),
    button: z.enum(["left", "right"]).default("left").describe("Mouse button for a click."),
    duration_ms: z.number().default(500).describe("How long to hold the input in milliseconds"),
    image_diff: z.boolean().default(true).describe("Return only the changed-region crop. When false, return full before and after frames."),
    verbose: z.boolean().default(false).describe("Return full JSON metadata + before/after file paths instead of the terse one-line summary."),
    convert_to_text: z.boolean().default(false).describe("Return ASCII-luminance renderings instead of PNG images."),
  },
  async ({ key, action, widget, x, y, button, duration_ms, image_diff, verbose, convert_to_text }) => {
    // ── Resolve a single target ─────────────────────────────────────────────
    if ((x == null) !== (y == null)) {
      return { content: [{ type: "text", text: "Mouse click needs both x and y." }], isError: true };
    }
    let clickX: number | undefined = x;
    let clickY: number | undefined = y;
    let targetLabel = "";
    if (widget) {
      if (x != null || key || action) {
        return { content: [{ type: "text", text: "widget is mutually exclusive with key/action/x/y." }], isError: true };
      }
      const b = await widgetBounds(widget);
      if (!b) {
        return { content: [{ type: "text", text: `No HUD element matched "${widget}". Try sector_hud filter='${widget}'.` }], isError: true };
      }
      const c = rectCenter(b);
      clickX = c.x;
      clickY = c.y;
      targetLabel = `widget=${widget} `;
    }

    const body: any = { duration_ms };
    if (key) body.key = key;
    if (action) body.action = action;
    if (clickX != null && clickY != null) { body.x = clickX; body.y = clickY; body.button = button; }
    if (!key && !action && clickX == null) {
      return { content: [{ type: "text", text: "Provide key, action, x/y, widget, or interactive=true." }], isError: true };
    }

    let cap: InjectCapture;
    try {
      cap = await injectAndCapture(body);
    } catch (e: any) {
      return { content: [{ type: "text", text: `Input failed: ${e.message}` }], isError: true };
    }

    if (!cap.before) {
      const text = formatInputResult({
        targetLabel, verbose, injected: cap.result,
        beforePath: cap.beforePath, afterPath: cap.afterPath,
        changedPct: null, region: null,
      });
      return { content: await imageResult(cap.after, convert_to_text, text) };
    }

    if (!image_diff) {
      return {
        content: [
          ...(await imageResult(cap.before, convert_to_text, `BEFORE — ${cap.beforePath}`)),
          ...(await imageResult(cap.after, convert_to_text, `AFTER — ${cap.afterPath}`)),
        ],
      };
    }

    const region = cap.region!;
    if (!region.bytes || !region.rect) {
      const text = formatInputResult({
        targetLabel, verbose, injected: cap.result,
        beforePath: cap.beforePath, afterPath: cap.afterPath,
        changedPct: region.diff.changed_pct, region: null,
      });
      return { content: [{ type: "text", text }] };
    }
    // The rect is the changed region in NATIVE render-target pixels. Crop-local
    // pixel (cx,cy) maps back to native (cx + rect.x, cy + rect.y).
    const text = formatInputResult({
      targetLabel, verbose, injected: cap.result,
      beforePath: cap.beforePath, afterPath: cap.afterPath,
      changedPct: region.diff.changed_pct, region: region.rect,
    });
    return { content: await imageResult(region.bytes, convert_to_text, text) };
  }
);

server.tool(
  "sector_interact",
  "Interactive HUD picker — elicits a click target from the live Gum render tree, loops until you finish.",
  {
    duration_ms: z.number().default(500).describe("How long to hold each click in milliseconds"),
    button: z.enum(["left", "right"]).default("left").describe("Mouse button for each click."),
    convert_to_text: z.boolean().default(false).describe("Return ASCII-luminance renderings instead of PNG images."),
  },
  async ({ duration_ms, button, convert_to_text }) => {
    const clicks: string[] = [];
    let lastImg: any[] = [];
    const DONE = "✓ done";
    while (true) {
      const tree = (await listGumNodes()).slice(0, 48);
      if (!tree.length) {
        return { content: [{ type: "text", text: "No Gum nodes with bounds to interact with." }], isError: true };
      }
      let resp: any;
      try {
        // enum holds plain labels (the values); enumNames shows the indented
        // containment tree so a single pick reaches any node.
        resp = await server.server.elicitInput({
          message: clicks.length
            ? `${clicks.length} click(s) so far. Pick the next HUD element, or finish.`
            : "Pick a HUD element to click.",
          requestedSchema: {
            type: "object",
            properties: {
              pick: {
                type: "string",
                title: "Element",
                description: "HUD element to click at its bounds centre.",
                ...buildElicitChoices(tree, DONE),
              },
            },
            required: ["pick"],
          },
        });
      } catch (e: any) {
        // Client lacks elicitation — degrade to the indented named tree with
        // each node's click centre, so sector_input x/y can reach any of them.
        const listing = tree
          .map((n) => {
            const c = rectCenter(n.bounds);
            return `  ${"  ".repeat(n.depth)}${n.label} → click (${c.x},${c.y})`;
          })
          .join("\n");
        return { content: [{ type: "text", text: `Interactive picker unavailable (${e.message}).\nGum render tree:\n${listing}\n\nClick one with sector_input x=<x> y=<y>.` }] };
      }
      const pick: string | undefined = resp?.content?.pick;
      if (resp?.action !== "accept" || !pick || pick === DONE) break;
      const picked = tree.find((n) => n.label === pick);
      if (!picked) break;
      const { x: cx, y: cy } = rectCenter(picked.bounds);
      try {
        const cap = await injectAndCapture({ duration_ms, x: cx, y: cy, button });
        const pct = cap.region?.diff.changed_pct ?? 0;
        clicks.push(`${pick} @(${cx},${cy}) → ${pct}%`);
        if (cap.region?.bytes) lastImg = await imageResult(cap.region.bytes, convert_to_text);
      } catch (e: any) {
        clicks.push(`${pick} @(${cx},${cy}) → FAILED: ${e.message}`);
      }
    }
    const summary = clicks.length
      ? `Interactive session — ${clicks.length} click(s):\n  ${clicks.join("\n  ")}`
      : "Interactive session — no clicks.";
    return { content: [{ type: "text", text: summary }, ...lastImg] };
  }
);

server.tool(
  "sector_tree",
  "Walk the live game object graph — services, components, screens, session state",
  {
    root: z.string().optional().describe("Restrict to: Services, Components, RootScreen, or SessionState"),
    depth: z.number().optional().default(2).describe("Max traversal depth (1-10)"),
  },
  async ({ root, depth }) => {
    const params = new URLSearchParams();
    if (root) params.set("root", root);
    if (depth) params.set("depth", depth.toString());
    const qs = params.toString();
    const result = await fetchJson(`/tree${qs ? "?" + qs : ""}`);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "sector_layout",
  "ASCII diagram of HUD element positions, aspect-corrected for terminal display",
  {
    cols: z.number().optional().default(120).describe("Grid width in columns (rows auto-computed)"),
    highlight: z.string().optional().describe("Element name to highlight (e.g. 'MiningPanel')"),
  },
  async ({ cols, highlight }) => {
    const params = new URLSearchParams();
    if (cols) params.set("cols", cols.toString());
    if (highlight) params.set("highlight", highlight);
    const qs = params.toString();
    const result = await fetchJson(`/layout${qs ? "?" + qs : ""}`);
    if (result.ascii) {
      return { content: [{ type: "text", text: result.ascii }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "sector_hud",
  "List HUD elements with TypeName, LastDrawnBounds, and EmptyStateReason.",
  {
    filter: z.string().optional().describe("Substring filter on type name (case-insensitive)"),
    format: z.enum(["json", "table"]).optional().default("table").describe("Output format"),
  },
  async ({ filter, format }) => {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    if (format) params.set("format", format);
    const qs = params.toString();
    const result = await fetchJson(`/hud${qs ? "?" + qs : ""}`);
    if (typeof result === "string" || result.table) {
      return { content: [{ type: "text", text: result.table ?? result }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "sector_logtail",
  "Tail the in-process GameLog ring buffer with optional grep and level filter.",
  {
    tail: z.number().optional().default(100).describe("Number of entries to return (1-1024)"),
    grep: z.string().optional().describe("Regex to filter messages (case-insensitive)"),
    level: z.enum(["INFO", "WARN", "ERROR"]).optional().describe("Minimum level"),
    format: z.enum(["json", "text"]).optional().default("text").describe("Output format"),
  },
  async ({ tail, grep, level, format }) => {
    const params = new URLSearchParams();
    if (tail) params.set("tail", tail.toString());
    if (grep) params.set("grep", grep);
    if (level) params.set("level", level);
    if (format) params.set("format", format);
    const qs = params.toString();
    const resp = await fetch(`${baseUrl()}/log${qs ? "?" + qs : ""}`);
    const text = await resp.text();
    if (format === "json") {
      try {
        return { content: [{ type: "text", text: JSON.stringify(JSON.parse(text)) }] };
      } catch {
        return { content: [{ type: "text", text }] };
      }
    }
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "sector_list",
  "Find live instances by runtime type-name substring.",
  {
    type: z.string().describe("Type name substring (case-insensitive), e.g. 'HudStatusBar' or 'Panel'"),
    max: z.number().optional().default(50).describe("Max hits to return (1-200)"),
  },
  async ({ type, max }) => {
    const params = new URLSearchParams();
    params.set("type", type);
    if (max) params.set("max", max.toString());
    const result = await fetchJson(`/list?${params.toString()}`);
    const items: any[] = result?.items ?? result?.matches ?? result?.results ?? [];
    const count = result?.count ?? items.length;
    if (count === 0) return { content: [{ type: "text", text: `No instances match "${type}".` }] };
    const previews = items.slice(0, 10).map((i: any) => i.preview ?? i.TypeName ?? i.type ?? "[?]").join("\n  ");
    const more = count > 10 ? `\n  … ${count - 10} more` : "";
    return { content: [{ type: "text", text: `${count} instance(s) matching "${type}":\n  ${previews}${more}` }] };
  }
);

function pathMatches(node: GumTreeNode, ancestors: string[], expandPath: string | undefined): boolean {
  if (!expandPath) return false;
  const needle = expandPath.toLowerCase();
  if (node.name.toLowerCase().includes(needle)) return true;
  return ancestors.some((a) => a.toLowerCase().includes(needle));
}

function renderGumTree(
  nodes: GumTreeNode[],
  maxDepth: number,
  expandPath: string | undefined,
  filter: string | undefined,
  lines: string[],
  prefix: string,
  ancestors: string[]
): void {
  const filterLc = filter?.toLowerCase();
  const visible = filterLc
    ? nodes.filter((n) => subtreeMatches(n, filterLc))
    : nodes;

  visible.forEach((n, i) => {
    const last = i === visible.length - 1;
    const branch = prefix + (last ? "└─ " : "├─ ");
    const rect = `[${n.bounds.x},${n.bounds.y} ${n.bounds.w}x${n.bounds.h}]`;
    lines.push(`${branch}${n.name} ${rect}  ${n.units}`);

    const hasChildren = n.children.length > 0;
    const forceExpand = pathMatches(n, ancestors, expandPath);
    const withinDepth = n.depth < maxDepth;
    const shouldRecurse = hasChildren && (withinDepth || forceExpand);

    if (shouldRecurse) {
      const childPrefix = prefix + (last ? "   " : "│  ");
      renderGumTree(n.children, maxDepth, expandPath, filter, lines, childPrefix, [...ancestors, n.name]);
    } else if (hasChildren) {
      const childPrefix = prefix + (last ? "   " : "│  ");
      const count = countSubtree(n.children);
      lines.push(`${childPrefix}└─ … ${count} hidden (expandPath=${n.name} or increase maxDepth)`);
    }
  });
}

function subtreeMatches(n: GumTreeNode, filterLc: string): boolean {
  if (n.name.toLowerCase().includes(filterLc)) return true;
  return n.children.some((c) => subtreeMatches(c, filterLc));
}

function countSubtree(nodes: GumTreeNode[]): number {
  let c = 0;
  for (const n of nodes) c += 1 + countSubtree(n.children);
  return c;
}

server.tool(
  "sector_gum",
  "Dump the live Gum layout tree (rooted on HudRoot._gumRoot), pruned by default.",
  {
    format: z.enum(["tree", "json", "table"]).optional().default("tree").describe("Output format. 'tree' is a pruned expandable view; 'json'/'table' return the full flat dump."),
    maxDepth: z.number().int().min(0).max(20).optional().default(2).describe("Tree format only: collapse nodes deeper than this (0 = roots only)."),
    expandPath: z.string().optional().describe("Tree format only: node name substring — matched nodes and their subtrees are fully expanded regardless of maxDepth."),
    filter: z.string().optional().describe("Tree format only: only show subtrees whose name (or descendant name) contains this substring."),
  },
  async ({ format, maxDepth, expandPath, filter }) => {
    if (format === "table") {
      const result = await fetchJson(`/gum?format=table`);
      return { content: [{ type: "text", text: result.table ?? String(result) }] };
    }

    const result = await fetchJson(`/gum`);
    if (result?.error) {
      return { content: [{ type: "text", text: JSON.stringify(result) }], isError: true };
    }
    const flat: GumFlatNode[] = result?.nodes ?? [];

    if (format === "json") {
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    }

    const tree = buildGumTree(flat);
    const lines: string[] = [];
    const total = flat.length;
    lines.push(`Gum tree: ${total} nodes total, maxDepth=${maxDepth}${expandPath ? `, expandPath="${expandPath}"` : ""}${filter ? `, filter="${filter}"` : ""}`);
    lines.push("");
    renderGumTree(tree, maxDepth, expandPath, filter, lines, "", []);
    lines.push("");
    lines.push(`// Tip: re-call with expandPath="NodeName" to drill in, or format="json" for the full ${total}-node dump.`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

server.tool(
  "sector_pick",
  "Return HUD elements whose LastDrawnBounds contain the given viewport pixel.",
  {
    x: z.number().describe("Viewport X pixel (0 = left)"),
    y: z.number().describe("Viewport Y pixel (0 = top)"),
  },
  async ({ x, y }) => {
    const params = new URLSearchParams();
    params.set("x", x.toString());
    params.set("y", y.toString());
    const result = await fetchJson(`/pick?${params.toString()}`);

    let hint = "";
    if (result?.count > 1 && Array.isArray(result.candidates)) {
      const optionLines = result.candidates
        .map((c: any) => `  ${c.index}. ${c.type} @ [${c.bounds.x},${c.bounds.y} ${c.bounds.w}x${c.bounds.h}] — ${c.preview}`)
        .join("\n");
      hint =
        `\n\n// ${result.count} candidates at (${x},${y}). Use mcp__elicit__elicit_options with:\n` +
        `//   message: "Multiple HUD elements at (${x},${y}) — pick one to inspect"\n` +
        `//   options:\n${optionLines}`;
    } else if (result?.count === 1) {
      hint = `\n\n// Single candidate — use sector_eval to inspect deeper if needed.`;
    } else if (result?.count === 0) {
      hint = `\n\n// No HUD candidates at (${x},${y}). Nothing picked.`;
    }

    return { content: [{ type: "text", text: JSON.stringify(result) + hint }] };
  }
);

server.tool(
  "sector_shader_reload",
  "Hot-reload a shader by recompiling .fx source and swapping at runtime",
  {
    name: z.string().optional().describe("Shader name (e.g. 'CelShadeEffect'). Omit to reload all."),
  },
  async ({ name }) => {
    const body: any = name ? { name } : { all: true };
    const result = await fetchJson("/shader/reload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "sector_launch",
  "Launch Sector into piloting via --autolaunch, waiting for the debug bridge to come up.",
  {
    build: z.boolean().default(false).describe("When true, runs a fresh `dotnet build` first (slower). Default skips the build step."),
    ready_timeout_ms: z.number().default(90000).describe("How long to wait for the debug bridge to come up after spawn"),
  },
  async ({ build, ready_timeout_ms }) => {
    // Abort if a bridge is already live — don't stack instances.
    try {
      const status = await fetchJson("/status");
      return {
        content: [{ type: "text", text: `Game already running on port ${status.port} (pid ${status.pid}). Not spawning a new instance.` }],
        isError: true,
      };
    } catch {
      // Expected: no bridge yet, continue.
    }

    const projectRoot = join(import.meta.dir, "..", "..");
    const sectorCsproj = join(projectRoot, "Sector");
    if (!existsSync(sectorCsproj)) {
      return { content: [{ type: "text", text: `Cannot find Sector project at ${sectorCsproj}` }], isError: true };
    }

    const args = build
      ? ["run", "--project", "Sector", "--", "--autolaunch"]
      : ["run", "--project", "Sector", "-p:FormatOnBuild=false", "--", "--autolaunch"];

    // Spawn fully detached — survives MCP server shutdown.
    // `disown` + ignored stdio breaks the parent/child tie so the game keeps
    // running after this tool call returns and even after Claude Code exits.
    const proc = Bun.spawn({
      cmd: ["dotnet", ...args],
      cwd: projectRoot,
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });
    proc.unref();

    // Poll /status until ready.
    const deadline = Date.now() + ready_timeout_ms;
    let port = 0;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const status = await fetchJson("/status");
        port = status.port;
        break;
      } catch {
        // not ready yet
      }
    }
    if (!port) {
      return { content: [{ type: "text", text: `Bridge did not come up within ${ready_timeout_ms}ms` }], isError: true };
    }

    // --autolaunch flag handles menu skip in-process; no key injection needed.
    // Brief pause so the game fully initialises into piloting before we verify.
    await new Promise((r) => setTimeout(r, 1500));

    // Verify we ended up in piloting.
    try {
      const scene = await fetchJson("/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "Sector.App.Debug.SectorDebug.Scene()" }),
      });
      return {
        content: [{ type: "text", text: `Launched (pid ${proc.pid}, port ${port}). Scene: ${JSON.stringify(scene.result ?? scene)}` }],
      };
    } catch (e: any) {
      return { content: [{ type: "text", text: `Launched (pid ${proc.pid}, port ${port}) but scene query failed: ${e.message}` }] };
    }
  }
);

// ── Gum design-loop tools (no game required) ──────────────────────────────────

server.tool(
  "sector_render",
  "Render a .gucx component to PNG via gumcli (no game required).",
  {
    component: z.string().describe("Component name as declared in the .gucx <Name> field"),
    width: z.number().optional().describe("Render width in px (defaults to project canvas width)"),
    height: z.number().optional().describe("Render height in px (defaults to project canvas height)"),
    convert_to_text: z.boolean().default(false).describe("Return an ASCII-luminance rendering instead of the PNG image."),
  },
  async ({ component, width, height, convert_to_text }) => {
    if (!existsSync(GUMX_PATH)) {
      return { content: [{ type: "text", text: `Gum project not found at ${GUMX_PATH}` }], isError: true };
    }
    mkdirSync(RENDER_TMP, { recursive: true });
    const out = join(RENDER_TMP, `${component}.png`);
    try {
      const args = ["screenshot", GUMX_PATH, component, "--output", out];
      if (width != null)  { args.push("--width",  String(width));  }
      if (height != null) { args.push("--height", String(height)); }
      const result = await $`gumcli ${args}`.quiet().nothrow();
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `gumcli failed (${result.exitCode}):\n${result.stderr.toString()}\n${result.stdout.toString()}` }], isError: true };
      }
      if (!existsSync(out)) {
        return { content: [{ type: "text", text: `gumcli reported success but no PNG at ${out}` }], isError: true };
      }
      const bytes = Buffer.from(await Bun.file(out).arrayBuffer());
      return { content: await imageResult(bytes, convert_to_text, `${component} → ${out}`) };
    } catch (e: any) {
      return { content: [{ type: "text", text: `sector_render failed: ${e.message}\nIs gumcli on PATH? Install: dotnet tool install --global GumCli` }], isError: true };
    }
  }
);

server.tool(
  "sector_design",
  "Outline or read the JSX HUD design source at .claude/design/sector-hud/.",
  {
    file: z.string().optional().describe("Filename to outline (e.g. 'panels.jsx'). With `lines`, reads that range instead."),
    lines: z.string().optional().describe("With `file`: 1-based inclusive range, e.g. '25-215'. Returns source content."),
    query: z.string().optional().describe("Substring/regex matched against symbol names + signatures across all design files. Returns file:line-range per hit."),
    limit: z.number().optional().describe("Cap on emitted hits (query) or lines (with `lines`)."),
  },
  async ({ file, lines, query, limit }) => {
    if (!existsSync(DESIGN_DIR)) {
      return { content: [{ type: "text", text: `Design dir missing: ${DESIGN_DIR}` }], isError: true };
    }
    const isJsx = (f: string): boolean => /\.(jsx|tsx|js)$/.test(f);

    if (file) {
      const path = join(DESIGN_DIR, file);
      if (!existsSync(path)) {
        return { content: [{ type: "text", text: `File not found: ${file}\n\nAvailable:\n${readdirSync(DESIGN_DIR).join("\n")}` }], isError: true };
      }
      if (lines || !isJsx(file)) {
        const r = readFileWithRange(path, file, lines, limit);
        return "error" in r
          ? { content: [{ type: "text", text: r.error }], isError: true }
          : { content: [{ type: "text", text: r.text }] };
      }
      try {
        const syms = outlineJsx(path);
        return { content: [{ type: "text", text: `${formatOutline(file, syms)}\n\nRead a symbol with file='${file}' lines='<start-end>'.` }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Parse failed for ${file}: ${e.message}` }], isError: true };
      }
    }

    const files = readdirSync(DESIGN_DIR).filter(f => /\.(jsx|html|css|tsx|ts)$/.test(f)).sort();

    if (query) {
      const rx = compileQuery(query);
      const hits: string[] = [];
      for (const f of files) {
        if (!isJsx(f)) continue;
        let syms: OutlineSym[];
        try {
          syms = outlineJsx(join(DESIGN_DIR, f));
        } catch {
          continue;
        }
        for (const s of syms) {
          if (rx.test(s.name) || rx.test(s.signature)) {
            hits.push(`${f}:${s.startLine}-${s.endLine}  ${s.kind} ${s.name}`);
          }
        }
      }
      if (!hits.length) return { content: [{ type: "text", text: `No symbols match "${query}".` }] };
      return { content: [{ type: "text", text: `${capHits(hits, limit)}\n\nRead one with file=<name> lines='<start-end>'.` }] };
    }

    const listing: string[] = [];
    for (const f of files) {
      if (isJsx(f)) {
        try {
          const syms = outlineJsx(join(DESIGN_DIR, f));
          listing.push(`${f}  (${syms.length} symbols)`);
        } catch {
          listing.push(`${f}  (parse failed)`);
        }
      } else {
        listing.push(f);
      }
    }
    return {
      content: [{
        type: "text",
        text: `Design files:\n${listing.join("\n")}\n\nfile=<name> outlines · file+lines reads · query=<pat> finds symbols.`,
      }],
    };
  }
);

const CLI_DLL = resolve(REPO_ROOT, "Sector.Cli/bin/Debug/net10.0/Sector.Cli.dll");

// Outline cache keyed by source mtime — skips re-shelling Sector.Cli for
// unchanged files. See astCacheKey for invalidation semantics.
const astCache = new Map<string, { file: string; symbols: OutlineSym[] }[]>();

const astSymbolSchema = z.object({
  file: z.string(),
  kind: z.string(),
  name: z.string(),
  signature: z.string(),
  startLine: z.number(),
  endLine: z.number(),
});

server.registerTool(
  "sector_ast",
  {
    description: "Outline or read C# source via Roslyn AST (file or directory, repo-relative or absolute).",
    inputSchema: {
      path: z.string().describe("C# file or directory to outline (repo-relative or absolute)."),
      query: z.string().optional().describe("Substring/regex matched against symbol names + signatures."),
      refs: z.string().optional().describe("Find definitions + references of this C# symbol name across `path`."),
      lines: z.string().optional().describe("1-based inclusive range, e.g. '17-58'. Requires `path` to be a single file. Returns source content."),
      limit: z.number().optional().describe("Cap on emitted symbols (outline), hits (query), or lines (with `lines`)."),
    },
    outputSchema: {
      symbols: z.array(astSymbolSchema).optional().describe("Outline/query result — present unless `lines` was used."),
      source: z.object({ file: z.string(), text: z.string() }).optional().describe("Source range — present when `lines` was used."),
      truncated: z.boolean().optional().describe("True when symbols were capped by `limit`."),
    },
  },
  async ({ path, query, refs, lines, limit }) => {
    const abs = resolve(REPO_ROOT, path);
    if (!existsSync(abs)) {
      return { content: [{ type: "text", text: `Path not found: ${path}` }], isError: true };
    }
    if (lines) {
      if (!statSync(abs).isFile()) {
        return { content: [{ type: "text", text: "lines= requires `path` to be a single file." }], isError: true };
      }
      const rel = relative(REPO_ROOT, abs);
      const r = readFileWithRange(abs, rel, lines, limit);
      return "error" in r
        ? { content: [{ type: "text", text: r.error }], isError: true }
        : { content: [{ type: "text", text: r.text }], structuredContent: { source: { file: rel, text: r.text } } };
    }
    if (!existsSync(CLI_DLL)) {
      return { content: [{ type: "text", text: "Sector.Cli not built. Run: dotnet build Sector.Cli" }], isError: true };
    }
    if (refs) {
      const result = await $`dotnet ${CLI_DLL} ast --path ${abs} --refs ${refs}`.quiet().nothrow();
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `ast --refs failed (${result.exitCode}):\n${result.stderr.toString()}` }], isError: true };
      }
      let refParsed: { file: string; symbols: OutlineSym[] }[];
      try {
        refParsed = JSON.parse(result.stdout.toString());
      } catch (e: any) {
        return { content: [{ type: "text", text: `Bad ast JSON: ${e.message}` }], isError: true };
      }
      const refSyms = refParsed.flatMap((e) =>
        e.symbols.map((s) => ({ file: relative(REPO_ROOT, e.file), kind: s.kind, name: s.name, signature: s.signature, startLine: s.startLine, endLine: s.endLine })));
      if (!refSyms.length) {
        return { content: [{ type: "text", text: `No definition or reference of "${refs}" under ${path}.` }], structuredContent: { symbols: [] } };
      }
      const refHits = refSyms.map((s) => `${s.file}:${s.startLine}  ${s.kind} ${s.name}  ${s.signature}`);
      return {
        content: [{ type: "text", text: capHits(refHits, limit) }],
        structuredContent: capSymbols(refSyms, limit && limit > 0 ? limit : 100),
      };
    }
    let parsed: { file: string; symbols: OutlineSym[] }[];
    const cacheKey = astCacheKey(abs);
    const cached = astCache.get(cacheKey);
    if (cached) {
      parsed = cached;
    } else {
      const result = await $`dotnet ${CLI_DLL} ast --path ${abs}`.quiet().nothrow();
      if (result.exitCode !== 0) {
        return { content: [{ type: "text", text: `ast failed (${result.exitCode}):\n${result.stderr.toString()}\n${result.stdout.toString()}` }], isError: true };
      }
      try {
        parsed = JSON.parse(result.stdout.toString());
      } catch (e: any) {
        return { content: [{ type: "text", text: `Bad ast JSON: ${e.message}` }], isError: true };
      }
      astCache.set(cacheKey, parsed);
    }

    const entries = parsed.map((e) => ({ file: relative(REPO_ROOT, e.file), symbols: e.symbols }));

    if (query) {
      const rx = compileQuery(query);
      const hits: string[] = [];
      const matched: any[] = [];
      for (const e of entries) {
        for (const s of e.symbols) {
          if (rx.test(s.name) || rx.test(s.signature)) {
            hits.push(`${e.file}:${s.startLine}-${s.endLine}  ${s.kind} ${s.name}`);
            matched.push({ file: e.file, kind: s.kind, name: s.name, signature: s.signature, startLine: s.startLine, endLine: s.endLine });
          }
        }
      }
      if (!hits.length) {
        return { content: [{ type: "text", text: `No symbols match "${query}".` }], structuredContent: { symbols: [] } };
      }
      return {
        content: [{ type: "text", text: capHits(hits, limit) + "\n\nRead one with path=<file> lines='<start-end>'." }],
        structuredContent: capSymbols(matched, limit && limit > 0 ? limit : 100),
      };
    }

    const text = capOutline(entries, limit)
      + "\n\nFilter with query=<pat> · read a range with path=<file> lines='<start-end>'.";
    const allSyms = entries.flatMap((e) =>
      e.symbols.map((s) => ({ file: e.file, kind: s.kind, name: s.name, signature: s.signature, startLine: s.startLine, endLine: s.endLine })));
    return {
      content: [{ type: "text", text }],
      structuredContent: capSymbols(allSyms, limit && limit > 0 ? limit : 300),
    };
  }
);

server.tool(
  "sector_gum_diff",
  "Compare a rendered .gucx component against live HUD element bounds.",
  {
    component: z.string().describe("Component name in the .gucx (e.g. 'CrewCard')"),
    live_element: z.string().optional().describe("Live HUD element name to compare against. If omitted, defaults to component name."),
    width: z.number().optional().describe("Render width override"),
    height: z.number().optional().describe("Render height override"),
    convert_to_text: z.boolean().default(false).describe("Return an ASCII-luminance rendering instead of the PNG image."),
  },
  async ({ component, live_element, width, height, convert_to_text }) => {
    const liveName = live_element ?? component;
    mkdirSync(RENDER_TMP, { recursive: true });
    const out = join(RENDER_TMP, `${component}.png`);
    const args = ["screenshot", GUMX_PATH, component, "--output", out];
    if (width != null)  { args.push("--width",  String(width));  }
    if (height != null) { args.push("--height", String(height)); }

    const renderResult = await $`gumcli ${args}`.quiet().nothrow();
    let renderText = "";
    if (renderResult.exitCode !== 0) {
      renderText = `RENDER FAILED (${renderResult.exitCode}):\n${renderResult.stderr.toString()}`;
    } else if (!existsSync(out)) {
      renderText = `RENDER FAILED: gumcli ok but no file at ${out}`;
    }

    let liveText: string;
    try {
      const liveBounds = await fetchJson(`/hud?filter=${encodeURIComponent(liveName)}&format=json`);
      const elems: any[] = liveBounds?.elements ?? liveBounds?.rows ?? [];
      const hit = elems[0];
      const b = hit?.LastDrawnBounds ?? hit?.bounds;
      liveText = b
        ? `LIVE BOUNDS for "${liveName}": x=${b.X ?? b.x} y=${b.Y ?? b.y} w=${b.Width ?? b.w} h=${b.Height ?? b.h}`
        : `No live element "${liveName}" found in HUD`;
    } catch (e: any) {
      liveText = `LIVE BOUNDS UNAVAILABLE: ${e.message} (game not running?)`;
    }

    const content: any[] = [{ type: "text", text: `── ${component} ──\n${renderText || "render: ok"}\n\n${liveText}` }];
    if (renderResult.exitCode === 0 && existsSync(out)) {
      content.push(...(await imageResult(readFileSync(out), convert_to_text)));
    }
    return { content };
  }
);

async function main() {
  try {
    getPort();
  } catch {
    console.error("Warning: Sector debug bridge port file not found. Tools will fail until the game is running in Debug mode.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}

export { server, buildGumTree, renderGumTree };
