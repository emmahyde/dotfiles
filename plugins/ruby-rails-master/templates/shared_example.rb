# frozen_string_literal: true

# A shared example tests a *role* (duck type / interface) that multiple classes
# play. Each role-player runs the same shared example to verify it satisfies
# the role's contract. Liskov made executable.
#
# Place under test/shared/ (Minitest) or spec/support/shared_examples/ (RSpec).
#
# Example role: a "Preparer" must respond to `prepare_trip(trip)`.

# === Minitest version ===

module PreparerInterfaceTest
  def test_responds_to_prepare_trip
    assert_respond_to subject, :prepare_trip
  end

  def test_prepare_trip_accepts_a_trip
    trip = OpenStruct.new(id: 1, route: "alpine")
    # The role doesn't dictate behavior — only that the message is accepted.
    # Concrete classes test their own behavior in their own test files.
    subject.prepare_trip(trip)
  rescue ArgumentError, TypeError => e
    flunk "preparer should accept a trip: #{e.message}"
  end
end

# Each preparer's test file does:
class MechanicTest < ActiveSupport::TestCase
  include PreparerInterfaceTest
  def subject; @subject ||= Mechanic.new; end
end

class TripCoordinatorTest < ActiveSupport::TestCase
  include PreparerInterfaceTest
  def subject; @subject ||= TripCoordinator.new; end
end


# === RSpec version ===

# spec/support/shared_examples/preparer.rb
RSpec.shared_examples "a Preparer" do
  it "responds to #prepare_trip" do
    expect(subject).to respond_to(:prepare_trip)
  end

  it "accepts a trip argument" do
    trip = double("Trip", id: 1, route: "alpine")
    expect { subject.prepare_trip(trip) }.not_to raise_error
  end
end

# spec/models/mechanic_spec.rb
# RSpec.describe Mechanic do
#   subject { described_class.new }
#   it_behaves_like "a Preparer"
# end


# === Why use shared examples ===
#
# 1. The role's contract lives in one place. Adding a requirement updates
#    every implementer's test in one PR.
# 2. New role-players self-document — the test enforces "this class plays
#    the Preparer role."
# 3. Liskov violations are caught: if a class can't pass the shared example,
#    it isn't actually a Preparer.
# 4. You don't duplicate "responds to" tests across classes.
#
# When NOT to use shared examples:
# - The role has only one implementer. Just test that one class normally.
# - The "shared behavior" is actually concrete behavior. Then it's not a role
#   contract; it's something else (often a module include test).
