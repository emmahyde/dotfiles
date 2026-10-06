# narrative-diagram-runtime

Standalone compiler for the `narrative-diagram` skill. `DiagramIntent/v1` JSON is
the canonical source; accessible static SVG is the publication artifact; Mermaid
is a one-way editable fallback for the Grammy WYSIWYG editor.

```
npm ci
node --test test/
```

## Commands

- `diagram-runtime validate --input <intent.json> [--report <diagnostics.json>]`
  — machine-readable diagnostics; exits nonzero when any error exists.
- `diagram-runtime compile --input <intent.json> --svg <diagram.svg> [--report <diagnostics.json>] [--theme light|dark]`
  — validate, lay out (ELK), render, optimize (SVGO), revalidate the
  optimization contract, and write a standalone SVG. No output file is written
  on validation or contract failure.
- `diagram-runtime export-mermaid --input <intent.json> --out <diagram.mmd>`
  — one-way Grammy hand-off for `kind: "flow"`; exits with
  `MERMAID_EXPORT_UNSUPPORTED_KIND` for `schema`.
- `diagram-runtime import-grammy-layout --input <intent.json> --mermaid <diagram.mmd> --out <intent-with-layout.json>`
  — imports only the final `%% mc:layout` payload; never parses or changes
  Mermaid semantics. Incomplete layout data downgrades to `auto` with warnings.

## Ownership

- `DiagramIntent/v1` owns semantics (kinds, relations, labels, details).
- ELK (`elkjs ^0.11.1`, the line Grammy uses) owns geometry at compile time.
- SVGO `4.0.2` trims the SVG but must not break interaction or accessibility;
  `compile` revalidates an explicit contract after optimization.
- Grammy owns optional visual edits and round-trips coordinates only.
