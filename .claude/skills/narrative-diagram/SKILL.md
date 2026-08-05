---
name: narrative-diagram
description: Use when producing a light-themed, narrative HTML doc that mixes prose with Mermaid flowcharts/classDiagrams — header + card sections + legend chips + notes, with per-entity ERD coloring done as a post-render JS pass (not mermaid classDef). Pick this over mermaid-architecture's dark single-diagram style when the ask is "explain this system" rather than "diagram this system."
---

# Narrative diagram doc — house style

A single self-contained HTML file that reads like a short doc: a header, then a stack of
card-style `<section>`s, each pairing a short paragraph with one embedded Mermaid diagram, ending
in a plain-language "Notes" list. Light theme, GitHub-readme energy — distinct from the
[`mermaid-architecture`](../mermaid-architecture/SKILL.md) skill's dark single-diagram style. Share
its non-negotiable diagram doctrine (ELK layout, orthogonal edges, `classDiagram` not `erDiagram`) —
with one deliberate divergence: decision nodes stay `{ }` diamonds but are flattened to short-and-wide
after render (rule 11), never left at the default tall aspect. This skill also adds the document chrome
and a different, substring-driven coloring technique for ERD-style class diagrams.

Use this when the ask is a "walk me through X" artifact — a schema delta, a pipeline explainer, a
before/after comparison — not a pure reference diagram.

## Rules

1. **Light theme.** `--bg: #f6f7f9`, `--panel: #ffffff`, `--line: #e2e5e9`, `--ink: #1f2328`,
   `--dim: #6a737d`, `--accent:` one deliberate brand hue (e.g. `#2e7d32`). `mermaid.initialize({ theme: 'default', ... })`.
2. **Header, then cards.** `<header>` = title (`h1`) + one-line legend/summary (`.sub`, dim color,
   inline `<code>` and colored `<span class="tag-*">` for the 2-3 things a reader must decode before
   the diagrams make sense). Each `<section>` = white card (`border-radius: 6px`, subtle
   `box-shadow`), `h2` in the accent color, `p.lede` in dim gray, then one `.mermaid` block.
