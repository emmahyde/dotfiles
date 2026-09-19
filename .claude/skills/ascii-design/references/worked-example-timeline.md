# Worked example: a quantity-over-time timeline

The source is Project Zomboid's fishing minigame (`media/lua/shared/Fishing/FishingRod.lua`).
The question the doc answers: why does a one-second line release lose the fish when the escape
timer allows 2.5 seconds? The answer is a shape — a fast drop, a floor, and a slow climb — which
is why this is a timeline and not a flow. `graph`/`seq` do not cover this; the trace is hand-laid
on the column grid and kept honest by the linter.

What it demonstrates beyond `worked-example.md`:

- a **value trace** built from corner glyphs, with labelled thresholds as rows
- a `┈` **threshold line** with `╳` crossings, so the reader sees exactly where state changes
- **band rows** under the plot (input held, timer counting) sharing the plot's time columns —
  the lane idea from rule 8 turned sideways
- ruler ticks drawn as `:` — a `│` tick fires the linter's dangling-wall check, and rightly,
  because a bare vertical reads as a wall that connects to nothing
- a rule-5 **gate row** carrying the outcome, so the plot states the facts and the gate states
  the consequence

*legend* — `──╮` the tension trace, `┈┈┈` the −0.8 danger threshold, `╳` a crossing,
`<>` a gate; symbols are verbatim from the Lua source, `* ` lines are narration.

```
        0s      0.4s        1.0s                2.0s
        :       :           :                   :
  0.0   ╮
        ╰───────╮
 -0.8   ┈┈┈┈┈┈┈┈╳┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈╳┈┈
                ╰──╮                        ╭────╯
 -1.0              ╰────────────────────────╯

input   ├─ hold release ───┤├─ hold reel ───────┤
timer   ........├ counting: reaches ~1.6 s ─────┤ back to 0
```

```
<> lowTensionTimer > tensionLimit ?
   |
   +-- yes ------------------> missFish()   * silent: no sound, no message
   |
   +-- no -------------------> fish stays hooked, timer resets to 0
```

Notes:

- The drop is steep because entering RELEASE never resets lineMoveCoeff
  (a dead branch in the source), so payout runs at near-maximum speed and
  tension crosses -0.8 in about 0.4 s.
- The trace flattens at -1 because releaseLine() stops paying out there.
  Holding release longer adds no slack. The timer still counts.
- The climb is slow because entering REEL resets lineMoveCoeff to 0.2 and
  ramps. With an instant re-press the climb back above -0.8 takes about 1 s.
- Total time below -0.8 is about 1.6 s against a 2.5 s limit — the doc's
  point in one number: the margin is under 1 s, and it is invisible in-game.
- The in-game gauge maps the whole -1..-0.8 band to 4 degrees of needle
  travel, so the timer runs while the gauge still reads safe.

## Why the bands earn their rows

The trace alone says what tension did. The bands say who did it and what the code concluded —
input is the player's channel, timer is the code's. Aligning them on the same time columns is
what lets a reader connect "I let go here" to "the timer started here" without a sentence of
prose. When a timeline doc feels like it needs a paragraph explaining cause, it usually needs a
band instead.
