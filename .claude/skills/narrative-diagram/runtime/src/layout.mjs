// layout.mjs — ELK layered layout with owned, port-aware routing.
//
// ELK 0.11.x (the line Grammy uses) does not honor declared ports when routing
// edges in Node: sections always start at the source node's bottom center no
// matter the port side. Per the plan's contingency, ELK remains the layout
// engine for node positions and the semantic port allocator stays ours; edge
// routes are computed with a deterministic Manhattan router anchored at the
// allocated port slots. This never parses rendered paths and never mutates a
// DOM.

import ELK from "elkjs/lib/elk.bundled.js";
import { PORTS } from "./intent.mjs";

const elk = new ELK();

const CHAR_W = 7.2;
const LINE_H = 14;
const PAD_X = 16;
const PAD_Y = 10;

const LAYERED_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.spacing.nodeNodeBetweenLayers": 55,
  "elk.spacing.nodeNode": 42,
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.mergeEdges": true,
};

function directionOption(direction) {
  return { TB: "DOWN", BT: "UP", LR: "RIGHT", RL: "LEFT" }[direction] || "DOWN";
}

// Deterministic node metrics shared by layout and renderer.
export function measureNode(node) {
  const lines = String(node.label || "").split("\n");
  const maxLen = Math.max(1, ...lines.map((l) => l.length));
  const textW = Math.ceil(maxLen * CHAR_W) + PAD_X;
  const textH = lines.length * LINE_H + PAD_Y;
  switch (node.kind) {
    case "decision":
      // Short-and-wide by construction: the compiler owns diamond geometry now.
      // Generous width keeps labels inside the cut corners (≈25 chars);
      // longer labels should be rephrased — see SKILL.md.
      return { width: Math.max(170, textW + 56), height: 64 };
    case "store":
      // Cylinder: the seam arc eats 16px off the top and the base bulge 8 off
      // the bottom, so the text band is h - 24, centred 4 below the node centre.
      return {
        width: Math.max(132, textW + 12),
        height: Math.max(56, textH + 28),
      };
    case "external":
      // Double frame: the inner rect is inset 6 a side and carries the text.
      return {
        width: Math.max(132, textW + 12),
        height: Math.max(56, textH + 20),
      };
    case "event":
    case "activity":
    default:
      return { width: Math.max(120, textW), height: Math.max(44, textH + 8) };
  }
}

export function measureEntity(entity) {
  const lines = [entity.stereotype, ...(entity.fields || [])];
  const maxLen = Math.max(1, ...lines.map((l) => l.length));
  const width = Math.max(160, Math.ceil(maxLen * CHAR_W) + 28);
  const height = 30 + lines.length * 16;
  return { width, height };
}

// Allocate a port slot per (node, side) in declaration order. Anchors are then
// distributed evenly across the side, one slot per port.
function portAllocator() {
  const nodePorts = new Map();
  const counters = new Map();
  return {
    nodePorts,
    alloc(nodeId, side) {
      const key = `${nodeId}:${side}`;
      const index = counters.get(key) || 0;
      counters.set(key, index + 1);
      const port = { id: `${nodeId}:${side}:${index}`, side, index };
      if (!nodePorts.has(nodeId)) nodePorts.set(nodeId, []);
      nodePorts.get(nodeId).push(port);
      return port.id;
    },
  };
}

// Decision branches leave via distinct sides: 1 → s, 2 → w/e, 3 → w/s/e.
// Destinations are ordered by layer position (pass-1 y), then x, then id.
function computePorts(nodes, edges, positions) {
  const alloc = portAllocator();
  const edgePorts = new Map();
  const branchSide = new Map();
  for (const node of nodes) {
    if (node.kind !== "decision") continue;
    const branches = edges.filter(
      (e) => e.from.node === node.id && e.relation === "branch",
    );
    branches.sort((a, b) => {
      const pa = positions.get(a.to.node);
      const pb = positions.get(b.to.node);
      return (
        pa.y - pb.y ||
        pa.x - pb.x ||
        (a.to.node < b.to.node ? -1 : a.to.node > b.to.node ? 1 : 0)
      );
    });
    const sides =
      branches.length === 1
        ? ["s"]
        : branches.length === 2
          ? ["w", "e"]
          : ["w", "s", "e"];
    branches.forEach((e, i) => branchSide.set(e.id, sides[i] || "s"));
  }
  for (const edge of edges) {
    const fromSide =
      edge.from.port ||
      (edge.relation === "branch" ? branchSide.get(edge.id) || "s" : "s");
    const toSide = edge.to.port || "n";
    edgePorts.set(edge.id, {
      from: alloc.alloc(edge.from.node, fromSide),
      to: alloc.alloc(edge.to.node, toSide),
    });
  }
  return { nodePorts: alloc.nodePorts, edgePorts };
}

