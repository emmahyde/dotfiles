# Authoring a new benchmark — interview script

Use this when the user's task fits no built-in. Skeleton lives in
`skillopt/envs/_template/` (`loader_template.py`, `env_template.py`,
`config_template.yaml`, `README.md`). **Read those first** — copy their current
shape rather than the snippets here, which may drift from the code.

Walk it one piece at a time. Offer to scaffold each file as you go.

## The three pieces
1. **Data loader** — load raw data into `DataItem`s and split them.
2. **Env adapter** — `execute()` runs one task with the current skill; `evaluate()`
   scores the prediction 0.0–1.0.
3. **Registration** — add the pair to `BENCHMARK_REGISTRY` in
   `skillopt/envs/__init__.py`.

## Step 1 — package
```bash
mkdir -p skillopt/envs/my_benchmark
touch skillopt/envs/my_benchmark/__init__.py
```

## Step 2 — data loader (`skillopt/envs/my_benchmark/loader.py`)
Subclass `DataLoader` from `skillopt.data.base`. Load each row into a `DataItem`
(`id`, `input`, `ground_truth`, `metadata`). Implement `setup(cfg)` (load +
create splits) and `get_split_items(split)`. Verify the `DataItem` field names
against `skillopt/data/base.py` — don't trust this from memory.

## Step 3 — env adapter (`skillopt/envs/my_benchmark/env.py`)
Subclass `EnvAdapter` from `skillopt.envs.base`. Two methods carry the weight:
- `async execute(item, skill, model) -> TaskResult` — build the prompt from the
  skill document + task input, call the model, parse the prediction, score it,
  return a `TaskResult` with `prediction`, `score`, and the `trajectory`
  (system=skill, user=input, assistant=response). The trajectory is what the
  optimizer reflects on — include enough for it to diagnose failures.
- `evaluate(prediction, ground_truth) -> float` — **this is the loss function.**
  Exact match / F1 / ANLS / pass-rate, whatever genuinely measures success. A
  noisy or gameable metric is the #1 way a new benchmark fails: the optimizer
  will chase the metric, not the task. Get this deterministic and meaningful
  before tuning anything else.

## Step 4 — register (`skillopt/envs/__init__.py`)
```python
BENCHMARK_REGISTRY = {
    # ...existing...
    'my_benchmark': {'env': MyBenchmarkEnv, 'loader': MyBenchmarkDataLoader},
}
```

## Step 5 — config (`configs/my_benchmark/default.yaml`)
Inherit the base and override only what's specific:
```yaml
_base_: ['../_base_/default.yaml']
env:
  name: my_benchmark
  data_path: data/my_benchmark
  split_mode: ratio
  split_ratio: "2:1:7"
```

## Step 6 — smoke test first
Run with a tiny `train_size` / `batch_size` and 1 epoch. Confirm scores are
non-degenerate (not all 0 or all 1 — that means the metric or parsing is broken)
before a real run.

## New backend (rarer)
If the user also needs a model provider that isn't `azure_openai` / `openai_chat`
/ `claude_code_exec` / `qwen`, the parallel path is `skillopt/model/`: subclass
`ModelBackend`, implement `async generate()`, register in
`skillopt/model/__init__.py`'s `BACKEND_REGISTRY`. Use async throughout; add
retry/backoff for production.
