# frozen_string_literal: true

# A service object encapsulates a single multi-step domain action.
# Convention: name with a verb (CompleteOrder, RefundCharge, OnboardUser).
# Place under app/services/.
#
# Public API:
#   ServiceName.call(*args, **deps) -> Result
# Or:
#   ServiceName.new(*args, **deps).call -> Result
#
# Result is a small Struct with success?, the produced object(s), and an error.
# Replace the example contents with your own logic.

class ExampleService
  Result = Struct.new(:success?, :record, :error, keyword_init: true) do
    def failure? = !success?
  end

  def self.call(record, **dependencies)
    new(record, **dependencies).call
  end

  # Inject every collaborator with a sensible default. The defaults make this
  # callable from production code; tests can override with fakes.
  def initialize(record, payment: PaymentProcessor.new, mailer: NotificationMailer)
    @record = record
    @payment = payment
    @mailer = mailer
  end

  def call
    return Result.new(success?: false, error: "already processed") if @record.processed?

    ActiveRecord::Base.transaction do
      @payment.charge!(@record)
      @record.update!(processed: true, processed_at: Time.current)
      @mailer.with(record: @record).receipt.deliver_later
    end

    Result.new(success?: true, record: @record)
  rescue PaymentError => e
    Result.new(success?: false, record: @record, error: e)
  end

  private

  attr_reader :record, :payment, :mailer
end
