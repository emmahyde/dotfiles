# Architecture Audit — Aster

Auditing as: Resident senior engineer (no archetype argument given). Fitness bar: idiomatic shape for a single-process, offline terminal roguelike. Ethos: deep, reactive dungeon simulation and moment-to-moment feel — the README states simplicity of the sim core is sacred and explicitly disclaims online features, accounts, cloud saves, and telemetry. Core subsystems: game loop/tick (game.ts), simulation (simulate()), inventory state (inventory.ts). Supporting: hud, audio, settings (feed the feel but aren't the sim). Peripheral: menu (thin UI writer), netsync (explicitly disclaimed).

## Finding 1: Settings polled from disk every tick instead of pushed on change

Where: src/hud.ts:6-13, src/audio.ts:4-8, src/menu.ts:3-8, src/game.ts:7-11 (call site), src/settings.ts:5-11 (sync fs calls)

Flow: game.tick() runs every frame and calls drawHud() and updateAudio() independently. Each of those calls loadSettings(), which does a synchronous fs.readFileSync off disk (settings.ts:6) every single tick, in both places. The only writer is menu.applyMenuChange(), fired on a rare user action, with a comment that says outright: "hud and audio will pick this up on their next per-tick poll" (menu.ts:7).

Conflict: Poll where push belongs. Two consumers (hud, audio) re-derive settings from a blocking disk read every tick, for a value that only changes on an infrequent user action the producer (menu.ts) already knows about. Neither exemption in the guard column applies: this isn't the domain itself (the domain is dungeon-simulation feel, not settings distribution), and it isn't cheap -- it's a synchronous file read sitting in the per-frame hot path of the one system the project says is sacred.

Simpler architecture: menu.ts becomes the single writer and push source for an in-memory settings value; hud and audio subscribe once (a plain notify callback is enough at this scale) instead of re-reading. settings.ts's fs calls run only at startup load and on explicit save from the menu, never on tick.

Deletion test: hud's staleness-tracking dance (cached, the colorblind diff check at hud.ts:9), the per-tick loadSettings() call in both hud.ts and audio.ts, and the disk round-trip from the hot path all disappear. What's left: one shared in-memory value, updated on the rare write.

Cost honesty: Touches 4 files (hud.ts, audio.ts, menu.ts, settings.ts), a small, contained refactor. New risk: a shared mutable settings object needs one clear owner so a future third consumer doesn't reintroduce the same poll pattern; startup still needs an explicit initial load.

## Finding 2: Gold has two sources of truth that are known to drift

Where: src/inventory.ts:5,9,14 (running total mutated on pickup/drop), src/save.ts:3-8 (recompute + dual write)

Flow: Inventory.gold is incremented on pickup() and decremented on drop() (inventory.ts:9,14), a running total. Independently, save.ts:serialize() recomputes gold by summing every item's goldValue at save time, because, per its own comment, "the running total drifts after shop refunds." It then writes both values into the save file (gold: recomputed, runningGold: the drifted total), and load is said to prefer the recomputed one.

Conflict: Duplicated source of truth. The same fact, total gold, is stored and computed in two places that can (and provably do) disagree. This isn't a documented cache with a single owner and an invalidation rule; it's an acknowledged bug that's been papered over by persisting both numbers and picking a winner at load time.

Simpler architecture: Stop storing gold as mutable state. Make Inventory.gold a computed getter over items (get gold() returns items.reduce to sum goldValue). One source of truth, nothing left to drift.

Deletion test: The gold field and its increment/decrement lines in inventory.ts, the drift-workaround recompute in save.ts, and the runningGold field in the save format all disappear, along with the bug that made them necessary.

Cost honesty: Touches inventory.ts and save.ts (2 files visible in this fixture; any other reader of Inventory.gold elsewhere would need checking). Low risk, a getter over an item list is idiomatic; the only consideration is if gold were read in a genuinely hot loop, which isn't evident here.

## Finding 3: Dead module encodes an ambition the project explicitly disclaims

Where: src/netsync.ts (entire file, unreferenced by game.ts or any other module), README.md:10 ("No online features are planned. No accounts, no cloud saves, no telemetry.")

Flow: netsync.ts defines a busy-wait co-op sync loop (syncTick()) that writes the full world-state blob to every peer, every tick. Nothing in the codebase imports or calls it; its own header comment says "EXPERIMENTAL co-op sync (unused; kept from a game-jam branch)."

Conflict: The module is dead code that also structurally contradicts the stated ethos, a networking seam sitting in a source tree for a project whose README says, in plain language, there won't be one. This isn't a case of inventing an unsignaled quality bar (multiplayer scalability is explicitly out of scope per Prohibition 1); the signal here is the README itself disclaiming the exact thing this file implements, combined with the file being unreachable.

Simpler architecture: Delete the file.

Deletion test: The file, its busy-wait spin loop, and the mental overhead of a future contributor wondering whether multiplayer is planned all disappear.

Cost honesty: Touches 1 file, zero call sites to update (confirmed unreferenced by every other module read). No migration risk, straight deletion.

Fitness bar used: Resident senior engineer, judged against a single-process offline terminal roguelike whose stated priority is simulation feel and core simplicity; no scale, plugin, or multiplayer ambition is declared (and multiplayer is explicitly disclaimed).

Explicitly not flagged:
- menu.ts:5's (s as any)[key] = value loose cast: single consumer, three lines, not an architectural seam.
- settings.ts's synchronous fs calls themselves: fine for a single-player offline app at startup/save time; the problem in Finding 1 is when they're called (every tick), not that they're synchronous.
- The busy-wait spin algorithm inside netsync.ts: would be worth flagging if this code ran, but it's dead; the finding is deletion, not fixing a spin-wait no one executes.
