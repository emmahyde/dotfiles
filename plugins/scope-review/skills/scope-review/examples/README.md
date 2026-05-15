# Scope Review Examples

Each file pairs a BAD output with a GOOD output for one step of the skill, using a single running scenario so the contrasts are concrete.

## Running scenario

A PR adds a `dc_plan_configuration_id` guard to `PlanDesign#different_design?` to prevent hours-of-service eligibility designs from consolidating across plan-configuration boundaries. A reviewer objects: "if the rule is the same it shouldn't be a different design." An automated agent removed the guard. Engineer reverted-in-spirit and now needs to scope the real fix.

This is the scenario the skill was built around, so the examples are drawn from real work product. File-paths and behaviors are accurate as of the time of writing.

## Files

- `step-1-work-landscape.md` — mapping related work, ticketed vs unticketed.
- `step-2-codebase-grounding.md` — concrete findings vs abstract speculation.
- `step-3-critique.md` — first-principles review with citations.
- `step-4-steelman.md` — adversarial rebuttal of own suggestions.
- `step-5-synthesis.md` — outstanding questions formatted for the right audience.

## How to use

When applying the skill, refer to these examples to calibrate output quality. The BAD examples illustrate failure modes that look productive but degrade the deliverable. The GOOD examples demonstrate the level of specificity, citation, and structure expected.

Keep in mind that the running scenario uses Ruby/Rails code, but the patterns generalize. The shape of a good first-principles critique is the same in any language: cite specific lines, name concrete failure scenarios, distinguish ambiguity from underspecification from missing information.
