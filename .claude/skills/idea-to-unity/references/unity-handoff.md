# Integration-ready Unity iteration

## Verify the current pipeline

Resolve project paths from the active repository root, not this skill directory. For Sector, read `docs/UNITY-PIPELINE.md`, relevant current decisions in `docs/STATE.md`, and `tools/design-kit/README.md` before native work. Inspect the current importer or command implementation when documentation conflicts. Do not assume an older skill's MCP, MonoGame, or C#-only UI workflow still applies.

Use the existing `scripts/unity-pipeline.py` runner for Unity operations. Discover supported command arguments from current documentation or help rather than inventing them. In another repository, locate its equivalent pipeline and contracts; do not create a competing importer because these paths are absent.

## Keep experiments separate without creating a separate product

Separate experimental placement and test state from production content. Do not separate the implementation from the real integration path.

Before extending a prototype, identify its intended production component or prefab, data source, input path, material/render path, and destination scene. Reuse these contracts and components where appropriate. Keep the lab as a thin scene or harness that instantiates the real implementation with controlled inputs. Keep shared behavior in the component that will ship, not in lab-only copies.

Treat lab-only approval as permission to exercise the experiment, not to alter existing production consumers. Keep new behavior inactive for those consumers and preserve their current material, prefab, and data settings. Inspect shared consumers before editing a shared component or asset. If a shared change necessarily affects production behavior, obtain approval for that effect first; do not work around the boundary by duplicating gameplay implementations.

Use representative dimensions, camera scale, rendering settings, and interaction conditions. Use existing project data where practical. Label any fixtures or synthetic data; do not let fixture behavior stand in for system integration evidence. Make integration a matter of wiring or placement, not a later rewrite.

Avoid premature generalization: do not build a universal lab framework, separate event system, fake gameplay engine, configuration dashboard, or prototype-only asset pipeline. Reuse the existing lab or add the smallest scene needed. Do not add a custom selector when existing presets, editor fields, or direct commands suffice.

## Watch for isolation becoming expensive

At each review, check for these signals:

- A browser mock is accumulating game state, input handling, physics, animation logic, or rendering approximations that Unity already owns.
- A lab duplicates a production component, schema, asset, or interaction path.
- A visual decision depends on actual camera scale, frame timing, occlusion, post-processing, lighting, physics, or UI Toolkit behavior.
- Changes require repeated manual translation, and the next iteration is mostly integration guesswork.
- The mock's controls or scaffolding are receiving more work than the feature itself.

When a signal appears, say what is becoming unreliable or wasteful. Suggest the smallest in-engine experiment, which existing systems it will use, and what the human will be able to judge. Do not continue polishing the isolated mock by default.

If native prototyping is not yet approved, ask for scoped approval to move the comparison into Unity; do not treat the suggestion as approval to import or change production content. Once approved, iterate in-engine without repeatedly rebuilding the external mock. Preserve at least three comparable alternatives per review, using native presets or recorded evidence rather than three separate applications.

## Route by what needs proof

| Topic | First evidence | Native iteration and integration check |
|---|---|---|
| 3D models or modeling-heavy visuals | Design-kit silhouettes, proportions, materials, sockets, matched views | Import approved variants; check actual scale, editable materials, socket orientation, placement, and gameplay-distance readability |
| Animation | Key poses, timing strip, interruption storyboard | Use the real rig, transforms, or controller; test start, completion, cancellation, blending, repeated activation, and target framerate |
| Major lighting | Value/composition study and attention hierarchy; reuse the kit lighting contract only when relevant | Use real URP materials, camera, volumes, and render features; compare matched exposures, shadow readability, HUD contrast, and cost |
| Gameplay | Action-feedback-consequence diagram and success/failure branches | Exercise real input and state changes; verify reset, retry, interruption, consequences, and integration with affected systems |
| HUD | Wireframes and normal/empty/warning/overflow states | Use native UI Toolkit assets and real data bindings; verify scaling, focus, input, occlusion, and legibility |

For mixed requests, split the uncertainty, not the product: sketch model form in design-kit, then test its motion or interaction through the native implementation. Do not build a browser game to demonstrate a model's purpose.

