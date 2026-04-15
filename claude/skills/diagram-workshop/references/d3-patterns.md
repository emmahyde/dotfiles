# D3 v7 Patterns

CDN import (no build step): `https://cdn.jsdelivr.net/npm/d3@7/+esm`

## ELK Layout (better auto-layout than d3-force)

Use elkjs when you need deterministic, clean hierarchical or layered layout. d3-force is physics-based and non-deterministic; ELK produces professional diagram-quality positioning.

### Loading elkjs

**Use the UMD bundle as a regular `<script>` tag, not an ESM import.** The `+esm` CDN suffix fails silently in some browsers.

```html
<script src="https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js"></script>
<script>
// UMD exposes ELK as a global — detect constructor form
const ElkClass = (typeof ELK === "function") ? ELK : ELK.default;
const elk = new ElkClass();
</script>
```

Do NOT use `<script type="module">` with `import ELK from '...+esm'` — it fails silently with no error, leaving the page stuck on "Computing layout..."

### ELK Graph Definition

```js
const graph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': '16',
    'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    'elk.spacing.edgeEdge': '12',
    'elk.spacing.edgeNode': '18',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.mergeEdges': 'true',
  },
  children: nodes.map(n => ({
    id: n.id, width: n.w || 140, height: n.h || 48,
    _meta: n,  // stash custom data for rendering
    layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
  })),
  edges: links.map(l => ({
    id: l.id,
    sources: [l.source],
    targets: [l.target],
  })),
};

const laid = await elk.layout(graph);
// laid.children[i].x, .y are top-left corner positions
// laid.edges[i].sections[j].startPoint, .bendPoints, .endPoint
```

### ELK Layout Options Cheat Sheet

**Algorithms:**
- `layered` — best for DAGs, dependency graphs, pipelines (Sugiyama-style)
- `mrtree` — clean rooted trees (org charts, file hierarchies)
- `stress` — force-directed but deterministic, good for general graphs
- `rectpacking` — bin-packing for grid/tile layouts

**Node placement (layered algorithm):**
- `BRANDES_KOEPF` — vertically aligns nodes within layers for clean columns. Use with `bk.fixedAlignment: BALANCED`.
- `NETWORK_SIMPLEX` — minimizes edge lengths but produces uneven vertical spacing.

**Edge routing:**
- `ORTHOGONAL` — right-angle edges that route around nodes. Required for architecture / ERD / flowchart diagrams. Do not use `POLYLINE` or `SPLINES` for structural diagrams.

**Edge merging:** Set `elk.layered.mergeEdges: true` when a node has many outgoing edges to the same layer — prevents parallel edges from stacking into a thick highway.

**Edge spacing:** Increase `elk.spacing.edgeEdge` (default 10) to `12`+ to prevent edges from overlapping each other in shared channels.

### Rendering ELK Edge Paths

ELK returns `sections` with `startPoint`, `bendPoints[]`, and `endPoint`. Convert to SVG path with rounded corners at bends:

```js
function elkSectionsToPath(sections) {
  let d = "";
  for (const sec of sections) {
    const all = [sec.startPoint, ...(sec.bendPoints || []), sec.endPoint];
    d += `M${all[0].x},${all[0].y}`;
    for (let i = 1; i < all.length; i++) {
      const prev = all[i - 1], curr = all[i];
      if (i < all.length - 1) {
        const next = all[i + 1];
        const r = 6; // corner radius
        const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
        const l1 = Math.sqrt(dx1*dx1 + dy1*dy1);
        const l2 = Math.sqrt(dx2*dx2 + dy2*dy2);
        const rr = Math.min(r, l1/2, l2/2);
        d += `L${curr.x - (dx1/l1)*rr},${curr.y - (dy1/l1)*rr}`;
        d += `Q${curr.x},${curr.y},${curr.x + (dx2/l2)*rr},${curr.y + (dy2/l2)*rr}`;
      } else {
        d += `L${curr.x},${curr.y}`;
      }
    }
  }
  return d;
}
```

### Reducing Fan-Out Problems

When one node (e.g. a hub) has 5+ outgoing edges, ELK bundles them into a thick corridor. Fix by restructuring the graph:

- **Chain instead of fan-out:** if the targets execute sequentially (like a pipeline), connect them in a chain: A→B→C→D instead of Hub→B, Hub→C, Hub→D
- **Enable `mergeEdges`:** parallel edges to the same layer share one channel
- **Increase `edgeEdge` spacing:** `12`+ prevents overlapping parallel routes

