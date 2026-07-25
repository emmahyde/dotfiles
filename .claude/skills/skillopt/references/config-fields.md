# SkillOpt config fields — annotated for the interview

Ground truth lives in `configs/_base_/default.yaml` and `skillopt/config.py`.
**Always re-read those before recommending** — the table below is the teaching
layer, not the source of truth. Each field lists: default, DL analogy, the
recommendation, and when to deviate.

## `model`
| Field | Default | DL analogy | Recommend / when to deviate |
|---|---|---|---|
| `backend` | `azure_openai` | hardware/runtime | Pick by what creds you have: `azure_openai`, `openai_chat`, `claude_code_exec`, `qwen` (local vLLM). See `backends.md`. |
| `optimizer` | `gpt-5.5` | the trainer | The model that reflects on failures & rewrites the skill. Use the strongest model you can afford here — it's where quality comes from. |
| `target` | `gpt-5.5` | the model being trained's inference engine | Runs rollouts (does the task). Can be cheaper/smaller than optimizer to cut cost. |
| `reasoning_effort` | `medium` | — | `medium` is fine; raise to `high` for hard reasoning tasks. |

Per-role Azure endpoints (`optimizer_azure_openai_*`, `target_azure_openai_*`)
let optimizer and target live on different resources. Only touch these if the two
models are on separate deployments.

## `train`
| Field | Default | DL analogy | Recommend / when to deviate |
|---|---|---|---|
| `num_epochs` | 4 | epochs | 2–4. Skills converge faster than nets; more rarely helps. Use 1–2 for a smoke run. |
| `train_size` | 0 | dataset size | 0 = derive from the split. Set a small number (e.g. 30) to iterate fast. |
| `batch_size` | 40 | batch size | Tasks per step. **Bigger ≠ better** — diminishing returns vs API cost. 10–20 for first run. |
| `accumulation` | 1 | grad accumulation | Leave at 1 unless batches are tiny and you want smoother edits. |
| `seed` | 42 | random seed | Keep fixed for reproducibility. |

## `gradient` (reflection)
| Field | Default | DL analogy | Recommend / when to deviate |
|---|---|---|---|
| `minibatch_size` | 8 | reflect minibatch | Trajectories analyzed per reflection chunk. Default is fine. |
| `merge_batch_size` | 8 | — | How many patches merge at once. Default is fine. |
| `analyst_workers` | 16 | data parallelism | Parallel reflection workers. Raise for throughput if your API rate limits allow; lower if you hit 429s. |
| `max_analyst_rounds` | 3 | — | Depth of reflection. More = thorough but slower/pricier. |
| `failure_only` | false | hard-example mining | `true` reflects only on failed tasks — cheaper, sharper, but ignores near-misses. Try `true` to save cost. |

## `optimizer`
| Field | Default | DL analogy | Recommend / when to deviate |
|---|---|---|---|
| `learning_rate` (CLI `--edit_budget`) | 4 | learning rate / grad clip | Max edit patches applied per step. **Moderate (4–16) wins.** Too few = slow learning; too many = noisy. |
| `min_learning_rate` (CLI `--min_edit_budget`) | 2 | min LR | Floor for decay schedulers. |
| `lr_scheduler` | `cosine` | LR schedule | `cosine` (aggressive early, careful late) > `constant`. Options: `constant` / `linear` / `cosine` / `autonomous`. |
| `lr_control_mode` | `fixed` | — | `fixed` follows the scheduler; `autonomous` lets the optimizer choose its own budget; `none` disables control. Keep `fixed`. |
| `skill_update_mode` | `patch` | how the step is applied | `patch` (surgical edits) is the default and safest. `rewrite_from_suggestions` / `full_rewrite_minibatch` rewrite larger spans — higher variance. |
| `use_slow_update` | true | momentum | Epoch-boundary longitudinal comparison; prevents forgetting. Keep on. |
| `slow_update_samples` | 20 | — | Samples used for the slow-update comparison. |
| `longitudinal_pair_policy` | `mixed` | — | Which items the slow update compares: `mixed` / `changed` / `unchanged`. Keep `mixed`. |
| `use_meta_skill` | true | meta-learning | Cross-epoch optimizer strategy memory. Keep on. |

## `evaluation`
| Field | Default | DL analogy | Recommend / when to deviate |
|---|---|---|---|
| `use_gate` | true | validation-based selection | Accept an update only if val improves. **Keep on** — off ≈ no validation set. |
| `sel_env_num` | 0 | val set size | 0 = derive. Set explicitly to bound selection-eval cost. |
| `test_env_num` | 0 | test set size | 0 = derive. |
| `eval_test` | true | final test pass | Runs held-out test after training. Turn off only to save cost mid-iteration. |

## `env`
| Field | Default | DL analogy | Recommend / when to deviate |
|---|---|---|---|
| `name` | `""` | dataset name | Must match a registered benchmark in `skillopt/envs/__init__.py`. |
| `skill_init` | `""` | transfer learning | Path to a seed skill. Provide one if you have domain knowledge — converges faster. |
| `split_mode` | `ratio` | — | `ratio` (build split from `data_path`) or `split_dir` (use a pre-split dir). |
| `split_ratio` | `"2:1:7"` | train:val:test | Only used in `ratio` mode. |
| `split_seed` | 42 | — | Fix for reproducible splits. |
| `split_dir` / `data_path` | `""` | — | One or the other depending on `split_mode`. |
| `exec_timeout` | 120 | — | Per-task/code-agent timeout (seconds). Raise for slow tools/agents. |
| `out_root` | `""` | checkpoint dir | Where the run writes. Set per experiment. |

## Smoke-run preset (recommend for a first run)
`num_epochs: 1–2`, `batch_size: 10–20`, `train_size: ~30`, `eval_test: false`,
everything else default. Get one clean loop before committing to a full run.
