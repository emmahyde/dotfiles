// mermaid.mjs — narrow Grammy adapter. Mermaid is a one-way editable fallback
// for Grammy, never canonical. exportMermaid lowers a validated flow intent;
// importGrammyLayout reads ONLY the final %% mc:layout payload and never treats
// manually edited Mermaid syntax as authoritative semantic input.

import { MERMAID_SHAPES, MERMAID_RESERVED } from "./intent.mjs";

export class MermaidExportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "MermaidExportError";
  }
}

function mermaidLabel(s) {
  if (/[|"[\]]|\n/.test(s)) {
    return `"${String(s).replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
  }
  return String(s);
}

function quotedId(id) {
  return MERMAID_RESERVED.has(id) ? `"${id}"` : id;
}

// Emits flowchart TB|LR with the five flow node kinds, edge labels, and exactly
// one trailing %% mc:layout comment carrying the current coordinates.
export function exportMermaid(intent, layout) {
  if (intent.kind !== "flow") {
    throw new MermaidExportError(
      "MERMAID_EXPORT_UNSUPPORTED_KIND",
      `mermaid export supports kind "flow" only (got "${intent.kind}")`,
    );
  }
  const dir = intent.direction === "LR" || intent.direction === "RL" ? "LR" : "TB";
  const lines = [`flowchart ${dir}`];
  for (const node of intent.nodes) {
    const [a, b] = MERMAID_SHAPES[node.kind] || MERMAID_SHAPES.activity;
    lines.push(`  ${quotedId(node.id)}${a}${mermaidLabel(node.label)}${b}`);
  }
  for (const edge of intent.edges) {
    lines.push(
      `  ${quotedId(edge.from.node)} -->${edge.label ? `|${mermaidLabel(edge.label)}|` : ""} ${quotedId(edge.to.node)}`,
    );
  }
  const nodes = {};
  for (const node of intent.nodes) {
    const p = layout.positions.get(node.id);
    nodes[node.id] = { x: Math.round(p.x), y: Math.round(p.y) };
  }
  lines.push(`%% mc:layout ${JSON.stringify({ version: 1, nodes })}`);
  return lines.join("\n") + "\n";
}

function withAutoLayout(intent, warnings, message) {
  warnings.push({
    code: "LAYOUT_FALLBACK_AUTO",
    message,
    path: "/presentation/layout",
  });
  return {
    intent: { ...intent, presentation: { layout: { source: "auto", nodes: {} } } },
    warnings,
  };
}

// Reads the LAST %% mc:layout comment, validates version/coordinates against the
// known node-ID set, and writes only presentation.layout. Incomplete or unknown
// layout data downgrades to auto with warnings.
export function importGrammyLayout(mermaidText, intent) {
  const warnings = [];
  let payload = null;
  for (const line of String(mermaidText).split(/\r?\n/)) {
    const m = line.match(/^%%\s*mc:layout\s+(.*)$/);
    if (m) payload = m[1];
  }
  if (payload === null) {
    return withAutoLayout(intent, warnings, "no %% mc:layout comment found in the mermaid source");
  }
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return withAutoLayout(intent, warnings, "%% mc:layout payload is not valid JSON");
  }
  if (
    !parsed || parsed.version !== 1 || !parsed.nodes ||
    typeof parsed.nodes !== "object" || Array.isArray(parsed.nodes)
  ) {
    return withAutoLayout(intent, warnings, "%% mc:layout payload is not a version-1 layout record");
  }

  const known = new Set((intent.nodes || []).map((n) => n.id));
  const nodes = {};
  let complete = true;
  for (const id of Object.keys(parsed.nodes)) {
    if (!known.has(id)) {
      warnings.push({
        code: "LAYOUT_UNKNOWN_NODE",
        message: `layout node "${id}" does not exist in the intent`,
        path: `/presentation/layout/nodes/${id}`,
      });
      continue;
    }
    const entry = parsed.nodes[id];
    const x = entry?.x;
    const y = entry?.y;
    if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
      warnings.push({
        code: "LAYOUT_INVALID_COORD",
        message: `layout node "${id}" has a non-finite coordinate`,
        path: `/presentation/layout/nodes/${id}`,
      });
      complete = false;
      continue;
    }
    nodes[id] = { x, y };
  }
  for (const node of intent.nodes) {
    if (!(node.id in parsed.nodes)) {
      warnings.push({
        code: "LAYOUT_OMITS_NODE",
        message: `layout omits node "${node.id}"`,
        path: "/presentation/layout/nodes",
      });
      complete = false;
    }
  }
  if (!complete) {
    return withAutoLayout(intent, warnings, "layout coordinates are incomplete; switched to auto layout");
  }
  return {
    intent: { ...intent, presentation: { layout: { source: "grammy", nodes } } },
    warnings,
  };
}
