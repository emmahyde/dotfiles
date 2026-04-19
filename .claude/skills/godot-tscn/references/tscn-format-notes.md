# TSCN format notes

Distilled implementation guidance based on the official Godot stable `.tscn` documentation and the text scene/resource parser implementation.

## Core identity

- `.tscn` is the text scene format for a single `PackedScene` scene tree.
- In Godot 4.x, scene files normally start with `[gd_scene format=3 ...]`.
- Scene files saved before Godot 4.6 may still include `load_steps=<int>` in the descriptor; this field is deprecated and should not drive edit decisions.
- `.escn` uses the same text structure but represents exported scenes with a different workflow expectation.

## Section and tag structure

- The descriptor should be the first entry in the file.
- The core scene sections are:
  1. external resources
  2. internal resources
  3. nodes
  4. connections
- Scene files may also contain `[editable path="..."]` entries for inherited-scene editability metadata.
- Common scene tags are:
  - `[ext_resource ...]`
  - `[sub_resource ...]`
  - `[node ...]`
  - `[connection ...]`
  - `[editable ...]`

## Comments, whitespace, and save behavior

- Single-line comments may start with `;`.
- Comments are discarded when Godot saves the scene again.
- Whitespace is not semantically important except inside strings.
- Extra whitespace is discarded on save.
- Properties equal to defaults are usually not stored and may disappear after a save.

## External-resource rules

- External resources carry `type`, `path`, `id`, and often `uid`.
- Scene text refers to them with `ExtResource("id")`.
- Godot commonly writes `res://` paths, but relative paths are also valid.
- Relative external-resource paths are resolved relative to the current scene file's directory.
- `uid` is not the same thing as the local `id`; UID is a global-ish resource identity, while `id` is the reference handle used inside this scene file.

## Internal-resource rules

- Internal resources use `[sub_resource type="..." id="..."]`.
- Scene text refers to them with `SubResource("id")`.
- A referenced sub-resource must already be declared before a `SubResource("id")` lookup can resolve it.
- External-resource IDs and internal-resource IDs live in separate reference forms, so the same textual ID value is not automatically a conflict if it belongs to different surfaces.

## Node structure rules

- A scene file must have exactly one root node.
- The root node must not declare `parent="..."`.
- A direct child of the root uses `parent="."`.
- Deeper parent paths do not include the root node's name.
- Node headers can include fields such as:
  - `name`
  - `type`
  - `parent`
  - `owner`
  - `index`
  - `groups`
  - `instance`
  - `instance_placeholder`
  - `unique_id`
- `unique_id` on nodes is common in scenes saved with Godot 4.6+, but it is not guaranteed in older files.

## NodePath and property-path reminders

- `NodePath(".")` points to the current node.
- `NodePath("")` points to no node.
- Node paths are relative to the current node.
- Property paths can be appended with `:property_name`.
- Property component paths such as `NodePath("MeshInstance3D:scale.x")` are valid and often appear in animation data.

## Connection and inherited-scene reminders

- Connections need stable `from`, `to`, `signal`, and `method` fields.
- Optional connection fields can include `flags`, `binds`, `unbinds`, and UID-path helpers.
- Inherited or instanced scenes may use `owner`, `instance`, `instance_placeholder`, and `[editable path="..."]` metadata.
- If a node move or rename crosses inherited or instanced boundaries, validate the instance-resolution path after editing.

## Parser- and saver-informed cautions

- Unknown scene tags cause parse failure.
- Missing required connection fields cause parse failure.
- Saving may normalize formatting and regenerate missing or conflicting scene/resource unique IDs.
- The saver serializes node groups in a normalized order and omits many default-valued properties, so a semantically small change can still produce a visually broad diff.
- Godot recognizes `.tscn` as `PackedScene`; `.tres` follows the same text parser family but is a resource route, not a scene route.

## Practical edit discipline

- Map the scene root, touched resources, touched nodes, and touched connections before editing.
- Treat `ExtResource`, `SubResource`, `NodePath`, `parent`, `owner`, and connection fields as one integrity set when renaming or moving nodes.
- Prefer semantic correctness over preserving incidental spacing or comments that the editor will rewrite anyway.
- After manual edits, verify both editor load and one meaningful runtime path.