function positionsFromElk(layout) {
  const positions = new Map();
  for (const n of layout.children || []) {
    positions.set(n.id, {
      x: n.x + n.width / 2,
      y: n.y + n.height / 2,
      width: n.width,
      height: n.height,
    });
  }
  return positions;
}

function fixedPositions(intent) {
  const positions = new Map();
  for (const node of intent.nodes) {
    const m = measureNode(node);
    const { x, y } = intent.presentation.layout.nodes[node.id];
    positions.set(node.id, { x, y, width: m.width, height: m.height });
  }
  return positions;
}

const SIDE_VECTOR = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

function anchorPoint(position, side, index, count) {
  const { x, y, width, height } = position;
  const slot = (span) => -span / 2 + (span * (index + 1)) / (count + 1);
  switch (side) {
    case "n":
      return { x: x + slot(width), y: y - height / 2 };
    case "s":
      return { x: x + slot(width), y: y + height / 2 };
    case "w":
      return { x: x - width / 2, y: y + slot(height) };
    case "e":
      return { x: x + width / 2, y: y + slot(height) };
  }
}

function segClear(x0, y0, x1, y1, obstacles) {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  return !obstacles.some(
    (o) => minX <= o.x + o.w && o.x <= maxX && minY <= o.y + o.h && o.y <= maxY,
  );
}

// Deterministic Manhattan route between two side anchors. The route never
// contains a diagonal segment; corners are serialized as quadratic corners by
// the renderer.
//
// obstacles are inflated node rects of every node EXCEPT the target (the
// source is included so a bus that re-enters the source is rejected);
// endsObstacles are every node except both endpoints, used only for the short
// exit/approach segments that legitimately touch the endpoint borders.
//
// The primary bus (perpendicular to the exit direction) is tried first; if it
// cannot clear, the cross topology (bus parallel to the exit) is tried so a
// wide source can be routed around. Candidates try the midpoint first, then
// the edges of blocking nodes, sorted by distance from the midpoint.
export function orthogonalRoute(
  a,
  dirA,
  b,
  dirB,
  obstacles = [],
  endsObstacles = null,
) {
  const ends = endsObstacles || obstacles;
  const exitLen = 26;
  const entryLen = 20;
  // Both dirA and dirB are outward side normals, so both offsets add: A and B
  // sit outside their nodes. Subtracting for B puts the approach point inside
  // the target and drags the bus through it.
  const A = { x: a.x + dirA[0] * exitLen, y: a.y + dirA[1] * exitLen };
  const B = { x: b.x + dirB[0] * entryLen, y: b.y + dirB[1] * entryLen };
  const verticalExit = dirA[0] === 0;
  const exitClear = segClear(a.x, a.y, A.x, A.y, ends);
  const entryClear = segClear(B.x, B.y, b.x, b.y, ends);

  const tryPrimary = (coord) => {
    if (verticalExit) {
      if (
        segClear(A.x, A.y, A.x, coord, obstacles) &&
        segClear(A.x, coord, B.x, coord, obstacles) &&
        segClear(B.x, coord, B.x, B.y, obstacles)
      ) {
        return [a, A, { x: A.x, y: coord }, { x: B.x, y: coord }, B, b];
      }
    } else if (
      segClear(A.x, A.y, coord, A.y, obstacles) &&
      segClear(coord, A.y, coord, B.y, obstacles) &&
      segClear(coord, B.y, B.x, B.y, obstacles)
    ) {
      return [a, A, { x: coord, y: A.y }, { x: coord, y: B.y }, B, b];
    }
    return null;
  };

  const tryCross = (coord) => {
    if (verticalExit) {
      if (
        segClear(A.x, A.y, coord, A.y, obstacles) &&
        segClear(coord, A.y, coord, B.y, obstacles) &&
        segClear(coord, B.y, B.x, B.y, obstacles)
      ) {
        return [a, A, { x: coord, y: A.y }, { x: coord, y: B.y }, B, b];
      }
    } else if (
      segClear(A.x, A.y, A.x, coord, obstacles) &&
      segClear(A.x, coord, B.x, coord, obstacles) &&
      segClear(B.x, coord, B.x, B.y, obstacles)
    ) {
      return [a, A, { x: A.x, y: coord }, { x: B.x, y: coord }, B, b];
    }
    return null;
  };

  const build = (primary, cross) => {
    if (!exitClear || !entryClear) return null;
    for (const coord of primary.candidates) {
      const pts = tryPrimary(coord);
      if (pts) return pts;
    }
    for (const coord of cross.candidates) {
      const pts = tryCross(coord);
      if (pts) return pts;
    }
    return null;
  };

  const makeCandidates = (lo, hi, mid, side, span) => {
    const set = [mid];
    for (const o of obstacles)
      set.push(
        side === "y" ? o.y - 8 : o.x - 8,
        side === "y" ? o.y + o.h + 8 : o.x + o.w + 8,
      );
    return set
      .filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9)
      .sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
  };

  let pts;
  if (verticalExit) {
    const lo = Math.min(A.y, B.y);
    const hi = Math.max(A.y, B.y);
    const mid = (A.y + B.y) / 2;
    pts = build(
      { candidates: makeCandidates(lo, hi, mid, "y") },
      {
        candidates: makeCandidates(
          Math.min(A.x, B.x),
          Math.max(A.x, B.x),
          (A.x + B.x) / 2,
          "x",
        ),
      },
    );
  } else {
    const lo = Math.min(A.x, B.x);
    const hi = Math.max(A.x, B.x);
    const mid = (A.x + B.x) / 2;
    pts = build(
      { candidates: makeCandidates(lo, hi, mid, "x") },
      {
        candidates: makeCandidates(
          Math.min(A.y, B.y),
          Math.max(A.y, B.y),
          (A.y + B.y) / 2,
          "y",
        ),
      },
    );
  }
  if (pts) return dedupePoints(pts);

  // Best effort: the midpoint bus of the primary topology.
  const fallback = verticalExit
    ? [
        a,
        A,
        { x: A.x, y: (A.y + B.y) / 2 },
        { x: B.x, y: (A.y + B.y) / 2 },
        B,
        b,
      ]
    : [
        a,
        A,
        { x: (A.x + B.x) / 2, y: A.y },
        { x: (A.x + B.x) / 2, y: B.y },
        B,
        b,
      ];
  return dedupePoints(fallback);
}

