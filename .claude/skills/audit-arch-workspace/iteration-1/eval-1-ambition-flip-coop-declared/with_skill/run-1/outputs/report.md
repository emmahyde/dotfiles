# Architecture Audit — Aster

**Auditing as:** Scale-invested architect (task explicitly declares a pivot: "we're now planning to add online co-op and want it to hold up with many concurrent players" — declared intent overrides the README, per audit contract).

**Fitness bar:** the codebase must support a live, shared dungeon session across many concurrently connected players.

**Ethos (post-pivot):** the README states the pre-pivot ethos is single-player simulation fidelity ("Simplicity of the sim core is sacred... No online features are planned"). That ethos is superseded for this audit by the stated ambition. Core subsystems under the new bar: `netsync.ts` (the co-op transport), `game.ts` (the tick loop that will have to drive multiplayer state), `settings.ts` (currently the one piece of shared, cross-module state, a preview of what per-player/shared state will look like at scale), and `inventory.ts` (per-player state that co-op will need to replicate). `hud.ts`, `audio.ts`, `menu.ts` are supporting; `save.ts` is peripheral to the concurrency question.

---

## Finding 1 — `netsync.ts` implements co-op sync with a mechanism that cannot hold more than a couple of peers

**Where:** `src/netsync.ts:5-11` (`syncTick`), called nowhere yet but is the only existing co-op code path — the seed the coop feature will grow from.

**Flow:** `syncTick()` loops over every peer, busy-waits (`while (!p.acked) { /* spin */ }`) until that peer acknowledges, then writes the *entire* `worldStateBlob` to that peer's socket — every tick, for every peer, sequentially.

**Conflict — Ambition mismatch (archetype-gated):** the declared ambition is "many concurrent players." The current mechanism is O(n) *synchronous* fan-out (one peer's ack blocks the loop from reaching the next peer) carrying O(state-size) payload each tick, with no delta encoding. This is the textbook shape that breaks first under the stated ambition: peer count directly multiplies per-tick blocking time, and per-tick full-state serialization multiplies bandwidth with both peer count and world size. This isn't a stylistic nit — it is the one piece of code that exists specifically to serve the new ambition, and it structurally cannot serve it past a handful of peers.

**Simpler architecture:** replace the spin-wait + full-blob broadcast with an async, event-driven push: peers subscribe once, the server emits state *deltas* on change (or on a fixed broadcast tick) via non-blocking I/O (`socket.write` without waiting for ack, with ack handled as a separate async event), and no single peer's latency can stall the others' updates.

**Deletion test:** the `while (!p.acked) { spin }` busy-wait disappears entirely; the `worldStateBlob` full-state string disappears in favor of per-change deltas; the sequential per-peer loop becomes an unordered broadcast/fan-out that doesn't serialize on individual peer latency.

**Cost honesty:** this is a rewrite of the entire sync path, not a patch — it touches whatever eventually calls `syncTick()`, plus wherever world-state mutations happen (not yet wired to `game.ts`). New risk: delta-based sync requires a reconciliation/resync path for peers that join late or drop a delta, which the current (already broken) design doesn't need to worry about because it always sends full state.

---

## Finding 2 — shared state is propagated by synchronous disk polling, not by push, and every future networked consumer inherits that poll

**Where:** `src/hud.ts:6-9` and `src/audio.ts:4-7` both independently call `loadSettings()` — a synchronous `fs.readFileSync` (`src/settings.ts:5-7`) — once per tick, specifically so each can notice changes `menu.ts` made. `src/menu.ts:3-6` writes settings via `saveSettings()` and leaves a comment confirming the design: *"hud and audio will pick this up on their next per-tick poll."*

**Flow:** menu → disk file → (hud polls disk, audio polls disk) each tick, independently, for the same fact.

**Conflict — Poll where push belongs:** two consumers (`hud`, `audio`) already independently re-derive the same state from a synchronous disk read every tick — this is N=2 today, not N=1, so the "single consumer, leave it" guard doesn't apply. For online co-op, this is the pattern that will get copied for anything that needs to be "the same for everyone": a naive extension puts synchronous file/disk reads (or their networked equivalent, a per-tick poll to a shared store) in the hot per-tick path for every additional system that needs shared state, and every additional connected player multiplies how often that shared state must be re-fetched.

**Simpler architecture:** a settings/shared-state change should be pushed once (an event or observable) to interested subscribers, not re-read from disk by every consumer every tick. `menu.ts` already knows exactly when the value changes — it's the natural emission point.

**Deletion test:** `loadSettings()` calls inside `drawHud()` and `updateAudio()` disappear; the `cached` staleness-check in `hud.ts:3,9,12` disappears (there's nothing to compare against once state is pushed, not polled); `fs.readFileSync`/`fs.writeFileSync` stop being called every frame and become load-once/save-on-change.

**Cost honesty:** touches `hud.ts`, `audio.ts`, `menu.ts`, and `settings.ts`'s public shape (from load/save functions to a subscribe/emit API). New risk: an event-based settings store needs to be seeded correctly at startup and needs its subscribers cleaned up on teardown, which the current stateless-poll design gets "for free" but scales poorly.

---

## Finding 3 — game state is process-wide global singletons, with no seam for per-session state

**Where:** `src/game.ts:5` (`const inv = new Inventory()` — one module-level instance, not passed in or scoped) and `src/netsync.ts:2-3` (`export let peers: any[] = []` / `export let worldStateBlob: string = ''` — module-level mutable globals).

**Flow:** `tick()` in `game.ts` closes over the single global `inv` and calls `simulate()`; `netsync.ts`'s globals are written by whatever will eventually drive multiplayer.

**Conflict — Ambition mismatch:** a single global `Inventory` and a single global `worldStateBlob`/`peers` pair assume exactly one game session per process. "Many concurrent players" in a shared co-op session is survivable with one such session, but the architecture has no seam (no session/room object, no per-connection state container) to extend to more than one concurrent *session* — which matters the moment this is deployed as a service handling more than one co-op party at a time, and even within a single session there's no per-player state (each peer currently only has `acked` and a `socket`; there's no per-peer inventory/position/etc. to broadcast).

**Simpler architecture:** introduce a session/world object that owns its own `Inventory` instances (one per player) and its own peer list, instantiated per co-op session rather than living as module-level globals.

**Deletion test:** the top-level `const inv = new Inventory()` in `game.ts` and the top-level `export let peers`/`worldStateBlob` in `netsync.ts` are deleted; both become fields on a session object constructed per game.

**Cost honesty:** touches `game.ts`'s and `netsync.ts`'s module shape and anything that imports `inv`/`peers`/`worldStateBlob` directly. New risk: introduces an explicit session-lifecycle question (create/destroy) that a global singleton never had to answer.

---

**Fitness bar used:** scale-invested — does the architecture hold up serving a shared co-op session to many concurrently connected players, per the task's explicit pivot away from the README's single-player/offline stance.

**Explicitly not flagged:**
- `save.ts:6-7` recomputing `gold` from items because `inv.gold`'s running total drifts, while still writing both values (`runningGold`) — a real duplicated-source-of-truth bug, but it's a correctness issue in single-player save integrity, not a concurrency/scale bottleneck; peripheral to this bar.
- `settings.ts` using synchronous blocking file I/O (`fs.readFileSync`/`writeFileSync`) at all — flagged only as it's *polled every tick by multiple consumers* (Finding 2); the underlying "settings live in a flat file" choice itself is not a scale problem for the co-op ambition and isn't re-flagged separately.
- General code-quality items (e.g. `(s as any)[key] = value` in `menu.ts:5`) — not a structural/macro conflict, out of scope for this audit.
