---
name: godot-shader-lab
description: |
  Iterative shader development with visual feedback loops via MCP tools.
  Edit shader code, see results via screenshots, analyze, and refine.
  Triggers on: shader, visual effect, material, shader code, write a shader,
  edit shader, shader not working, glsl, gdshader
---

# Shader Lab

Develop and iterate on Godot shaders with a visual feedback loop. Every edit is verified via screenshot.

## Prerequisites
- Godot editor open with project loaded
- godot-mcp-pro server connected
- A node to apply the shader to (mesh, sprite, particle, etc.)

## Workflow

### Step 1: Classify Shader Type

| User Wants | Shader Type | Template |
|-----------|------------|---------|
| 3D surface effect (glow, dissolve, toon) | `shader_type spatial;` | See spatial recipes |
| 2D sprite/UI effect (pixelate, vignette) | `shader_type canvas_item;` | See canvas_item recipes |
| Custom particle behavior | `shader_type particles;` | See particles recipes |
| Sky or fog effect | `shader_type sky;` / `shader_type fog;` | See sky/fog recipes |

### Step 2: Create or Edit Shader

**New shader:**
1. `mcp__godot-mcp-pro__create_shader` -- create .gdshader file with type and initial code
2. `mcp__godot-mcp-pro__assign_shader_material` -- create ShaderMaterial and assign to target node
3. `mcp__godot-mcp-pro__set_shader_param` -- set initial uniform values

**Edit existing:**
1. `mcp__godot-mcp-pro__read_shader` -- read current shader code
2. `mcp__godot-mcp-pro__edit_shader` -- modify via search-replace or full replacement
3. `mcp__godot-mcp-pro__get_shader_params` -- check current parameter values

### Step 3: Visual Feedback Loop

This is the core of the skill. Repeat until the visual result matches intent:

```
LOOP:
  1. Edit shader code (create_shader or edit_shader)
  2. Set parameters (set_shader_param)
  3. Capture result:
     - Editor preview: mcp__godot-mcp-pro__get_editor_screenshot
     - Runtime preview: play_scene + get_game_screenshot + stop_scene
  4. Analyze the screenshot:
     - Does it match the desired effect?
     - What's wrong? (too bright, wrong color, no effect visible, artifacts)
  5. If not right:
     - Diagnose (see troubleshooting below)
     - Adjust shader code or parameters
     - GOTO 1
  6. If satisfied: DONE
```

### Step 4: Troubleshooting

**Nothing visible:**
1. `mcp__godot-mcp-pro__get_editor_errors` -- check for shader compilation errors
2. Verify material is assigned: `mcp__godot-mcp-pro__get_node_properties` on the target node, check `material` or `material_override`
3. Check shader_type matches node type (spatial for MeshInstance3D, canvas_item for Sprite2D/Control)
4. For 3D: check the mesh has UV coordinates (primitives do, but imported meshes might not)
5. Check uniform types match set_shader_param values

**Effect too subtle / too strong:**
- Adjust uniform values with `mcp__godot-mcp-pro__set_shader_param`
- Common: multiply effect intensity, adjust color brightness, change blend mode

**Artifacts / visual errors:**
- Check UV coordinates: `VERTEX.xy`, `UV`, `SCREEN_UV` usage
- Check division by zero in shader math
- Check texture assignments and sampler uniforms
- For transparency: check `render_mode` includes appropriate flags (blend_mix, unshaded, etc.)

**Performance issues:**
- `mcp__godot-mcp-pro__get_performance_monitors` to check GPU impact
- Reduce texture lookups, loop iterations, complex math
- Use `hint_screen_texture` instead of re-reading backbuffer repeatedly

## Spatial Shader Quick Reference

```glsl
shader_type spatial;

// Render modes (common)
render_mode unshaded;                    // No lighting
render_mode blend_mix;                   // Standard alpha blending
render_mode cull_disabled;               // Double-sided
render_mode depth_draw_opaque;           // Write to depth buffer

// Vertex function -- modify geometry
void vertex() {
    VERTEX += NORMAL * displacement;     // Push along normal
    // UV, VERTEX, NORMAL, COLOR available
}

// Fragment function -- modify surface appearance
void fragment() {
    ALBEDO = vec3(1.0, 0.0, 0.0);       // Surface color
    EMISSION = vec3(0.5);                // Self-illumination
    ALPHA = 0.5;                         // Transparency
    ROUGHNESS = 0.8;                     // Surface roughness
    METALLIC = 0.0;                      // Metallic-ness
    // UV, SCREEN_UV, FRAGCOORD, TIME, NORMAL available
}
```

## Canvas Item Shader Quick Reference

```glsl
shader_type canvas_item;

void fragment() {
    vec4 tex = texture(TEXTURE, UV);     // Sample sprite texture
    COLOR = tex;                         // Output color
    // UV, SCREEN_UV, TEXTURE, TIME, AT_LIGHT_PASS available
}
```

## Project Conventions
Check the project's .claude/skills/ and CLAUDE.md for project-specific shader conventions such as color palettes, shader directories, performance budgets, and existing effect libraries.

## Common Patterns

### Uniform Animation via GDScript
Many effects need GDScript to animate shader params:
```gdscript
# Tween a shader parameter
var mat: ShaderMaterial = node.material
var tw: Tween = create_tween()
tw.tween_method(func(v: float) -> void:
    mat.set_shader_parameter("amount", v)
, 0.0, 1.0, duration)
```

### Time-Based Animation in Shader
```glsl
float wave = sin(TIME * speed) * 0.5 + 0.5;  // 0-1 oscillation
float pulse = sin(TIME * speed);                // -1 to 1
```

## Recipe Book

See `${CLAUDE_SKILL_DIR}/shader-recipes.md` for 12 complete, copy-paste-ready shader recipes with MCP tool sequences.