For new Sector panels, keep UXML, USS, and PanelSettings independent as required by current project conventions; share approved palette values rather than coupling to unrelated HUD assets. Asset independence must not become duplicated gameplay or data-binding logic.

## Import approved design-kit variants

1. Confirm the reviewed source, recipe, stable variant ID, and approved destination. Inspect supported capabilities before promising export parity.
2. Use the Node version pinned in `tools/design-kit/toolchain.json`. Do not assume the default `node` matches it.
3. Preserve stable part and material IDs, units, transforms, and socket roles. Check importer support before topology changes. Do not apply pruning or destructive migration flags by default.
4. Export each approved variant through the existing exporter. Use distinct IDs for alternatives so one does not overwrite another.
5. Import and inspect through the existing Unity commands; apply the lighting contract only if one exists and was approved.
6. Compare native results against reviewed evidence. Preserve editable native assets and source links. Treat import into a comparison scene and installation into production as separate scopes.

Use these verified command shapes, replacing placeholders with actual approved paths and using the pinned Node executable:

```sh
node tools/design-kit/export.mjs tools/design-kit/models/<model>.mjs GeneratedAssets/DesignKit tools/design-kit/recipes/<recipe>.json
python3 scripts/unity-pipeline.py command design_import --manifest GeneratedAssets/DesignKit/<asset-id>/design.json
python3 scripts/unity-pipeline.py command design_inspect --asset <asset-id>
python3 scripts/unity-pipeline.py command design_light --lighting GeneratedAssets/DesignKit/<asset-id>/lighting.json
```

Treat design-kit as a geometry/material/lighting authoring route, not a runtime transport. Do not claim that glTF or the static manifest transfers animation controllers, gameplay, inputs, or physics. Implement those natively. Build HUD and gameplay variants through their native asset/component path, not the static geometry importer.

## Script repetition, not speculation

Notice repeated recipe generation, preset application, scene setup, import, capture, reset, and evidence comparison. When the same operation recurs or consumes substantial manual/token effort, first look for an existing command or helper. Extend or compose it before adding another tool.

If needed, make a small parameterized script or native editor command around the existing pipeline. Give it explicit inputs, a narrow output, stable variant IDs, safe rerun behavior where feasible, and a clear failure result. Avoid overwriting production assets or user tuning. Keep the operation visible and inspectable; do not hide it behind a new UI or automation framework.

Run the helper on a representative variant and inspect its actual result before applying it to the comparison set. Do not spend more effort automating a one-off than performing it. Ask before consequential external operations; scripting does not expand approved scope.

## Verify the experience, not just compilation

Use the current runner's documented refresh, command, test, and Play verification paths. Refresh/compile in Edit mode; avoid unnecessary refreshes for documented live commands. If a mutation times out, inspect its job receipt or resume it rather than resubmitting blindly.

Exercise the approved scenario in Unity. Capture the relevant frame, clip, state transition, and actual world consequence. Use the project's existing input/play harness where available. Compare options under equivalent conditions and reset state between runs. Assemble labeled contact sheets of native visual variants and, when useful, paired design-kit/native captures. Check the integration seam early. When shared code or assets change, verify that existing consumers retain their behavior even during lab-only work; verify the newly installed experience in the real scene after production installation is approved.

Follow the main skill's visual-evidence reference for the requested screenshot skills, native-route compatibility, labeled downsampled contact sheets, and Sector's F9/Shift+F9 or `grievance_capture` evidence. Consult grievance state before guessing about on-screen scale, position, or motion; keep original-resolution measurements separate from review thumbnails.

Report what was observed, what remains untested, and which decisions need human review. Do not call browser parity, compilation, a screenshot, or a lab-only success proof of complete gameplay integration. Two cautions from auditing systems: a call-site count proves a decision is wired, only play proves it reads as a tradeoff at the controls, so keep the two claims apart; and "no call site" can be wrong, so check wrapper surfaces before declaring a system unreachable. When the approved work adds per-frame cost, run the project's performance experiment card (see the main skill, section 6) and report the delta; a frame captured is not a frame measured. If Unity or its pipeline is unavailable, finish reachable design work and state the exact blocker; do not fabricate native evidence.

When a decision needs human review, follow the main skill's section 6 human-in-the-loop guidance: predicted observables first, then a mapped symptom menu, not an open question.
