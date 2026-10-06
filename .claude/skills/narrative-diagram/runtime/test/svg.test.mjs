// svg.test.mjs — deterministic byte-identical output, accessibility contract,
// escaped labels, node hooks, and theme-invariant geometry.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseIntent } from "../src/intent.mjs";
import { layoutFlow, layoutSchema } from "../src/layout.mjs";
import { renderFlow, renderSchema, escapeXml } from "../src/render-svg.mjs";
import {
  optimizeSvg,
  svgoConfig,
  assertOptimizationContract,
  collectContractExpectations,
} from "../src/optimize.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  parseIntent(readFileSync(join(here, "fixtures", name), "utf8"));

async function compileFlow(intent, theme = "light") {
  const layout = await layoutFlow(intent);
  return optimizeSvg(renderFlow(intent, layout, theme), svgoConfig());
}

async function compileSchema(intent, theme = "light") {
  const layout = await layoutSchema(intent);
  return optimizeSvg(renderSchema(intent, layout, theme), svgoConfig());
}

test("compiling a fixture twice returns byte-identical SVG", async () => {
  for (const compile of [compileFlow, compileSchema]) {
    const intent =
      compile === compileFlow
        ? fixture("flow.intent.json")
        : fixture("schema.intent.json");
    const a = await compile(intent);
    const b = await compile(intent);
    assert.equal(a, b);
  }
});

test("svg carries role, title, description, markers, hooks, and stable ids", async () => {
  const intent = fixture("flow.intent.json");
  const svg = await compileFlow(intent);
  assert.match(svg, /<svg[^>]*\brole="img"/);
  assert.match(svg, /aria-labelledby="title desc"/);
  assert.match(svg, /<title id="title">Focused-context request<\/title>/);
  assert.match(svg, /<desc id="desc">[^<]+<\/desc>/);
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const marker of ["mex-arrow", "mex-arrow-branch"])
    assert.ok(ids.has(marker), `missing ${marker}`);
  for (const m of svg.matchAll(/\bmarker-end="url\(#([^)]+)\)"/g)) {
    assert.ok(ids.has(m[1]), `marker-end references unknown id ${m[1]}`);
  }
  for (const node of intent.nodes) {
    assert.ok(ids.has(`n-${node.id}`), `missing n-${node.id}`);
    assert.ok(
      svg.includes(`data-node-id="${node.id}"`),
      `missing data-node-id hook for ${node.id}`,
    );
  }
  for (const edge of intent.edges)
    assert.ok(
      ids.has(`e-${edge.id.replace(/^(e|r)-/, "")}`),
      `missing edge id for ${edge.id}`,
    );
  assert.match(svg, /data-intent-version="v1"/);
  assert.ok(!/<script/i.test(svg));
  assert.ok(!/\son[a-z]+\s*=/i.test(svg));
});

test("labels are XML-escaped", async () => {
  const intent = fixture("flow.intent.json");
  intent.nodes[1].label = 'A < B & "C"';
  const svg = await compileFlow(intent);
  assert.ok(
    svg.includes("A &lt; B &amp; &quot;C&quot;"),
    "escaped label text missing",
  );
  assert.ok(!svg.includes(">A < B"), "raw label text leaked");
  assert.equal(escapeXml('<&>"'), "&lt;&amp;&gt;&quot;");
});

test("schema svg renders namespaces, entity stereotypes, and data-role hooks", async () => {
  const intent = fixture("schema.intent.json");
  const svg = await compileSchema(intent);
  for (const ns of intent.namespaces)
    assert.ok(svg.includes(`id="ns-${ns.id}"`), `missing ns-${ns.id}`);
  for (const ns of intent.namespaces) {
    for (const entity of ns.entities) {
      assert.ok(
        svg.includes(`data-role="${entity.role}"`),
        `missing data-role=${entity.role}`,
      );
      assert.ok(
        svg.includes(`data-entity-id="${entity.id}"`),
        `missing data-entity-id=${entity.id}`,
      );
      assert.ok(
        svg.includes(`\u00ab${entity.stereotype}\u00bb`),
        `missing stereotype ${entity.stereotype}`,
      );
    }
  }
  // relations carry cardinality labels
  for (const rel of intent.relations) {
    assert.ok(svg.includes(rel.label), `missing relation label ${rel.label}`);
  }
});

