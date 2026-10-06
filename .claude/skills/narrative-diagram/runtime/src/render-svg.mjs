// render-svg.mjs — deterministic static SVG emission from validated intent +
// layout. ELK bend points are the route source of truth; every route segment is
// serialized horizontal or vertical, and each real bend becomes a quadratic
// corner of radius min(8, prev/2, next/2). Edge labels sit at the midpoint of
// the longest post-rounded segment so sibling labels cannot stack.

import { measureNode } from "./layout.mjs";

// Theme tokens: fill/stroke/text only. Geometry, labels, IDs and path d values
// are identical between themes by construction.
export const THEMES = {
  light: {
    bg: "#ffffff",
    ink: "#1f2328",
    dim: "#6a737d",
    line: "#546e7a",
    "label-bg": "#ffffff",
    branch: "#ef6c00",
    "branch-ink": "#9a4f00",
    "activity-fill": "#e3f2fd",
    "activity-stroke": "#1565c0",
    "event-fill": "#e8f5e9",
    "event-stroke": "#2e7d32",
    "decision-fill": "#fff3e0",
    "decision-stroke": "#ef6c00",
    "store-fill": "#e0f2f1",
    "store-stroke": "#00897b",
    "external-fill": "#ede7f6",
    "external-stroke": "#5e35b1",
    "namespace-fill": "#f4f5fb",
    "namespace-stroke": "#3949ab",
    "namespace-ink": "#1a237e",
    "entity-fill": "#ffffff",
    "entity-stroke": "#90a4ae",
    "role-core-fill": "#e3f2fd",
    "role-core-stroke": "#1565c0",
    "role-secondary-fill": "#e0f2f1",
    "role-secondary-stroke": "#00897b",
    "role-dependency-fill": "#fff3e0",
    "role-dependency-stroke": "#ef6c00",
    "role-runtime-fill": "#ede7f6",
    "role-runtime-stroke": "#5e35b1",
    "role-new-fill": "#e8f5e9",
    "role-new-stroke": "#2e7d32",
  },
  dark: {
    bg: "#0d1117",
    ink: "#e6edf3",
    dim: "#8b949e",
    line: "#6e7681",
    "label-bg": "#161b22",
    branch: "#d29922",
    "branch-ink": "#e3b341",
    "activity-fill": "#1c2f45",
    "activity-stroke": "#58a6ff",
    "event-fill": "#14301f",
    "event-stroke": "#3fb950",
    "decision-fill": "#3d2a10",
    "decision-stroke": "#d29922",
    "store-fill": "#0f3d3a",
    "store-stroke": "#56d4dd",
    "external-fill": "#2d2440",
    "external-stroke": "#a371f7",
    "namespace-fill": "#1c2233",
    "namespace-stroke": "#7d8590",
    "namespace-ink": "#c9d1f5",
    "entity-fill": "#161b22",
    "entity-stroke": "#3d444d",
    "role-core-fill": "#1c2f45",
    "role-core-stroke": "#58a6ff",
    "role-secondary-fill": "#0f3d3a",
    "role-secondary-stroke": "#56d4dd",
    "role-dependency-fill": "#3d2a10",
    "role-dependency-stroke": "#d29922",
    "role-runtime-fill": "#2d2440",
    "role-runtime-stroke": "#a371f7",
    "role-new-fill": "#14301f",
    "role-new-stroke": "#3fb950",
  },
};

export const DEFAULT_THEME = "light";

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function num(n) {
  return String(Math.round(n * 100) / 100);
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Snap every segment to the dominant axis, then merge collinear runs.
function snapAxis(points) {
  const out = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i++) {
    const p = out[out.length - 1];
    const q = points[i];
    if (Math.abs(q.x - p.x) >= Math.abs(q.y - p.y))
      out.push({ x: q.x, y: p.y });
    else out.push({ x: p.x, y: q.y });
  }
  return out;
}

