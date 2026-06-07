# Quick reference

## Shape syntax

| Meaning | Mermaid syntax | Notes |
|---|---|---|
| process / state | `id[label]` | default rect |
| decisive event / fork | `id(["label"]):::cat-decision` | stadium pill, not diamond |
| data store | `id[(label)]` | cylinder |
| I/O | `id[/label/]` | parallelogram |
| terminal | `id((label))` | circle (use sparingly) |
| swimlane | `subgraph Name[Title] ... end` | for component lanes |

Avoid: `{label}` diamond — oversized under elk, users dislike.

## Edge syntax

| Style | Mermaid | Use for |
|---|---|---|
| solid → | `A --> B` | normal flow |
| labeled | `A -->|condition| B` | branching from decision |
| dashed | `A -.-> B` | optional / async / non-critical |
| thick | `A ==> B` | hot path |

## Color category lookup

| `cat-*` | Border | Bg | Label |
|---|---|---|---|
| `cat-file` | `#5fa8e0` | `#10243a` | `#9cd0f5` |
| `cat-env` | `#f4b942` | `#2e2210` | `#f4b942` |
| `cat-module` | `#a3e635` | `#1a2a10` | `#cfe7a3` |
| `cat-class` | `#6dd6c3` | `#102a26` | `#9eecdb` |
| `cat-func` | `#e879f9` | `#2a1030` | `#f0b3ff` |
| `cat-db` | `#7dd181` | `#102a18` | `#a8eba8` |
| `cat-ext` | `#ff8a65` | `#2e1a14` | `#ffb59c` |
| `cat-runtime` | `#c792ea` | `#1f1530` | `#d9b6f7` |
| `cat-cli` | `#d8a657` | `#2a2010` | `#ecc987` |
| `cat-decision` | `#ffd166` | `#2e2710` | `#ffd166` italic |

## Token highlighting (class diagrams)

| Token | Class | Color |
|---|---|---|
| `string` `int` `float` `bool` `blob` `json` `timestamp` | `tok-type` | `#6cb6ff` |
| `PK` `FK` `UK` `NN` | `tok-key` | `#f4b942` bold |
| identifier (column name) | `tok-name` | `#cfe7a3` |

## ELK init (drop-in)

```js
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

## CDN imports

```html
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs'
  import elkLayouts from 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/dist/mermaid-layout-elk.esm.min.mjs'
  mermaid.registerLayoutLoaders(elkLayouts)
</script>
```
