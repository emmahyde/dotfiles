---
name: sector-visual-verify
description: |
  Verify visual changes to the Sector game using screenshots and ASCII layout
  inspection via sector-mcp tools. Use instead of asking the user to launch and
  check manually. Captures before/after screenshots, checks HUD alignment via
  ASCII layout, and confirms rendering changes landed correctly.
  Triggers on: verify visually, check the HUD, does it look right, check
  alignment, verify rendering, visual test, screenshot check, layout check,
  confirm the change, check if it renders, verify the UI
---

# Sector Visual Verification

Verify visual/UI changes without asking the user to manually launch and check. Uses the debug bridge to capture screenshots and inspect HUD layout programmatically.

## Prerequisites
- Game running in Debug mode
- `sector` MCP server connected

## When to Use

Use this skill INSTEAD of telling the user "launch the game and verify." You have the tools to verify yourself:
- After implementing HUD element changes
- After modifying rendering pipeline or draw order
- After changing colors, fonts, or layout constants
- After shader edits (pair with `sector-shader-lab`)
- Before marking a visual task as complete

## Workflow

### Quick Check (single screenshot)

For "does it render at all":
1. `sector_screenshot` — capture current frame
2. Analyze: is the element visible? is it in the right position? correct colors?
3. Report findings with the screenshot

### Layout Verification

For "is the HUD aligned correctly":
1. `sector_layout cols:160` — full ASCII layout
2. Check element positions against design spec:
   - ThrottleFuelPanel top-left?
   - RadarPanel bottom-right?
   - StatusBar full-width bottom?
   - No overlapping elements?
3. `sector_layout highlight:ElementName` — focus on specific element
4. Compare bounds against `HudConstants` values

### Before/After Comparison

For "did my change improve things":
1. `sector_screenshot` — capture BEFORE state
2. Make the code change
3. `sector_shader_reload` or wait for hot-reload
4. `sector_screenshot` — capture AFTER state
5. Compare the two screenshots — describe what changed
6. `sector_layout` before and after if layout changed

### Regression Check

For "did I break something else":
1. `sector_screenshot` — full frame
2. `sector_layout` — all element positions
3. `sector_eval` to spot-check key rendering state:
   ```csharp
   return game.Components.OfType<DrawableGameComponent>()
     .Where(c => c.Visible)
     .Select(c => new { c.GetType().Name, c.DrawOrder });
   ```
4. Check DrawOrder pipeline: all expected layers present and in order?

### Canvas Scenario Verification

For testing specific features in isolation:
1. `sector_eval` to switch to a Canvas scenario:
   ```csharp
   // Navigate to Canvas hub, select scenario
   ```
2. `sector_screenshot` — capture the scenario
3. Verify the feature under test
4. `sector_eval` to return to normal gameplay

## Reporting

When reporting visual verification results:
- Include the screenshot (tool returns PNG via MCP)
- Include ASCII layout if alignment matters
- Note any discrepancies between expected and actual
- If something looks wrong, route to `sector-runtime-debug` Branch B (Visual Glitch)

## Limitations

- Screenshots capture the post-processed frame (CRT/bloom applied) — subtle color changes may be hard to see
- ASCII layout only shows elements that implement `GetDebugBounds()` — some legacy elements won't appear
- No animation verification — screenshots are single-frame. For animation issues, use `sector_eval` to check timing state.
