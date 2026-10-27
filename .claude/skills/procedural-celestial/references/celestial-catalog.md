# Celestial Catalog Reference

Nebula type profiles with emission-line physics, deep-sky presets, constellation data format, eclipse configs, and sky mood profiles. All color values are linear RGB for Unity's `Color` constructor.

## Nebula Types

### Emission Nebula

Glowing gas ionized by nearby hot stars. The dominant visual in most night-sky scenes.

| Line | Wavelength | Color (linear RGB) | Role |
|---|---|---|---|
| H-alpha | 656.3 nm | `(1.0, 0.13, 0.4)` | Dominant — the red/pink glow |
| O-III | 500.7 nm | `(0.13, 0.67, 1.0)` | Teal — hot ionized oxygen |
| S-II | 671.6 nm | `(1.0, 0.67, 0.13)` | Orange — shock fronts |

```csharp
new NebulaDef("emission",
    density: 0.6f, brightness: 1.4f, noiseOctaves: 5,
    colors: new[] { new Color(1f, 0.13f, 0.4f), new Color(0.13f, 0.67f, 1f), new Color(1f, 0.67f, 0.13f) },
    filamentStrength: 0.5f, centralGlow: 0.4f)
```

Character: rich, vivid, dramatic. Tendrils of glowing gas wrap around dark voids. Central regions brightest, colors bleed outward. Filaments of brighter emission thread through the volume.

Examples: Orion Nebula (M42), Eagle Nebula (M16), Lagoon Nebula (M8).

### Reflection Nebula

Dust reflecting starlight. Blue-dominant — scatters short wavelengths preferentially, the same physics as Earth's blue sky.

```csharp
new NebulaDef("reflection",
    density: 0.4f, brightness: 0.8f, noiseOctaves: 4,
    colors: new[] { new Color(0.27f, 0.53f, 0.87f), new Color(0.4f, 0.6f, 0.8f), new Color(0.67f, 0.73f, 0.87f) },
    filamentStrength: 0.2f, centralGlow: 0.6f)
```

Character: ethereal, delicate. Soft blue glow around a central bright point. Less structured than emission — diffuse haze. The color is almost always blue.

Examples: Witch Head (IC 2118), Pleiades nebulosity.

### Dark Nebula

Dense dust that absorbs background starlight. Visible only as silhouettes against brighter fields.

```csharp
new NebulaDef("dark",
    density: 0.8f, brightness: 0f, noiseOctaves: 5,
    colors: new[] { Color.black, new Color(0.067f, 0.031f, 0.031f), new Color(0.031f, 0.031f, 0.031f) },
    filamentStrength: 0.6f, centralGlow: 0f)
```

Character: the absence of light as art. Dark tendrils carving shapes out of the star field behind them. Works best against a rich background.

Rendering: opacity mask, not additive. `Blend SrcAlpha OneMinusSrcAlpha` with `result.rgb = 0`, alpha drives darkening.

Examples: Horsehead Nebula, Barnard 68, Coal Sack.

### Planetary Nebula

Expelled shell of a dying star. Small, bright, often ring or hourglass shaped.

```csharp
new NebulaDef("planetary",
    density: 0.7f, brightness: 1.6f, noiseOctaves: 4,
    colors: new[] { new Color(0f, 1f, 0.67f), new Color(1f, 0.27f, 0.53f), new Color(0.27f, 0.27f, 1f) },
    filamentStrength: 0.3f, centralGlow: 0.8f,
    shellRadius: 0.3f, shellWidth: 0.08f)
```

Character: jewel-like, geometric. Clear structure — rings, shells, bipolar lobes. Bright central white dwarf. Colors can be vivid, almost neon.

Examples: Ring Nebula (M57), Helix Nebula (NGC 7293), Cat's Eye (NGC 6543).

### Supernova Remnant

Expanding shockwave from a stellar explosion. Filamentary, chaotic.

