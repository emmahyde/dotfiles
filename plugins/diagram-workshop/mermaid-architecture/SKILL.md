---
name: mermaid-architecture
description: Use when producing HTML architecture diagrams (ERDs, flowcharts, swimlanes, system maps). Enforces ELK layout with orthogonal connectors, classDiagram (NOT erDiagram), stadium-pill decisive-events (NOT diamonds), and post-render syntax-highlighting + node-category color coding.
---

# Mermaid architecture diagrams — house style

Use this skill any time the user asks for an architecture/ERD/flowchart HTML doc. The output is a single self-contained HTML file (mermaid loaded from CDN), with the rules below baked in.

## Rules (non-negotiable)

1. **Mermaid v11+ ESM with ELK plugin.** Never v10. Never the script-tag bundle.
2. **Layout = `elk`, edge routing = `ORTHOGONAL`.** No diagonal connectors anywhere a flowchart layout is in use.
3. **classDiagram instead of erDiagram.** `erDiagram` uses its own dagre renderer with curved edges and ignores the global elk layout. `classDiagram` honors elk → right-angle connectors. Convert any ER schema to `classDiagram` form: `class TableName { string col PK }` plus `Source "1" --> "*" Target : relation`.
4. **Stadium pills `(["label"]):::cat-decision` for decisive / branching events.** Mermaid diamonds (`{...}`) are oversized squares under elk and look misaligned; users dislike them. Stadiums signal "transformation event" or "fork" without that geometry hit.
5. **One-shape-per-meaning.** `[rect]` = process / state / entity. `(stadium)` = decisive event. `[(cylinder)]` = data store. `[/parallelogram\]` = I/O. `subgraph` = swimlane. Don't mix.
6. **Tab containers must all be `display: block` during `mermaid.run()`.** ELK measures bbox; hidden panes layout to zero. Render manually with all panes visible, then restore active.
7. **Tag each `.mermaid` div with `data-kind`** (`flowchart` / `class` / `er` / `sequence`) BEFORE `mermaid.run()` wipes its source. The categorizer uses this to skip class diagrams (where token-level coloring is the only highlighting).
8. **Two-pass coloring after render:**
   - Token-level (inside class attributes): `string` blue, `PK`/`FK` amber, identifier lime.
   - Node-level (flowcharts only): regex-classify label text → cat-file / cat-env / cat-module / cat-class / cat-func / cat-db / cat-ext / cat-runtime / cat-cli / cat-decision.
9. **Legend chip strip at top of every tab.** One chip per category, colored to match.
10. **Tabs share one mermaid init** — don't reinit per tab. Switch via show/hide on `.pane.active`.

## Color palette (locked)

| Category | Border | Fill | Label |
|---|---|---|---|
| `cat-file` | `#5fa8e0` | `#10243a` | `#9cd0f5` |
| `cat-env` | `#f4b942` | `#2e2210` | `#f4b942` (uppercase) |
| `cat-module` | `#a3e635` | `#1a2a10` | `#cfe7a3` |
| `cat-class` | `#6dd6c3` | `#102a26` | `#9eecdb` |
| `cat-func` | `#e879f9` | `#2a1030` | `#f0b3ff` |
| `cat-db` | `#7dd181` | `#102a18` | `#a8eba8` |
| `cat-ext` | `#ff8a65` | `#2e1a14` | `#ffb59c` |
| `cat-runtime` | `#c792ea` | `#1f1530` | `#d9b6f7` |
| `cat-cli` | `#d8a657` | `#2a2010` | `#ecc987` |
| `cat-decision` | `#ffd166` | `#2e2710` | `#ffd166` italic |
| Token: `tok-type` | — | — | `#6cb6ff` |
| Token: `tok-key` (PK/FK) | — | — | `#f4b942` bold |
| Token: `tok-name` | — | — | `#cfe7a3` |

Background: `#1a1a1a` body / `#232323` panel / `#111` mermaid container. Accent: lime `#a3e635`.

## Classifier regex (priority order)

