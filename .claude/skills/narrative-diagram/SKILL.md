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

1. **NEVER author new diamond nodes.** Mermaid diamond routing under ELK is inherently broken: it routes to the shape center and clips at an angle, necessitating fragile post-render geometry hacks to force orthogonal stubs. Prefer styled rectangles (`[label]:::decision`) or stadium pills (`([label]):::decision`) for decisive events. Existing geometry passes (`squashDiamonds`/`snapDiamondEdges`) remain for legacy maintenance only.
2. **Light theme.** `--bg: #f6f7f9`, `--panel: #ffffff`, `--line: #e2e5e9`, `--ink: #1f2328`,
   `--dim: #6a737d`, `--accent:` one deliberate brand hue (e.g. `#2e7d32`). `mermaid.initialize({ theme: 'default', ... })`.
3. **Header, then cards.** `<header>` = title (`h1`) + one-line legend/summary (`.sub`, dim color,
   `box-shadow`), `h2` in the accent color, `p.lede` in dim gray, then one `.mermaid` block.
4. **ELK + orthogonal, same as `mermaid-architecture`.** `layout: 'elk'`, `elk.edgeRouting: 'ORTHOGONAL'`, mermaid v11+ ESM, ELK plugin from CDN. Never dagre defaults.
5. **classDiagram for ERDs, grouped by `namespace`.** Use mermaid `namespace Name { class Foo {...} }` to cluster related tables into a labeled box — this is what makes multi-concern schemas (planning vs. execution vs. runtime) legible. Stereotype each class with its real table name: `<<snake_case_table_name>>` as the first line inside the class body.
6. **Legend chip strip, not inline color key.** A `.legend` flex row of `.chip.l-*` pills — background/border/color triplet per category — placed right above the diagram it describes, inside the section (not globally at the top of the doc, unless every diagram shares one legend).
7. **ERD entity coloring is a post-render JS pass keyed on text substring — never mermaid `classDef`/`cssClass` for this.** `classDef` + `class X,Y cat` works for flowchart nodes (see rule 8) but is unwieldy once entities are grouped in `namespace` blocks with per-table stereotypes — you'd need a `class` line per table, which drifts out of sync as tables are added. Instead: keep the `classDiagram` source clean (no `:::` tags), then after `mermaid.run()` walk `svg g.node`, read `g.textContent`, and match against an ordered array of `[substringToken, fill, stroke, ink]` tuples — first match wins, paint `rect|path|polygon` fill/stroke and `text|foreignObject *` color directly via inline `style`. See `paint()` / `colorizeDelta()` in the template.
8. **Flowchart nodes still use mermaid-native `classDef` + `:::tag`.** Rule 7's substring trick is only for classDiagram/ERD entities (where per-node `:::` tagging doesn't compose with `namespace`). Ordinary flowchart nodes keep the standard `classDef cat fill:#..,stroke:#..,color:#..` + `:::cat` suffix — cheaper and it's what elk/mermaid already support natively.
9. **Notes section closes every doc.** A plain `<ul class="notes">` translating the diagram into 3-6 sentences a non-diagram-reader can skim — call out what's new vs. existing (`<span class="tag-new">`), what's deliberately omitted, and any caveat that isn't visible in the picture (e.g. "column X is still `NOT NULL` in prod; this ERD shows the target state").
10. **One mermaid init for the whole doc**, shared across every `.mermaid` block regardless of section — don't re-initialize per section.
11. **Render, then polish once per diagram.** Tag `data-kind` (`class` vs `flowchart`) on each `.mermaid` div from its source text before `mermaid.run()` wipes it. Then run the color and geometry passes through one `polish(svg)` guarded by `svg.dataset.polished`, driven off mermaid's own `data-processed` marker, at `0 / 400 / 1200ms` plus a **debounced** `MutationObserver` — ELK layout is async, so a `MutationObserver`-only pass fires too early, and an *unguarded* one re-samples every edge of every diagram on every mutation, which stalls a forty-diagram page mid-render. Also guard on `svg.querySelector('g.node')`: mermaid inserts the container before it fills it, and a one-shot pass would otherwise mark an empty diagram done forever.
12. **Two typographic registers, and never one.** The failure mode this rule exists to prevent: every node ends up a same-sized pastel rounded rectangle holding one monospace line, so a real method call, a class, a database write, and a sentence of your own narration all look identical and the reader cannot tell the map from the commentary. Fix it in the label, not with more colors. Set `securityLevel: 'loose'` (mermaid strips class-carrying spans otherwise) and compose each label from spans: `<span class='qual'>` for a dimmed namespace prefix, `<span class='sym'>` for the symbol itself in **bold mono**, `<span class='nar'>` for a sub-line of prose in **gray italic sans**. The gray is the same on every node regardless of that node's category color — that con…
13. **Shape carries the kind; color carries the subsystem; lanes carry the owner.** Three orthogonal channels, each answering a different question, so no single channel is overloaded. Shape says *what kind of thing this is* — stadium `([ ])` = an observed event, `{ }` = a branch, plain `[ ]` = a method call, `[[ ]]` = a class or object, `[( )]` = a database row, `@{ shape: notch-rect }` = model-generated or model-facing output, round `( )` + dashed unfilled = narration with no symbol. Color says *which subsystem owns it*, reusing one hex triplet per subsystem across every diagram in the doc. Subgraph lanes say *who executes this step* — group by owning class or service (orchestrator, phase, service, datastore), which also makes a round-trip between owners vi…
14. **Reserve the subgraph title band in ELK, never by growing the box afterwards.** ELK leaves no vertical room for a cluster title, so by default it renders on top of the lane's first node. Fix it in the option bag with `'elk.padding': '[top=34,left=14,bottom=14,right=14]'` — verified to work, and it makes the old `liftClusterLabels()` pass unnecessary. Do **not** grow the rect upward after render instead: that pushes the lane border into the channel ELK routed edges through, and on a 45-diagram document it was responsible for two thirds of all superimposed edge-and-border strokes (37 hugging runs with the lift, 12 without). Keep lane titles to about three words — a longer title wraps to two lines and re-collides.
15. **Edges enter a decision through one of its four points, at a right angle — and never run along a shape's border.** Two geometry passes, both non-optional (see the worked example): `snapDiamondEdges()`, because mermaid's ELK renderer clips a diamond edge against a line drawn to the node *centre* and so always produces a diagonal stub into a slanted face; and `unhugBorders()`, because a stroke flush against a node or lane border reads as one thick wrong line rather than as an edge beside a box. Two arrows meeting at one apex is the accepted cost of the first — overlap is cheaper than a diagonal. Give ELK the channel too: `elk.spacing.edgeNode`, `elk.spacing.edgeEdge` and their `layered.*BetweenLayers` counterparts, so the post-pass only cleans up what a tight layout still forces onto a border.
16. **No literal `"` inside a mermaid label when the source lives in HTML.** The browser decodes entities before mermaid parses, so `&quot;` arrives as a real quote and ends the label string early — mermaid then reports a parse error pointing at whatever follows (a `{` becomes `DIAMOND_START`). A backslash is not an escape either. Use `&lsquo;`/`&rsquo;` for quoted strings inside a label, and keep `#{...}` interpolation out of labels entirely.

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
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
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

