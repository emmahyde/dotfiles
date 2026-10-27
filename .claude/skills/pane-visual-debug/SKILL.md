---
name: pane-visual-debug
description: |
  Debug a visual artifact in a Three.js or WebGL game that runs in the Claude
  desktop browser pane, while the user keeps playing in the same tab. Isolate
  the cause with runtime toggle tests, one suspect per screenshot, before you
  name it. Capture evidence at double resolution. Restore the user's state
  after every check. Pair with a headless node harness for the data side.
  Triggers on: jagged, staircase, mottled, seam, teeth, why does it look like
  that, not actually validating, pane check, shoreline, foam, shader artifact,
  terrain artifact, keep working until it is right.
---

# Pane Visual Debug

Use this skill when a user reports that something looks wrong in the game pane. The user can see the pane and may send phone screenshots of it. The goal is one pass that isolates the cause by elimination, fixes it at the source, and proves the fix with evidence. Guessing the cause from the symptom is the failure mode this skill exists to stop.

## Rules

- Do not name a cause until a toggle test shows it. "It was already like that" and "that is the mesh" are claims. Show the toggle shots first.
- Do not hand a visual follow-up back to the user as a new queue item when the current work caused it. Keep working in one shot until the user says it is right.
- The user plays in the pane. Do not open or close tabs in the foreground. Do not start a second dev server. Background verifier agents must stay headless.
- Restore the user's state after every check: clock, player position, viewport size, save data.

## Workflow

```
  report ──► reproduce ──► toggle suspects ──► fix ──► prove ──► restore ──► commit
     │           │               │              │        │          │
     │      2x viewport     one change      smallest  2x shots   clock, pos,
     │      zoom region     per shot        diff      + build    viewport, save
     │
     └─ phone screenshot? crop region ≈ what the user zoomed on
```

### 1. Reproduce at double resolution

Pane screenshots are 800 px wide for a 1347 px page, so fine artifacts vanish. Emulate a small viewport to get two page pixels per screenshot pixel.

1. `resize_window` width 400, height 246.
2. Dispatch `window.dispatchEvent(new Event('resize'))` so the game resizes its canvas.
3. Move the camera with the game's dev hook, then `wait` 1.5 s.
4. `computer zoom` on a region. Zoom crops, it does not magnify, so pick a small region.
5. `resize_window` preset `desktop` and dispatch `resize` again when done.

If a screenshot times out with "window covered or not painting", the canvas is drawn tiny after a pane resize. `resize_window` preset `desktop` clears it.

### 2. Isolate by elimination, one suspect per shot

List every system that touches the pixels: lighting, shadows, each mesh, each shader block you wrote, each texture. Find scene objects by a unique signature, such as vertex count, then flip one property per screenshot. Keep the camera fixed. Compare against a baseline shot. Stop when exactly one toggle removes the artifact.

| Suspect | Toggle |
|---|---|
| Shadow map stairs | `mesh.castShadow = false` on the receiver's occluders |
| Transparent overlay | `mesh.visible = false` on the overlay |
| Mesh resolution | swap `mesh.geometry` for a coarse and a fine `PlaneGeometry`; missing attributes render black, which still shows the edge |
| A shader block you added | strip the block from source, let Vite reload, shoot, then `git checkout -- file` |
| Texture grid | sample the texture headless and print values along a ray |

Read the result as a table: which toggle removed the artifact. If none did, the cause is upstream of rendering, usually the source function that generated the geometry or texture. Inspect that function for steps, kinks, and plateaus at the line where the artifact appears.

Example from the shoreline case: shadows off, no change. Water hidden, no change. Run-up shader block stripped, stairs gone. That named the block. A second artifact survived coarse and fine water planes alike, which pointed at the terrain, and the height function had a 0.15 step at the coast.

### 3. Fix the cause, not the pixel

- A contour of mesh-interpolated height kinks at every cell. Drive lines and strips from a smooth field instead: a baked bilinear texture or an analytic function.
- A step or a kink in a height function renders as a zigzag shelf wherever a plane cuts it. Make the function continuous at the line that a plane will cut.
- A distance texture with a flat plateau of zeros snaps edges to the texel grid. Store a signed distance so the zero crossing interpolates between texels.
- Thin high-frequency lines alias. Widen the smoothstep and lower the frequency before you add samples.

### 4. Prove it

1. Repeat the exact baseline shot at double resolution, on at least two sites, for example the open beach and a structure like a dock.
2. Run a production build in a `/tmp` copy with a `node_modules` symlink. Never build into the project.
3. Send the shots to the user with `SendUserFile` so the phone shows the same evidence.

### 5. Restore

Set the clock and position back, reset the viewport, and confirm the save data is unchanged. Check for stale console errors that persist across reloads and ignore them; look only for new ones.

## Headless harness for data

Stub the DOM before importing a module that creates canvases or textures:

```js
globalThis.document = { createElement: () => ({ getContext: () => new Proxy({}, { get: (t, k) => k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : (typeof k === 'string' ? () => {} : undefined), set: () => true }), width: 0, height: 0, toDataURL: () => '' }) };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
```

Do not assign `globalThis.navigator`; it is getter-only in Node 26. Symlink `node_modules` into the `/tmp` folder. Print texture values along a ray and check sign, monotonic growth, and bake time. Check shader strings by calling `material.onBeforeCompile` on `THREE.ShaderLib.toon` and asserting declaration order with `indexOf`.

## Snorkelnasium specifics

- Dev hook: `window.snork = { penguin, fish, idle, tp(x, z), home, sleep, hour(h), cave, parts }`. The island scene is `snork.penguin.parent`.
- Terrain mesh has 361201 vertices. Water plane has 40401.
- Restore: `snork.hour(4); snork.tp(3, 3)`. The save is `localStorage['snorkelnasium.save']` and must keep no `look` unless the user picked one.
- Stale console errors to ignore: torches.js read-only position, world.js seeded, hud.setCollection, duplicate clock.
- Pane key taps do not move the player. Dispatch `KeyboardEvent` on `window`.

See [references/shore-foam.md](references/shore-foam.md) for the foam and coast findings.
