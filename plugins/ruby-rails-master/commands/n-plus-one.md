---
description: "Hunt N+1 queries in a controller, view, or service. Suggests preloads, indexes, and counter caches."
argument-hint: "[controller#action | path]"
---

# /n-plus-one

Find N+1 queries and suggest the right fix (eager-loading, counter cache, batch loading).

## What to do

1. **Determine scope.**
   - `$ARGUMENTS` empty → ask user (or scan `app/controllers/`).
   - `$ARGUMENTS` is `controller#action` → scope to that action's controller method, view, partials.
   - `$ARGUMENTS` is a path → scope to that file/dir.

2. **Run the heuristic scanner** if available: `scripts/n-plus-one-finder.rb <path>`. It flags AR access inside iterating contexts.

3. **Spawn the `perf-hunter` subagent** with the scope.

4. The agent will:
   - Read the controller/view/service code.
   - Trace AR calls inside iterations.
   - Identify the missing eager loads (`includes`, `preload`, `eager_load`).
   - Identify counter cache opportunities (`belongs_to ... counter_cache: true`).
   - Identify batch-loading opportunities (`find_each`, `in_batches`).
   - Identify queries that should pluck instead of map.

5. **Suggest the fix.** Ask the user to verify with Bullet (`bullet` gem flags N+1 in dev) or by inspecting `bin/rails server` log.

## Output

```
## N+1 audit: OrdersController#index

### Findings

#### 🔴 N+1 in app/views/orders/index.html.erb:8
Inside `<% @orders.each do |order| %>`:
- `order.user.email` (line 9) → +N queries on `users`.
- `order.line_items.count` (line 12) → +N COUNT queries.

### Fix

```ruby
# app/controllers/orders_controller.rb:12
def index
  @orders = current_user.orders
                        .includes(:user, :line_items)   # add eager loads
                        .recent
end
```

For the count, consider `counter_cache`:

```ruby
# db/migrate/...add_line_items_count_to_orders.rb
def change
  add_column :orders, :line_items_count, :integer, default: 0, null: false
end

# app/models/line_item.rb
belongs_to :order, counter_cache: true

# then backfill:
Order.find_each { |o| Order.reset_counters(o.id, :line_items) }
```

### Verify

After applying:
1. Run the action with Bullet enabled — no warnings should fire.
2. Compare `bin/rails server` log: queries should drop from ~1 + N to ~3.
3. Optional: rack-mini-profiler in dev to confirm wall time.
```

## Behavior notes

- For very large `app/` trees, scope to one controller at a time.
- Don't blindly suggest `includes` — verify by reading the view that the association is actually accessed in the loop. A bare `@orders` that never references `user` doesn't need `includes(:user)`.
- For `counter_cache`, always pair with a backfill task — Rails won't compute it for existing rows.
- For `find_each`, mention that `order` is implicit (PK ASC) — explicit ordering changes the behavior.

## When to refuse / push back

- "Just cache the page" — caching hides the underlying problem and creates invalidation bugs. Fix the queries first.
- "Add `select * from large_join_view`" — sometimes a view helps, but most N+1 fixes are smaller.
