# Diagrams

## Notion-native mermaid

Notion renders ` ```mermaid ` code blocks with its default layout. Do not build, embed, or upload an HTML document.

HTML was tried. `notion-create-attachment` for `.html` was blocked by a security gateway. The hosted embed was rejected because it did not work as wanted. Therefore, use no ELK, animation, post-render JavaScript, diamond squash, edge snapping, or substring colorizer.

The visual grammar comes from `narrative-diagram`. Its layout machinery does not transfer. Its shape, color, legend, and label rules do.

## Three channels, one question each

- **Shape asks what kind of thing it is.** Use one shape for each kind across every page diagram.

  | Shape | Syntax | Kind |
  |---|---|---|
  | stadium | `(["…"])` | an observed event, or an outside system acting on its own |
  | rectangle | `["…"]` | a step, method call, or ticket |
  | subroutine | `[["…"]]` | a class, record, or object (`Triage record`) |
  | cylinder | `[("…")]` | a database row or table |
  | round, borderless, no fill | `("…"):::nar` | narration with no real symbol behind it |

  **Use no `{ }` diamonds.** Notion has no squash pass, so diamonds render tall and route edges diagonally. Model branches as stadiums or rectangles. Put conditions on edges, such as `APPROVE -- no human --> MERGEAUTO`.
- **Color asks which subsystem owns it.** Use one `classDef` per subsystem. Reuse its hex triplet on every diagram. Tag nodes with `:::tag`; `classDef` works in Notion. Never color by kind because shape already says that.
- **Lanes ask who executes the step.** Use `subgraph Owner … end` only when a round-trip between owners matters. Keep lane titles near three words. Neither model-page diagram uses subgraphs, so check the render before relying on one.

## Not built yet means draft

“Does not exist yet” applies to every subsystem. It must not take a subsystem color. Use white fill, gray dotted border (`stroke-dasharray:2 3`), and gray ink.

A white box with a dotted outline reads as draft without a legend. Name it in the legend as `white, dotted border = not built yet`, not as a color.

The model page first used indigo for planned nodes beside a purple subsystem. They looked ambiguous in Notion, so the page changed planned nodes to the draft style.

- Keep the node’s real shape. A planned roster fetch stays a rectangle; change only fill and border.
- Use draft style only when a diagram mixes built and unbuilt nodes, such as Orientation. Color every Plan ticket by track instead.
- A dotted border is not a dotted edge. Keep `-. overlaps with .->` for ticket overlap.

## Legends

Notion cannot hold the narrative-diagram HTML chip strip. Use one paragraph of `<span color="<family>_bg">**Category**</span>` chips separated by spaces. Put the draft style last: `<span color="gray">white, dotted border = not built yet (draft)</span>`.

- Put a legend directly above each diagram it describes. Use one shared legend only when every diagram uses the same categories.
- Order legend items as the diagram reads: sources, system, then outcome.
- State the legend once in Notes: “White boxes with a dotted border mark work this epic still has to build.”

## Notion palette

A legend chip matches a node only when both share a color family. Notion has nine families. Pick every subsystem color from this table, with at most one category per row. Narrative-diagram’s teal, cyan, and indigo rows have no Notion match; do not use them.

| Legend span | fill | stroke | ink | narrative-diagram role |
|---|---|---|---|---|
| `blue_bg` | `#e3f2fd` | `#1565c0` | `#0d3b66` | core entity / service |
| `purple_bg` | `#ede7f6` | `#5e35b1` | `#311b92` | runtime actor |
| `green_bg` | `#e8f5e9` | `#2e7d32` | `#1b5e20` | new / the system being built out |
| `orange_bg` | `#fff3e0` | `#ef6c00` | `#e65100` | operator / manual human action |
| `pink_bg` | `#fce4ec` | `#ad1457` | `#880e4f` | phase / spike |
| `yellow_bg` | `#f9fbe7` | `#9e9d24` | `#616a12` | command / leaf / outside platform |
| `gray` (text) | `#ffffff` | `#90a4ae` | `#546e7a` | not built yet (draft: white, dotted border) |

`red_bg` and `brown_bg` are free for categories without a narrative-diagram row, such as failure or blocked. Pick a pastel fill, saturated stroke, and dark ink in that family.

Every `classDef` carries `stroke-width:2px,font-weight:bold`. Notion renders diagrams small, and default 1px strokes wash out. This hand change made the model-page nodes legible.

```
classDef ci      fill:#e3f2fd,stroke:#1565c0,color:#0d3b66,stroke-width:2px,font-weight:bold
classDef flake   fill:#ede7f6,stroke:#5e35b1,color:#311b92,stroke-width:2px,font-weight:bold
classDef human   fill:#fff3e0,stroke:#ef6c00,color:#e65100,stroke-width:2px,font-weight:bold
classDef bot     fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20,stroke-width:2px,font-weight:bold
classDef github  fill:#f9fbe7,stroke:#9e9d24,color:#616a12,stroke-width:2px,font-weight:bold
classDef planned fill:#ffffff,stroke:#90a4ae,color:#546e7a,stroke-width:2px,stroke-dasharray:2 3,font-weight:bold
classDef nar     fill:none,stroke:none,color:#6a737d
```

## Labels: two registers

`narrative-diagram` separates symbols from narration with HTML spans. Notion strips those spans, so separate registers by line.

- Line 1 names the thing: `Poller sweep` or `PROJ-102`.
- After `<br>`, line 2 gives a short plain-words sub-line. Keep it near six words and use no second sub-line.
- A label without a real symbol is narration. Make it an `:::nar` node with borderless gray text. Do not color it. Borderless narration stays distinct from a dotted draft node.

## Syntax that breaks in Notion

- Use `flowchart TD`. Quote every label (`["…"]`) and use `<br>` for breaks, never `\n`.
- Use no `@{ shape: … }`, HTML spans in labels, `%%{init}%%`, or ELK options.
- Put no literal `"` inside labels. Use `‘ ’`. Keep `#{…}` interpolation out of labels.
- Never name a `classDef` `call`, `click`, `class`, `style`, or `end`. The parser fails with `got 'CALLBACKNAME'` on the next line.

## What each diagram shows

**Orientation diagram (current versus planned):** Use stadiums for sources, a subroutine box for the central record, and rectangles for steps. Use drafts for unbuilt nodes. When automation replaces a human path, draw both paths so readers see what goes away.

**Plan diagram (tickets):** Use one rectangle per ticket: `["KEY<br>Short verb phrase"]`. Color tickets by track: spike, fetch, sweep, or merge. Add no descriptions. Draw arrows only for real Blocks links. Mark overlaps or suspected duplicates with a dotted labeled edge, `A -. overlaps with .-> B`, and explain it in Notes.

## Diagram pitfalls

- Do not put node IDs such as `BBROSTER` or `MERGEAUTO` in prose. Readers see labels, not IDs; use the color or label.
- Do not assign two categories to one Notion color family, such as indigo and purple, teal and green, or cyan and blue. They look distinct in hex but identical in the legend.
- Do not make color do shape’s job. If node kinds differ only by color, readers cannot tell records from steps. Change the shape.
