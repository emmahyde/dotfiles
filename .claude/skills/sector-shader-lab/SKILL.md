---
name: sector-shader-lab
description: |
  Iterative shader development for Sector's MonoGame rendering pipeline with
  visual feedback loops via sector-mcp tools. Edit .fx shader code, hot-reload
  without restarting, see results via screenshots, analyze, and refine.
  Triggers on: shader, visual effect, cel shading, bloom, CRT effect,
  vignette, engine glow, ship parallax, edit shader, shader not working,
  HLSL, .fx file, effect parameter, tweak shader, shader uniform
---

# Sector Shader Lab

Develop and iterate on MonoGame .fx shaders with a visual feedback loop. Every edit is verified via screenshot.

## Prerequisites
- Game running in Debug mode (`dotnet run --project Sector`)
- `sector` MCP server connected
- Shader source files in `Sector/Content/Effects/*.fx`

## Known Shaders

| Effect | File | Purpose |
|--------|------|---------|
| `CelShadeEffect` | `CelShadeEffect.fx` | Cel-shaded 3D objects (asteroids, stations, ships) |
| `BloomEffect` | `BloomEffect.fx` | Post-process bloom |
| `CRTEffect` | `CRTEffect.fx` | CRT scanlines + curvature |
| `VignetteEffect` | `VignetteEffect.fx` | Screen-edge darkening |
| `EngineGlowEffect` | `EngineGlowEffect.fx` | Ship engine flare |
| `ShipParallaxEffect` | `ShipParallaxEffect.fx` | Ship layered parallax |

## Workflow

### Step 1: Understand Current State

1. `sector_screenshot` — capture what it looks like now
2. Read the .fx source: `Read Sector/Content/Effects/<ShaderName>.fx`
3. `sector_eval` to check current parameter values:
   ```csharp
   // List all parameters on an effect
   var effect = /* navigate to the effect */;
   return effect.Parameters.Select(p => new { p.Name, Value = p.GetValueSingle() });
   ```

### Step 2: Edit → Reload → Verify Loop

```
LOOP:
  1. Edit the .fx shader file (Edit tool)
  2. sector_shader_reload with name: "ShaderName"
     - Returns compile time and success/failure
     - On compile error: read the error, fix the HLSL, retry
  3. sector_screenshot — see the result
  4. Analyze: does it match intent?
     - Too strong/weak: sector_eval to tweak parameters
     - Wrong color: adjust in shader code
     - No visible change: check if shader is actually applied (Branch B of runtime-debug)
  5. If not right: GOTO 1
  6. If satisfied: DONE
```

### Step 3: Live Parameter Tweaking

Use `sector_eval` to adjust uniforms at 60fps without recompiling:

```csharp
// Tweak a float parameter
someEffect.Parameters["RimStrength"].SetValue(0.4f);
return true;
```

```csharp
// Tweak a color parameter
someEffect.Parameters["AmbientColor"].SetValue(new Vector3(0.1f, 0.05f, 0.02f));
return true;
```

Take a `sector_screenshot` after each tweak to see the effect. When you find values you like, update the C# code that sets the defaults.

## MonoGame HLSL Quick Reference

MonoGame uses HLSL (not GLSL). Compiled via mgfxc to .xnb content.

```hlsl
// Minimal vertex/pixel shader
float4x4 WorldViewProjection;

struct VertexInput {
    float4 Position : POSITION0;
    float3 Normal : NORMAL0;
    float4 Color : COLOR0;
};

struct PixelInput {
    float4 Position : SV_POSITION;
    float3 Normal : TEXCOORD0;
    float4 Color : COLOR0;
};

PixelInput VS(VertexInput input) {
    PixelInput output;
    output.Position = mul(input.Position, WorldViewProjection);
    output.Normal = input.Normal;
    output.Color = input.Color;
    return output;
}

float4 PS(PixelInput input) : SV_TARGET {
    return input.Color;
}

technique Default {
    pass P0 {
        VertexShader = compile vs_3_0 VS();
        PixelShader = compile ps_3_0 PS();
    }
};
```

## Sector Shader Conventions

- Vertex type: `VertexPositionNormalColor` (normals + optional vertex color)
- Vertex alpha=0 → use palette uniforms; alpha>0 → use vertex RGB with cel-band brightness
- Object-space lighting: transform `LightDir` into object space, don't transform normals in shader
- Cel shading uses discrete brightness bands (typically 3-4 bands)
- Post-process effects operate on the full-frame `RenderTarget2D` at DrawOrder 70

## Troubleshooting

**Shader doesn't reload:**
- Check `sector_shader_reload` response for compile errors
- mgfxc requires Wine on macOS — ensure `tools/compile-shaders.sh` works standalone
- Verify the .xnb output path matches what the game loads from

**No visible change after reload:**
- The shader swap mechanism uses `CompiledXnbPaths` — the game code must check and load new XNBs
- Some effects cache the `Effect` object — may need a restart for first-time integration

**Effect too subtle in screenshots:**
- Post-process bloom/CRT may mask subtle shader changes
- Try `sector_eval` to temporarily disable post-processing for clearer comparison
