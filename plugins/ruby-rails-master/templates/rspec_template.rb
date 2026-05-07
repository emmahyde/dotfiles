# frozen_string_literal: true

# RSpec skeleton for a service object.
# Place under spec/services/, spec/models/, spec/requests/, etc.
#
# Conventions:
# - `describe ClassName do ... end` per file.
# - Use `let`/`let!` for setup; `subject` for the SUT.
# - One `it` per concept; descriptive `it "does X"`.
# - Mock collaborators with `instance_double` (verifying double).
# - Use `allow(...).to receive(...)` for stubbed return values; `expect(...).to receive(...)` only when asserting the message.

require "rails_helper"

RSpec.describe ExampleService do
  let(:order) { create(:order, :pending) }
  let(:payment) { instance_double(PaymentProcessor, charge!: true) }
  let(:mailer) do
    instance_double(NotificationMailer).tap do |m|
      allow(m).to receive(:with).and_return(double(receipt: double(deliver_later: true)))
    end
  end

  subject(:result) { described_class.new(order, payment: payment, mailer: mailer).call }

  describe "#call" do
    context "when payment succeeds" do
      it "marks the order processed" do
        result
        expect(order.reload).to be_processed
      end

      it "returns success" do
        expect(result).to be_success
      end

      it "charges the payment processor" do
        expect(payment).to receive(:charge!).with(order)
        result
      end
    end

    context "when payment fails" do
      before { allow(payment).to receive(:charge!).and_raise(PaymentError, "card declined") }

      it "returns failure" do
        expect(result).not_to be_success
      end

      it "carries the error" do
        expect(result.error).to be_a(PaymentError)
      end

      it "does not mark the order processed" do
        result
        expect(order.reload).not_to be_processed
      end
    end

    context "when the order is already processed" do
      before { order.update!(processed: true, processed_at: Time.current) }

      it "returns failure with a clear message" do
        expect(result).not_to be_success
        expect(result.error).to eq("already processed")
      end

      it "does not call the payment processor" do
        expect(payment).not_to receive(:charge!)
        result
      end
    end
  end
end

# To run:
#   bundle exec rspec spec/services/example_service_spec.rb
#   bundle exec rspec spec/services/example_service_spec.rb:38   # specific line
