// layout.test.mjs — three-branch decision egress, Manhattan routes, corner
// radii, and non-overlapping node bounds.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseIntent } from "../src/intent.mjs";
import { layoutFlow, layoutSchema } from "../src/layout.mjs";
import { serializeRoute } from "../src/render-svg.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  parseIntent(readFileSync(join(here, "fixtures", name), "utf8"));

test("three-branch decision egresses distinct w/s/e sides", async () => {
  const intent = fixture("three-branch-flow.intent.json");
  const { positions, routes } = await layoutFlow(intent);
  const decision = positions.get("route");
  const egress = {};
  for (const edge of intent.edges.filter((e) => e.from.node === "route")) {
    const pts = routes.get(edge.id);
    const first = pts[0];
    const dx = first.x - decision.x;
    const dy = first.y - decision.y;
    const side =
      Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "e" : "w") : dy > 0 ? "s" : "n";
    egress[edge.to.node] = side;
  }
  assert.deepEqual(new Set(Object.values(egress)), new Set(["w", "s", "e"]));
});

test("every route segment is Manhattan (axis-aligned) with corner radius <= 8", async () => {
  const intent = fixture("three-branch-flow.intent.json");
  const { routes } = await layoutFlow(intent);
  for (const [edgeId, pts] of routes) {
    const route = serializeRoute(pts);
    for (const corner of route.corners) {
      assert.ok(
        corner.inset <= 8 + 1e-9,
        `${edgeId}: corner radius ${corner.inset} exceeds 8`,
      );
    }
    const snapped = route.points;
    for (let i = 1; i < snapped.length; i++) {
      const dx = Math.abs(snapped[i].x - snapped[i - 1].x);
      const dy = Math.abs(snapped[i].y - snapped[i - 1].y);
      assert.ok(
        dx < 1e-6 || dy < 1e-6,
        `${edgeId}: non-Manhattan segment ${snapped[i - 1].x},${snapped[i - 1].y} -> ${snapped[i].x},${snapped[i].y}`,
      );
    }
  }
});

test("no rendered node bounds overlap", async () => {
  const intent = fixture("three-branch-flow.intent.json");
  const { positions } = await layoutFlow(intent);
  const rects = [...positions.entries()].map(([id, p]) => ({
    id,
    x0: p.x - p.width / 2,
    x1: p.x + p.width / 2,
    y0: p.y - p.height / 2,
    y1: p.y + p.height / 2,
  }));
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap =
        a.x0 < b.x1 - 1e-6 &&
        b.x0 < a.x1 - 1e-6 &&
        a.y0 < b.y1 - 1e-6 &&
        b.y0 < a.y1 - 1e-6;
      assert.ok(!overlap, `${a.id} overlaps ${b.id}`);
    }
  }
});

test("schema layout places entities inside namespace bounds", async () => {
  const intent = fixture("schema.intent.json");
  const layout = await layoutSchema(intent);
  for (const ns of intent.namespaces) {
    const b = layout.namespaceBounds.get(`ns-${ns.id}`);
    assert.ok(b, `missing bounds for ns-${ns.id}`);
    for (const entity of ns.entities) {
      const p = layout.positions.get(entity.id);
      assert.ok(p, `missing position for ${entity.id}`);
      assert.ok(
        p.x - p.width / 2 >= b.x - 1e-6,
        `${entity.id} escapes namespace west edge`,
      );
      assert.ok(
        p.x + p.width / 2 <= b.x + b.width + 1e-6,
        `${entity.id} escapes namespace east edge`,
      );
      assert.ok(
        p.y - p.height / 2 >= b.y - 1e-6,
        `${entity.id} escapes namespace north edge`,
      );
      assert.ok(
        p.y + p.height / 2 <= b.y + b.height + 1e-6,
        `${entity.id} escapes namespace south edge`,
      );
    }
  }
  // Every relation has a route.
  for (const rel of intent.relations) {
    const pts = layout.routes.get(rel.id);
    assert.ok(pts && pts.length >= 2, `relation ${rel.id} has no route`);
  }
});

