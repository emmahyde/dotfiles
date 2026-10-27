# Celestial Shaders — Unity 6 / URP HLSL

URP code shaders for the celestial pipeline. Every shader uses the ShaderLab wrapper with `RenderPipeline = UniversalPipeline`, `HLSLPROGRAM`/`ENDHLSL`, and `CBUFFER_START(UnityPerMaterial)` for SRP Batcher compatibility.

## Sky Dome

Multi-stop gradient with horizon glow and moon ambient. Renders inside a large sphere (`Cull Front`).

```hlsl
Shader "Celestial/SkyDome"
{
    Properties
    {
        _ZenithColor   ("Zenith",  Color) = (0.008, 0.0, 0.063, 1)
        _MidColor      ("Mid",     Color) = (0.039, 0.039, 0.165, 1)
        _HorizonColor  ("Horizon", Color) = (0.082, 0.063, 0.165, 1)
        _HorizonGlow   ("Glow",    Color) = (0.102, 0.082, 0.188, 1)
        _GlowStrength  ("Glow Strength", Float) = 0.3
        _LightPollution("Light Pollution", Range(0,1)) = 0.0
        _MoonDir       ("Moon Dir", Vector) = (0, 0.5, -1, 0)
        _MoonGlowStr   ("Moon Glow", Float) = 0.15
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Background" }
        Pass
        {
            Cull Front
            ZWrite Off
            ZTest LEqual

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half3 _ZenithColor;
                half3 _MidColor;
                half3 _HorizonColor;
                half3 _HorizonGlow;
                half  _GlowStrength;
                half  _LightPollution;
                half3 _MoonDir;
                half  _MoonGlowStr;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 worldDir   : TEXCOORD0;
            };

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                float3 worldPos = TransformObjectToWorld(IN.positionOS.xyz);
                OUT.worldDir = normalize(worldPos);
                OUT.positionCS = TransformObjectToHClip(IN.positionOS.xyz);
                return OUT;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                half3 dir = normalize(IN.worldDir);
                half elev = dir.y;

                half3 sky;
                if (elev > 0.3)
                    sky = lerp(_MidColor, _ZenithColor, (elev - 0.3) / 0.7);
                else if (elev > 0.0)
                    sky = lerp(_HorizonColor, _MidColor, elev / 0.3);
                else
                    sky = lerp(_HorizonGlow, _HorizonColor, elev + 1.0);

                half horizBand = exp(-abs(elev) * 8.0) * _GlowStrength;
                sky += _HorizonGlow * horizBand;

                half pollution = exp(-abs(elev) * 4.0) * _LightPollution;
                sky += half3(0.15, 0.1, 0.05) * pollution;

                half3 moonDir = normalize(_MoonDir);
                half moonAngle = max(dot(dir, moonDir), 0.0);
                half moonHalo = pow(moonAngle, 16.0) * _MoonGlowStr;
                half moonWide = pow(moonAngle, 3.0) * _MoonGlowStr * 0.15;
                sky += half3(0.6, 0.65, 0.8) * (moonHalo + moonWide);

                half zodiacal = exp(-abs(elev) * 6.0) * 0.02 * (1.0 - _LightPollution);
                sky += half3(0.12, 0.1, 0.08) * zodiacal;

                return half4(sky, 1.0);
            }
            ENDHLSL
        }
    }
}
```

## Star Billboard

Vertex shader expands a camera-facing quad per star. Fragment shader renders a soft glow disc with optional diffraction spikes on bright stars.

Per-star data is packed into vertex attributes:
- `POSITION`: shared center position (all 4 verts of a quad share the same world pos)
- `COLOR`: spectral color from blackbody temperature
- `TEXCOORD0.xy`: quad corner offset (-1,-1 to 1,1)
- `TEXCOORD0.z`: magnitude
- `TEXCOORD0.w`: twinkle seed

