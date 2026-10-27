---
name: unity-shaders-lighting
description: Author, generate, and debug Unity shaders and lighting from the command line — Shader Graph subgraphs, Custom Function Nodes backed by HLSL, hand-written ShaderLab, shader compilation and stripping, and light setup. Use whenever shaders or lighting are mentioned at all, in 2D or 3D, however small the question. Covers .shader, .shadergraph, .shadersubgraph, .hlsl, cel and toon shading, vertex colour baking, URP, HDRP and Built-in pipelines, Sprite and 2D lights, light probes and baked lighting, material properties and keywords, render features and post-processing, Always Included Shaders and shaders missing from player builds, and any request phrased as wanting shaders "as nodes" or integrated with Shader Graph.
---

# Unity Shader Graph node generation

Shader Graph assets can be authored entirely from the CLI. The types are `internal`, so everything goes through reflection against the `Unity.ShaderGraph.Editor` assembly, executed in the live editor via `unity cmd eval_file`.

## Quick start

```bash
# 1. Write the HLSL (functions must come in _float / _half pairs, outputs as `out` params)
# 2. Edit the CONFIG block at the top of the generator
# 3. Run it, then verify
~/.unity/bin/unity cmd eval_file --file scripts/make_subgraph.cs --timeout 180
~/.unity/bin/unity cmd eval_file --file scripts/verify_subgraph.cs --timeout 120
```

Success looks like `isValid=True` with a non-empty function list:

```
type=SubGraphAsset isValid=True
functionName=SG_<Name>_<hash>_$precision
hlslName=<YourFunction>  functions=1
```

`isValid=False` or `functions=0` means the HLSL failed to bind — wrong function name, missing `_float`/`_half` pair, or a slot/parameter count mismatch.

## Workflow

1. **Write the HLSL.** One `void Name_float(...)` and one `void Name_half(...)`, outputs last as `out` params. Wrap in an include guard. Put it under `Assets/`, anywhere.
2. **Import it and grab its GUID.** `CustomFunctionNode.functionSource` takes the **GUID string**, not a path.
3. **Build the graph** — `GraphData` → `CustomFunctionNode` → slots → `SubGraphOutputNode` → `Connect` → `FileUtilities.WriteShaderGraphToDisk`.
4. **Import and verify.** `ImportAsset` with `ForceSynchronousImport`, then read `isValid`.
5. **Check the console.** `unity cmd console --level Error --tail 10`. Import errors land here, not in the eval result.

Slot order matters: inputs by ascending slot id, then outputs. Insert in call order.

## Non-negotiables

**Never call `CreateShaderSubGraph.Action` or `NewGraphAction.Action` directly.** Both tail-call `ShaderGraphPreferences.GetOrPromptOpenNewGraphOnCreation()`, which can raise a modal dialog and hang the editor bridge with no recovery but manual dismissal. Replicate the method body instead — it is six lines.

**`eval` compiles with warnings as errors.** Obsolete APIs fail the compile. Notably `Object.GetInstanceID()` is deprecated in Unity 6 in favour of `GetEntityId()`.

**Resolve types by simple name as a fallback.** They are not all in `UnityEditor.ShaderGraph` — `HlslSourceType` lives under a `Drawing` namespace. Scan `assembly.GetTypes()` by `Name`.

**A dropped bridge is usually a domain reload.** `No Unity Editor instances found` right after a script change means the editor is reloading. Re-run `unity status`, then retry.

## General shader and lighting work

Node generation is the scripted part. For everything else, the same editor bridge exposes direct verbs — prefer these over `eval`, and prefer both over asking the user to click:

```bash
unity cmd list_shaders                      # name, assetPath, isBuiltin, isSupported
unity cmd get_shader_properties --shader X  # declared property list and types
unity cmd get_material_properties --material X
unity cmd set_material_properties ...       # values, keywords, render queue, shader swap
unity cmd get_lighting_settings             # lightmapper, bounces, AO, directional mode
unity cmd set_lighting_settings ...
unity cmd bake_lighting                     # async; poll lighting_bake_status
unity cmd capture_game_view --save_path out.png
unity cmd recompile                         # then poll recompile_status
```

`isSupported: false` from `list_shaders` is the fastest signal that a shader failed to compile for the active pipeline. `capture_game_view` renders a camera and misses Screen Space Overlay UI; pass `source=screen` in Play Mode for the composited frame.

Diagnose before editing. A shader that renders in the editor but not in a build is almost always stripping, not a shader bug — check Always Included Shaders first.

## Diagnosing invisible, black, or occluded geometry

Screenshot-eyeballing a black region and guessing which shader caused it wastes rounds. Three habits generalize almost every fix below — hold the habit, not the checklist:

### 1. Verify live state — never reason from memory, docs, or an approximation of it

