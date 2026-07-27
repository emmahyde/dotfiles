export interface Item { id: string; goldValue: number; }

export class Inventory {
  items: Item[] = [];
  gold = 0; // running total, updated on pickup/drop

  pickup(item: Item): void {
    this.items.push(item);
    this.gold += item.goldValue;
  }

  drop(id: string): void {
    const i = this.items.findIndex(x => x.id === id);
    if (i >= 0) { this.gold -= this.items[i].goldValue; this.items.splice(i, 1); }
  }
}