```hlsl
Shader "Celestial/StarBillboard"
{
    Properties
    {
        _BaseSizePx   ("Base Size (px)", Float) = 2.5
        _GlowFalloff  ("Glow Falloff", Float) = 0.4
        _Exposure     ("Exposure", Float) = 1.0
        _TwinkleSpeed ("Twinkle Speed", Float) = 1.0
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Background+1" }
        Pass
        {
            Blend One One
            ZWrite Off
            ZTest Always
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half  _BaseSizePx;
                half  _GlowFalloff;
                half  _Exposure;
                half  _TwinkleSpeed;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                half4  color      : COLOR;
                float4 uv0        : TEXCOORD0; // xy=corner, z=magnitude, w=twinkle seed
            };

            struct Varyings
            {
                float4 positionCS  : SV_POSITION;
                half3  starColor   : COLOR0;
                half   brightness  : COLOR1;
                float2 quadUV      : TEXCOORD0;
            };

            half hash(float2 p)
            {
                return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
            }

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                half magnitude = IN.uv0.z;
                half brightness = pow(2.512, -magnitude) * _Exposure;
                half sizePx = _BaseSizePx * sqrt(brightness);
                sizePx = clamp(sizePx, 0.5, 8.0);

                // Multi-frequency twinkle
                half twinklePhase = IN.uv0.w * 6.283;
                half t = _Time.y * _TwinkleSpeed;
                half twinkle = 1.0
                    + sin(t * 2.3 + twinklePhase) * 0.15
                    + sin(t * 5.7 + twinklePhase * 2.0) * 0.08
                    + sin(t * 11.0 + twinklePhase * 3.0) * 0.04;
                half twinkleAmt = lerp(1.0, twinkle, saturate(1.0 - brightness * 0.5));

                // Billboard: expand quad in screen space
                float4 clipPos = TransformObjectToHClip(IN.positionOS.xyz);
                float2 cornerPx = IN.uv0.xy * sizePx * twinkleAmt;
                // Convert pixel offset to clip-space offset
                float2 screenSize = _ScreenParams.xy;
                clipPos.xy += cornerPx * clipPos.w * 2.0 / screenSize;

                OUT.positionCS = clipPos;
                OUT.starColor = IN.color.rgb;
                OUT.brightness = brightness * twinkleAmt;
                OUT.quadUV = IN.uv0.xy * 0.5 + 0.5; // remap -1..1 to 0..1
                return OUT;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                float2 center = IN.quadUV - 0.5;
                half dist = length(center);

                half core = smoothstep(0.5, 0.05, dist);
                half glow = exp(-dist * dist / (_GlowFalloff * _GlowFalloff)) * 0.6;
                half alpha = core + glow;

                // Diffraction spikes on bright stars only
                half spike = 0.0;
                if (IN.brightness > 0.5)
                {
                    half angle = atan2(center.y, center.x);
                    spike = pow(abs(cos(angle * 2.0)), 32.0) * (1.0 - dist * 3.0);
                    spike = max(spike, 0.0) * (IN.brightness - 0.5) * 0.3;
                }

                half3 col = IN.starColor * IN.brightness;
                return half4(col, 1.0) * (alpha + spike) * IN.brightness;
            }
            ENDHLSL
        }
    }
}
```

## Milky Way

Procedural galactic band on a BackSide sphere. FBM structure with dust lanes and Sagittarius core brightening. Additive blend, layered behind stars.

```hlsl
Shader "Celestial/MilkyWay"
{
    Properties
    {
        _Brightness ("Brightness", Float) = 0.25
        _BandWidth  ("Band Width", Float) = 0.18
        _BandTilt   ("Band Tilt (rad)", Float) = 0.4
        _CoreGlow   ("Core Glow", Float) = 0.6
        _DustLanes  ("Dust Lanes", Float) = 0.4
        _WarmTint   ("Warm Tint", Color) = (1, 0.91, 0.8, 1)
        _CoolTint   ("Cool Tint", Color) = (0.8, 0.87, 1, 1)
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Background+2" }
        Pass
        {
            Cull Front
            Blend One One
            ZWrite Off
            ZTest Always

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half  _Brightness;
                half  _BandWidth;
                half  _BandTilt;
                half  _CoreGlow;
                half  _DustLanes;
                half3 _WarmTint;
                half3 _CoolTint;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings  { float4 positionCS : SV_POSITION; float3 worldDir : TEXCOORD0; };

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                OUT.worldDir = normalize(TransformObjectToWorld(IN.positionOS.xyz));
                OUT.positionCS = TransformObjectToHClip(IN.positionOS.xyz);
                return OUT;
            }

            half hash21(float2 p) { return frac(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

            half noise2D(float2 p)
            {
                float2 i = floor(p);
                float2 f = frac(p);
                f = f * f * (3.0 - 2.0 * f);
                return lerp(lerp(hash21(i), hash21(i + float2(1,0)), f.x),
                            lerp(hash21(i + float2(0,1)), hash21(i + float2(1,1)), f.x), f.y);
            }

            half fbm(float2 p, int oct)
            {
                half sum = 0.0, amp = 1.0, maxA = 0.0;
                for (int i = 0; i < 6; i++)
                {
                    if (i >= oct) break;
                    sum += noise2D(p) * amp;
                    maxA += amp;
                    amp *= 0.5;
                    p *= 2.1;
                }
                return sum / maxA;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                half3 dir = normalize(IN.worldDir);

                half galLat = dir.y * cos(_BandTilt) - dir.z * sin(_BandTilt);
                half galLon = atan2(dir.x, dir.z * cos(_BandTilt) + dir.y * sin(_BandTilt));

                half band = exp(-galLat * galLat / (_BandWidth * _BandWidth));

                float2 uv = float2(galLon * 2.0, galLat * 8.0);
                half structure = fbm(uv * 3.0, 5) * 0.7 + 0.3;

                half dust = fbm(uv * 4.0 + 1.7, 4);
                dust = smoothstep(0.35, 0.55, dust) * _DustLanes;

                half core = exp(-galLon * galLon * 2.0) * _CoreGlow;

                half mw = band * structure * (1.0 - dust) + core * band;
                mw *= _Brightness;

                half3 col = lerp(_CoolTint, _WarmTint, core * 2.0 + 0.3) * mw;

                half starNoise = noise2D(uv * 80.0);
                starNoise = pow(starNoise, 8.0) * band * 0.3;
                col += starNoise;

                return half4(col, mw);
            }
            ENDHLSL
        }
    }
}
```

