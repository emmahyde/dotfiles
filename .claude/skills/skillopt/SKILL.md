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

# SkillOpt — plug-and-play skill optimization

Optimize **any** `skill.md` against **any** deterministic graders with **zero per-skill Python**. The heavy lifting (env adapter, config, splitting, backend wiring) is bundled. You provide a seed skill + a `cases.jsonl`; the real SkillOpt loop does the rest and emits a `best_skill.md`.

## Agent execution contract — be assertive, don't deliberate

When this skill is invoked, **act, don't survey**. The architecture is already built and validated. Default behavior:

1. **Run `scripts/bootstrap.sh` immediately** (idempotent — safe to re-run). Do not ask permission to set up; just set up.
2. **If the user named or pointed at a skill**, treat it as the seed and move to building cases. **If not**, ask exactly one thing: "Which skill.md do you want to optimize?" — nothing else.
3. **Sanity-check the target before spending.** A mature *knowledge* skill on a capable model saturates the gate (→ `best == seed`); the real targets are *procedural* skills or a weaker deployment model. If in doubt, baseline-probe the seed on the real target — seed already ~1.0 → stop. Full decision method + worked NO-GO case studies: `references/choosing-targets.md`.
4. **Build the eval set** (Phase 0 below) — this is the *only* irreducible user input, because the gate is only as good as the cases. Harvest from transcripts if the user has run the task before; otherwise author ≥5 with them, fast.
5. **Run `skilldoc_run.py`** and report the `best_skill.md` path + test score.
6. **Run the Phase 2 audit**, apply fixes, re-score, ship.

Do not stop to debate approaches, re-derive the algorithm, or ask layered clarifying questions. The forks that matter are settled: rollout surface = Claude Code agentic loop (rollout == deployment), optimizer = Claude Opus. Override only if the user says so.

## The whole flow — three commands

```bash
SKILL_DIR=~/.claude/skills/skillopt          # this skill's dir

# 1. One-time setup (clones SkillOpt, wires in the generic `skilldoc` env)
bash $SKILL_DIR/scripts/bootstrap.sh

# 2. Author cases.jsonl (see assets/cases.example.jsonl for the schema)

# 3. Optimize — invokes the real SkillOpt training loop
python3 $SKILL_DIR/assets/skilldoc_run.py \
    --skill path/to/your/skill.md \
    --cases path/to/cases.jsonl \
    --out outputs/my-skill-run
```

`best_skill.md` lands in `--out`. Pass `--dry-run` to see the command first; `--epochs/--batch_size/--workers` to scale; `--target_backend openai_chat` (etc.) to change the surface.

### What bootstrap wires up

- Clones `github.com/microsoft/SkillOpt` → `$SKILLOPT_ROOT` (default `~/.cache/skillopt/SkillOpt`), pip-installs it.
- Copies the bundled generic env → `skillopt/envs/skilldoc/` and config → `configs/skilldoc/default.yaml`, registers `skilldoc` in `train.py`.
- **Per-skill work after this touches zero Python** — only `skill.md` + `cases.jsonl`. That is the definition of done for the plug-and-play layer.

### Credentials (default Claude Code surface)

- **Rollouts** run via the `claude` CLI using your existing Claude Code auth — **no API key needed**.
- **Optimizer/judge** uses `openai_chat` → set `OPENAI_API_KEY`. SkillOpt's backend has no `OPENAI_API_KEY` knob (it reads `AZURE_OPENAI_*`), so `skilldoc_run.py` auto-mirrors `OPENAI_API_KEY` → `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT=https://api.openai.com/v1` + `AZURE_OPENAI_AUTH_MODE=openai_compatible`. Just export `OPENAI_API_KEY` and go.
- Prefer Anthropic for the optimizer instead? Pass `--optimizer_backend claude_chat --optimizer_model claude-opus-4-5` with `ANTHROPIC_API_KEY` set.

## cases.jsonl — the one thing you author

One JSON object per line: a natural task + a **deterministic** grader. See `assets/cases.example.jsonl`. Grader types (in `graders.py`):

