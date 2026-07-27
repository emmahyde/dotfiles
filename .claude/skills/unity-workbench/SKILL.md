---
name: unity-workbench
description: Closed perceive-act loop for Unity play-mode work — see (screenshot capture), read (correlated state dump), act (synthetic device-event input), draw (live editor instruments). Use when verifying play-mode behavior on screen, confirming HUD/overlay panels visually, injecting keyboard or mouse input into a running Unity game, or iterating UI with screenshot feedback instead of edit-compile-reload cycles.
---

# Unity Workbench

Run agent-driven play-mode work as a closed loop instead of open-loop guessing. Pattern source: imgui-mcp's see/read/act/draw surface; the Unity mapping and its build-out decisions live in the project docs listed at the bottom.

## The loop

Every play-mode iteration is SEE → READ → ACT → SEE′, with DRAW when a question needs an instrument. Never skip the second SEE: a claim about visual state is only as fresh as its capture.

1. **SEE** — capture the game view (`screenshot-game-view`). Prefer A/B pairs around a change over single-shot judgment; a diff carries more information than inspection of one frame.
2. **READ** — correlate pixels to source and state: screen rect ↔ object/element name ↔ creation-site file:line ↔ state snapshot. One-call path: the project's grab resolver via `reflection-method-call` (once built). Fallback composition: `editor-selection-get` / `gameobject-find` / `object-get-data` + the generated creation-site sourcemap + `panel.Pick` for UI Toolkit.
3. **ACT** — inject input with device-level synthetic events only: `InputSystem.QueueStateEvent` reaches `Keyboard.current` polling, which UI-level synthetics never touch. Queue press AND release as a pair; assert on the NEXT frame, never the same one. Use `panel.SendEvent` only when deliberately isolating a UI-listener path from device and focus state.
4. **DRAW** — render instruments or proposals into the live frame. 3D: the SectorDebugDraw pattern (editor-only MonoBehaviour, additive accessors, read-only, per-subsystem toggles). 2D: an OnGUI tee wrapper that draws and logs `{rect, text, file:line}` per frame — immediate mode makes the frame stream the instrumentation point.

## Loop discipline

- Compiling is not behaving. Only a capture from the current session verifies a visual claim.
- Instruments read state, never mutate the sim. Draw code is `#if UNITY_EDITOR`, additive, compiled out of builds.
- Persist evidence to files (append-only JSONL log), never in-memory statics — domain reload nulls statics mid-session.
- Each drawn instrument encodes a falsifiable claim ("halo anchor must coincide with selected body"), not decoration.
- Diagnose before fixing: draw the defect's arithmetic on screen (red = as-shipped, green = corrected) and confirm divergence before editing the code.

## Sharp edges

- Queued input processes at the next InputSystem update — inject-then-assert must span a frame boundary.
- An unpaired press leaves the synthetic key held forever.
- `script-execute` is CodeDOM C#-6-ish (fully-qualified statics, no modern syntax); hot paths go through `reflection-method-call` against committed repo code instead.
- MCP timeouts often fire AFTER the operation succeeded — check expected outputs (`ls -lT`, console logs) before retrying.
- Editor Game-view focus may gate input processing — verify once per project before relying on injection.

## Project mapping (sector-unity-proto)

Read these before building or extending any loop leg there:

- `docs/unity-grab-engineering-decisions.md` — D1–D7 (resolver home, sourcemap, picking, UI stamps, JSONL persistence, output schema, input injection) + investigations I-1..I-6.
- `docs/unity-grab-scope-review.md` / `docs/unity-grab-product-questions.md` — surviving design and open product answers.
- `docs/imgui-mcp-eval.md` — pattern source; the four loop gaps in the Unity MCP bridge.
- `Assets/_Project/Proto/SectorDebugDraw.cs` + `docs/DEBUG_VIZ_PLAN.md` — the draw-leg precedent and its design rationale.

Capability state there (2026-07-26): SEE = raw screenshots only; READ = multi-call MCP composition (grab resolver not yet built); ACT = decided (D7) but no entry point yet; DRAW = SectorDebugDraw for 3D gizmos, OnGUI tee not yet built. Update this line as legs land.