## Volumetric Nebula

Raymarched emission nebula inside a box volume. Multi-color layering with absorption. Use sparingly — 48 steps is the performance sweet spot.

```hlsl
Shader "Celestial/VolumetricNebula"
{
    Properties
    {
        _Color1      ("Color 1", Color) = (1, 0.133, 0.4, 1)
        _Color2      ("Color 2", Color) = (0.267, 0.4, 1, 1)
        _Color3      ("Color 3", Color) = (0.133, 1, 0.667, 1)
        _Density     ("Density", Float) = 0.5
        _Brightness  ("Brightness", Float) = 1.2
        _NebulaScale ("Scale", Float) = 80
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" }
        Pass
        {
            Blend One One
            ZWrite Off
            Cull Back

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            #define MAX_STEPS 48

            CBUFFER_START(UnityPerMaterial)
                half3 _Color1;
                half3 _Color2;
                half3 _Color3;
                half  _Density;
                half  _Brightness;
                half  _NebulaScale;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 worldPos   : TEXCOORD0;
            };

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                OUT.worldPos = TransformObjectToWorld(IN.positionOS.xyz);
                OUT.positionCS = TransformObjectToHClip(IN.positionOS.xyz);
                return OUT;
            }

            half3 hash3(float3 p)
            {
                p = float3(dot(p, float3(127.1,311.7,74.7)),
                           dot(p, float3(269.5,183.3,246.1)),
                           dot(p, float3(113.5,271.9,124.6)));
                return frac(sin(p) * 43758.5453);
            }

            half noise3D(float3 p)
            {
                float3 i = floor(p);
                float3 f = frac(p);
                f = f * f * (3.0 - 2.0 * f);
                half a = dot(hash3(i), f);
                half b = dot(hash3(i + float3(1,0,0)), f - float3(1,0,0));
                half c = dot(hash3(i + float3(0,1,0)), f - float3(0,1,0));
                half d = dot(hash3(i + float3(1,1,0)), f - float3(1,1,0));
                half e = dot(hash3(i + float3(0,0,1)), f - float3(0,0,1));
                half f1 = dot(hash3(i + float3(1,0,1)), f - float3(1,0,1));
                half g = dot(hash3(i + float3(0,1,1)), f - float3(0,1,1));
                half h = dot(hash3(i + float3(1,1,1)), f - float3(1,1,1));
                return lerp(lerp(lerp(a,b,f.x), lerp(c,d,f.x), f.y),
                            lerp(lerp(e,f1,f.x), lerp(g,h,f.x), f.y), f.z);
            }

            half fbm3(float3 p, int oct)
            {
                half s = 0.0, a = 1.0, m = 0.0;
                for (int i = 0; i < 6; i++)
                {
                    if (i >= oct) break;
                    s += noise3D(p) * a;
                    m += a;
                    a *= 0.5;
                    p *= 2.0;
                }
                return s / m;
            }

            float2 boxIntersect(float3 ro, float3 rd)
            {
                float3 inv = 1.0 / rd;
                float3 t1 = (-0.5 - ro) * inv;
                float3 t2 = (0.5 - ro) * inv;
                float3 tmin = min(t1, t2);
                float3 tmax = max(t1, t2);
                float near = max(max(tmin.x, tmin.y), tmin.z);
                float far = min(min(tmax.x, tmax.y), tmax.z);
                return float2(max(near, 0.0), far);
            }

            half4 frag(Varyings IN) : SV_Target
            {
                float3 camPos = _WorldSpaceCameraPos;
                float4x4 invModel = unity_WorldToObject;
                float3 ro = mul(invModel, float4(camPos, 1.0)).xyz;
                float3 rd = normalize(mul((float3x3)invModel, normalize(IN.worldPos - camPos)));

                float2 t = boxIntersect(ro, rd);
                if (t.x > t.y) discard;

                half4 result = half4(0,0,0,0);
                float step = (t.y - t.x) / (float)MAX_STEPS;
                float tt = t.x;

                for (int i = 0; i < MAX_STEPS; i++)
                {
                    if (result.a > 0.95) break;
                    float3 p = ro + rd * tt;

                    half d = fbm3(p * 3.0 + _Time.y * 0.01, 5);
                    d = smoothstep(0.3, 0.7, d) * _Density;

                    if (d > 0.001)
                    {
                        half r = length(p);
                        half colorNoise = fbm3(p * 2.0, 3);
                        half3 col = lerp(_Color1, _Color2, smoothstep(0.3, 0.6, colorNoise));
                        col = lerp(col, _Color3, smoothstep(0.55, 0.8, colorNoise));

                        half filament = pow(fbm3(p * 8.0, 4), 3.0);
                        col += filament * 0.4;

                        half centralGlow = exp(-r * r * 6.0) * 0.5;
                        col += _Color1 * centralGlow;
                        col *= _Brightness;

                        half alpha = 1.0 - exp(-d * step * 20.0);
                        result.rgb += col * alpha * (1.0 - result.a);
                        result.a += alpha * (1.0 - result.a);
                    }
                    tt += step;
                }
                return result;
            }
            ENDHLSL
        }
    }
}
```