3. **ELK + orthogonal, same as `mermaid-architecture`.** `layout: 'elk'`, `elk.edgeRouting: 'ORTHOGONAL'`, mermaid v11+ ESM, ELK plugin from CDN. Never dagre defaults. Decision diamonds are allowed but must be compressed short-and-wide (rule 11), never left at their default tall aspect.
4. **classDiagram for ERDs, grouped by `namespace`.** Use mermaid `namespace Name { class Foo {...} }` to cluster related tables into a labeled box — this is what makes multi-concern schemas (planning vs. execution vs. runtime) legible. Stereotype each class with its real table name: `<<snake_case_table_name>>` as the first line inside the class body.
5. **Legend chip strip, not inline color key.** A `.legend` flex row of `.chip.l-*` pills — background/border/color triplet per category — placed right above the diagram it describes, inside the section (not globally at the top of the doc, unless every diagram shares one legend).
6. **ERD entity coloring is a post-render JS pass keyed on text substring — never mermaid `classDef`/`cssClass` for this.** `classDef` + `class X,Y cat` works for flowchart nodes (see rule 7) but is unwieldy once entities are grouped in `namespace` blocks with per-table stereotypes — you'd need a `class` line per table, which drifts out of sync as tables are added. Instead: keep the `classDiagram` source clean (no `:::` tags), then after `mermaid.run()` walk `svg g.node`, read `g.textContent`, and match against an ordered array of `[substringToken, fill, stroke, ink]` tuples — first match wins, paint `rect|path|polygon` fill/stroke and `text|foreignObject *` color directly via inline `style`. See `paint()` / `colorizeDelta()` in the template.
7. **Flowchart nodes still use mermaid-native `classDef` + `:::tag`.** Rule 6's substring trick is only for classDiagram/ERD entities (where per-node `:::` tagging doesn't compose with `namespace`). Ordinary flowchart nodes keep the standard `classDef cat fill:#..,stroke:#..,color:#..` + `:::cat` suffix — cheaper and it's what elk/mermaid already support natively.
8. **Notes section closes every doc.** A plain `<ul class="notes">` translating the diagram into 3-6 sentences a non-diagram-reader can skim — call out what's new vs. existing (`<span class="tag-new">`), what's deliberately omitted, and any caveat that isn't visible in the picture (e.g. "column X is still `NOT NULL` in prod; this ERD shows the target state").
9. **One mermaid init for the whole doc**, shared across every `.mermaid` block regardless of section — don't re-initialize per section.
10. **Render + colorize timing matches `mermaid-architecture`:** tag `data-kind` (`class` vs `flowchart`) on each `.mermaid` div from its source text before `mermaid.run()` wipes it; call the colorizer once synchronously after `mermaid.run()` resolves, then again at `setTimeout(…, 400)` and `setTimeout(…, 1200)` since ELK layout is async and a `MutationObserver`-only pass fires too early.
11. **Decisions are compressed diamonds — short and wide, by default.** Keep the `{ }` rhombus for decision nodes (`X{"Target under app/frontend/ ?"}`), but never ship one at its default aspect: under ELK the rhombus renders tall and near-square, eats vertical room, and forces the whole column wider just to fit its label. After render, flatten **every** decision diamond to short-and-wide with the dedicated `squashDiamonds()` pass (below). This is the norm for this skill, not an opt-in — a full-height diamond is the bug, the compressed one is correct output. Keep the reshape **out of the colorizer**: reshaping is geometry, coloring is fill/stroke, and they have different scopes — `squashDiamonds()` must run on every `.mermaid` diagram (flowchart decisions render as `g.node polygon`), whereas the colorizer only touches `data-kind="class"` blocks. Call `squashDiamonds()` at the same async cadence as the colorizer (`0` / `400ms` / `1200ms`) since ELK settles late. The squash is **line-aware**: a single-line label needs almost no vertical room, so it flattens ~33% harder (`syFlat ≈ 0.37`) than a wrapped multi-line label (`syTall ≈ 0.55`) — the pass reads each node's label box to decide. Put the branch answers on the outbound edge labels (`X -->|frontend| Y`, `X -->|backend| Z`).
12. **Diamond edges are re-routed by `orthogonalizeEdges()` — mandatory alongside the squash.** ELK routes edges to the *pre-squash* rhombus border, so a squashed diamond is left with diagonal stubs floating off its vertices. The pass (in the template) snaps any edge endpoint inside a squashed diamond's recorded pre-squash footprint (`poly.dataset.geom`, written by `squashDiamonds()`) onto the diamond's actual vertex, then rebuilds the whole edge as a two-bend route through a bus line at a fixed 36px offset from the vertex. All edges sharing a vertex share the offset, so they overlap into one visual trunk + bus — the grouped-arrow look; the overlap is intended. Ingress endpoints back off the vertex 4px so the arrowhead tip meets the outline instead of flaring over the fill. It also re-centers each edge label on the rebuilt route's final segment — mermaid placed the label at the *original* path's midpoint, so without this the labels float in empty space. Unsnapped edges still get a cleanup: ELK's chamfered corners are collapsed and residual diagonals become L-bends. Run it after `squashDiamonds()` at the same `0 / 400 / 1200ms` cadence.
13. **Fan-in/fan-out edge groups get one hue via `colorizeEdgeGroups()`.** Edges sharing a common ingress or egress point (25px cluster tolerance) are tinted as a group — stroke, arrowhead, and label background all take the same color, so a label reads as belonging to its line. Arrow markers are shared defs: clone per color (the template does) or every arrow in the svg recolors together. Palette is ordered for hue separation between consecutive groups; larger clusters claim edges first. Runs last in the pass chain (it reads final path geometry).
14. **Uniform stroke weight via page CSS, not per-element styles.** One `!important` block sets `stroke-width: 1.8px` on all edge paths and all node shapes (`rect/polygon/path/circle`) — it must beat mermaid's generated styles and any inline styles the passes set. Mixed line weights read as unintended emphasis.
15. **Rich labels: `<code>` chips, `<b>`, explicit `<br>`, `•` bullets.** Requires `securityLevel: 'loose'` in the init (default sanitization strips the markup) plus the `.nodeLabel code` CSS chip styles. Never rely on auto-wrap for multi-part labels — choose break points with explicit `<br>` or you get dangling orphans. Bullet lines are literal `•`-prefixed lines separated by `<br>`; a real `<ul>` fights the centered label layout.