| type | use | scores |
| --- | --- | --- |
| `contains_all` / `contains_any` | substring presence | partial credit on `_all` |
| `not_contains` | safety / no-action controls | pass/fail |
| `exact` | exact-match answers | pass/fail |
| `regex_all` | structured output | partial credit |
| `command` | native scorer / file check / compile-run (`{response_file}` → temp file, exit 0 = pass) | pass/fail |
| `all` | composite | mean of sub-scores |

**Design cases so the score lives in (0, 1), not pinned at 1.0.** A skill that already passes every case has zero headroom — the gate can never improve it. Plant cases the *current* skill gets wrong, with **unambiguous** ground truth (borderline truth → verdict wobble → poisoned gate). Prefer several small graders over one broad one; `contains_all` / `regex_all` / `all` give graded `soft` signal so edit deltas stay measurable.

> **Safety — `command` grader runs model output through a shell** (`shell=True`, and the example case `exec()`s the response). Only use `command` graders you wrote and trust; never point one at unreviewed cases. It executes whatever the target produced.

## Baked-in lessons (defaults that bootstrap past known misses)

These were learned the hard way and are now wired into the runner/config so you don't re-hit them — but know they exist:

- **Small suites auto-rebalance the split.** The paper's 2:1:7 assumes a large dataset; on a hand-authored suite (<30 cases) it leaves a 1–2 item selection gate that gives the optimizer no signal (→ best==seed). `skilldoc_run.py` auto-uses **1:1:1** under 30 cases and prints a pre-flight gate-size check. Override with `--split_ratio`. Aim for a **selection gate ≥3 items** (≥9 cases).
- **A run with no *failing* cases spends nothing on edits and proves nothing.** If every train rollout passes, the analyst hits a success-only minibatch → `0 edits`, `calls=0`, `best==seed`. To exercise (and prove) the optimizer, the train split must contain cases the seed gets wrong.
- **`OPENAI_API_KEY` is auto-mapped** to the `AZURE_OPENAI_*` names SkillOpt actually reads — just export it.
- **Re-use before re-train.** Try transferring an existing `best_skill.md` before launching a fresh run.

## Phase 0 — build the eval set (do this, don't skip)

The validation gate and the optimizer are only as good as these cases. Full method: `references/building-evals.md`. Before you spend, confirm the target even has headroom: `references/choosing-targets.md`. The gate of gates is a **baseline probe** — roll the *seed* skill against your cases on the **real target**, no optimizer, and read the mean: ~1.0 → saturated, STOP. Headroom is **not** "procedural vs knowledge"; it's the *default-behavior gap* — a capable target (even Haiku) already knows textbook facts *and* writes idiomatic best-practice code (procedural skills saturate too), so the spend only pays where the behavior is genuinely non-default for that target. Validate graders against **real** outputs (the harness writes artifacts to disk and wraps replies in `<answer>` tags — grade the artifact), scrutinize score *rises* hardest, and get an **independent review** (advisor / Opus) before banking any GO/NO-GO verdict.

