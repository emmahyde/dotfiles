<!-- premise-lock contract: v1.0 -->
You are about to start design or debug work, or the user just restated a goal.

- PM1. Write item 1 as the symptom in the user's words, naming no fix (a fix in the problem statement makes every later step defend it).
- PM2. User names a shipped title ("like Project Zomboid", "Factorio-style"): state its ONE governing mechanism and confirm before designing (a title is a spec, not a mood).
- PM3. User restates the same goal a 2nd time: stop tuning parameters, re-post item 4 from a new cause (restatement means wrong mechanism).
- PM4. Before writing item 4: point at one `file:line` and one number (a symptom has no line).
- PM5. Before building: price the cheapest falsifier in wall-clock seconds and run it (a 2-minute flip beats a 1-week design).
- PM6. Before posting the block: attack the load-bearing claim, write `attack:` and `survives:` on two lines (an unattacked claim is not understood).
- PM7. Never add a layer that compensates for behavior not traced to a line -> trace it, or delete the compensated thing (compensator hides the premise).
- PM8. Item 4 tagged `ASSUMED`: do not build, write `premise unlocked` and stop (unverified cause wastes the whole build).
- PM9. Before item 5 costs more than 10 minutes: find a cheaper falsifier or say none exists (an expensive test never gets run).
- PM10. Complaint is about space, size, light, or position: match it in the `3d-first-principles` diagnosis table and name the principle in item 2 (the table names the mechanism in one lookup).
- PM11. Cite principles by ID in output: `P-DIVIDE`, `P-ORIGIN`, `P-RECIPE`, `P-DOT`, `P-FLATTEN`, `P-POINTS` (an ID is greppable, a paraphrase is not).
- PM12. User asks "why is it like this": answer with E-JOB — the job, the mechanism that job forces, why the obvious alternative fails at it (a settings list reads as arbitrary).

--- reference ---

## Your fix is correct and the user rejects it anyway

Each fix in a compensator chain is locally correct. It solves the problem the previous fix created. That is what makes the chain invisible from inside.

A real one, four layers deep:

```
planets on a perspective camera
        |  they grow
        v
fixed-radius shell            <- faking constant depth
        |  now sizes are wrong
        v
per-kind size constants       <- faking screen size
        |  now bearings whip
        v
bounded pan rules             <- faking approach
        |  none of it is verifiable
        v
an invariant probe            <- asserting the fakes hold
```

The premise under all four was one line: `fieldOfView = 100f` on a camera drawing objects the player can visit. Orthographic projection gives every property the four layers were emulating, for free, because it never divides by depth.

PM3 exists to cut this at layer two. The signal is not that the user disagrees with the fix — they cannot see the fix. The signal is that they described the same goal twice.

## The problem statement already contains the answer

BAD (never do this):
```
the sky shell needs constant angular size
```

GOOD:
```
1  PROBLEM    planets change screen size when the ship moves toward them
2  MECHANISM  orthographic projection - the camera never divides by depth
4  CAUSE      SectorProto.cs:1040  fieldOfView = 100f
5  TEST       set orthographic = true, fly at one body           ~2 min
```

The bad line names a component and a property. Both are answers. A reader who has never seen the code cannot disagree with it, which means it cannot be wrong, which means it cannot be checked. McConnell, Ch 3: defect cost climbs 10x to 100x from here to release.

## The complaint is about space, size, or light

Do not design. Look it up first. The `3d-first-principles` skill carries a table that maps a complaint straight to the principle that governs it.

```
"it gets bigger as I move toward it"        -> P-DIVIDE     projection
"it is in the wrong place, numbers fine"    -> P-ORIGIN     mixed spaces
"it orbits instead of spinning in place"    -> P-RECIPE     matrix order
"the lit side is dark / I see through it"   -> P-DOT        normals
"it vanished and I did not move it"         -> P-FLATTEN    then clip planes
```

One lookup produces item 2. A week of design does not.

Worked: "planets get bigger as I move toward them" is the first row. P-DIVIDE says perspective divides by depth and orthographic does not, and that no tuning removes the growth, because the growth **is** the division. Item 2 writes itself: orthographic projection.

## The user says a shipped title and you hear a mood

A title names a mechanism. Decode it in one line and say it back:

```
Project Zomboid   -> orthographic camera, no depth divide, screen size fixed by world size
Factorio          -> deterministic fixed-step sim, rendering reads a separate interpolated state
Dwarf Fortress    -> full simulation first, rendering is a view over it, never the source
```

If you cannot name the mechanism, say so and ask. Do not design from the mood.

## The premise survives but the build is expensive

Before a rewrite, a delete, or a change to a mechanism other code depends on, run `audit-against decomplexify <target>`. It fans out one expert per criterion and returns a severity-ranked scorecard. It costs real minutes, so it is gated on stakes — never per turn.
