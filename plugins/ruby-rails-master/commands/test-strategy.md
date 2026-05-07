---
description: "Design a test plan for a Ruby/Rails class using Sandi Metz's message taxonomy."
argument-hint: "<ClassName | path>"
---

# /test-strategy

Design a test plan for a class. Uses Sandi Metz's taxonomy:

| Kind of message | How to test |
|---|---|
| Incoming query | Assert on return value |
| Incoming command | Assert on side effect |
| Outgoing command | Mock and assert sent |
| Outgoing query | Don't test (caller's responsibility) |
| Self-sent | Don't test (implementation detail) |

## What to do

1. **Locate the class.**
   - From `$ARGUMENTS`: a class name or path.
   - If unclear, ask.

2. **Spawn the `test-designer` subagent** with the class as input.

3. The agent will:
   - List the public methods.
   - Classify each as incoming query / command, or as composing outgoing messages.
   - Identify any roles the class plays (and propose a shared example).
   - Write a test plan: which tests, why, how.
   - Provide test skeletons for each (Minitest or RSpec — match the project).

4. **Render the plan** with the test file structure, names, and skeleton bodies. Don't run the tests; that's the developer's job after they've reviewed.

## Output

```
## Test plan: CompleteOrder

### Public messages
| Method | Kind | Test? |
|---|---|---|
| .call | incoming command | yes |
| .new | incoming query | implicit |
| payment.charge! | outgoing command | yes (mock) |
| order.update! | outgoing command | yes (assert side effect) |
| mailer.confirmation | outgoing command | yes (mock) |
| user.email | outgoing query | no |

### Tests (Minitest)

```ruby
# test/services/complete_order_test.rb
require "test_helper"

class CompleteOrderTest < ActiveSupport::TestCase
  def setup
    @order = orders(:pending)
    @payment = Minitest::Mock.new
    @mailer = Minitest::Mock.new
  end

  def test_completes_the_order_on_successful_payment
    @payment.expect(:charge!, true, [@order])
    @mailer.expect(:with, OpenStruct.new(confirmation: OpenStruct.new(deliver_later: true)), [{order: @order}])

    result = CompleteOrder.new(@order, payment: @payment, mailer: @mailer).call

    assert result.success?
    assert @order.reload.status_paid?
    @payment.verify
  end

  def test_returns_failure_on_payment_error
    @payment.expect(:charge!, ->(_) { raise PaymentError }, [@order])
    refute CompleteOrder.new(@order, payment: @payment, mailer: @mailer).call.success?
  end
end
```

### What I'm NOT testing
- `order.update!` — Rails framework code.
- `user.email` — User's own tests cover.
- Any private methods of CompleteOrder.

### Coverage note
These 2 tests cover both incoming command paths (success / failure) and verify the outgoing payment command. No additional tests would test behavior — they would test implementation.
```

## Behavior notes

- Match the project's test framework (detect via `Gemfile`: rspec-rails → RSpec; default → Minitest).
- Use the project's factories (FactoryBot? fixtures? plain hashes?). Check `test/fixtures/` or `spec/factories/`.
- For value objects: prefer plain Ruby tests (no Rails-loading) — they should be testable without the framework.
- For models: ActiveSupport::TestCase / RSpec.describe Model.
- For services: ActiveSupport::TestCase or plain Minitest::Test (depending on whether AR access is needed).

## When to refuse

- "Test this private method." Refuse — refactor so the public path covers it.
- "Make my tests faster" — that's a different task; route to `/find-smells` or `perf-hunter`.
