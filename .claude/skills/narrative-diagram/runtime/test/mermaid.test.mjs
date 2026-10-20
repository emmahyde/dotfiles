// mermaid.test.mjs — one-way Grammy bridge: export lowers all five node kinds,
// carries edge labels, and appends exactly one version-1 layout comment; import
// reads only coordinates and never changes semantics.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseIntent } from "../src/intent.mjs";
import { layoutFlow } from "../src/layout.mjs";
import { exportMermaid, importGrammyLayout, MermaidExportError } from "../src/mermaid.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => parseIntent(readFileSync(join(here, "fixtures", name), "utf8"));

const ALL_KINDS = {
  version: "diagram-intent/v1",
  kind: "flow",
  title: "All shapes",
  description: "Every flow node kind.",
  direction: "TB",
  nodes: [
    { id: "eve", kind: "event", label: "Event" },
    { id: "act", kind: "activity", label: "Activity" },
    { id: "dec", kind: "decision", label: "Decision?" },
    { id: "sto", kind: "store", label: "Store" },
    { id: "ext", kind: "external", label: "External" },
  ],
  edges: [
    { id: "e-eve-act", from: { node: "eve" }, to: { node: "act" }, relation: "flow" },
    { id: "e-act-dec", from: { node: "act" }, to: { node: "dec" }, relation: "flow" },
    { id: "e-dec-sto", from: { node: "dec" }, to: { node: "sto" }, relation: "branch", label: "persist" },
    { id: "e-dec-ext", from: { node: "dec" }, to: { node: "ext" }, relation: "branch", label: "ask" },
  ],
  presentation: { layout: { source: "auto", nodes: {} } },
};

test("export lowers all five node kinds, carries edge labels, and appends one layout comment", async () => {
  const intent = parseIntent(JSON.stringify(ALL_KINDS));
  const layout = await layoutFlow(intent);
  const text = exportMermaid(intent, layout);
  assert.match(text, /^flowchart TB\n/m);
  assert.ok(text.includes("eve([Event])"));
  assert.ok(text.includes("act[Activity]"));
  assert.ok(text.includes("dec{Decision?}"));
  assert.ok(text.includes("sto[(Store)]"));
  assert.ok(text.includes("ext[[External]]"));
  assert.ok(text.includes("dec -->|persist| sto"));
  assert.ok(text.includes("dec -->|ask| ext"));
  const layoutLines = text.split("\n").filter((l) => l.startsWith("%% mc:layout "));
  assert.equal(layoutLines.length, 1, "exactly one %% mc:layout comment expected");
  const payload = JSON.parse(layoutLines[0].slice("%% mc:layout ".length));
  assert.equal(payload.version, 1);
  for (const node of intent.nodes) {
    const p = payload.nodes[node.id];
    assert.ok(p && Number.isInteger(p.x) && Number.isInteger(p.y), `missing integer coords for ${node.id}`);
  }
});

test("export rejects schema intents with MERMAID_EXPORT_UNSUPPORTED_KIND", async () => {
  const intent = fixture("schema.intent.json");
  assert.throws(() => exportMermaid(intent, { positions: new Map() }), (e) => {
    return e instanceof MermaidExportError && e.code === "MERMAID_EXPORT_UNSUPPORTED_KIND";
  });
});

test("import reads a valid layout without semantic changes", async () => {
  const intent = fixture("flow.intent.json");
  const layout = await layoutFlow(intent);
  const mermaid = exportMermaid(intent, layout);
  const before = JSON.stringify(intent.nodes);
  const result = importGrammyLayout(mermaid, intent);
  assert.equal(result.warnings.length, 0);
  const updated = result.intent;
  assert.equal(updated.presentation.layout.source, "grammy");
  for (const node of intent.nodes) {
    const want = layout.positions.get(node.id);
    const got = updated.presentation.layout.nodes[node.id];
    assert.equal(got.x, Math.round(want.x));
    assert.equal(got.y, Math.round(want.y));
  }
  // Semantics never change: labels, kinds, edges, details are untouched.
  assert.equal(JSON.stringify(updated.nodes), before);
  assert.equal(JSON.stringify(updated.edges), JSON.stringify(intent.edges));
  assert.equal(updated.title, intent.title);
});

test("import ignores edited mermaid semantics", async () => {
  const intent = fixture("flow.intent.json");
  const layout = await layoutFlow(intent);
  const mermaid = exportMermaid(intent, layout);
  // A user hand-edits the graph body; only the layout comment is respected.
  const edited = mermaid.replace("resolve --> available", "resolve --> focused");
  const result = importGrammyLayout(edited, intent);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.intent.presentation.layout.source, "grammy");
  assert.equal(JSON.stringify(result.intent.edges), JSON.stringify(intent.edges));
});

test("import downgrades incomplete or unknown layout data to auto with warnings", () => {
  const intent = fixture("flow.intent.json");
  const missing = importGrammyLayout(
    "flowchart TB\n  a[a]\n%% mc:layout " + JSON.stringify({ version: 1, nodes: { a: { x: 1, y: 2 } } }),
    intent,
  );
  assert.equal(missing.intent.presentation.layout.source, "auto");
  assert.ok(missing.warnings.some((w) => w.code === "LAYOUT_UNKNOWN_NODE"));
  assert.ok(missing.warnings.some((w) => w.code === "LAYOUT_OMITS_NODE"));
  assert.ok(missing.warnings.some((w) => w.code === "LAYOUT_FALLBACK_AUTO"));

  const partial = importGrammyLayout(
    "flowchart TB\n" +
      "%% mc:layout " + JSON.stringify({ version: 1, nodes: { request: { x: 1, y: 2 } } }),
    intent,
  );
  assert.equal(partial.intent.presentation.layout.source, "auto");
  assert.ok(partial.warnings.some((w) => w.code === "LAYOUT_OMITS_NODE"));

  const noComment = importGrammyLayout("flowchart TB\n  a[a]\n", intent);
  assert.equal(noComment.intent.presentation.layout.source, "auto");
  assert.ok(noComment.warnings.some((w) => w.code === "LAYOUT_FALLBACK_AUTO"));

  const badVersion = importGrammyLayout(
    "%% mc:layout " + JSON.stringify({ version: 2, nodes: {} }),
    intent,
  );
  assert.equal(badVersion.intent.presentation.layout.source, "auto");

  const invalidCoords = importGrammyLayout(
    "%% mc:layout " + JSON.stringify({ version: 1, nodes: Object.fromEntries(intent.nodes.map((n) => [n.id, { x: "oops", y: 2 }])) }),
    intent,
  );
  assert.equal(invalidCoords.intent.presentation.layout.source, "auto");
  assert.ok(invalidCoords.warnings.some((w) => w.code === "LAYOUT_INVALID_COORD"));
});

test("import only uses the FINAL layout comment", () => {
  const intent = fixture("flow.intent.json");
  const first = Object.fromEntries(intent.nodes.map((n) => [n.id, { x: 1, y: 1 }]));
  const second = Object.fromEntries(intent.nodes.map((n) => [n.id, { x: 99, y: 88 }]));
  const mermaid = [
    "flowchart TB",
    `%% mc:layout ${JSON.stringify({ version: 1, nodes: first })}`,
    `%% mc:layout ${JSON.stringify({ version: 1, nodes: second })}`,
  ].join("\n");
  const result = importGrammyLayout(mermaid, intent);
  assert.equal(result.intent.presentation.layout.source, "grammy");
  assert.equal(result.intent.presentation.layout.nodes.request.x, 99);
});
