---
name: skillopt
description: >-
  Run Microsoft SkillOpt to train a skill.md as the external state of a frozen
  agent — a frontier optimizer turns scored rollouts into bounded
  add/delete/replace edits, gated by a held-out validation score, producing one
  reusable best_skill.md. Use when the user mentions SkillOpt, "self-evolving /
  self-improving skill", "optimize a skill.md", "skill-space optimization",
  "validation-gated skill edits", or wants to raise an agent's accuracy by
  training the skill document instead of hand-tuning prompts.
---

# SkillOpt: train skill.md as a frozen agent's external state

SkillOpt (Microsoft + SJTU/Tongji/Fudan, arXiv:2605.23904, May 2026) treats the
**skill document as the trainable state** of a **frozen** target model. A
separate **frontier optimizer model** reads scored rollouts and emits **bounded
add/delete/replace edits** to a single skill.md; an edit is kept **only if it
strictly improves a held-out validation (selection) score**. The output is one
static `best_skill.md` that adds **zero inference-time model calls** at
deployment. Reported: best-or-tied on all 52 (model, benchmark, harness) cells;
on GPT-5.5, +23.5 pts in direct chat, +24.8 in Codex, +19.1 in Claude Code. The
optimized skill transfers across model scales, across Codex↔Claude Code, and to
nearby benchmarks without re-optimizing.

Code: **https://github.com/microsoft/SkillOpt** (`pip install skillopt`). Docs:
`docs/guide/configuration.md`, `docs/guide/new-backend.md`, `docs/reference/cli.md`.

## Default setup — DeepSeek-v4-flash rollout fan-out + Gemini 3.5 Flash judge

This skill is configured to run, by default, with **a ton of cheap
`deepseek-v4-flash` agents doing the rollouts** (the frozen *target*) and
**Gemini 3.5 Flash as the optimizer/judge** (reflection + the model that
proposes and gates edits). DeepSeek is OpenAI-API-compatible, so it rides the
built-in `openai_chat` backend with a custom base URL. Gemini is **not** a
built-in backend, so the judge runs on a one-time `gemini_chat` backend — Gemini
exposes an OpenAI-compatible endpoint, so it's a copy of the `minimax` template
(≈15 lines). Keeping the judge on its own backend avoids any `OPENAI_*` key
collision with the DeepSeek target. See `references/deepseek-flash-default.md`
for the copy-paste registration.

```bash
# 1. Credentials (.env)
export OPENAI_API_KEY="<your DeepSeek API key>"      # openai_chat → DeepSeek
export OPENAI_BASE_URL="https://api.deepseek.com/v1"
export GEMINI_API_KEY="<your Google AI Studio key>"  # gemini_chat judge
export GEMINI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"

# 2. Register the gemini_chat backend once (see references/), then:
# 3. One-shot default run (or use scripts/run-skillopt-default.sh)
python scripts/train.py \
    --config configs/searchqa/default.yaml \
    --target_backend openai_chat \
    --target_model deepseek-v4-flash \
    --optimizer_backend gemini_chat \
    --optimizer_model gemini-3.5-flash \
    --workers 64 \
    --batch_size 64 \
    --num_epochs 4 \
    --out_root outputs/deepseek-flash-run
```

> The `openai_chat` backend reads `OPENAI_BASE_URL` (set above) to reach DeepSeek
> — no base-url flag needed. If your repo build exposes a per-role
> `--target_openai_chat_base_url` (the README documents this pattern only for
> `qwen_chat`), it can override the env var; confirm with
> `python scripts/train.py --help` before relying on it. **Model ids
> (`deepseek-v4-flash`, `gemini-3.5-flash`) change at release — verify the exact
> strings on your DeepSeek / Google AI Studio accounts.**

- **"A ton of agents"** = `--workers` (parallel rollout workers) × `--batch_size`
  (tasks rolled out per step). DeepSeek-flash is cheap and fast, so push these
  high (64–128) for wide parallel exploration; cost stays low because only the
  rollouts use it.
- **Judge = Gemini 3.5 Flash** = `--optimizer_backend gemini_chat
  --optimizer_model gemini-3.5-flash`. The optimizer/judge analyzes
  trajectories, proposes add/delete/replace edits, and the validation gate
  accepts only score-improving ones. It runs **only during training** — the
  deployed `best_skill.md` calls neither model, just whatever target you ship on.
  Gemini Flash is cheap too, so even the judge stays inexpensive; swap to a
  frontier optimizer (`gpt-5.5`, Claude Sonnet) if you want stronger edits.
- Replace `gemini-3.5-flash` / `deepseek-v4-flash` with the exact model names
  your accounts expose. See `references/deepseek-flash-default.md` for the
  `gemini_chat` registration, the dedicated-`deepseek_chat` path, and cost/worker
  tuning.

## Provenance — what's grounded vs. what to verify

