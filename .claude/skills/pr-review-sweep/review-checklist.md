# Review checklist — how to review (Pablo's method)

This is the reviewer's prompt. Adapted from Pablo's `ai-tools` `review.md`. The
examples are illustrative of the *kind* of issue to hunt for — translate them to
whatever repo the PR is in.

## The rules that don't bend

- Read the PR holistically first: the diff, the description, AND every existing
  comment (`gh pr view <url> --comments`) so you don't re-raise something already
  being addressed.
- Look at the broader codebase, not just the changed lines. Check the callers of
  every added/modified class and method — will they break?
- Put yourself in the implementer's shoes: what would you have done differently
  design-wise to make it simpler? What could be refactored for simplicity, for
  scale?
- Focus on readability. Skip purely cosmetic style nits, but DO flag
  naming/readability that could cause confusion or bugs.
- **Hunches and suspicions are good, but you MUST confirm them.** Run the test,
  `rails runner`, `irb`, a query, a repro — get proof. Show the proof in the
  finding instead of asserting it.
- **Never write "likely", "maybe", "probably".** It's your job to be sure, not to
  guess. If you genuinely can't verify something yourself, that's the one case you
  raise it as a `check`/`question` and state *why* you couldn't verify it.
- Don't ask the human to verify what you can verify yourself via `gh`, `git`,
  `rails runner`, `irb`, tests.
- Look for the repo's established patterns. Is the PR fighting them? Why?
- Check CI for related failures before blaming the PR for a red build (Buildkite /
  Bamboo MCP). Investigate a failure to confirm it's actually related.
- Run tests with the right fixtures — the dev DB is usually empty, fixtures give
  you real data to reason against.

## What to look for

### Database & queries
- Indexes: is the query using them? Check with `EXPLAIN`. Watch full table scans
  on big tables. Question index column order (cardinality — higher-cardinality
  column first).
- N+1: reach for `includes`/`preload`/batch loading.
- Large result sets: `find_each`/batch ops, not plucking millions to memory.
- Query timeouts on large datasets.

### Migrations & schema
- Migrations run BEFORE the code swap — don't drop a column in the same deploy as
  the code that stops using it.
- Data migrations belong in a migrate_task/worker, not a schema migration.
- Backfills: are they actually batched, or is `in_batches` running inside one
  wrapping transaction (so it isn't)? Non-concurrent index build on a hot table
  locks writes — check the repo's convention before calling it blocking.
- New column/association: verify it's actually used (or a follow-up is filed).
  Verify the right database and confirm structure against `schema.rb`.

### Code quality & patterns
- Is this how we do it elsewhere? Prefer established abstractions
  (helpers, mixins, base classes, ops/services).
- Right layer: model vs op vs service. Don't put business logic where it doesn't
  belong (e.g. mailers).
- Simpler? Readable? Kill overly complex conditionals. Expressive names for
  methods/constants; constants for magic strings/numbers.
- DRY: repeated code → helper. Avoid `method_missing` where explicit methods
  would debug easier.

### Defensive coding
- Guard nil — but question whether a nil should alert/raise instead of being
  silently swallowed. "When would this be nil? Should we freak out instead?"
- Validate inputs early so the caller sees the error directly, not a Sentry from a
  worker later.
- `find_by` that should be `find_by!` when the row is guaranteed.

### Testing
- Are all added/modified classes tested? Positive AND negative cases, edge cases,
  error conditions. Regression test when fixing a bug.
- Right fixtures? Redundant tests to cut? A generalities test to enforce a pattern?
- Integration: test actual behavior, not just that something was enqueued/mocked.

### Error handling & observability
- How will we know if this breaks? `GlEvent.emit`/Honeycomb/Sentry for trackable
  occurrences and silent-failure risk.
- Expressive error objects; log enough context to debug from Kibana.
- Transaction atomicity — what rolls back if this fails partway?

### Background jobs
- Procs/lambdas don't serialize to Sidekiq JSON — pass values.
- Exclusive long jobs: `until_and_while_executing`. Worker vs inline. What if
  millions enqueue at once? SLA queues where possible.

### Security & data
- PII: will Scrubby scrub new tables/associations? Sensitive params filtered?
- Attack vectors — can someone click their way to filling the DB? Encryption needs.

### Config & feature flags
- Proper config accessors; flags for rollout control; sensible defaults; validate
  config exists (raise/alert vs silent fail). `System.production_environment?` for
  env checks (stubbable).

### Deploy safety
- Old payloads enqueued across deploy (`moved_from` for renamed workers/mailers).
- Migration/code timing. Feature flag for gradual rollout. Split risky changes into
  their own PR to run before the dependent code merges.

## Questions to always ask yourself
1. Why was this needed? 2. What if X is nil/missing? 3. Is there a test?
4. Can we do this simpler? 5. Following existing patterns? 6. How will we know if
it breaks? 7. Any deploy-timing concerns? 8. Should this be a follow-up?
9. Can we make it dynamic from config?
