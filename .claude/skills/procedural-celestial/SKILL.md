---
name: procedural-celestial
description: >
  Generate procedural night skies, starfields, nebulae, galaxies, and celestial
  phenomena in Unity 6 / URP 17. Covers spectral-class star colors from blackbody
  temperature, magnitude-based brightness, starfield generation via Mesh API or
  GPU instancing, nebulae as billboard sprites or compute-driven volumes, Milky Way
  band, constellations, meteors, comets, eclipses, and a sky controller. All
  techniques fit a flat-shaded, vertex-color, no-texture aesthetic — volumetric
  paths are optional upgrades, never prerequisites.
  Triggers: "procedural starfield", "night sky", "star rendering", "nebula",
  "deep space", "milky way", "constellation", "shooting star", "meteor shower",
  "celestial", "space background", "galaxy background", "moon phases", "comet",
  "eclipse", "space scene", "star shader", "skybox stars".
---

# Procedural Celestial Phenomena — Unity 6 / URP

Generate night skies in Unity 6 with URP. Every layer has a vertex-color / billboard path that needs no textures and a volumetric upgrade path for when the aesthetic allows it. The skill assumes C# 9 (Unity's compiler ceiling), `Mesh.AllocateWritableMeshData` for allocation-free generation, and URP custom shaders written in HLSL (not ShaderGraph).

## Sector context

The repo at `~/projects/sector-unity-proto` already ships:

| What | Where | Technique |
|---|---|---|
| Orrery starfield | `Presentation/Orrery/OrreryStarfield.cs` | 2200 CPU-projected quads, additive, ZTest Always |
| Play-space sky glows | `Presentation/PlaySpace/PlaySpaceSky.cs` | Radial-falloff triangle fans on the backdrop camera |
| Nebulae | `Presentation/PlaySpace/NebulaBackdrop.cs` | 3 filamentary sprites, physics-colored palette, `NebulaAdditive` shader |
| Mid-field stars | `Proto/Space/MidFieldStars.cs` | 600 particles, per-star depth drives parallax rate |
| Near dust | `Proto/Space/NearDust.cs` | 72 glitter particles, ambient wander |
| Cel post-process | `Presentation/AmberCRT.shader` | Single `_Intensity` amber grade |

New celestial work should layer on top of or replace these, not duplicate them.

## Architecture

```
 kind    ┌ step ┐   ┏ actor ┓   ( event )
 reads   symbol_name()  verbatim from source

 ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
 ┃                CelestialController                 ┃
 ┃  * master orchestrator, one per scene              ┃
 ┃  * drives time, moon phase, all layers             ┃
 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
        │
        ├── ┌ Sky Gradient ──────────────────────────┐
        │   │ BackSide sphere, multi-stop HLSL frag  │
        │   └────────────────────────────────────────┘
        │
        ├── ┌ Starfield ─────────────────────────────┐
        │   │ Mesh of camera-facing quads            │
        │   │ spectral color + magnitude in COLOR    │
        │   │ twinkle in vertex shader               │
        │   └────────────────────────────────────────┘
        │
        ├── ┌ Milky Way ─────────────────────────────┐
        │   │ BackSide sphere, FBM band + dust lanes │
        │   └────────────────────────────────────────┘
        │
        ├── ┌ Nebulae ───────────────────────────────┐
        │   │ Billboard quads, additive, per-vertex  │
        │   │ color from emission-line physics       │
        │   └────────────────────────────────────────┘
        │
        ├── ┌ Celestial Bodies ──────────────────────┐
        │   │ Moon: sphere + glow quad, phase lit    │
        │   └────────────────────────────────────────┘
        │
        └── ┌ Transients ───────────────────────────┐
            │ Meteors, comets: line renderer / quad  │
            └────────────────────────────────────────┘
```

## Three.js → Unity translation table

Read this before porting any Three.js celestial code.