## The edge-geometry passes (rules 11, 14 and 15 — worked example)

Three post-render passes, in this order, once per diagram: flatten the decision diamonds, enter
them through their four points, then take edges off shape borders. All three are geometry, not
color, so they run on every `.mermaid` block rather than only the class diagrams.

**Why any of this is needed — read this before "simplifying" it away.** `@mermaid-js/layout-elk`
does not route an edge to a diamond's border. In `render.ts` it *pushes the node's centre* onto the
point list and then calls `cutPathAtIntersect(..., isDiamond)`, which clips the route where the
straight run from the last bend to that centre crosses the outline. The final leg is therefore
diagonal by construction, landing part-way up whichever slanted face it happens to cross, and no
ELK option changes it — the diagonal is produced *after* layout. That is what `snapDiamondEdges()`
exists to undo.

```js
const toRoot = (el, x, y) => {
  const p = el.ownerSVGElement.createSVGPoint(); p.x = x; p.y = y
  return p.matrixTransform(el.getCTM())
}
const fromRoot = (el, x, y) => {
  const p = el.ownerSVGElement.createSVGPoint(); p.x = x; p.y = y
  return p.matrixTransform(el.getCTM().inverse())
}

// Geometry pass 1 — flatten every decision diamond to short+wide. Runs across ALL
// diagrams (a flowchart decision is the only g.node with a 4-point polygon), unlike the
// class-only colorizer. Single-line labels squash harder; multi-line stay taller.
// Records the PRE-squash box in viewport coords, because pass 2 identifies a diamond
// attachment by "endpoint sits in this box", which is the only test that survives the
// clipping mermaid already did at layout time.
const squashDiamonds = (svg, sx = 1.45, syTall = 0.55, syFlat = 0.37, oneLinePx = 26) => {
  svg.querySelectorAll('g.node polygon').forEach(poly => {
    if (poly.dataset.squashed) return
    const pts = poly.points
    if (!pts || pts.numberOfItems !== 4) return
    let cx = 0, cy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let i = 0; i < 4; i++) {
      const p = pts.getItem(i)
      cx += p.x; cy += p.y
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
    cx /= 4; cy /= 4
    // A rhombus has two points on the vertical centre line and two on the horizontal one.
    // Anything else with four points is not a decision and must not be touched.
    const tolX = (maxX - minX) * 0.05, tolY = (maxY - minY) * 0.05
    let onV = 0, onH = 0
    for (let i = 0; i < 4; i++) {
      const p = pts.getItem(i)
      if (Math.abs(p.x - cx) <= tolX) onV++
      if (Math.abs(p.y - cy) <= tolY) onH++
    }
    if (onV < 2 || onH < 2) return
    const fo = node0(poly).querySelector('foreignObject')
    const txt = node0(poly).querySelector('text')
    let labelH = fo ? (fo.height?.baseVal?.value || 0) : 0
    if (!labelH && txt) { try { labelH = txt.getBBox().height } catch (e) {} }
    const sy = (labelH && labelH <= oneLinePx) ? syFlat : syTall
    const halfW = (maxX - minX) / 2, halfH = (maxY - minY) / 2
    const c = toRoot(poly, cx, cy), e = toRoot(poly, cx + halfW, cy + halfH)
    poly.dataset.box = [c.x, c.y, Math.abs(e.x - c.x), Math.abs(e.y - c.y)].join(',')
    for (let i = 0; i < 4; i++) {
      const p = pts.getItem(i)
      p.x = cx + (p.x - cx) * sx
      p.y = cy + (p.y - cy) * sy
    }
    poly.dataset.squashed = '1'
  })
}
const node0 = poly => poly.closest('g.node') || poly.parentNode

// Point-to-segment distance, used both to simplify a sampled route and to test flatness.
const distToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

// Edges arrive as one <path>. Sampling it and re-emitting a polyline is
// representation-agnostic: it survives whatever curve mermaid's ELK renderer chose,
// which parsing the `d` string does not. Everything below works in viewport coords —
// node polygons, lane rects and edge paths each carry their own transform otherwise.
const EDGE_SEL = '.edgePaths path, path.flowchart-link, g.edgePath path'
const readEdge = (path, step = 3) => {
  let len = 0
  try { len = path.getTotalLength() } catch (e) { return null }
  if (!len) return null
  const n = Math.max(2, Math.ceil(len / step)), pts = []
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAtLength((len * i) / n)
    const r = toRoot(path, p.x, p.y)
    pts.push({ x: r.x, y: r.y })
  }
  // Collapse the straight runs the sampler just over-described, keep the corners.
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    if (distToSeg(pts[i], out[out.length - 1], pts[i + 1]) > 0.35) out.push(pts[i])
  }
  out.push(pts[pts.length - 1])
  return out
}
const writeEdge = (path, pts) => {
  const r = v => Math.round(v * 100) / 100
  path.setAttribute('d', pts.map((p, i) => {
    const q = fromRoot(path, p.x, p.y)
    return `${i ? 'L' : 'M'}${r(q.x)},${r(q.y)}`
  }).join(''))
}

// Geometry pass 2 — enter a decision through one of its four points, at a right angle.
// mermaid's ELK renderer pushes the diamond's CENTRE onto the route and then clips the
// result against the outline (layout-elk render.ts, cutPathAtIntersect with isDiamond),
// so the last leg is a straight run from the final bend to the centre, cut part-way up
// whichever slanted face it happens to cross. No ELK option changes that: the diagonal
// is produced after layout. So discard that leg and rebuild it — keep the route up to
// the last point outside the diamond's box, then turn once and arrive on-axis at the
// nearest apex. Two arrows meeting at one apex is the accepted cost; a diagonal stub
// into the middle of a face next to five orthogonal edges is not.
const snapDiamondEdges = (svg, slack = 8) => {
  const boxes = []
  svg.querySelectorAll('g.node polygon[data-box]').forEach(poly => {
    const [cx, cy, hw, hh] = poly.dataset.box.split(',').map(Number)
    const pts = poly.points, v = []
    for (let i = 0; i < pts.numberOfItems; i++) {
      const p = pts.getItem(i), r = toRoot(poly, p.x, p.y)
      v.push({ x: r.x, y: r.y })
    }
    boxes.push({ cx, cy, hw, hh, v })
  })
  if (!boxes.length) return
  const inBox = (b, p) => Math.abs(p.x - b.cx) <= b.hw + slack && Math.abs(p.y - b.cy) <= b.hh + slack
  // The apex on the side the route approaches from — normalised by aspect, or a
  // wide-flat diamond sends an approach from above to a side point.
  const apex = (b, from) => {
    const vertical = Math.abs(from.y - b.cy) / b.hh >= Math.abs(from.x - b.cx) / b.hw
    const key = vertical
      ? (from.y > b.cy ? p => p.y : p => -p.y)
      : (from.x > b.cx ? p => p.x : p => -p.x)
    return b.v.reduce((best, p) => (key(p) > key(best) ? p : best), b.v[0])
  }
  const snapTail = (pts, b) => {
    let k = pts.length - 1
    while (k > 0 && inBox(b, pts[k])) k--
    const from = pts[k]
    if (inBox(b, from)) return null
    const v = apex(b, from)
    const vertical = Math.abs(v.y - b.cy) > Math.abs(v.x - b.cx)
    const offAxis = vertical ? Math.abs(from.x - v.x) : Math.abs(from.y - v.y)
    const knee = vertical ? { x: v.x, y: from.y } : { x: from.x, y: v.y }
    return pts.slice(0, k + 1).concat(offAxis < 1 ? [v] : [knee, v])
  }
  new Set(svg.querySelectorAll(EDGE_SEL)).forEach(path => {
    let pts = readEdge(path)
    if (!pts || pts.length < 2) return
    let changed = false
    let b = boxes.find(x => inBox(x, pts[pts.length - 1]))
    if (b) { const r = snapTail(pts, b); if (r) { pts = r; changed = true } }
    b = boxes.find(x => inBox(x, pts[0]))
    if (b) { const r = snapTail(pts.slice().reverse(), b); if (r) { pts = r.reverse(); changed = true } }
    if (changed) writeEdge(path, pts)
  })
}

// Geometry pass 3 — take edges off shape borders. Even with a spacing channel ELK will
// route flush against a node or lane box when the layout is tight, and two superimposed
// 1.6px strokes read as one thick wrong line rather than as an edge beside a box. Offset
// the run to whichever side the rest of its own route lives on, so an edge routed inside
// a lane is not shoved out through that lane's border.
const unhugBorders = (svg, near = 3, minRun = 16, push = 8) => {
  const rects = []
  svg.querySelectorAll('g.node rect, g.cluster rect, g.subgraph rect').forEach(el => {
    const w = el.width?.baseVal?.value || 0, h = el.height?.baseVal?.value || 0
    if (!w || !h) return
    const x = el.x?.baseVal?.value || 0, y = el.y?.baseVal?.value || 0
    const a = toRoot(el, x, y), c = toRoot(el, x + w, y + h)
    rects.push({
      x0: Math.min(a.x, c.x), x1: Math.max(a.x, c.x),
      y0: Math.min(a.y, c.y), y1: Math.max(a.y, c.y),
    })
  })
  if (!rects.length) return
  new Set(svg.querySelectorAll(EDGE_SEL)).forEach(path => {
    let pts = readEdge(path)
    if (!pts || pts.length < 3) return
    let changed = false
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y)
      // ELK's "orthogonal" runs drift by a pixel or so over a long span, so flatness is a
      // question of slope, not of an exact match. A strict test misses the worst cases,
      // which are precisely the longest runs.
      const vert = dy > minRun && dx <= Math.max(1.5, dy * 0.04)
      const horz = dx > minRun && dy <= Math.max(1.5, dx * 0.04)
      if (vert === horz) continue
      const at = vert ? (a.x + b.x) / 2 : (a.y + b.y) / 2
      const s = vert ? Math.min(a.y, b.y) : Math.min(a.x, b.x)
      const e = vert ? Math.max(a.y, b.y) : Math.max(a.x, b.x)
      // Borders parallel to this run that it actually travels alongside.
      const lines = []
      for (const r of rects) {
        const span = vert ? [r.y0, r.y1] : [r.x0, r.x1]
        if (Math.min(e, span[1]) - Math.max(s, span[0]) < minRun) continue
        lines.push(vert ? r.x0 : r.y0, vert ? r.x1 : r.y1)
      }
      const touched = lines.filter(q => Math.abs(at - q) <= near)
      if (!touched.length) continue
      // Prefer the side the rest of the route lives on, and keep stepping out until the
      // run clears every parallel border — an 8px nudge can land on the next box in.
      const rest = pts.filter((_, j) => j !== i && j !== i + 1)
      const mean = rest.reduce((t, p) => t + (vert ? p.x : p.y), 0) / rest.length
      const sign = mean < touched[0] ? -1 : 1
      let away = 0
      for (const k of [1, 2, 3]) {
        for (const d of [sign * k * push, -sign * k * push]) {
          if (lines.every(q => Math.abs(at + d - q) > near + 1)) { away = d; break }
        }
        if (away) break
      }
      if (!away) continue
      // Absorbing the offset needs a perpendicular neighbour on each side. Interior runs
      // already have them; a run that starts or ends the route gets one inserted, so the
      // arrowhead stays on the node it was attached to and every segment stays on-axis.
      const shift = p => (vert ? { x: p.x + away, y: p.y } : { x: p.x, y: p.y + away })
      const head = i === 0 ? [a, vert ? { x: a.x + away, y: a.y } : { x: a.x, y: a.y + away }] : [shift(a)]
      const tail = i + 1 === pts.length - 1
        ? [vert ? { x: b.x + away, y: b.y } : { x: b.x, y: b.y + away }, b]
        : [shift(b)]
      pts = pts.slice(0, i).concat(head, tail, pts.slice(i + 2))
      i += head.length + tail.length - 2
      changed = true
    }
    if (changed) writeEdge(path, pts)
  })
}
```

