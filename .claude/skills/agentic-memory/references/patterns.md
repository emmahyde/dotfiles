# Implementation Patterns

## Cron-Based Transcript Delta Processing

The recommended capture pattern for Claude Code plugins. Decouples capture from execution — no hooks blocking agent turns.

### Flag-file cursor pattern

```
~/.claude/memesis/cursors/{session_id}.json
{
  "transcript_path": "/path/to/.claude/projects/.../session.jsonl",
  "last_byte_offset": 48291,
  "last_run": "2026-04-19T14:30:00Z",
  "session_id": "abc123"
}
```

Cron run:
```
1. find ~/.claude/projects/**/*.jsonl modified in last 25h
2. for each transcript:
   a. load cursor file if exists
   b. seek to last_byte_offset (or 0 for new sessions)
   c. read to EOF → delta lines
   d. if delta is empty → skip
   e. filter delta to assistant messages only
   f. if filtered delta is empty → skip
   g. LLM: extract 0-3 observations from delta
   h. store observations to SQLite + Chroma
   i. write updated cursor file
```

**Edge cases:**
- **New session** (no cursor): Don't process from BOF blindly. Either start from current position (lose prior history, accept the tradeoff) or process in chunks with a cap of N observations on first run.
- **Active session**: Cron fires mid-turn — fine. Captures partial turn; next tick catches the rest.
- **Transcript rotated**: Byte offset points past EOF. Reset to 0, process as new.
- **Transcript deleted**: Skip, leave cursor file. Don't delete cursor — session may return.

**Cron interval:** 15-60 minutes is reasonable. Sub-5min adds cost with minimal benefit unless you need near-realtime recall.

---

## Significance Filter (LLM-based)

The gate between raw transcript delta and stored observations.

**Prompt pattern:**
```
You are extracting durable memory from a transcript delta.

Produce 0-3 observations. Return empty if nothing is worth remembering.

An observation is worth storing if it is:
- A decision made with rationale (architectural, design, implementation)
- A discovery about how the system works (not obvious from reading the code)
- A bug root cause identified
- A pattern established for future reference
- A constraint or gotcha discovered

Skip:
- File reads with no finding
- Package installs without errors
- Status checks
- Things already well-documented in the codebase
- Repetitive operations

Format each observation as:
<observation>
  <type>decision|discovery|bugfix|pattern|gotcha</type>
  <title>short, specific title</title>
  <narrative>2-4 sentences. Past tense. What changed or was learned.</narrative>
  <files>[optional: affected files]</files>
</observation>

Return empty response if nothing qualifies.
```

**Calibration signals:** If you're storing more than 3 observations per session on average, your filter is too permissive. If you're storing 0 across multiple active sessions, it's too restrictive.

---

## Dual Store: SQLite + Vector

### SQLite schema (minimal)
```sql
CREATE TABLE observations (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  files TEXT,  -- JSON array
  created_at INTEGER NOT NULL,
  content_hash TEXT NOT NULL UNIQUE  -- SHA256 for dedup
);

CREATE VIRTUAL TABLE observations_fts USING fts5(
  title, narrative,
  content=observations,
  content_rowid=id
);

CREATE TABLE cursors (
  session_id TEXT PRIMARY KEY,
  transcript_path TEXT NOT NULL,
  last_byte_offset INTEGER NOT NULL DEFAULT 0,
  last_run INTEGER NOT NULL
);
```

### When to use SQLite vs vector:
- **SQLite/FTS5**: "what did we decide about auth", "observations from this project", "what was the last bugfix", temporal queries → sub-10ms, no embedding cost
- **Vector (Chroma)**: "find anything related to the performance problem I'm seeing now", semantic similarity, cross-session concept search

### Deduplication
Content hash on `(project + title + narrative)`. 30s window catches burst duplicates.
Also: before storing, check cosine similarity against last 10 stored observations for this project. If any score > 0.85, skip.

---

## Context Injection at SessionStart

Inject at `SessionStart` using the user's last known prompt as the search query (from `user_prompts` table if available, or empty query for recency-based fallback).

**Token budget:**
- Target: under 2,000 tokens for background context injection
- Default: top 5 observations by relevance, ~200 tokens each = ~1,000 tokens
- Never inject more than 10 observations upfront

**Format:**
```
## Memory from past sessions

[2026-04-15] **Decision**: Auth uses session tokens in Redis, 24h TTL
Auth tokens are stored in Redis with a 24-hour TTL. No refresh token mechanism — expiry is hard. Relevant when working on auth flows or session handling.

[2026-04-12] **Discovery**: FTS5 search degrades when chroma is disabled
When ChromaDB fails to start, the search fallback to FTS5/LIKE was broken in v12 — fixed in v12.1. Always check chroma health at startup.
```

---

## Progressive Disclosure Pattern

Use this instead of full injection when memory store is large (>50 observations for the project).

1. Expose a `search_memory(query)` MCP tool
2. Returns ranked summaries: title + 1-sentence preview + ID (~100 tokens/result)
3. Agent calls `get_observation(id)` for full detail on relevant ones (~500 tokens each)
4. Agent only fetches what's relevant to the current task

This is the pattern that achieves claude-mem's "100% signal" claim vs 6% for flat injection.

---

## Staleness Management

Vector stores have no native staleness detection — old facts stay high-confidence. Options:

**TTL-based expiry:** Add `expires_at` column. Default TTL 90 days. Extend on access.
```sql
UPDATE observations SET expires_at = (strftime('%s','now') + 7776000) WHERE id = ?;
DELETE FROM observations WHERE expires_at < strftime('%s','now');
```

**Invalidation on contradiction:** When storing a new observation, check if it contradicts an existing one (via LLM comparison or keyword overlap). If yes, mark the old one `superseded = true`.

**Minimum viable:** Just TTL. Contradiction detection adds LLM cost on every write.
