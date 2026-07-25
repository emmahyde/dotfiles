# Built-in benchmarks — what each fits

Verify against `configs/<name>/default.yaml` and
`skillopt/envs/<name>/` before recommending. Datasets are **not** shipped — the
user prepares their own in the expected format.

| Benchmark | Task type | Fits when the user's task is… | Difficulty / runtime |
|---|---|---|---|
| `searchqa` | Retrieval QA | Answer a question given retrieved context/passages | ⭐ easy, ~30 min |
| `docvqa` | Document VQA | Answer questions about document images/layout | ⭐⭐ medium, ~2 h |
| `alfworld` | Embodied agent | Multi-step text-game / action planning | ⭐⭐⭐ hard, ~3 h |
| `livemathematicianbench` | Math | Hard math problem solving with reasoning | ⭐⭐ medium |
| `spreadsheetbench` | Code generation | Generate code/formulas to manipulate spreadsheets | ⭐⭐ medium |
| `officeqa` | Tool-augmented QA | QA that requires calling tools over office docs | ⭐⭐ medium |

**Pick the closest built-in when the fit is clean.** SearchQA is the best first
run — fastest loop, cheapest, easiest to verify the pipeline works end to end.

## Data format

SkillOpt expects a split directory (when `split_mode: split_dir`):
```
data/<split>/
├── train/items.json
├── val/items.json
└── test/items.json
```
Each `items.json` is an array of task items. Required fields are
**benchmark-specific** — read `skillopt/envs/<benchmark>/` (loader) for the exact
shape. SearchQA example:
```json
[
  { "id": "q1", "question": "Who wrote ...", "context": "[DOC] ...", "answers": ["..."] }
]
```

In `split_mode: ratio`, point `env.data_path` at a single dataset and SkillOpt
builds a deterministic train/val/test split using `env.split_ratio` (default
`"2:1:7"`) and `env.split_seed`.

## When none fit → new benchmark
If the task doesn't map to any row above (different I/O shape, different scoring),
author a new benchmark. See `new-benchmark.md`. Don't force a square task into a
round built-in — the `evaluate()` metric has to genuinely measure success or the
optimizer learns the wrong thing.
