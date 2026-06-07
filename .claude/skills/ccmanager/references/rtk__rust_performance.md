# RTK — Rust Token Killer

## What it is

Per-invocation Rust shell binary that wraps CLI commands, filters their stdout/stderr through tool-specific regex rules, and persists per-command savings to a local sqlite. Goal: shrink LLM-bound tool output before the agent reads it.

- **Source**: `https://github.com/rtk-ai/rtk` (Apache-2.0)
- **Install**: `brew install rtk` → `/opt/homebrew/bin/rtk` symlink → `/opt/homebrew/Cellar/rtk/<v>/bin/rtk`
- **Binary**: ~7.2 MB Mach-O ARM64, statically linked
- **Repo size**: ~3.7 MB; ~96% Rust + minor Shell/TS/Python/Ruby
- **Persistence**: `~/Library/Application Support/rtk/history.db` (sqlite via `rusqlite 0.31`, bundled feature)
- **Telemetry tee**: `~/Library/Application Support/rtk/tee/<unix>_<cmd>.log`
- **Beacon**: `.beacon_lock_<port>` files only when an explicit daemon mode is active; the default rtk run leaves none.

## Repo layout (from `src/`)

```
src/
├── main.rs                  99 KB — entry, arg parse, dispatch
├── core/
│   ├── tracking.rs           56 KB — sqlite writes, history.db schema
│   ├── toml_filter.rs        53 KB — TOML rule loader + applier
│   ├── stream.rs             28 KB — stdout/stderr line reader
│   ├── filter.rs             17 KB — regex compile + apply
│   ├── tee.rs                16 KB — tee log writer
│   ├── telemetry.rs          19 KB — analytics counters
│   ├── utils.rs              27 KB — shared helpers
│   ├── runner.rs              5 KB — subprocess spawn
│   ├── display_helpers.rs    10 KB — terminal output
│   └── config.rs              7 KB — runtime config
├── cmds/
│   ├── git/, dotnet/, go/, js/, python/, ruby/, rust/, system/, cloud/
│   └── mod.rs                — per-language command dispatchers
├── parser/                   — output parsers per tool family
├── filters/                  — *.toml rule files (78+ tools)
├── analytics/                — `rtk gain` reporting
├── discover/                 — `rtk discover` history scanner
├── learn/                    — pattern learning helpers
└── hooks/                    — Claude Code hook integration
```

## Cargo dependencies (from `Cargo.toml` v0.37.2)

```toml
clap = { version = "4", features = ["derive"] }
anyhow = "1.0"
ignore = "0.4"
walkdir = "2"
regex = "1"
lazy_static = "1.4"
serde = { version = "1", features = ["derive"] }
serde_json = { version = "1", features = ["preserve_order"] }
colored = "2"
dirs = "5"
rusqlite = { version = "0.31", features = ["bundled"] }
toml = "0.8"
chrono = "0.4"
tempfile = "3"
sha2 = "0.10"
ureq = "2"           # sync HTTP — important: NOT reqwest, NOT tokio
getrandom = "0.4"
flate2 = "1.0"
quick-xml = "0.37"
which = "8"
automod = "1"
```

Note: `tokio` shows up in the compiled binary's strings table but is not in `[dependencies]`. It's pulled transitively (likely from a feature path inside another crate). Steady-state RTK is **synchronous** — `ureq` is sync HTTP, no event loop, no `async fn`.

## Hot-path architecture

```
shell ─exec→ /opt/homebrew/bin/rtk <cmd> [args...]
       │
       ├─ main.rs:
       │   ├─ clap parse
       │   ├─ resolve filter rule set (which TOML to apply for `<cmd>`)
       │   └─ runner.rs: spawn subprocess via std::process::Command
       │
       ├─ stream.rs:
       │   ├─ read child stdout line-by-line
       │   └─ pipe each line through filter chain
       │
       ├─ toml_filter.rs / filter.rs:
       │   ├─ compile regex set from filters/<tool>.toml at startup
       │   ├─ classify each line: keep / drop / collapse / annotate
       │   └─ stream filtered output to current shell stdout
       │
       ├─ tracking.rs:
       │   └─ INSERT INTO commands(...) on completion
       │       — saved_tokens = (raw_tokens - filtered_tokens)
       │
       └─ exit
```

Single-shot. No persistent process. No port. No daemon.

## sqlite schema (`history.db`)