This skill is built from the **arXiv paper** (primary source). Everything in
"How it works," "The loop," and the options table is from the paper and is
accurate. **Do not trust the `from skillopt import SkillOptimizer` /
`optimizer.optimize(...)` snippet circulating in blog write-ups** — that API is
illustrative and not in the paper. For the real entry point and flag names,
read the README at `github.com/microsoft/SkillOpt`; map the paper's
hyperparameters (below) to whatever the repo exposes.

## How it works (the real mechanism)

- **Two models, asymmetric roles.** The *target* model executes tasks with the
  current skill and stays frozen. A separate *optimizer* model (ideally stronger
  — optimizer strength is a training-time lever with no deploy cost) proposes
  skill edits from rollout evidence.
- **Patch-mode edits.** Each update is restricted to four atomic ops: `append`,
  `insert_after`, `replace`, `delete`. (A `rewrite` mode also exists.) Bounded
  edits preserve good rules instead of clobbering the doc.
- **Validation gate.** Every candidate skill is scored on the selection split
  with the same frozen target+harness. It's accepted only if it beats the
  current selection score; if it also beats the best-so-far it becomes
  `best_skill.md`. Otherwise rejected. This turns reflection into
  propose-and-test, not unconditional self-editing.
- **Rejected-edit buffer.** Rejected edits + the score drops they caused are
  kept in an epoch-local buffer and fed to later optimizer calls, so the loop
  gets negative feedback without any inference-time cost.
- **Slow/meta update.** At each epoch boundary a protected section (delimited
  `SLOW_UPDATE_START`/`SLOW_UPDATE_END`, off-limits to step-level edits) is
  consolidated from a longitudinal comparison of the same sampled tasks under
  the old vs. new skill — then still passes the same validation gate.

## The loop

```
Seed skill.md  (or start empty)
┌──────────────────────────────────────────────┐
│ per step:                                     │
│  1. Roll out a batch of training tasks        │
│     with the current skill (frozen target)    │
│  2. Optimizer analyzes successes/failures     │
│     over reflection minibatches               │
│  3. Propose add/delete/replace edits;         │
│     merge duplicates, rank by utility,        │
│     clip to the edit budget L_t               │
│  4. Score candidate on the SELECTION split    │
│  5. Accept iff it strictly improves; else     │
│     reject → buffer the failure               │
│ per epoch: slow/meta consolidation            │
└──────────────────────────────────────────────┘
Export: best_skill.md  (static, target-model-only)
```

There is no turn-by-turn interactive wizard — SkillOpt is an **offline training
loop**. You steer it entirely through the data splits, the eval/scorer, and the
hyperparameters below, then let it run the epochs.

## Phase 0 — Establish the eval set (run BEFORE any optimization)

SkillOpt's validation gate, and the Gemini judge that proposes edits, are only as
good as the evals you score against. Do not skip to training. First build a set
of deterministic eval cases the judge can test on. Full method:
`references/building-evals.md` (folds in the skill-optimizer-evals workbench:
case = natural task + deterministic graders).

**Step 0a — Ask the user about prior experience.** Ask, verbatim intent:

> "Have you run into a task like this in the last ~30 days?"

**Step 0b — If YES → harvest real cases from past transcripts.** Search across
`~/.claude/projects/*` session transcripts (and the tool outputs inside them) for
those prior occurrences, and turn each real task + its known-good result into an
eval case (the result becomes the grader's expected outcome). Search
**conservatively** — use the tiered approach from the `search-conversations`
skill (cheap `rg`/`grep` first, structured `jq` extraction second, model
synthesis only when needed) so you never read raw `.jsonl` wholesale. A starting
sweep:

```bash
# 1. Find candidate sessions by keyword (cheap, filenames + line hits only)
rg -l -i '<task keyword>' ~/.claude/projects/*/*.jsonl
# 2. Extract just the user turns + tool results from a hit, structured
jq -rc 'select(.type=="user" or .type=="tool_result")' <session>.jsonl | rg -i '<keyword>'
```

Harvest ≥5 real cases this way; each becomes one eval case + grader.

**Step 0c — If NO → author at least 5 evals interactively.** Walk the user
through writing ≥5 cases, one at a time. For each, capture: (1) a natural,
user-voiced task (never mention graders/answers/eval internals), (2) the concrete
input fixture, and (3) one or more **deterministic** graders (exact-match / file
checks / native benchmark scorer) that exit non-zero on failure. Cover the task's
real surface: the basic path, the important options/edge cases, a no-action
control, and resistance to an unsafe instruction. Prefer several small graders
over one broad one.

**Step 0d — Split the cases.** Partition the harvested/authored cases into
train / selection / test (SkillOpt default ratio 2:1:7, `split_seed=42`). The
**selection** split is what the Gemini judge gates edits on; the **test** split
is held out for the only numbers you report. Then proceed to Quick start.

## Quick start (fastest path to a result)

1. **Define one task + one scorer.** Use the benchmark's native evaluator (hard
   success / exact-match). The gate optimizes whatever this returns.
2. **Make deterministic train/selection/test splits.** Paper default ratio
   **2:1:7** with `split_seed=42`. Selection is used *only* to accept/reject
   edits; all headline numbers come from the disjoint held-out test split — so
   you measure generalization, not validation-set fit.
