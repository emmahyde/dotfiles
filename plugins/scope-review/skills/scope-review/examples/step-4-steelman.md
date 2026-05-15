# Step 4 — Steelman

## BAD

> Option 1 might have problems. Option 2 also has tradeoffs. Option 3 could work but isn't perfect. We should consider all options carefully.

Why this is bad:

- Treats steelmanning as listing tradeoffs in the abstract.
- Each "rebuttal" is content-free.
- Reaches no conclusion. The user still has to do the actual adversarial work.
- "Carefully consider" is filler.

## GOOD

Suppose step 3 surfaced these candidate fixes:

- **Opt A** — add `value` to DESIGN_ATTRIBUTES, keep config_id guard.
- **Opt B** — equivalence service method, no config guard.
- **Opt C** — re-scope determinations on rule signature, drop config_id.
- **Opt D** — consolidate at design layer, retain per-config determinations.

### Steelman against Opt A

Doesn't change consolidation behavior. Config_id guard already gates consolidation regardless of `value`. Adding `value` is dead code in the HoS path. For non-HoS rules, `value` may carry display-only fields that fragment designs that should consolidate. Net: zero benefit, potential regression in non-HoS consolidation. Reviewer's complaint ("if rule is the same it shouldn't be different design") fully unaddressed. **Verdict: dies.**

### Steelman against Opt B

Equivalence service alone reproduces the orphan-determination regression (issue 2 in step 3). Per the codebase grounding, this regression is dormant today (no Determination writers in production), but lands the moment the write path ships — which is part of the same effort. Worse than the original bug because the "equivalence service" name signals principled fix and reviewers stop looking. **Verdict: dies once write path lands.**

### Steelman against Opt C

Schema change on the Determination + WindowTotal tables. Per codebase grounding, no production rows exist, so the standard "expensive backfill" objection is dead. But: rule version drift remains a hazard — when `hours_of_service_v2` ships, the signature scheme must include rule version, otherwise v1 and v2 with identical (hours, months) silently share rows under different counting semantics. Also: loses authoritative origin. "Which config produced this determination?" becomes "some equivalent config." If determination logic has bugs and we need to invalidate determinations from a specific config, we can't target. **Verdict: survives if signature includes rule version and origin column is preserved as non-key audit field.**

### Steelman against Opt D

Cosmetic only. Display says "consolidated since 2020"; backend says "starting fresh per config." If product confirms additive accrual is correct (Q-PROD-1 = A), Opt D ships a UI lie. The crossed-window scenario (800 hrs config A + 200 hrs config B = 1000 hrs total but per-config evaluation never reaches 1000) silently mis-determines eligibility. Adds per-window `originating_config_id` complexity for no behavioral payoff. Reviewer's original complaint structurally unaddressed at the eligibility layer. **Verdict: dies if Q-PROD-1 = A. Survives only if Q-PROD-1 = B (non-additive).**

### Cross-cutting

Every option encodes an answer to Q-PROD-1. C bakes in additive accrual. D bakes in non-additive. A and B punt at the design layer but die at the determination layer. **The strongest move depends on Q-PROD-1.** Until Q-PROD-1 is answered, picking is gambling.

If Q-PROD-1 = A → ship Opt C with rule-version-in-signature and origin audit column.
If Q-PROD-1 = B → ship Opt D and rebrand the work as "presentation-only consolidation."
If Q-PROD-1 = C (depends on amendment type) → none of A-D fit; need a new option that flags amendment type at config-change time.

Why this is good:

- Each rebuttal is concrete: which scenario kills the option, citing prior step.
- Each rebuttal reaches a verdict ("dies", "survives if X").
- Cross-cutting analysis identifies the real branching factor (Q-PROD-1) and maps each product answer to a surviving option.
- Forces step 5 to lead with Q-PROD-1, since that's the actual blocker.
