---
name: godot-scene-builder
description: |
  Compose and modify Godot scenes via MCP tools with visual verification.
  Use when building scenes, adding nodes, creating levels, or populating scenes.
  Triggers on: build scene, compose scene, add nodes, set up scene, create level,
  scene layout, populate scene
---

# Scene Builder

Build Godot scenes interactively through godot-mcp-pro tools. Every change is visually verified.

## Prerequisites
- Godot editor must be open with the project loaded
- godot-mcp-pro server must be connected

## Workflow

### Step 1: Understand Intent
- What scene does the user want? (3D level, UI panel, character, particle effect, etc.)
- New scene or modifying existing?
- What nodes, scripts, and resources are needed?

### Step 2: Create or Open Scene

**New scene:** `mcp__godot-mcp-pro__create_scene` with appropriate root type:
- 3D scenes: `Node3D`
- 2D scenes: `Node2D`
- UI scenes: `Control` or `MarginContainer`
- Generic: `Node`

**Existing scene:** `mcp__godot-mcp-pro__open_scene` then `mcp__godot-mcp-pro__get_scene_tree` to understand current structure.

### Step 3: Build — Iterative Node Addition

For each node/component the user wants:

**Adding nodes:**
- `mcp__godot-mcp-pro__add_node` — add any Godot node type with properties
- `mcp__godot-mcp-pro__add_scene_instance` — instance an existing .tscn
- `mcp__godot-mcp-pro__add_mesh_instance` — add 3D mesh (primitive or imported model)

**Configuring properties:**
- `mcp__godot-mcp-pro__update_property` — set any node property (auto-parses Vector3, Color, etc.)
- `mcp__godot-mcp-pro__batch_set_property` — set same property on all nodes of a type

**3D-specific setup:**
- `mcp__godot-mcp-pro__setup_lighting` — DirectionalLight3D, OmniLight3D, SpotLight3D with presets
- `mcp__godot-mcp-pro__setup_environment` — WorldEnvironment with sky, fog, glow, SSAO
- `mcp__godot-mcp-pro__setup_camera_3d` — camera with projection modes
- `mcp__godot-mcp-pro__set_material_3d` — PBR materials on meshes

**Physics setup:**
- `mcp__godot-mcp-pro__setup_collision` — add CollisionShape2D/3D with shape
- `mcp__godot-mcp-pro__setup_physics_body` — configure CharacterBody/RigidBody
- `mcp__godot-mcp-pro__set_physics_layers` — collision layer/mask

**Scripts:**
- `mcp__godot-mcp-pro__create_script` — create new GDScript
- `mcp__godot-mcp-pro__attach_script` — attach to node

**Signals:**
- `mcp__godot-mcp-pro__connect_signal` — wire up signal connections

### Step 4: Verify — Visual Confirmation

After adding nodes or completing a logical group:

1. `mcp__godot-mcp-pro__get_editor_screenshot` — check layout in editor viewport
2. If runtime check needed:
   - `mcp__godot-mcp-pro__play_scene` — run the scene
   - `mcp__godot-mcp-pro__get_game_screenshot` — capture running result
   - `mcp__godot-mcp-pro__stop_scene` — stop when done
3. Analyze the screenshot — does it match intent?
4. If issues found: adjust properties or restructure, then re-verify

### Step 5: Save

- `mcp__godot-mcp-pro__save_scene` — save to disk

## Decision Branches

### "Build a 3D room/level"
1. `create_scene` with Node3D root
2. Add floor: `add_mesh_instance` (BoxMesh, size Vector3(10, 0.1, 10))
3. Add walls: `add_mesh_instance` for each wall segment
4. `setup_lighting` (DirectionalLight3D or OmniLight3D)
5. `setup_environment` (sky, ambient light)
6. `setup_camera_3d` for preview
7. `setup_collision` on floor and walls (StaticBody3D + BoxShape3D)
8. `get_editor_screenshot` to verify

### "Add enemies/objects to existing scene"
1. `open_scene` + `get_scene_tree` to understand layout
2. Identify placement positions from existing nodes or user description
3. `add_scene_instance` for each entity at specified transforms
4. `get_editor_screenshot` to verify positions

### "Build a UI panel"
1. `create_scene` with Control or MarginContainer root
2. Add containers: VBoxContainer, HBoxContainer, GridContainer via `add_node`
3. Add UI elements: Label, Button, TextureRect, ProgressBar
4. `set_anchor_preset` for responsive layout
5. Apply theme: `set_theme_color`, `set_theme_font_size`, `set_theme_stylebox`
6. `get_editor_screenshot` to verify layout

### "Create a particle effect scene"
1. `create_scene` with Node3D (or Node2D) root
2. `create_particles` (GPUParticles3D or GPUParticles2D)
3. `set_particle_material` — emission, direction, velocity, gravity
4. `set_particle_color_gradient` — color ramp
5. OR `apply_particle_preset` for common effects (explosion, fire, smoke)
6. `play_scene` + `capture_frames` to verify animation

## Project Conventions

Check the project's .claude/skills/ directory and CLAUDE.md for project-specific conventions such as collision layer assignments, naming patterns, build script workflows, and entity systems. These project-local skills override and extend this plugin's generic guidance.

## Common Pitfalls
- Forgetting to `save_scene` after changes
- Not setting `owner` on programmatically added nodes (they won't serialize)
- Collision shapes without a physics body parent
- Lights without environment causing flat shading
- UI anchors not set, causing layout to break at different resolutions
