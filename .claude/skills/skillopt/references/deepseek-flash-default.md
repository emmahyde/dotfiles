# Default models: DeepSeek-v4-flash rollout fan-out + Gemini 3.5 Flash judge

This skill defaults to a **cheap-target / cheap-but-capable-judge** split, the
economic model SkillOpt is built for: the optimizer/judge runs only during
offline training, and the deployed `best_skill.md` calls only the cheap target.

- **Target (rollout fan-out):** `deepseek-v4-flash`, many parallel agents — rides
  the built-in `openai_chat` backend (OpenAI-compatible) with a custom base URL.
- **Optimizer (judge):** `gemini-3.5-flash` — analyzes trajectories, proposes
  add/delete/replace edits, gates them on the held-out selection split. Runs on a
  one-time `gemini_chat` backend (not built in).

Roles map to SkillOpt's two-model design: the *target* is frozen and executes
tasks; the *optimizer* never runs at deployment.

## Why the judge needs its own backend

Each provider backend reads its own namespaced env (e.g.
`MINIMAX_API_KEY`/`MINIMAX_BASE_URL`, `QWEN_CHAT_BASE_URL`). The DeepSeek target
already occupies the generic `openai_chat` slot via `OPENAI_API_KEY` /
`OPENAI_BASE_URL`. If the Gemini judge also used `openai_chat`, the two roles
would fight over the same `OPENAI_API_KEY`. Giving Gemini a dedicated
`gemini_chat` backend keeps the keys cleanly separated.

## Step 1 — register the `gemini_chat` backend (one time)

Gemini exposes an OpenAI-compatible endpoint, so it's a copy of the `minimax`
backend (OpenAI-compatible, API-key based). Per `docs/guide/new-backend.md`:

1. Find the minimax backend to copy — don't assume the filename:
   `ls skillopt/model/ | grep -i minimax` (it may be `minimax_backend.py` or
   `minimax_chat_backend.py`). Copy it to a new `gemini` module; keep the async
   OpenAI-compatible client, set the default base URL to
   `https://generativelanguage.googleapis.com/v1beta/openai/`, and read
   `GEMINI_API_KEY` / `GEMINI_BASE_URL` / `GEMINI_MODEL`. Confirm the base-class
   signatures in `skillopt/model/base.py` (`ModelBackend`, `ModelResponse`;
   `async` throughout) before copying.
2. Register it under the name `gemini_chat`. Locate the registry rather than
   guessing the file: `grep -rn "BACKEND_REGISTRY\|minimax_chat" skillopt/model/`
   — add your `gemini_chat → GeminiBackend` entry everywhere `minimax_chat` is
   referenced (registry dict plus any router in `skillopt/model/__init__.py`).
3. Add `GEMINI_API_KEY` / `GEMINI_BASE_URL` / `GEMINI_MODEL` to `.env.example`.
4. Smoke-test the import (use your actual module name): e.g.
   `python -c "from skillopt.model.gemini_chat_backend import GeminiBackend"`.

## Step 2 — credentials + run

```bash
# .env
export OPENAI_API_KEY="sk-..."            # = your DeepSeek key (rollout target)
export OPENAI_BASE_URL="https://api.deepseek.com/v1"
export GEMINI_API_KEY="..."               # Gemini 3.5 Flash judge
export GEMINI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"

# wrapper bakes all the flags
scripts/run-skillopt-default.sh configs/searchqa/default.yaml data/my_split

# or explicitly
python scripts/train.py \
    --config configs/searchqa/default.yaml \
    --target_backend openai_chat \
    --target_model deepseek-v4-flash \
    --optimizer_backend gemini_chat \
    --optimizer_model gemini-3.5-flash \
    --workers 64 --batch_size 64 --num_epochs 4 \
    --out_root outputs/deepseek-flash-run
```

(DeepSeek base URL reaches `openai_chat` via `OPENAI_BASE_URL`; no base-url flag
is passed since only `qwen_chat` documents one. `--batch_size 64` is a wider
default than the paper's 40 — use 40 for paper-equivalent runs. Model ids change
at release; verify them on your accounts.)

## Alternatives for the judge

- **No-code shortcut (fragile):** point `openai_chat` at Gemini for the judge via
  `--optimizer_openai_chat_base_url`. Only works if the repo also exposes a
  per-role API-key override; otherwise the Gemini and DeepSeek keys collide on
  `OPENAI_API_KEY`. Prefer the dedicated backend above.
- **Stronger judge:** Claude Sonnet (`claude_chat`, built in — needs
  `ANTHROPIC_API_KEY`) or `gpt-5.5`. Better edits, higher training-time cost,
  zero deployment cost. Swap `--optimizer_backend`/`--optimizer_model`.

## Tuning the fan-out ("a ton of agents")

| Knob | Meaning | Default here | Push to |
| --- | --- | --- | --- |
| `--workers` | parallel rollout workers (concurrent DeepSeek calls) | 64 | 128+ if your DeepSeek rate limit allows |
| `--batch_size` | tasks rolled out per optimization step | 64 | 40–128; bigger = stronger gradient signal, more cost/step |
| `gradient.analyst_workers` | parallel reflection workers (these are **judge** calls — Gemini) | 16 | keep modest; judge calls dominate optimizer cost |
| `gradient.minibatch_size` | trajectories per reflection | 8 | 8 default |

The `gradient.*` YAML keys above are the paper's parameter names; confirm the
exact config path before overriding with
`grep -rn "analyst_workers\|minibatch_size" skillopt/ configs/`.

Cost intuition: rollouts scale with `workers × batch_size × epochs` on cheap
DeepSeek; judge cost scales with reflection rounds × `analyst_workers` on Gemini
Flash (also cheap). Crank the rollouts, keep reflection lean. On DeepSeek 429s,
lower `--workers` first.