Wire them through one guarded `polish(svg)`, and gate it on mermaid's own `data-processed` marker:

```js
const polish = svg => {
  // mermaid inserts a container before it fills it. A one-shot pass that fired on that
  // mutation would flag an empty diagram as done and never look at it again.
  if (svg.dataset.polished || !svg.querySelector('g.node')) return
  svg.dataset.polished = '1'
  if (svg.closest('.mermaid')?.dataset.kind === 'class') colorizeDelta(svg)
  squashDiamonds(svg)
  snapDiamondEdges(svg)
  unhugBorders(svg)
}
const tick = () => document.querySelectorAll('.mermaid[data-processed="true"] svg').forEach(polish)

try { await mermaid.run({ querySelector: '.mermaid' }) } catch (e) { console.error(e) }
tick(); setTimeout(tick, 400); setTimeout(tick, 1200)

let queued = null
new MutationObserver(() => { clearTimeout(queued); queued = setTimeout(tick, 150) })
  .observe(document.body, { childList: true, subtree: true })
```

**Once per diagram, not on every tick.** Nothing relayouts after mermaid returns, and re-sampling
every edge of every diagram on every DOM mutation is enough cost to stall a forty-diagram page
*mid-render* — which then looks like the passes are broken, because the page under the probe only
ever finished thirteen of them.

