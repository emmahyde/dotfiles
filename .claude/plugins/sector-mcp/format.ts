// Pure result-formatting helpers for the sector_input / sector_status MCP tools.
// Extracted from index.ts handlers so they can be unit-tested without a live game.

import type { Rect } from "./visual.js";

/** Inputs to formatInputResult — the post-injection state of one sector_input call. */
export interface InputResultInput {
  /** Prefix identifying the target (e.g. "widget=Foo "). May be empty. */
  targetLabel: string;
  /** Verbose flag — true emits full JSON, false the terse one-liner. */
  verbose: boolean;
  /** Raw /input response echoed back in verbose mode. */
  injected: unknown;
  /** Path to the cached before-frame, or null when none was captured. */
  beforePath: string | null;
  /** Path to the cached after-frame. */
  afterPath: string;
  /** Changed-pixel percentage, or null when there was no before-frame. */
  changedPct: number | null;
  /** Changed-region rect, or null when the input produced no visible change. */
  region: Rect | null;
}

/**
 * Build the text block for a sector_input result. Three branches:
 *  - `changedPct == null`  → no before-frame was captured
 *  - `region == null`      → before-frame existed but nothing visibly changed
 *  - otherwise             → a changed region was found
 * Each branch returns full JSON when `verbose`, else a terse one-line summary.
 */
export function formatInputResult(r: InputResultInput): string {
  if (r.changedPct == null) {
    return r.verbose
      ? JSON.stringify({ injected: r.injected, after: r.afterPath })
      : `${r.targetLabel}injected · no before-frame`;
  }
  if (!r.region) {
    return r.verbose
      ? JSON.stringify({
          injected: r.injected,
          changed_pct: r.changedPct,
          before: r.beforePath,
          after: r.afterPath,
        })
      : `${r.targetLabel}injected · no visible change (${r.changedPct}%)`;
  }
  const region: Rect = r.region;
  return r.verbose
    ? JSON.stringify({
        injected: r.injected,
        changed_pct: r.changedPct,
        changed_region: region,
        crop_to_native: `native = (crop_x + ${region.x}, crop_y + ${region.y})`,
        before: r.beforePath,
        after: r.afterPath,
      })
    : `${r.targetLabel}changed ${r.changedPct}% · region [${region.x},${region.y} ${region.w}x${region.h}] · native=(cropX+${region.x},cropY+${region.y})`;
}

/** Structured output payload for sector_status. */
export interface StatusStructured {
  running: boolean;
  port?: number;
  pid?: number;
  scene?: string;
}

/**
 * Shape a /status response into the sector_status terse text + structured
 * object. Only the fields actually present on the response are carried over.
 */
export function buildStatusResult(result: any): { text: string; structured: StatusStructured } {
  const { port, pid, scene } = result ?? {};
  const parts = [
    port != null ? `port=${port}` : null,
    pid != null ? `pid=${pid}` : null,
    scene ? `scene=${scene}` : null,
  ].filter(Boolean);
  const structured: StatusStructured = { running: true };
  if (port != null) structured.port = port;
  if (pid != null) structured.pid = pid;
  if (scene) structured.scene = scene;
  return {
    text: parts.length ? parts.join(" ") : JSON.stringify(result),
    structured,
  };
}
