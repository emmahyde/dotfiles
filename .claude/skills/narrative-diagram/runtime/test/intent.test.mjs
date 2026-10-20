// intent.test.mjs — every defined error and warning code asserted with its
// RFC 6901 JSON path.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseIntent, normalizeIntent } from "../src/intent.mjs";
import { validateIntent } from "../src/validate.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));
const flow = () => fixture("flow.intent.json");
const schema = () => fixture("schema.intent.json");

test("valid flow fixture passes with no errors or warnings", () => {
  const { errors, warnings } = validateIntent(
    parseIntent(JSON.stringify(flow())),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("valid schema fixture passes with no errors or warnings", () => {
  const { errors, warnings } = validateIntent(
    parseIntent(JSON.stringify(schema())),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("normalization fills direction, presentation, and missing edge ids", () => {
  const intent = normalizeIntent({
    version: "diagram-intent/v1",
    kind: "flow",
    title: "t",
    description: "d",
    nodes: [],
    edges: [{ from: { node: "a" }, to: { node: "b" }, relation: "flow" }],
  });
  assert.equal(intent.direction, "TB");
  assert.deepEqual(intent.presentation, {
    layout: { source: "auto", nodes: {} },
  });
  assert.equal(intent.edges[0].id, "e-a-b");
  // Generated edge id must be stable even with duplicates
  const two = normalizeIntent({
    version: "diagram-intent/v1",
    kind: "flow",
    title: "t",
    description: "d",
    nodes: [],
    edges: [
      { from: { node: "a" }, to: { node: "b" }, relation: "flow" },
      { from: { node: "a" }, to: { node: "b" }, relation: "flow" },
    ],
  });
  assert.equal(two.edges[0].id, "e-a-b");
  assert.equal(two.edges[1].id, "e-a-b-2");
});

const cases = [
  [
    "unsupported version",
    (i) => (i.version = "diagram-intent/v0"),
    "UNSUPPORTED_VERSION",
    "/version",
  ],
  ["unsupported kind", (i) => (i.kind = "map"), "UNSUPPORTED_KIND", "/kind"],
  ["unknown top-level field", (i) => (i.extra = 1), "UNKNOWN_FIELD", "/extra"],
  [
    "unknown node field",
    (i) => (i.nodes[0].zap = 1),
    "UNKNOWN_FIELD",
    "/nodes/0/zap",
  ],
  [
    "unknown detail field",
    (i) => (i.nodes[1].detail.nope = 1),
    "UNKNOWN_FIELD",
    "/nodes/1/detail/nope",
  ],
  [
    "unknown edge field",
    (i) => (i.edges[0].zap = 1),
    "UNKNOWN_FIELD",
    "/edges/0/zap",
  ],
  [
    "unknown endpoint field",
    (i) => (i.edges[0].from.zap = 1),
    "UNKNOWN_FIELD",
    "/edges/0/from/zap",
  ],
  [
    "unknown presentation field",
    (i) => (i.presentation.zap = 1),
    "UNKNOWN_FIELD",
    "/presentation/zap",
  ],
  [
    "unknown layout field",
    (i) => (i.presentation.layout.zap = 1),
    "UNKNOWN_FIELD",
    "/presentation/layout/zap",
  ],
  [
    "unknown layout-node field",
    (i) => (i.presentation.layout.nodes = { request: { x: 1, y: 2, z: 3 } }),
    "UNKNOWN_FIELD",
    "/presentation/layout/nodes/request/z",
  ],
  [
    "invalid node id",
    (i) => (i.nodes[0].id = "Bad id"),
    "INVALID_ID",
    "/nodes/0/id",
  ],
  [
    "duplicate node id",
    (i) => (i.nodes[1].id = i.nodes[0].id),
    "DUPLICATE_ID",
    "/nodes/1/id",
  ],
  [
    "duplicate edge id",
    (i) => (i.edges[1].id = i.edges[0].id),
    "DUPLICATE_ID",
    "/edges/1/id",
  ],
  ["blank title", (i) => (i.title = "  "), "BLANK_TEXT", "/title"],
  [
    "blank description",
    (i) => (i.description = ""),
    "BLANK_TEXT",
    "/description",
  ],
  [
    "blank node label",
    (i) => (i.nodes[0].label = "\n"),
    "BLANK_TEXT",
    "/nodes/0/label",
  ],
  [
    "unsupported node kind",
    (i) => (i.nodes[0].kind = "robot"),
    "UNSUPPORTED_NODE_KIND",
    "/nodes/0/kind",
  ],
  [
    "unsupported edge relation",
    (i) => (i.edges[0].relation = "jump"),
    "UNSUPPORTED_EDGE_ROLE",
    "/edges/0/relation",
  ],
  [
    "branch from non-decision",
    (i) => (i.edges[2].from.node = "resolve"),
    "UNSUPPORTED_EDGE_ROLE",
    "/edges/2/relation",
  ],
  [
    "dangling endpoint",
    (i) => (i.edges[0].to.node = "ghost"),
    "DANGLING_ENDPOINT",
    "/edges/0/to/node",
  ],
  [
    "self link",
    (i) => (i.edges[0].to.node = i.edges[0].from.node),
    "SELF_LINK",
    "/edges/0",
  ],
  [
    "invalid port",
    (i) => (i.edges[2].from.port = "x"),
    "INVALID_PORT",
    "/edges/2/from/port",
  ],
  [
    "more than three branches",
    (i) => {
      i.nodes.push({ id: "extra", kind: "activity", label: "Extra" });
      i.nodes.push({ id: "extra2", kind: "activity", label: "Extra 2" });
      i.edges.push({
        id: "e-available-extra",
        from: { node: "available" },
        to: { node: "extra" },
        relation: "branch",
      });
      i.edges.push({
        id: "e-available-extra2",
        from: { node: "available" },
        to: { node: "extra2" },
        relation: "branch",
      });
    },
    "TOO_MANY_BRANCHES",
    "/edges/7/relation",
  ],
  [
    "missing flow root",
    (i) => {
      i.edges.push({
        id: "e-done-request",
        from: { node: "done" },
        to: { node: "request" },
        relation: "flow",
      });
    },
    "MISSING_FLOW_ROOT",
    "",
  ],
  [
    "missing flow terminal",
    (i) => {
      i.edges.push({
        id: "e-done-request",
        from: { node: "done" },
        to: { node: "request" },
        relation: "flow",
      });
      i.edges.push({
        id: "e-request-resolve-2",
        from: { node: "request" },
        to: { node: "resolve" },
        relation: "flow",
      });
    },
    "MISSING_FLOW_TERMINAL",
    "",
  ],
  [
    "unsupported direction",
    (i) => (i.direction = "DIAGONAL"),
    "UNSUPPORTED_DIRECTION",
    "/direction",
  ],
  [
    "schema: unsupported entity role",
    (i) => (i.namespaces[0].entities[0].role = "bogus"),
    "UNSUPPORTED_NODE_ROLE",
    "/namespaces/0/entities/0/role",
    true,
  ],
  [
    "schema: unsupported cardinality",
    (i) => (i.relations[0].cardinality = "zero-to-many"),
    "UNSUPPORTED_CARDINALITY",
    "/relations/0/cardinality",
    true,
  ],
  [
    "schema: dangling relation endpoint",
    (i) => (i.relations[0].to = "ghost_table"),
    "DANGLING_ENDPOINT",
    "/relations/0/to",
    true,
  ],
  [
    "schema: relation self link",
    (i) => (i.relations[0].to = i.relations[0].from),
    "SELF_LINK",
    "/relations/0",
    true,
  ],
  [
    "schema: duplicate entity id",
    (i) => (i.namespaces[1].entities[0].id = i.namespaces[0].entities[0].id),
    "DUPLICATE_ID",
    "/namespaces/1/entities/0/id",
    true,
  ],
  [
    "unsupported layout source",
    (i) => (i.presentation.layout.source = "hand"),
    "UNSUPPORTED_LAYOUT_SOURCE",
    "/presentation/layout/source",
  ],
];

for (const [name, mutate, code, path, isSchema] of cases) {
  test(`flow/schema validation: ${name}`, () => {
    const intent = isSchema ? schema() : flow();
    mutate(intent);
    const { errors } = validateIntent(intent);
    const hit = errors.find((e) => e.code === code);
    assert.ok(
      hit,
      `expected error ${code} (${name}), got ${JSON.stringify(errors)}`,
    );
    assert.equal(hit.path, path);
  });
}

test("warnings: unreachable node", () => {
  const intent = flow();
  // A disconnected cycle: both nodes have incoming edges but neither is
  // reachable from the flow root.
  intent.nodes.push({ id: "a", kind: "activity", label: "A" });
  intent.nodes.push({ id: "b", kind: "activity", label: "B" });
  intent.edges.push({
    id: "e-a-b",
    from: { node: "a" },
    to: { node: "b" },
    relation: "flow",
  });
  intent.edges.push({
    id: "e-b-a",
    from: { node: "b" },
    to: { node: "a" },
    relation: "flow",
  });
  const { errors, warnings } = validateIntent(intent);
  assert.deepEqual(errors, []);
  const hits = warnings.filter((w) => w.code === "UNREACHABLE_NODE");
  assert.equal(hits.length, 2);
  assert.equal(hits[0].path, "/nodes/6");
  assert.equal(hits[1].path, "/nodes/7");
});

test("warnings: grammy layout omits a node", () => {
  const intent = flow();
  intent.presentation.layout.source = "grammy";
  intent.presentation.layout.nodes = Object.fromEntries(
    intent.nodes.slice(0, -1).map((n) => [n.id, { x: 100, y: 100 }]),
  );
  const { errors, warnings } = validateIntent(intent);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.code === "LAYOUT_OMITS_NODE"));
  assert.ok(warnings.some((w) => w.code === "LAYOUT_FALLBACK_AUTO"));
});

test("warnings: grammy layout adds an unknown node id", () => {
  const intent = flow();
  intent.presentation.layout.source = "grammy";
  intent.presentation.layout.nodes = Object.fromEntries(
    intent.nodes.map((n) => [n.id, { x: 100, y: 100 }]),
  );
  intent.presentation.layout.nodes.ghost = { x: 1, y: 1 };
  const { errors, warnings } = validateIntent(intent);
  assert.deepEqual(errors, []);
  const hit = warnings.find((w) => w.code === "LAYOUT_UNKNOWN_NODE");
  assert.ok(hit);
  assert.equal(hit.path, "/presentation/layout/nodes/ghost");
});

test("warnings: grammy layout with invalid coordinates falls back to auto", () => {
  const intent = flow();
  intent.presentation.layout.source = "grammy";
  intent.presentation.layout.nodes = Object.fromEntries(
    intent.nodes.map((n) => [n.id, { x: 100, y: 100 }]),
  );
  intent.presentation.layout.nodes.request = { x: NaN, y: 100 };
  const { errors, warnings } = validateIntent(intent);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.code === "LAYOUT_INVALID_COORD"));
  assert.ok(warnings.some((w) => w.code === "LAYOUT_FALLBACK_AUTO"));
});

test("warnings: auto layout with coordinates is ignored", () => {
  const intent = flow();
  intent.presentation.layout.nodes = { request: { x: 1, y: 2 } };
  const { errors, warnings } = validateIntent(intent);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.code === "LAYOUT_IGNORED"));
});

test("invalid JSON input reports INPUT_JSON_SYNTAX", () => {
  assert.throws(
    () => parseIntent("{ not json"),
    (e) => e.code === "INPUT_JSON_SYNTAX",
  );
});
