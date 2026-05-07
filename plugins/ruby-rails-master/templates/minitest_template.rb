# frozen_string_literal: true

# Minitest skeleton for a service object.
# Place under test/services/, test/models/, test/controllers/, etc.
#
# Conventions:
# - Use `def test_*` method-name form, NOT the `test "..."` block macro.
# - Test method names describe behavior — verbose snake_case is fine.
# - One concept per test (multiple asserts of one logical property is fine).
# - Setup ≤ 3 lines; if longer, the SUT has too many dependencies.
# - Use fixtures for stable data; FactoryBot for ad-hoc records.

require "test_helper"

class ExampleServiceTest < ActiveSupport::TestCase
  def setup
    @order = orders(:pending)
    @payment = Minitest::Mock.new
    @mailer = Minitest::Mock.new
  end

  def test_completes_successfully_on_payment_success
    @payment.expect(:charge!, true, [@order])
    @mailer.expect(:with, OpenStruct.new(receipt: OpenStruct.new(deliver_later: true)), [{record: @order}])

    result = ExampleService.new(@order, payment: @payment, mailer: @mailer).call

    assert result.success?
    assert_predicate @order.reload, :processed?
    @payment.verify
    @mailer.verify
  end

  def test_returns_failure_when_payment_errors
    @payment.expect(:charge!, ->(_) { raise PaymentError, "card declined" }, [@order])

    result = ExampleService.new(@order, payment: @payment, mailer: @mailer).call

    refute result.success?
    assert_kind_of PaymentError, result.error
  end

  def test_is_a_no_op_when_already_processed
    @order.update!(processed: true, processed_at: Time.current)

    result = ExampleService.new(@order, payment: @payment, mailer: @mailer).call

    refute result.success?
    assert_equal "already processed", result.error
  end
end

# To run a single test:
#   bin/rails test test/services/example_service_test.rb
#   bin/rails test test/services/example_service_test.rb:24   # specific line
#   bin/rails test test/services/example_service_test.rb -n test_returns_failure_when_payment_errors
