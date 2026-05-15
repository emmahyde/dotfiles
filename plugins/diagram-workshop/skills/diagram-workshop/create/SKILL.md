---
name: diagram-workshop-create
description: Use when building interactive or animated diagrams in the browser — force-directed graphs, hierarchies, Sankey flows, timelines, scatter plots, or any visualization needing data binding, drag/zoom, or real-time aesthetic iteration. Triggers when D2/Mermaid output is too static, when the user wants to iterate on visual appearance, or when the diagram needs custom interactivity.
---

# Diagram Workshop — Create

**Before touching code:** choose an aesthetic direction from the table below and set all CSS `:root` tokens. Do not leave the placeholder values from the starter templates.

Interactive, iterative diagram creation in the browser. Start minimal, commit to an aesthetic, render, iterate.

## Library Selection

| Need | Library |
|------|---------|
| Data-driven: scales, axes, force layouts, trees, hierarchies | D3 v7 |
| Better auto-layout for hierarchical / layered graphs alongside D3 | D3 + elkjs |
| Programmatic SVG: shapes, paths, animation, morphing | SVG.js 3.x |
| Static or lightly animated, zero dependency | Raw SVG + CSS |
| Interactive diagram *editor* (users drag nodes, wire edges, build flows) | xyflow via `web-artifacts-builder` |
| Complex UI controls, TypeScript, shadcn/ui components, or React state | React + D3 via `web-artifacts-builder` |

D3, D3+elkjs, SVG.js, and raw SVG all work via CDN — no build step. When the diagram needs React (xyflow, shadcn/ui, complex state), escalate to `document-skills:web-artifacts-builder`.

**D3 vs xyflow:** D3 renders diagrams *from* data (Claude generates the diagram). xyflow builds diagram *editors* where the user drags and wires nodes themselves. Use xyflow only when the interactive editor UI is the product, not just a way to view data.

## Starter Templates

Templates live in `../templates/`. Read the appropriate one before starting, then adapt the data structures to the actual content.

| Template | When to use | Layout | File |
|----------|-------------|--------|------|
| **ERD** | Database schemas, data models | Group-based grid layout — define subgraph groups, compute positions from group membership; D3 renders | `../templates/erd-starter.html` |
| **Flowchart** | Pipelines, processes, decision flows | ELK auto-layout with orthogonal routing | `../templates/flowchart-starter.html` |
| **D3 general** | Charts, trees, force graphs | Varies by D3 layout | Inline below |
| **SVG.js** | Programmatic SVG, animation | Manual | Inline below |
| **Raw SVG** | Static, zero-dependency | Manual | Inline below |

**ERD vs Flowchart:** ERDs need column-level FK lines between specific rows of table boxes with crow's foot cardinality notation. Auto-layout engines don't understand this, so tables are positioned via subgraph groups (clusters of related tables stacked vertically), and FK edges are routed manually with orthogonal paths. Flowcharts have simple box-and-arrow topology that ELK handles well.

### D3 (general purpose)

```html
<!DOCTYPE html>
<meta charset="utf-8">
<style>
  /* ← Replace tokens with your chosen aesthetic direction */
  :root { --bg:#0f0f0f; --surface:#1a1a1a; --accent:#e63946; --muted:#6b7280; --text:#f0f0f0; }
  body { margin:0; background:var(--bg); color:var(--text); font:13px/1.5 'JetBrains Mono',monospace; }
  svg { display:block; }
</style>
<script type="module">
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
const W = 800, H = 560;
const svg = d3.select("body").append("svg").attr("viewBox",`0 0 ${W} ${H}`).attr("width",W).attr("height",H);
// diagram here
</script>
```

### SVG.js

```html
<!DOCTYPE html>
<meta charset="utf-8">
<style>
  :root { --bg:#0f0f0f; --accent:#e63946; --muted:#6b7280; --text:#f0f0f0; }
  body { margin:0; background:var(--bg); }
</style>
<div id="c"></div>
<script src="https://cdn.jsdelivr.net/npm/@svgdotjs/svg.js@3/dist/svg.min.js"></script>
<script>
const draw = SVG('#c').size(800, 560);
// diagram here
</script>
```

### Raw SVG + CSS

```html
<!DOCTYPE html>
<meta charset="utf-8">
<style>
  :root { --bg:#0f0f0f; --accent:#e63946; --edge:rgba(255,255,255,.12); --text:#f0f0f0; }
  body { margin:0; background:var(--bg); }
  .node { transition:transform .2s; }
  .node:hover { transform:scale(1.08); }
</style>
<svg viewBox="0 0 800 560" width="800" height="560">
  <!-- diagram here -->
</svg>
```

