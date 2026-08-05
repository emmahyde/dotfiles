# C# investigation gotchas

## The core trap: import-graph "references" don't work on C#

C# imports **namespaces** (`using Sector.Engine.Generation;`), not individual symbols. Any tool that builds its reference/call graph from *per-symbol import edges* therefore finds **nothing** on C# — it returns 0 callers/references even for heavily-used symbols, and silently (an empty result, not an error).

Verified failure mode: `GameStartGenerator` instantiates `CrewStartGenerator` (`new CrewStartGenerator()`), yet an import-graph "find references" reports **0**. A plain text search finds it instantly. Tools relying on dead-code / blast-radius built this way will also produce **false positives** (flagging used code as dead).

**Do not** rely on import-graph reference/call/blast-radius/dead-code analysis for C#.

## What to use instead (all verified on C#)

| Need | Command | Notes |
|---|---|---|
| Impact / blast radius (what breaks if X changes) | `sem impact <Entity>` | Transitive, includes affected tests. Resolves by `module::class::method` — disambiguates overloads (`sem impact Generate` lists all 16 and asks you to pick via `--file`/`--entity-id`). Also surfaces direct dependents (callers). |
| Structural pattern / lint / rewrite | `ast-grep run --lang csharp --pattern '<pat>'` | `--lang csharp`. Pattern must be a *complete* AST node — `catch { }` alone fails ("multiple AST nodes"); use `try { $$$ } catch ($_) { }` or a YAML rule. Verified: `new $T()` matches object creations. |
| Complexity / gnarly functions | `lizard -w <path>` | Cyclomatic complexity. C#-aware. e.g. flags `TryParse`/`Deserialize` loaders at CCN 30+. |
| Entity diff / blame / history | `sem diff` / `sem blame` / `sem log <Entity>` | Per-entity, not per-file. |

## Runtime trace → code (if you need it)

Mapping runtime spans to symbols works on C# **only via OpenTelemetry**, not log-scraping (stack-trace parsers typically handle Python/JVM/Node formats, not .NET). To produce traces: instrument with the **OpenTelemetry .NET SDK** + a file/OTLP exporter, emitting `code.filepath` / `code.lineno` / `code.function` span attributes. Then an OTel-aware mapper joins them to indexed symbols by (file, line, function).

## Quick reference

- `ast-grep --lang csharp` — structural search/rewrite
- `sem impact <Entity>` — precise transitive impact (the C# blast-radius answer)
- `lizard -w` — complexity offenders
- For an *exact* symbol name you already know, `rg` is still fastest.
