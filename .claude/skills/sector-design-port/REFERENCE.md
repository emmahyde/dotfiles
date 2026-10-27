# sector-design-port — reference

## Var → literal → FlightColors table

Design-doc `var(--x)` → emitted USS literal → C# constant. The literals are `FlightColors` verbatim — that identity is why ports look right; don't mix in SectorDesignTokens (overlay ramp: accent 255,166,64, ink 255,200,130).

| var | USS literal | FlightColors field |
|---|---|---|
| --accent | rgb(244,182,66) | Accent |
| --accent-hot | rgb(255,207,106) | AccentHot |
| --accent-soft | rgba(244,182,66,0.12) | AccentSoft |
| --accent-line | rgba(244,182,66,0.38) | AccentLine |
| --accent-dim | rgba(244,182,66,0.2) | — (Alpha helper) |
| --info | rgb(108,199,224) | Info |
| --ok | rgb(125,211,164) | Ok |
| --danger | rgb(255,107,107) | Danger |
| --warn | rgb(244,182,66) | Warn (= Accent) |
| --ink | rgb(214,212,194) | Ink |
| --ink-2 | rgb(181,180,160) | Ink2 |
| --ink-dim | rgb(106,112,100) | InkDim |
| --ink-mute | rgb(63,74,63) | InkMute |
| --line / --line-2 / --line-3 | rgb(30,36,31) / rgb(46,58,46) / rgb(70,82,70) | Line / Line2 / Line3 |
| frame bg | #0b0e0b | CardBg (10,13,10,0.72) |

## CSS → USS property map (what design2uss.py emits)

| CSS | USS | Notes |
|---|---|---|
| display:flex | flex-direction (explicit or inferred row) | UI Toolkit default is column — inference matters |
| flex-direction / -wrap / align-items / justify-content / width / height / min-* / max-* / overflow / white-space / position / top/left/right/bottom / flex-grow / -shrink / -basis | same | passthrough |
| padding/margin shorthand | four longhands | expanded |
| border:W solid C | border-width + border-color | dashed → solid, noted |
| border-side:0 | border-side-width: 0 | corner ticks depend on this |
| font-size / letter-spacing | same (em → px via rule's font-size) | |
| text-align | -unity-text-align | left/right/center → middle-left/right/center |
| color / background(-color) | color / background-color | vars resolved to literals |
| gap:Npx | `SEL > * { margin-right/bottom }` | row→right, else bottom |
| text-transform / gradients / box-shadow / text-shadow / clip-path / animation / nth-child / ::pseudo | dropped | noted in Review block |
| grid-template-columns | dropped (noted) | hand-port as fixed width + flex-grow |

Selector translation: first class gets the prefix (`variant-`), `f`→`frame`, `tk`→`corner-tick`; later classes in a compound become `--modifier` suffixes (`.li.on` → `.variant-li--on`); inline tags (span/button/i/u/s/b) become `*` with prefixed class (`.tabs span.on` → `.variant-tabs *.variant-on` — rename when finishing); doc furniture (html/body/a/.sec/.note/.cap/.rule/.mass/.brk/.atag/.led) and any `:`-containing selector are skipped.

## Play-mode verification gotchas (all hit 2026-08-30)

- Enter play mode BEFORE probing. A plain MonoBehaviour's `Update` never ticks in edit mode, and after an edit-mode domain reload its non-serialized fields are null — a lab spawned in edit mode looks "empty" and NREs on reflection probes.
- The first `execute_code` after entering play times out on the domain reload — retry, it is not a failure (also in docs/STATE.md Facts).
- `execute_code` auto-imports UnityEngine/UnityEditor only. `root.Q<T>()` is an extension method in UnityEngine.UIElements and will NOT compile — use `UnityEngine.UIElements.UQueryExtensions.Query<T>(root)` or `System.Type.GetType("Ns.Class, Assembly-CSharp")` + Activator.
- `resolvedStyle` reads 0 on the spawn frame — probe twice before measuring.
- A `UIDocument` added via `AddComponent` may not have its `rootVisualElement` until the panel attaches — build UI on first Update, never in OnEnable alone (the `lab` emitter bakes this).
- Spawned-at-runtime harness objects evaporate on play stop — nothing to clean up; anything you need persisted goes through the controller/gallery wiring instead.

## Worked example (2026-08-30 session)

Source: `Sector Target + Hopper Variants.html` → Variant D (tabbed contact file, 440px) and Variant 2 (process line hopper, 340px):

- `Assets/_Project/HUD/Components/ContactFilePanel.cs` — tabs generated per contact kind (rock/vessel/station), left 150px vitals column + right flex assay/threat/services column, `Set{Rock,Vessel,Station}Target()` APIs, `ActionClicked`/`TabSelected` events.
- `Assets/_Project/HUD/Components/ProcessLineHopperMonitor.cs` — belt slots + crusher chip, key/value rows, output-split lanes (ore/slag/fuel), `UpdateState(...)` for live stats incl. fault mode.
- `Assets/_Project/HUD/Resources/TargetAndHopperVariants.uss`, gallery entries 17–18, `HUD/TargetHopperLab.cs` harness, USS wired in `SectorHudController.OnEnable`.
- Verified: play-mode probe `contact resolved w=440`, `hopper resolved w=340`, user sign-off on the look. Live binding still open — hopper lot fields in `MiningLoopController` are private.