## Moon Surface

Procedural Voronoi craters with phase-accurate lighting. Includes earthshine on the dark side.

```hlsl
Shader "Celestial/Moon"
{
    Properties
    {
        _SunDir       ("Sun Dir", Vector) = (0, 0.1, -1, 0)
        _MoonColor    ("Moon Color", Color) = (0.96, 0.94, 0.88, 1)
        _ShadowColor  ("Shadow Color", Color) = (0.067, 0.067, 0.082, 1)
        _CraterScale  ("Crater Scale", Float) = 3.0
        _CraterDepth  ("Crater Depth", Float) = 0.15
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Geometry+100" }
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                half3 _SunDir;
                half3 _MoonColor;
                half3 _ShadowColor;
                half  _CraterScale;
                half  _CraterDepth;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS   : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 normalWS   : TEXCOORD0;
                float3 positionOS : TEXCOORD1;
            };

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                OUT.positionCS = TransformObjectToHClip(IN.positionOS.xyz);
                OUT.normalWS = TransformObjectToWorldNormal(IN.normalOS);
                OUT.positionOS = IN.positionOS.xyz;
                return OUT;
            }

            half hash31(float3 p)
            {
                return frac(sin(dot(p, float3(127.1, 311.7, 74.7))) * 43758.5453);
            }

            half craters(float3 p)
            {
                float3 i = floor(p);
                float3 f = frac(p);
                half minDist = 1.0;
                for (int x = -1; x <= 1; x++)
                for (int y = -1; y <= 1; y++)
                for (int z = -1; z <= 1; z++)
                {
                    float3 nb = float3(x, y, z);
                    float3 pt = float3(hash31(i+nb), hash31((i+nb)*1.3), hash31((i+nb)*1.7));
                    half d = length(nb + pt - f);
                    minDist = min(minDist, d);
                }
                return smoothstep(0.0, 0.4, minDist);
            }

            half4 frag(Varyings IN) : SV_Target
            {
                half3 N = normalize(IN.normalWS);
                half3 L = normalize(_SunDir);

                half c1 = craters(IN.positionOS * _CraterScale);
                half c2 = craters(IN.positionOS * _CraterScale * 3.0) * 0.4;
                half surface = c1 + c2;

                half3 perturbedN = normalize(N + ddx(surface) * _CraterDepth * 10.0
                                               + ddy(surface) * _CraterDepth * 10.0);

                half NdotL = dot(perturbedN, L);
                half diffuse = max(NdotL, 0.0);
                half3 col = lerp(_ShadowColor, _MoonColor * surface, diffuse);

                half limbDark = pow(max(dot(N, normalize(-IN.positionOS)), 0.0), 0.3);
                col *= 0.7 + 0.3 * limbDark;

                half earthshine = max(-NdotL, 0.0) * 0.03;
                col += half3(0.3, 0.35, 0.5) * earthshine;

                return half4(col, 1.0);
            }
            ENDHLSL
        }
    }
}
```

