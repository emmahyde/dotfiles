# Triage Categories for Godot/.NET

Use this reference to map symptoms to the most probable first failing layer, not merely the loudest downstream error.

## Category overview

| Layer | Typical symptoms | High-signal clues | First investigation direction |
| --- | --- | --- | --- |
| build / compile | Build stops, project will not compile, C# assemblies are not produced | `CSxxxx`, `MSBxxxx`, compile output references source files and line numbers | Inspect compiler/MSBuild output and the exact code or generated file path mentioned |
| .NET project / SDK / restore | Restore fails, SDK not found, packages unresolved, target framework/toolchain errors | `NETSDKxxxx`, `NUxxxx`, missing workload/package/target messages, broken `project.assets.json` | Check SDK version, restore output, target framework, package sources, and solution/project configuration |
| Godot editor configuration | Project opens with editor-side assembly/configuration issues, C# integration appears broken, editor floods errors immediately | editor output panel errors, assembly reload issues, missing C# integration signals, configuration warnings before gameplay | Check editor setup, C#/.NET support, project import state, generated glue/project files, and editor-specific settings |
| scene / resource loading | Opening a scene fails, resources/scripts cannot load, startup stops while loading content | missing file/resource paths, `Failed loading resource`, scene parse/load errors, missing script class or broken resource references | Inspect the referenced path, moved/renamed assets, scene dependencies, import state, and script attachment validity |
| runtime exception / logic bug | Game launches then throws, object becomes null, logic is wrong, gameplay breaks | `NullReferenceException`, `InvalidOperationException`, stack traces, node lookup failures, disposed object access | Inspect the first thrown exception, stack frame, runtime state assumptions, node/resource lifecycle, and recent logic changes |
| environment / version / tooling mismatch | Issue appears after upgrade, only one machine fails, editor and CLI disagree, tools work in one context but not another | version mismatch notes, SDK/editor discrepancies, changed plugin behavior, machine-specific failures | Compare Godot/.NET/tool versions, IDE integrations, PATH/global.json settings, and recent environment/toolchain changes |

## Symptom mapping

| Symptom | Most likely layer | Also consider | Why |
| --- | --- | --- | --- |
| `Godot 4.6 C# build fail` | build / compile | .NET project / SDK / restore | A plain build failure may still originate from restore/SDK issues before compilation starts |
| `editor 開專案後大量錯誤` | Godot editor configuration | environment / version / tooling mismatch | Immediate editor-side noise often points to integration or configuration rather than scene logic |
| `開 scene 時 crash` | scene / resource loading | runtime exception / logic bug | If opening the scene is the trigger, start from what the scene loads before assuming gameplay logic |
| `進遊戲即報 null reference` | runtime exception / logic bug | scene / resource loading | A null may come from missing nodes/resources created by the loaded scene |
| `升版後突然 run 不到` | environment / version / tooling mismatch | .NET project / SDK / restore | Version changes often break compatibility, restore behavior, or editor/tool integration |
| project runs from CLI but not editor | Godot editor configuration | environment / version / tooling mismatch | Different launch surfaces often expose integration/config drift |
| restore succeeds but game crashes on startup | runtime exception / logic bug | scene / resource loading | Build health does not guarantee resource or runtime health |

## Common error signals and likely directions

| Signal | Likely layer | Direction |
| --- | --- | --- |
| `CS0246`, `CS0103`, `CS1061` | build / compile | Missing type/member/usings, stale generated code, namespace drift, API mismatch |
| `MSB1009`, `MSB3021`, `MSB3277` | build / compile | Wrong path, output/copy issue, conflicting references, build graph or project setup problem |
| `NETSDK1045` | .NET project / SDK / restore | Installed SDK does not support the targeted framework or expected SDK version |
| `NU1101`, `NU1605`, restore source failures | .NET project / SDK / restore | Package source resolution, dependency conflicts, feed/auth/source configuration |
| asset file or restore cache missing messages | .NET project / SDK / restore | Re-run restore, inspect package sources, lock files, and project graph |
| editor reports missing C# project/assembly state immediately on open | Godot editor configuration | Verify editor-side .NET integration, generated solution/project files, import state, and tool support |
| `Failed loading resource`, missing `.tscn` / `.tres` / script path | scene / resource loading | File moved/renamed, broken dependency, invalid import metadata, bad script attachment |
| `NullReferenceException` on enter tree / ready / startup | runtime exception / logic bug | Missing node/resource wiring, initialization order, assumption broken by loaded scene |
| `ObjectDisposedException` or invalid object access | runtime exception / logic bug | Lifetime/order issue, freed node still referenced, async/signal ordering bug |
| works on one machine, fails on another | environment / version / tooling mismatch | Compare exact versions, environment variables, PATH/global.json, editor plugins, and installed SDKs |
| breaks right after Godot or SDK upgrade | environment / version / tooling mismatch | Start with compatibility drift before deep code surgery |

## Triage reminders

- Find the **first failing layer** before proposing fixes.
- Prefer the **exact message** over summaries like "it broke" or "it crashed".
- If multiple categories seem plausible, name the top one and explicitly state the discriminating evidence you still need.
- Ask for the **smallest missing evidence** that can change the ranking of causes.
- Keep next probes narrow: one command, one log capture, one file block, or one reproduction checkpoint.
