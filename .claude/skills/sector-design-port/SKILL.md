---
name: sector-design-port
description: Converts Sector design-system HTML mockups (the canvas docs in ~/Downloads/Sector Design System/) into Unity UI Toolkit assets — draft USS from the shared style block, C# VisualElement panel skeleton, demo lab harness, and a play-mode verification probe. Use when asked to bring in or port a named variant from a Sector design doc, convert an HTML/CSS mock into Sector HUD code, or when new HUD/overlay panels must match the design system (frame + corner ticks + hd/bd/row/pill/seg idiom).
---

# Sector design-doc → UI Toolkit port

## Quick start

```bash
S=~/.claude/skills/sector-design-port/scripts/design2uss.py
D="~/Downloads/Sector Design System/<Doc>.html"
python3 $S manifest "$D"                                  # list variants (label, width, classes)
python3 $S uss "$D" > Assets/_Project/HUD/Resources/<Name>.uss
python3 $S scaffold <PanelName> --width <W> > Assets/_Project/HUD/Components/<PanelName>.cs
python3 $S lab <PanelName> --panel <PanelName> --uss <Name> > Assets/_Project/HUD/<PanelName>Lab.cs
```

Then hand-finish the panel body, wire it in, and verify in play mode with `scripts/panel_probe.cs`.

## The pattern (what "matching the design system" means)

- Panel = one sealed `VisualElement` subclass, built entirely in C# (flight widgets skip UXML). Constructor builds the tree; public `Set*()` methods take plain data — no engine types in `Components/`. Cache-and-compare before writing `.text` (CargoTank pattern).
- Frame idiom: `CardBg` background, 1px border, absolute 6px corner-tick children (1px accent border, two sides zeroed per corner).
- Header: row, space-between, ~6/10 padding, bottom border — title ~10px caps Ink2, meta ~9px InkMute. Body: column, ~9/10 padding, gaps as child margins.
- **The design doc's palette IS `FlightColors` verbatim** (amber 244,182,66; info 108,199,224; ok 125,211,164; danger 255,107,107; ink 214,212,194; lines 30/46/70). Use FlightColors in C# and the emitted literals in USS. Do NOT use SectorDesignTokens.uss — that is the overlay's separate amber ramp (255,166,64).
- Font sizes port ~1:1 at 8–12px — PanelSettings scale (1.75) does the retina lifting. Put `.hud-text-label` or an explicit SDF font definition on every Label or it falls back to Unity's default font.
- One USS sheet per design doc in `Assets/_Project/HUD/Resources/`, class names `component__element--modifier`, loaded via `Resources.Load<StyleSheet>("Name")`.

## Workflows

Port checklist (worked example: 2026-08-30 Target+Hopper session → ContactFilePanel, ProcessLineHopperMonitor):

1. `manifest` → pick the variant block(s). Read the panel's inline `style="..."` divs in the HTML — the script only converts the shared `<style>` classes; variant layout (column widths, row layout) is hand-ported.
2. Generate the USS + scaffold; drop into `Assets/_Project/HUD/`; let Unity refresh to mint `.meta` files.
3. Hand-finish: rows/pills/segments/belt lanes per variant; `Set*()` APIs mirroring the data source; change-cached setters. Rename generic `variant-*` child classes to the component's BEM names as you go.
4. Register the panel in `ComponentGallery.BuildGallery` (next numbered entry).
5. Wire the stylesheet wherever the panel appears (`SectorHudController.OnEnable` for the flight HUD).
6. Verify in play mode: enter play, paste `scripts/panel_probe.cs` into unityMCP `execute_code`, run twice (resolvedStyle is 0 on the spawn frame), assert resolved width == spec width, then eyeball/screenshot and get user sign-off.
7. Append a `## Now` line to `docs/STATE.md`.

Demo harness: the `lab` emitter bakes the deferred-build pattern — `OnEnable` can run before the UIDocument attaches its panel root, so the tree builds on the first `Update` where `rootVisualElement` exists. Never build in `OnEnable` alone.

## What the script does NOT do (finish by hand)

- Inline `style="..."` on panel divs — the variant-specific geometry.
- CSS grid (`grid-template-columns`) — UI Toolkit has no grid; use fixed-width columns + `flex-grow` (see ContactFilePanel's 150px left column).
- `text-transform: uppercase` — author the strings uppercase.
- `gap` — emitted as `> *` child margins; trim where trailing margin matters.
- Dashed borders → solid; gradients/box-shadow/clip-path dropped (all noted in the emitted Review notes block).
- Data binding — `Set*()` APIs are yours; live sources so far: scan-revealed rocks (`MiningScanController`), hopper internals (`MiningLoopController`, lot fields currently private).

See [REFERENCE.md](REFERENCE.md) for the full CSS→USS property map, the var→FlightColors table, selector-translation rules, and the play-mode gotcha list.