test("light and dark themes differ only in style tokens, never geometry", async () => {
  for (const compile of [compileFlow, compileSchema]) {
    const intent =
      compile === compileFlow
        ? fixture("flow.intent.json")
        : fixture("schema.intent.json");
    const light = await compile(intent, "light");
    const dark = await compile(intent, "dark");
    const stripStyle = (s) =>
      s
        .replace(/<style>[\s\S]*?<\/style>/, "<style/>")
        .replace(/mex-theme-(light|dark)/, "mex-theme-X");
    assert.equal(
      stripStyle(light),
      stripStyle(dark),
      `${compile.name}: geometry differs between themes`,
    );
    assert.notEqual(light, dark, "themes should differ somewhere (tokens)");
  }
});

test("compiled output satisfies its own optimization contract", async () => {
  for (const compile of [compileFlow, compileSchema]) {
    const intent =
      compile === compileFlow
        ? fixture("flow.intent.json")
        : fixture("schema.intent.json");
    const layout =
      compile === compileFlow
        ? await layoutFlow(intent)
        : await layoutSchema(intent);
    const rendered =
      compile === compileFlow
        ? renderFlow(intent, layout)
        : renderSchema(intent, layout);
    const expected = collectContractExpectations(rendered);
    const optimized = optimizeSvg(rendered, svgoConfig());
    assert.deepEqual(assertOptimizationContract(optimized, expected), []);
  }
});

test("edge labels avoid nodes even when the longest segment would collide", async () => {
  // A wide decision pushes the naive longest-segment label onto a neighbor;
  // the renderer must pick a clear segment instead.
  const intent = parseIntent(
    JSON.stringify({
      version: "diagram-intent/v1",
      kind: "flow",
      title: "Wide decision label",
      description:
        "Long decision labels must not push branch labels onto nodes.",
      direction: "TB",
      nodes: [
        { id: "start", kind: "event", label: "Start" },
        {
          id: "wide",
          kind: "decision",
          label:
            "Is the context available for this particular request right now?",
        },
        { id: "a", kind: "activity", label: "Proceed" },
        { id: "b", kind: "activity", label: "Fall back" },
        { id: "end", kind: "event", label: "End" },
      ],
      edges: [
        {
          id: "e-start-wide",
          from: { node: "start" },
          to: { node: "wide" },
          relation: "flow",
        },
        {
          id: "e-wide-a",
          from: { node: "wide" },
          to: { node: "a" },
          relation: "branch",
          label: "yes",
        },
        {
          id: "e-wide-b",
          from: { node: "wide" },
          to: { node: "b" },
          relation: "branch",
          label: "no",
        },
        {
          id: "e-a-end",
          from: { node: "a" },
          to: { node: "end" },
          relation: "flow",
        },
        {
          id: "e-b-end",
          from: { node: "b" },
          to: { node: "end" },
          relation: "flow",
        },
      ],
      presentation: { layout: { source: "auto", nodes: {} } },
    }),
  );
  const layout = await layoutFlow(intent);
  const svg = renderFlow(intent, layout);
  // node rects from the renderer markup (rect-shaped nodes only)
  const nodeRects = [];
  for (const m of svg.matchAll(
    /<g id="n-([a-z0-9-]+)" class="mex-node"[^>]*transform="translate\(([^)]+)\)">\s*<rect class="mex-shape" x="(-?[0-9.]+)" y="(-?[0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g,
  )) {
    const [cx, cy] = m[2].split(" ").map(Number);
    nodeRects.push({
      id: m[1],
      x: cx + Number(m[3]),
      y: cy + Number(m[4]),
      w: Number(m[5]),
      h: Number(m[6]),
    });
  }
  for (const m of svg.matchAll(
    /<rect class="mex-edge-label-bg" x="(-?[0-9.]+)" y="(-?[0-9.]+)" width="([0-9.]+)" height="15"/g,
  )) {
    const box = { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: 15 };
    for (const n of nodeRects) {
      const overlap =
        box.x < n.x + n.w &&
        n.x < box.x + box.w &&
        box.y < n.y + n.h &&
        n.y < box.y + box.h;
      assert.ok(
        !overlap,
        `label box ${JSON.stringify(box)} overlaps node ${n.id}`,
      );
    }
  }
});
