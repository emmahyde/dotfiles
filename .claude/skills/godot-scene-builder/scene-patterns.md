# Scene Patterns Reference

## 3D Room Recipe

Step-by-step MCP tool sequence for a basic 3D room:

```
1. create_scene(root_type: "Node3D", scene_name: "test_room")

2. Floor:
   add_mesh_instance(parent: ".", name: "Floor", mesh_type: "BoxMesh",
     mesh_params: {size: "Vector3(10, 0.1, 10)"})
   setup_collision(node_path: "Floor", shape_type: "BoxShape3D")

3. Walls (4x):
   add_mesh_instance(parent: ".", name: "WallNorth", mesh_type: "BoxMesh",
     mesh_params: {size: "Vector3(10, 3, 0.2)"})
   update_property(node_path: "WallNorth", property: "position", value: "Vector3(0, 1.5, -5)")
   setup_collision(node_path: "WallNorth", shape_type: "BoxShape3D")
   # Repeat for South (z=5), East (rotated, x=5), West (x=-5)

4. Lighting:
   setup_lighting(light_type: "DirectionalLight3D",
     properties: {rotation_degrees: "Vector3(-45, -30, 0)", light_energy: 0.8})
   setup_lighting(light_type: "OmniLight3D", parent: ".",
     properties: {position: "Vector3(0, 2.5, 0)", light_energy: 0.5, omni_range: 8})

5. Environment:
   setup_environment(sky_type: "ProceduralSkyMaterial",
     properties: {ambient_light_energy: 0.3, glow_enabled: true})

6. Camera:
   setup_camera_3d(parent: ".", properties: {position: "Vector3(0, 2, 5)",
     rotation_degrees: "Vector3(-15, 0, 0)"})

7. save_scene()
```

## Character Scene Recipe

```
1. create_scene(root_type: "CharacterBody3D", scene_name: "character")

2. Collision:
   setup_collision(node_path: ".", shape_type: "CapsuleShape3D",
     shape_params: {height: 1.8, radius: 0.4})

3. Visual:
   add_mesh_instance(parent: ".", name: "Model", mesh_type: "CapsuleMesh",
     mesh_params: {height: 1.8, radius: 0.4})

4. Camera (FPS):
   add_node(parent: ".", type: "Camera3D", name: "Camera3D",
     properties: {position: "Vector3(0, 0.8, 0)"})

5. Ground detection:
   add_raycast(parent: ".", name: "GroundRay",
     properties: {target_position: "Vector3(0, -1.1, 0)"})

6. Script:
   create_script(path: "res://scripts/character.gd",
     content: "extends CharacterBody3D\n\nconst SPEED: float = 5.0\nconst JUMP_VEL: float = 4.5\n...")
   attach_script(node_path: ".", script_path: "res://scripts/character.gd")

7. save_scene()
```

## UI Panel Recipe

```
1. create_scene(root_type: "MarginContainer", scene_name: "ui_panel")
   set_anchor_preset(node_path: ".", preset: "full_rect")

2. Layout:
   add_node(parent: ".", type: "VBoxContainer", name: "VBox")
   add_node(parent: "VBox", type: "Label", name: "Title",
     properties: {text: "Panel Title", horizontal_alignment: 1})
   add_node(parent: "VBox", type: "HSeparator", name: "Sep")
   add_node(parent: "VBox", type: "HBoxContainer", name: "ButtonRow")

3. Buttons:
   add_node(parent: "VBox/ButtonRow", type: "Button", name: "OkButton",
     properties: {text: "OK", size_flags_horizontal: 3})
   add_node(parent: "VBox/ButtonRow", type: "Button", name: "CancelButton",
     properties: {text: "Cancel", size_flags_horizontal: 3})

4. Theme:
   set_theme_color(node_path: ".", color: "#1a1a2e", type: "MarginContainer")
   set_theme_font_size(node_path: "VBox/Title", size: 24)

5. save_scene()
```

## Particle Effect Recipe

```
1. create_scene(root_type: "Node3D", scene_name: "explosion_effect")

2. create_particles(parent: ".", name: "Sparks", type: "3D")

3. set_particle_material(node_path: "Sparks",
     amount: 32, lifetime: 0.8, one_shot: true, explosiveness: 0.9,
     direction: "Vector3(0, 1, 0)", spread: 180,
     initial_velocity_min: 3, initial_velocity_max: 8,
     gravity: "Vector3(0, -9.8, 0)",
     emission_shape: "sphere", emission_sphere_radius: 0.2)

4. set_particle_color_gradient(node_path: "Sparks",
     colors: ["#ffaa00", "#ff4400", "#44000000"])

5. save_scene()
```

Common particle presets available via `apply_particle_preset`:
- `explosion` — burst outward, fade to smoke
- `fire` — upward stream, orange to red
- `smoke` — slow rise, gray, expanding
- `sparks` — fast burst, bright, gravity affected
- `rain` — downward, blue-gray, spread
- `snow` — slow fall, white, wandering
- `magic` — orbiting, colorful, glowing
- `dust` — ambient float, subtle, small

## Node Hierarchy Best Practices

- Keep scenes shallow — max 5-6 nesting levels
- Use composition over inheritance (separate physics, visual, logic nodes)
- Group related nodes under descriptive parent nodes
- Use scene instances for reusable components
- Name nodes descriptively: `EnemySpawnPoint`, not `Node3D2`

## Transform Quick Reference

```
Position:   Vector3(x, y, z)  — y is UP in Godot
Rotation:   Vector3(pitch, yaw, roll) in degrees
Scale:      Vector3(1, 1, 1) is default

Common sizes (1 unit = 1 meter):
  Human:        1.8m tall, 0.4m radius
  Door:         2.2m tall, 1.0m wide
  Corridor:     4m+ wide
  Small room:   4x4m
  Medium room:  8x8m
  Large room:   16x16m
  Arena:        32x32m

Grid snap: 0.25m for fine, 0.5m for coarse, 1m for layout
```