## Color palette (this doc's defaults — swap hues per project, keep the *structure*)

Chips / legend (light pastel, readable on white):

| Chip | Background | Border | Ink |
|---|---|---|---|
| new / added | `#e8f5e9` | `#2e7d32` | `#1b5e20` |
| planning / upstream (dashed) | `#e8eaf6` | `#3949ab` | `#1a237e` |
| batch / core entity | `#e3f2fd` | `#1565c0` | `#0d3b66` |
| work-unit tier | `#e0f2f1` | `#00897b` | `#004d40` |
| dependency / edge | `#fff3e0` | `#ef6c00` | `#e65100` |
| runtime actor | `#ede7f6` | `#5e35b1` | `#311b92` |
| session | `#e0f7fa` | `#00838f` | `#006064` |
| phase | `#fce4ec` | `#ad1457` | `#880e4f` |
| command / leaf | `#f9fbe7` | `#9e9d24` | `#616a12` |
| polymorphic / hand-off (no fill) | `#ffffff` | `#90a4ae` | `#546e7a` |

Flowchart `classDef` categories (same idea, mapped to process roles): `pl`/`plev` (planning, dashed
indigo), `svc` (service, blue), `data` (data object, purple), `event` (stadium pill, amber),
`ledger` (append-only store, green), `op` (operator/manual action, orange).

## Mandatory mermaid init

```js
mermaid.registerLayoutLoaders(elkLayouts)
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', // keeps <code>/<b>/<br> in labels (rule 15) theme: 'default',
  layout: 'elk',
  themeVariables: {
    background: '#ffffff', primaryColor: '#eef2f6',
    primaryTextColor: '#1f2328', primaryBorderColor: '#90a4ae', lineColor: '#546e7a',
    fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px'
  },
  flowchart: { curve: 'linear', htmlLabels: true, defaultRenderer: 'elk' },
  elk: {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': 55,
    'elk.spacing.nodeNode': 42,
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.mergeEdges': true,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN'
  }
})
```

## The substring-coloring technique (rule 6, worked example)

```js
const PLANNING = ['medusa_planning_batches', 'medusa_planning_sources', /* ...table stereotypes */]
const PLAN_FILL = '#e6e6f5', PLAN_STROKE = '#6c71c4', PLAN_INK = '#3a3f6b'
const TABLES = [
  // [stereotypeSubstring, fill, stroke, ink]
  ['medusa_batches', '#d6e9f7', '#268bd2', '#0d3b66'],
  ['medusa_events',  '#e7f2c9', '#859900', '#4d5c00'], // new — flagged distinctly
]

const paint = (g, fill, stroke, ink, dashed) => {
  g.querySelectorAll('rect, path, polygon').forEach(s => {
    s.style.fill = fill; s.style.stroke = stroke; s.style.strokeWidth = '1.6px'
    if (dashed) s.style.strokeDasharray = '5 3'
  })
  g.querySelectorAll('text, foreignObject span, foreignObject p, foreignObject div').forEach(el => {
    el.style.fill = ink; el.style.color = ink
  })
}

const colorizeDelta = () => {
  document.querySelectorAll('.mermaid[data-kind="class"] svg g.node').forEach(g => {
    const txt = g.textContent || ''
    if (PLANNING.some(tag => txt.includes(tag))) { paint(g, PLAN_FILL, PLAN_STROKE, PLAN_INK, true); return }
    const hit = TABLES.find(([tag]) => txt.includes(tag))
    if (hit) paint(g, hit[1], hit[2], hit[3], false)
  })
}
```

Why substring-on-textContent and not a mermaid `class` assignment: the stereotype (`<<table_name>>`)
is already unique, rendered text inside the node — matching it post-render means adding a new table
to a `namespace` block never requires touching the JS; it just needs to contain a substring already
in the `TABLES` array (or a new tuple, one line).

## The diamond-compression pass (rule 11, worked example)