- **Ask once:** "Have you run into a task like this in the last ~30 days?"
- **If YES → harvest** real cases from `~/.claude/projects/*` transcripts (use the `search-conversations` tiered approach: cheap `rg` first, `jq` extraction second, model synthesis only if needed). Each real task + known-good result becomes a case (result → grader's expected outcome). Harvest ≥5.
- **If NO → author ≥5 interactively**, one at a time: a natural user-voiced task (never leak grader internals to the target), the input fixture, and ≥1 deterministic grader. Cover the basic path, important options/edges, a no-action control, and resistance to an unsafe instruction.
- The runner auto-splits one `cases.jsonl` **2:1:7** (`split_seed=42`): selection gates edits, **test** is the only split you report. With few cases, raise the val/test share or author more — a 1-item gate is noise.

## How it works (the real mechanism — keep it faithful)

- **Two models, asymmetric roles.** The *target* executes tasks under the current skill and stays **frozen**. A separate *optimizer* (stronger is fine — no deploy cost) proposes edits from rollout evidence.
- **Rollout == deployment surface.** The generic env rolls out through the same harness you deploy into (Claude Code exec by default; `chat_target` for chat backends). This is load-bearing: optimizing against the wrong surface validates edits that may not transfer.
- **Patch-mode edits.** Four atomic ops: `append`, `insert_after`, `replace`, `delete`. Bounded edits preserve good rules.
- **Validation gate.** Each candidate is scored on the selection split with the frozen target+harness; kept only if it strictly improves. Beats best-so-far → becomes `best_skill.md`.
- **Rejected-edit buffer** feeds failures back to later optimizer calls.
- **Slow/meta update** consolidates a protected section at each epoch boundary, still passing the gate.

```
Seed skill.md
  per step:  roll out batch (frozen target) → optimizer reflects → propose
             edits, clip to budget L_t → score on SELECTION split → accept iff
             strictly better, else reject → buffer the failure
  per epoch: slow/meta consolidation
Export: best_skill.md  (static, target-model-only, zero inference-time calls)
```

## Phase 2 — budgeted Opus audit, then ship

The gate guarantees the selection score rose; it does **not** guarantee the artifact is faithful, well-triggered, or anti-pattern-free.

- **Run it:** `bash scripts/audit.sh outputs/my-run` (or pass the `best_skill.md` path). It runs one bounded Opus pass via the `claude` CLI and writes `audit_report.md` — report-only, no edits. Or dispatch an Opus reviewer yourself (Agent tool, `model: opus`). Audit: faithfulness, triggering precision, eval-alignment, no leaked eval internals, shell/safety anti-patterns.
- **Hard gate: max 2 review→fix rounds.** Soft target ~150k tokens. After a round with no FAIL-tier item, STOP.
- Apply fixes, **re-score the patched skill on held-out test** so a hand-fix doesn't silently regress the gate. Ship only what passes both gate and audit.

## Options (paper defaults — set via skilldoc_run.py flags or the config)

| Knob | Default | What it does |
| --- | --- | --- |
| epochs | 2 (paper 4) | Full passes; epoch boundary triggers slow/meta update |
| batch_size | 8 (paper 40) | Tasks rolled out per step |
| learning_rate (`L_t`) | 4 | Max edits/step; keep small — bounded edits are the point |
| lr_scheduler | cosine | explore early, consolidate late |
| skill_update_mode | patch | `patch` or `rewrite` |
| use_gate | on | strict-improvement acceptance on selection |
| split ratio / seed | 2:1:7 / 42 | train : selection : test |

Edit `assets/skilldoc.config.yaml` (re-run bootstrap to sync) for permanent changes; use runner flags for one-offs.

## Effective-results checklist

- Frozen target, strong optimizer — don't conflate roles.
- Rollout harness == deployment harness (default: Claude Code exec).
- Selection gates edits; test reports — keep disjoint, report test only.
- Plant cases with **headroom** and **unambiguous** ground truth.
- Keep edits bounded; lean on the rejected-edit buffer over big rewrites.
- Re-use before re-train: try transferring an existing `best_skill.md` first.

## Maintaining the skilldoc env (contributor notes)

- **`assets/skilldoc/*.py` is the source of truth.** `bootstrap.sh` copies it into the installed package at `$SKILLOPT_ROOT/skillopt/envs/skilldoc/`. After editing the source, re-run `bootstrap.sh` (or `cp` the files) to propagate, and sync the skill to its other homes (`~/.claude/skills/skillopt/` and the marketplace copy). Keep `__pycache__`/`*.pyc` out of the shipped dirs.
- **`skilldoc_run.py` is a standalone launcher — it deliberately does NOT `import skillopt`** (it subprocess-invokes `train.py`, and skillopt may live in a different venv). So its small JSONL-count / split-parse helpers are intentionally local duplicates of `skillopt.datasets.base`; do not "DRY" them into skillopt imports.
- **`adapter.py` mirrors the reference env `skillopt/envs/officeqa/`** (the `build_env_from_batch` indirection, the `getattr(self, "_cfg", {})` read). Keep that shape for consistency with sibling envs rather than refactoring it away.
- **Scoring lives in `rollout.py`'s grader, not in an `evaluate()` method** — `hard` (0/1) is what the gate optimizes, `soft` (0-1) is graded partial credit.

## Provenance

Built from the arXiv paper (primary). The mechanism, loop, and options are from the paper. The real entry point is `scripts/train.py` in `github.com/microsoft/SkillOpt` — the bundled `skilldoc` env and `skilldoc_run.py` wrap it without reimplementing the loop. Do **not** trust the `from skillopt import SkillOptimizer` snippet from blog write-ups — it's not real.
