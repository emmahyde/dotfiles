# Reading a run & deciding the next move

## Output layout
```
outputs/<run>/
├── config.json          # flattened runtime config (what actually ran)
├── history.json         # per-step record: val/test scores, accept/reject
├── runtime_state.json   # resume checkpoint
├── best_skill.md        # the trained skill = final "weights"
├── skills/skill_vXXXX.md   # snapshot per accepted step
├── steps/step_XXXX/        # per-step patches, candidate skill, eval digest
├── slow_update/epoch_XX/   # momentum logs (longitudinal comparison)
└── meta_skill/epoch_XX/    # cross-epoch strategy memory
```
Re-running the same `train.py` command **auto-resumes** from the last completed
step (via `runtime_state.json`).

## What to look at, in order
1. **`history.json`** — the training curve. For each step: train/rollout score,
   gate (val) score, and ACCEPT/REJECT. This is your loss curve + early-stopping log.
2. **`best_skill.md`** — read the actual trained skill. Does it encode sensible
   strategy, or has it overfit to quirks / bloated with junk rules?
3. **`steps/step_XXXX/`** — when something looks off, open the step's patches and
   eval digest to see *what* edit caused a regression or rejection.

## Diagnosis → action

| Symptom in `history.json` / skill | Likely cause | Action |
|---|---|---|
| Gate rejects almost every update | learning rate too high (noisy edits) | Lower `optimizer.learning_rate` (`--edit_budget`); try `lr_scheduler: cosine` if on `constant`. |
| Val plateaus after epoch 1–2, later epochs flat | converged early | Cut `num_epochs`; skills converge fast. Save the compute. |
| Train/rollout score rises but val doesn't | overfitting to the batch | Shrink `learning_rate` and/or `batch_size`; ensure gate is on. |
| Scores all ~0 or all ~1 | broken `evaluate()` / parsing | Fix the metric before anything else — the optimizer is flying blind. |
| Skill grows long & rambling | edit budget too generous / no pruning pressure | Lower `learning_rate`; the optimizer should delete stale rules, not just add. |
| Regression after an epoch boundary | forgetting | Confirm `use_slow_update: true`; raise `slow_update_samples`. |
| Reflection feels shallow / repeats mistakes | optimizer under-powered or no memory | Use a stronger `optimizer` model; confirm `use_meta_skill: true`; raise `max_analyst_rounds`. |
| 429s / timeouts mid-run | too much parallelism | Lower `gradient.analyst_workers` / `--workers`; raise `env.exec_timeout`. |

## Eval-only
Score a trained skill without training:
```bash
python scripts/eval_only.py \
  --config configs/<name>/default.yaml \
  --skill outputs/<run>/best_skill.md \
  --split valid_unseen \
  --split_dir /path/to/split
```
Splits: `valid_unseen` (test), `valid_seen` (val), `train`, `all`. Verify the
exact `best_skill.md` path — some runs write it at the root, others under
`skills/`.

## WebUI
`pip install -e ".[webui]"` then `python -m skillopt_webui.app` (default
`http://localhost:7860`; `--share` for a public link on remote boxes). Good for
watching the curve live instead of tailing `history.json`.
