# frozen_string_literal: true

# A query object encapsulates a complex AR query. It accepts a starting relation
# (default: the model's all-relation) and returns a relation, so it stays
# composable with `.where`, `.order`, etc.
# Place under app/queries/.

class ExampleOrderQuery
  def initialize(relation = Order.all)
    @relation = relation
  end

  def call(user:, status: nil, since: nil)
    scope = @relation.where(user: user)
    scope = scope.where(status: status) if status
    scope = scope.where("created_at >= ?", since) if since
    scope.order(created_at: :desc)
  end

  # Variant: each predicate as its own private method, composed in `call`.
  # def call(user:, status: nil, since: nil)
  #   for_user(user).then { |s| status ? for_status(s, status) : s }
  #                 .then { |s| since ? since_time(s, since) : s }
  #                 .order(created_at: :desc)
  # end
  #
  # private
  #
  # def for_user(user)        = @relation.where(user: user)
  # def for_status(s, status) = s.where(status: status)
  # def since_time(s, time)   = s.where("created_at >= ?", time)
end

# Usage:
#
# orders = ExampleOrderQuery.new.call(user: current_user, status: :paid, since: 1.week.ago)
# orders.includes(:line_items).each do |order|
#   ...
# end
#
# To compose with another query object that takes a relation:
#
# scoped = ExampleOrderQuery.new(current_user.orders).call(status: :paid)
