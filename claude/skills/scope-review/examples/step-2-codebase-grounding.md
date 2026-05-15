# Step 2 — Codebase Grounding

## BAD

> Determinations are scoped per-config, so consolidating designs across configs would orphan determinations. The Determination model has a config_id column. The service queries by config_id. This is a real regression.

Why this is bad:

- Plausible-sounding but unverified. Could be reciting from training data, the PR description, or a prior conversation rather than the codebase.
- No file paths, no line numbers, no method names.
- Conflates "code references config_id" with "production data exists scoped to config_id." The first is trivially observable; the second changes the entire impact calculus.
- Misses the migration signal entirely.

## GOOD

### Verified findings

1. **Determination scoping is per-config in code.** `subsystems/defcon_participants/hours_of_service/private/models/determination.rb:16` — uniqueness scoped on `%i[dc_plan_configuration_id eligibility_rule as_of_date]`. `dc_plan_configuration_id` is a `presence: true` validated column.

2. **Read service filters by config_id.** `subsystems/defcon_participants/hours_of_service/public/services/determinations/service.rb:17` — `Determination.where(dc_plan_configuration_id: dc_plan_configuration_id, ...)`. Consolidating designs across configs would query the wrong determination set.

3. **No production writers for Determination.** Searched all non-test Ruby for `Determination.create`, `Determination.new`, `Determinations::Service`, `HoursOfService::Public`. Zero hits outside test files. Read path exists, write path does not.

4. **Architectural direction already decoupling.** Migration `dbs/primary/migrate/20260428001915_remove_dc_plan_configuration_id_from_hos_entries.rb` removes `dc_plan_configuration_id` from the `Entry` table. Comment on line: "no data in this table yet." The team has already made the architectural call that HoS data at the Entry level is participant-intrinsic, not config-scoped.

5. **Rule shape is fully specified and small.** `subsystems/defcon_employers/eligibility/public/shapes/eligibility_rule_shape.rb` defines `EligibilityRuleShape` with `string :rule` and `object :value`. For `hours_of_service_v1`, the value resolves to `HoursOfServiceV1` shape with exactly two fields: `integer :hours` (1-1000) and `integer :months` (1-12). No effective dates, no exclusions, no cosmetic fields. Rule equivalence reduces to `(rule, hours, months)` with no judgment calls.

6. **Configs are immutable post-merge.** `app/models/dc_plan_configuration.rb:527-647` — Stator state machine with transitions `confirm`, `merge`, `retire`, `replace`. Once `merged`, the config row is on the timeline and rule edits spawn new configs.

7. **PlanDesign current DESIGN_ATTRIBUTES omits `value`.** `lib/participant_eligibility/v2/plan_design.rb:9-13` (or PR-branch equivalent at `7082fe62de5`) — `DESIGN_ATTRIBUTES` lists `special_entry`, `required_age`, `required_months_of_service`. PR adds `eligibility_rule` (rule key only). Threshold lives in `EligibilityRuleShape#value`, never enters the hash.

### What this changes

Findings 3 and 4 collapse the regression objection. The "consolidating designs orphans determinations" argument assumed production rows existed scoped to config_id. They don't — the data model is greenfield, and the team has already started decoupling at the Entry level. Finding 5 simplifies the equivalence question to a closed-form check — no semantic judgment needed.

Why this is good:

- Every finding cites a file and line.
- Distinguishes "code does X" from "production data behind X exists."
- Calls out the migration as a signal of architectural intent.
- The summary names which findings change the proposal evaluation, separating noise from load-bearing facts.
