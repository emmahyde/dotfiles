# Shader Recipes

Complete, copy-paste-ready shader effects for Godot 4.6. Each recipe includes the full gdshader code, uniform defaults, MCP tool sequence to apply, and GDScript animation code where applicable.

---

## 1. Hit Flash

**Type:** Spatial | **Use:** Flash a mesh white (or any color) on damage

Mixes the surface albedo with a solid flash color. Animate `flash_amount` from 1.0 to 0.0 over ~0.12s on hit.

### Shader Code

```glsl
shader_type spatial;

uniform vec3 flash_color : source_color = vec3(1.0, 1.0, 1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
    // Preserve the original surface color from the mesh's existing material/vertex color
    vec3 original = COLOR.rgb;
    ALBEDO = mix(original, flash_color, flash_amount);
    EMISSION = flash_color * flash_amount * 2.0;
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `flash_color` | vec3 (color) | white (1,1,1) | Color to flash |
| `flash_amount` | float 0-1 | 0.0 | 0 = normal, 1 = fully flashed |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/effects/hit_flash.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/Enemy"
   shader_path: "res://shaders/effects/hit_flash.gdshader"

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Enemy"
   param_name: "flash_color"
   value: Vector3(1.0, 1.0, 1.0)

4. mcp__godot-mcp-pro__get_editor_screenshot  (verify)
```

### GDScript Animation

```gdscript
func flash_hit(node: Node3D, color: Color = Color.WHITE, duration: float = 0.12) -> void:
    var mat: ShaderMaterial = node.material_override
    if mat == null:
        return
    mat.set_shader_parameter("flash_color", Vector3(color.r, color.g, color.b))
    mat.set_shader_parameter("flash_amount", 1.0)
    var tw: Tween = node.create_tween()
    tw.tween_method(func(v: float) -> void:
        mat.set_shader_parameter("flash_amount", v)
    , 1.0, 0.0, duration)
```

---

## 2. Dissolve

**Type:** Spatial | **Use:** Noise-based disintegration with glowing edge

Uses a noise texture to progressively reveal/hide a surface. A bright edge color glows along the dissolve boundary.

### Shader Code

```glsl
shader_type spatial;
render_mode cull_disabled;

uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;
uniform float edge_width : hint_range(0.0, 0.15) = 0.05;
uniform vec3 edge_color : source_color = vec3(1.0, 0.3, 0.0);
uniform float edge_emission_strength : hint_range(0.0, 10.0) = 4.0;
uniform sampler2D noise_texture : hint_default_white, filter_linear, repeat_enable;
uniform float noise_scale : hint_range(0.1, 10.0) = 2.0;

void fragment() {
    float noise_val = texture(noise_texture, UV * noise_scale).r;

    // Discard pixels below the threshold
    float threshold = dissolve_amount;
    if (noise_val < threshold) {
        discard;
    }

    // Glowing edge band
    float edge_start = threshold;
    float edge_end = threshold + edge_width;
    float edge_factor = 1.0 - smoothstep(edge_start, edge_end, noise_val);

    ALBEDO = mix(COLOR.rgb, edge_color, edge_factor);
    EMISSION = edge_color * edge_factor * edge_emission_strength;
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `dissolve_amount` | float 0-1 | 0.0 | 0 = fully visible, 1 = fully dissolved |
| `edge_width` | float 0-0.15 | 0.05 | Width of the glowing edge band |
| `edge_color` | vec3 (color) | orange (1, 0.3, 0) | Color of the dissolve edge |
| `edge_emission_strength` | float 0-10 | 4.0 | Glow intensity of the edge |
| `noise_texture` | sampler2D | white | Noise texture driving the pattern |
| `noise_scale` | float 0.1-10 | 2.0 | UV scale of the noise |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/effects/dissolve.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/Enemy"
   shader_path: "res://shaders/effects/dissolve.gdshader"

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Enemy"
   param_name: "edge_color"
   value: Vector3(1.0, 0.3, 0.0)

4. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Enemy"
   param_name: "dissolve_amount"
   value: 0.3   (test a partial dissolve)

5. mcp__godot-mcp-pro__get_editor_screenshot  (verify edge glow visible)
```

### GDScript Animation

```gdscript
func dissolve_out(node: Node3D, color: Color = Color(1.0, 0.3, 0.0), duration: float = 0.6) -> void:
    var mat: ShaderMaterial = node.material_override
    if mat == null:
        return
    mat.set_shader_parameter("edge_color", Vector3(color.r, color.g, color.b))
    var tw: Tween = node.create_tween()
    tw.tween_method(func(v: float) -> void:
        mat.set_shader_parameter("dissolve_amount", v)
    , 0.0, 1.0, duration)
    tw.tween_callback(node.queue_free)
```

---

## 3. Outline (Inverted Hull)

**Type:** Spatial | **Use:** Solid-color outline around a mesh using vertex extrusion

