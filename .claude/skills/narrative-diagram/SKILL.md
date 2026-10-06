---
name: narrative-diagram
description: Use when producing a light-themed, narrative HTML doc that mixes prose with compiled static SVG diagrams — header + card sections + legend chips + notes. Diagrams are written as DiagramIntent/v1 JSON and compiled by the standalone diagram-runtime (ELK at compile time); Mermaid is only a one-way Grammy hand-off, never the renderer in the doc. Pick this over mermaid-architecture's dark single-diagram style when the ask is "explain this system" rather than "diagram this system."
---

# Narrative diagram doc — house style

A single self-contained HTML file that reads like a short doc: a header, then a stack of
card-style `<section>`s, each pairing a short paragraph with one embedded static SVG diagram,
ending in a plain-language "Notes" list. Light theme, GitHub-readme energy — distinct from the
[`mermaid-architecture`](../mermaid-architecture/SKILL.md) skill's dark single-diagram style.

The canonical source is a compact, diagram-native semantic intent (`DiagramIntent/v1`), compiled
by the standalone runtime in `runtime/` (next to this skill). ELK owns geometry at compile time; SVGO trims the SVG; the browser never renders or
repairs anything. Mermaid survives only as a one-way editable fallback for the Grammy WYSIWYG
editor. This replaces the old browser-time pipeline (Mermaid CDN + ELK runtime + post-render
`squashDiamonds()`/`orthogonalizeEdges()`/substring coloring) — none of that exists in the
output anymore.

Use this when the ask is a "walk me through X" artifact — a schema delta, a pipeline explainer, a
before/after comparison — not a pure reference diagram.

## Rules

1. **Light theme.** `--bg: #f6f7f9`, `--panel: #ffffff`, `--line: #e2e5e9`, `--ink: #1f2328`,
   `--dim: #6a737d`, `--accent:` one deliberate brand hue (e.g. `#2e7d32`). The compiled SVG
   carries its own theme token set (`--mex-*` custom properties, class-scoped on the svg root);
   a dark variant changes only fill/stroke/text tokens — geometry, labels, ids, and path `d`
   values are identical between themes by construction. If the doc offers a dark mode, override
   the `--mex-*` tokens from the host stylesheet; never recompile per theme unless you need
   different token values than the template's dark set.
2. **Header, then cards.** `<header>` = title (`h1`) + one-line legend/summary (`.sub`, dim color,
   inline `<code>` and colored `<span class="tag-*">` for the 2-3 things a reader must decode before
   the diagrams make sense). Each `<section>` = white card (`border-radius: 6px`, subtle
   `box-shadow`), `h2` in the accent color, `p.lede` in dim gray, then one `.diagram` block
   containing the compiled SVG.
3. **Compiler-first workflow — the only sanctioned way to make a diagram.** Write
   `DiagramIntent/v1` JSON (see the compiler workflow section below), then:
   `diagram-runtime validate` → fix errors → `diagram-runtime compile --theme light` → paste the
   returned standalone SVG into the section's `.diagram` div. The compiled SVG is final: ELK
   layered layout with orthogonal routing ran at compile time, every edge is horizontal/vertical
   with quadratic corners (radius ≤ 8px), and SVGO trimmed the markup after an optimization
   contract check. Never ship browser-time rendering: no Mermaid CDN, no ELK runtime in the doc,
   no post-render mutation, no `MutationObserver`, no async pass cadence. Never inline the
   compiler implementation into generated HTML.
4. **Raw Mermaid is an explicit opt-out, and `classDiagram` not `erDiagram`.** If the user
   explicitly asks for a raw Mermaid diagram (e.g. to edit it in Grammy), keep the
   `classDiagram`-not-`erDiagram` guidance and namespace grouping for ERDs, and keep
   `securityLevel: 'loose'` + explicit `<br>` labels. Such blocks are marked as raw-Mermaid
   exceptions in the doc; they bypass the compiler and carry no compiler guarantees. Do not
   silently pass other Mermaid families (gantt, sequence, state) through the flow compiler —
   they stay explicit raw-Mermaid artifacts until they get their own intent variant.
