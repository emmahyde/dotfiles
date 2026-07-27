# Memesis — Python Memory Lifecycle for Claude Code

## What it is

Self-driven memory lifecycle plugin for Claude Code. Memories progress through stages: `ephemeral` → `consolidated` → `crystallized` → `instinctive`. Ingests observations, curates them via LLM consolidation (privacy-filtered), and re-injects relevant memories at session start. The canonical memory writer.

- **Source**: `$HOME/projects/memesis/` (sibling of ccmanager)
- **Lang**: Python 3.10+
- **Persists**: `~/.claude/memory/index.db` (global) or `~/.claude/projects/<hash>/memory/index.db` (per-project) — sqlite via Peewee ORM, FTS5, sqlite-vec
- **Entrypoints**: Claude Code skills (`/memesis:learn`, `/memesis:recall`, `/memesis:forget`) + `scripts/dashboard.py`, `scripts/heartbeat.py`, `scripts/consolidate.py`
- **Position in suite**: pre-prompt-build. Curates which memories are injected into Claude Code session context.

## Top-level package layout

```
memesis/
├── core/                   ── ENGINE (Peewee + LLM + retrieval)
│   ├── models.py           404 LOC    Peewee models (deferred db)
│   ├── database.py         init_db / close_db / VecStore singleton
│   ├── ingest.py           7.5K       observation → ephemeral memory
│   ├── consolidator.py     22.5K      LLM consolidation w/ privacy filter
│   ├── crystallizer.py     15.8K      promote consolidated → crystallized
│   ├── reconsolidation.py  14.8K      memory editing/merging
│   ├── lifecycle.py        13K        stage transition orchestration
│   ├── retrieval.py        29K        biggest module — relevance scoring
│   ├── relevance.py        18.8K      score components (semantic/recency/affect/...)
│   ├── threads.py          18.6K      narrative thread management
│   ├── self_reflection.py  18.1K      meta-cognition
│   ├── affect.py           18.7K      arousal/valence tracking
│   ├── feedback.py         12.7K      feedback loops
│   ├── coherence.py        narrative coherence scoring
│   ├── habituation.py      repetition decay
│   ├── spaced.py           spaced repetition scheduling
│   ├── replay.py           memory replay
│   ├── orienting.py        attention/orienting response
│   ├── somatic.py          somatic markers
│   ├── embeddings.py       sqlite-vec wrapper
│   ├── vec.py              VecStore singleton
│   ├── llm.py              call_llm() — single LLM choke point
│   ├── prompts.py          11.3K      prompt templates
│   ├── transcript.py       transcript ingestion
│   ├── transcript_ingest.py
│   ├── manifest.py         what's tracked
│   ├── flags.py            feature flags
│   └── cursors.py          pointers/positions
│
├── scripts/                ── CLI / cron entrypoints
│   ├── dashboard.py        30.4K   HTML dashboard
│   ├── consolidate.py      12K     run consolidation pass
│   ├── heartbeat.py        14.3K   periodic background work
│   ├── reduce.py           24K     manual reduction
│   ├── cost.py             12.3K   cost reporting
│   ├── compare.py          8.6K
│   ├── seed.py             9.1K
│   ├── diagnose.py         8.6K
│   ├── transcript_cron.py
│   ├── embed_backfill.py
│   └── scan.py
│
├── hooks/                  Claude Code hook integration
├── skills/                 user-facing skill definitions
├── eval/                   pytest eval harness
├── tests/                  pytest unit tests
├── docs/
└── CLAUDE.md               (project rules — see below)
```

## sqlite schema (real, from `~/.claude/memory/index.db`)

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,          -- ephemeral | consolidated | crystallized | instinctive
  title TEXT,
  summary TEXT,
  content TEXT,
  tags TEXT,
  importance REAL,
  reinforcement_count INTEGER,
  created_at TEXT, updated_at TEXT,
  last_injected_at TEXT, last_used_at TEXT,
  injection_count INTEGER, usage_count INTEGER,
  project_context TEXT,
  source_session TEXT,
  content_hash TEXT,
  archived_at TEXT, subsumed_by TEXT,
  echo_count INTEGER,
  next_injection_due TEXT,
  injection_ease_factor REAL,
  injection_interval_days REAL
);

