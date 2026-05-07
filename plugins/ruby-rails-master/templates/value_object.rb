# frozen_string_literal: true

# A value object represents a small immutable concept whose identity is its
# attributes (not its memory address). Use for things like Money, Email,
# Coordinate, DateRange — types that wrap primitives with behavior.
#
# - Frozen by default (`Data.define` in Ruby 3.2+, or a frozen Struct).
# - Implement ==, hash, <=> as needed.
# - No DB persistence; values are pure data.
#
# Place under app/values/ or app/types/.

# Ruby 3.2+ — `Data.define` is the cleanest option (immutable, comparable,
# hashable, with good inspect output).

Money = Data.define(:cents, :currency) do
  def to_s
    "#{format('%.2f', cents.to_f / 100)} #{currency}"
  end

  def +(other)
    raise ArgumentError, "currency mismatch" unless currency == other.currency
    Money.new(cents: cents + other.cents, currency: currency)
  end

  def *(factor)
    Money.new(cents: (cents * factor).round, currency: currency)
  end

  def positive? = cents.positive?
  def zero?     = cents.zero?
  def negative? = cents.negative?
end

# Usage:
#   total = Money.new(cents: 1999, currency: "USD")
#   total.to_s              # => "19.99 USD"
#   total + total           # => Money(cents: 3998, currency: "USD")
#   total == Money.new(cents: 1999, currency: "USD")  # => true (value equality)

# For older Ruby, use a frozen Struct or a plain class with attr_readers and
# overridden == / hash:

class Email
  attr_reader :address

  def initialize(address)
    raise ArgumentError, "invalid email" unless address =~ URI::MailTo::EMAIL_REGEXP
    @address = address.downcase.strip
    freeze
  end

  def domain = address.split("@").last
  def to_s   = address
  def ==(other) = other.is_a?(Email) && other.address == address
  alias eql? ==
  def hash = address.hash
end
