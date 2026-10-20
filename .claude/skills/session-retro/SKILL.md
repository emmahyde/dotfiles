---
name: session-retro
description: Synthesizes evidence-grounded lessons from the current session and routes them through a log→promote→retire lifecycle so they change future behavior. Use when the user says "retro", "reflect on this session", "lessons learned", "takeaways", or at a session boundary / after a milestone or postmortem-worthy failure.
---

# Session Retro

Extract lessons from THIS session, grounded in quoted evidence, and disposition each one through a lifecycle. Never freeform-reflect: self-generated narrative lessons measure at +0.0pp downstream benefit (curated: +16.2pp) and confabulate under sparse feedback. The template and the lifecycle are the mechanism, not the prose. Evidence basis: [REFERENCE.md](REFERENCE.md).

## Hard rules

1. **Evidence or it didn't happen.** Every lesson quotes a verbatim signal from this session's transcript: a command's output line, an error, a user correction, a diff. A lesson you cannot anchor to a quote is discarded, not softened.
2. **Blameless framing.** Describe the condition that allowed the outcome ("probe measured from origin because the GO name mismatched"), never fault ("I carelessly…"). Blame framing degrades the honesty of the raw input.
3. **No promotion from a single episode.** First occurrence → dated log entry only. Promote at 2 occurrences for user corrections, 3 for self-observed patterns. Exception: an explicit user directive ("in future, always…", a direct promote order) overrides both thresholds and rule 4's timing — promote immediately and mark the entry `(user-directed)`.
4. **Session boundaries only.** Run after work concludes, never mid-task — mid-task reflection compounds in-progress misdiagnosis.
5. **Self-assessment is not a signal.** "The fix worked" counts only if a tool result in the transcript shows it. Otherwise the lesson's outcome field is UNVERIFIED.

## Workflow

### 0. Close the loop first
Before gathering anything new, list every open lesson: log entries and promoted memories with `STATUS: applied` or `OUTCOME: UNVERIFIED`. For each, check THIS session for firing evidence — behavior changed, mistake not repeated, or fired wrong. Update the status and give each a row in the final report. A lesson with 3 retros of opportunity and no firing evidence is a retirement nominee for step 4.

### 1. Gather by retrieval, not recall
At a session boundary your context is often a lossy compaction summary; a "sweep" from recall produces plausible pseudo-quotes that satisfy Hard rule 1's letter while defeating it (see REFERENCE.md, gather-by-retrieval). Pull quotes from artifacts, in this order:
1. **STATE.md history** — `git log -p --since=<session start> -- docs/STATE.md` plus the current file. S3 discipline captured corrections, ATTEMPT entries, decisions, and RESULTs verbatim at event time, and the git log recovers entries the 80-line cap later trimmed. A `[RECURRING]`-tagged constraint is a pre-counted 2nd occurrence — auto-promotion candidate in step 3.
2. **Transcript extraction** — run `~/.claude/skills/session-retro/bin/retro-signals <session>.jsonl [--since ISO] [--cap N]` (DuckDB under the hood; classes: correction / error / interrupt / repeat-cmd; capped truncated rows). Never raw-grep the JSONL into context — transcript lines embed file dumps and screenshots. Multi-session, or output past ~8 KB → delegate the run-and-filter to a haiku subagent and consume only its returned table. Script self-check: `retro-signals --self-test`.
3. **Recall sweep** — gap-filler only; anything found here still needs an artifact quote to survive step 2. Signal classes to extract; collect verbatim quotes:
- User corrections and constraints ("don't / only / stop / actually…", rephrased requests)
- Failures: non-zero exits, tracebacks, failed edits, denied permissions, reverted work
- Repeats: the same fix attempted 2+ times, the same file re-read, the same question re-asked
- Surprises: output contradicting a stated prediction; `ATTEMPT:` entries in docs/STATE.md
- Wins worth keeping: an approach that verifiably worked where a prior one failed

