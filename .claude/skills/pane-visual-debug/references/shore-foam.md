# Shore Foam and Coast Findings

Findings from the Snorkelnasium shore foam work on 2026-10-13. Use them when a stylized game needs a shoreline that reads as water meeting sand.

## What real foam looks like

Two aerial references agree on the structure. The water between waves is clear. Foam is lines, not fills. Each breaker is a thin bright line parallel to the beach with a lacy, net-like tail that thins as it travels. The swash edge on the sand is the brightest line, and a bubble net slides back over darker wet sand behind it.

- [Bernd Dittrich, aerial beach](https://unsplash.com/photos/an-aerial-view-of-a-sandy-beach-with-waves-P0t2gPQoSdo)
- [Arne Tho, aerial breakers](https://unsplash.com/photos/an-aerial-view-of-a-beach-with-waves-crashing-on-it-NYvD7aCezwk)

## Rejected looks

- Low-frequency noise inside a wide shore band. Reads as cloud shadow or mottle.
- Foam driven by water depth. A shallow shelf turns solid white.
- Run-up lines driven by mesh-interpolated height. They kink at every terrain cell.

## Structure that worked

```
  sand │ lip │ lace wash │ clear │ crest ─ tail │ clear │ crest ─ tail
       0    0.45       2.2                 ~3.8 unit spacing, moving in
```

1. **Shore field.** Bake a signed distance to the coast line from the real height function plus structure footprints, such as a dock. Land texels store negative distance. Encode -4 to 16 units in one byte at 0.5 units per texel over 128 units. Bake once and share the texture between the water and terrain materials.
2. **Lip.** `1 - smoothstep(0, 0.45, s)` where `s` is the shore distance plus a swell term.
3. **Lace.** A contour net of two value-noise layers: `1 - smoothstep(0, 0.14, abs(noise - 0.5))`. Keep the second layer at about twice the frequency of the first and give both small drifts. Widen the smoothstep before you raise the frequency, or it aliases.
4. **Crests.** `fract(s * 0.26 + t * 0.2 + drift)` moves toward the shore. The crest is `pow(0.5 + 0.5 cos(2π ph), k)` with `k` from 40 far out to 14 near the break. A lace tail follows on the seaward side where `ph` is just past zero.
5. **Sand run-up.** Sample the same shore field on the terrain. A bright line at the run-up distance, a darker wet strip below it, and lace in the last half unit. Keep the run-up within about 1.6 units of the coast.
6. **Shared phase.** The crest phase and the sand run-up use the same `drift` function, so a crest that reaches the shore matches a run-up pulse.

## Coast geometry

- A height function with a step at the coast makes a tiny vertical wall. The terrain grid renders it as a zigzag shelf and the water plane cuts through it, which shows as a toothed waterline. Make the sea side continuous with the beach height.
- A piecewise height with a kink is fine for a mesh as long as no plane cuts along the kink line.
- Terrain cells at a third of a unit are enough once the profile is continuous.
