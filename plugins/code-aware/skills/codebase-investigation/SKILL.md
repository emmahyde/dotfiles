---
name: codebase-investigation
description: Route codebase exploration to the right code-intelligence tool instead of defaulting to grep/Read/Glob. Use when finding where something is implemented, tracing what calls or breaks if a symbol changes, searching structural code patterns, recalling past decisions, or assessing complexity — in any repo. Covers lumen (semantic), sem (impact/diff/blame), grepai (call-graph), ast-grep (structural patterns), agentmemory (memory), lizard (complexity). Read languages/<lang>.md for language-specific gotchas (csharp, ruby).
---

# Codebase investigation

A stack of purpose-built, globally-installed tools beats `grep`/`Read`/`Glob` for **discovery and impact analysis**. They're semantic or structural, not textual, so they find code by meaning and resolve relationships that text search can't. Grep and Read are still right for the narrow cases below.

## The one rule

Before reaching for grep/Read/Glob, ask: **"Do I already know the exact literal string?"**

- **No** — exploring, understanding a concept, finding by meaning, or tracing impact → use a tool below.
- **Yes** — a known symbol name, error string, config key, import path → `rg` (ripgrep) is the right, fast choice.
- **Already located the file?** → `Read` it (the specific region, not the whole thing).

## Routing — goal → tool

| Goal | Use | Not |
|---|---|---|
| Find by meaning / "where is X implemented" / understand a subsystem | **lumen** `semantic_search` (MCP) | grep |
| Impact: what breaks / who depends on X, transitively (+ affected tests) | **sem** `sem impact X` | grep, import-graph "references" |
| Direct callers/callees of a function | **grepai** `grepai trace callers X` | grep |
| Structural pattern / lint / codemod (all `catch {}`, all `new T()`, rewrites) | **ast-grep** `ast-grep run -l <lang> -p '<pat>'` | grep (can't match nested structure) |
| Exact known string / symbol / error message | `rg` | the tools above (overkill) |
| Read a file/region you've already located | `Read` | reading whole files to hunt |
| Past decisions / prior-session context | **agentmemory** `memory_recall` | re-deriving from scratch |
| Complexity — find the gnarly functions | **lizard** `lizard -w <path>` | eyeballing |
| Who changed an entity / its history / a semantic diff | **sem** `sem blame` / `sem log` / `sem diff` | raw `git log` (file-coarse) |
| Runtime hot-paths — what actually runs in prod (opt-in) | **jcodemunch** (re-add `uvx jcodemunch-mcp`), after OTel instrumentation | guessing from source |
| Verify an external library/package API — what it actually does/returns | **ctx7** `ctx7 library <name>` → `ctx7 docs <id> "<q>"` | assuming from memory |

Worked example for each axis: **`resources/scenarios.md`** (naive grep/Read vs. the right tool, plus how to chain them).
Exact call signatures (JSON tool-schema format) for every tool: **`resources/tool-apis.md`**.

## What each tool owns

- **lumen** (MCP `semantic_search`) — dense semantic search; finds code by *meaning*. Code-specific embeddings, fully local, auto-indexes per repo. Your default for "where/how is X done."
- **sem** (CLI `sem`) — entity-level **impact / diff / blame / history / context**. Resolves entities by qualified id (`module::class::method`), so it disambiguates overloads and gives *transitive* blast radius. No setup; works in any git repo.
- **grepai** (CLI `grepai`, also MCP) — semantic search **+ call-graph** (`trace callers/callees`) with a live `watch` daemon. Reach for it when you specifically want caller/callee edges or always-fresh indexing.
- **ast-grep** (CLI `ast-grep`) — **structural** search, lint, and codemod over the AST. The only tool here that can match *shape* (e.g. empty catch, a specific call pattern) and rewrite it. Invoke as `ast-grep`, never `sg`.
- **agentmemory** (MCP `memory_recall` / `memory_save`) — cross-session memory of decisions and context; auto-captures via hooks.
- **lizard** (CLI `lizard`, or `uvx lizard`) — cyclomatic complexity per function; `-w` shows only over-threshold offenders. Stateless, multi-language.
- **ctx7** (CLI `ctx7`) — up-to-date docs for external libraries/packages. `ctx7 library <name>` resolves a Context7 library id, then `ctx7 docs <id> "<query>"` returns current API docs. Use to verify an external API before relying on it.
- **jcodemunch** (MCP, *opt-in* — `uvx jcodemunch-mcp`) — **runtime-trace → code** mapping (OTel spans → symbols, hot-path p50/p95). Not installed by default; add it only when you've instrumented OpenTelemetry. (Its static graph/reference tools are unreliable on namespace-import languages — prefer sem/grepai/ast-grep for those.)

## Per-repo setup

- **lumen** — auto-indexes on first query; force with `lumen index .` (needs its Ollama embed model).
- **grepai** — `grepai init && grepai watch` (daemon; needs an Ollama embed model).
- **sem / ast-grep / lizard** — **no setup**, run directly in any repo.
- **agentmemory** — session-scoped; recall/save work immediately.

## Anti-patterns

- **Never assume functionality without source verification.** Confirm external library/API behavior with `ctx7` (and the package source); confirm internal behavior by reading the real definition via these tools. Names, signatures, and memory are not evidence.
- **Don't grep to *understand*.** Text search finds strings, not concepts or structure. Use lumen (meaning) + sem (relationships).
- **Don't trust import-graph "find references" in namespace-import languages.** They silently under-report. Use `sem impact` / `grepai trace` / `ast-grep`. See `languages/csharp.md`.
- **Don't Read whole files to find a symbol.** Locate with lumen/sem/ast-grep, then Read the specific lines.
- **Two semantic tools exist (lumen, grepai).** Prefer **lumen** for pure semantic (code-specific embeddings); use grepai when you also want call-graph or a watch daemon — don't run both as your semantic index.

## Language-specific gotchas

Some languages break the naive assumptions of import/reference tooling. When working in one, read its file first:

- **C#** → `languages/csharp.md` (namespace-level `using` breaks import-graph references; use sem)
- **Ruby** → `languages/ruby.md` (dynamic typing makes reference resolution heuristic)

To add a language, drop a `languages/<lang>.md` with: which tools resolve it precisely vs heuristically, the `ast-grep --lang` id, and any runtime/build caveats.
