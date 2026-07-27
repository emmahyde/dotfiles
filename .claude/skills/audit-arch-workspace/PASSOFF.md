# PASSOFF · audit-arch-eval · 2026-07-20

## LEGEND
now active   done finished   next upcoming   note decision   ref pointer
> causes   @path:line   [H/M/L] priority   {S|M|L} effort

## NOW
- iteration-2 real-repo eval of audit-arch skill — YOU run it. Task file @~/.claude/skills/audit-arch-workspace/spinoff-task.md — Phase 1 blind audit of sector, Phase 2 self-grade. Do NOT read iteration-2 eval_metadata.json before report written.

## DONE
- skill created @~/.claude/skills/audit-arch/SKILL.md > macro arch audit: fillable contract, 6 prohibitions, archetype table, ethos importance modifier (Step 1c), leverage x centrality ranking, max 5 findings, explicitly-not-flagged mandatory
- iteration-1 synthetic eval (haiku, 2x2 runs) > with-skill 100% 14/14, baseline 88% 12/14  ref:@~/.claude/skills/audit-arch-workspace/iteration-1/benchmark.md
- baseline failed exactly on skill differentiators: peripheral netsync headlined #1 + no explicitly-not-flagged section
- viewer iteration-1 served localhost:3117 pid 13718 (may still run; kill ok)

## NOTES
- Emma directives baked into skill: never flag unsignaled quality dimension (any dimension, not only scale); ethos = importance modifier, "bad" never outranks "unimportant-but-bad"; archetype arg unlocks dimension
- iteration-1 known eval weaknesses: eval-1 non-discriminating (baseline also 6/6); netsync-not-headlined assertion ambiguously worded  ref:grading.json eval_feedback fields
- open question iteration-2 answers: does fitness-scoping + ranking survive real 64k-symbol repo w/ unplanted evidence
- sector ethos signal exists in-repo (do not hunt for hints beyond repo docs — discovery is part of the test)
- workspace layout: aggregator needs <eval>/<config>/run-1/grading.json (bit me in iteration-1, already fixed there)
- skill files here soft-wrapped markdown — hook rejects hard line breaks mid-paragraph
- edits to SKILL.md from grading findings: propose only, Emma signs off

## REFS
- code: @~/.claude/skills/audit-arch/SKILL.md — the skill under test
- code: @~/.claude/skills/audit-arch-workspace/ — evals, fixtures, iteration-1 results
- docs: @$HOME/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator/ — skill-creator scripts (aggregate_benchmark, generate_review, agents/grader.md)
- prior: sector cwd $HOME/projects/sector #main, uncommitted mining-test changes present — unrelated to this task, do not touch

## RESUME
$ follow ~/.claude/skills/audit-arch-workspace/spinoff-task.md Phase 1 — invoke audit-arch skill on $HOME/projects/sector, no archetype arg
#main · sector repo read-only for this task · tests: n/a

## REHYDRATE TASKS
- [H] run audit-arch skill blind on sector repo, write report.md || running blind audit-arch pass on sector
- [H] grade report vs iteration-2 assertions, write grading.json || grading iteration-2 audit report
- [M] aggregate benchmark + launch viewer w/ --previous-workspace iteration-1 || aggregating iteration-2 benchmark
- [M] verdict to Emma: skill holds on real repo? propose SKILL.md edits if not || reporting iteration-2 verdict