test("grammy-layout intents keep the provided coordinates", async () => {
  const intent = fixture("flow.intent.json");
  intent.presentation.layout.source = "grammy";
  intent.presentation.layout.nodes = Object.fromEntries(
    intent.nodes.map((n, i) => [
      n.id,
      { x: 120 + (i % 3) * 180, y: 80 + Math.floor(i / 3) * 140 },
    ]),
  );
  const { positions, routes } = await layoutFlow(intent);
  for (const node of intent.nodes) {
    const want = intent.presentation.layout.nodes[node.id];
    assert.equal(positions.get(node.id).x, want.x);
    assert.equal(positions.get(node.id).y, want.y);
  }
  for (const [edgeId, pts] of routes) {
    const route = serializeRoute(pts);
    for (const corner of route.corners) assert.ok(corner.inset <= 8 + 1e-9);
    const snapped = route.points;
    for (let i = 1; i < snapped.length; i++) {
      const dx = Math.abs(snapped[i].x - snapped[i - 1].x);
      const dy = Math.abs(snapped[i].y - snapped[i - 1].y);
      assert.ok(dx < 1e-6 || dy < 1e-6, `${edgeId}: non-Manhattan segment`);
    }
  }
});

test("routes detour around a blocking node between endpoints", async () => {
  const intent = parseIntent(
    JSON.stringify({
      version: "diagram-intent/v1",
      kind: "flow",
      title: "Detour",
      description: "A blocker sits between source and target.",
      direction: "TB",
      nodes: [
        { id: "a", kind: "activity", label: "A" },
        { id: "c", kind: "activity", label: "C" },
        { id: "b", kind: "activity", label: "Blocker" },
      ],
      edges: [
        {
          id: "e-a-c",
          from: { node: "a" },
          to: { node: "c" },
          relation: "flow",
        },
      ],
      presentation: {
        layout: {
          source: "grammy",
          nodes: {
            a: { x: 100, y: 100 },
            c: { x: 300, y: 300 },
            b: { x: 200, y: 190 },
          },
        },
      },
    }),
  );
  const { positions, routes } = await layoutFlow(intent);
  const blocker = positions.get("b");
  const pts = routes.get("e-a-c");
  const outside = pts.every((p) => {
    return (
      p.x < blocker.x - blocker.width / 2 - 1 ||
      p.x > blocker.x + blocker.width / 2 + 1 ||
      p.y < blocker.y - blocker.height / 2 - 1 ||
      p.y > blocker.y + blocker.height / 2 + 1
    );
  });
  assert.ok(
    outside,
    `route passes through the blocker: ${JSON.stringify(pts)}`,
  );
  // every route segment stays Manhattan
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i].x - pts[i - 1].x);
    const dy = Math.abs(pts[i].y - pts[i - 1].y);
    assert.ok(dx < 1e-6 || dy < 1e-6, `non-Manhattan segment at ${i}`);
  }
});

test("no route point lands inside any node, including its own target", async () => {
  const intent = fixture("three-branch-flow.intent.json");
  const { positions, routes } = await layoutFlow(intent);
  const inside = (p, n) =>
    p.x > n.x - n.width / 2 + 1 &&
    p.x < n.x + n.width / 2 - 1 &&
    p.y > n.y - n.height / 2 + 1 &&
    p.y < n.y + n.height / 2 - 1;
  for (const [edgeId, pts] of routes) {
    for (const p of pts) {
      for (const [nodeId, n] of positions) {
        assert.ok(
          !inside(p, n),
          `${edgeId} point ${JSON.stringify(p)} is inside node ${nodeId}`,
        );
      }
    }
  }
});

test("routes from a wide decision never re-enter the diamond", async () => {
  const intent = fixture("three-branch-flow.intent.json");
  intent.nodes[1].label =
    "A very wide decision label that forces a big diamond";
  const { positions, routes } = await layoutFlow(intent);
  const decision = positions.get("route");
  for (const edge of intent.edges.filter((e) => e.from.node === "route")) {
    const pts = routes.get(edge.id);
    // no point (other than the egress anchor itself) may sit inside the
    // diamond's bounding box
    const inside = pts.some((p, i) => {
      if (i === 0) return false; // the egress anchor is on the border
      return (
        Math.abs(p.x - decision.x) < decision.width / 2 - 1 &&
        Math.abs(p.y - decision.y) < decision.height / 2 - 1
      );
    });
    assert.ok(
      !inside,
      `${edge.id} re-enters the decision diamond: ${JSON.stringify(pts)}`,
    );
  }
});
