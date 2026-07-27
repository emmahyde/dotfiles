# Passoff Examples

Two worked emits. Read when calibrating density, not on every emit.

## Minimal — single task, mid-flight

```
# PASSOFF · memesis · 2026-05-07 14:32

## LEGEND
now active   next upcoming   @path:line   $cmd

## NOW
- consolidator dedup bug @core/consolidator.py:184 — cosine ≥0.95 false-positive on short notes

## NEXT
- [H] length-gate before cosine cmp {S}
- [M] regression test @tests/test_consolidator.py {S}

## RESUME
$ python3 -m pytest tests/test_consolidator.py::test_dedup_short -x
#branch main · uncommitted: 1 · tests: 1 fail

## REHYDRATE TASKS
- [H] add length-gate to consolidator dedup || gating consolidator dedup by length
- [M] write regression test for short-note dedup || writing short-note dedup regression test
```

## Full — end of session, multiple threads

```
# PASSOFF · memesis · 2026-05-07 18:05

## LEGEND
now active   done finished   next upcoming   blocked stuck   note decision   ref pointer
> causes   @path:line   [H/M/L] priority   {S|M|L} effort

## NOW
- evolve --pick LLM ranker @scripts/evolve.py:412 — works ≤20 transcripts, OOM at 100+ blocked

## DONE
- transcript_ingest schema migration > landed  ref:a548355
- llm_cache logger fix > landed  ref:2c3d5e4

## NEXT
- [H] batch --pick chunks of 20  because avoid OOM  {M}
- [H] wire eval/recall/ harness to evolve  {M}  > unblocks pipeline diff report
- [M] backfill stats for legacy memories  {L}
- [L] dashboard polish  {S}

## BLOCKED / OPEN ?
- blocked: memvid/ vendored copy diverged from upstream  > decide vendor vs submodule
- ? crystallized->instinctive promotion: time-gated or usage-gated?  note:evolve runbook draft

## NOTES
- behavioral framing for friction signals  because transfers across sessions  ref:AGENTS.md
- atomic writes via tempfile+shutil.move  ref:core/database.py:55

## REFS
- code: @scripts/evolve.py:412 — pick loop
- code: @core/consolidator.py — dedup logic
- docs: .context/RISK-REGISTER.md — open risks
- prior: ea8da35 — evolve runbook
- skills: /memesis:evolve — replay harness

## RESUME
$ python3 scripts/evolve.py --pick --batch 20 --transcript <path>
#branch main · uncommitted: 14 · tests: pass (17:42)

## REHYDRATE TASKS
- [H] batch evolve --pick into 20-transcript chunks to avoid OOM || batching evolve --pick into 20-transcript chunks
- [H] wire eval/recall harness to evolve pipeline || wiring eval/recall harness to evolve
- [M] backfill stats for legacy memories || backfilling legacy memory stats
- [L] polish dashboard UI || polishing dashboard
```
