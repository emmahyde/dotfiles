# Health Check Reference

## Threshold Values

| Metric | Warning | Critical | Rationale |
|--------|---------|----------|-----------|
| Node count | 200 | 500 | >200 starts impacting editor performance; >500 likely needs scene splitting |
| Nesting depth | 8 | 12 | Deep trees make node paths fragile and scene understanding harder |
| AnimationPlayers | 5 | 10 | Many AnimationPlayers = consider AnimationTree state machine instead |
| Signal connections | 50 | 100 | Dense signal webs become unmaintainable |
| Scene dependencies | 50 | 100 | Too many deps = tight coupling, long load times |
| Instance chain depth | 5 | 8 | Scene-in-scene-in-scene chains are hard to debug |
| MeshInstance3D count | 100 | 300 | Each is a draw call; use MultiMeshInstance3D for duplicates |
| Real-time lights | 4 | 8 | Each light multiplies draw calls for affected meshes |
| RayCast nodes | 10 | 30 | Each runs physics queries per frame |
| Particle max_amount | 1000 | 5000 | GPU fill rate and overdraw concern |

## Anti-Pattern Catalog

### 1. Deep get_node() Chains

**What it looks like:**
```gdscript
var target = get_node("../../World/Enemies/SpawnPoints/Point3")
```

**Why it's a problem:** Breaks when any node in the chain is renamed, moved, or reparented. Silent null reference at runtime.

**Fix:**
```gdscript
# Use groups
var target = get_tree().get_first_node_in_group("spawn_points")

# Or exported NodePath
@export var target_path: NodePath
@onready var target: Node = get_node(target_path)
```

**Severity:** WARNING. Ignore for 1-level (`../Sibling`) references within the same scene.

### 2. Missing Node Owner

**What it looks like:** Node added via code without setting `node.owner = scene_root`.

**Why it's a problem:** Node won't be serialized when saving the .tscn file. Disappears on reload.

**Fix:** Always set owner when adding nodes programmatically:
```gdscript
var child = Node3D.new()
parent.add_child(child)
child.owner = get_tree().edited_scene_root  # In @tool scripts
```

**Severity:** CRITICAL. Data loss on save.

### 3. Duplicate Node Names

**What it looks like:** Two siblings both named "Sprite2D" (Godot auto-renames to "Sprite2D2" but original names can collide).

**Why it's a problem:** `get_node("Sprite2D")` returns the first match, silently ignoring the second. Confusing in editor.

**Fix:** Give each node a descriptive unique name: "PlayerSprite", "EnemySprite".

**Severity:** WARNING.

### 4. find_child() Deep Search

**What it looks like:**
```gdscript
var btn = find_child("StartButton", true, false)
```

**Why it's a problem:** Searches entire subtree every call. O(n) where n = descendants. Slow in large scenes, especially if called in _process().

**Fix:**
```gdscript
@onready var btn: Button = $UI/MainMenu/StartButton  # Direct path
# Or cache the result
var _btn: Button
func _ready() -> void:
    _btn = find_child("StartButton", true, false)
```

**Severity:** INFO. Acceptable in _ready(), problematic in _process().

### 5. Long Absolute @onready Paths

**What it looks like:**
```gdscript
@onready var manager = get_node("/root/Main/World/Systems/EnemyManager")
```

**Why it's a problem:** Breaks if scene structure changes. Tightly couples unrelated scenes.

**Fix:** Use autoloads for globally-accessed systems, or pass references via signals/exports.

**Severity:** WARNING.

### 6. Unguarded Signal Connections

**What it looks like:**
```gdscript
func _ready() -> void:
    enemy.died.connect(_on_enemy_died)
    # Called again if scene re-enters tree = duplicate connection
```

**Why it's a problem:** Re-entering scene tree adds duplicate connections. Callback fires twice.

**Fix:**
```gdscript
if not enemy.died.is_connected(_on_enemy_died):
    enemy.died.connect(_on_enemy_died)
# Or use CONNECT_ONE_SHOT for single-use
enemy.died.connect(_on_enemy_died, CONNECT_ONE_SHOT)
```

**Severity:** INFO.

### 7. Missing class_name

**What it looks like:** Script referenced by `preload()` or `load()` from other scripts but has no `class_name`.

**Why it's a problem:** Forces consumers to use path strings instead of type names. No autocompletion, no type checking.

**Fix:** Add `class_name MyScript` at top of script.

**Severity:** INFO.

### 8. Process Mode Defaults

**What it looks like:** All nodes left on `PROCESS_MODE_INHERIT` (default).

**Why it's a problem:** When game is paused, everything stops. Menus, HUD, and pause screens need `PROCESS_MODE_ALWAYS`.

**Fix:** Set `process_mode` on UI/menu nodes that should work during pause.

**Severity:** INFO.

### 9. Hardcoded Resource Paths

**What it looks like:**
```gdscript
var texture = load("res://assets/textures/enemy_red.png")
```

**Why it's a problem:** Breaks silently if file is moved/renamed. No editor validation.

**Fix:**
```gdscript
@export var texture: Texture2D  # Set in inspector, validated by editor
```

**Severity:** INFO. Acceptable for resources that truly never change (built-in shaders, etc.).

### 10. God-Node Anti-Pattern

**What it looks like:** One script with >500 lines handling input, physics, animation, UI, audio, and game logic.

**Why it's a problem:** Impossible to maintain, test, or extend. Changes to one system risk breaking others.

**Fix:** Split into focused components (InputHandler, HealthSystem, AnimController) connected via signals.

**Severity:** WARNING at >300 lines, CRITICAL at >800 lines.

## Auto-Fix Recipes

### Fix Duplicate Signal Connections
```
1. find_signal_connections on the node
2. For each signal: if connected multiple times to same target+method:
   disconnect_signal for all but the first
3. save_scene
4. Verify: find_signal_connections shows no duplicates
```

### Fix Missing Collision Shapes
```
1. find_nodes_by_type for physics bodies
2. For each: check if it has a CollisionShape child
3. If missing: setup_collision with appropriate shape:
   - CharacterBody: CapsuleShape3D (h=1.8, r=0.4)
   - StaticBody: BoxShape3D (match mesh bounds)
   - Area3D: match intended trigger volume
4. save_scene
```

### Fix Unnamed Physics Layers
```
1. get_project_settings to check layer_names
2. For any unnamed layers in use:
   set_project_setting("layer_names/3d_physics/layer_N", "LayerName")
3. Common names: player, enemies, projectiles, world, triggers, pickups
```