function mergeCollinear(points) {
  const out = [{ x: points[0].x, y: points[0].y }];
  for (let i = 1; i < points.length; i++) {
    const p = out[out.length - 1];
    const q = points[i];
    if (p.x === q.x && p.y === q.y) continue;
    const prev = out[out.length - 2];
    if (
      prev &&
      ((p.x === q.x && prev.x === p.x) || (p.y === q.y && prev.y === p.y))
    ) {
      out[out.length - 1] = { x: q.x, y: q.y };
    } else {
      out.push({ x: q.x, y: q.y });
    }
  }
  return out;
}

// Serialize a polyline as orthogonal segments with quadratic corners.
// Returns { d, points, corners, runs, labelAnchor }.
export function serializeRoute(points) {
  const pts = mergeCollinear(snapAxis(points));
  const corners = [];
  if (pts.length >= 3) {
    const raw = [];
    for (let j = 1; j < pts.length - 1; j++) {
      const prev = pts[j - 1];
      const cur = pts[j];
      const next = pts[j + 1];
      const lenPrev = dist(prev, cur);
      const lenNext = dist(cur, next);
      if (lenPrev < 0.5 || lenNext < 0.5) continue;
      const axisPrev =
        Math.abs(prev.x - cur.x) > Math.abs(prev.y - cur.y) ? "h" : "v";
      const axisNext =
        Math.abs(next.x - cur.x) > Math.abs(next.y - cur.y) ? "h" : "v";
      if (axisPrev === axisNext) continue;
      raw.push({ j, inset: Math.min(8, lenPrev / 2, lenNext / 2) });
    }
    const insets = new Map(raw.map((c) => [c.j, c.inset]));
    // Guard: two corners sharing a short segment must not consume it entirely.
    for (let k = 0; k < raw.length; k++) {
      const c = raw[k];
      const next = raw[k + 1];
      if (next && next.j === c.j + 1) {
        const segLen = dist(pts[c.j], pts[c.j + 1]);
        const total = insets.get(c.j) + insets.get(next.j);
        if (total > segLen && segLen > 0) {
          const f = segLen / total;
          insets.set(c.j, insets.get(c.j) * f);
          insets.set(next.j, insets.get(next.j) * f);
        }
      }
    }
    for (const c of raw) {
      const inset = insets.get(c.j);
      if (inset > 0.01)
        corners.push({ j: c.j, x: pts[c.j].x, y: pts[c.j].y, inset });
    }
  }

  const cornerAt = new Map(corners.map((c) => [c.j, c]));
  const parts = [`M${num(pts[0].x)},${num(pts[0].y)}`];
  const runs = [];
  let runStart = { x: pts[0].x, y: pts[0].y };
  for (let j = 1; j < pts.length; j++) {
    const c = cornerAt.get(j);
    if (c && j < pts.length - 1) {
      const prev = pts[j - 1];
      const next = pts[j + 1];
      const lenIn = dist(prev, c);
      const lenOut = dist(next, c);
      const cs = {
        x: c.x + ((prev.x - c.x) / lenIn) * c.inset,
        y: c.y + ((prev.y - c.y) / lenIn) * c.inset,
      };
      const ce = {
        x: c.x + ((next.x - c.x) / lenOut) * c.inset,
        y: c.y + ((next.y - c.y) / lenOut) * c.inset,
      };
      parts.push(
        `L${num(cs.x)},${num(cs.y)}`,
        `Q${num(c.x)},${num(c.y)} ${num(ce.x)},${num(ce.y)}`,
      );
      runs.push({ from: runStart, to: cs });
      runStart = ce;
    } else {
      parts.push(`L${num(pts[j].x)},${num(pts[j].y)}`);
      runs.push({ from: runStart, to: pts[j] });
      runStart = pts[j];
    }
  }
  const usable = runs.filter((r) => dist(r.from, r.to) > 0.5);
  let labelAnchor = { x: pts[0].x, y: pts[0].y, axis: "h" };
  let best = -1;
  for (const r of usable) {
    const len = dist(r.from, r.to);
    if (len > best) {
      best = len;
      labelAnchor = {
        x: (r.from.x + r.to.x) / 2,
        y: (r.from.y + r.to.y) / 2,
        axis:
          Math.abs(r.from.y - r.to.y) > Math.abs(r.from.x - r.to.x) ? "v" : "h",
      };
    }
  }
  return { d: parts.join(""), points: pts, corners, runs, labelAnchor };
}