```sql
CREATE TABLE commands (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  original_cmd TEXT NOT NULL,
  rtk_cmd TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  saved_tokens INTEGER NOT NULL,
  savings_pct REAL NOT NULL,
  exec_time_ms INTEGER DEFAULT 0,
  project_path TEXT DEFAULT ''
);
CREATE INDEX idx_timestamp ON commands(timestamp);
CREATE INDEX idx_project_path_timestamp ON commands(project_path, timestamp);

CREATE TABLE parse_failures (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  raw_command TEXT NOT NULL,
  error_message TEXT NOT NULL,
  fallback_succeeded INTEGER NOT NULL DEFAULT 0
);
```

Schema may shift between minor versions — always open `readonly: true` from outside RTK.

## `filters/*.toml` pattern (the key idea worth stealing)

78+ tool filter configs. Each file declares regex rules for "what to keep" and "what to drop" for a specific tool's output. Examples in v0.37.2:

```
ansible-playbook.toml      jest.toml             biome.toml
basedpyright.toml          jq.toml               ollama.toml
brew-install.toml          jira.toml             vitest.toml
dotnet-build.toml          markdownlint.toml     gradle.toml
gcc.toml                   helm.toml             liquibase.toml
git.toml                   make.toml             mvn-build.toml
ipython.toml               nx.toml               (~78 total)
```

This is **declarative + per-tool**. Adding support for a new tool = drop a TOML file. No code change. No release. Compare to a hardcoded if/else chain — the TOML config wins on:

- contributor friction (PR is one TOML file)
- runtime hot-loading (no recompile)
- separation of concerns (filter rules are data, not code)

Steal this for any output-classification surface that has 5+ variants. The Observer knowledge-graph ingest pipeline (repomix + ast-grep) has exactly this shape and should adopt it.

## Why Rust is the right choice for RTK

| Constraint | Why Rust wins |
|---|---|
| Cold start <50 ms | Python interpreter alone is ~30 ms cold. Rust binary cold-starts in single-digit ms. |
| Per-invocation lifetime | No daemon to manage; no process supervision; user owns the cost of shell startup |
| CPU-bound regex over MB of stdout | Rust `regex` crate (Aho-Corasick + lazy DFA) is 5–50× faster than equivalent Python regex on this workload |
| Single static distribution | Mach-O binary via Homebrew — no venv, no Python ABI mismatch, no `pip install` |
| Memory-tight per invocation | No GC, no JIT warmup, no ML stack pulled in |

If you're building a per-command shell tool that has to wake up, do CPU work on stdin, and exit, Rust is the right call. If it's a long-lived network daemon, the math flips — see Headroom.

## Empirical numbers (from local `rtk gain --format json`)

Numbers vary per machine; the pattern is what matters.

- Lifetime tokens saved (single laptop): low millions
- Per-command top scorers locally: `cat <large file>` (99.9% reduction), `eslint` (~99%), `dotnet build` (~33% — variable because compiler output is hard to filter without losing signal)
- Average exec time: low single-digit ms per line filtered

Headline insight: RTK saves the most tokens on **opaque-output commands the agent should never read in full** — log dumps, lint runs, package install spew. Agent productivity isn't reduced because the dropped lines were noise.

## How Observer (ccmanager) integrates RTK

Read-only via `apps/proxy/src/lib/external-feeds/rtk-adapter.js`:

```js
createRtkAdapter()
  .getLifetime()           // SUM(saved_tokens), COUNT(*), AVG(savings_pct)
  .getCommandStats({       // GROUP BY original_cmd
    since: ISO_string,
    limit: number,
  })
  .getRecentCommands(N)    // tail rows
```

Feeds Observer's `/api/proxy/cache/stats` `topKeys` field and dashboard lifetime totals. Sqlite open is `readonly: true` via `@observer/shared` `openDb()` helper.

Graceful empty: returns null/zero if `history.db` not found. Adapter never throws.

## Pitfalls when integrating RTK

- **Schema migration mid-day**: don't cache prepared statements across long runs; reopen on long sessions.
- **Project path filtering**: `project_path` column is sometimes empty (commands run outside a project root). Don't `WHERE project_path = ?` without a fallback.
- **Time zone**: timestamps are ISO 8601 strings with offset. Lexicographic compare works but be explicit.
- **Concurrent writes**: RTK opens `history.db` writable on every invocation. If you hold a write lock from outside, you'll cause RTK invocations to fail. Read-only opens from outside are safe (WAL mode).
