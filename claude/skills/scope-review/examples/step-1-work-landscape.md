# Step 1 — Work Landscape

## BAD

> RETIRE-7570 is in flight. There's a PR open. The HoS eligibility work is being built out. Some related migrations have been written.

Why this is bad:

- No citations or paths.
- "Some related migrations" is unfalsifiable — could mean one or twenty.
- "Being built out" doesn't say what's done vs in flight vs planned.
- A reviewer reading this learns nothing they didn't already know from the PR title.
- No /audit was run; gaps are invisible.

## GOOD

### Complete (shipped)

- `EligibilityRuleShape` value object — `subsystems/defcon_employers/eligibility/public/shapes/eligibility_rule_shape.rb`. Two fields: `rule` (string discriminator) and `value` (typed shape via Registry).
- `HoursOfServiceV1` rule shape — `subsystems/defcon_employers/eligibility/public/shapes/eligibility_rules/hours_of_service_v1.rb`. Two fields: `hours` (1-1000) and `months` (1-12).
- `Registry` mapping rule discriminator to shape class — single entry today, `"hours_of_service_v1"`.
- `Public::Determinations::Service` read interface — `subsystems/defcon_participants/hours_of_service/public/services/determinations/service.rb`. Methods `satisfied_date` and `determination_exists?`.
- Three private models: `Entry`, `WindowTotal`, `Determination` — all under `subsystems/defcon_participants/hours_of_service/private/models/`. **Zero non-test writers** anywhere in the codebase.

### Incomplete but ticketed (RETIRE-7570 PR branch)

- PR adds `dc_plan_configuration_id` and `eligibility_rule` fields to `ParticipantEligibility::V2::PlanDesign`.
- PR adds `hours_of_service?` predicate and HoS branch in `EligibilityPeriodForPlanDesignCalculator#eligible_service_on`.
- PR threads `dc_plan_configuration_id` and `eligibility_rule` through `EligibilityDateComputationFetchOp`.
- PR gates extraction behind `Feature::HOS_ELIGIBILITY_RULES_PLAN_SETUP`.
- Migration `20260428001915_remove_dc_plan_configuration_id_from_hos_entries.rb` (separate scope) drops `dc_plan_configuration_id` from the Entry table. Comment: "no data in this table yet."

### Unticketed (no formal record)

- The Determination/WindowTotal write path. Nothing creates Determination or WindowTotal rows in production. The PR wires the read path before the write path exists.
- Behavior on rule change mid-tenure (sponsor edits HoS threshold).
- Behavior on rule version bump (v1 → future v2).
- Whether `Determination.dc_plan_configuration_id` should follow the Entry table's decoupling — placeholder column has no production data behind it.

### /audit on gaps

`/audit RETIRE-7570 PR scope completeness` would surface: read path being built without a write path, schema-level decoupling for Entry that has not been propagated to Determination/WindowTotal, no migration for `eligibility_rule_signature` or equivalent, no product confirmation on additive-accrual semantics. None of these gaps is currently tracked in JIRA.

Why this is good:

- Every claim cites a path or a ticket.
- Distinguishes shipped, in-flight, and unticketed.
- Names the unticketed work explicitly so the user can decide whether to ticket it.
- Calls out the structural mismatch (read path before write path) that is invisible in the PR description but visible in the codebase.