3. **Models are pre-wired** (see Default setup): target = `deepseek-v4-flash`
   (many parallel rollout agents), optimizer/judge = `gemini-3.5-flash`. Set the
   two API keys and register the `gemini_chat` backend once.
4. **Run** `scripts/run-skillopt-default.sh <config> <split_dir>` (or the explicit
   command above), then read scores on the **test** split.
5. **Verify, then deploy `best_skill.md`** — run Phase 2 (budgeted Opus audit)
   first; the artifact is static and calls neither the DeepSeek target nor the
   Gemini judge at inference time.

## Phase 2 — Opus quality verification (budgeted), then fix

The validation gate guarantees the edits raised the selection score; it does NOT
guarantee the resulting `best_skill.md` is faithful, well-triggered, or free of
anti-patterns. Before deploying, run a **budgeted Opus audit** and address what it
finds. This is a final human-grade acceptance check on the artifact, complementary
to the automated gate.

**Run it.** Dispatch an Opus reviewer (Agent tool, `model: opus`) over the
produced `best_skill.md` (and any references it ships). Audit dimensions:
faithfulness to the task, triggering precision, deterministic-eval alignment, no
instructions that leak eval internals to the target, and shell/safety
anti-patterns. Ask for a verdict table + prioritized findings, each with
file-level evidence and a concrete fix. **Report only — the auditor does not edit.**

**Budget it.** Bound the audit so it can't run away. The token figure is a
*soft* target you pass to the reviewer (it self-limits, best-effort); the
**round count is the hard gate the workflow actually enforces**:

- **Hard gate — max 2 review→fix rounds.** One audit pass + one fix pass is the
  default. After each round, if no FAIL-tier item remains, STOP — never start a
  third pass. This is the real cap.
- **Soft target — ~150k tokens** (`MAX_AUDIT_BUDGET`). Tell the reviewer to keep
  the audit to a single bounded pass within this and not to loop.
- If the round limit is reached with open CONCERN-tier items, ship with them
  logged in the run's `out_root` rather than spending another round.

**Address issues.** Apply the auditor's fixes to `best_skill.md` (or feed them
back as a seed for one more SkillOpt step). Then **re-score the patched skill on
the held-out test split** so a hand-fix doesn't silently regress the gate. Only a
skill that passes both the gate and the budgeted audit gets deployed.

## Options (paper defaults — map to the repo's actual flags)

| Knob | Default | What it does |
| --- | --- | --- |
| epochs | 4 | Full passes; epoch boundary triggers slow/meta update |
| rollout batch size | 40 | Tasks rolled out per step to gather evidence |
| reflection minibatch | 8 | Failed/successful trajectories per analyst reflection (16 analyst workers in parallel, merge batch 8) |
| textual learning rate (edit budget `L_t`) | 4 | Max edits applied per step; ranked pool is clipped to top-`L_t` |
| LR schedule | cosine (min 2) | `constant` / `linear` / `cosine` / `autonomous`; cosine starts large, decays to small consolidation steps |
| edit mode | patch | `patch` (append/insert_after/replace/delete) or `rewrite` (full skill rewrite) |
| validation gating | on | Strict-improvement acceptance on the selection split |
| slow update | on, 20 samples | Epoch-boundary consolidation of the protected `SLOW_UPDATE` section |
| optimizer-side meta skill | on | Optimizer keeps its own meta guidance across epochs |
| split ratio / seed | 2:1:7, seed 42 | train : selection : test partition |

### How to set them

- **Optimizer model (judge)**: default `gemini-3.5-flash` — cheap, and it runs
  only during training, so it raises skill quality for free at inference. Bump to
  a frontier optimizer (`gpt-5.5`, Claude Sonnet) for stronger edits if budget
  allows.
- **Target / rollout fan-out**: default `deepseek-v4-flash` with high `--workers`
  and `--batch_size`. It's the model under optimization and the one you'll
  realistically deploy; keeping it cheap is the whole economic point.
- **Edit budget (`L_t`)**: keep it small. Bounded edits are the whole point;
  large budgets erase useful rules and overfit local failures.
- **Schedule**: cosine is a safe default (explore early, consolidate late).
- **Splits**: never report on the selection split; only `best_skill.md` chosen by
  the gate, scored on held-out test, is a real number.
- **Epochs/batch**: 4 epochs × batch 40 is the paper's standard; scale down for a
  toy validation run before spending budget on production data.

## Effective-results checklist

- Frozen target, strong optimizer — don't conflate the two roles.
- Native evaluator as the scorer; a weak scorer yields a weak skill.
- Selection split gates edits; test split reports results — keep them disjoint.
- Trust the gate: plausible textual "diagnoses" can still hurt the target, which
  is exactly why every edit must beat held-out validation before it's kept.
- Keep edits bounded; lean on the rejected-edit buffer instead of bigger rewrites.
- Re-use before re-train: try transferring an existing `best_skill.md` across
  model/harness/benchmark before launching a fresh run.
- For the real invocation, read the README at `github.com/microsoft/SkillOpt` and
  translate these knobs to its flags.