A camera, a scene, or a claim about "what's still in there" is either read from the running instance or it's a guess wearing the clothes of a fact.

- Sweep environment state before the suspect object: light count, per-renderer shadow flags, `RenderSettings.ambientMode`/`ambientLight`/`fog`, the camera's `clearFlags`/`backgroundColor`, whether `Camera.main` even resolves (untagged lab cameras make it null). A "black region" can come from the clear color or a missing light as easily as from geometry.
- Match the diagnostic camera to the real one exactly — position, rotation, FOV, `clearFlags`/background color — not an approximate angle from a temp camera. A near-black solid clear reads nothing like a skybox clear, and the wrong angle can hide the exact artifact being chased.
- Treat doc/state claims about runtime objects ("that sphere was removed") as hypotheses, not fact. A stale note or an edit-mode leftover can diverge from what `[ExecuteAlways]` regenerates in Play Mode — probe the live renderer list (name, shader, bounds, active) instead of citing a prior session.
- If an instrumentation approach is structurally blocked (a domain reload on entering Play Mode wipes a static `EditorApplication.update` handler before it fires), don't retry it — retarget somewhere the same state is reachable. `[ExecuteAlways]` means edit mode runs the same generation code as Play Mode.

### 2. Deduce and predict from domain math before spending an empirical test on it

Rendering has hard physical and geometric constraints. Use them to kill or narrow hypotheses for free, before a capture.

- Additive blending (`Blend One One` / `Blend SrcAlpha One`) can only ever *add* light — it is mathematically incapable of a region darker than the clear color. A black or near-black artifact rules out every additively-blended shader in the scene instantly.
- A depth/`ZTest` setting never bypasses near/far clip-plane culling — clip-space culling happens before rasterization and before the depth test runs, so `ZTest Always` cannot rescue far-plane-clipped geometry. A large background object vanishing in a way no `ZWrite`/`ZTest` change fixes means check `camera.farClipPlane` against the object's world radius and distance from camera, not its depth state.
- Turn a size or shape hypothesis into a number before trusting it: compute the angle an object should subtend, `angularSize ≈ 2 * atan(boundsRadius / distanceToCamera)`, and compare that predicted ratio against what the screenshot actually shows. A mechanism that sounds right but predicts the wrong magnitude is wrong.
- When a bug is inconsistent across two modes/scenes that share code, diff their configs before calling the inconsistency noise — a bug appearing only in one camera rig is usually one differing setting (e.g. `farClipPlane`), and that difference is itself corroborating evidence.

### 3. Run true single-variable experiments, and let them actually update you

An isolation test is only worth running if you let its result overrule your current theory — including a theory you just implemented a fix for.

- Isolate one renderer at a time against a magenta clear, never black: disable all but one candidate, capture, sample the same pixel coordinates, then **re-enable it before moving on**. Pure magenta at a sample = nothing drew there; anything else = that renderer wrote it. Never leave the scene in a partially-disabled diagnostic state.
- The moment an isolation test contradicts the current hypothesis, drop it and say so — don't keep tuning that shader. Expect to reverse yourself more than once; each reversal should be forced by a fresh measurement, not a fresh guess.
- After applying a fix, re-run the *exact same probe* and compare the number, not the picture. A visually-nicer frame is not evidence the change hit the real mechanism — if the tracked pixel sample reads byte-identical before and after, the fix missed. A sample that moved "a little, but still basically the clear color" is itself a clue that the true cause is upstream of where you're looking.
- Delete temporary diagnostic scripts/screenshots once the fix is verified — don't leave `_diag_*.png` or one-off probe components behind in the project.

### Writing safe probe scripts

- Guard every `Material.GetFloat("_X")` (or similar reflection-style property read) with `Material.HasProperty("_X")` first. Custom shaders routinely hardcode `Blend`/`Cull`/`ZWrite` state directly in the pass instead of exposing `_SrcBlend`/`_DstBlend` as material properties, so a naive probe throws on them — that's a probe bug, not evidence the material is broken.
- `Object.GetInstanceID()` is obsolete in Unity 6 — use `GetEntityId()` (also see Non-negotiables above for `eval` compiling with warnings-as-errors).
- Write probe results to a file and read that back rather than dumping through the console — see the log-hygiene guidance in this project's memory.

## Scripts

- [scripts/make_subgraph.cs](scripts/make_subgraph.cs) — generator, CONFIG block at top
- [scripts/verify_subgraph.cs](scripts/verify_subgraph.cs) — validity check

Both are run with `unity cmd eval_file --file <path>`. Copy and edit the CONFIG block per node; the rest is generic across slot types and counts.

## Reference

Full API signatures, the MultiJson file format, and a troubleshooting table: [REFERENCE.md](REFERENCE.md)
