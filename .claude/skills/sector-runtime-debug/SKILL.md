---
name: sector-runtime-debug
description: |
  Diagnose runtime bugs, visual glitches, and unexpected behavior in the Sector
  MonoGame game by inspecting the live game via sector-mcp debug bridge tools.
  Adaptive — routes to different diagnostic paths based on symptoms.
  Triggers on: debug sector, why is the game, not working, broken, crash,
  glitch, wrong behavior, investigate runtime, diagnose, game bug,
  HUD not showing, ship not moving, rendering wrong
---

# Sector Runtime Debugger

Diagnose and fix Sector game issues using the in-process debug bridge (`sector-mcp` tools).

## Prerequisites
- Game running in Debug mode (`dotnet run --project Sector`)
- `sector` MCP server connected (check with `sector_status`)
- If `sector_status` fails: game isn't running or bridge didn't start. Check `~/.sector/debug-port`.

## Step 1: Classify the Symptom

| Symptom | Branch | Primary Tools |
|---------|--------|---------------|
| Crash, exception in console | **A: Crash** | `sector_eval`, `sector_tree`, game.log/crash.log |
| Something looks wrong visually | **B: Visual** | `sector_screenshot`, `sector_layout`, `sector_eval` |
| Game logic doesn't work as expected | **C: Logic** | `sector_eval`, `sector_tree` |
| Low FPS, stuttering | **D: Performance** | `sector_eval`, `sector_tree` |
| HUD element missing or misplaced | **E: HUD** | `sector_layout`, `sector_screenshot`, `sector_eval` |
| Shader looks wrong | **F: Shader** | `sector_screenshot`, `sector_shader_reload`, `sector_eval` |

## Branch A: Crash / Exception

1. Read `crash.log` and `game.log` (in `Sector/bin/Debug/net10.0/`)
2. `sector_eval` to inspect state at the crash site:
   ```csharp
   // Check if a component exists
   return game.Components.OfType<SomeComponent>().Any();
   ```
3. `sector_tree` with `root=Components` to verify the component graph
4. Common causes:
   - **NullReferenceException**: component not registered, session state not initialized
   - **InvalidOperationException**: collection modified during iteration (EventBus subscriber issue)
   - **GraphicsDevice error**: drawing outside the draw thread

## Branch B: Visual Glitch

1. `sector_screenshot` — capture what it actually looks like
2. Analyze the screenshot: what's wrong vs expected?
3. `sector_eval` to check rendering state:
   ```csharp
   // Check draw order components
   return game.Components.OfType<DrawableGameComponent>()
     .Select(c => new { c.GetType().Name, c.DrawOrder, c.Visible })
     .OrderBy(c => c.DrawOrder);
   ```
4. If a layer is invisible: check `Visible` property, `Enabled` property
5. If z-ordering is wrong: check `DrawOrder` values against the pipeline table
6. `sector_screenshot` again after each fix attempt to verify

## Branch C: Logic Bug

1. `sector_tree` with `root=SessionState` — dump current session state
2. `sector_eval` to probe specific values:
   ```csharp
   // Check ship state
   var ship = sectorGame./* navigate to ship state */;
   return new { ship.Fuel, ship.Position, ship.Heading };
   ```
3. `sector_eval` to call methods and observe effects:
   ```csharp
   // Test event firing
   return sectorGame./* navigate to EventBus */.Publish(new SomeEvent());
   ```
4. Narrow down: is the data wrong, the event not firing, or the condition incorrect?
5. Read the relevant source code to confirm the bug

## Branch D: Performance

1. `sector_eval` to check frame timing:
   ```csharp
   return new { game.TargetElapsedTime, game.IsFixedTimeStep, game.IsRunningSlowly };
   ```
2. `sector_tree` with `root=Components` — count active components
3. `sector_eval` to profile specific subsystems:
   ```csharp
   // Count collision actors
   return game.Components.OfType<CollisionComponent>().FirstOrDefault()?./* count */;
   ```
4. Common causes:
   - Too many collision actors (O(N^2) — see memory note on collision actor removal)
   - Nebula generation on main thread
   - Large event subscriber lists

## Branch E: HUD Issue

1. `sector_layout` — see where every HUD element thinks it is
2. `sector_layout` with `highlight=ElementName` — focus on one element
3. `sector_screenshot` — compare actual rendering to layout positions
4. `sector_eval` to check element state:
   ```csharp
   // Check if HudRoot has elements registered
   return sectorGame./* navigate to HudRoot */._children.Count;
   ```
5. If element is missing from layout: not registered in HudRoot
6. If element is in wrong position: check its bounds calculation

## Branch F: Shader Issue

Route to the `sector-shader-lab` skill for iterative shader work. Quick checks:
1. `sector_screenshot` to see current rendering
2. `sector_eval` to check effect parameters:
   ```csharp
   // Inspect a shader parameter
   return someEffect.Parameters["ParamName"]?.GetValueSingle();
   ```
3. `sector_shader_reload` to recompile and swap

## Iteration Strategy

- Screenshot before AND after each fix to confirm resolution
- Use `sector_eval` liberally — it's cheap and runs on the main thread
- `sector_tree` is expensive (reflection walk) — use sparingly, prefer targeted `sector_eval`
- Check `game.log` for EventBus handler errors (they're caught and logged, not thrown)
- When stuck, `sector_tree root=RootScreen depth=2` gives a good overview of the screen stack
