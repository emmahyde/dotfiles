# Capture, downsample, compare

## Choose the evidence that answers the question

Read the requested capture skill's current instructions before using it. Resolve skill names through the host's installed skills; these may appear with or without the `agents/` prefix. In Sector, their definitions are under `<repo>/.agents/skills/`.

| Capture skill | Use it for | Limits and precautions |
|---|---|---|
| `/skill:agents/screenshot-scene-view` | Spatial layout, editor framing, geometry and scene inspection | Requires an open Scene View and a non-null view camera; not proof of the player's final view |
| `/skill:screenshot-game-view` | Actual Game View composition, HUD, overlays, gameplay-scale readability | Use the current command's composited-screen mode for overlay UI; legacy direct-texture capture and native runner inputs differ |
| `/skill:agents/screenshot-isolated` | Controlled model silhouettes, details, and repeatable multi-angle views | Inspect activation side effects; custom lighting and isolation are not proof of in-world appearance |
| `/skill:screenshot-camera` | Repeatable renders from a specific gameplay or comparison camera | Resolve the actual camera explicitly; a fallback camera can hide a wrong-camera error, and a single camera render may omit overlays or camera-stack behavior |

Use only the views needed for the decision, not all four on every iteration. Pair controlled model captures with Game View evidence when native integration is being judged. For modeling before native approval, capture the existing design-kit viewer instead of importing solely to obtain a thumbnail.

## Respect the project's current capture route

The screenshot skill documents describe `unity-mcp-cli` calls, but Sector's current `docs/UNITY-PIPELINE.md` requires its native CLI runner and existing named commands rather than Unity MCP. Treat the skills as evidence-selection guidance, not interchangeable command schemas. Verify the current native contract in `Packages/com.unity.pipeline/Editor/Commands/Capture/CaptureCommands.cs` and its capture documentation. Do not blindly run legacy examples, install a global CLI, or bypass the current pipeline.

For Sector's current native commands:

- Use `capture_scene_view` for the active Scene View.
- Use `capture_game_view --source screen` in Play for the composited frame, including Screen Space - Overlay UI. The default `source=camera` does not prove HUD visibility.
- Use `capture_game_view --source camera --camera <actual-camera-name>` for an explicit camera render. Native `camera` is a name string; do not pass the legacy skill's structured `cameraRef`.
- Both commands accept `--width` and `--height` (defaults 1280x720, currently clamped to 1–4096 per dimension). Inspect the actual source resolution and request matching dimensions/aspect ratio when preserving pixel evidence. Screen capture scales to the requested dimensions; defaults can distort a non-16:9 source. Do not claim a clamped or resized output is an original-resolution capture.
- `--save_path` writes the requested-resolution PNG and defaults to a path-only result. `--include_inline_image true --max_resolution 960` also returns a smaller inline preview without shrinking the saved file. `max_resolution` affects only returned inline images. Prefer saved originals plus bounded previews or contact sheets.

Route each command through `python3 scripts/unity-pipeline.py command ...`. Use project-relative capture paths and actual camera names/dimensions. Recheck schemas if the package changes. Legacy Scene/camera examples with zero dimensions or placeholder references are not safe defaults even though the native implementation clamps sizes.

No native isolated equivalent is assumed. Discover a supported named command before using isolation; report the gap rather than routing legacy MCP inputs through an unrelated native command. When the documented isolated skill is supported, `Composite` contains Front, Right, Back, and Top in a 2x2 grid. Its `resolution` is per sub-view: 512 produces a 1024x1024 composite. It is a multi-view sheet of one object, not four design alternatives.

The isolated skill can temporarily activate inactive children and fire `OnEnable`; restored activation flags do not undo audio, network, or animation side effects. Prefer a safe static specimen or `isolated=false` when those callbacks matter; do not describe the latter as object-only isolation. Check the supported command's actual behavior, lighting, and background choices; restore deliberately changed scene/camera settings. Do not touch live saves or restart Play merely to make capture convenient.

Capture only after the target variant/state is visible. Inspect the returned image rather than treating command completion as visual proof. Record variant ID, source view/camera, scenario/state, resolution, and relevant lighting settings. For time-dependent behavior, use a clip or ordered frames; a still image cannot prove feel or continuity.

## Downsample without losing the evidence

Keep the original capture unchanged. Use downsampled copies for quick scanning, not for final pixel-size measurements, fine typography, thin geometry, shadow artifacts, or aliasing judgments. Inspect the source or a labeled detail crop when the thumbnail cannot answer the question.