**Work in viewport space, and rewrite the whole tail.** Polygon points live in the node group's
local space and edge paths in their own, so compare them through the shared viewport or the endpoint
match silently never fires. Read each edge by *sampling* it with `getPointAtLength` and re-emit a
polyline: that survives whatever curve mermaid's ELK renderer chose, which parsing the `d` string
does not. An earlier version instead *appended* an elbow to the existing `d` — the original diagonal
stayed drawn underneath and the repair read as an S-bend.

Why rewrite `points` and not a CSS `transform: scaleY(...)`: a CSS transform on the `<polygon>` alone
leaves the label `<text>`/`<foreignObject>` sibling un-scaled and off-center, and transform-origin on
SVG children is fiddly. Rewriting points around the centroid keeps the label centered for free. Known
limit: ELK sized inter-node spacing for the *un*-widened diamond, so `sx` widening can overlap a
**horizontal** neighbor in dense layouts — decision nodes usually branch downward (vertical
neighbors), so it rarely bites, but lower `sx` toward `1.2` if a side-by-side collision appears. The
`oneLinePx` threshold assumes the skill's mandatory 12px theme font; scale it if you change `fontSize`.

### Measure it, don't eyeball it

Both defects are cheap to count in a headless page, and both were fixed against counts rather than
screenshots: for every edge endpoint inside a diamond's box, its distance to the nearest of the four
vertices and whether the final segment is axis-aligned; and for every axis-aligned run, whether it
sits within ~2.5px of a parallel node or lane border for more than ~14px. On a 45-diagram document
that moved 64 off-vertex attachments and 37 border-hugging runs to 0 and 1. Two traps in the
measurement itself: aggregate hug samples **per edge** (keying by coordinate alone merges unrelated
edges; keying per sampled sub-segment splits one long run into 3px slivers that fall under any
threshold), and wait for the rendered-SVG count to go *quiet* rather than to match the `.mermaid`
count, because a diagram whose source fails to parse never produces an SVG at all.