CREATE TABLE memory_edges (
  id INTEGER PRIMARY KEY,
  source_id TEXT NOT NULL, target_id TEXT NOT NULL,
  edge_type TEXT NOT NULL, weight REAL NOT NULL, metadata TEXT
);

CREATE TABLE narrative_threads (
  id TEXT PRIMARY KEY, title TEXT, summary TEXT, narrative TEXT,
  created_at TEXT, updated_at TEXT, last_surfaced_at TEXT, arc_affect TEXT
);
CREATE TABLE thread_members (thread_id TEXT, memory_id TEXT, position INTEGER, PRIMARY KEY (thread_id, memory_id));

CREATE TABLE retrieval_log (
  id INTEGER PRIMARY KEY, timestamp TEXT, session_id TEXT,
  memory_id TEXT, retrieval_type TEXT,
  was_used INTEGER, relevance_score REAL,    -- final score only; no breakdown
  project_context TEXT
);

CREATE TABLE consolidation_log (
  id INTEGER PRIMARY KEY,
  timestamp TEXT, session_id TEXT,
  action TEXT,                -- kept|pruned|promoted|demoted|merged|deprecated|subsumed|archived
  memory_id TEXT, from_stage TEXT, to_stage TEXT,
  rationale TEXT
);

CREATE VIRTUAL TABLE memories_fts USING fts5(title, summary, tags, content, content='memories', content_rowid='rowid');
CREATE VIRTUAL TABLE vec_memories USING vec0(memory_id TEXT PRIMARY KEY, embedding float[512]);
```

## Hot-path architecture (AST graph)

```
Claude Code session start
   │
   ├─ hooks/ session_start.py
   │    └─ skills/session_start.md instructs Claude to call memesis recall
   │
   ├─ skills/recall.md
   │    └─ scripts entry → core/retrieval.py
   │           │
   │           ├─ embeddings query (vec_memories, k-NN)
   │           ├─ FTS5 query (memories_fts on tags/title/summary/content)
   │           ├─ relevance.py: combine score components
   │           │     semantic + recency + importance + affect + reinforcement
   │           ├─ filter by stage + archived_at IS NULL
   │           └─ return top-N memories
   │
   ├─ → memories injected into Claude Code system prompt
   │
observation event (user said X / Claude observed Y)
   │
   ├─ core/ingest.py: write to memories(stage='ephemeral')
   │
periodic / on-demand consolidation
   │
   ├─ scripts/heartbeat.py or /memesis:consolidate
   │    └─ core/consolidator.py
   │           ├─ privacy filter strips emotional state patterns
   │           ├─ batch ephemeral memories
   │           ├─ core/llm.py call_llm() — single API choke point
   │           ├─ LLM returns: kept | pruned | promoted | merged proposals
   │           ├─ apply via core/lifecycle.py
   │           └─ write to consolidation_log(action, from_stage, to_stage, rationale)
   │
   └─ core/crystallizer.py / core/reconsolidation.py promote/edit further
```

## Project rules (from `memesis/CLAUDE.md`)

These are the rules ccmanager (and any external integrator) must respect:

1. **All persistence through `MemoryStore` or `database.py`.** Never write memory markdown files or sqlite rows directly. Atomic writes use `tempfile.mkstemp` + `shutil.move`.
2. **Privacy filter before every LLM call.** The consolidator's privacy filter strips emotional state patterns before content reaches the API. Never bypass it.
3. **All LLM calls through `core.llm.call_llm()`.** Do not create `anthropic.Anthropic()` clients in service modules.
4. **Tests never touch `~/.claude/memory`.** Use the conftest.py temporary directory fixtures.
5. **Skill invocations use full form.** `/memesis:learn`, `/memesis:recall`, `/memesis:forget`.

## Notable patterns worth stealing

### 1. Peewee deferred database binding (`core/models.py`)

```python
db = SqliteDatabase(None)  # bound at runtime by init_db()

class BaseModel(Model):
    class Meta:
        database = db
