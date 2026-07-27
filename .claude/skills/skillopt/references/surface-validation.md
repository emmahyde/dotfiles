# Surface validation — diagnose an all-zero baseline before you trust or abandon it

The rollout *surface* (the harness that runs the skill + grades it) can read `0.000` for reasons that have nothing to do with the skill's quality. Every prior SkillOpt run on a real skill read `0.000`, and the first GO (`/search-web`, test `0.000 → 0.667`, 2026-06-07) came **only** after fixing the surface — not the skill. This reference is the pre-flight that tells a *broken surface* apart from a *real gate* apart from a *too-hard target*, using the real artifacts that fooled us.

## The cheap-test ladder — never skip a rung

Each rung answers a different question and costs ~10× the previous one. Rung 1 is a **read**, not a score.

| Rung | What | Cost | Question it answers |
| --- | --- | --- | --- |
| 1 | One-case rollout, then **read the work-dir + raw response** | ~1 rollout | Does the surface even work? (tools present, scripts linked, output not harness-mangled) |
| 2 | Baseline probe — `--epochs 0` runs the seed on the **selection split** and skips every optimizer step (the `[baseline result] selection hard=…` line) | selection-split rollouts | Is there headroom? (~1.0 → saturated, STOP) |
| 3 | Full training run | epochs × batch | Will it actually climb? (`calls>0`, `accept≥1`) |

The session's entire waste reduces to one sentence: **one-case rollout + read the work-dir, before the probe, before any epoch.** Everything else was downstream of skipping rung 1's *read*.

## The three surface mismatches — real signatures

All three are fixed in the bundled stack; these are the tells if a *new* surface regresses.

### 1. The `<answer>` wrapper defeats a bare-output grader

`codex_harness.py` instructs every agent to wrap its final message in `<answer>...</answer>` (built for `<answer>C</answer>` multiple-choice QA). A skill whose contract is a bare line can never match:

```
# what the grader regex wanted (bare absolute path):
^/[^\n]+corpus-summary\.md\s*$
# what the harness actually produced:
<answer>/tmp/sw-probe/.../corpus-summary.md</answer>
```

The response starts with `<answer>`, not `/` → `hard=0` on **every** case. **Structurally un-winnable: no skill edit removes the wrapper.** Fix: `rollout.py:_unwrap_answer_envelope()` strips a sole enclosing envelope before grading (deployment has no such tags). **Signature:** baseline `0.000` everywhere, but saved responses are *correct answers* wrapped in `<answer>…</answer>`.

### 2. The sandbox starves the agent → it fabricates

Default tools were `Read,Bash`. A research skill needing `WebSearch`/`Write` got a starved agent that **invented** plausible URLs from training data instead of fetching:

```
# sw-5 "passed" a contains check, but the work-dir told the truth:
$ ls /tmp/sw-probe/predictions/sw-5-file-exists-deep/exec/
task.md   .agents/        # no pages/ — nothing was ever fetched
```

Fix: `rollout.py` defaults to a generous superset (`Read,Write,Edit,Bash,Grep,Glob,WebSearch`); override with `--allowed_tools` (sets `SKILLOPT_ALLOWED_TOOLS`). **Never** edit bundled Python per skill. **Signature:** a "passing" artifact with no supporting work-dir evidence — the disk is the tell.

### 3. The skill's `scripts/` aren't in the workspace

A skill that shells out to `scripts/foo.py` won't find it. Fix: `skilldoc_run.py` exports `SKILLOPT_SKILL_SCRIPTS_DIR` (the seed's sibling `scripts/`) and `rollout.py` symlinks it into each workspace.

## The all-zero decision tree — read the saved responses

A `0.000` baseline is **ambiguous**. Open `predictions/<id>/result.json` (and the `exec/` work-dir) for a few cases and classify:

```
Read a saved response + its work-dir:
├─ Correct answer, but wrapped / no work-dir evidence / "script not found"
│     → (a) BROKEN SURFACE — un-winnable as-is. Fix the harness, re-probe. NOT no-headroom.
├─ On-task and real work done, but violates the output contract
│     (e.g. summarized the answer instead of returning the path)
│     → (b) TRUE GATE WITH FIXABLE GAP — winnable IF the failures share one root cause
│       an edit can fix. This is what /search-web was.
└─ Off-task / wrong substance even with full tools
      → (c) GENUINELY TOO HARD — NO-GO is the correct, cheap answer.
```

Only (b) is worth a training run. (a) needs a harness fix first; (c) should stop.

## Re-grade for free — and the boundary

After a **grader or post-processing change** (a `command`-grader fix, the `<answer>` unwrap, any transform on the *already-saved* response), replay `results.jsonl`/`predictions/` through the new grader at **zero rollout cost**. This confirmed `/search-web`'s corrected ~0.29 baseline before spending on a real run.

It is **invalid** for anything that changes what the agent *does* — `allowed_tools`, skill content, the rollout prompt — because the response itself would differ. Those need a **fresh rollout**. Re-grading after a surface/skill change ships a phantom number.

A standalone re-score must `set_target_backend("claude_code_exec")` first; otherwise the module global defaults to `openai_chat` and you get `soft=0.00` + empty `response` + an Azure-endpoint `fail_reason` — a config bug, not a regression (a real regression keeps non-zero `soft`).