## Templates

- `references/template.html` — full self-contained starter: header, two example sections (a
  flowchart pipeline with a `{ }` decision diamond + a namespaced classDiagram ERD), legend chips,
  notes list, mermaid init, the substring colorizer, the `squashDiamonds()` / `snapDiamondEdges()` /
  `unhugBorders()` geometry passes wired into one guarded `polish(svg)`, and a per-section SVG export.
- `scripts/render-diagrams.mjs` — headless render, export, preview, and audit for a finished doc.
  See "Rendering and checking a doc" below; never hand-roll a Playwright driver per doc.

## Scaffolding

Use `scripts/scaffold-narrative-diagram.py` to write a document from
`references/template.html`:

```sh
python3 <skill>/scripts/scaffold-narrative-diagram.py ./system-overview.html \
  --title "System overview" --subtitle "Request path" --palette ocean \
  --section "Flow|Start with the request|flowchart|flow.mmd" \
  --section "Storage|Persist the result|classDiagram|storage.mmd" \
  --json
```

Pass each section as `TITLE|LEDE|KIND|DIAGRAM_FILE`; repeat `--section` for
each card. Use `flowchart` or `classDiagram` for `KIND`, and put multiline
Mermaid in the referenced diagram file rather than in a shell argument.
Use `--config config.json` for repeatable documents; its top-level keys are
`title`, `subtitle`, `palette`, and `sections` with the same fields.
Supported palettes are `garden`, `indigo`, `ocean`, and `amber`.