```

Lets test fixtures and per-project dbs swap without globals dance. ccmanager could mirror for any per-context sqlite.

### 2. Stage as data, not class (`core/lifecycle.py`)

Memories progress via `stage TEXT` column + `consolidation_log` audit trail. No state-machine class, no inheritance. Transitions are SQL writes plus a log row. Easy to reason about, easy to migrate, easy to read history.

### 3. Privacy filter as a guard at the API boundary

Privacy filter wraps the LLM call site, not individual call sites. Single choke point, can't be forgotten. Borrow this for any cross-cutting concern that **must** apply to every external API call.

### 4. FTS5 + sqlite-vec hybrid retrieval

Lexical (FTS5) + semantic (vec0) both queried, scores combined in `relevance.py`. Neither alone is sufficient — keyword retrieval misses paraphrase, vector retrieval misses rare-token matches. The hybrid is the answer. ccmanager's Knowledge surface should mirror.

### 5. Audit log as causal history (`consolidation_log`)

Every state transition logged with action + rationale. Lets you replay, debug, eval. Borrow whenever you have a non-trivial state machine.

## Why Python is the right choice for Memesis

| Constraint | Why Python wins |
|---|---|
| LLM SDKs, embeddings libs | Python-mature; consolidator needs prompt templates + LLM call + FTS query in same process |
| Peewee + sqlite-vec | both Python-native; no FFI dance |
| Plugin architecture (Claude Code skills) | skill scripts are markdown + Python; integration is trivial |
| Background cron (heartbeat) | simple `python -m scripts.heartbeat`; no daemon framework |
| Eval harness | pytest is the right tool for memory-quality tests |

If memesis were Rust, it would gain ~20% on retrieval latency (already <100ms) but lose Peewee, lose pytest evals, lose the natural skill-script integration. Wrong tradeoff.

## How ccmanager (Observer) integrates Memesis

Read-only via `apps/proxy/src/lib/memesis-bridge.js` (rewritten in Wave 5):

```js
createMemesisBridge()
  .listMemories()              // SELECT * WHERE archived_at IS NULL
  .getGraph()                  // memories + memory_edges → {nodes, edges}
  .getLifecycle()              // group by stage; promotion queue from consolidation_log
  .getCurationClusters()       // narrative_threads + thread_members
```

Path resolution: `MEMESIS_DB_PATH` env > `~/.claude/memory/index.db` > most-recently-modified `~/.claude/projects/<hash>/memory/index.db`.

Stage-name mapping for legacy UI (`ep|sm|pr|rf` → real names):
- `ephemeral` → `ep`
- `consolidated` → `sm` (semantic-ish)
- `crystallized` → `pr` (procedural-ish)
- `instinctive` → `rf` (reflexive)

Future stages will rename to real names in UI (Wave 7).

## What's missing for ccmanager evals (Wave 6 candidate)

Memesis exposes everything to read **what happened**, but not enough to **eval whether it was right**. Specifically missing:

| Missing | Needed for | Memesis change |
|---|---|---|
| `observations` table — raw obs before consolidation | Consolidation Studio diff view | new model + ingest write |
| Extended `consolidation_log` — `input_observation_ids JSON`, `prompt`, `response`, `model`, `tokens_in`, `tokens_out`, `latency_ms` | Replay/eval consolidation decisions | extend model |
| `retrieval_candidates` table — per-retrieval, per-candidate score component breakdown | Retrieval Inspector waterfall | new model |
| `affect_log` — periodic snapshots of affect state | Affect Timeline overlay | new model + heartbeat write |
| Sidecar HTTP at `localhost:4101` exposing the above | Observer reads via HTTP not direct sqlite | new `scripts/observer_api.py` Flask |

These are documented in `$HOME/projects/ccmanager/.context/SEED-w6-w7-memesis-viz.md` as Wave 6 work on the memesis side.

## Pitfalls when integrating Memesis

- **Don't write the db** — memesis is canonical writer. Read-only opens only.
- **Don't bypass privacy filter** — even when surfacing observations in Observer, strip on display.
- **Path resolution**: per-project dbs live under `~/.claude/projects/<hash>/memory/index.db` where `<hash>` is a slug of the project_context string. Don't hardcode; resolve.
- **Stage values are lowercase strings** — not enums in DB. Always compare case-sensitive.
- **`consolidation_log.action` whitelist** — `kept|pruned|promoted|demoted|merged|deprecated|subsumed|archived`. Don't assume open vocabulary.
- **`vec_memories` is sqlite-vec virtual table** — needs the extension loaded. better-sqlite3 in node can't read vec0 without the extension; only memesis-side can compute embeddings.
- **`memories_fts` is FTS5** — needs the FTS5-enabled sqlite build. `better-sqlite3` ships with FTS5 by default; compatible.