This uses the inverted hull method: render back-faces only, extruded along normals. Apply this as a second material pass or on a duplicate mesh.

### Shader Code

```glsl
shader_type spatial;
render_mode unshaded, cull_front;

uniform vec3 outline_color : source_color = vec3(0.0, 0.0, 0.0);
uniform float outline_thickness : hint_range(0.0, 0.1) = 0.02;

void vertex() {
    // Extrude vertices along their normals in clip space
    vec4 clip_pos = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
    vec3 clip_normal = mat3(PROJECTION_MATRIX) * (mat3(MODELVIEW_MATRIX) * NORMAL);

    // Scale extrusion by distance to maintain consistent screen-space width
    float thickness = outline_thickness * clip_pos.w;
    clip_pos.xy += normalize(clip_normal.xy) * thickness;

    POSITION = clip_pos;
}

void fragment() {
    ALBEDO = outline_color;
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `outline_color` | vec3 (color) | black (0,0,0) | Color of the outline |
| `outline_thickness` | float 0-0.1 | 0.02 | Thickness in clip space units |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/effects/outline.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/Player"
   shader_path: "res://shaders/effects/outline.gdshader"
   -- Note: assign as next_pass material, not primary material.
   -- Or duplicate the MeshInstance3D and apply as material_override.

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Player"
   param_name: "outline_color"
   value: Vector3(0.0, 0.0, 0.0)

4. mcp__godot-mcp-pro__get_editor_screenshot  (verify outline visible)
```

