# Architecture Audit: Aster

Scope: README.md + all files under src/ (audio.ts, game.ts, hud.ts, inventory.ts, menu.ts, netsync.ts, save.ts, settings.ts). Structural findings only, not line-level nitpicks.

## 1. A dead network-sync module contradicts the project's stated design philosophy

`src/netsync.ts` implements co-op peer synchronization — a spin-wait loop that blocks until every peer acknowledges, then pushes the *entire* world-state blob to every peer on *every* tick. The file's own header comment calls it "EXPERIMENTAL... unused; kept from a game-jam branch."

The README states unambiguously: "A single-player terminal roguelike. Pure offline experience... No online features are planned. No accounts, no cloud saves, no telemetry," and frames "simplicity of the sim core" as "sacred."

This is not a style nitpick — it's a structural contradiction between the codebase and its own charter. A module implementing the single most complex, riskiest class of feature the project explicitly rules out (networking, with a busy-wait/full-broadcast design that would be a performance and correctness liability if ever wired in) is sitting live in `src/`, importable, and indistinguishable at a glance from real functionality. Anyone auditing "what does this game do" from the source tree alone would conclude it has multiplayer aspirations. Either delete it or, if it must be preserved as reference, move it out of `src/` entirely (e.g. into a `graveyard/` or a separate branch) so the source tree matches the stated architecture.

## 2. Settings access is poll-per-tick disk I/O with no shared runtime state

`settings.ts` wraps synchronous file I/O (`fs.readFileSync`/`writeFileSync`) with no in-memory cache of its own. Both `hud.ts` and `audio.ts` independently call `loadSettings()` once per tick (called from `game.ts`'s `tick()`), and `menu.ts` calls `saveSettings()` on every menu change. There is no single in-memory source of truth for settings and no push/notify mechanism — every consumer polls disk, every frame, to detect changes made elsewhere.

This is a systemic architectural gap, not a local inefficiency: the pattern will be repeated by every future subsystem that needs settings (or any other shared state), because there is no shared-state layer to plug into — only "re-read the file." `hud.ts`'s own comment ("re-read settings from disk each frame in case the menu changed them") shows the team is aware of and accepting this as the mechanism, rather than treating it as a stopgap. As the simulation grows — which the README says is the whole point of the project — this poll-every-tick-per-consumer pattern is the shape that will need to be unwound first; better to introduce a shared settings/state object (loaded once, mutated in place, optionally persisted) now while there are only three consumers.

## 3. Two sources of truth for inventory gold, reconciled silently at serialization time

`Inventory` maintains a running `gold` total, incremented/decremented in `pickup()`/`drop()`. `save.ts`, when serializing, recomputes gold from scratch by summing `items[].goldValue`, and writes *both* values to the save file (`gold` = recomputed, `runningGold` = the live running total) — with a comment stating the running total "drifts after shop refunds" and that "load prefers" the recomputed one.

This is a real architectural smell: a value that's supposed to be a single fact about game state (the player's gold) is tracked two different ways in two different places, they're known to disagree, and the discrepancy is patched over at the save boundary instead of at the mutation site that causes the drift. There is no `shop.ts` in this codebase, so the actual refund logic causing the drift isn't visible here — but the fix belongs in `Inventory` (make gold derived-only, or make every mutation path go through `pickup`/`drop` so the running total can't drift), not in `save.ts` papering over it. Shipping a save format with two gold fields and a documented "prefer this one" rule is a sign the underlying invariant is already broken, and it will resurface anywhere else gold is read (HUD display, shop pricing, etc.) that isn't going through the save/load round-trip.

## 4. No orchestration boundary between simulation, rendering, and audio

`game.ts.tick()` is a flat, hardcoded sequence: `simulate(); drawHud(); updateAudio();`. There's no scheduler, event bus, or explicit state object passed between stages — each stage independently reaches out (to settings, to module-level state) rather than being handed what it needs. For the project's stated scope (single-player, sim-focused) this is a defensible minimal starting point, but combined with finding #2, it means the *only* channel these systems have for talking to each other is "poll shared external state." As more systems are added to deepen the simulation (the stated goal), this tick function has no natural extension point — new systems will each be bolted onto the same flat call list and reach for the same disk-polling pattern, compounding both problems above.

## Summary

The codebase is small enough that none of these are urgent in isolation, but together they describe a project without a settings/state-sharing layer, without a single-source-of-truth discipline for derived values, and with dead, out-of-charter code left in the main source tree. Given the README's explicit philosophy ("simplicity of the sim core is sacred," "no online features are planned"), the highest-leverage cleanup is: delete or relocate `netsync.ts`, introduce one shared settings/state object that's loaded once and updated in place (replacing the per-tick disk polls), and make `Inventory.gold` the single source of truth rather than reconciling a drifted duplicate in `save.ts`.