### 2. Draft candidates (forced template — all five fields or discard)
```
LESSON: <one-line behavior change, imperative>
SHAPE: <one tag from the vocabulary below>
SCOPE: project | machine | workflow
EVIDENCE: <verbatim quote + where it occurred>
CONDITION: <what allowed it — system/process, not blame>
APPLIES-WHEN: <trigger context for the lesson>
STOPS-APPLYING: <what would make it obsolete>
STATUS: candidate | OUTCOME: <verified signal, or UNVERIFIED>
```
One field per line — the recurrence check greps field prefixes; run-on single-paragraph entries are invisible to it.

SHAPE vocabulary (recurrence is tag-match, not phrasing-match; extend deliberately, at most one new tag per retro): `env-shell-mismatch`, `path-resolution`, `stale-context-edit`, `dual-store-split`, `naming-collision`, `serialization-assumption`, `api-assumption`, `tool-fallback`, `agent-hygiene`, `suppression-surfacing`, `process-gap`, `input-rewrite`. Tag-match is the candidate filter, not the verdict — same tag still requires judging whether it is the same lesson before counting an occurrence.

SCOPE routes the recurrence check: `project` greps this project's log; `machine` and `workflow` grep ALL `~/.claude/projects/*/memory/lessons-log.md`.

### 3. Disposition each candidate
Read `lessons-log.md` in the memory directory (system prompt lists the path; create the file with a `# Lessons log` header and a MEMORY.md pointer line if absent).
- **New** → append dated entry to `lessons-log.md`. Nothing else.
- **Recurrence hit** (grep `SHAPE: <tag>` across the logs per the candidate's SCOPE, plus MEMORY.md; threshold per Hard rule 3; a `[RECURRING]` STATE.md constraint counts as the 2nd occurrence) → promote: write a `feedback`/`project` memory file per the memory-system format, link `[[lessons-log]]`, add its MEMORY.md index line, and mark the log entries `PROMOTED → <file>`.
- **Contradicts an existing memory** → flag both to the user; never silently overwrite.

### 4. Retire (the pass that keeps the system alive)
Scan `lessons-log.md` and promoted memories for: entries `STOPS-APPLYING` now true, entries whose dated header is 6+ weeks old that never recurred and never promoted, step 0's no-fire nominees, and promoted lessons whose behavior change demonstrably never fires. Propose each for deletion (list them; user approves — deletion is a hard stop). Cap check: MEMORY.md index growing past ~30 lines or the log past ~100 entries means retirement is overdue — say so. Do not build separate dedup machinery; retirement subsumes it.

### 5. Status semantics
A promoted lesson is **applied**, not done. Its memory file keeps `STATUS: applied` until step 0 of a later retro finds evidence it actually fired (behavior changed, mistake not repeated) → `STATUS: verified`, or fired wrong / never fires → retire via step 4.

### 6. Propose the STATE.md trim
Harvesting is what makes trimming safe. After steps 1–3, list the `Done` / `Failed attempts` entries whose lesson value is now extracted and propose moving them to `docs/STATE-archive.md` (SESSION.md owns the cap and the archive convention). Proposal only — deletion is a hard stop needing user approval. This pass keeps the resume read cheap; skipping it is how STATE.md drifts to 4× cap.

### 7. Report
Terse table to the user: lesson | disposition (logged / promoted / retirement-proposed / contradiction-flagged / fired-verified) | evidence quote — one row per new candidate AND per step-0 lesson checked. No narrative recap of the session. Lessons the user pushes back on are deleted, not argued.

## What this skill is not
Not a session summary (that's docs/STATE.md), not auto-memory's per-fact capture, not a place for facts the repo already records. One writer: only this skill appends to `lessons-log.md`. And the flow is one-directional: evidence flows STATE.md → here; lessons never flow back into docs/STATE.md — STATE is task-scoped, lessons are behavior-scoped.
