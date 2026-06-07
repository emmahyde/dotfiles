# Choosing a target — what makes a skill worth optimizing

`building-evals.md` tells you *how* to build the eval set. This tells you *which skills are worth the spend* — and how to prove it cheaply before you pay for an optimizer run. Read this first; a bad target wastes hundreds of subagent calls confirming `best == seed`.

The single rule: **SkillOpt only pays off where the frozen target genuinely fails without the skill.** The strict-improvement gate can only climb if there is something to climb from. No headroom → no edits accepted → `best_skill.md == seed`, no matter how good your cases are.

## The two questions that decide it

**1. Is the headroom in the *text*, or in a frozen model the optimizer can't touch?**

SkillOpt edits the skill document. It cannot make the frozen target (or any frozen subagent the skill spawns) a better reasoner. If the skill's real judgment lives in frozen sub-models, editing the orchestration text around them can't move the score.

**2. Does a capable target already produce this behavior without the skill?**

The real axis is the **default-behavior gap**, and it is **not** "knowledge vs procedural." A capable modern target — even a small one like Haiku — already knows textbook content, embodies good-judgment frameworks, *and* writes idiomatic best-practice code. Mature *knowledge* skills saturate because the model has the facts. But **procedural skills saturate too** whenever the conventions they teach are mainstream practice the model already emits unprompted — see the bash case study below, where Haiku produced `main()`+guard, `usage()`, dep-checks, and stderr/exit discipline for a "production-grade" script with no skill at all (even the counterintuitive "no `set -e`" rule). Headroom survives only where the behavior is genuinely **non-default for this target**.

| Target type | Headroom? | Why |
| --- | --- | --- |
| **Non-default behavior** — project/org-specific conventions, counterintuitive rules the model resists, niche tool/format | **Yes — the real target** | The target doesn't do this on its own; the doc is where it learns it |
| **Weaker/cheaper deployment target** you actually ship (e.g. haiku in prod) | **Yes** | A small model genuinely fails tasks a doc can scaffold |
| **Mainstream procedural** skill — best-practice conventions a capable model already emits (idiomatic code, standard CLI shape) | **No — saturates** | "Procedural" ≠ headroom; if the model already does it unprompted, the doc can't lift it |
| Mature **knowledge** skill on a capable target (algos, metzify, cleancode, audit-against) | **No — saturates** | The frozen model already knows the content |
| Skill whose judgment lives in **frozen subagents** (councils, expert panels) | **No** | The optimizer edits text, not the frozen judges |

## Prove it before you spend — the baseline probe is non-negotiable

Before any optimizer run, roll the **seed** skill against your cases on the **real target** and look at the score. This is cheap (no optimizer calls) and it is the only thing that reliably exposes saturation *and* grader bugs.

- **Seed already scores ~1.0 → STOP.** No headroom. `best == seed` is guaranteed; an optimizer run just confirms it expensively.
- **Seed lands in (0, 1) with cases the seed clearly fails → GO.** That gap is exactly what the gate climbs.

> **Validate graders against REAL model outputs, not your hand-authored ideals.** Offline grader checks pass against answers written in *your* notation; the real model writes `O(V·E)`, unicode superscripts, terse phrasings your regexes miss — suppressing the score and nearly masking saturation. The probe against the real target is the only check that catches both. [[skillopt-algos-evalsuite]]
>
> **The deploy harness mutates output — grade the real artifact, not the raw response.** The Claude Code exec target has shell access, so it often *writes the script/file to disk* and returns only a prose pointer; it also wraps inline replies in `<answer>…</answer>` tags. Both silently misgrade text-matching graders. A real bash baseline read **0.50** on the raw response vs **0.96** once graded on the artifact the agent actually produced. Inspect saved responses **and** the work dir, not just the aggregate. [[skillopt-bash-evalsuite]]
>
> **Meta-rule — scrutinize score *rises* hardest.** When you iteratively fix graders, the fixes that move the score *toward your hypothesis* deserve the most suspicion. Validate false-**highs** as hard as false-lows: eyeball at least one case that scored ~1.0 and confirm it genuinely meets every convention, and check whether the task prompt itself *named* the thing you're grading (prompt leakage inflates "does it by default" into "was told to").

## Worked case studies (real runs, real verdicts)

### NO-GO — `/algos` (knowledge skill, saturates)

A 15-case suite, careful composite graders, the full plug-and-play harness — and the baseline probe still read a **true mean of 0.964** (the raw 0.856 was a grader-notation artifact; re-grading saved responses with no API spend gave 0.964). 12 of 14 cases fully solved by frozen haiku; the only partials were terseness, not knowledge gaps. A capable frozen target already embodies what a mature knowledge-skill encodes → saturation → nothing for the gate to climb. [[skillopt-algos-evalsuite]]

