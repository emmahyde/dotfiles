# Obsidian canvas output — skeleton & rules

For when the host is Obsidian (`/canvas`, `/json-canvas`, a `.canvas` request, or working inside a vault). Same diagram doctrine as the HTML host (SKILL rules 1–5); the HTML render/colorize machinery (rules 6–10) does **not** apply.

## Why a different host changes things

| | HTML host | Obsidian canvas host |
|---|---|---|
| ELK orthogonal routing | `mermaid.initialize({ layout:'elk' })` | mermaid-elk plugin + `--- config: layout: elk ---` header on **every** block |
| Node-category colors | post-render JS colorizer | mermaid-native `classDef` + `class` inside each block |
| Token colors (ERD attrs) | JS tokenizer | not available — rely on shape/structure |
| Diagram container | `<div class="mermaid">` | a `text` node whose body is a ` ```mermaid ` fence |
| Special chars in labels | quote freely (`["a:b (c)"]`) | **avoid `"`** — the block is a JSON string |

## Label rule (the canvas killer)

The entire diagram is a JSON string value, so every `"` needs `\"`. Avoid it entirely: stadium `([multi word])`, rect `[multi word]`, and cylinder `[(multi word)]` all take **unquoted** multi-word text. Keep `:` `()` `/` `+` and classDiagram cardinalities (`"1"`,`"*"`) out of labels — move `file:line` citations into the prose card under the diagram. Then encoding the block into JSON is purely `\n` substitution.

## Minimal skeleton

Two zones: one mermaid diagram node (elk header + classDef coloring), one callout card, a basename-wikilink backlink, one cross-node edge. Coordinates: stacked `group` zones, two columns at `x:20` / `x:1000` (~940 wide), 20px inset, 60px gap between zones.

```json
{
  "nodes": [
    {"id":"z1","type":"group","label":"Subsystem A","x":0,"y":0,"width":1960,"height":700,"color":"5"},
    {"id":"a-diag","type":"text","x":20,"y":20,"width":940,"height":640,"text":"### Routing\n\n```mermaid\n---\nconfig:\n  layout: elk\n---\nflowchart LR\n  TC[tool call] --> PTU([routing decision])\n  PTU -->|deny| D[hard deny]\n  PTU -->|allow| A[pass through]\n  classDef ev fill:#2e2710,stroke:#ffd166,color:#ffd166\n  class PTU ev\n```\n\nCitations live here, not in labels: `routing.mjs:799-815`."},
    {"id":"a-card","type":"text","x":1000,"y":20,"width":940,"height":640,"color":"5","text":"> [!check] Subsystem A\n> One-line claim with a `code` ref.\n>\n> Source: [[Originating Note Name]]"}
  ],
  "edges": [
    {"id":"e1","fromNode":"a-diag","fromSide":"right","toNode":"a-card","toSide":"left","fromEnd":"none","toEnd":"arrow","color":"4","label":"explains"}
  ]
}
```

## classDef palette (mermaid-native, matches house colors)

```
classDef ev      fill:#2e2710,stroke:#ffd166,color:#ffd166   %% decision pill
classDef new     fill:#1a2a10,stroke:#a3e635,color:#cfe7a3   %% added / new
classDef hi      fill:#102a18,stroke:#7dd181,color:#a8eba8   %% low-risk / good
classDef risk    fill:#2e1a14,stroke:#ff8a65,color:#ffb59c   %% high-risk / warning
```

Apply with `class NodeA,NodeB ev`. Note `%%` comments are fine *inside* a mermaid block but add nothing to the JSON-escape burden (no quotes).

## Canvas preset colors (group/card/edge `color`)

`"1"` red · `"2"` orange · `"3"` yellow · `"4"` green · `"5"` cyan · `"6"` purple. Suggested mapping: framing → 6, proven/benchmark → 5, adopter → 4, roadmap → 3, high-risk → 1, open-questions → 2.

## Validate before finishing

```python
import json
d = json.load(open(PATH))
nodes, edges = d["nodes"], d["edges"]
ids = [n["id"] for n in nodes]
assert len(ids) == len(set(ids)), "dup node ids"
nset = set(ids)
assert not [e["id"] for e in edges if e["fromNode"] not in nset or e["toNode"] not in nset], "dangling edge"
groups = [n for n in nodes if n["type"] == "group"]
def inside(n, g): return g["x"] <= n["x"] and g["y"] <= n["y"] and n["x"]+n["width"] <= g["x"]+g["width"] and n["y"]+n["height"] <= g["y"]+g["height"]
assert not [n["id"] for n in nodes if n["type"] != "group" and not any(inside(n, g) for g in groups)], "node outside all groups"
print(f"OK: {len(nodes)} nodes, {len(edges)} edges")
```

## Gotchas

- **`\n` not `\\n`** in JSON `text` — Obsidian renders `\\n` as the literal characters.
- **Backlink = wikilink text node**, not a `type:file` node — survives nested vault roots (Obsidian resolves by basename).
- **`sequenceDiagram` ignores elk** — fine to include, but the `layout: elk` header is a harmless no-op there; don't expect orthogonal routing.
- **Group must enclose its children's bounds**, or Obsidian won't treat them as contained — the validator catches this.
