# Task: audit-arch iteration-2 — real-repo eval

Two phases, strict order. You are both the test subject (Phase 1) and the grader (Phase 2). The test only means something if Phase 1 runs blind — so do NOT open `iteration-2/eval-0-real-sector-no-archetype/eval_metadata.json` (the grading assertions) until your Phase 1 report is written to disk. Opening it early invalidates the eval.

## Phase 1 — run the audit (blind)

Invoke the `audit-arch` skill (`~/.claude/skills/audit-arch/SKILL.md`) against the Sector repo at `$HOME/projects/sector`, with NO archetype argument. Follow the skill exactly as written — its step order, prohibitions, and output template. Judge fitness scope from what you find in the repo yourself.

Write the complete audit report to:
`~/.claude/skills/audit-arch-workspace/iteration-2/eval-0-real-sector-no-archetype/with_skill/run-1/outputs/report.md`

Scale note: Sector is large (~64k symbols). The skill's Step 2 says dispatch exploration — do that; don't try to read the repo inline. Scope to `Sector.Engine/` + `docs/` if a whole-repo pass is too much, but say so in the report's scope line.

## Phase 2 — grade it (iteration 2 of the skill eval)

Only after report.md exists:

1. Read `iteration-2/eval-0-real-sector-no-archetype/eval_metadata.json` and grade your Phase 1 report against each assertion, honestly — you are grading the SKILL's ability to steer, not defending your own output. For citation assertions, actually spot-check the cited file:line against the repo.
2. Write `grading.json` next to `outputs/` (i.e. in `with_skill/run-1/`), format: `{"expectations": [{"text","passed","evidence"}...], "summary": {"passed","failed","total","pass_rate"}, "eval_feedback": {...}}`. Field names exactly `text`/`passed`/`evidence` — the viewer depends on them.
3. No baseline run this iteration (iteration-1 established the baseline delta; iteration-2 tests real-repo viability only). Note this in eval_feedback.
4. Aggregate + viewer:
   ```
   cd $HOME/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator
   python3 -m scripts.aggregate_benchmark ~/.claude/skills/audit-arch-workspace/iteration-2 --skill-name audit-arch
   nohup python3 eval-viewer/generate_review.py ~/.claude/skills/audit-arch-workspace/iteration-2 --skill-name audit-arch --benchmark ~/.claude/skills/audit-arch-workspace/iteration-2/benchmark.json --previous-workspace ~/.claude/skills/audit-arch-workspace/iteration-1 > ~/.claude/skills/audit-arch-workspace/viewer2.log 2>&1 &
   ```
5. Report to Emma: pass rate, which assertions failed and why, and your verdict on whether the skill held up on a real codebase (the open question from iteration 1: does fitness-scoping + leverage-x-centrality ranking survive ambiguous, unplanted evidence?). If failures trace to skill wording, propose the specific SKILL.md edit — do not apply it without her sign-off.

## Context

See the PASSOFF injected alongside this task for full state. Iteration-1 results: with-skill 100% (14/14), baseline 88%; the skill's differentiators were ethos-weighted ranking and the explicitly-not-flagged proof-of-bar section.
