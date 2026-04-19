---
name: sector-live-eval
description: |
  Interactive C# REPL against the running Sector game via sector_eval. Use for
  live state inspection, parameter tweaking, triggering events, and exploring
  the object graph without pausing. Like a runtime console for MonoGame.
  Triggers on: eval, evaluate, inspect state, check value, tweak parameter,
  live console, REPL, runtime value, what is the current, set the value,
  change at runtime, test in-game, fire event, trigger
---

# Sector Live Eval Console

Interactive C# evaluation against the running game. Every expression runs on the game's main thread at 60fps — safe to read/write any game state.

## Prerequisites
- Game running in Debug mode
- `sector` MCP server connected

## Available Globals

The eval context exposes:
- `game` — the `Microsoft.Xna.Framework.Game` instance
- `sectorGame` — same instance cast to `dynamic` (access Sector-specific members without compile-time types)

From `game`/`sectorGame` you can navigate to anything:
- `game.Components` — all `DrawableGameComponent` instances
- `game.Services` — `IServiceProvider` with registered services
- `game.GraphicsDevice` — GPU state (careful — writes here crash if you're wrong)
- `game.Content` — ContentManager for loading assets

## Common Recipes

### State Inspection

```csharp
// Is the game active?
return game.IsActive;

// What components are running?
return game.Components.OfType<DrawableGameComponent>()
  .Select(c => new { c.GetType().Name, c.DrawOrder, c.Visible, c.Enabled })
  .OrderBy(c => c.DrawOrder);

// Check a specific service
return game.Services.GetService(typeof(FontSystemService));
```

### HUD State

```csharp
// How many HUD elements are registered?
// Navigate: game → Components → find HudRoot → _children
return sectorGame.Components
  .OfType<object>()
  .Where(c => c.GetType().Name.Contains("Hud"))
  .Select(c => c.GetType().Name);
```

### Ship / Navigation

```csharp
// Check ship physics state
// Navigate through RootScreen → CurrentScene → PilotingScene fields
return new { heading = "use reflection if needed", fuel = "..." };
```

### Parameter Tweaking

```csharp
// Change a value at runtime — effect is immediate, next frame
someEffect.Parameters["RimStrength"].SetValue(0.6f);
return "set RimStrength to 0.6";

// Adjust a constant for testing
HudConstants.RadarRingRadius = 80;  // if not const (readonly fields work)
return "radar radius now 80";
```

### Event Triggering

```csharp
// Fire an event to test handlers
// Navigate to EventBus and publish
return "event fired";
```

## Tips

- **Return something.** The result is serialized to JSON. `return game.IsActive;` gives `{"result":"True","type":"System.Boolean"}`. A void expression gives `null`.
- **Use LINQ.** `System.Linq` is auto-imported. Chain `.Select()`, `.Where()`, `.Any()`.
- **Anonymous types work.** `return new { x = 1, y = "hello" };` serializes cleanly.
- **Dynamic typing via `sectorGame`.** When you don't know the exact type, `sectorGame.SomeProperty` works via dynamic dispatch. Slower but no compile errors.
- **5-second timeout.** Long-running evals get killed. Don't loop forever.
- **Main thread only.** Your code runs in `Update()`. Don't spawn threads or use `Task.Run`.
- **Reflection is your friend.** For private fields: `typeof(T).GetField("_name", BindingFlags.NonPublic | BindingFlags.Instance).GetValue(obj)`.

## Error Handling

If the expression fails:
- **CompilationErrorException**: typo, wrong type, missing using. Check the error message and fix.
- **NullReferenceException**: something in the chain is null. Break into smaller evals to find which link.
- **Timeout**: expression took >5s. Simplify or break into pieces.

## When NOT to Use

- **File operations**: use the Edit/Write tools instead
- **Code changes**: eval is for runtime inspection, not persistent modifications
- **Heavy computation**: 5s timeout; offload to a script
- **Graphics operations**: reading from GraphicsDevice directly can crash. Use `sector_screenshot` instead.
