---
description: "Extract a service object from a fat model or controller. Pass the file:line or the method name."
argument-hint: "<file:line | ClassName#method>"
---

# /extract-service

Extract a service object from a fat model action, fat controller action, or any chunk of multi-step behavior that's lost in the wrong place.

## What to do

1. **Identify the chunk.**
   - If `$ARGUMENTS` is `path:line`, jump to that location.
   - If `$ARGUMENTS` is `ClassName#method`, find the method.
   - Otherwise ask the user to point at the code.

2. **Read the surrounding context.** Understand:
   - What inputs the chunk takes.
   - What collaborators it calls (Stripe, DB, mailer, etc.).
   - What outputs / side effects it produces.

3. **Confirm tests exist** for the current behavior. If not, write characterization tests first (run them green before refactoring).

4. **Spawn the `oo-refactorer` subagent** with the task: extract a service object.

5. The agent will:
   - Pick a verb-shaped name (`CompleteOrder`, `RefundCharge`, `OnboardUser`).
   - Use the `templates/service_object.rb` template as the starting shape.
   - Inject collaborators via the initializer.
   - Move the logic into `#call`.
   - Replace the original site with `ServiceName.call(args)`.
   - Update or add tests for the service.
   - Run the test suite to confirm green.

6. **Show the diff.** Make sure the user can review the structural change.

## Pattern produced

```ruby
class CompleteOrder
  Result = Struct.new(:success?, :order, :error, keyword_init: true)

  def self.call(order, **deps)
    new(order, **deps).call
  end

  def initialize(order, payment: PaymentProcessor.new, mailer: OrderMailer)
    @order = order
    @payment = payment
    @mailer = mailer
  end

  def call
    Order.transaction do
      @payment.charge!(@order)
      @order.update!(status: :paid)
      @mailer.with(order: @order).confirmation.deliver_later
    end
    Result.new(success?: true, order: @order)
  rescue PaymentError => e
    Result.new(success?: false, error: e)
  end
end

# Caller:
result = CompleteOrder.call(@order)
if result.success?
  redirect_to result.order
else
  flash.now[:error] = result.error.message
  render :show, status: :unprocessable_entity
end
```

## Behavior notes

- Always inject collaborators with sensible defaults — testable + production-callable from one constructor.
- Default to a `Result` object, not raising. Use exceptions only for genuinely exceptional conditions.
- Place under `app/services/` (create the directory if absent).
- One service per multi-step action. Don't bundle unrelated services.
- If the original code had ≥ 2 distinct responsibilities, propose 2+ services and let the user choose.

## When to refuse

- The extracted "service" would be a thin wrapper over one method call. Inline it instead.
- The chunk is genuinely view-presentation logic. Extract a presenter/decorator instead.
- The chunk is a query. Extract a query object instead.
