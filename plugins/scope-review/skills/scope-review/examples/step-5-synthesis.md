# Step 5 — Synthesis

## BAD

> There are some open questions for product about how the rule should behave. Engineering needs to decide on the schema. We should investigate the calculator more.

Why this is bad:

- Product question is not forwardable. Recipient cannot answer it without first asking three follow-ups.
- Engineering decisions are not enumerated. "Decide on the schema" is a category, not a decision.
- Investigation item names no file, no command, no person.
- Treats synthesis as a list of TODOs rather than a structured matrix.

## GOOD

### 5a. Product / compliance / legal questions

#### Q-PROD-1 (blocks current PR)

**Scenario.** Acme Co's 401(k) plan requires 1,000 hours of service in 12 months for eligibility. On Jan 1 2026 their plan goes through a non-rule amendment — vendor change, fee schedule update, or document refresh. The eligibility rule stays exactly the same: 1,000 hours / 12 months. Internally this creates a new plan configuration record, but the rule is byte-identical.

Alice is a part-time employee at Acme. From Jul 2025 through Dec 2025 (under the old configuration) she worked 800 hours. From Jan 2026 through Jun 2026 (under the new configuration) she worked another 300 hours. By Jul 2026 her rolling 12-month window covers Jul 2025 through Jun 2026 with 1,100 hours total, spanning both configurations.

**Should Alice be eligible to enter the plan on her next entry date?**

- **(A) YES, fully additive.** The rule didn't change, so prior hours count toward the threshold. Alice crosses 1,000 hours and becomes eligible. *Engineering: determinations scoped on rule signature only, no config_id. Cleanest.*
- **(B) NO, reset on every config swap.** Each new configuration starts a fresh 12-month measurement period. Alice has only 300 hours under the new config. *Engineering: keep current per-config scoping, consolidation is presentation-only.*
- **(C) DEPENDS on amendment type.** Rule-preserving amendments are additive (A). Substantive amendments reset (B). *Engineering: needs a new flag on config-change events, plus migration to track historical amendment types.*

#### Q-PROD-2 (informs follow-up scope)

**Scenario.** Same Acme plan. On Jan 1 2026 they amend to a stricter rule: 1,000 hours / 6 months. Bob worked 900 hours from Jul through Dec 2025 under the old 1,000/12 rule. He has not crossed the threshold (900 < 1000).

**When the rule changes, what happens to Bob's accrued hours?**

- **(A) Carry forward, evaluated against new rule.**
- **(B) Old determination invalidated, fresh start.**
- **(C) Grandfather: old rule applies to participants who started accruing under it.**
- **(D) Whichever is more favorable to participant.**

Engineering implications spelled out per option in the forwardable file.

#### Q-PROD-3 (informs future scope)

Rule version bump (`hours_of_service_v1` → `_v2`). Default: never carry forward. Confirm before v2 ships.

### 5b. Engineering decisions

| ID | Decision | Default | Tradeoff |
|----|----------|---------|----------|
| D1 | Determination scoping key | `(participant, eligibility_rule_signature, as_of_date)` | Drops `dc_plan_configuration_id` — must reconcile with Q-PROD-1 |
| D2 | Signature representation | `Digest::SHA256.hexdigest("#{rule}:#{value.to_h.deep_sort.to_json}")[0,16]` | Truncated hash trades 1-in-2^64 collision risk for column size |
| D3 | Rule version in signature | YES (default Q-PROD-3 = A) | If product overrides, change signature scheme |
| D4 | Origin audit column | Add `triggering_dc_plan_configuration_ids` array column on Determination | Costs one column, preserves audit trail |
| D5 | PR scope | Read path + write path together, behind FF | Larger PR but no half-built feature rotting on main |
| D6 | WindowTotal `current` grouping | Match D1 — group by `(participant, signature, window_start_date)` | Forces window definition to be rule-determined, never config-determined |
| D7 | `validate_participant_belongs_to_plan_configuration` | Drop | Loses row-level plan-membership check; relies on `belongs_to :dc_participant` |

Each decision has a stated default. Reviewer can override individual decisions without re-deriving the whole matrix.

### 5c. Investigations needed

1. Confirm `EligibilityRuleShape#value` shape coverage. Read all classes registered in `Registry::RULES`. Today only `HoursOfServiceV1` exists, but registry could grow before this work merges. *File: `subsystems/defcon_employers/eligibility/private/lib/eligibility_rules/registry.rb`.*
2. Verify FF-off equivalence claim from PR commit `7082fe62de5`. Add a test asserting `EligibilityPeriodForPlanDesignCalculator` output is byte-identical with HoS field present-but-nil vs absent. *File: `lib/participant_eligibility/v2/eligibility_period_for_plan_design_calculator.rb`.*
3. Identify Determination/WindowTotal write-path owner. Likely the team that owns Entry ingestion (per migration `20260428001915` ownership). Confirm before scoping write-path Op into this PR. *Action: ask in #defcon-eligibility Slack channel.*

### Routing summary

- **Block on:** Q-PROD-1 answered.
- **Once unblocked:** scope is locked-in via 5b. Engineering decisions D1-D7 are committed unless reviewer overrides.
- **Write to file:** Q-PROD-1, Q-PROD-2, Q-PROD-3 to `<topic>-product-questions.md` for forwarding.

Why this is good:

- Product questions are forwardable as-is.
- Engineering decisions have defaults — work can proceed without re-deriving.
- Investigations are concrete: file path or Slack channel, not "look into it."
- Routing summary tells the user exactly which question blocks which next action.