The CLI inserts generated cards before `Notes`, writes the output file, and
reports the first diagram's 1-based insertion line. `--json` emits the output
path, palette, section count, and `first_diagram_line`.
## SVG export

Every section carries an "Export SVG" button next to its `h2` (`.sec-head` flex row) so a reader
can pull one diagram out as a standalone file — for a PR body, a slide, or anywhere embedding live
Mermaid isn't an option. `exportSvg()` reads the diagram's *live, already-rendered* `<svg>` at click
time — after `colorizeDelta()`/`squashDiamonds()` have already landed their fill/stroke/`points`
changes as plain DOM attributes — so the export needs no rendering logic of its own, only packaging:

1. Clone the live `<svg>`, not the source markup — the clone must carry the inline styles the
   colorizer set and the squashed `points` the geometry pass wrote.
2. Inline computed `font-family`/`font-size`/`color`/`white-space` onto every element inside a
   `foreignObject` (`inlineForeignObjectStyles`). `htmlLabels: true` puts labels in
   `<foreignObject><div>` HTML, which carries no styling of its own outside the CSS this doc's
   `<style>` block provides — a viewer opening the exported file standalone has no stylesheet to
   fall back on, so every foreignObject label would render as unstyled black Times New Roman.
3. Set an explicit `width`/`height` from `getBBox()` (plus a small pad) rather than leaving the
   SVG's responsive `viewBox`-only sizing — most standalone SVG viewers and `<img src=...svg>`
   render a viewBox-only, unsized root at 0×0.