5. **Legend chip strip, not inline color key.** A `.legend` flex row of `.chip.l-*` pills —
   background/border/color triplet per category — placed right above the diagram it describes,
   inside the section (not globally at the top of the doc, unless every diagram shares one legend).
6. **Semantic colors are declared in the intent, applied by the compiler.** Flow node `kind`
   (event/activity/decision/store/external) and schema entity `role`
   (core/secondary/dependency/runtime/new) map to the SVG's `--mex-*` tokens through
   `data-kind`/`data-role` attribute selectors in the compiled `<style>` block. Never recolor
   post-render, never inject inline styles, never match on rendered text — the substring
   coloring technique is retired with the browser pipeline. (Raw-Mermaid exception blocks may
   still use `classDef` + `:::tag`, which is native to Mermaid.)
7. **Decisions are short-and-wide by construction.** The compiler's port allocator routes one
   branch out the `s` side, two branches out `w`/`e`, three out `w`/`s`/`e`, and the diamond
   geometry is compressed in `layout.mjs` — a full-height diamond or a fan-out through a single
   side is a compiler bug, not something to repair in the document. More than three branches is
   a validation error (`TOO_MANY_BRANCHES`); restructure the intent instead. Keep decision
   labels to ~25 characters: the diamond is sized so the label fits inside the cut corners at
   that length, and longer labels overflow them (the runtime's audit flags this).
8. **Notes section closes every doc.** A plain `<ul class="notes">` translating the diagram into
   3-6 sentences a non-diagram-reader can skim — call out what's new vs. existing
   (`<span class="tag-new">`), what's deliberately omitted, and any caveat that isn't visible in
   the picture (e.g. "column X is still `NOT NULL` in prod; this ERD shows the target state").
9. **One compile per diagram, byte-deterministic.** The same intent compiles to byte-identical
   SVG on every run, so diffs between doc versions are meaningful. If the doc needs light and
   dark, embed one theme and switch tokens from the host CSS (rule 1) — geometry must never
   move between themes.
10. **Grammy round-trip carries coordinates only.** `diagram-runtime export-mermaid` emits the
    one-way hand-off (`flowchart TB|LR` plus exactly one `%% mc:layout {"version":1,...}`
    comment); `diagram-runtime import-grammy-layout` reads only that payload and writes
    `presentation.layout = { source: "grammy", nodes }`. Labels, kinds, relations, and details
    never come back from Mermaid. An incomplete layout downgrades to `auto` with warnings —
    treat that as a signal to re-export, not to hand-edit the `.mmd`.
11. **Edge routing is owned by the compiler.** Every edge is a Manhattan route anchored at
    validated port slots; bend radii are `min(8, prevSegment/2, nextSegment/2)`, edge labels sit
    at the midpoint of the longest post-rounded segment that does not collide with a node (so
    sibling branch labels cannot stack at a shared destination or land on a shape), and no
    route ever contains a diagonal segment. Routes detour around blocking nodes — including
    re-entering a wide decision — by choosing a clear bus coordinate, falling back to a
    cross-topology detour when the primary bus cannot clear.
12. **Uniform stroke weight via the compiled style block, not per-element styles.** The SVG's
    `<style>` sets `stroke-width: 1.8px` on all `.mex-edge` and `.mex-shape` elements. Keep the
    doc-level `!important` belt-and-braces rule in the template; never add per-element
    `stroke-width`.
13. **Accessibility contract is enforced at compile time.** The root `<svg>` carries
    `role="img" aria-labelledby="title desc"`, a nonempty `<title id="title">` and
    `<desc id="desc">`, stable `n-`/`e-`/`mex-` ids, `data-node-id` on every flow node and
    `data-role` on every entity, and exactly one marker def per color referenced through
    `marker-end`. `compile` revalidates all of it after SVGO and fails rather than emit a broken
    SVG. The SVG never contains a `<script>` or event-handler attribute.
14. **Optional details panel lives outside the SVG.** A small outer-document script can read
    `data-node-id` (flow) / `data-entity-id` (schema) hooks and a JSON details map to show a
    panel in the document chrome — keyboard-operable (Enter/Space opens, Escape closes, focus
    returns). It must never insert scripts into SVG or mutate geometry.
15. **Labels are plain text with `\n` line breaks.** The compiler escapes labels (no HTML in
    compiled SVG text). For raw-Mermaid exception blocks, the old rich-label guidance applies:
    `<code>` chips, `<b>`, explicit `<br>` with `securityLevel: 'loose'`, `•` bullet lines — but
    never rely on auto-wrap for multi-part labels.

## Color palette (this doc's defaults — swap hues per project, keep the _structure_)

Chips / legend (light pastel, readable on white):

| Chip                             | Background | Border    | Ink       |
| -------------------------------- | ---------- | --------- | --------- |
| new / added                      | `#e8f5e9`  | `#2e7d32` | `#1b5e20` |
| planning / upstream (dashed)     | `#e8eaf6`  | `#3949ab` | `#1a237e` |
| batch / core entity              | `#e3f2fd`  | `#1565c0` | `#0d3b66` |
| work-unit tier                   | `#e0f2f1`  | `#00897b` | `#004d40` |
| dependency / edge                | `#fff3e0`  | `#ef6c00` | `#e65100` |
| runtime actor                    | `#ede7f6`  | `#5e35b1` | `#311b92` |
| session                          | `#e0f7fa`  | `#00838f` | `#006064` |
| phase                            | `#fce4ec`  | `#ad1457` | `#880e4f` |
| command / leaf                   | `#f9fbe7`  | `#9e9d24` | `#616a12` |
| polymorphic / hand-off (no fill) | `#ffffff`  | `#90a4ae` | `#546e7a` |

Flow `kind` tokens (compiled SVG defaults): activity `#e3f2fd/#1565c0`, event `#e8f5e9/#2e7d32`,
decision `#fff3e0/#ef6c00`, store `#e0f2f1/#00897b`, external `#ede7f6/#5e35b1`, branch edges
`#ef6c00`. Schema `role` tokens use the same hues: core blue, secondary teal, dependency amber,
runtime violet, new green. Keep legend chips aligned with the token hues so the legend and the
diagram always agree.

## The compiler workflow (rule 3, worked example)

```json
{
  "version": "diagram-intent/v1",
  "kind": "flow",
  "title": "Focused-context request",
  "description": "A request resolves its context and branches on availability.",
  "direction": "TB",
  "nodes": [
    { "id": "request", "kind": "event", "label": "Request arrives" },
    { "id": "resolve", "kind": "activity", "label": "Resolve context" },
    { "id": "available", "kind": "decision", "label": "Context available?" },
    { "id": "focused", "kind": "activity", "label": "Build focused prompt" },
    { "id": "source", "kind": "external", "label": "Request source" },
    { "id": "done", "kind": "event", "label": "Return result" }
  ],
  "edges": [
    {
      "id": "e-request-resolve",
      "from": { "node": "request" },
      "to": { "node": "resolve" },
      "relation": "flow"
    },
    {
      "id": "e-resolve-available",
      "from": { "node": "resolve" },
      "to": { "node": "available" },
      "relation": "flow"
    },
    {
      "id": "e-available-focused",
      "from": { "node": "available" },
      "to": { "node": "focused" },
      "relation": "branch",
      "label": "yes"
    },
    {
      "id": "e-available-source",
      "from": { "node": "available" },
      "to": { "node": "source" },
      "relation": "branch",
      "label": "no"
    },
    {
      "id": "e-focused-done",
      "from": { "node": "focused" },
      "to": { "node": "done" },
      "relation": "flow"
    },
    {
      "id": "e-source-done",
      "from": { "node": "source" },
      "to": { "node": "done" },
      "relation": "flow"
    }
  ],
  "presentation": { "layout": { "source": "auto", "nodes": {} } }
}
```

```
cd narrative-diagram/runtime && npm ci   # once
node src/cli.mjs validate  --input intent.json --report diag.json
node src/cli.mjs compile   --input intent.json --svg diagram.svg --theme light
node src/cli.mjs export-mermaid --input intent.json --out diagram.mmd   # optional Grammy hand-off
node src/cli.mjs import-grammy-layout --input intent.json --mermaid diagram.mmd --out intent-with-layout.json
```

- `validate` exits nonzero with RFC 6901 paths for: unsupported version/kind, unknown fields
  (at every level), invalid/duplicate ids, blank text, unsupported node/edge roles, dangling
  endpoints, self-links, invalid ports, >3 branches from a decision, missing flow root, missing
  flow terminal. Warnings: unreachable nodes, grammy layout omits/adds node ids, invalid
  coordinates (fallback to `auto`).
- `compile` writes nothing on validation or optimization-contract failure. Node ids must match
  `^[a-z][a-z0-9-]*$`; entity/namespace/relation ids allow `_` (table-ish names).
- Schema intents swap `nodes`/`edges` for `namespaces` (entities with `stereotype`, `fields`,
  `role`) and `relations` (entity-to-entity, `cardinality`, optional `label`). The compiler
  renders namespace bounds, `«stereotype»` identities, and role fills; relations anchor to the
  nearest orthogonal box side.
- Recompile (never hand-edit the SVG) when the diagram changes. If the SVG has to change beyond
  what the intent expresses — different layout, different labels — change the intent or add an
  intent feature; don't repair the output.

## Templates

- `references/template.html` — full self-contained starter: header, two compiled SVG sections
  (a flow with a three-way decision + a schema with two namespaces), scoped legend chips per
  section, notes list, an optional details panel keyed on `data-node-id`/`data-entity-id` with a
  JSON map (keyboard-operable), and a light/dark token toggle that provably does not move
  geometry. It contains no Mermaid CDN import and no geometry/color post-processing code.
- `runtime/` — the standalone compiler package (`elkjs ^0.11.1`, `svgo 4.0.2`; Node ≥ 20,
  built-in `node --test` runner, no other dependencies, no telemetry). Its `cli.mjs` exposes
  `validate`, `compile`, `export-mermaid`, `import-grammy-layout`. `test/` covers intent
  validation (every error/warning code with its path), three-branch egress, Manhattan routing
  with ≤8px corner radii, byte-identical recompiles, theme-invariant geometry, the SVGO
  contract, and the Grammy bridge.

## Common pitfalls (don't repeat)

- **Inline rendering in the doc.** Embedding Mermaid + ELK CDN imports, `squashDiamonds()`,
  `orthogonalizeEdges()`, `colorizeEdgeGroups()`, or the 0/400/1200ms pass cadence into the
  document. The browser does nothing but display the compiled SVG; the compiler owns geometry.
- **Fixing output by hand.** Patching a compiled SVG's paths, coordinates, or colors instead of
  editing the intent and recompiling. Compiled output is deterministic; manual patches drift.
- **Using Mermaid as the canonical state.** The `.mmd` is a one-way Grammy hand-off. Editing
  labels or structure in Mermaid and expecting the compiler to adopt them silently — only the
  `%% mc:layout` payload is ever imported, and only into `presentation.layout`.
- **Shipping a decision diamond at its default aspect or with a single-side fan-out.** The
  compiler compresses diamonds and allocates `w`/`s`/`e` egress; a tall diamond or stacked
  branches means the runtime is broken or the intent was hand-edited.
- **Ignoring validation diagnostics.** Blank labels, unknown fields, dangling endpoints,
  unreachable nodes — fix them before compiling; `compile` refuses invalid intents.
- **Skipping the optimization contract.** SVGO trims aggressively; `cleanupIds` does not
  understand `aria-labelledby`, so `title`/`desc` ids are preserved explicitly by config. If the
  contract check fails, the SVG is broken — do not ship a manual workaround.
- **Overlong decision labels.** A diamond's corners are cut; a label wider than ~25 characters
  pokes out of them. Rephrase the question or use an activity node instead of stretching the
  diamond.
- **Putting the legend at the top of the whole doc when sections use different categories.**
  Scope each `.legend` to the section it describes, right above that section's diagram.
- **Mixing the dark `mermaid-architecture` palette into this doc.** Light pastel chips on white
  are the house style; the dark token set is only for an opt-in theme toggle and must keep the
  same hue structure.
- **Reaching for raw Mermaid for every diagram.** The default is compiled intent → SVG. Raw
  Mermaid is for explicit user requests (Grammy editing, exotic families); mark it as such in
  the doc.
- **`flowchart LR` with a nested `direction TB` subgraph** (raw-Mermaid blocks only): fragile
  under ELK — prefer a single top-level direction; restructure rather than nest opposing
  directions.