| Three.js | Unity 6 / URP | Notes |
|---|---|---|
| `THREE.ShaderMaterial` | `new Material(Shader.Find("..."))` | URP shaders are HLSL, not GLSL |
| `uniform vec3 color` | `float3 _Color` in HLSLPROGRAM, set via `material.SetColor` | Prefix with `_`, declare in `Properties {}` |
| `attribute vec4 aStarData` | Per-vertex `TEXCOORD1` or `COLOR` semantic | Or use `StructuredBuffer` with `DrawMeshInstancedIndirect` |
| `varying vec3 vWorldDir` | `struct Varyings { float3 worldDir : TEXCOORD0; }` | Interpolators are struct members |
| `gl_Position` | `OUT.positionCS = TransformObjectToHClip(IN.positionOS)` | Use URP macros from `Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl` |
| `gl_FragColor` | `return half4(col, alpha);` in the fragment function | URP uses `half4` return |
| `gl_PointSize` | No equivalent — Unity has no GL_POINTS | Build camera-facing quads (4 verts per star) or use `DrawMeshInstancedIndirect` with a quad mesh |
| `THREE.Points` | `Mesh` of quads, or `ParticleSystem`, or `Graphics.DrawMeshInstancedIndirect` | See Starfield section |
| `THREE.AdditiveBlending` | `Blend One One` in shader | Plus `ZWrite Off`, `ZTest Always` for sky |
| `THREE.BackSide` | `Cull Front` in shader | Renders inside of sphere |
| `modelViewMatrix` | `UNITY_MATRIX_MV` | Or compose from `unity_ObjectToWorld` + `UNITY_MATRIX_V` |
| `projectionMatrix` | `UNITY_MATRIX_P` | |
| `new THREE.BufferGeometry()` | `new Mesh()` or `Mesh.AllocateWritableMeshData(1)` | Writable mesh data is allocation-free |
| Y-up right-handed | Y-up left-handed | Negate Z when porting positions. Cross products flip. |
| `Math.sin/cos` in JS | `Mathf.Sin/Cos` or `math.sin/cos` (Burst) | |
| Compute shader (WGSL) | Compute shader (HLSL `.compute` file) | `RWStructuredBuffer<Star>`, dispatch with `ComputeShader.Dispatch` |
| `performance.now() * 0.001` | `Time.time` | |
| `devicePixelRatio` | `Screen.dpi / 96f` (approximate) | Usually irrelevant — Unity handles scaling |
| Canvas 2D for baked sprites | `Texture2D` + `SetPixels` / `Apply()` | Or generate in compute shader |
| `dispose()` | `Destroy(gameObject)` + `mesh.Clear()` / `Object.Destroy(material)` | Watch for leaked materials |

### Coordinate system

Three.js is Y-up right-handed. Unity is Y-up left-handed. When porting:

- Negate the Z component of every position and direction.
- `atan2(dir.x, dir.z)` in Three.js → `atan2(dir.x, -dir.z)` in Unity (or keep Z and swap the cross-product order).
- Camera "forward" is +Z in Unity, −Z in Three.js.
- UV winding: Three.js CCW front face → Unity also CCW front face, but the Z flip means a ported model's winding reverses. Use `Cull Off` during debugging.

### The gl_PointSize problem

Three.js renders stars as `Points` — one vertex per star, sized by `gl_PointSize` in the vertex shader. Unity has no equivalent. Three paths:

1. **Camera-facing quads** (what `OrreryStarfield.cs` does): 4 vertices per star, billboard transform in C# or vertex shader. One draw call via a single `Mesh`. Best for < 10K stars.
2. **`Graphics.DrawMeshInstancedIndirect`**: one quad mesh instanced N times, per-instance data in a `ComputeBuffer`. Best for 10K–100K+ stars. One draw call.
3. **`ParticleSystem`** (what `MidFieldStars.cs` does): set `maxParticles`, write positions via `SetParticles`. Unity handles billboarding. Easiest but least control over the shader.

### Porting gotchas from research

These come from `.claude/research/threejs-to-unity-urp-20260825/corpus-summary.md` — spot-checked against fetched pages.

