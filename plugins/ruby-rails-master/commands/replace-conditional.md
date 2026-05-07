---
description: "Replace a case/if-on-type conditional with polymorphism, step by step."
argument-hint: "<file:line | ClassName#method>"
---

# /replace-conditional

Convert a conditional that switches on type (`case obj.class when X`, `if foo.is_a?(Bar)`) into polymorphism — one class per branch, each implementing the same message.

## What to do

1. **Find the conditional.**
   - From `$ARGUMENTS`.
   - Or use `grep` patterns: `case .* when [A-Z]`, `is_a?\(`, `kind_of?\(`, `instance_of?`.

2. **Confirm tests exist** for each branch's behavior. Add characterization tests if not.

3. **Spawn the `oo-refactorer` subagent** with the recipe:

   1. Extract each branch into its own method (named identically, e.g. `process_payment`).
   2. Tests still pass.
   3. Create a class per branch type. Each implements the method.
   4. Tests still pass.
   5. Replace the case statement with one message send to the right object.
   6. Add a small factory if construction is non-trivial.
   7. Tests still pass.

4. **Verify the result is open to extension:** adding a new payment method = adding a class. No edits to the dispatching code.

## Pattern

Before:
```ruby
def process(method)
  case method
  when "credit"
    Stripe::Charge.create(...)
  when "paypal"
    Paypal::Payment.create(...)
  when "invoice"
    Invoice.send_via_email(...)
  end
end
```

After:
```ruby
def process(processor)
  processor.charge(self)
end

class CreditCardProcessor
  def charge(order); Stripe::Charge.create(...); end
end

class PaypalProcessor
  def charge(order); Paypal::Payment.create(...); end
end

class InvoiceProcessor
  def charge(order); Invoice.send_via_email(...); end
end

# factory if needed
class PaymentProcessor
  def self.for(method)
    case method
    when "credit"  then CreditCardProcessor.new
    when "paypal"  then PaypalProcessor.new
    when "invoice" then InvoiceProcessor.new
    end
  end
end
```

The `case` is now in *one* place — the factory — and its responsibility is creation, not dispatch. Adding "apple_pay" = one class + one factory branch.

## When polymorphism isn't right

- The branches are **two cases** that won't multiply. A simple `case` is fine.
- The branches **do completely different things**. Polymorphism implies a shared role; if there's no role, don't force one.
- The branches differ **only in literal values**. A hash lookup or a parameter object is cleaner than a class hierarchy.

The agent should refuse if any of these apply, and explain why.

## See also

- `skills/sandi-metz-design/SKILL.md` and `lessons.md` for the principle.
- `skills/clean-code-and-refactoring/smells-catalog.md` for the smell.