```csharp
new NebulaDef("supernova_remnant",
    density: 0.5f, brightness: 1.0f, noiseOctaves: 6,
    colors: new[] { new Color(1f, 0.27f, 0.13f), new Color(0.13f, 0.67f, 1f), new Color(1f, 0.93f, 0.27f) },
    filamentStrength: 0.8f, centralGlow: 0.2f)
```

Character: wild, energetic. Sharp filamentary structure — tangled threads of light. Unusual color combinations (red + blue synchrotron). Asymmetric, chaotic.

Examples: Crab Nebula (M1), Veil Nebula (NGC 6960), Cassiopeia A.

## Deep-Sky Object Presets

Pre-configured for quick scene building. Positions are directions on the sky sphere scaled by radius.

```csharp
static readonly DeepSkyPreset[] Presets = new[]
{
    new DeepSkyPreset("orionNebula", "emission",
        dir: new Vector3(-0.27f, 0.13f, -1f), scale: 60f,
        colors: new[] { Rgb(0xff3366), Rgb(0x4488cc), Rgb(0xffaa44) },
        brightness: 1.2f),

    new DeepSkyPreset("pillarsOfCreation", "emission",
        dir: new Vector3(0.4f, 0.2f, -0.93f), scale: 45f,
        colors: new[] { Rgb(0xff6633), Rgb(0x22aa55), Rgb(0x3366cc) },
        brightness: 1.0f),

    new DeepSkyPreset("horsehead", "dark",
        dir: new Vector3(-0.17f, 0.23f, -1f), scale: 30f,
        colors: new[] { Color.black, Rgb(0x110505), Rgb(0x050505) },
        brightness: 0f),

    new DeepSkyPreset("ringNebula", "planetary",
        dir: new Vector3(0.67f, 0.33f, -0.83f), scale: 20f,
        colors: new[] { Rgb(0x00ffaa), Rgb(0xff4488), Rgb(0x4444ff) },
        brightness: 1.5f),

    new DeepSkyPreset("crabNebula", "supernova_remnant",
        dir: new Vector3(-0.5f, 0.3f, -1.17f), scale: 25f,
        colors: new[] { Rgb(0xff4422), Rgb(0x22aaff), Rgb(0xffee44) },
        brightness: 1.0f),

    new DeepSkyPreset("pleiadesCluster", "reflection",
        dir: new Vector3(0.2f, 0.37f, -0.93f), scale: 50f,
        colors: new[] { Rgb(0x4488dd), Rgb(0x6699cc), Rgb(0xaabbdd) },
        brightness: 0.7f),
};

static Color Rgb(uint hex)
{
    return new Color(
        ((hex >> 16) & 0xFF) / 255f,
        ((hex >> 8) & 0xFF) / 255f,
        (hex & 0xFF) / 255f, 1f);
}
```

## Constellation Data Format

RA/Dec positions + line connections. RA is in degrees (0–360), Dec in degrees (−90 to +90).

```csharp
[System.Serializable]
public struct ConstellationStar
{
    public string id;
    public float ra;   // degrees
    public float dec;  // degrees
    public float mag;
    public float tempK;
}

[System.Serializable]
public struct Constellation
{
    public string name;
    public ConstellationStar[] stars;
    public string[][] lines; // pairs of star IDs
}

// RA/Dec → world direction on the sky sphere
public static Vector3 RaDecToDir(float raDeg, float decDeg)
{
    float raRad = raDeg * Mathf.Deg2Rad;
    float decRad = decDeg * Mathf.Deg2Rad;
    return new Vector3(
        Mathf.Cos(decRad) * Mathf.Cos(raRad),
        Mathf.Sin(decRad),
        -Mathf.Cos(decRad) * Mathf.Sin(raRad)); // negated Z for Unity left-handed
}
```

Orion example data:

