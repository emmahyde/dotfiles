# Evidence base

Why each design choice in SKILL.md is the way it is. Full corpus (18 sources, fetched 2026-07-25): `~/llmwiki/.raw/sector-research/session-reflection-sota-20260725/corpus-summary.md` — the Research Brief section carries per-claim page citations.

## The forced template (workflow step 2)

"Honest Lying" (arXiv 2605.29463, 2026) measured Reflexion-style agents under binary feedback: 0 of 121 sampled freeform reflections named the actually-blocking object; 16/50 ALFWorld environments froze in confabulation loops (7.6 trials to solve vs 1.5 unfrozen; confabulation rate correlated with trials-to-solve at r=0.808). Forcing a grounded template (`FAILED STEP / ROOT CAUSE / NEW PLAN`) plus programmatic extraction of the real failure signal took correct-cause identification 0%→86% and confabulation rate 0.64→0.10. The same paper found "extract a general rule from this trajectory" prompting (ExpeL-style) amplifies confabulation — a wrong self-diagnosis gets promoted into a rule. Hence: template mandatory, generalization gated behind recurrence.

The `APPLIES-WHEN / STOPS-APPLYING` fields come from the SoK on agentic skills (arXiv 2602.20867): a usable lesson is an ⟨applicability, policy, termination⟩ tuple, not a bare fact. `STOPS-APPLYING` is also what makes the retirement pass mechanical instead of judgment-only.

## Recurrence thresholds (step 3)

Ratchet (arXiv 2605.22148, SWE-bench-style eval): human-curated skills +16.2pp; LLM-self-generated skills +0.0pp (companion SoK measurement: −1.3pp — net negative). Ratchet's working trigger is 3 failures before synthesizing, and clustering failures beats synthesizing from single incidents. Claude Code's own memory docs set the practitioner threshold for user-correction lessons at "same mistake twice / repeated correction." Hence 2× for user corrections, 3× for self-observed.

## Retirement + caps (step 4)

Ratchet's ablations: outcome-driven retirement and a bounded active-skill cap are each independently load-bearing (removing either causes divergence/bloat); explicit dedup logic adds nothing on top of retirement — so the skill builds no dedup machinery. Practitioner confirmation: ianlpaterson's 501-line MEMORY.md where ~60% of lessons fell outside the load window and were effectively invisible; orchestrator.dev's ~150–200 "effective instruction slots" ceiling and the litmus test "would removing this line cause a mistake?". Single-writer discipline (one mechanism appends to the log) is the same writeup's fix for memory-file sprawl and concurrent-write corruption.

## Closing the loop (step 5)

Peer-reviewed AAR literature (PMC3447598): organizations record the same lesson "over and over" because it was observed but never converted into an implemented, re-tested change; HSEEP doctrine closes a lesson only after its improvement action is exercised again. upstat.io's incident guide: a write-only action-item list breeds cynicism that suppresses future honest reporting. Hence `applied → verified-or-retired`, checked at later retros.

## Blameless framing (hard rule 2)

PagerDuty/Atlassian blameless-postmortem doctrine: blame framing measurably degrades the honesty of the input data the analysis depends on. Ask what condition allowed the outcome; "contributing factors, not a single root cause" also matches Ratchet's cluster-before-synthesize rule.

## Session-boundary timing (hard rule 4)

orchestrator.dev best-practices: review memory before starting, write after finishing — not continuous mid-task reflection. Matches Reflexion's own design (reflect after a completed trial). Reflexion (arXiv 2303.11366) is also the ceiling evidence that reflection with real signal works at all: HumanEval pass@1 80%→91%, +22pp AlfWorld — but it caps working memory at ~3 reflections and its authors flag self-evaluation as the weak point (hard rule 5; see also ChemCrow's unreliable self-assessment in expert domains, via Lilian Weng's survey).

## Known limits of this evidence

No source directly studies end-of-session retrospection for coding agents; the design bridges three adjacent literatures (in-task reflection RL, persisted-skill lifecycle benchmarks, coding-agent memory tooling) plus human postmortem practice. Ratchet and Honest Lying are 2026 preprints without independent replication. One survey in the corpus (arXiv 2603.07670) was unreadable due to PDF extraction failure and is uncited. Confidence: medium-high.
