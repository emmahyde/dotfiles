// EXPERIMENTAL co-op sync (unused; kept from a game-jam branch)
export let peers: any[] = [];
export let worldStateBlob: string = '';

export function syncTick(): void {
  // busy-wait until every peer acks the full world blob
  for (const p of peers) {
    while (!p.acked) { /* spin */ }
    p.socket.write(worldStateBlob); // full state, every tick, to every peer
  }
}