function dedupePoints(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

// Slot every edge on its allocated ports and route it. Shared sides get
// distinct slots so parallel edges never overlap into one line.
// nodeIdOf resolves an endpoint id from an edge/relation object.
function routeEdges(edges, positions, ports, sideOf, nodeIdOf) {
  const routes = new Map();
  const sideCounts = new Map();
  for (const edge of edges) {
    const fromSide = sideOf(edge).from;
    const toSide = sideOf(edge).to;
    const fromKey = `${nodeIdOf(edge, "from")}:${fromSide}`;
    const toKey = `${nodeIdOf(edge, "to")}:${toSide}`;
    sideCounts.set(fromKey, (sideCounts.get(fromKey) || 0) + 1);
    sideCounts.set(toKey, (sideCounts.get(toKey) || 0) + 1);
  }
  const used = new Map();
  for (const edge of edges) {
    const fromSide = sideOf(edge).from;
    const toSide = sideOf(edge).to;
    const fromId = nodeIdOf(edge, "from");
    const toId = nodeIdOf(edge, "to");
    const fromKey = `${fromId}:${fromSide}`;
    const toKey = `${toId}:${toSide}`;
    const fi = used.get(fromKey) || 0;
    const ti = used.get(toKey) || 0;
    used.set(fromKey, fi + 1);
    used.set(toKey, ti + 1);
    const a = anchorPoint(
      positions.get(fromId),
      fromSide,
      fi,
      sideCounts.get(fromKey),
    );
    const b = anchorPoint(
      positions.get(toId),
      toSide,
      ti,
      sideCounts.get(toKey),
    );
    // Inflated rects: endsObstacles excludes both endpoints (used for the
    // short exit/approach segments); obstacles keeps the source so a bus that
    // would re-enter the source node is rejected.
    const rects = [...positions.entries()].map(([key, p]) => ({
      x: p.x - p.width / 2 - 4,
      y: p.y - p.height / 2 - 4,
      w: p.width + 8,
      h: p.height + 8,
      id: key,
    }));
    const rectKey = (entry) => entry[0];
    const obstacles = rects.filter((r) => r.id !== toId);
    const endsObstacles = rects.filter((r) => r.id !== fromId && r.id !== toId);
    routes.set(
      edge.id,
      orthogonalRoute(
        a,
        SIDE_VECTOR[fromSide],
        b,
        SIDE_VECTOR[toSide],
        obstacles,
        endsObstacles,
      ),
    );
  }
  return routes;
}

function flowSideOf(edge, ports) {
  const p = ports.edgePorts.get(edge.id);
  return { from: p.from.split(":")[1], to: p.to.split(":")[1] };
}

const flowNodeIdOf = (edge, side) =>
  side === "from" ? edge.from.node : edge.to.node;
const relationNodeIdOf = (edge, side) =>
  side === "from" ? edge.from : edge.to;

export async function layoutFlow(intent) {
  const nodes = intent.nodes;
  const edges = intent.edges;
  const positions =
    intent.presentation?.layout?.source === "grammy"
      ? fixedPositions(intent)
      : positionsFromElk(
          await elk.layout({
            id: "root",
            layoutOptions: {
              ...LAYERED_OPTIONS,
              "elk.direction": directionOption(intent.direction),
            },
            children: nodes.map((n) => {
              const m = measureNode(n);
              return { id: n.id, width: m.width, height: m.height };
            }),
            edges: edges.map((e) => ({
              id: e.id,
              sources: [e.from.node],
              targets: [e.to.node],
            })),
          }),
        );
  const ports = computePorts(nodes, edges, positions);
  const routes = routeEdges(
    edges,
    positions,
    ports,
    (edge) => flowSideOf(edge, ports),
    flowNodeIdOf,
  );
  return { positions, routes };
}

// Schema layout uses a flat layered graph (ELK 0.11.x cross-hierarchy edge
// coordinates are unreliable), with namespace bounds derived after layout as
// the union of each namespace's entity rects plus padding and a header band.
// ELK remains the layout engine; relations are routed by the same owned
// Manhattan router, anchored to the box side nearest the partner entity.
function computeSchemaPorts(relations, positions) {
  const alloc = portAllocator();
  const edgePorts = new Map();
  for (const rel of relations) {
    const a = positions.get(rel.from);
    const b = positions.get(rel.to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const fromSide = horizontal ? (dx >= 0 ? "e" : "w") : dy >= 0 ? "s" : "n";
    const toSide = horizontal ? (dx >= 0 ? "w" : "e") : dy >= 0 ? "n" : "s";
    edgePorts.set(rel.id, {
      from: alloc.alloc(rel.from, fromSide),
      to: alloc.alloc(rel.to, toSide),
    });
  }
  return { nodePorts: alloc.nodePorts, edgePorts };
}

export async function layoutSchema(intent) {
  const relations = intent.relations;
  const children = [];
  for (const ns of intent.namespaces) {
    for (const e of ns.entities) {
      const m = measureEntity(e);
      children.push({ id: e.id, width: m.width, height: m.height });
    }
  }
  const positions = positionsFromElk(
    await elk.layout({
      id: "root",
      layoutOptions: { ...LAYERED_OPTIONS, "elk.direction": "DOWN" },
      children,
      edges: relations.map((r) => ({
        id: r.id,
        sources: [r.from],
        targets: [r.to],
      })),
    }),
  );
  const ports = computeSchemaPorts(relations, positions);
  const routes = routeEdges(
    relations,
    positions,
    ports,
    (rel) => {
      const p = ports.edgePorts.get(rel.id);
      return { from: p.from.split(":")[1], to: p.to.split(":")[1] };
    },
    relationNodeIdOf,
  );
  const namespaceBounds = new Map();
  for (const ns of intent.namespaces) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const e of ns.entities) {
      const p = positions.get(e.id);
      minX = Math.min(minX, p.x - p.width / 2);
      minY = Math.min(minY, p.y - p.height / 2);
      maxX = Math.max(maxX, p.x + p.width / 2);
      maxY = Math.max(maxY, p.y + p.height / 2);
    }
    const pad = 14;
    const header = 30;
    namespaceBounds.set(`ns-${ns.id}`, {
      x: minX - pad,
      y: minY - pad - header,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2 + header,
    });
  }
  return { positions, namespaceBounds, routes };
}

export { PORTS };
