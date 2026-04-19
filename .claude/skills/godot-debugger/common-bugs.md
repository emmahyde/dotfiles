# Common Godot 4.6 Bugs & Gotchas

## Type System

**`:=` with Variant functions causes parse errors**
```gdscript
# BAD — parse error in Godot 4.6
var node := get_node("Player")
var children := get_children()

# GOOD — explicit type annotation
var node: Node = get_node("Player")
var children: Array[Node] = get_children()
```

**Export vars need explicit types**
```gdscript
# BAD
@export var speed := 5.0

# GOOD
@export var speed: float = 5.0
```

## Node References

**get_node() before _ready() returns null**
```gdscript
# BAD — may be null if called too early
var player = get_node("/root/Main/Player")

# GOOD — use @onready
@onready var player: Node = get_node("/root/Main/Player")

# GOOD — or defer the call
func _ready() -> void:
    await get_tree().process_frame
    var player: Node = get_node("/root/Main/Player")
```

**Node paths break when reparenting**
- `get_node("../../World/Enemy")` breaks if scene structure changes
- Prefer: `get_tree().get_first_node_in_group("enemies")` or signals

**Autoloads initialize before scene tree**
- `get_node("/root/Main")` in autoload `_ready()` = null
- Use `call_deferred()` or `await get_tree().process_frame`

## Signals

**Connecting to non-existent method: silent in editor, error at runtime**
- Always verify method name matches exactly (case-sensitive)
- Use `Callable(target, "method_name")` for runtime connections

**Duplicate signal connections**
- Each `connect()` call adds another connection
- Use `is_connected()` check or `CONNECT_ONE_SHOT` flag
```gdscript
if not source.is_connected("signal_name", Callable(self, "_on_signal")):
    source.connect("signal_name", Callable(self, "_on_signal"))
```

**Signal arguments changed but receiver not updated**
- Emitter adds a parameter, receiver still has old signature
- No compile error — crashes at runtime with argument count mismatch

## Physics

**Collision layer vs mask confusion**
- `collision_layer` = "What I AM" (my identity/category)
- `collision_mask` = "What I DETECT" (what I scan for)
- For A to detect B: A's `collision_mask` must include B's `collision_layer`

**Bitmask formula: `1 << (N-1)`**
```gdscript
# BAD — layer 3 is NOT the value 3
collision_layer = 3  # This is actually layers 1+2!

# GOOD — layer 3 is bit 2
collision_layer = 1 << 2  # = 4, which is layer 3
collision_layer = 4        # Same thing
```

**BoxShape3D snags on trimesh edges**
- Character gets stuck on edges between trimesh triangles
- Fix: use CapsuleShape3D for characters, or smooth collision margins

**Area3D body_entered not firing**
- Check: `monitoring = true` (default but can be disabled)
- Check: layer/mask overlap between Area and entering body
- Check: both have CollisionShape children

## Resources

**RID / resource leaks**
- `SurfaceTool.new()`, `ArrayMesh.new()` etc. not attached to nodes won't be freed
- Either add to scene tree or call `free()` manually

**Circular resource references**
- Scene A instances Scene B which instances Scene A = load failure
- Use `detect_circular_dependencies` to find these

## Visual

**MultiMeshInstance3D invisible**
- Needs `custom_aabb` set manually — engine doesn't auto-compute it
- Set to encompass all instance positions

**GPUParticles3D invisible**
- `visibility_aabb` too small — particles outside AABB get culled
- Set AABB to contain full particle spread

**Transparent materials render incorrectly**
- Need proper `render_priority` for depth sorting
- Consider `render_mode depth_prepass_alpha` in shaders

**ProceduralSkyMaterial uses first DirectionalLight3D**
- Adding a DirectionalLight3D automatically rotates the sky
- May cause unexpected sky appearance changes

## Groups

**Groups don't always persist through reparenting**
- In some cases, reparenting loses group membership
- Re-add after reparent if needed

**is_in_group() is case-sensitive**
- `"Player"` != `"player"` — pick a convention and stick to it

## Animation

**AnimationTree requires active = true**
- Won't process without `active = true` / `set("active", true)`

**AnimationPlayer needs valid root node**
- `root_node` property must point to existing ancestor
- Default is `".."` (parent) — breaks if AnimationPlayer is moved

**State machine travel() needs valid path**
- Can only travel along defined transitions
- No transition from A to C = travel("C") fails silently from state A

## Common Debugging Commands

```
# Clear logs before reproducing
mcp__godot-mcp-pro__clear_output

# Get all errors
mcp__godot-mcp-pro__get_editor_errors

# Get full output (not just errors)
mcp__godot-mcp-pro__get_output_log

# Validate a script compiles
mcp__godot-mcp-pro__validate_script(script_path: "res://scripts/player.gd")

# Check a node's state at runtime
mcp__godot-mcp-pro__get_game_node_properties(node_path: "Player", properties: ["health", "position", "velocity"])

# Run arbitrary query in live game
mcp__godot-mcp-pro__execute_game_script(script: "return get_tree().get_nodes_in_group('enemies').size()")
```