// Glyphs sit above the baseline, so a baseline block centred on 0 reads high.
// Half the 12px monospace cap height puts the ink on the centre line.
const CAP_HALF = 4;

function labelText(label, dy = 0) {
  const lines = String(label).split("\n");
  const start = -((lines.length - 1) * 7) + CAP_HALF + dy;
  const tspans = lines
    .map((line, i) =>
      i === 0
        ? `<tspan x="0" y="${num(start)}">${escapeXml(line)}</tspan>`
        : `<tspan x="0" dy="14">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text class="mex-label" text-anchor="middle">${tspans}</text>`;
}

const FLOW_NODE_CSS = [
  `.mex-svg .mex-node .mex-shape{stroke-width:1.8}`,
  `.mex-svg .mex-node[data-kind="activity"] .mex-shape{fill:var(--mex-activity-fill);stroke:var(--mex-activity-stroke)}`,
  `.mex-svg .mex-node[data-kind="event"] .mex-shape{fill:var(--mex-event-fill);stroke:var(--mex-event-stroke)}`,
  `.mex-svg .mex-node[data-kind="decision"] .mex-shape{fill:var(--mex-decision-fill);stroke:var(--mex-decision-stroke)}`,
  `.mex-svg .mex-node[data-kind="store"] .mex-shape{fill:var(--mex-store-fill);stroke:var(--mex-store-stroke)}`,
  `.mex-svg .mex-node[data-kind="external"] .mex-shape{fill:var(--mex-external-fill);stroke:var(--mex-external-stroke)}`,
].join("\n");

const SCHEMA_CSS = [
  `.mex-svg .mex-namespace-bounds{fill:var(--mex-namespace-fill);stroke:var(--mex-namespace-stroke);stroke-width:1.8;stroke-dasharray:6 4}`,
  `.mex-svg .mex-namespace-label{font:600 12px ui-monospace,Menlo,monospace;fill:var(--mex-namespace-ink)}`,
  `.mex-svg .mex-entity .mex-shape{stroke-width:1.8}`,
  `.mex-svg .mex-entity[data-role="core"] .mex-shape{fill:var(--mex-role-core-fill);stroke:var(--mex-role-core-stroke)}`,
  `.mex-svg .mex-entity[data-role="secondary"] .mex-shape{fill:var(--mex-role-secondary-fill);stroke:var(--mex-role-secondary-stroke)}`,
  `.mex-svg .mex-entity[data-role="dependency"] .mex-shape{fill:var(--mex-role-dependency-fill);stroke:var(--mex-role-dependency-stroke)}`,
  `.mex-svg .mex-entity[data-role="runtime"] .mex-shape{fill:var(--mex-role-runtime-fill);stroke:var(--mex-role-runtime-stroke)}`,
  `.mex-svg .mex-entity[data-role="new"] .mex-shape{fill:var(--mex-role-new-fill);stroke:var(--mex-role-new-stroke)}`,
].join("\n");

const SHARED_CSS = [
  `.mex-svg .mex-edge{fill:none;stroke:var(--mex-line);stroke-width:1.8;stroke-linejoin:round}`,
  `.mex-svg .mex-edge.branch{stroke:var(--mex-branch)}`,
  `.mex-svg .mex-edge-label{font:600 11px ui-monospace,Menlo,monospace;fill:var(--mex-ink)}`,
  `.mex-svg .mex-edge-label.branch{fill:var(--mex-branch-ink)}`,
  `.mex-svg .mex-edge-label-bg{fill:var(--mex-label-bg);stroke:var(--mex-line);stroke-width:1;opacity:.92}`,
  `.mex-svg .mex-label{font:600 12px ui-monospace,Menlo,monospace;fill:var(--mex-ink)}`,
  `.mex-svg .mex-entity-label{font:12px ui-monospace,Menlo,monospace;fill:var(--mex-ink)}`,
  `.mex-svg .mex-entity-stereotype{font-weight:600}`,
].join("\n");

function edgeLabelParts(id, text, anchor, branch) {
  const cls = branch ? "mex-edge-label branch" : "mex-edge-label";
  const w = String(text).length * 7 + 10;
  const bg = [];
  const label = [];
  if (anchor.axis === "h") {
    bg.push(
      `<rect class="mex-edge-label-bg" x="${num(anchor.x - w / 2)}" y="${num(anchor.y - 16)}" width="${num(w)}" height="15" rx="3"/>`,
    );
    label.push(
      `<text id="mex-label-${id}" class="${cls}" x="${num(anchor.x)}" y="${num(anchor.y - 7)}" text-anchor="middle">${escapeXml(text)}</text>`,
    );
  } else {
    bg.push(
      `<rect class="mex-edge-label-bg" x="${num(anchor.x + 6)}" y="${num(anchor.y - 8)}" width="${num(w)}" height="15" rx="3"/>`,
    );
    label.push(
      `<text id="mex-label-${id}" class="${cls}" x="${num(anchor.x + 6 + w / 2)}" y="${num(anchor.y + 4)}" text-anchor="middle">${escapeXml(text)}</text>`,
    );
  }
  return { bg, label };
}

// A label box (bg rect + text) centered on the given anchor.
function labelBox(anchor, w) {
  if (anchor.axis === "h") {
    return { x: anchor.x - w / 2, y: anchor.y - 16, w, h: 15 };
  }
  return { x: anchor.x + 6, y: anchor.y - 8, w, h: 15 };
}

// Prefer the longest post-rounded segment whose label box does not collide
// with any node; fall back to the longest segment overall. This keeps sibling
// branch labels off shared destinations AND off nearby shapes.
function clearLabelAnchor(route, text, nodeRects) {
  const w = String(text).length * 7 + 10;
  const candidates = [...route.runs]
    .filter((r) => dist(r.from, r.to) > 0.5)
    .map((r) => ({
      len: dist(r.from, r.to),
      axis:
        Math.abs(r.from.y - r.to.y) > Math.abs(r.from.x - r.to.x) ? "v" : "h",
      x: (r.from.x + r.to.x) / 2,
      y: (r.from.y + r.to.y) / 2,
    }))
    .sort((a, b) => b.len - a.len);
  if (candidates.length === 0) return route.labelAnchor;
  for (const c of candidates) {
    const box = labelBox(c, w);
    const clear = !nodeRects.some(
      (n) =>
        box.x < n.x + n.w &&
        n.x < box.x + box.w &&
        box.y < n.y + n.h &&
        n.y < box.y + box.h,
    );
    if (clear) return { x: c.x, y: c.y, axis: c.axis };
  }
  return { x: candidates[0].x, y: candidates[0].y, axis: candidates[0].axis };
}

function nodeRectsFrom(layout) {
  return [...layout.positions.values()].map((p) => ({
    x: p.x - p.width / 2,
    y: p.y - p.height / 2,
    w: p.width,
    h: p.height,
  }));
}

function flowNode(node, p) {
  const w = p.width;
  const h = p.height;
  const g = [
    `<g id="n-${node.id}" class="mex-node" data-node-id="${node.id}" data-kind="${node.kind}" transform="translate(${num(p.x)},${num(p.y)})">`,
  ];
  switch (node.kind) {
    case "decision":
      g.push(
        `<path class="mex-shape" d="M0,${num(-h / 2)}L${num(w / 2)},0L0,${num(h / 2)}L${num(-w / 2)},0Z"/>`,
      );
      break;
    case "event":
      g.push(
        `<rect class="mex-shape" x="${num(-w / 2)}" y="${num(-h / 2)}" width="${num(w)}" height="${num(h)}" rx="${num(h / 2)}"/>`,
      );
      break;
    case "store":
      g.push(
        `<path class="mex-shape" d="M${num(-w / 2)},${num(-h / 2 + 8)}A${num(w / 2)},8 0 0 1 ${num(w / 2)},${num(-h / 2 + 8)}L${num(w / 2)},${num(h / 2 - 8)}A${num(w / 2)},8 0 0 1 ${num(-w / 2)},${num(h / 2 - 8)}Z"/>`,
        `<path class="mex-shape" d="M${num(-w / 2)},${num(-h / 2 + 8)}A${num(w / 2)},8 0 0 0 ${num(w / 2)},${num(-h / 2 + 8)}"/>`,
      );
      break;
    case "external":
      g.push(
        `<rect class="mex-shape" x="${num(-w / 2)}" y="${num(-h / 2)}" width="${num(w)}" height="${num(h)}" rx="6"/>`,
        `<rect class="mex-shape" x="${num(-w / 2 + 6)}" y="${num(-h / 2 + 6)}" width="${num(w - 12)}" height="${num(h - 12)}" rx="4"/>`,
      );
      break;
    default:
      g.push(
        `<rect class="mex-shape" x="${num(-w / 2)}" y="${num(-h / 2)}" width="${num(w)}" height="${num(h)}" rx="8"/>`,
      );
  }
  g.push(labelText(node.label, node.kind === "store" ? 4 : 0), "</g>");
  return g.join("");
}

// SVG ids are prefixed by role: n- for nodes, e- for edges/relations. The
// intent-level e-/r- prefix is normalized away so ids stay single-prefixed.
export function svgEdgeId(intentId) {
  return "e-" + intentId.replace(/^(e|r)-/, "");
}

function renderEdge(edgeId, label, relation, layout, isBranch, nodeRects) {
  const pts = layout.routes.get(edgeId);
  const route = serializeRoute(pts);
  const marker = isBranch ? "mex-arrow-branch" : "mex-arrow";
  const cls = isBranch ? "mex-edge branch" : "mex-edge";
  const svgId = svgEdgeId(edgeId);
  const parts = [
    `<path id="${svgId}" class="${cls}" d="${route.d}" marker-end="url(#${marker})"/>`,
  ];
  if (label) {
    const anchor = nodeRects
      ? clearLabelAnchor(route, label, nodeRects)
      : route.labelAnchor;
    const { bg, label: labelEl } = edgeLabelParts(
      svgId,
      label,
      anchor,
      isBranch,
    );
    parts.push(...bg, ...labelEl);
  }
  return { parts, points: route.points };
}

export function renderFlow(intent, layout, theme = DEFAULT_THEME) {
  const t = THEMES[theme] || THEMES.light;
  const body = [];
  const nodeRects = nodeRectsFrom(layout);
  for (const edge of intent.edges) {
    const isBranch = edge.relation === "branch";
    body.push(
      renderEdge(
        edge.id,
        edge.label,
        edge.relation,
        layout,
        isBranch,
        nodeRects,
      ).parts.join(""),
    );
  }
  for (const node of intent.nodes) {
    body.push(flowNode(node, layout.positions.get(node.id)));
  }
  return assembleSvg("flow", intent, body, t, theme, layout);
}

export function renderSchema(intent, layout, theme = DEFAULT_THEME) {
  const t = THEMES[theme] || THEMES.light;
  const body = [];
  const nodeRects = nodeRectsFrom(layout);
  for (const rel of intent.relations) {
    body.push(
      renderEdge(
        rel.id,
        rel.label || rel.cardinality,
        "flow",
        layout,
        false,
        nodeRects,
      ).parts.join(""),
    );
  }
  for (const ns of intent.namespaces) {
    const b = layout.namespaceBounds.get(`ns-${ns.id}`);
    const g = [`<g id="ns-${ns.id}" class="mex-namespace">`];
    g.push(
      `<rect class="mex-namespace-bounds" x="${num(b.x)}" y="${num(b.y)}" width="${num(b.width)}" height="${num(b.height)}" rx="8"/>`,
      `<text class="mex-namespace-label" x="${num(b.x + 10)}" y="${num(b.y + 18)}">${escapeXml(ns.label)}</text>`,
    );
    for (const entity of ns.entities) {
      const p = layout.positions.get(entity.id);
      const w = p.width;
      const h = p.height;
      const lines = [entity.stereotype, ...(entity.fields || [])];
      // Center the text block on the entity: fields are left-aligned at
      // -blockW/2 so the union (stereotype centered + fields) is symmetric.
      const blockW = Math.max(...lines.map((l) => l.length)) * 7.2;
      const fieldsX = -blockW / 2;
      const tspans = lines
        .map((line, i) =>
          i === 0
            ? `<tspan x="0" y="${num(-h / 2 + 18)}" class="mex-entity-stereotype">\u00ab${escapeXml(line)}\u00bb</tspan>`
            : `<tspan x="${num(fieldsX)}" y="${num(-h / 2 + 36 + (i - 1) * 16)}" text-anchor="start">${escapeXml(line)}</tspan>`,
        )
        .join("");
      g.push(
        `<g id="n-${entity.id}" class="mex-entity" data-role="${entity.role}" data-entity-id="${entity.id}">`,
        `<rect class="mex-shape" x="${num(p.x - w / 2)}" y="${num(p.y - h / 2)}" width="${num(w)}" height="${num(h)}" rx="6"/>`,
        // The entity <g> is untransformed (rect coordinates are absolute), so the
        // label text carries the center translate itself.
        `<text class="mex-entity-label" text-anchor="middle" transform="translate(${num(p.x)},${num(p.y)})">${tspans}</text>`,
        "</g>",
      );
    }
    g.push("</g>");
    body.push(g.join(""));
  }
  return assembleSvg("schema", intent, body, t, theme, layout);
}

function assembleSvg(kind, intent, body, t, theme, layout) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (x, y) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const p of layout.positions.values()) {
    include(p.x - p.width / 2, p.y - p.height / 2);
    include(p.x + p.width / 2, p.y + p.height / 2);
  }
  for (const pts of layout.routes.values()) {
    for (const pt of pts) include(pt.x, pt.y);
  }
  if (layout.namespaceBounds) {
    for (const b of layout.namespaceBounds.values()) {
      include(b.x, b.y);
      include(b.x + b.width, b.y + b.height);
    }
  }
  const pad = 24;
  const vx = Math.floor(minX) - pad;
  const vy = Math.floor(minY) - pad;
  const vw = Math.ceil(maxX - minX) + pad * 2;
  const vh = Math.ceil(maxY - minY) + pad * 2;

  const vars = Object.entries(t)
    .map(([k, v]) => `--mex-${k}:${v}`)
    .join(";");
  const css = [
    `.mex-svg{${vars}}`,
    SHARED_CSS,
    kind === "flow" ? FLOW_NODE_CSS : SCHEMA_CSS,
  ].join("\n");
  const desc = `${intent.title} \u2014 ${intent.description}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="mex-svg mex-theme-${theme}" viewBox="${num(vx)} ${num(vy)} ${num(vw)} ${num(vh)}" role="img" aria-labelledby="title desc" data-intent-version="v1">`,
    `<style>${css}</style>`,
    `<title id="title">${escapeXml(intent.title)}</title>`,
    `<desc id="desc">${escapeXml(desc)}</desc>`,
    `<defs>`,
    `<marker id="mex-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0L8,4L0,8Z" fill="var(--mex-line)"/></marker>`,
    `<marker id="mex-arrow-branch" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0L8,4L0,8Z" fill="var(--mex-branch)"/></marker>`,
    `</defs>`,
    body.join("\n"),
    "</svg>",
  ].join("\n");
}

export { measureNode };