A dedicated post-render pass — separate from the colorizer — that rewrites each decision diamond's
`points` to a short-and-wide aspect around its own centroid. Runs on every diagram (not just class
diagrams), is idempotent via a `data-squashed` guard, and fires at the same `0 / 400 / 1200ms` cadence
as the colorizer because ELK layout settles asynchronously.

```js
// Diamonds render tall+near-square under ELK; flatten every decision node to short+wide.
// Geometry, not color — so it lives outside colorizeDelta() and runs across all .mermaid blocks.
// Line-aware: a single-line label needs almost no vertical room, so it squashes ~33% harder
// (syFlat) than a wrapped multi-line one (syTall). Measure the label's own box to pick which.
const squashDiamonds = (sx = 1.45, syTall = 0.55, syFlat = 0.37, oneLinePx = 26) => {
  document.querySelectorAll('.mermaid svg g.node').forEach(node => {
    const poly = node.querySelector('polygon')
    if (!poly || poly.dataset.squashed) return   // idempotent: the pass fires 3x
    const pts = poly.points
    if (!pts || pts.numberOfItems !== 4) return   // a decision rhombus has exactly 4 points (excludes hexagons)
    let cx = 0, cy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let i = 0; i < 4; i++) {
      const p = pts.getItem(i)
      cx += p.x; cy += p.y
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
    cx /= 4; cy /= 4
    // rhombus gate: a diamond has 2 vertices on the vertical axis (x≈cx) + 2 on the horizontal (y≈cy).
    // rejects 4-point trapezoids/parallelograms (I/O shapes) so they aren't distorted by this pass.
    const tolX = (maxX - minX) * 0.05, tolY = (maxY - minY) * 0.05
    let onV = 0, onH = 0
    for (let i = 0; i < 4; i++) {
      const p = pts.getItem(i)
      if (Math.abs(p.x - cx) <= tolX) onV++
      if (Math.abs(p.y - cy) <= tolY) onH++
    }
    if (onV < 2 || onH < 2) return
    // record the pre-squash footprint for orthogonalizeEdges() (rule 12)
    poly.dataset.geom = JSON.stringify({ minX, maxX, minY, maxY })
    const fo = node.querySelector('foreignObject') // htmlLabels:true → label lives in a foreignObject
    const txt = node.querySelector('text')
    let labelH = fo ? (fo.height?.baseVal?.value || 0) : 0
    if (!labelH && txt) { try { labelH = txt.getBBox().height } catch (e) {} }
    const sy = (labelH && labelH <= oneLinePx) ? syFlat : syTall  // oneLinePx tuned to the 12px theme font
    for (let i = 0; i < 4; i++) {
      const p = pts.getItem(i)
      p.x = cx + (p.x - cx) * sx                  // widen
      p.y = cy + (p.y - cy) * sy                  // shorten
    }
    poly.dataset.squashed = '1'
  })
}
```

Wire it next to the colorizer in `renderAll()` — same cadence, separate call:

```js
// Sequential per-block render: mermaid ids derive from Date.now(), and two diagrams
// rendered in the same millisecond collide — the second one's ELK layout then writes
// into the first svg. Never mermaid.run({ querySelector: '.mermaid' }) on multi-diagram docs.
for (const el of document.querySelectorAll('.mermaid')) {
  try { await mermaid.run({ nodes: [el] }) } catch (e) { console.error(e) }
  await new Promise(r => setTimeout(r, 10))
}
const passes = () => { colorizeDelta(); squashDiamonds(); orthogonalizeEdges(); colorizeEdgeGroups() }
passes()
setTimeout(passes, 400)
setTimeout(passes, 1200)
```

Why rewrite `points` and not a CSS `transform: scaleY(...)`: a CSS transform on the `<polygon>` alone
leaves the label `<text>`/`<foreignObject>` sibling un-scaled and off-center, and transform-origin on
SVG children is fiddly. Rewriting points around the centroid keeps the label centered for free. Caveat
worth a Notes line only if it shows: edges are routed against the pre-squash node border, so a
vertically-flattened diamond can leave a hairline gap at its top/bottom vertex — tune `sy` up toward
`0.6` if it's visible; the default rarely shows under orthogonal routing. Second known limit: ELK sized
inter-node spacing for the *un*-widened diamond, so `sx` widening can overlap a **horizontal** neighbor
in dense layouts — decision nodes usually branch downward (vertical neighbors), so it rarely bites, but
lower `sx` toward `1.2` if a side-by-side collision appears. The `oneLinePx` threshold assumes the
skill's mandatory 12px theme font; scale it if you change `fontSize`.

