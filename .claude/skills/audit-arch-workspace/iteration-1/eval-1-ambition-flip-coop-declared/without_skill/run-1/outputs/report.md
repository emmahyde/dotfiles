# Architecture Audit: Aster — Readiness for Online Co-op at Scale

**Scope:** README.md + src/*.ts (game.ts, hud.ts, audio.ts, settings.ts, menu.ts, inventory.ts, save.ts, netsync.ts)
**Framing:** Evaluated against the stated new goal — online co-op supporting many concurrent players — not against the project's original single-player design intent.

## Summary

Aster is architected, down to its core data-flow pattern, as a single offline process with no player/session concept. This isn't a gap that can be patched at the edges — the central mechanisms the sim relies on (a module-level singleton for game state, per-tick disk polling as the "sync" primitive, and a single global settings file) are the opposite of what a concurrent multiplayer architecture needs. The one artifact in the repo that already attempts networking (`netsync.ts`) demonstrates the failure mode directly: full-state broadcast plus blocking waits, which does not scale past a handful of peers and stalls the game loop while it runs.

The repo also contains an explicit statement of intent (README.md) that no online features are planned and that simplicity of the sim core is "sacred." That's not a nitpick — it means the new co-op ambition is a fork in the project's architecture, not an incremental feature, and the codebase should be read as a from-scratch redesign candidate rather than a system to extend in place.

## Findings

### 1. Game state is a process-local singleton, not player-scoped data

`game.ts` constructs one `Inventory` at module load (`const inv = new Inventory()`) and drives one `tick()` function that calls `simulate()`, `drawHud()`, `updateAudio()` in sequence. There is no notion anywhere in the codebase of "whose" inventory, HUD, or audio state this is. Every subsystem (`hud.ts`, `audio.ts`, `inventory.ts`) is written against exactly one implicit player.

Supporting many concurrent players means every one of these becomes a collection keyed by player/session id, with per-player HUD render targets, per-player audio streams, and per-player (or shared, contested) inventory. That's not a refactor of `inventory.ts` — it's a redesign of what "game state" means in this codebase, because right now the type system and module structure assume there is exactly one.

### 2. The only synchronization primitive in the app is "poll a shared file every frame"

`hud.ts` and `audio.ts` each independently call `loadSettings()` — which does a synchronous `fs.readFileSync('settings.json', ...)` — once per tick, specifically so they'll notice changes written by `menu.ts` via `saveSettings()`. This is the project's entire cross-module state-propagation strategy: no events, no pub/sub, no shared in-memory store — disk I/O as a message bus, re-read on every frame by every consumer.

This pattern cannot become a multiplayer sync mechanism. It's synchronous disk I/O in the hot per-tick path (already a latency/throughput concern on one machine), it has no concept of *which* client's settings apply, and there's no server authority or conflict resolution — two writers to `settings.json` just clobber each other. If this poll-and-reread idiom is the template other systems follow when networking is bolted on, expect the same shape of bug (last-write-wins races, no ordering guarantees) to reappear at the network layer.

### 3. The existing network code is a worked example of what won't scale

`netsync.ts` is explicitly marked experimental/unused, but it's worth treating as a signal of the default networking instinct in this codebase, because it embodies the two biggest scaling anti-patterns for concurrent multiplayer:

- **O(peers) full-state broadcast every tick**, with no delta/interest-based sync (`p.socket.write(worldStateBlob)` for every peer, every tick) — bandwidth and serialization cost scale linearly per peer per frame, so total cost scales quadratically with peer count.
- **Blocking, synchronous acknowledgement wait** (`while (!p.acked) { /* spin */ }`) inside the tick loop — one slow or disconnected peer stalls the entire simulation for everyone, and it's a busy-wait spin rather than even a blocking-but-yielding wait.

Neither issue is fixable by tuning; both require a different sync model from the ground up (authoritative server + delta/interest-managed replication + non-blocking network I/O decoupled from the sim tick).

### 4. No separation between simulation, presentation, and I/O

`tick()` in `game.ts` calls simulate → draw → audio in one synchronous function, and `hud.ts`/`audio.ts` reach into settings I/O directly rather than through any state/service boundary. There's no layer where a network transport could be inserted without touching every subsystem — e.g., there's no "authoritative simulation" function that could run server-side and be fed to N client renderers; simulation and rendering are one call chain.

For a many-player co-op architecture, this boundary (sim/state vs. presentation vs. transport) is exactly what needs to exist first. Its absence here means the redesign has to start with introducing that seam, not with adding a network module alongside the existing ones.

### 5. State integrity already has silent-drift problems in the single-player case

`save.ts` recomputes `gold` from `inv.items` at serialize time because the incrementally-maintained running total (`inv.gold`, updated in `Inventory.pickup`/`drop`) is known to drift ("gold drifts after shop refunds"), and both values are persisted with the recomputed one preferred on load. That's a symptom of mutable state with two sources of truth and no single authority reconciling them — currently patched by recomputing at save time.

This matters for the co-op question specifically: introduce concurrent writers to the same inventory (trading, shared loot, PvP) and this kind of ad hoc drift-and-reconcile approach becomes a desync and cheating vector rather than a save-file quirk. It's evidence the state-mutation model needs a single source of truth *before* it's exposed to concurrent access, not after.

## Bottom line

Every mechanism currently used to move state around this codebase — module-level singletons, per-tick disk polling, direct synchronous writes — is the pattern you'd specifically avoid when designing for many concurrent players. Supporting real-time co-op isn't a matter of adding a `netsync` module next to the existing ones (and the one prior attempt at that shows why); it requires: (a) player/session-scoped state instead of singletons, (b) an authoritative-state-plus-delta-replication model instead of full-blob broadcast, (c) a sim/presentation/transport boundary that doesn't currently exist, and (d) resolving the existing single-source-of-truth gaps (e.g., inventory gold) before they become concurrent-write hazards. Treat this as a new architecture layered under (or replacing) the current sim core, not an extension of it.
