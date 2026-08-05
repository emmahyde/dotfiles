---
name: codebase-investigation
description: Route codebase exploration to the right code-intelligence tool instead of defaulting to grep/Read/Glob. Use when finding where something is implemented, tracing what calls or breaks if a symbol changes, searching structural code patterns, or assessing complexity — in any repo. Covers sem (impact/diff/blame), ast-grep (structural patterns), lizard (complexity). Read languages/<lang>.md for language-specific gotchas (csharp, ruby).
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
| Impact: what breaks / who depends on X, transitively (+ affected tests) | **sem** `sem impact X` | grep, import-graph "references" |
| Structural pattern / lint / codemod (all `catch {}`, all `new T()`, rewrites) | **ast-grep** `ast-grep run -l <lang> -p '<pat>'` | grep (can't match nested structure) |
| Exact known string / symbol / error message | `rg` | the tools above (overkill) |
| Read a file/region you've already located | `Read` | reading whole files to hunt |
| Complexity — find the gnarly functions | **lizard** `lizard -w <path>` | eyeballing |
| Who changed an entity / its history / a semantic diff | **sem** `sem blame` / `sem log` / `sem diff` | raw `git log` (file-coarse) |
| Runtime hot-paths — what actually runs in prod (opt-in) | **jcodemunch** (re-add `uvx jcodemunch-mcp`), after OTel instrumentation | guessing from source |
| Verify an external library/package API — what it actually does/returns | **ctx7** `ctx7 library <name>` → `ctx7 docs <id> "<q>"` | assuming from memory |

Worked example for each axis: **`resources/scenarios.md`** (naive grep/Read vs. the right tool, plus how to chain them).
Exact call signatures (JSON tool-schema format) for every tool: **`resources/tool-apis.md`**.

## What each tool owns

- **sem** (CLI `sem`) — entity-level **impact / diff / blame / history / context**. Resolves entities by qualified id (`module::class::method`), so it disambiguates overloads and gives *transitive* blast radius. No setup; works in any git repo.
- **ast-grep** (CLI `ast-grep`) — **structural** search, lint, and codemod over the AST. The only tool here that can match *shape* (e.g. empty catch, a specific call pattern) and rewrite it. Invoke as `ast-grep`, never `sg`.
- **lizard** (CLI `lizard`, or `uvx lizard`) — cyclomatic complexity per function; `-w` shows only over-threshold offenders. Stateless, multi-language.
- **ctx7** (CLI `ctx7`) — up-to-date docs for external libraries/packages. `ctx7 library <name>` resolves a Context7 library id, then `ctx7 docs <id> "<query>"` returns current API docs. Use to verify an external API before relying on it.
- **jcodemunch** (MCP, *opt-in* — `uvx jcodemunch-mcp`) — **runtime-trace → code** mapping (OTel spans → symbols, hot-path p50/p95). Not installed by default; add it only when you've instrumented OpenTelemetry. (Its static graph/reference tools are unreliable on namespace-import languages — prefer sem/ast-grep for those.)

## First-time installation (one-time, per machine)

All tools install globally. Run these once on a fresh machine:

```bash
# sem — entity-level impact/diff/blame (brew)
brew install sem

# ast-grep — structural AST search/lint/codemod (brew)
brew install ast-grep

# ctx7 — external library docs (brew)
brew install ctx7

# lizard — cyclomatic complexity (no global install; run via uvx)
# e.g. uvx lizard -w <path>
```

## Per-repo setup

- **sem / ast-grep / lizard** — **no setup**, run directly in any repo.
- **ctx7** — no per-repo setup; query directly with `ctx7 library <name>`.

## Anti-patterns

- **Never assume functionality without source verification.** Confirm external library/API behavior with `ctx7` (and the package source); confirm internal behavior by reading the real definition via these tools. Names, signatures, and memory are not evidence.
- **Don't grep to *understand*.** Text search finds strings, not concepts or structure. Use sem for relationships.
- **Don't trust import-graph "find references" in namespace-import languages.** They silently under-report. Use `sem impact` / `ast-grep`. See `languages/csharp.md`.
- **Don't Read whole files to find a symbol.** Locate with sem/ast-grep, then Read the specific lines.

## Language-specific gotchas

Some languages break the naive assumptions of import/reference tooling. When working in one, read its file first:

- **C#** → `languages/csharp.md` (namespace-level `using` breaks import-graph references; use sem)
- **Ruby** → `languages/ruby.md` (dynamic typing makes reference resolution heuristic)

To add a language, drop a `languages/<lang>.md` with: which tools resolve it precisely vs heuristically, the `ast-grep --lang` id, and any runtime/build caveats.