- **SRP Batcher compatibility is opt-in by convention.** Every material property must live in one `CBUFFER_START(UnityPerMaterial) ... CBUFFER_END` block, shared across all passes. Skipping this silently disables batching — not a compile error, a performance cliff.
- **`fixed4` does not exist in URP.** Built-in's `fixed` precision → `half4` in URP HLSL.
- **Attribute order is fixed in `AllocateWritableMeshData`.** Position, normal, tangent, color, then UV sets 0–7. Three.js `BufferAttribute` has no ordering constraint. Reorder on port or get silent corruption.
- **`DrawMeshInstancedIndirect` does not per-instance cull.** The `bounds` arg culls the entire batch as one box. For a starfield this is fine (one bounding volume), but foreground instanced geometry needs hand-rolled culling.
- **No compute-to-render binding enforcement.** In Three.js TSL the compute and render passes are wired by the node graph. In Unity you manually `SetBuffer` the same `ComputeBuffer` on both the `ComputeShader` and the `Material` — nothing checks this, so buffer-not-bound bugs produce stale/garbage data with no compile error.
- **Billboard orientation is not handled by DMII.** Reconstruct the quad from camera right/up vectors in the vertex shader. The fragment shader can then `smoothstep(length(uv - 0.5))` for a soft disc — no texture needed, and this is the practical answer to the `gl_PointSize` gap.
- **`DrawMeshInstanced` (non-indirect) caps at 1023 per batch.** Use `DrawMeshInstancedIndirect` for starfields.

## Layer 1: Sky Gradient

A `BackSide` sphere with a multi-stop gradient. In Sector, this is the job of `PlaySpaceSky.cs` and `SectorDebugDraw`'s backdrop camera.

```csharp
public static Mesh BuildSkySphere(int segments = 32, int rings = 16, float radius = 500f)
{
    // Standard UV sphere, but normals point inward (Cull Front in shader).
    var data = Mesh.AllocateWritableMeshData(1);
    // ... fill positions, normals, UVs, indices ...
    var mesh = new Mesh { name = "SkySphere" };
    Mesh.ApplyAndDisposeWritableMeshData(data, mesh);
    mesh.RecalculateBounds();
    return mesh;
}
```

Shader: see `references/celestial-shaders-unity.md § Sky Dome`.

Key uniforms: `_ZenithColor`, `_HorizonColor`, `_HorizonGlow`, `_GlowStrength`, `_LightPollution`, `_MoonDir`, `_MoonGlowStr`.

## Layer 2: Starfield

Each star needs: a position on the unit sphere, a spectral color from its temperature, and a magnitude that drives brightness and screen size.

### Blackbody temperature → RGB

The Tanner Helland approximation. Input: Kelvin. Output: linear RGB.

```csharp
public static Color BlackbodyColor(float tempK)
{
    float t = tempK / 100f;
    float r, g, b;
    if (t <= 66f)
    {
        r = 1f;
        g = Mathf.Clamp01((99.4708f * Mathf.Log(t) - 161.1196f) / 255f);
        b = t <= 19f ? 0f : Mathf.Clamp01((138.5177f * Mathf.Log(t - 10f) - 305.0448f) / 255f);
    }
    else
    {
        r = Mathf.Clamp01(329.6987f * Mathf.Pow(t - 60f, -0.1332f) / 255f);
        g = Mathf.Clamp01(288.1222f * Mathf.Pow(t - 60f, -0.0755f) / 255f);
        b = 1f;
    }
    return new Color(r, g, b, 1f);
}
```

### Spectral class distribution

Stars are not uniformly distributed across temperatures. Weight generation toward cooler classes to match the real galactic census:

| Class | Temp (K) | Color | Fraction | CDF threshold |
|---|---|---|---|---|
| O | 30,000+ | Blue-violet | 0.003% | r < 0.00003 |
| B | 10,000–30,000 | Blue-white | 0.1% | r < 0.001 |
| A | 7,500–10,000 | White | 0.6% | r < 0.007 |
| F | 6,000–7,500 | Yellow-white | 3% | r < 0.037 |
| G | 5,200–6,000 | Yellow | 8% | r < 0.117 |
| K | 3,700–5,200 | Orange | 12% | r < 0.237 |
| M | 2,400–3,700 | Red-orange | 76% | r < 1.0 |

Source: fractions are approximate galactic main-sequence census values. M dwarfs dominate by count; O/B stars are visually prominent but rare.