## Layouts

```js
// Force network
const sim = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(links).id(d => d.id).distance(80))
  .force("charge", d3.forceManyBody().strength(-200))
  .force("center", d3.forceCenter(W/2, H/2));

// On tick — update positions
sim.on("tick", () => {
  link.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
  node.attr("cx", d => d.x).attr("cy", d => d.y);
});

// Tree / hierarchy
const root = d3.hierarchy(data);
d3.tree().size([W - 40, H - 40])(root);
// root.descendants() → nodes; root.links() → edges

// Treemap
d3.treemap().size([W, H]).padding(2)(root);
// root.leaves() → positioned rects with x0,y0,x1,y1
```

## Scales & Axes

```js
const x = d3.scaleLinear([dataMin, dataMax], [margin.left, W - margin.right]);
const y = d3.scaleLinear([0, maxVal], [H - margin.bottom, margin.top]);

svg.append("g").attr("transform", `translate(0,${H - margin.bottom})`).call(d3.axisBottom(x));
svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));

// Categorical colors
const color = d3.scaleOrdinal(d3.schemeTableau10);
// Continuous: d3.scaleSequential([min, max], d3.interpolateTurbo)
//             d3.scaleSequential([min, max], d3.interpolateViridis)
```

## Transitions & Enter/Exit

```js
// Enter with grow animation
const circles = svg.selectAll("circle").data(nodes).join(
  enter => enter.append("circle").attr("r", 0).call(e => e.transition().duration(400).attr("r", d => d.r)),
  update => update,
  exit => exit.transition().duration(200).attr("r", 0).remove()
);

// Smooth update
circles.transition().duration(300).attr("cx", d => d.x).attr("cy", d => d.y);
```

## Drag (force graphs)

```js
const drag = d3.drag()
  .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
  .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
  .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });

node.call(drag);
```

## Zoom & Pan

```js
const zoom = d3.zoom().scaleExtent([0.1, 8]).on("zoom", e => g.attr("transform", e.transform));
svg.call(zoom);
// g is the main group inside svg that contains all elements
```

## Live Parameter Controls

```html
<div style="position:fixed;bottom:12px;left:12px;display:flex;gap:12px;font:12px monospace;color:#999">
  <label>strength <input type="range" id="str" min="-500" max="-50" value="-200" style="width:80px"></label>
  <label>distance <input type="range" id="dist" min="20" max="200" value="80" style="width:80px"></label>
</div>
<script>
  str.oninput  = e => { sim.force("charge").strength(+e.target.value); sim.alpha(0.3).restart(); };
  dist.oninput = e => { sim.force("link").distance(+e.target.value); sim.alpha(0.3).restart(); };
</script>
```

## ERD Patterns

ERDs need column-level FK connections that auto-layout engines can't handle. Use a group-based grid layout for table positioning and manual orthogonal routing for FK edges.

### Subgraph Group Layout

Define groups with member tables, compute dimensions, stack vertically:

```js
const GROUP_PAD = 16, GROUP_TITLE_H = 28, TABLE_GAP = 44, GROUP_GAP = 50;

const groups = [
  { id: "core", label: "Core", bg: "rgba(10,128,128,.05)", border: "rgba(10,128,128,.25)", tableIds: ["users"] },
  { id: "audit", label: "Logs", bg: "rgba(107,114,128,.05)", border: "rgba(107,114,128,.2)", tableIds: ["access_log", "audit_log"] },
];

// Compute group dimensions from member tables
groups.forEach(grp => {
  const gTables = grp.tableIds.map(id => tableMap[id]);
  grp.innerW = gTables.length * COL_W + (gTables.length - 1) * TABLE_GAP;
  grp.innerH = Math.max(...gTables.map(t => tableH(t)));
  grp.outerW = grp.innerW + 2 * GROUP_PAD;
  grp.outerH = grp.innerH + GROUP_PAD + GROUP_TITLE_H;
});

// Stack vertically, center on widest group
const maxGroupW = Math.max(...groups.map(g => g.outerW));
let currentY = 0;
groups.forEach(grp => {
  grp.x = (maxGroupW - grp.outerW) / 2;
  grp.y = currentY;
  currentY += grp.outerH + GROUP_GAP;
  // Position tables within group
  let tableX = grp.x + GROUP_PAD;
  grp.tableIds.forEach(id => {
    nodePos[id] = { x: tableX, y: grp.y + GROUP_TITLE_H, ... };
    tableX += COL_W + TABLE_GAP;
  });
});
```