### Notes
- For next_pass usage: set the main material's `next_pass` to a ShaderMaterial with this shader.
- Thickness may need tuning per mesh scale. Start with 0.01-0.03.
- For selected/highlighted objects, use a bright color like player blue (#4a9eff).

---

## 4. Hologram

**Type:** Spatial | **Use:** Sci-fi hologram with scanlines, flicker, and edge glow

Combines horizontal scanlines, alpha flicker, fresnel edge glow, and a blue tint for a classic hologram look.

### Shader Code

```glsl
shader_type spatial;
render_mode blend_mix, cull_disabled, unshaded;

uniform vec3 hologram_color : source_color = vec3(0.29, 0.62, 1.0);
uniform float scanline_count : hint_range(10.0, 200.0) = 80.0;
uniform float scanline_speed : hint_range(0.0, 5.0) = 1.5;
uniform float scanline_strength : hint_range(0.0, 1.0) = 0.3;
uniform float flicker_speed : hint_range(0.0, 20.0) = 8.0;
uniform float flicker_strength : hint_range(0.0, 0.5) = 0.15;
uniform float fresnel_power : hint_range(0.5, 8.0) = 2.5;
uniform float fresnel_strength : hint_range(0.0, 3.0) = 1.5;
uniform float base_alpha : hint_range(0.0, 1.0) = 0.4;
uniform float emission_energy : hint_range(0.0, 10.0) = 2.0;
uniform float glitch_speed : hint_range(0.0, 10.0) = 3.0;
uniform float glitch_strength : hint_range(0.0, 0.1) = 0.02;

void vertex() {
    // Subtle vertex glitch -- horizontal offset based on world-space Y
    float glitch = step(0.95, fract(sin(TIME * glitch_speed + VERTEX.y * 50.0) * 43758.5453));
    VERTEX.x += glitch * glitch_strength * sin(TIME * 30.0);
}

void fragment() {
    // Fresnel edge glow
    float ndv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, fresnel_power) * fresnel_strength;

    // Scrolling scanlines using world-space Y via UV
    float scanline_y = UV.y * scanline_count + TIME * scanline_speed;
    float scanline = sin(scanline_y * 3.14159) * 0.5 + 0.5;
    scanline = 1.0 - scanline * scanline_strength;

    // Flicker -- rapid random-ish alpha variation
    float flicker = 1.0 - flicker_strength * (sin(TIME * flicker_speed) * sin(TIME * flicker_speed * 0.7 + 1.3));

    // Combine alpha
    float alpha = base_alpha * scanline * flicker;
    alpha += fresnel * 0.5;
    alpha = clamp(alpha, 0.0, 1.0);

    ALBEDO = hologram_color;
    ALPHA = alpha;
    EMISSION = hologram_color * (emission_energy + fresnel * 2.0);
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `hologram_color` | vec3 (color) | blue (0.29, 0.62, 1.0) | Base hologram tint |
| `scanline_count` | float 10-200 | 80.0 | Number of scanlines across UV |
| `scanline_speed` | float 0-5 | 1.5 | Vertical scroll speed |
| `scanline_strength` | float 0-1 | 0.3 | Intensity of scanline darkening |
| `flicker_speed` | float 0-20 | 8.0 | Speed of alpha flicker |
| `flicker_strength` | float 0-0.5 | 0.15 | Amplitude of flicker |
| `fresnel_power` | float 0.5-8 | 2.5 | Edge glow falloff sharpness |
| `fresnel_strength` | float 0-3 | 1.5 | Edge glow intensity |
| `base_alpha` | float 0-1 | 0.4 | Base transparency level |
| `emission_energy` | float 0-10 | 2.0 | Emission brightness |
| `glitch_speed` | float 0-10 | 3.0 | Vertex glitch frequency |
| `glitch_strength` | float 0-0.1 | 0.02 | Vertex glitch offset amount |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/effects/hologram.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/HologramDisplay"
   shader_path: "res://shaders/effects/hologram.gdshader"

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/HologramDisplay"
   param_name: "hologram_color"
   value: Vector3(0.29, 0.62, 1.0)

4. mcp__godot-mcp-pro__get_editor_screenshot  (verify hologram look)
```

### GDScript Animation

```gdscript
## Fade hologram in/out
func hologram_fade(node: Node3D, fade_in: bool = true, duration: float = 0.5) -> void:
    var mat: ShaderMaterial = node.material_override
    if mat == null:
        return
    var start: float = 0.0 if fade_in else 0.4
    var end: float = 0.4 if fade_in else 0.0
    var tw: Tween = node.create_tween()
    tw.tween_method(func(v: float) -> void:
        mat.set_shader_parameter("base_alpha", v)
    , start, end, duration)
```

---

## 5. Force Field

**Type:** Spatial | **Use:** Fresnel bubble with scrolling hex pattern and intersection highlight

Creates an energy shield / force field look with edge glow, animated hexagonal pattern, and optional depth-based intersection highlight.

### Shader Code

```glsl
shader_type spatial;
render_mode blend_add, cull_disabled, unshaded, shadows_disabled;

uniform vec3 field_color : source_color = vec3(0.29, 0.62, 1.0);
uniform float fresnel_power : hint_range(0.5, 8.0) = 3.0;
uniform float fresnel_brightness : hint_range(0.0, 5.0) = 2.0;
uniform float hex_scale : hint_range(1.0, 50.0) = 12.0;
uniform float hex_line_width : hint_range(0.01, 0.2) = 0.06;
uniform float hex_scroll_speed : hint_range(0.0, 2.0) = 0.3;
uniform float hex_brightness : hint_range(0.0, 3.0) = 0.8;
uniform float pulse_speed : hint_range(0.0, 5.0) = 1.0;
uniform float pulse_strength : hint_range(0.0, 1.0) = 0.3;
uniform float overall_intensity : hint_range(0.0, 1.0) = 1.0;

// Hexagonal distance function
float hex_distance(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.73))), p.x);
}

float hex_pattern(vec2 uv) {
    // Offset every other row for hex tiling
    vec2 scaled = uv * hex_scale;
    vec2 grid_id = floor(scaled);
    vec2 grid_frac = fract(scaled) - 0.5;

    // Offset alternating rows
    float row_offset = mod(grid_id.y, 2.0) * 0.5;
    scaled.x += row_offset;
    grid_id = floor(scaled);
    grid_frac = fract(scaled) - 0.5;

    float d = hex_distance(grid_frac);
    // Return line brightness (1 at edge, 0 at center)
    return smoothstep(0.5 - hex_line_width, 0.5, d);
}

void fragment() {
    // Fresnel edge glow
    float ndv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, fresnel_power) * fresnel_brightness;

    // Scrolling hex pattern
    vec2 hex_uv = UV + vec2(0.0, TIME * hex_scroll_speed);
    float hex = hex_pattern(hex_uv) * hex_brightness;

    // Pulse animation
    float pulse = 1.0 - pulse_strength + pulse_strength * sin(TIME * pulse_speed) * 0.5 + 0.5;

    // Combine
    float intensity = (fresnel + hex * 0.4) * pulse * overall_intensity;

    ALBEDO = field_color * intensity;
    ALPHA = clamp(intensity * 0.6, 0.0, 1.0);
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `field_color` | vec3 (color) | blue (0.29, 0.62, 1.0) | Shield color |
| `fresnel_power` | float 0.5-8 | 3.0 | Edge glow falloff |
| `fresnel_brightness` | float 0-5 | 2.0 | Edge glow intensity |
| `hex_scale` | float 1-50 | 12.0 | Hexagon tile density |
| `hex_line_width` | float 0.01-0.2 | 0.06 | Hex grid line thickness |
| `hex_scroll_speed` | float 0-2 | 0.3 | Vertical scroll speed |
| `hex_brightness` | float 0-3 | 0.8 | Hex pattern intensity |
| `pulse_speed` | float 0-5 | 1.0 | Overall pulse rate |
| `pulse_strength` | float 0-1 | 0.3 | Pulse amplitude |
| `overall_intensity` | float 0-1 | 1.0 | Master brightness (animate on hit) |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/effects/force_field.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/Shield"
   shader_path: "res://shaders/effects/force_field.gdshader"

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Shield"
   param_name: "field_color"
   value: Vector3(0.29, 0.62, 1.0)

4. mcp__godot-mcp-pro__get_editor_screenshot  (verify hex pattern + fresnel)
```

### GDScript Animation

```gdscript
## Flash the shield on impact
func shield_hit(node: Node3D, duration: float = 0.3) -> void:
    var mat: ShaderMaterial = node.material_override
    if mat == null:
        return
    mat.set_shader_parameter("overall_intensity", 1.0)
    var tw: Tween = node.create_tween()
    tw.tween_method(func(v: float) -> void:
        mat.set_shader_parameter("overall_intensity", v)
    , 1.0, 0.3, duration).set_ease(Tween.EASE_OUT)
```

---

## 6. Water Surface

**Type:** Spatial | **Use:** Animated water with vertex displacement, UV distortion, and depth transparency

Vertex-displaced surface with two-layer UV scrolling for natural water motion. Uses depth texture for shore fade.

### Shader Code

```glsl
shader_type spatial;
render_mode blend_mix, cull_disabled, specular_schlick_ggx;

uniform vec3 water_color_shallow : source_color = vec3(0.1, 0.5, 0.6);
uniform vec3 water_color_deep : source_color = vec3(0.02, 0.1, 0.2);
uniform float wave_speed : hint_range(0.0, 5.0) = 1.0;
uniform float wave_height : hint_range(0.0, 1.0) = 0.15;
uniform float wave_frequency : hint_range(0.5, 10.0) = 3.0;
uniform float uv_distortion_speed : hint_range(0.0, 2.0) = 0.3;
uniform float uv_distortion_strength : hint_range(0.0, 0.1) = 0.02;
uniform float base_alpha : hint_range(0.0, 1.0) = 0.7;
uniform float fresnel_power : hint_range(0.5, 8.0) = 4.0;
uniform float specular_intensity : hint_range(0.0, 1.0) = 0.8;
uniform float foam_threshold : hint_range(0.0, 1.0) = 0.7;
uniform vec3 foam_color : source_color = vec3(0.9, 0.95, 1.0);
uniform sampler2D normal_map_texture : hint_normal, filter_linear, repeat_enable;
uniform float normal_map_scale : hint_range(0.1, 10.0) = 2.0;

void vertex() {
    // Two overlapping sine waves for organic displacement
    float wave1 = sin(VERTEX.x * wave_frequency + TIME * wave_speed) * wave_height;
    float wave2 = sin(VERTEX.z * wave_frequency * 0.7 + TIME * wave_speed * 1.3) * wave_height * 0.6;
    float wave3 = cos((VERTEX.x + VERTEX.z) * wave_frequency * 0.5 + TIME * wave_speed * 0.8) * wave_height * 0.3;

    VERTEX.y += wave1 + wave2 + wave3;

    // Recalculate normal from wave derivatives
    float dx = cos(VERTEX.x * wave_frequency + TIME * wave_speed) * wave_frequency * wave_height;
    float dz = cos(VERTEX.z * wave_frequency * 0.7 + TIME * wave_speed * 1.3) * wave_frequency * 0.7 * wave_height * 0.6;
    NORMAL = normalize(vec3(-dx, 1.0, -dz));
}

void fragment() {
    // Scrolling UV distortion for two layers
    vec2 uv1 = UV * normal_map_scale + vec2(TIME * uv_distortion_speed, TIME * uv_distortion_speed * 0.5);
    vec2 uv2 = UV * normal_map_scale * 1.3 + vec2(-TIME * uv_distortion_speed * 0.7, TIME * uv_distortion_speed * 0.3);

    // UV distortion from normal map layers
    vec3 norm1 = texture(normal_map_texture, uv1).rgb * 2.0 - 1.0;
    vec3 norm2 = texture(normal_map_texture, uv2).rgb * 2.0 - 1.0;
    vec3 combined_normal = normalize(norm1 + norm2);

    NORMAL_MAP = combined_normal * 0.5 + 0.5;
    NORMAL_MAP_DEPTH = 0.5;

    // Fresnel-based depth coloring
    float ndv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
    float fresnel = pow(1.0 - ndv, fresnel_power);

    vec3 color = mix(water_color_deep, water_color_shallow, fresnel);

    // Foam on wave peaks (using vertex height encoded in UV distortion)
    float foam = smoothstep(foam_threshold, 1.0, combined_normal.y * 0.5 + 0.5);
    color = mix(color, foam_color, foam * 0.4);

    ALBEDO = color;
    ALPHA = mix(base_alpha, 1.0, fresnel * 0.5);
    ROUGHNESS = 0.05;
    METALLIC = 0.0;
    SPECULAR = specular_intensity;
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `water_color_shallow` | vec3 (color) | teal (0.1, 0.5, 0.6) | Color at glancing angles |
| `water_color_deep` | vec3 (color) | dark blue (0.02, 0.1, 0.2) | Color when looking straight down |
| `wave_speed` | float 0-5 | 1.0 | Wave animation speed |
| `wave_height` | float 0-1 | 0.15 | Vertex displacement height |
| `wave_frequency` | float 0.5-10 | 3.0 | Wave density |
| `normal_map_texture` | sampler2D | -- | Normal map for surface detail |
| `normal_map_scale` | float 0.1-10 | 2.0 | UV scale for normal map |
| `base_alpha` | float 0-1 | 0.7 | Base water opacity |
| `foam_threshold` | float 0-1 | 0.7 | Foam appearance threshold |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/materials/water_surface.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/WaterPlane"
   shader_path: "res://shaders/materials/water_surface.gdshader"

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/WaterPlane"
   param_name: "wave_height"
   value: 0.15

4. mcp__godot-mcp-pro__get_editor_screenshot  (verify wave displacement)
```

---

## 7. Damage Vignette

**Type:** Canvas Item | **Use:** Screen-edge darkening/reddening for damage feedback

A full-screen post-process effect. Apply to a ColorRect that covers the viewport. Animate `intensity` on damage.

### Shader Code

```glsl
shader_type canvas_item;

uniform vec3 vignette_color : source_color = vec3(0.6, 0.0, 0.0);
uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float inner_radius : hint_range(0.0, 1.0) = 0.4;
uniform float outer_radius : hint_range(0.0, 1.5) = 0.9;
uniform float softness : hint_range(0.01, 1.0) = 0.5;
uniform float pulse_speed : hint_range(0.0, 10.0) = 4.0;
uniform float pulse_amount : hint_range(0.0, 0.3) = 0.1;

void fragment() {
    // Distance from center of screen (UV 0.5, 0.5)
    vec2 center = UV - vec2(0.5);
    float dist = length(center) * 2.0;

    // Pulsing radius when active
    float pulse = sin(TIME * pulse_speed) * pulse_amount * intensity;
    float inner = inner_radius - pulse;
    float outer = outer_radius - pulse;

    // Smooth vignette ring
    float vignette = smoothstep(inner, outer, dist * (1.0 + softness));

    // Apply intensity
    float alpha = vignette * intensity;

    COLOR = vec4(vignette_color, alpha);
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `vignette_color` | vec3 (color) | dark red (0.6, 0, 0) | Vignette tint color |
| `intensity` | float 0-1 | 0.0 | 0 = hidden, 1 = full effect |
| `inner_radius` | float 0-1 | 0.4 | Where vignette starts |
| `outer_radius` | float 0-1.5 | 0.9 | Where vignette reaches full |
| `softness` | float 0.01-1 | 0.5 | Edge feathering |
| `pulse_speed` | float 0-10 | 4.0 | Pulse animation speed |
| `pulse_amount` | float 0-0.3 | 0.1 | Pulse amplitude |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/post_process/damage_vignette.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__add_node
   parent_path: "/root/Main/HUD"
   node_type: "ColorRect"
   node_name: "DamageVignette"

3. mcp__godot-mcp-pro__set_anchor_preset
   node_path: "/root/Main/HUD/DamageVignette"
   preset: "full_rect"

4. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/HUD/DamageVignette"
   shader_path: "res://shaders/post_process/damage_vignette.gdshader"

5. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/HUD/DamageVignette"
   param_name: "intensity"
   value: 0.7   (test preview)

6. mcp__godot-mcp-pro__get_editor_screenshot  (verify red edges)
```

### GDScript Animation

```gdscript
## Flash damage vignette then fade
func show_damage_vignette(vignette_node: ColorRect, duration: float = 0.6) -> void:
    var mat: ShaderMaterial = vignette_node.material
    if mat == null:
        return
    mat.set_shader_parameter("intensity", 0.8)
    var tw: Tween = vignette_node.create_tween()
    tw.tween_method(func(v: float) -> void:
        mat.set_shader_parameter("intensity", v)
    , 0.8, 0.0, duration).set_ease(Tween.EASE_OUT)

## Persistent low-health vignette (call in _process)
func update_health_vignette(vignette_node: ColorRect, health_ratio: float) -> void:
    var mat: ShaderMaterial = vignette_node.material
    if mat == null:
        return
    # Show vignette below 30% health
    var target: float = clamp((0.3 - health_ratio) / 0.3, 0.0, 1.0) * 0.5
    mat.set_shader_parameter("intensity", target)
```

---

## 8. Pixelate

**Type:** Canvas Item | **Use:** UV quantization for retro/pixel art effect

Snaps UV coordinates to a grid, producing a chunky pixel look. Apply to a TextureRect, Sprite2D, or as a screen-wide effect on a ColorRect with a screen texture.

### Shader Code

```glsl
shader_type canvas_item;

uniform float pixel_size : hint_range(1.0, 64.0) = 8.0;
uniform sampler2D screen_texture : hint_screen_texture, filter_nearest;

void fragment() {
    // Get viewport resolution
    vec2 screen_size = vec2(textureSize(screen_texture, 0));

    // Quantize UV to pixel grid
    vec2 grid_size = screen_size / pixel_size;
    vec2 quantized_uv = floor(SCREEN_UV * grid_size) / grid_size;

    COLOR = texture(screen_texture, quantized_uv);
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `pixel_size` | float 1-64 | 8.0 | Size of each "pixel" block |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/post_process/pixelate.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__add_node
   parent_path: "/root/Main/HUD"
   node_type: "ColorRect"
   node_name: "PixelateEffect"

3. mcp__godot-mcp-pro__set_anchor_preset
   node_path: "/root/Main/HUD/PixelateEffect"
   preset: "full_rect"

4. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/HUD/PixelateEffect"
   shader_path: "res://shaders/post_process/pixelate.gdshader"

5. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/HUD/PixelateEffect"
   param_name: "pixel_size"
   value: 8.0

6. mcp__godot-mcp-pro__get_editor_screenshot  (verify pixelation)
```

### GDScript Animation

```gdscript
## Transition into pixelated (e.g., teleport or death)
func pixelate_transition(effect_node: ColorRect, duration: float = 0.5) -> void:
    var mat: ShaderMaterial = effect_node.material
    if mat == null:
        return
    effect_node.visible = true
    var tw: Tween = effect_node.create_tween()
    tw.tween_method(func(v: float) -> void:
        mat.set_shader_parameter("pixel_size", v)
    , 1.0, 32.0, duration)
```

---

## 9. Scanlines

**Type:** Canvas Item | **Use:** CRT-style horizontal scanline overlay

Draws alternating dark lines across the screen for a retro CRT monitor feel. Apply to a full-screen ColorRect.

### Shader Code

```glsl
shader_type canvas_item;

uniform float line_count : hint_range(50.0, 1000.0) = 300.0;
uniform float line_brightness : hint_range(0.0, 1.0) = 0.85;
uniform float line_speed : hint_range(0.0, 5.0) = 0.0;
uniform float flicker_speed : hint_range(0.0, 30.0) = 0.0;
uniform float flicker_amount : hint_range(0.0, 0.2) = 0.0;
uniform float curvature : hint_range(0.0, 0.1) = 0.0;
uniform sampler2D screen_texture : hint_screen_texture, filter_linear;

vec2 curve_uv(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    uv *= 1.0 + curvature * dot(uv, uv);
    uv = uv * 0.5 + 0.5;
    return uv;
}

void fragment() {
    vec2 uv = curve_uv(SCREEN_UV);

    // Out-of-bounds check for curvature
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        COLOR = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 screen = texture(screen_texture, uv);

    // Scanline pattern
    float scanline_y = uv.y * line_count + TIME * line_speed;
    float scanline = sin(scanline_y * 3.14159 * 2.0) * 0.5 + 0.5;
    float brightness = mix(line_brightness, 1.0, scanline);

    // Optional global flicker
    float flicker = 1.0 - flicker_amount * sin(TIME * flicker_speed);

    COLOR = vec4(screen.rgb * brightness * flicker, 1.0);
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `line_count` | float 50-1000 | 300.0 | Number of scanlines |
| `line_brightness` | float 0-1 | 0.85 | Darkest point of scanline (1 = no effect) |
| `line_speed` | float 0-5 | 0.0 | Vertical scroll speed (0 = static) |
| `flicker_speed` | float 0-30 | 0.0 | Global brightness flicker rate |
| `flicker_amount` | float 0-0.2 | 0.0 | Flicker amplitude |
| `curvature` | float 0-0.1 | 0.0 | CRT barrel distortion |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/post_process/scanlines.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__add_node
   parent_path: "/root/Main/HUD"
   node_type: "ColorRect"
   node_name: "ScanlineOverlay"

3. mcp__godot-mcp-pro__set_anchor_preset
   node_path: "/root/Main/HUD/ScanlineOverlay"
   preset: "full_rect"

4. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/HUD/ScanlineOverlay"
   shader_path: "res://shaders/post_process/scanlines.gdshader"

5. mcp__godot-mcp-pro__get_editor_screenshot  (verify lines visible)
```

---

## 10. Chromatic Aberration

**Type:** Canvas Item | **Use:** Split RGB channels with offset for distortion effect

Samples the red, green, and blue channels at slightly different UV positions, creating a color-fringing effect. Great for damage feedback, glitch, or stylistic looks.

### Shader Code

```glsl
shader_type canvas_item;

uniform float strength : hint_range(0.0, 0.05) = 0.005;
uniform float angle : hint_range(0.0, 6.283) = 0.0;
uniform bool radial = false;
uniform float radial_strength : hint_range(0.0, 0.02) = 0.005;
uniform sampler2D screen_texture : hint_screen_texture, filter_linear;

void fragment() {
    vec2 direction;

    if (radial) {
        // Radial: offset direction points away from center
        direction = normalize(SCREEN_UV - vec2(0.5));
        float dist = length(SCREEN_UV - vec2(0.5));
        direction *= dist * radial_strength;
    } else {
        // Directional: fixed angle offset
        direction = vec2(cos(angle), sin(angle)) * strength;
    }

    float r = texture(screen_texture, SCREEN_UV + direction).r;
    float g = texture(screen_texture, SCREEN_UV).g;
    float b = texture(screen_texture, SCREEN_UV - direction).b;

    COLOR = vec4(r, g, b, 1.0);
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `strength` | float 0-0.05 | 0.005 | Offset distance (directional mode) |
| `angle` | float 0-6.283 | 0.0 | Direction angle in radians |
| `radial` | bool | false | Use radial mode instead of directional |
| `radial_strength` | float 0-0.02 | 0.005 | Offset multiplier for radial mode |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/post_process/chromatic_aberration.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__add_node
   parent_path: "/root/Main/HUD"
   node_type: "ColorRect"
   node_name: "ChromaticAberration"

3. mcp__godot-mcp-pro__set_anchor_preset
   node_path: "/root/Main/HUD/ChromaticAberration"
   preset: "full_rect"

4. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/HUD/ChromaticAberration"
   shader_path: "res://shaders/post_process/chromatic_aberration.gdshader"

5. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/HUD/ChromaticAberration"
   param_name: "strength"
   value: 0.005

6. mcp__godot-mcp-pro__get_editor_screenshot  (verify RGB fringing)
```

### GDScript Animation

```gdscript
## Flash chromatic aberration on hit
func chromatic_hit(effect_node: ColorRect, duration: float = 0.3) -> void:
    var mat: ShaderMaterial = effect_node.material
    if mat == null:
        return
    effect_node.visible = true
    var tw: Tween = effect_node.create_tween()
    tw.tween_method(func(v: float) -> void:
        mat.set_shader_parameter("strength", v)
    , 0.02, 0.0, duration).set_ease(Tween.EASE_OUT)
    tw.tween_callback(func() -> void:
        effect_node.visible = false
    )
```

---

## 11. Rim Glow

**Type:** Spatial | **Use:** Fresnel-based edge lighting for pickups, selection highlights, energy effects

A clean fresnel rim glow that adds emission at mesh edges. Lightweight and versatile.

### Shader Code

```glsl
shader_type spatial;

uniform vec3 rim_color : source_color = vec3(0.29, 0.62, 1.0);
uniform float rim_power : hint_range(0.5, 8.0) = 3.0;
uniform float rim_intensity : hint_range(0.0, 10.0) = 2.0;
uniform float rim_alpha_influence : hint_range(0.0, 1.0) = 0.0;
uniform float pulse_speed : hint_range(0.0, 10.0) = 0.0;
uniform float pulse_min : hint_range(0.0, 1.0) = 0.5;

void fragment() {
    ALBEDO = COLOR.rgb;

    // Fresnel calculation
    float ndv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
    float rim = pow(1.0 - ndv, rim_power);

    // Optional pulse
    float pulse = 1.0;
    if (pulse_speed > 0.0) {
        pulse = mix(pulse_min, 1.0, sin(TIME * pulse_speed) * 0.5 + 0.5);
    }

    // Apply rim emission
    EMISSION = rim_color * rim * rim_intensity * pulse;

    // Optionally influence alpha for glow-only effect
    if (rim_alpha_influence > 0.0) {
        ALPHA = mix(1.0, rim, rim_alpha_influence);
    }
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `rim_color` | vec3 (color) | blue (0.29, 0.62, 1.0) | Rim glow color |
| `rim_power` | float 0.5-8 | 3.0 | Falloff sharpness (higher = thinner rim) |
| `rim_intensity` | float 0-10 | 2.0 | Emission brightness |
| `rim_alpha_influence` | float 0-1 | 0.0 | How much rim affects alpha (0 = none) |
| `pulse_speed` | float 0-10 | 0.0 | Pulsing speed (0 = static) |
| `pulse_min` | float 0-1 | 0.5 | Minimum pulse brightness |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/effects/rim_glow.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/Pickup"
   shader_path: "res://shaders/effects/rim_glow.gdshader"

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Pickup"
   param_name: "rim_color"
   value: Vector3(0.29, 1.0, 0.29)   (green for pickup)

4. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Pickup"
   param_name: "pulse_speed"
   value: 3.0

5. mcp__godot-mcp-pro__get_editor_screenshot  (verify pulsing green rim)
```

---

## 12. Toon Shading

**Type:** Spatial | **Use:** Cel-shaded / stepped lighting with ink outline

Quantizes lighting into discrete steps for a cartoon look. Combines with the outline shader (Recipe 3) for a complete toon style.

### Shader Code

```glsl
shader_type spatial;

uniform vec3 base_color : source_color = vec3(0.8, 0.3, 0.3);
uniform int shade_steps : hint_range(2, 8) = 3;
uniform float shade_softness : hint_range(0.0, 0.2) = 0.02;
uniform vec3 shadow_color : source_color = vec3(0.15, 0.1, 0.1);
uniform float shadow_threshold : hint_range(-1.0, 1.0) = 0.0;
uniform vec3 specular_color : source_color = vec3(1.0, 1.0, 1.0);
uniform float specular_size : hint_range(0.0, 1.0) = 0.1;
uniform float specular_smoothness : hint_range(0.001, 0.1) = 0.02;
uniform vec3 rim_color : source_color = vec3(1.0, 1.0, 1.0);
uniform float rim_threshold : hint_range(0.0, 1.0) = 0.6;
uniform float rim_smoothness : hint_range(0.001, 0.2) = 0.05;
uniform float rim_amount : hint_range(0.0, 1.0) = 0.3;

void fragment() {
    ALBEDO = base_color;
    // Pass values to the light function via built-in properties
    ROUGHNESS = 1.0;
    SPECULAR = 0.0;
    METALLIC = 0.0;
}

void light() {
    // Stepped diffuse lighting
    float ndl = dot(NORMAL, LIGHT);
    float stepped_ndl = ndl;

    // Quantize into steps
    float step_size = 1.0 / float(shade_steps);
    stepped_ndl = floor((ndl * 0.5 + 0.5) * float(shade_steps)) / float(shade_steps);

    // Smooth step edges slightly
    float raw_step = floor((ndl * 0.5 + 0.5) * float(shade_steps)) / float(shade_steps);
    float next_step = ceil((ndl * 0.5 + 0.5) * float(shade_steps)) / float(shade_steps);
    float frac_val = fract((ndl * 0.5 + 0.5) * float(shade_steps));
    stepped_ndl = mix(raw_step, next_step, smoothstep(0.5 - shade_softness * float(shade_steps), 0.5 + shade_softness * float(shade_steps), frac_val));

    // Shadow color below threshold
    vec3 lit_color = ALBEDO * LIGHT_COLOR * ATTENUATION;
    vec3 shaded_color = mix(shadow_color, lit_color, stepped_ndl);

    DIFFUSE_LIGHT += shaded_color;

    // Specular highlight (hard-edged)
    vec3 H = normalize(VIEW + LIGHT);
    float ndh = dot(NORMAL, H);
    float spec = smoothstep(1.0 - specular_size - specular_smoothness, 1.0 - specular_size + specular_smoothness, ndh);
    SPECULAR_LIGHT += specular_color * spec * ATTENUATION * stepped_ndl;

    // Rim light (view-dependent, light-dependent)
    float ndv = 1.0 - dot(NORMAL, VIEW);
    float rim = ndv * pow(ndl, 0.3);
    rim = smoothstep(rim_threshold - rim_smoothness, rim_threshold + rim_smoothness, rim);
    DIFFUSE_LIGHT += rim_color * rim * rim_amount * ATTENUATION;
}
```

### Uniforms

| Name | Type | Default | Purpose |
|------|------|---------|---------|
| `base_color` | vec3 (color) | soft red (0.8, 0.3, 0.3) | Base surface color |
| `shade_steps` | int 2-8 | 3 | Number of discrete shading bands |
| `shade_softness` | float 0-0.2 | 0.02 | Band edge softness |
| `shadow_color` | vec3 (color) | dark (0.15, 0.1, 0.1) | Color in full shadow |
| `specular_color` | vec3 (color) | white (1,1,1) | Specular highlight color |
| `specular_size` | float 0-1 | 0.1 | Size of the specular dot |
| `rim_color` | vec3 (color) | white (1,1,1) | Rim light color |
| `rim_threshold` | float 0-1 | 0.6 | Rim cutoff angle |
| `rim_amount` | float 0-1 | 0.3 | Rim light intensity |

### MCP Tool Sequence

```
1. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/materials/toon.gdshader"
   code: <shader code above>

2. mcp__godot-mcp-pro__assign_shader_material
   node_path: "/root/Main/Character"
   shader_path: "res://shaders/materials/toon.gdshader"

3. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Character"
   param_name: "base_color"
   value: Vector3(0.8, 0.3, 0.3)

4. mcp__godot-mcp-pro__set_shader_param
   node_path: "/root/Main/Character"
   param_name: "shade_steps"
   value: 3

5. mcp__godot-mcp-pro__get_editor_screenshot  (verify stepped shading)

-- Optional: add outline as next_pass using Recipe 3
6. mcp__godot-mcp-pro__create_shader
   path: "res://shaders/effects/outline.gdshader"
   code: <outline shader from Recipe 3>

-- Set outline as next_pass on the toon material for complete cel-shaded look
```

### Notes
- Combine with Recipe 3 (Outline) for a complete toon look: toon shader as primary, outline shader as `next_pass`.
- The `shade_steps` parameter controls how "cartoony" the look is. 2 = very flat, 5+ = more gradual.
- Works well on stylized props or UI preview models.