## Templates

- `references/template.html` — full self-contained starter: header, two example sections (a flowchart pipeline with a `{ }` decision diamond + a namespaced classDiagram ERD), legend chips, notes list, mermaid init, the substring colorizer, and the full post-render pass chain — `squashDiamonds()`, `orthogonalizeEdges()` (diamond vertex snap + bus rebuild + label re-centering, rule 12), and `colorizeEdgeGroups()` (rule 13) — wired into `renderAll()` at all three timings. The `MutationObserver` runs only the idempotent passes (not `colorizeEdgeGroups()`, whose marker clones would re-fire it).

## Common pitfalls (don't repeat)

- **Trying to color classDiagram entities with `class Foo,Bar catName` lines.** Works until tables
  are grouped in `namespace` blocks with per-class stereotypes — then it's one more line to
  maintain per table, and it silently desyncs. Use the substring pass (rule 6) instead.
- **Putting the legend at the top of the whole doc when sections use different categories.** Scope
  each `.legend` to the section it describes, right above that section's `.mermaid` block.
- **Skipping `data-kind` tagging.** The substring colorizer only runs against
  `.mermaid[data-kind="class"]` — if a `classDiagram` block isn't tagged before `mermaid.run()`
  wipes `textContent`, the colorizer silently no-ops on it.
- **One colorize call.** ELK's layout is async; call the colorizer at `0`, `400ms`, and `1200ms` like
  `mermaid-architecture` does, or late-settling nodes stay uncolored.
- **Reusing the dark `mermaid-architecture` palette here.** This is a light-doc skill — pastel
  chip fills on white, not the neon-on-`#1a1a1a` palette. Don't mix the two token sets in one file.
- **Shipping a decision diamond at its default aspect.** ELK renders `{ }` tall and near-square; every
  decision node must go through `squashDiamonds()` (rule 11). A full-height diamond in the output means
  the pass didn't run or wasn't wired at all three timings.
- **Folding the diamond squash into the colorizer.** Different scope (all diagrams vs. `data-kind="class"`) and different concern (geometry vs. color). Keep `squashDiamonds()` a separate function called alongside `colorizeDelta()`, not inside it.
- **Rendering all diagrams with one `mermaid.run({ querySelector })` call.** Mermaid derives svg ids from `Date.now()`; two diagrams rendered in the same millisecond collide and the second one's async ELK layout writes into the first svg. Render sequentially per block with `mermaid.run({ nodes: [el] })` plus a 10ms tick between blocks.
- **Leaving diamond edges where ELK put them.** After the squash, edges still target the pre-squash rhombus border: diagonal stubs float off the vertices and fan-outs stair-step through per-edge channels. `orthogonalizeEdges()` (rule 12) is as mandatory as the squash itself.
- **Repositioning edge labels with a fixed back-off from the arrowhead.** Edges converging on one target share the endpoint, so equal back-offs stack the labels on top of each other. Use the final-segment midpoint — differing segment lengths separate them for free.
- **Recoloring an edge's arrowhead by styling the shared marker def.** Every arrow in the svg changes hue together. Clone the marker per color and repoint `marker-end` (see `colorizeEdgeGroups()`).
- **Adjacent similar hues in the group palette.** Green next to teal, or indigo next to purple, read as the same line at thin stroke widths. Order the palette for maximum hue separation between consecutive groups.
- **Relying on label auto-wrap.** Long labels wrap at arbitrary points, leaving dangling bullets or orphaned words. Choose the break points with explicit `<br>` (rule 15).
- **`flowchart LR` with a nested `direction TB` subgraph.** Fragile under the ELK renderer — layout can collapse or ignore the nested direction. Prefer a single top-level direction; restructure rather than nest opposing directions.