```
ENV     /^[A-Z][A-Z0-9]+(?:_[A-Z0-9]+){1,}$/
RUNTIME /^(hooks?|skills?|scripts?|tools?|tests?|core|apps?|packages?)\//i
FILE    has /[\/~]/ AND ext .(md|jsonl|py|json|sqlite|db|toml|yml|tsx?|jsx?|html|css|cs|csproj|sln)
MODULE  bare lowercase identifier OR `name.py` without path
DB      \b(sqlite|sqlite-vec|database|\.db\b|table|cursors)\b
EXT     \b(Anthropic|OpenAI|LiteLLM|Bedrock|GitHub|API|providers?)\b
CLI     ^claude\b | \bsubprocess\b | \b-p\b | \bcron\b | \brepomix\b | \bast-grep\b
FUNC    /\([^)]*\)\s*$/  OR  ^[a-z][\w]*(?:\.\w+)+$
CLASS   /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/  (PascalCase)
```

First match wins. `cat-decision` is set explicitly via mermaid `:::cat-decision` syntax, not by regex.

## Skip categorization for

- `g.cluster` (subgraph headers)
- Any `.mermaid` whose `data-kind !== 'flowchart'` (class/er/sequence)
- Nodes already tagged (`g.dataset.cat`)

## Mandatory mermaid init

```js
mermaid.registerLayoutLoaders(elkLayouts)
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  layout: 'elk',
  flowchart: { curve: 'linear', htmlLabels: true, defaultRenderer: 'elk' },
  elk: {
    'elk.algorithm': 'layered',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': 50,
    'elk.spacing.nodeNode': 40,
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.mergeEdges': true,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN'
  }
})
```

## Render sequence (mandatory)

```js
const renderAll = async () => {
  // 1. Tag each .mermaid with data-kind from source text BEFORE mermaid wipes it
  document.querySelectorAll('.mermaid').forEach(m => {
    const src = (m.textContent || '').trim()
    let kind = 'flowchart'
    if (/^classDiagram\b/.test(src)) kind = 'class'
    else if (/^erDiagram\b/.test(src)) kind = 'er'
    else if (/^sequenceDiagram\b/.test(src)) kind = 'sequence'
    m.dataset.kind = kind
  })
  // 2. Force all panes visible so ELK measures real bbox
  const panes = document.querySelectorAll('.pane')
  panes.forEach(p => { p.dataset.wasActive = p.classList.contains('active') ? '1' : '0'; p.classList.add('active') })
  // 3. Render
  await mermaid.run({ querySelector: '.mermaid' })
  // 4. Restore
  panes.forEach(p => { if (p.dataset.wasActive !== '1') p.classList.remove('active') })
  // 5. Apply both colorize passes (with delays — elk layout is async)
  colorize()
  setTimeout(colorize, 400)
  setTimeout(colorize, 1200)
}
```

## Templates

- `references/template.html` — full self-contained starter with init, CSS, classifier JS, legend, tab switcher
- `references/cheatsheet.md` — quick lookup for shape syntax + category color hex

## Common pitfalls (don't repeat)

- **Diamonds `{...}`** — square-aspect under elk, oversized; user pushed back. Use `(["label"]):::cat-decision`.
- **erDiagram** — ignores elk; produces curved edges. Always classDiagram.
- **CSS `transform: scaleY(...)`** on shapes — visually squashes polygon but ELK edge endpoints don't follow → floating gaps. Don't.
- **`startOnLoad: true` with hidden tabs** — ELK lays out at zero size, tabs render empty.
- **MutationObserver-only colorize** — fires before async ELK completes. Always pair with `setTimeout(colorize, 400)` + `setTimeout(colorize, 1200)`.
- **Categorizing class-diagram entities** — class-box titles like `ISSUE_CARD` match the env-var regex. Skip via `data-kind === 'class'`.
- **Per-token color via `<text>`** — mermaid v11 with `htmlLabels: true` puts attrs in `<foreignObject>` HTML spans, not SVG `<text>`. Tokenizer must walk both; set `color:` for HTML and `fill:` for SVG.

## Output policy

- Single HTML file, no external assets except mermaid+elk CDN.
- Three tabs minimum if comparing systems: `<system A>`, `<system B>`, `integration`.
- Per tab: legend strip → overarching flow → ERD (classDiagram) → phase flowcharts (grid2 layout) → swimlane → narrative notes.
- Always include the integration/cross-system tab when two systems are in scope, with a sequence diagram of one end-to-end request and a data-ownership table.