4. **Namespace every `id` in the file to that file (`prefixSvgIds`) — this is not optional.** Mermaid
   emits generic def IDs (`mermaid-123_flowchart-elk-pointEnd`, clip paths, gradients) that are only
   unique within one document. GitHub's inline thumbnail rasterizes each attachment in isolation and
   looks fine, but its **zoom/lightbox view renders the SVG inline in the page DOM**, alongside every
   other SVG already there — status icons, avatars, your other diagram attachments. Two SVGs sharing
   an id make `url(#id)` and `marker-end` resolve to whichever element the browser reached first, so
   the artwork clips to a foreign (often zero-area or full-canvas) path and renders as **a solid black
   slab with a few unclipped slivers**. Rewrite ids on the clone, then rewrite every `url(#…)` and
   `href="#…"` reference to match.
5. **When you rename the root `<svg>` id, rewrite the `<style>` block too.** Mermaid scopes its entire
   stylesheet under that id (`#mermaid-123 .flowchart-link { fill: none }`). Prefix the root without
   patching the CSS and every selector stops matching — edge paths lose `fill: none` and paint as
   filled black shapes, which looks exactly like the collision bug above but is self-inflicted. Replace
   longest id first so no id is a prefix of another.
6. Serialize with `XMLSerializer`, prepend an XML declaration, and return the string. The click handler
   wraps it in a `Blob` download; returning rather than downloading is what lets the headless driver
   call the identical code path.

Add a new `.export-svg` button (with a `data-export-name`) to every new section you add to a doc —
the click handler is wired generically over `document.querySelectorAll('.export-svg')`, so a
missing button is the only thing that would leave a diagram non-exportable. The `data-export-name`
doubles as the id namespace and the output filename, so keep it unique per section.

## Rendering and checking a doc — use the script, don't rewrite the driver

`scripts/render-diagrams.mjs` is the whole headless loop. Do **not** hand-write another Playwright
snippet per doc; that is how a scratch directory ends up with `shot.mjs`, `shoot.mjs`, `check.mjs`,
`check2.mjs`, and `render-pngs.mjs` all doing the same thing.

```
node <skill>/scripts/render-diagrams.mjs my-doc.html --out ./dist
```

It loads the doc, waits for every `.mermaid` block to render *and* for the `0/400/1200ms` passes to
settle, calls the page's own `window.exportSvg` for each section, writes `<name>.svg` plus a
`<name>.preview.png` per section, and writes `_all-in-one-dom.png` — every export rendered together
in a single DOM, which is the exact condition that surfaces an id collision. Flags: `--no-preview`
(skip PNGs), `--out DIR`.

It then audits and **exits non-zero** on: un-namespaced ids, ids shared between two exports, a missing
`<style>` block, a `Unsupported markdown` placeholder, an implausibly small file, or any console/parse
error during render. That last one matters most — a mermaid parse error leaves the section blank and
still writes a ~3 KB file, so byte count alone reads as success. Requires `playwright` resolvable from
your working directory; it is not vendored into the skill.

