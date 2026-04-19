# Godot C# notes

Distilled implementation guidance based on the official Godot stable C#/.NET docs.

## Setup and project workflow

- Use the .NET-enabled Godot editor together with an installed .NET SDK. Do not assume the standard non-.NET editor build can compile C# scripts.
- Creating the first C# script generates the project's `.sln` and `.csproj`; those belong in version control, while `.godot/` can stay ignored.
- Godot's built-in editor support for C# is limited. Prefer an external editor or IDE when editing, debugging, or exploring APIs.
- Treat export target constraints as a design input. The official docs call out that Godot 4 C# support on the web is unavailable, and mobile support may have version-specific caveats.

## Core implementation rules

- Godot-owned C# types should be `partial`.
- The attached script class name should match the `.cs` filename.
- Godot's C# API is `PascalCase` and often exposes properties instead of getter/setter methods.
- Follow normal C# readability conventions: explicit access modifiers, 4-space indentation, `PascalCase` for public members, `_camelCase` for private fields.

## API mapping from GDScript

- Global-style helpers move into classes such as `GD`, `Mathf`, or engine singletons.
- `@export` becomes `[Export]`.
- `signal` becomes `[Signal]` on a delegate whose name ends with `EventHandler`.
- `@onready` behavior is usually expressed by assigning references in `_Ready()` or another appropriate lifecycle hook.
- Awaiting a signal is done with `await ToSignal(target, TargetType.SignalName.SomeSignal)`.
- String-based APIs like `Call`, `CallDeferred`, and parts of signal connection still need extra care around naming; prefer `PropertyName`, `MethodName`, and `SignalName` when the API exposes them.

## Signals and exports

- Prefer generated C# events (`+=` / `-=`) for built-in signals when possible.
- For custom signals, use `[Signal]` and `EmitSignal`; rebuild the project if the editor needs to discover the new signal.
- Capturing lambdas in signal handlers can complicate lifetime and disconnection behavior; store delegates and unsubscribe explicitly when ownership matters.
- Exported members must be Variant-compatible and analyzer-friendly.
- Complex exported property getters can confuse Godot's default-value analyzer; keep defaults simple when the inspector value matters.
- Tool/editor scripts that change exported or inspector-visible state may need `NotifyPropertyListChanged()`.

## Collections and Variant boundaries

- Prefer .NET collections when data stays in managed code.
- Use `Godot.Collections.Array` / `Dictionary` or supported C# arrays only when talking to Godot APIs, exported members, or `Variant` boundaries.
- Avoid untyped `Variant` unless the engine API truly requires it.
- Godot `Variant` stores 64-bit integers and floats; be explicit about conversions and enum handling.

## Common pitfalls and performance notes

- Struct-valued engine properties such as `Position` must be copy-modified and reassigned.
- Repeated reads and writes to engine-backed properties can add interop cost; cache local copies in tight loops.
- Implicit conversions from `string` to `NodePath` or `StringName` add marshalling overhead in hot paths.
- Prefer typed node accessors and safe casts instead of weakly typed node access.
- Treat Godot diagnostics as real design constraints. Common failures include missing `partial`, unsupported export types, invalid custom signal delegates, and Variant-incompatible generics.

## Rebuild and visibility reminders

- Rebuild project assemblies after adding or changing exported members, custom signals, and tool-script behavior that must appear in the editor.
- When editor-visible behavior changes, verify both the inspector view and the runtime path; one without the other is only half a check.
