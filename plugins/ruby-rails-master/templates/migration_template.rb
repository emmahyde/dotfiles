# frozen_string_literal: true

# Reversible migration template. Conventions:
#
# - Use `change` (not up/down) when possible — Rails infers the reversal.
# - Add an index in the same migration as any column you'll query/order/group on.
# - Add `null: false` and DB-level constraints, not just AR validations.
# - For columns with referential integrity, use `add_reference` with foreign_key.
# - Heavy data-backfill goes in a separate migration with `disable_ddl_transaction!`
#   and `in_batches`.
# - For potentially destructive changes, the strong_migrations gem will warn.
#   Override only after considering safety: `safety_assured { rename_column ... }`.

class AddArchivedAtToOrders < ActiveRecord::Migration[7.1]
  def change
    # Schema change
    add_column :orders, :archived_at, :datetime
    add_index :orders, :archived_at,
              # partial index — only index rows where the column matters
              where: "archived_at IS NULL"

    # Adding a reference (FK + index in one)
    # add_reference :orders, :user, null: false,
    #               foreign_key: { on_delete: :cascade }, index: true

    # Adding a column with a default — Rails 7+ does this online, no table lock
    # add_column :orders, :priority, :integer, default: 0, null: false
  end
end


# Backfill migration (separate from schema change!)
class BackfillOrdersArchivedAt < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def up
    Order.unscoped.in_batches(of: 1_000) do |batch|
      batch.where(archived: true).update_all(archived_at: Time.current)
    end
  end

  def down
    # Decide what reversibility means for this data change.
    # Often: leave alone, or restore to a known prior state from snapshots.
  end
end


# Renaming a column (potentially destructive — requires care or strong_migrations)
class RenameUserNameToFullName < ActiveRecord::Migration[7.1]
  def change
    safety_assured { rename_column :users, :name, :full_name }
  end
end


# Removing a column (multi-step pattern for live apps)
# 1) PR A: stop reading the column. Deploy. Verify.
# 2) PR B: stop writing the column. Deploy. Verify.
# 3) PR C: drop the column.
class RemoveOldFlagFromOrders < ActiveRecord::Migration[7.1]
  def change
    safety_assured do
      remove_column :orders, :legacy_flag, :boolean, default: false, null: false
    end
  end
end
