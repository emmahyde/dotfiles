---
name: sector-frame-composition
description: |
  Guide for building and debugging Sector's frame composition — the DrawOrder
  pipeline, render layers, screen stack, and HUD element registration. Teaches
  how to register new visual components so they appear in the ASCII layout
  readout (sector_layout), how to set correct DrawOrder, and how to debug
  z-ordering and missing elements. Use when adding new screens, overlays,
  HUD elements, or DrawableGameComponents, or when something renders in the
  wrong order or doesn't appear in the layout diagnostic.
  Triggers on: draw order, render pipeline, frame composition, z-order,
  layer order, DrawableGameComponent, register component, add to HUD,
  screen stack, overlay, render layer, missing from layout, not rendering,
  wrong draw order, behind other elements
---

# Sector Frame Composition

How Sector's rendering pipeline composes a frame, and how to add new visual elements that integrate with the ASCII layout diagnostic (`sector_layout`).

## The DrawOrder Pipeline

Every visual element in Sector is a `DrawableGameComponent` registered with `game.Components`. MonoGame draws them in `DrawOrder` ascending order each frame. The pipeline:

```
DrawOrder  Component                  What it does
───────────────────────────────────────────────────────────────
  0        RenderCaptureComponent     Creates/clears shared RT
 10        BackgroundLayer            Starfield parallax, nebula
 10        WorldObjectRenderer        3D objects → atlas RT
 20        WorldLayer                 Atlas sprites at world pos
 20        HudRoot (NEW)              All HUD elements (merged)
 20        StrategicOverlayLayer      Strategic map overlay
 40        UIComponentLayer           Component-based UI panels
 40        ScreenRenderLayer          Direct-rendering screens
 60        TooltipRenderLayer         Pixel tooltips
 70        PostProcessLayer           Bloom, vignette, CRT
 80        FrameCaptureService        F2 recording overlay
```

## Adding a New Visual Element

### Option A: HUD element (most common)

For elements visible during piloting (status bars, panels, overlays):

1. Create a class implementing `IHudElement`:
   ```csharp
   namespace Sector.App.View.Screens.HUDElements.New;

   public sealed class MyPanel : IHudElement {
     private Rectangle _bounds;

     public void Update(float delta) { /* update state */ }

     public void Draw(SpriteBatch sb, FontSystemService fonts, Texture2D pixel) {
       // render your element
       _bounds = new Rectangle(x, y, w, h);
     }

     public (Rectangle Bounds, string Label) GetDebugBounds() {
       return (_bounds, "Mp");  // 2-char label for ASCII layout
     }
   }
   ```

2. Register in `HudRoot.cs`:
   ```csharp
   MyPanel myPanel = new MyPanel(provider);
   Register(myPanel);
   ```

3. Verify with `sector_layout` — your element should appear as `Mp` in the grid.

### Option B: DrawableGameComponent (for pipeline-level rendering)

For things that need their own draw pass (post-processing, world-space overlays):

1. Create a `DrawableGameComponent`:
   ```csharp
   public sealed class MyLayer : DrawableGameComponent {
     public MyLayer(Game game) : base(game) {
       DrawOrder = 25;  // pick an order from the pipeline table
     }
     public override void Draw(GameTime gameTime) { ... }
   }
   ```

2. Register with the game:
   ```csharp
   game.Components.Add(new MyLayer(game));
   ```

3. To appear in `sector_layout`, implement `GetDebugBounds`:
   ```csharp
   public (Rectangle Bounds, string Label) GetDebugBounds() {
     return (new Rectangle(0, 0, viewport.Width, viewport.Height), "Ml");
   }
   ```

### Option C: GameScreen (for full-screen views)

For modal screens (menus, overlays, computer views):

1. Extend `GameScreen` with `UsesDirectRendering => true`
2. Push onto the screen stack via `SceneContainer` actions
3. These render at DrawOrder 40 via `ScreenRenderLayer`
4. To appear in `sector_layout`, add `GetDebugBounds` — but most GameScreens are full-viewport

## Making Elements Visible to `sector_layout`

The ASCII layout tool discovers elements by:
1. Walking `game.Components` for any object with a `GetDebugBounds()` method (via reflection)
2. Walking `HudRoot._children` for `IHudElement` instances with `GetDebugBounds()`

**The contract:**
- Method name: `GetDebugBounds`
- Return type: `(Rectangle Bounds, string Label)` or `DebugRect`
- The `Label` should be 2 chars (e.g. `"Th"`, `"Ra"`, `"Mi"`)
- Some elements accept `(int viewportWidth, int viewportHeight)` params — both signatures are discovered

**If your element doesn't appear in `sector_layout`:**
1. Check it implements `GetDebugBounds` with the right signature
2. Check the bounds `Rectangle` is non-empty (width/height > 0)
3. Check the element is registered (in HudRoot or game.Components)
4. Use `sector_eval` to verify: `return game.Components.Count;` or check `HudRoot._children.Count`

## Debugging Draw Order Issues

### Element renders behind something it shouldn't

```
sector_eval:
  return game.Components.OfType<DrawableGameComponent>()
    .Select(c => new { c.GetType().Name, c.DrawOrder, c.Visible })
    .OrderBy(c => c.DrawOrder);
```

Check: is your element's `DrawOrder` lower than the occluding element? Raise it.

### Element doesn't render at all

1. `sector_layout` — is it in the grid?
   - Yes → it's registered but not drawing. Check `Visible`, `Enabled`, draw conditions
   - No → not registered. Check construction + `game.Components.Add` or `HudRoot.Register`
2. `sector_screenshot` — look for it visually
3. `sector_eval` to check `Visible` and `Enabled` properties

### Overlapping elements

1. `sector_layout` — overlapping labels show the higher-z element
2. To see both: `sector_layout highlight:ElementA` then `sector_layout highlight:ElementB`
3. Adjust `DrawOrder` or bounds to resolve

## Screen Stack and Overlays

The screen stack determines which `GameScreen`s are active:

```
RootScreen
  └── CurrentScene (SceneContainer — e.g. PilotingScene)
        └── Overlay stack (pushed GameScreens)
              └── e.g. ShipComputerOverlay
                    └── Computer view stack (IComputerView)
```

- Only the top overlay receives input
- All overlays render (transparent stack)
- `SceneAction.PushOverlay(screen)` / `PopOverlay` manage the stack
- HUD elements render independently of the screen stack (always visible during piloting)

## Common DrawOrder Mistakes

| Mistake | Fix |
|---------|-----|
| HUD renders behind world objects | HudRoot should be DrawOrder 20 (same as WorldLayer — draws after in registration order) |
| Tooltip hidden behind HUD | Tooltips are DrawOrder 60, always on top of HUD (20-40) |
| Post-process doesn't affect new layer | PostProcessLayer (70) composites the shared RT. New layers must draw TO the shared RT, not the backbuffer |
| New layer draws to wrong target | Check that you're drawing to `RenderCaptureComponent.Target`, not `GraphicsDevice.BackBuffer` |

## Verification Workflow

After adding or modifying a visual element:

1. `sector_layout` — confirm element appears with correct label and position
2. `sector_screenshot` — confirm it renders visually
3. `sector_eval` — spot-check properties:
   ```csharp
   return new { myElement.Visible, myElement.DrawOrder, myElement.Enabled };
   ```
4. If using `sector-visual-verify` skill, it automates steps 1-3
