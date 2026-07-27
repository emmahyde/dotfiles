# Handoff — Filled Example

A real-shaped handoff for a mid-flight task. Note what earns space: the verbatim rules, the wrong turns, and the acceptance checks on the tasks. Note what does not: narration of how the session went.

```
# HANDOFF · sector-unity-proto · 2026-07-26 13:40

## MISSION
Surface every engine subsystem the proto touches into the in-game debug UI, so nothing is missed by accident. Spreadsheets are acceptable output — coverage beats polish. The panel is the deliverable, not the prose about it.

## RULES IN FORCE
- "WIRE ALL THE THINGS INTO THE UI. Even if its just like SPREADSHEETS in the game, I want to surface EVERYTHING instead of miss soemthing by accident." — the standing goal; every session-end check is against this.
- "Never wait for confirmation; the user interrupts if needed." — do not stop to ask on ordinary calls; hard stops still need their approvals.
- NOT a git repo: git-diff evidence is replaced by `shasum` + `ls -lT` before and after each edit. Never write N/A.
- mode: thoughtful-terse — peer register, no structural softening, cut 30% before shipping any long message.
- correction: "think i do have shore leave events somewhere. can you do a deeper search?" — generalized: never claim content is absent without searching ~/projects/sector, not just this repo.

## STATE
now     ShipStateSpreadsheet.cs — 30 sections, 4 added this session, compile-unverified
blocked Unity MCP bridge down > need refresh_unity + read_console before any compile claim
?       credit ledger: build in ~/projects/sector/Sector.Engine and copy the DLL, or fork the proto copy — user chose "engine-side", the fork question is unanswered

## LEDGER
verified   ShipStateSpreadsheet.cs braces balance — $ tr -cd '{' < f | wc -c > 101/101
unverified all four new sections compile — $ refresh_unity then read_console
unverified starvation now lands as torso damage — $ enter Play, run 10 days at zero rations

## LESSONS
- assumed BodySystem was unreachable because no manager owns it > wrong: it is app-layer-owned, same as NutritionSystem. Anything with no manager is a candidate for the proto to own, not evidence of a dead end.
- probed the DLL with `strings | grep -qx get_X` and got false MISSING for six members > two causes: the metadata string heap suffix-shares entries, so use unanchored `grep -c`; and public fields have no accessor methods, so `get_` never appears for them.
- searched only Assets/ and EngineSource/ for shore-leave content and reported it absent, three sweeps running > the catalog was in the MonoGame app layer the whole time @~/projects/sector/Sector/App/View/Screens/Windows/Station/ShoreLeaveFactory.cs

## MODEL
The proto consumes the engine as a prebuilt DLL @Assets/Plugins/Sector.Engine.dll; EngineSource/ is a copy, so anything added there and not to ~/projects/sector forks the engine. Unity compiles C# 9 only — no file-scoped namespaces, no target-typed new. Sim plane maps (x, y) to Unity (x, 0, -y). Systems with no manager class are owned by whoever runs the crew: PlayerShipState @Assets/_Project/Proto/PlayerShipState.cs:102 is where that ownership lives.

## RESUME
$ cd ~/projects/sector-unity-proto && shasum Assets/_Project/HUD/ShipStateSpreadsheet.cs
Confirm the file still hashes to 8bc68719, then retry the Unity bridge before touching anything else.

## TASKS
- [H] Compile-verify the four new spreadsheet sections || compile-verifying new spreadsheet sections || Run refresh_unity then read_console. Four sections were added with the bridge down and none has been compiled. Acceptance: read_console returns zero errors referencing ShipStateSpreadsheet, ShoreLeaveFactory, or PlayerShipState.
- [M] Decide credit-ledger placement || deciding credit-ledger placement || User chose an engine-side ledger; the open question is whether it lands in ~/projects/sector/Sector.Engine (one source of truth, needs a DLL rebuild) or the proto's EngineSource copy (fast, forks the engine). Acceptance: choice recorded in docs/STATE.md with the reason.
```