| Star | RA | Dec | Mag | Temp K |
|---|---|---|---|---|
| Betelgeuse | 88.79 | 7.41 | 0.5 | 3500 |
| Rigel | 78.63 | −8.20 | 0.13 | 11000 |
| Bellatrix | 81.28 | 6.35 | 1.64 | 22000 |
| Mintaka | 83.00 | −0.30 | 2.23 | 30000 |
| Alnilam | 84.05 | −1.20 | 1.69 | 27500 |
| Alnitak | 85.19 | −1.94 | 1.77 | 30000 |
| Saiph | 86.94 | −9.67 | 2.09 | 26000 |

Lines: Betelgeuse–Bellatrix, Betelgeuse–Mintaka, Bellatrix–Mintaka, Mintaka–Alnilam, Alnilam–Alnitak, Alnitak–Saiph, Mintaka–Rigel, Rigel–Saiph.

## Eclipse Configurations

### Solar Eclipse

```csharp
public struct SolarEclipse
{
    public float moonOverlap;          // 1.0 = total, 0.5 = partial
    public float coronaBrightness;     // 0.8 typical
    public Color coronaColor;          // near-white: (0.93, 0.93, 1.0)
    public float skyDarkening;         // 0.9 = nearly night during totality
    public bool horizonSunsetGlow;     // 360-degree sunset at horizon
    public bool diamondRing;           // bright point at moon edge
}
```

Rendering: position moon billboard over sun. Corona = larger sprite behind moon with radial gradient and noise-modulated streamers. During totality, shift sky dome toward night colors and enable starfield at reduced brightness.

### Lunar Eclipse

```csharp
public struct LunarEclipse
{
    public float umbralCoverage;       // 1.0 = total
    public Color moonColor;            // blood red: (0.55, 0.15, 0.0)
    public Color penumbraColor;        // orange-brown: (0.8, 0.4, 0.2)
}
```

Rendering: shift moon material `_MoonColor` toward blood red. The sun direction stays the same — only the "sunlight" reaching the moon is filtered through Earth's atmosphere, so only long wavelengths (red/orange) survive.

## Sky Mood Profiles

### Serene / Contemplative

| Param | Value | Why |
|---|---|---|
| Stars | 6000 | Enough to feel rich, not overwhelming |
| Brightness | 0.8 | Slightly dimmed for softness |
| Milky Way | 0.15 | Subtle, not dominating |
| Nebulae | none | Clean, uncluttered |
| Moon | crescent (0.35) | Delicate |
| Meteors | 0.05/s | Rare, special moments |
| Palette | Cool blues and silvers, no warm tones |

### Awe / Cosmic Wonder

| Param | Value | Why |
|---|---|---|
| Stars | 15000 | Dense field |
| Brightness | 1.2 | Vivid |
| Milky Way | 0.4 | Rich, prominent |
| Nebulae | Orion + Pillars | Named objects |
| Moon | new (0.0) | Darkest sky |
| Meteors | 0.3/s | Frequent |
| Palette | Maximum contrast. Vivid against pure black |

### Romantic / Warm

| Param | Value | Why |
|---|---|---|
| Stars | 5000 | Soft |
| Milky Way | 0.1 | Background |
| Moon | full (0.5) | Warm glow |
| Meteors | 0.1/s | Occasional wishing star |
| Horizon | 0.4 | Warm amber |
| Palette | Warm moonlight, soft stars |

### Ominous / Unsettling

| Param | Value | Why |
|---|---|---|
| Stars | 3000 | Sparse |
| Brightness | 0.6 | Dim |
| Nebulae | one dark, scale 150 | Large void eating stars |
| Moon | 0.48 | Almost full, slightly wrong |
| Moon tint | orange `(1, 0.8, 0.67)` | |
| Meteors | 0 | Still, dead sky |
| Palette | Desaturated. Wrong and beautiful |

### Fantasy / Dreamy

| Param | Value | Why |
|---|---|---|
| Stars | 20000 | Exaggerated density |
| Brightness | 1.5 | Over-bright |
| Milky Way | 0.5 | Vivid band |
| Nebulae | 2+ emission, oversaturated | |
| Moon | full, scale 2x | Oversized |
| Meteors | 0.5/s | Constant |
| Palette | Break realism for beauty |
