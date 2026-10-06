<!-- premise-lock contract: v1.0 -->
A measurement contradicts your prediction, or a check you wrote just passed.

- EV1. Check passes on its first run: change one input and watch it go red before trusting it (a check that never fails verifies nothing).
- EV2. Before trusting a probe's output file: run `stat -f %m <file>` and compare to now (a stale file reads exactly like a fresh one).
- EV3. Measurement reads exactly `0`, `1.0`, or the previous value: suspect the instrument before the code (float32 `acos` returns 0 below 0.02 deg).
- EV4. Your check asserts the step you performed, not the user's goal: rewrite it to assert the goal (a step check passes while the mission fails).
- EV5. Before writing `VERIFIED`: paste the command and its result line in the same turn (a remembered result is an `ASSUMED`).
- EV6. Polling a status API right after triggering work: compare returned content against source before trusting `completed` (status APIs return the previous run).
- EV7. A probe must drive the real per-frame chain, not set state and read it back (setting state alone moves nothing).
- EV8. Two measurements disagree: name which instrument is blind before choosing a side (calling it a contradiction hides the broken one).

--- reference ---

## Your check passed and the bug is still there

The first version of a sky-invariant probe reported:

```
PASS sky: 10 distant bodies stay screen-fixed (worst none 0.0 px)
```

`worst none` and `0.0` were the tell. The probe called `pilot.Reset(pos)` and then read transforms. The camera rig is driven from the rigidbody in `LateUpdate`, so neither the ship nor the rig had moved. Nothing could shift, so nothing did, so it passed.

The fix was a helper that drives the real chain:

```
pilot.Reset(pos)                       <- sim
shipBody.position = SimToWorld(pos)    <- physics
rig.position = world                   <- camera, at its settled value
update.Invoke(host, null)              <- the actual per-frame method
```

EV1 catches this class in one step. A check that has never been seen to fail is an assertion about your own code's ability to run, not about the system's behavior.

## Your instrument is blind and you call it a contradiction

`Vector3.Angle` computes `acos(dot)`. In float32 the dot product rounds to exactly 1.0 for angles under roughly 0.02 degrees, so the function returns 0.

Two readings from the same frame:

```
bearing change  0.0000 deg     <- Vector3.Angle
screen shift    4.8 px         <- WorldToScreenPoint
```

That is not a contradiction. It is one working instrument and one blind one. Recomputed in double precision, the real angle was 0.003396 degrees, which is exactly 4.8 px.

EV3 fires on the shape of the number, before you build a theory on it. An exact 0 from a continuous quantity is a saturation, not a measurement.

## The report says FAIL and the code is fine

BAD (never do this):
```
read report -> FAIL host not ready -> conclude the host is broken
```

GOOD:
```
stat -f %m report.txt   -> 1755990412
date +%s                -> 1755993901        # 58 min old, written before the last edit
probe host state        -> host=found ready=True
```

The file was from an earlier run. Output files persist; a probe that fails to write leaves the previous answer sitting there looking authoritative. EV2 is one command and it makes this class impossible.

## The build ran and you are reading last build's success

A recompile status call issued immediately after triggering a recompile returns the *previous* run's `completed`. Acting on it starts play against a stale assembly, and the symptom is a report whose text half-matches your source.

Compare content against source, not status against expectation. EV6.
