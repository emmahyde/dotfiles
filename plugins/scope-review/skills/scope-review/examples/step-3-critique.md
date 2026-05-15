# Step 3 — First-Principles Critique

## BAD

> The PR adds a config_id guard but doesn't address the underlying issue. The fix is incomplete and may cause regressions. We should think about this more carefully.

Why this is bad:

- "Underlying issue" never named.
- "May cause regressions" is unfalsifiable — what regression, in what scenario, against which row?
- "Think about this more carefully" is an instruction to the user, not a critique. Adds zero information.
- No citation to the proposal or the code it touches.

## GOOD

### Issue 1 — Threshold collision in `DESIGN_ATTRIBUTES`

The PR's `DESIGN_ATTRIBUTES` adds `eligibility_rule` (the rule key string, e.g. `"hours_of_service_v1"`) but not `value`. See `lib/participant_eligibility/v2/plan_design.rb:9-13` on the PR branch.

`EligibilityRuleShape#value` carries the threshold: hours and months. Two configurations with rule `hours_of_service_v1` but different thresholds (1000 hrs vs 500 hrs) hash-match on `design_attributes_hash` and consolidate. The merged design carries one threshold; the other config's threshold is silently dropped.

Concrete scenario: Acme Corp's plan A requires 1000 hrs / 12 months. They amend to 500 hrs / 12 months on Jul 1. Both configs share `eligibility_rule = "hours_of_service_v1"`. Without the `dc_plan_configuration_id` guard, designs consolidate into one design covering Jan-Dec with whichever threshold survives the consolidation. Sponsor and participants disagree about who is eligible.

### Issue 2 — Determination lookup loss after consolidation

`subsystems/defcon_participants/hours_of_service/public/services/determinations/service.rb:13-22` filters Determination by `dc_plan_configuration_id`. `consolidate_plan_designs` retains the older design and discards newer designs (see PR-branch `lib/participant_eligibility/v2/plan_design.rb:53-63`).

If the PR's guard is removed, two configs with identical rule key consolidate. Post-consolidation only one config_id survives in the PlanDesign. Determinations written under the discarded config_id become unreachable via the read path. A participant whose qualifying window crystallized under the discarded config_id appears ineligible even though their hours did meet the threshold.

**This issue is mitigated by the codebase grounding** (step 2): there are no production Determination writers yet. The lookup-loss regression cannot manifest today. But it manifests the moment the write path lands, which is part of the same effort.

### Issue 3 — Premise unchecked: is consolidation a presentation concern or a semantic one?

The PR treats `PlanDesign` consolidation as a uniform operation. The reviewer's complaint ("if the rule is the same it shouldn't be a different design") frames it as an eligibility-semantic concern. The current `consolidate_plan_designs` is consumed by both `EligibilityDateEvaluateOp` and `PeriodsUpsertOp` per `lib/participant_eligibility/v2/plan_design.rb:18-19`.

If consolidation feeds eligibility computation, "same rule = same design" implies "determinations from rule-equivalent configs aggregate." That's a product/compliance question, not an engineering preference. The PR does not name or answer it.

### Issue 4 — `dc_plan_configuration_id` field on PlanDesign couples a value object to a database identity

`PlanDesign` is a TypedModel value object. Threading `dc_plan_configuration_id` through it makes consolidation depend on database row identity rather than rule semantics. This is the proxy that produces the reviewer's complaint: configs with identical rules but different IDs (e.g. document refresh) won't consolidate, even when consolidation is correct.

The fix isn't to add the field; it's to make consolidation depend on rule equivalence directly. Drop the field, add a rule-signature hash to DESIGN_ATTRIBUTES.

### Issue 5 — FF-off behavior assertion lacks test

PR commit `7082fe62de5` claims "with FF off, eligibility_rule is nil, hours_of_service? returns false, calculator falls through to month-based logic byte-identically." There is no test asserting `EligibilityPeriodForPlanDesignCalculator` produces identical output with HoS field present-but-nil vs HoS field absent. The byte-identical claim is unverified.

Why this is good:

- Each issue cites the proposal location (file:line) and the code location it interacts with.
- Each issue includes a concrete scenario or scenario-class.
- Each issue distinguishes "happens today" from "happens when X lands" — the codebase grounding feeds directly into severity.
- Issues are numbered so they can be referenced individually in steelmanning and synthesis.