**Look at `_all-in-one-dom.png` before attaching anything.** A green exit means the structural checks
passed, not that the diagram communicates — shapes, registers, and lane titles still need your eyes.

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
- **Folding the diamond squash into the colorizer.** Different scope (all diagrams vs. `data-kind="class"`)
  and different concern (geometry vs. color). Keep `squashDiamonds()` a separate function called
  alongside `colorizeDelta()`, not inside it.
- **Leaning on color alone to distinguish node kinds.** Seven pastel rounded rectangles in seven hues
  still read as seven of the same thing. Shape and typography have to carry kind and register
  (rules 12-13); color is the third channel, not the only one.
- **Naming a `classDef` `call`, `click`, `class`, `style`, or `end`.** These are mermaid keywords and
  the parser fails on the `:::tag` with a bewildering `got 'CALLBACKNAME'` error pointing at the *next*
  line. `code`, `svc`, `op` are safe.
- **Writing `&quot;` inside a quoted mermaid label.** The HTML entity decodes before mermaid parses, so
  the label's own quoting breaks. Use mermaid's `#quot;` escape instead.
- **Exporting without inlining `fontWeight` / `fontStyle`.** The registers from rule 12 live in the page
  stylesheet, which a standalone `.svg` doesn't carry — the export must copy them onto the cloned
  `foreignObject` children or every label flattens back into one face.
- **Attaching an SVG whose def ids aren't namespaced.** It will look right in GitHub's thumbnail and
  turn into a black slab in the lightbox, because that view puts it in the page DOM next to every other
  SVG. `prefixSvgIds` in the export handles it; the render script fails the build if any id escapes.
- **Trusting a byte count as proof a diagram rendered.** A mermaid parse error still writes a ~3 KB
  well-formed SVG. Read the preview PNG, or let `render-diagrams.mjs` fail on the size/console checks.
- **Hand-writing a Playwright snippet to screenshot a doc.** Use `scripts/render-diagrams.mjs`. Each
  ad-hoc driver re-derives the same waits and re-learns the same `fullPage` font-loading timeout.
- **Calling `squashDiamonds()` without `snapDiamondEdges()`.** The squash alone detaches every edge
  that met the diamond's top or bottom vertex, leaving arrows hanging in whitespace a third of a
  node-height away. The symptom looks like a routing bug in ELK; it is not.
- **Comparing polygon points to edge endpoints without converting coordinate spaces.** Polygon points
  are local to `g.node`'s transform, edge endpoints local to the edge's own. Skip `getCTM()` and the
  endpoint match silently never fires, so the pass becomes a no-op that looks wired up.
- **Appending the repair to the existing `d` instead of rewriting the tail.** The diagonal ELK drew is
  still in the path; the elbow you add on the end reads as an S-bend on top of it. Sample the path,
  drop every point inside the diamond's box, then rebuild the last leg.
- **Parsing `d` to get the route.** mermaid's ELK renderer does not necessarily emit the curve you
  configured. Sample with `getPointAtLength` and re-emit a polyline; it is representation-agnostic.
- **Deciding the apex from the clipped endpoint rather than the approach.** The endpoint sits on a
  slanted face, so its own offsets are misleading — pick the apex from the last route point *outside*
  the box, and normalise by `halfH`/`halfW` first, or a flattened diamond snaps an approach from above
  to a side point because its horizontal offset dominates.
- **Testing flatness with an exact equality.** ELK's "orthogonal" runs drift a pixel or so over a long
  span, so `Math.abs(b.y - a.y) < 1` rejects exactly the longest border-hugging runs — the ones that
  matter most. Judge by slope against the run length instead.
- **Nudging an edge off a border by moving a terminal point.** That detaches the arrowhead from its
  node. Move the two interior points of the run, and for a run that starts or ends the route, insert
  one perpendicular point to absorb the offset so every segment stays on-axis.
- **Believing a hug count without checking how the runs were aggregated.** Keyed by coordinate alone,
  unrelated edges merge into one fictitious run; keyed per sampled sub-segment, one genuine 285px run
  splits into 3px slivers that fall under any threshold and the defect reads as fixed. Key per edge.