Use consistent thumbnail sizes and aspect-preserving fits with padding; do not stretch, silently crop, upscale, sharpen, or recolour one option to make it look better. Default to 384x256 image areas in a three-column sheet. Increase detail only when needed; split large batches into readable sheets rather than producing an enormous image or unreadable thumbnails. Do not change the actual Game View resolution as a substitute for post-capture downsampling when testing UI layout.

Use the bundled CPU-only helper for labeled sheets and one-image downsampled reviews. It never calls Unity or modifies source captures. It preserves input order, applies EXIF orientation, composites alpha against a consistent dark background, avoids upscaling, and prints a JSON receipt mapping tile IDs/labels to source paths and dimensions. Labels default to filenames; use stable variant IDs explicitly when filenames are unclear.

Resolve `scripts/contact_sheet.py` relative to the installed `idea-to-unity` skill directory. For the standard global installation:

```sh
uv run ~/.claude/skills/idea-to-unity/scripts/contact_sheet.py A.png B.png C.png --output review-sheet.png --columns 3 --tile 384 256 --label "A - skeletal" --label "B - monolithic" --label "C - suspended"
```

Use one input and `--columns 1 --tile 960 540` for a larger single-image review. Use `--overwrite` only to replace an intended derived sheet, never an original. The script uses its declared Pillow dependency through `uv`; reuse an available image compositor if that runtime is unavailable rather than installing a new system-wide toolchain. Supply at least three actual variants for a variation review; extra views of one variant do not satisfy that requirement.

Open the generated sheet and verify orientation, image-to-label mapping, legibility, clipping, and consistent framing before presenting it. Keep full-resolution links and the receipt available. The helper only lays out supplied images; it does not make mismatched cameras, scales, or exposures comparable. Follow the comparison controls in the main variation workflow.

## Sector grievance capture: measure what looked wrong

Use `/skill:grievance` when the human reports a captured complaint, refers to something looking wrong, or asks about on-screen size, position, or motion in Sector. Read its current instructions and verify behavior against `Assets/_Project/Proto/Diagnostics/GrievanceCapture.cs` and `Assets/_Project/Editor/GrievanceCaptureCommand.cs` when needed. A grievance is evidence of what was shown, not a root-cause verdict.

| Trigger | Evidence |
|---|---|
| `F9` in Play with a booted `SectorSimHost` | `frame.png` plus `state.txt` |
| `Shift+F9` under the same conditions | The same, plus `motion.txt` with 60 subsequent frame samples |
| Existing runner command `grievance_capture` | One-frame F9-style capture; no motion option is currently exposed by that command |

Use the existing responsive-Play route when programmatic capture is appropriate:

```sh
python3 scripts/unity-pipeline.py command grievance_capture
```

Captures live under `<repo>/Logs/grievance-<yyyyMMdd-HHmmss>/`. Prefer a user-specified capture; otherwise locate the newest relevant folder with the available file tools. The command returns its directory and frame path, but PNG writing is asynchronous; verify the image exists and is readable before claiming completion. Do not repeatedly issue capture commands to wait for one image, and avoid multiple captures in the same second because directory names have second precision.

Read `state.txt` first for recorded screen dimensions, camera settings, ship state, body distances/bearings, and projection estimates. In the current recorder, `px` is a projected diameter derived from `transform.lossyScale.x` as a radius, not measured mesh bounds or visible pixels. `VISIBLE` only means the projected center is in front of the camera and inside the screen rectangle; it does not test occlusion or partial edge visibility. This qualification overrides stronger claims in the older grievance skill. Inspect `frame.png` for actual apparent size, occlusion, and appearance.

Read `motion.txt` for motion complaints; it records frame indices, not per-frame timestamps. Sixty samples are not necessarily one second. Report per-frame changes unless actual elapsed-time or frame-rate evidence supports a per-second rate; handle bearing wrap when comparing angles.

Quote relevant measured values and link the capture path. Distinguish recorded state, an interpretation, and a causal hypothesis. Check whether the capture predates the current variant before applying it to a new design. If an appropriate capture is absent, request F9 or Shift+F9, or use the approved one-frame command, before diagnosing from memory. Do not assert frame-perfect synchronization between text state and asynchronously written pixels.

Use grievances to choose the next discriminating experiment or acceptance criterion. Preserve the user's complaint in their own terms, connect it to variant IDs where possible, and make before/after contact sheets when conditions are comparable. Keep measurements in original capture coordinates; a downsampled sheet does not change the recorded pixel sizes. Do not delete captures unless asked, treat reports as mere aesthetic votes, or substitute a clean isolated render for the actual problematic Game View.
