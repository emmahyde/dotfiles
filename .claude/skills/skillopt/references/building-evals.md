# Building the eval set for the SkillOpt judge

SkillOpt trains a skill against an eval set: the target rolls out tasks, the
Gemini judge proposes edits, and a **validation gate accepts an edit only if it
improves the held-out selection score**. Garbage evals → a confidently wrong
skill. This is Phase 0 and it is not optional.

The model below is the skill-optimizer-evals workbench applied to SkillOpt:

- **Case** = one natural, user-voiced task + one or more **deterministic**
  graders. The agent (target) sees only the task and its input fixture — never
  the graders, expected answers, or any eval internals.
- **Grader** = a command run after the rollout with the case dir and the agent's
  workspace mounted; it exits non-zero to fail the case. Prefer several small
  deterministic graders over one broad subjective one.
- The **set of cases** is what you split into train/selection/test for SkillOpt.

## Decision: harvest vs. author

Ask the user: *"Have you run into a task like this in the last ~30 days?"*

### YES → harvest real cases from `~/.claude/projects/*`

Real past tasks are the best evals: the input is authentic and the known-good
result is a ready-made grader target. Search **conservatively** (tiered, per the
`search-conversations` skill) so you never load raw `.jsonl` into context:

1. **Locate** candidate sessions cheaply — filenames + line hits only:
   ```bash
   rg -l -i '<task keyword>' ~/.claude/projects/*/*.jsonl
   ```
2. **Extract** only the relevant turns and tool outputs, structured:
   ```bash
   jq -rc 'select(.type=="user" or .type=="tool_result")' <session>.jsonl \
     | rg -i '<keyword>'
   ```
3. **Synthesize** a case from each hit: the user's request → the case `task`;
   the verified output / tool result → the grader's expected outcome. Pull the
   real input fixture (file, payload, command) into the case so the rollout
   reproduces the original conditions.
4. Repeat until you have **≥5** real cases spanning the variety you saw.

Tool outputs matter: a prior `Bash`/`tool_result` that showed the correct
artifact is exactly what the grader should assert against.

### NO → author ≥5 evals interactively, one at a time

Walk the user through each case. For every one, capture:

1. **Task** — natural and user-voiced. Never mention graders, hidden answers,
   `/case`, splits, or "eval." Write what a real user would type.
2. **Input fixture** — the concrete file/data/command the task operates on.
3. **Grader(s)** — deterministic checks that exit non-zero on failure
   (exact-match, JSON field checks, file existence/content, or the benchmark's
   native scorer). Keep each grader narrow.

Cover the task's real surface across the 5+:

- **Basic path** — the core thing the skill must do.
- **Important options / edge cases** — flags, formats, boundary inputs.
- **No-action control** — a prompt where the correct behavior is to do nothing /
  refuse to fabricate, so the skill isn't rewarded for always acting.
- **Unsafe-instruction resistance** — a prompt nudging an unsafe action; the
  grader passes only if the skill declines.

## Split for SkillOpt

Partition all harvested/authored cases into **train : selection : test**, default
**2:1:7** with `split_seed=42`:

- **train** — rolled out each step to generate edit evidence.
- **selection** — the gate. The Gemini judge's edits are accepted only if they
  raise this score. Never report selection numbers.
- **test** — held out; the only scores you quote, measuring generalization.

With a small hand-authored set (≥5), weight toward selection+test so the gate and
the reported result are both trustworthy; expand train as you harvest more.

## Graders must *teach*, not just judge — failure detail is the optimizer's gradient

This is load-bearing and easy to miss. The optimizer never sees your grader code or the raw score alone — it sees the grader's **`detail` string**, surfaced as `Failure reason:` in the reflection prompt (`reflect.py`). A grader that returns a bare pass/fail gives the optimizer **nothing to act on**: it knows the rollout scored 0 but not *what was wrong*, so it can't propose the edit that fixes it, and the skill can't climb. The detail string is literally the gradient SkillOpt descends.

So author every grader to emit an **actionable, prescriptive** failure message — name what was missing and what the skill should say to fix it:

- **`command` graders:** the last ~400 chars of your check script's **stdout+stderr** become `detail` (prefixed `exit=<code> ::`). On failure, *print the reason*: not `check failed`, but `FAIL no-set-e: script uses 'set -e'; the skill must mandate explicit error handling instead`. Write it as if instructing the skill author — because that text is what the optimizer reads to rewrite the skill.
- **`contains_all` / `regex_all`:** already report which expected substrings/patterns were missing — keep `expect` items specific so the miss is legible.
- **`all` composite:** preserves each sub-grader's detail with its soft score (`[0.00] FAIL …`), so a continuous composite of detail-emitting sub-checks gives the optimizer both a gradient *and* a per-rule diagnosis. This is the preferred shape.

A grader that judges silently is why a conceptually-fittable skill can still flatline at `best == seed`: there was headroom, but the optimizer was never told where.

## Quality bar (mirror these into the graders)

- Deterministic over subjective — a grader must give the same verdict every run.
- **Actionable detail on failure** — see above; the `detail` string is the optimizer's only feedback channel.
- Prefer the **real** CLI/API/scorer. Mock only when the mock exactly matches the
  real command surface, validation, outputs, and failure modes — else you
  optimize the skill against the mock, not reality.
- Inspect `trace.jsonl` (what the target saw/said/did) when a case fails
  unexpectedly before blaming the skill or the judge.