## Structural vs Exploratory Diagrams

Before choosing a library, decide the diagram's **purpose**:

| Purpose | Layout approach | Tool |
|---------|----------------|------|
| **Architecture / flowchart** — fixed structure, clean edges | Auto-layout with orthogonal edge routing (ELK) | D3 + elkjs |
| **ERD** — column-level FK connections, cardinality notation | Group-based grid layout with manual orthogonal routing | D3 (no ELK) |
| **Exploratory / network** — user drags, discovers clusters | Force simulation | D3 force |
| **Data visualization** — charts, scales, axes | Standard D3 layouts | D3 |

**Architecture/flowchart:** use ELK, not force layout. ELK computes deterministic layered positions with edge routing that avoids nodes.

**ERD:** ELK doesn't understand column-level FK connections — it treats tables as generic boxes. Use subgraph groups to position tables in a vertical grid, then manually route orthogonal FK edges between specific rows with crow's foot cardinality notation. See `d3-patterns.md → ERD Patterns`.

## Workshopping Workflow

1. **Clarify intent** — ask what the diagram communicates and for whom
2. **Structural or exploratory?** — architecture/ERD/flowchart → ELK; network exploration → force; data viz → standard D3
3. **Commit to an aesthetic direction** — pick an extreme from the direction table below and execute with intention; do not default to the starter template's placeholder values
4. **Render skeleton first** — get shapes and layout right before adding data or labels
5. **Iterate in-place** — edit and re-render the same template; do not restart from scratch
6. **Lock design tokens early** — set all CSS `:root` variables before writing any diagram code
7. **Launch on completion** — after writing the diagram file, run the server from its directory and open it in the browser (see below). Do this every time without waiting to be asked.

## Aesthetic Direction

**Choose an extreme and commit. Generic is worse than wrong.**

| Direction | Character | Signals |
|---|---|---|
| Industrial / technical | Monospace, dark, high-contrast edges | `#0f0f0f` bg, `#e63946` accent, JetBrains Mono |
| Editorial / data journalism | Serif + sans pairing, cream/charcoal, structured whitespace | Light bg, Georgia or Playfair display, measured grid |
| Brutalist / raw | No-nonsense, border-heavy, system fonts *intentionally* | `#ffffff` bg, pure `#000` borders, Courier New |
| Soft / organic | Muted pastels, rounded nodes, gentle motion | `#f5f0eb` bg, `#c9b8a8` edges, Lora or DM Serif |
| Retro-terminal | Phosphor green on black, scanline texture, blink cursor | `#0d0d0d` bg, `#39ff14` accent, VT323 or Courier |

**Execution rules (from frontend-design):**
- Use CSS variables for every color, size, and timing value — they're your only design tokens
- Pair a distinctive display font with a refined body font; avoid Inter/Roboto/Arial
- One high-impact enter animation beats scattered micro-interactions
- Atmosphere over solid color: noise texture, subtle grid, gradient mesh, or grain overlay

Observable gallery as a reference point: https://observablehq.com/@d3/gallery

## Launch on Completion

After writing every diagram, run this from the diagram's directory (background, non-blocking):

```bash
python ~/.claude/skills/diagram-workshop/assets/serve.py <filename>.html &
```

This starts the server, opens the browser to the diagram, and makes `/annotate.js` available. The diagram HTML must include the annotation overlay tag to enable markup:

```html
<script src="/annotate.js"></script>
```

**Tools:** Browse (↔) · Pen (p) · Rect (r) · Circle (c) · Arrow (a) · Text note (t) · Erase (e)

**Export (📷):** Composites SVG + annotations into a PNG. User shares the PNG → use `/diagram-workshop:review` to interpret the markup and implement changes.

On iteration, the server is already running — just write the updated file and the user refreshes the browser.

## Library Pattern References

For layouts, scales, drag, zoom, transitions, and live controls:
→ Read `../references/d3-patterns.md` when using D3

For shapes, paths, animation, groups, and interaction:
→ Read `../references/svgjs-patterns.md` when using SVG.js

For SVG-vs-Canvas thresholds, color guidance by diagram type, accessibility fallbacks, animation rules, and touch targets:
→ Read `../references/ux-guidelines.md` before delivering any diagram
