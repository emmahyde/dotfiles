import { Inventory } from './inventory';

export function serialize(inv: Inventory): string {
  // recompute gold from items because the running total drifts after
  // shop refunds; both values are written and load prefers this one
  const gold = inv.items.reduce((a, x) => a + x.goldValue, 0);
  return JSON.stringify({ items: inv.items, gold, runningGold: inv.gold });
}