### NO-GO — `/audit-against` (judgment lives in frozen subagents)

The injection path was fully de-risked: the council reliably fanned out, read the reference skill, and emitted a gradeable scorecard with zero errors across 5+ runs. But the score **saturated** (location-recall reliably 1.0 on planted violations). Two compounding reasons: (1) the seed was a faithful flatten of an already-mature SKILL.md — a polished seed saturates regardless of case quality, because SkillOpt's gains come from climbing from a *weak* seed; (2) the actual judgment lives in the **frozen** sonnet experts, not the trainable orchestration text — the optimizer edits text, it cannot make sonnet a better judge. [[skillopt-auditagainst-gate]]

### NO-GO — `/claude-skill-bash` (procedural skill that *still* saturated)

The deliberate test of "procedural skills have headroom" — and it failed. A 12-case suite (production-grade script tasks, composite structural + `bash -n` graders) probed against frozen Haiku. Restricting to the **skill-only** conventions *no task prompt mentioned* (`main()`+guard, `usage()`, stderr, explicit exit codes, no `set -e`), the no-skill baseline read **0.956** — Haiku writes the skill's entire doctrine unprompted, including the counterintuitive "no `set -e`" rule. Procedural is *not* automatically a good target; what matters is whether *this* target already does the behavior by default. This case also produced the sharpest grader lessons (artifact-on-disk + `<answer>` wrapper + prompt-leakage; raw 0.50 → true 0.96) — see the probe section above. [[skillopt-bash-evalsuite]]

### The escape hatch — manufacture headroom with a deliberately weak seed

When a skill is conceptually a good fit but its seed is already polished, you can still create a climbable curve: start from a **deliberately weak seed** (e.g. a bare "grade this against the skill") and set the gold answers to the polished skill's known-correct verdicts. Now the optimizer has somewhere to climb to. The catch: this only works if the **frozen target genuinely fails without the guidance**. If the target produces the behavior unprompted (the bash case — Haiku writes compliant scripts from an empty seed), even a bare seed saturates and there is still nothing to climb. A weak seed lowers the *floor*; it can't create a gap the target doesn't actually have. [[skillopt-auditagainst-gate]]

## Then: design cases with headroom (recap)

Once the target clears the two questions above, the cases still have to preserve the headroom — full method in `building-evals.md`:

- Plant cases the **current** skill gets wrong, with **unambiguous** ground truth (borderline truth → verdict wobble → poisoned gate).
- Keep the score in **(0, 1)**, not pinned at 1.0 — use `contains_all` / `regex_all` / `all` graders for graded `soft` signal so edit deltas stay measurable.
- A train split with **no failing cases** spends nothing and proves nothing (success-only minibatch → `calls=0`, `best == seed`).
- Aim for a **selection gate ≥3 items** (≥9 cases); the runner auto-rebalances small suites to 1:1:1, but a thin gate is still noise.

## Get an independent review at the GO/NO-GO commit point

The probe gives you a number; deciding what it *means* is where the expensive mistakes hide — and they're invisible from inside your own analysis. Before banking a verdict — especially a saturation **NO-GO** that ends the effort, or a **GO** that authorizes optimizer spend — hand the full picture (cases, graders, probe output, your reasoning) to a stronger reviewer: the `advisor` tool, or an Opus subagent (Agent tool, `model: opus`). In this skill's own history that review caught two errors a self-check missed: (1) **prompt leakage** — task prompts that named the very conventions being graded, so a 1.0 meant "followed instructions," not "did it by default"; (2) an **unverified false-high** — a saturation claim about to be banked without once eyeballing a 9/9 output to confirm it genuinely met the conventions. Both would have shipped a wrong generalization into *this doc*. The rule: at the commit point, get one independent read before the verdict crystallizes, and treat findings that contradict your hypothesis as the cheap-to-check ones.

## Decision checklist

1. Is headroom in the **text**, not a frozen sub-model? (else NO-GO)
2. Does a capable target **fail** without the skill — non-default behavior, or a weak deployment target? "Procedural" alone is **not** a yes; mainstream best-practice conventions saturate (the bash case). (else NO-GO)
3. **Baseline-probe the seed on the real target.** Seed ~1.0 → STOP. Seed in (0,1) with real failures → GO.
4. Graders validated against **real** model output — including the deploy harness's artifact-on-disk / `<answer>`-wrapper mutations; validate false-highs as hard as false-lows.
5. Cases planted with headroom + unambiguous ground truth; train split contains failing cases.
6. **Independent review before banking the verdict** (advisor / Opus) — it catches prompt leakage and unverified false-highs your own analysis won't.

Report every probe result and verdict per [[always-cite-evidence-sources]].
