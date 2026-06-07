---
name: ccmanager
description: Reference for the ccmanager (Observer) project — a local-first developer dashboard that unifies three independent context-management tools running on the same machine: RTK (Rust shell-output filter), Headroom (Python LLM-input proxy), and Memesis (Python memory lifecycle for Claude Code). Use this skill whenever the user mentions ccmanager, Observer, the proxy dashboard, or any of the three sibling tools (RTK, Headroom, Memesis) — including their on-disk artefacts (`~/.headroom/`, `~/Library/Application Support/rtk/`, `~/.claude/memory/`), wants to forward their data into Observer, wants to understand how they fit together as a context-management suite, wants to mirror their patterns (FastAPI proxy stage timers, TOML filter rules, peewee memory lifecycle), or wants language tradeoff analysis (Python vs Rust for proxy/wrapper tooling) — even when the architecture itself is not the explicit topic.
---

# ccmanager — Context Management Suite Reference

## What ccmanager is

ccmanager (codename **Observer**, repo at `/Users/emmahyde/projects/ccmanager/`) is a local-first developer dashboard that gives a unified view across **three independent tools** that already run on the developer's machine and each compress LLM token spend in a different position of the pipeline:

```
   user's shell         agent prompt          LLM input            LLM output
        │                    │                    │                    │
        ▼                    ▼                    ▼                    ▼
   ┌────────┐          ┌──────────┐         ┌──────────┐         ┌─────────┐
   │  RTK   │ ───────► │ memesis  │ ──────► │ headroom │ ──────► │   LLM   │
   │ (Rust) │          │ (Python) │         │ (Python) │         └─────────┘
   └────────┘          └──────────┘         └──────────┘
   filters tool         curates memory       compresses prompt
   output before        injected at          before upstream
   agent reads          session start        send
```

Observer (ccmanager) sits orthogonal to the chain — it **reads** each tool's on-disk artefacts and surfaces them in one dashboard so the developer can see what every layer is doing.

The five reference files in this skill correspond to the relevant ecosystem tools (four siblings + one meta):

- `references/rtk__rust_performance.md` — RTK internals, why Rust, Cargo deps, filter TOML pattern
- `references/headroom__python_proxy.md` — Headroom internals, FastAPI shape, AST graph of the codebase, compression pipeline, stage timer pattern
- `references/memesis__memory_integration.md` — Memesis internals, peewee schema, lifecycle stages, what Observer can read, what's missing for evals
- `references/mex__typescript_markdown_file_architecture.md` — mex (`promexeus`) internals, drift checker plug-in pattern, unified+remark markdown AST shape, why TypeScript fits
- `references/ccmanager__context_management_suite.md` — how all four integrate in Observer, adapter shapes, route map, planned waves

## Why this skill exists

Each of the three tools is independently coherent but documented separately. When the user works on ccmanager itself (or on any of the three siblings), the right mental model is the **suite** — where each tool sits in the pipeline, what data it exposes, which patterns it pioneers that the others (or ccmanager) can copy.

This skill loads the architectural model on demand. Trigger it whenever:

- the user is working in `/Users/emmahyde/projects/ccmanager/` or any of the sibling repos
- the user mentions "the proxy", "the dashboard", "Observer", "ccmanager"
- the user names any artefact: `proxy_savings.json`, `~/.headroom/`, `rtk gain`, `history.db`, `~/.claude/memory/index.db`, `consolidation_log`, `interceptor pipeline`
- the user wants to forward, mirror, or steal patterns from any of the three
- the user is debugging why a saving/compression/memory-injection did or didn't happen
- the user asks "Python vs Rust for X" or "where does X belong in this stack"

## Decision tree — which reference do I need?

```
Q: User mentions RTK internals, Rust performance, sub-50ms cold start,
   Cargo deps, TOML-driven filters, regex-per-tool config, history.db?
   → load references/rtk__rust_performance.md

Q: User mentions Headroom internals, FastAPI proxy, prompt compression,
   smart_crusher / content_router, stage_timer, savings_tracker, prefix
   cache alignment, Magika, or wants the AST graph of the codebase?
   → load references/headroom__python_proxy.md

Q: User mentions Memesis, peewee models, memory lifecycle stages
   (ephemeral / consolidated / crystallized / instinctive), retrieval
   scoring, narrative threads, consolidation_log, vec_memories, or wants
   to know what to add server-side to enable Observer evals?
   → load references/memesis__memory_integration.md

Q: User mentions mex, promexeus, .mex/ scaffold, drift detection,
   `mex check` / `mex setup` / `mex sync`, scaffold-vs-reality verification,
   or wants the unified+remark markdown AST shape, the per-checker
   plug-in pattern, or "scaffold + drift verify" architectures?
   → load references/mex__typescript_markdown_file_architecture.md

Q: User asks how the four fit together, wants the integration map,
   adapter shapes, Observer route map, planned waves, or "what's the
   right place to put X"?
   → load references/ccmanager__context_management_suite.md

Q: User wants Python vs Rust tradeoff analysis or "which language fits a
   proxy/wrapper here"?
   → load both rtk__rust_performance.md AND headroom__python_proxy.md;
     comparison sits at the end of each
```

If multiple apply, load in parallel. Each reference is short.

## Hardcoded facts you can use immediately

These are stable across versions; don't re-look-them-up each turn.