```csharp
public static float RandomStarTemp(ref System.Random rng)
{
    float r = (float)rng.NextDouble();
    if (r < 0.00003f) return 30000f + r * 5e6f;
    if (r < 0.001f)   return 10000f + r * 1e6f;
    if (r < 0.007f)   return 7500f + r * 60000f;
    if (r < 0.037f)   return 6000f + r * 15000f;
    if (r < 0.117f)   return 5200f + r * 5000f;
    if (r < 0.237f)   return 3700f + r * 3000f;
    return 2400f + r * 2600f;
}
```

### Magnitude → brightness and size

Each magnitude step is a factor of ~2.512 in brightness (Pogson's ratio). Magnitude −1.5 (Sirius) is bright; magnitude 6.5 is the naked-eye limit.

```csharp
float brightness = Mathf.Pow(2.512f, -magnitude) * exposure;
float sizePx = baseSizePx * Mathf.Sqrt(brightness);
sizePx = Mathf.Clamp(sizePx, 0.5f, 8f);
```

### Building the starfield mesh (camera-facing quads)

```csharp
public static Mesh BuildStarfield(int count, float radius, int seed)
{
    var rng = new System.Random(seed);
    int vertCount = count * 4;
    int triCount = count * 6;

    var data = Mesh.AllocateWritableMeshData(1);
    var meshData = data[0];
    meshData.SetVertexBufferParams(vertCount,
        new VertexAttributeDescriptor(VertexAttribute.Position, VertexAttributeFormat.Float32, 3),
        new VertexAttributeDescriptor(VertexAttribute.Color, VertexAttributeFormat.UNorm8, 4),
        new VertexAttributeDescriptor(VertexAttribute.TexCoord0, VertexAttributeFormat.Float32, 4));
        // TEXCOORD0.xy = quad corner (-1,-1 to 1,1), .z = magnitude, .w = twinkle seed

    var positions = meshData.GetVertexData<Vector3>(0);
    // ... or use a single interleaved struct via NativeArray ...

    for (int i = 0; i < count; i++)
    {
        // Uniform sphere: cos(acos(2r-1)) avoids polar clustering
        float theta = (float)(rng.NextDouble() * Mathf.PI * 2f);
        float phi = Mathf.Acos(2f * (float)rng.NextDouble() - 1f);
        Vector3 dir = new Vector3(
            Mathf.Sin(phi) * Mathf.Cos(theta),
            Mathf.Cos(phi),
            Mathf.Sin(phi) * Mathf.Sin(theta));
        Vector3 pos = dir * radius;

        float mag = -1.5f + Mathf.Pow((float)rng.NextDouble(), 0.4f) * 8f;
        float temp = RandomStarTemp(ref rng);
        Color32 col = BlackbodyColor(temp);
        float twinkle = (float)rng.NextDouble();

        // 4 vertices per star — billboarding happens in the vertex shader
        int vi = i * 4;
        for (int v = 0; v < 4; v++)
        {
            // All 4 share the same position; the vertex shader expands them
            // into a screen-aligned quad using the corner offset in TEXCOORD0.xy
            // positions[vi + v] = pos;
            // colors[vi + v] = col;
            // texcoords[vi + v] = new Vector4(corners[v].x, corners[v].y, mag, twinkle);
        }
    }

    meshData.SetIndexBufferParams(triCount, IndexFormat.UInt32);
    var indices = meshData.GetIndexData<int>();
    for (int i = 0; i < count; i++)
    {
        int vi = i * 4, ti = i * 6;
        indices[ti + 0] = vi; indices[ti + 1] = vi + 1; indices[ti + 2] = vi + 2;
        indices[ti + 3] = vi; indices[ti + 4] = vi + 2; indices[ti + 5] = vi + 3;
    }

    meshData.subMeshCount = 1;
    meshData.SetSubMesh(0, new SubMeshDescriptor(0, triCount));

    var mesh = new Mesh { name = "Starfield" };
    Mesh.ApplyAndDisposeWritableMeshData(data, mesh);
    mesh.RecalculateBounds();
    return mesh;
}
```

Vertex shader expands each quad: see `references/celestial-shaders-unity.md § Star`.

### GPU instancing path (10K+ stars)

```csharp
struct StarData { public Vector3 position; public Color color; public float magnitude; public float twinkle; }

ComputeBuffer _starBuffer;
MaterialPropertyBlock _props;

void BuildInstanced(int count)
{
    var stars = new StarData[count];
    // ... fill as above ...
    _starBuffer = new ComputeBuffer(count, System.Runtime.InteropServices.Marshal.SizeOf<StarData>());
    _starBuffer.SetData(stars);

    _props = new MaterialPropertyBlock();
    _props.SetBuffer("_Stars", _starBuffer);
}

void Update()
{
    _material.SetFloat("_Time", Time.time);
    Graphics.DrawMeshInstancedIndirect(_quadMesh, 0, _material, _bounds, _argsBuffer, 0, _props);
}
```

## Layer 3: Milky Way

A second `BackSide` sphere, larger radius, additive blend. The fragment shader computes an FBM band with dust-lane subtraction and Sagittarius-core brightening.

Key parameters:
- `_BandWidth` (0.18): angular half-width of the galactic band
- `_BandTilt` (0.4 rad): inclination of the galactic plane
- `_CoreGlow` (0.6): brightness boost near galactic center
- `_DustLanes` (0.4): dark-lane subtraction strength
- `_WarmTint` / `_CoolTint`: core and edge hue

Shader: see `references/celestial-shaders-unity.md § Milky Way`.

## Layer 4: Nebulae

### Billboard path (flat-shaded fit)

Each nebula is a camera-facing quad with per-vertex color. No texture — the color comes from emission-line physics:

| Line | Color | Wavelength | Use |
|---|---|---|---|
| H-alpha | Red-pink | 656.3 nm | Dominant in star-forming regions |
| O-III | Teal-green | 500.7 nm | Planetary nebulae, hot gas |
| S-II | Deep red-orange | 671.6 nm | Shock fronts, supernova remnants |
| He-II | Violet | 468.6 nm | Very hot central stars |

For the flat-shaded path, build a triangle fan with center at full emission color and rim vertices at transparent — the same technique `PlaySpaceSky.cs` already uses. Each nebula gets a random angular extent, a position on the sky sphere, and 1–3 emission-line colors blended by vertex.

### Volumetric path (compute + raymarch)

When the aesthetic allows textures or screen-space effects: a compute shader fills a 3D noise field (FBM, 5 octaves) into a `RenderTexture` with `dimension = Tex3D`, and a full-screen or box-geometry fragment shader raymarches through it with absorption. See `references/celestial-shaders-unity.md § Volumetric Nebula`.

## Layer 5: Celestial Bodies

### Moon

A sphere with Voronoi craters in the fragment shader, lit by a `_SunDir` uniform that encodes the phase angle. Glow sprite behind it (additive quad).

```csharp
public static void SetMoonPhase(Material moonMat, float phase)
{
    float phaseAngle = phase * Mathf.PI * 2f;
    Vector3 sunDir = new Vector3(Mathf.Sin(phaseAngle), 0.1f, -Mathf.Cos(phaseAngle)).normalized;
    moonMat.SetVector("_SunDir", sunDir);
}
```

Earthshine: faint illumination on the dark side. `max(-NdotL, 0) * 0.03` tinted toward blue-grey.

## Layer 6: Transients

### Meteors

A bright line that flares then fades over 0.4–1.6 seconds. Use Unity's `LineRenderer` with 2 points and an `AnimationCurve` on width and alpha, or build a thin quad mesh. One active at a time is enough; spawn probabilistically.

```csharp
void TrySpawnMeteor(float dt, float rate)
{
    _timer += dt;
    if (_timer < 1f / rate) return;
    _timer = 0f;
    if (Random.value > 0.7f) return;

    // Upper hemisphere start, roughly-downward direction
    Vector3 start = Random.onUnitSphere;
    if (start.y < 0f) start.y = -start.y;
    start *= _skyRadius;

    Vector3 dir = new Vector3(
        Random.Range(-0.5f, 0.5f),
        -0.7f - Random.value * 0.3f,
        Random.Range(-0.5f, 0.5f)).normalized;

    float length = Random.Range(15f, 45f);
    // ... set LineRenderer positions, start fade coroutine ...
}
```

### Comets

Nucleus (small sphere or billboard) + two tails:

- **Ion tail**: straight, anti-sunward, blue-white. `LineRenderer` with ~50 points.
- **Dust tail**: curved, trailing the orbit, warm yellow. `LineRenderer` with ~40 points, each offset by `sin(t * 2) * 10 * t` laterally.

Both additive, `ZWrite Off`.

## Sky Controller

```csharp
public class CelestialController : MonoBehaviour
{
    [SerializeField] float _nightProgress = 0.5f; // 0=sunset, 0.5=midnight, 1=sunrise
    [SerializeField] float _moonPhase = 0f;        // 0=new, 0.5=full
    [SerializeField] int _starCount = 8000;
    [SerializeField] float _meteorRate = 0.1f;

    // References to each layer — self-assembling or wired in inspector.
    // Update drives time into every layer's material.
}
```

## Presets

| Name | Stars | Light pollution | Milky Way | Meteors | Moon | Character |
|---|---|---|---|---|---|---|
| pristine mountain | 12000 | 0.0 | 0.35 | 0.12/s | new | Maximum stars, vivid band |
| full moon | 4000 | 0.05 | 0.08 | 0.05/s | full | Moon washes out faint stars |
| suburban | 2000 | 0.4 | 0.02 | 0.08/s | quarter | Warm horizon glow |
| meteor shower | 10000 | 0.0 | 0.30 | 0.8/s | new | Constant streaks |
| deep space | 20000 | 0.0 | 0.50 | 0.02/s | new | Dense stars, vivid nebulae |

## Performance

| Layer | Draw calls | Cost | Notes |
|---|---|---|---|
| Sky gradient | 1 | Negligible | BackSide sphere, simple frag |
| Starfield (quad mesh) | 1 | Low | 8K quads = 32K verts, all twinkle in vert shader |
| Starfield (instanced) | 1 | Low | `DrawMeshInstancedIndirect`, one quad |
| Milky Way | 1 | Low | FBM in frag, BackSide sphere |
| Nebula (billboard) | 1 per nebula | Negligible | Triangle fan or sprite |
| Nebula (volumetric) | 1 | High | Limit to 48 raymarch steps |
| Moon + glow | 2 | Low | Sphere + quad |
| Meteor | 1 | Negligible | `LineRenderer` or thin quad |

Total: 5–8 draw calls. All layers use additive blending → no transparency sort.

## Common pitfalls

1. **Stars visible through the Moon.** Set `renderQueue` explicitly per layer. Sky dome < stars < Milky Way < nebulae < moon.
2. **Stars cluster at poles.** Use `Acos(2r - 1)` for the polar angle, not linear `r * PI`. Linear samples compress near the poles.
3. **All stars the same color.** Must use the blackbody function. Even subtle warm/cool variation (orange M vs blue-white B) is what makes it read as a sky instead of noise.
4. **Milky Way is a uniform bright band.** Dust-lane subtraction and core brightening are what give it structure. Without them it reads as a stripe.
5. **No depth cue.** Layer elements at slightly different radii so camera rotation produces parallax. Nebulae at 450, stars at 400, dome at 500.
6. **URP overlay camera ignores `clearFlags = SolidColor`.** A solid-color clear test proves nothing about whether an overlay is compositing. Test with actual geometry.
7. **`HashCode.Combine` breaks determinism.** Its mixing seed is randomized per process. Use `unchecked(seed * 31 + i)` for star seeds.
8. **Shader uses `UNITY_MATRIX_MVP` directly.** In URP, use `TransformObjectToHClip(positionOS)` from `Core.hlsl` — it handles stereo rendering and SRP batching.

## References

- `references/celestial-shaders-unity.md` — Complete HLSL vertex/fragment shaders for URP: sky dome, star billboard, Milky Way FBM, volumetric nebula, moon surface.
- `references/celestial-catalog.md` — Nebula type profiles with emission-line physics, deep-sky presets, constellation data format, eclipse configs, sky mood profiles.
- Sources: vendian.org blackbody table, arXiv 2101.06254 (CIE/PHOENIX star colors), beltoforion.de density-wave galaxy math, Tanner Helland blackbody approximation.
