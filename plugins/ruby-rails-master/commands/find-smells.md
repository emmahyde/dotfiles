---
description: "Scan a file or directory for design smells with severity ranking. Defaults to app/."
argument-hint: "[path]"
---

# /find-smells

Scan Ruby/Rails code for design smells and report them grouped by severity. Uses both static patterns (file size, method size, callback usage, conditionals on type) and reading-the-code judgment for the subtler smells.

## What to do

1. **Determine scope.**
   - `$ARGUMENTS` empty → scan `app/`.
   - `$ARGUMENTS` is a path → scan it.

2. **Run the static helpers** (in `scripts/`):
   - `scripts/find-fat-files.sh <path>` — files over Metz size limits.
   - `scripts/find-callbacks.sh <path>` — AR callback hot spots.

3. **Read the flagged files** and apply judgment for the deeper smells (using `skills/clean-code-and-refactoring/smells-catalog.md`):
   - Long methods, long parameter lists.
   - Conditionals on type.
   - Feature envy / Demeter violations.
   - Primitive obsession / data clumps.
   - Sandi Metz Rule violations.
   - Concerns used in only one class.
   - Callbacks doing business logic.
   - Hardcoded class names where a duck type would do.
   - Missing tests / private-method tests.

4. **Group findings by severity** (🔴 / 🟡 / 🟢) per the smells catalog.

5. **For each finding:** file:line, smell name, why it matters, suggested move (extract method, replace conditional with polymorphism, etc.).

6. **Summarize.** Total smells by severity. Top 3 to fix first. Suggested order.

## Output format

```
## Smells found in app/

🔴 Critical (3)

#### app/models/order.rb:1 — God class (412 LOC)
Order has 47 methods. SRP violated: persistence + state machine + pricing + email rendering all in one class.
**Move:** Extract OrderState (state machine), OrderPricing (calculations), OrderMailer (already exists; pull rendering helpers there).

#### app/controllers/orders_controller.rb:88 — Conditional on type
`case payment_method when "credit" ... when "paypal" ...` — 4 branches doing 4 different things.
**Move:** Replace with polymorphism: PaymentProcessor::CreditCard, PaymentProcessor::Paypal, etc.

🟡 Worth fixing (8)
...

🟢 Nuisance (4)
...

## Top 3 to fix
1. God class in app/models/order.rb — affects every change to orders
2. Conditional on type in app/controllers/orders_controller.rb — blocks Open/Closed
3. N+1 in app/views/orders/index.html.erb — perf scaling concern

## Suggested order
Refactor #2 first (smallest, unblocks #1's PaymentProcessor extraction).
Then #1, in pieces.
Fix #3 in the same PR as the index revamp.
```

## Behavior notes

- Use `scripts/find-fat-files.sh` and `scripts/find-callbacks.sh` if available; fall back to inline `find`/`wc -l`/grep if not.
- Don't blanket-refuse to look at code over the size limits — *that's the point*; report the violations.
- For huge codebases, ask the user to scope first (e.g. `app/models/orders/`).
- Don't auto-fix. This command reports; `/refactor-flock`, `/extract-service`, `/replace-conditional` apply the moves.