## Compute: Star Catalog Generation

Generate a large starfield on the GPU. Output goes into a `StructuredBuffer` consumed by `DrawMeshInstancedIndirect`.

```hlsl
// StarGenerate.compute
#pragma kernel CSMain

struct Star
{
    float4 position;  // xyz on sphere, w = magnitude
    float4 color;     // rgb spectral, w = twinkle seed
};

RWStructuredBuffer<Star> _Stars;

uint _Count;
float _Radius;
float _MinMag;
float _MaxMag;
float _Seed;

float hash(float n) { return frac(sin(n) * 43758.5453); }

float3 blackbody(float tempK)
{
    float t = tempK / 100.0;
    float r, g, b;
    if (t <= 66.0)
    {
        r = 1.0;
        g = (99.47 * log(t) - 161.12) / 255.0;
        b = t <= 19.0 ? 0.0 : (138.52 * log(t - 10.0) - 305.04) / 255.0;
    }
    else
    {
        r = 329.7 * pow(t - 60.0, -0.1332) / 255.0;
        g = 288.12 * pow(t - 60.0, -0.0755) / 255.0;
        b = 1.0;
    }
    return saturate(float3(r, g, b));
}

[numthreads(256, 1, 1)]
void CSMain(uint3 id : SV_DispatchThreadID)
{
    if (id.x >= _Count) return;

    float i = (float)id.x;
    float s = _Seed + i;

    float theta = hash(s * 1.1) * 6.283185;
    float phi = acos(2.0 * hash(s * 2.2) - 1.0);
    float3 pos = float3(
        sin(phi) * cos(theta),
        sin(phi) * sin(theta),
        cos(phi)) * _Radius;

    float mag = _MinMag + pow(hash(s * 3.3), 0.4) * (_MaxMag - _MinMag);

    float r = hash(s * 4.4);
    float temp;
    if      (r < 0.00003) temp = 30000.0 + r * 5000000.0;
    else if (r < 0.001)   temp = 10000.0 + r * 1000000.0;
    else if (r < 0.007)   temp = 7500.0 + r * 60000.0;
    else if (r < 0.037)   temp = 6000.0 + r * 15000.0;
    else if (r < 0.117)   temp = 5200.0 + r * 5000.0;
    else if (r < 0.237)   temp = 3700.0 + r * 3000.0;
    else                   temp = 2400.0 + r * 2600.0;

    _Stars[id.x].position = float4(pos, mag);
    _Stars[id.x].color = float4(blackbody(temp), hash(s * 5.5));
}
```

## Nebula Additive (billboard path)

Simple unlit additive shader for triangle-fan nebula sprites. Vertex color carries the emission-line hue; alpha drives falloff from center.

```hlsl
Shader "Celestial/NebulaAdditive"
{
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" }
        Pass
        {
            Blend One One
            ZWrite Off
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                half4  color      : COLOR;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                half4  color      : COLOR;
            };

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                OUT.positionCS = TransformObjectToHClip(IN.positionOS.xyz);
                OUT.color = IN.color;
                return OUT;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                return IN.color;
            }
            ENDHLSL
        }
    }
}
```

## Performance notes

- **Additive blending everywhere.** `Blend One One` on all celestial layers = no transparency sort. Single biggest perf win.
- **Star twinkle in vertex shader.** Multi-frequency sine with hash-based phase per star. Zero CPU cost per frame.
- **Diffraction spikes.** Branch on `brightness > 0.5` — only computed for the brightest ~5% of stars.
- **Volumetric nebula: 48 steps.** Below 32 → banding. Above 64 → diminishing returns.
- **Billboard nebulae.** One triangle fan each. For animated nebulae, regenerate at 2–4 Hz, not every frame.
- **Moon craters.** Voronoi in fragment shader costs a 27-iteration loop. For a static moon, bake to a `RenderTexture` once.
- **`CBUFFER_START(UnityPerMaterial)` on every shader.** SRP Batcher compatibility. Missing it doesn't break the shader, it silently disables batching.