Draw group backgrounds in a layer behind tables and edges.

### Manual Orthogonal FK Routing

Route edges between specific FK/PK row Y-positions with three-branch direction logic:

```js
const sy = srcNode.y + HEADER_H + colIdx * ROW_H + ROW_H / 2;
const ty = tgtNode.y + HEADER_H + tgtColIdx * ROW_H + ROW_H / 2;
const GAP = 30;

let sx, tx, midX, srcDir, tgtDir;
if (srcRight + GAP <= tgtLeft) {
  sx = srcRight; tx = tgtLeft; midX = (sx + tx) / 2;
  srcDir = "right"; tgtDir = "left";
} else if (srcLeft >= tgtRight + GAP) {
  sx = srcLeft; tx = tgtRight; midX = (sx + tx) / 2;
  srcDir = "left"; tgtDir = "right";
} else {
  sx = srcRight; tx = tgtRight; midX = Math.max(sx, tx) + 40;
  srcDir = "right"; tgtDir = "right";
}
```

**Collision resolution:** After computing all `fkRels`, sort by `midX` and offset any two routes within 14px by bumping the later one +18px. This prevents parallel edges from overlapping.

Shorten each path by `MARK_GAP` (18px) at each end to leave room for cardinality markers:

```js
const sxAdj = sx + (srcDir === "right" ? 1 : -1) * MARK_GAP;
const txAdj = tx + (tgtDir === "left" ? -1 : 1) * MARK_GAP;
// Build path as: M(sxAdj, sy) H(midX) V(ty) H(txAdj)
```

### Crow's Foot Cardinality Notation

Draw at each edge endpoint. Takes `(g, tableX, y, exitDir, maxCard, minCard, color)`.

- **Outer mark** (closest to table): `"many"` → three converging lines (crow's foot), `"one"` → perpendicular tick
- **Inner mark** (toward line center): `"zero"` → hollow circle, `"one"` → perpendicular tick

```js
function drawCardinality(g, tableX, y, exitDir, maxCard, minCard, color) {
  const sign = exitDir === "right" ? 1 : -1;
  const spread = 6, op = 0.65;

  if (maxCard === "many") {
    const prongsX = tableX + sign * 2, tipX = tableX + sign * 12;
    [y - spread, y, y + spread].forEach(py => {
      g.append("line").attr("x1", prongsX).attr("y1", py).attr("x2", tipX).attr("y2", y)
        .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-opacity", op);
    });
  } else {
    const tx = tableX + sign * 3;
    g.append("line").attr("x1", tx).attr("y1", y - spread).attr("x2", tx).attr("y2", y + spread)
      .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-opacity", op);
  }

  const innerX = tableX + sign * (maxCard === "many" ? 15 : 7);
  if (minCard === "zero") {
    g.append("circle").attr("cx", innerX).attr("cy", y).attr("r", 3.5)
      .attr("fill", "var(--surface)").attr("stroke", color).attr("stroke-width", 1.5);
  } else {
    g.append("line").attr("x1", innerX).attr("y1", y - spread).attr("x2", innerX).attr("y2", y + spread)
      .attr("stroke", color).attr("stroke-width", 1.5).attr("stroke-opacity", op);
  }
}
```

Cardinality at each end: PK end → `("one", "one")`. FK end → `("many", "one")` if NOT NULL, `("many", "zero")` if nullable, `("one", "one")` if FK is also PK.

### Inline Labels — White-Stroke Halo

Observable technique. Two `<text>` elements in the same `<g>`: first with thick white stroke (halo), second with colored fill. No width measurement needed, works with rotation.

```js
// White halo (behind)
lg.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "middle")
  .attr("stroke", "white").attr("stroke-width", 4).attr("stroke-linejoin", "round")
  .attr("font-size", "8.5px").attr("font-family", "var(--mono)").attr("font-weight", 600)
  .text(label);
// Colored text (on top)
lg.append("text").attr("text-anchor", "middle").attr("dominant-baseline", "middle")
  .attr("fill", color).attr("font-size", "8.5px").attr("font-family", "var(--mono)").attr("font-weight", 600)
  .text(label);
```

Prefer halo over pill `<rect>` for ERD labels — pill requires measuring `labelW` and breaks on rotated text. Pill is fine for flowchart labels where segments are always horizontal.
