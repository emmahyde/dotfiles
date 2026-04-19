# Diagnosis Trees

Expanded decision trees for each debugging branch with specific MCP tool sequences.

## Branch A: Crash/Error — Extended

### Error in Autoload/Singleton
```
get_editor_errors -> mentions autoload script
  -> read_script on the autoload file
  -> Check _ready() for early references to nodes not yet in tree
  -> Autoloads initialize before scene tree, so get_node() to scene nodes fails
  -> Fix: use call_deferred() or await get_tree().process_frame
```

### Error Only at Runtime (Not in Editor)
```
get_editor_errors -> empty or no relevant errors
  -> play_scene -> wait for crash
  -> get_editor_errors again (runtime errors appear here)
  -> If still empty: get_output_log for warnings/prints
  -> Common causes:
     - Null reference in _process() (node freed mid-frame)
     - Signal callback receives unexpected arguments
     - Resource loaded at runtime doesn't exist
```

### Error in Signal Callback
```
Error message includes "signal" or callback method name
  -> find_signal_connections on the emitting node
  -> read_script on receiver to check method signature
  -> Common: signal argument count/type changed but receiver not updated
  -> Fix: update receiver method to match current signal signature
```

### Parse Error (Won't Run)
```
get_editor_errors -> "Parse Error" or "Expected..."
  -> validate_script on the file
  -> Common Godot 4.6 causes:
     - := with Variant function (get_node, get_children, etc.)
     - Missing type annotation on export var
     - await outside async function
  -> Fix: explicit typing, check syntax
```

## Branch B: Visual Glitch — Extended

### Only at Certain Camera Angles
```
get_game_screenshot from multiple angles (move camera via set_game_node_property)
  -> If disappears at distance: mesh AABB too small
     -> get_game_node_properties on MeshInstance3D, check custom_aabb
  -> If z-fighting: two surfaces at same position
     -> Check transforms for overlapping geometry
  -> If backface culling: seeing inside of mesh
     -> Check material cull_mode or add render_mode cull_disabled to shader
```

### Particle System Invisible
```
get_particle_info on the GPUParticles node
  -> Check:
     - emitting = true?
     - amount > 0?
     - visibility_aabb large enough to contain particles?
     - process_material assigned?
     - If 3D: is it within camera frustum?
  -> Fix visibility_aabb: update_property with larger AABB
  -> Fix material: set_particle_material with correct settings
```

### UI Element Not Visible
```
get_game_node_properties on Control node
  -> Check:
     - visible = true
     - modulate.a > 0
     - size > Vector2(0, 0) (zero-size Control is invisible)
     - Not hidden behind another Control (check z_index or tree order)
     - Parent container not collapsed
  -> get_game_scene_tree to see UI hierarchy ordering
```

## Branch C: Logic Bug — Extended

### Timing-Dependent Bug (Race Condition)
```
monitor_properties on the suspect variable over 60+ frames
  -> Look for frame where value changes unexpectedly
  -> capture_frames at the same time for visual correlation
  -> Common causes:
     - Two scripts modifying same property in _process()
     - Signal fires before target node is ready
     - Tween overwrites manual value changes
  -> Fix: use call_deferred(), set_process_priority(), or signal ordering
```

### State Machine Stuck
```
execute_game_script to query AnimationTree parameters:
  get_tree().get_first_node_in_group("player").get_node("AnimationTree").get("parameters/playback")
  -> Check current state, travel path available
  -> get_animation_tree_structure for full state machine map
  -> Check transition conditions:
     - Are conditions being set? (monitor the parameter values)
     - Is auto_advance misconfigured?
     - Does the state machine have a valid travel path?
```

### Enemy Not Responding to Damage
```
execute_game_script: manually call take_damage(10) on the enemy
  -> If health decreases: the damage pipeline works, problem is in detection
     -> Check collision layers (Branch E path)
  -> If health unchanged: problem is in the damage method
     -> read_script on enemy script, check take_damage()
     -> Is it checking shields/invulnerability?
     -> Is it receiving the right damage value?
```

## Branch D: Performance — Extended

### Scene-Specific vs Project-Wide
```
get_performance_monitors in multiple scenes
  -> If one scene is slow: problem is scene content
     -> analyze_scene_complexity on that specific scene
     -> Find the heavy subtree
  -> If all scenes slow: problem is project-wide
     -> Check autoloads for expensive _process() logic
     -> Check for resource leaks (memory growing over time)
     -> monitor_properties on memory metrics across scene transitions
```

### Frame Rate Spikes (Not Constant Low FPS)
```
record_frames over 120 frames with monitor_properties on FPS
  -> Look for periodic spikes:
     - Every N frames: likely a timer or periodic task
     - On events: likely instantiation or resource loading
     - Random: likely GC or external I/O
  -> For instantiation: preload scenes, use object pools
  -> For GC: reduce allocation in hot paths
```

## Branch E: Silent Failure — Extended

### Area3D body_entered Not Firing

The most common "nothing happens" bug. Check in this order:

```
1. get_collision_info on the Area3D
   -> monitoring = true? (must be true to detect entries)
   -> collision_mask includes the entering body's layer?

2. get_collision_info on the entering body
   -> collision_layer set correctly?
   -> Has a CollisionShape child? (physics body without shape = invisible to physics)

3. find_signal_connections on the Area3D
   -> body_entered connected to a method?
   -> Method exists on the target node?

4. execute_game_script to test overlap:
   var area = get_node("/root/Main/TriggerArea")
   var bodies = area.get_overlapping_bodies()
   return {"count": bodies.size(), "names": bodies.map(func(b): return b.name)}
```

### Input Not Registering
```
1. get_input_actions -> verify the action exists
2. execute_game_script:
   return Input.is_action_pressed("the_action")
3. If false: action not mapped or key binding wrong
   -> set_input_action to fix
4. If true: input works but script doesn't process it
   -> read_script to check _input() or _unhandled_input()
   -> Is process_mode set correctly? (PROCESS_MODE_DISABLED blocks input)
```