| Tool | Lang | Binary | Listens | Persists to |
|---|---|---|---|---|
| RTK | Rust 1.x (Homebrew) | `/opt/homebrew/bin/rtk` (~7.2 MB) | none — per-invocation | `~/Library/Application Support/rtk/history.db` (sqlite via `rusqlite`) |
| Headroom | Python 3.12 (uv tool) | `~/.local/bin/headroom` | `localhost:8787` (FastAPI) | `~/.headroom/proxy_savings.json` + `~/.headroom/logs/proxy.log` (PERF + STAGE_TIMINGS lines) + `~/.headroom/toin.json` |
| Memesis | Python (claude-plugin) | hooks via Claude Code skill | none (sqlite-only) | `~/.claude/memory/index.db` (global) or `~/.claude/projects/<hash>/memory/index.db` (per-project) — peewee + FTS5 + sqlite-vec |
| ccmanager (Observer) | JS — Vite SPA + Hono backend | `pnpm dev` (web 5173, proxy 3001) | localhost:3001 (Hono), localhost:5173 (Vite) | `apps/data/observer.db` (sqlite via better-sqlite3) |

When the user asks "where is X persisted" — answer from the table without re-grepping disk.

## Position in the LLM pipeline (the most-confused thing)

This is the line every architectural answer should lead with. The three tools live in **different positions**:

| Tool | Acts on | Position | When it runs |
|---|---|---|---|
| RTK | tool/CLI **output** | post-tool, pre-agent-read | per shell invocation, dies after |
| Memesis | retrieved **memories** | pre-prompt-build | session start + on-demand recall |
| Headroom | full **prompt** about to leave for LLM | pre-upstream-send | per LLM HTTP request |

Token totals **stack** — they shrink different things. RTK can save 1M tokens on a single `cat` of a log file (output filter). Memesis trims what memories make it into the prompt. Headroom compresses whatever prompt text remains. They're not redundant.

ccmanager makes all three legible in one dashboard.

## What ccmanager already integrates (current state, post Wave 5)

- `apps/proxy/src/lib/external-feeds/rtk-adapter.js` — read-only sqlite open of RTK history.db, lifetime + per-command stats
- `apps/proxy/src/lib/external-feeds/headroom-adapter.js` — `readProxySavings()` JSON read + `tailProxyLog()` watcher for PERF/STAGE_TIMINGS
- `apps/proxy/src/lib/headroom-tail.js` — log tail → traces table writer + `trace_persisted` SSE emit
- `apps/proxy/src/lib/memesis-bridge.js` — read-only sqlite bridge w/ real schema + path resolution (global db → most-recent project db)
- `apps/proxy/src/routes/proxy-api.js` — `/cache/stats` and `/interceptors` now serve composed live data from RTK + Headroom + Observer's own interceptor counters
- `apps/proxy/src/lib/interceptor-stats.js` — in-memory rolling counters keyed off `broadcastProxyEvent` interceptor_run + cache_hit events

What ccmanager is **planning** (per `.context/SEED-w6-w7-memesis-viz.md`):

- Wave 6: memesis-side schema additions (`observations` table, retrieval candidate score breakdowns, affect log) + Flask sidecar at port 4101
- Wave 7: rebuild Memory · Memesis surface as Consolidation Studio + Retrieval Inspector + Duplicates Queue + Eval Runner

## Notable patterns worth stealing across the suite

Flagged here so you remember to surface them when relevant. Each is detailed in its own reference file.

- **Dual-base sync+async context manager** (Headroom `stage_timer.py`) — one timer instruments both code paths
- **`PERF` kv + `STAGE_TIMINGS` JSON sibling lines paired by request_id** (Headroom proxy log) — cheap tail readers + full tracer both work
- **Atomic JSON counter via `tempfile.mkstemp` + `shutil.move`** (Headroom `savings_tracker.py`) — durable single-writer state without sqlite
- **Per-tool TOML filter configs** (RTK `filters/*.toml`) — declarative regex rules per language; trivial to add a new tool
- **Magika content-type ML routing** (Headroom `transforms/content_router.py`) — classify message content, pick compressor accordingly
- **Privacy filter before every LLM call** (Memesis rule #2 in its CLAUDE.md) — never bypass; pattern matters more than the regex
- **Peewee deferred database binding** (Memesis `core/models.py`) — `db = SqliteDatabase(None)` then `init_db()` binds at runtime; lets test fixtures swap db without globals dance
- **Stage-discriminated log lines that pair via shared id** — same idea as Headroom's PERF/STAGE_TIMINGS, applicable to ccmanager's own interceptor pipeline

## What NOT to do

- Do not write to `~/.headroom/proxy_savings.json` from outside Headroom — owned by atomic-rename writer.
- Do not open RTK's `history.db` writable — schema migrates between minor versions; Observer is read-only by contract.
- Do not write to memesis sqlite from Observer — memesis is canonical writer; rule #1 of its CLAUDE.md. Observer is read-only.
- Do not naive-line-split `proxy.log` — `STAGE_TIMINGS` JSON can span long; pair via bracketed request_id. Use the parser shape in `apps/proxy/src/lib/external-feeds/headroom-adapter.js` (`PERF_RE` + `STAGE_RE`).
- Do not assume any of the three siblings is running — Headroom may be off, RTK may not be installed, memesis db may not exist. Every adapter must graceful-empty.
- Do not bypass memesis's privacy filter when surfacing observations in Observer — strip-before-display still required.

## Output style for answers

When the user asks an architectural question:

1. Lead with **which tool is responsible** and its **position in the pipeline** — that resolves most confusion.
2. Cite **specific file paths** with line counts when relevant — `transforms/smart_crusher.py` (3669 LOC) is more useful than "the compressor".
3. Push at the **right reference file** by name; don't dump the whole arch inline.
4. For "should I do X like Headroom does" — answer with the **why** (what constraint the pattern satisfies) and check whether user's situation has the same constraint.

Reference files have full breakdowns. Chat answers are the concise sentence; references are the deep tour.
