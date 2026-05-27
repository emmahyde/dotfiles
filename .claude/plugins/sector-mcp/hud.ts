// HUD element helpers shared by the sector_input MCP tool.

import type { Rect } from "./visual.js";

export type HudTarget = { label: string; bounds: Rect };

/**
 * Map raw /hud elements to deduped, addressable click targets. Elements with no
 * (or zero-area) LastDrawnBounds are dropped; repeated TypeNames get a #n suffix
 * so each remains an addressable target.
 */
export function hudElementsToTargets(raw: unknown): HudTarget[] {
  const seen = new Map<string, number>();
  const out: HudTarget[] = [];
  for (const e of Array.isArray(raw) ? raw : []) {
    const b = e?.LastDrawnBounds ?? e?.bounds;
    if (!b) continue;
    const w = b.Width ?? b.w ?? 0;
    const h = b.Height ?? b.h ?? 0;
    if (w <= 0 || h <= 0) continue;
    const type = e?.TypeName ?? "?";
    const n = seen.get(type) ?? 0;
    seen.set(type, n + 1);
    out.push({
      label: n === 0 ? type : `${type}#${n}`,
      bounds: { x: b.X ?? b.x ?? 0, y: b.Y ?? b.y ?? 0, w, h },
    });
  }
  return out;
}

/** Rounded centre point of a rect. */
export function rectCenter(b: Rect): { x: number; y: number } {
  return { x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) };
}

export type HudNode = HudTarget & { depth: number };

export type GumFlatNode = {
  name: string;
  depth: number;
  bounds: Rect;
  units: string;
};

export type GumTreeNode = GumFlatNode & { children: GumTreeNode[] };

/** Reconstruct the Gum hierarchy from the depth-tagged flat /gum dump. */
export function buildGumTree(flat: GumFlatNode[]): GumTreeNode[] {
  const roots: GumTreeNode[] = [];
  const stack: GumTreeNode[] = [];
  for (const n of flat) {
    const node: GumTreeNode = { ...n, children: [] };
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= node.depth) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1]!.children.push(node);
    }
    stack.push(node);
  }
  return roots;
}

/**
 * Flatten the live Gum tree into addressable click targets: preorder, keeping
 * only nodes with non-zero draw area, with `depth` renormalised to the count of
 * kept ancestors so indentation stays gap-free. Repeated names get a #n suffix.
 * This is the real render hierarchy — unlike the geometry-inferred containment
 * tree.
 */
export function gumToHudNodes(flat: GumFlatNode[]): HudNode[] {
  const tree = buildGumTree(flat);
  const seen = new Map<string, number>();
  const out: HudNode[] = [];
  const visit = (nodes: GumTreeNode[], depth: number): void => {
    for (const n of nodes) {
      const kept = n.bounds.w > 0 && n.bounds.h > 0;
      if (kept) {
        const c = seen.get(n.name) ?? 0;
        seen.set(n.name, c + 1);
        out.push({
          label: c === 0 ? n.name : `${n.name}#${c}`,
          bounds: { ...n.bounds },
          depth,
        });
      }
      visit(n.children, kept ? depth + 1 : depth);
    }
  };
  visit(tree, 0);
  return out;
}

/**
 * Build the elicitation `enum`/`enumNames` arrays for the interactive picker.
 * `enum` holds plain labels (the selectable values); `enumNames` shows each
 * label indented by its containment depth so one pick reaches any node. The
 * `done` sentinel is appended unindented to both.
 */
export function buildElicitChoices(
  tree: HudNode[],
  done: string,
): { enum: string[]; enumNames: string[] } {
  return {
    enum: [...tree.map((n) => n.label), done],
    enumNames: [...tree.map((n) => "  ".repeat(n.depth) + n.label), done],
  };
}
