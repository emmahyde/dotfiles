# UX Guidelines for Diagram Work

Sourced from ui-ux-pro-max. Only the rules that apply specifically to interactive diagrams.

## SVG vs Canvas Thresholds

Match renderer to data volume to avoid jank:

| Diagram type | ≤100 nodes / ≤50 flows | 101–500 / 50–200 | >500 / >200 |
|---|---|---|---|
| Network graph | SVG | Canvas | Must cluster/LOD first |
| Sankey / flow | SVG | Canvas | Aggregate minor flows into "Other" |
| Process map | SVG | Canvas | Pre-filter to top 80% of variants |

For Canvas in D3: replace `svg.append(...)` with an `<canvas>` element and use `d3-force` tick callbacks to draw with `ctx.beginPath()`.

## Color Guidance by Diagram Type

**Network graph:**
- Node types → categorical colors (`d3.schemeTableau10`)
- Edges → `#90A4AE` at 60% opacity (`rgba(144, 164, 174, 0.6)`)
- Highlighted path → `#F59E0B`

**Sankey / flow:**
- Gradient from source node color to target node color on the flow band
- Flow opacity `0.4–0.6`; node labels always fully opaque

**Process map:**
- Happy path → `#10B981` thick stroke
- Deviations → `#F59E0B` thin stroke
- Bottleneck nodes → `#EF4444` fill

**General rule:** Data lines/bars vs background ≥3:1 contrast; data text labels ≥4.5:1.

## Accessibility

Network graphs are inherently grade-D accessible. Never use one as the sole representation.

**Always provide a text alternative:**
- Network → adjacency list table (Node A → Node B → Weight)
- Sankey → flow table (Source → Target → Value)
- Tree → nested list or indented outline
- Timeline → sorted data table

```html
<!-- Example: visually hidden table alongside the SVG -->
<svg aria-hidden="true">...</svg>
<table class="sr-only" aria-label="Graph adjacency list">
  <thead><tr><th>From</th><th>To</th><th>Weight</th></tr></thead>
  <tbody>...</tbody>
</table>
```

**Don't convey meaning by color alone** — add stroke patterns, shape variation, or direct labels for colorblind users.

**Interactive element requirements:**
- Clickable nodes/edges: `aria-label` on each; or describe the graph with a single `aria-label` on the `<svg>`
- Touch targets: ≥44×44px (expand hit area with a transparent overlay if the visual element is smaller)
- Hover tooltips: also keyboard-accessible via `:focus`

## Animation

- **Duration:** 150–300ms for micro-interactions; enter transitions max 400ms
- **Easing:** `ease-out` for entering, `ease-in` for exiting; avoid `linear`
- **Reduced motion:** wrap all enter/update transitions in a media query check

```js
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const duration = prefersReduced ? 0 : 300;

circles.transition().duration(duration).attr("r", d => d.r);
```

- **Loading:** show skeleton or spinner after >300ms; never freeze with no feedback
- **No idle loops:** continuous animation only for loading spinners, not decorative elements

## Interactive Controls

- Hover states: `cursor: pointer` + subtle color change on interactive nodes/edges
- Drag: provide visual feedback during drag (opacity drop, shadow lift)
- Parameter sliders (force strength, distance): keep range inputs accessible with `<label>`
- Tooltips: show on hover AND on focus (keyboard users)

## Tooltips

**Use `clientX/clientY`, not `pageX/pageY`**, when the tooltip is `position: fixed`. `pageX` includes scroll offset, so the tooltip drifts away from the cursor on scrollable pages.

```js
const tip = document.getElementById("tip"); // position: fixed
function moveTip(e) {
  tip.style.left = (e.clientX + 14) + "px";
  tip.style.top = (e.clientY + 14) + "px";
}
```

## Edge Labels

Edge labels on diagrams must follow these rules:

1. **Color matches the edge.** A gray label on a teal edge is ambiguous when edges cross. Derive the label color from the edge color, with boosted opacity for readability.
2. **Orientation matches the segment.** Labels on horizontal segments stay horizontal. Labels on vertical segments rotate 90°. This keeps text parallel to the line it describes.
3. **Background pill.** Place labels on a small rounded rect filled with the page background color so text is never occluded by crossing edges.
4. **Position on the longest segment.** Find the longest straight segment of the edge path and place the label at its midpoint, offset perpendicular to the line.

```js
// Derive label color from edge color (boost opacity)
const labelColor = edgeColor.replace(/,\s*[\d.]+\)/, ",0.7)");

// Detect vertical vs horizontal
const isVertical = Math.abs(dy) > Math.abs(dx);

// Rotate label group for vertical segments
if (isVertical) {
  labelGroup.setAttribute("transform",
    `translate(${lx},${ly}) rotate(-90)`);
}
```

## ERDs — Group-Based Grid Layout, Not Auto-Layout

ERDs need column-level FK connections between specific rows. Auto-layout engines (ELK, dagre) don't understand this — they treat tables as generic boxes and produce layouts where edges miss the intended row. Use a **group-based grid layout** instead:

1. Define subgraph groups (`{ id, label, bg, border, tableIds }`) that cluster related tables
2. Compute group dimensions from member table sizes
3. Stack groups vertically, arrange tables horizontally within each group
4. Route FK edges manually between specific row Y-positions with orthogonal paths

This gives a clear visual hierarchy (groups make domain boundaries visible) without requiring literal hardcoded x/y coordinates for each table. See `d3-patterns.md → ERD Patterns` for the full implementation.

ELK remains correct for flowcharts and architecture diagrams where node topology drives placement.
