# Ruby investigation gotchas

## The core trap: reference resolution is heuristic, not semantic

Ruby is **dynamically typed** — there is no static answer to "which method does `x.foo` call?" without running the code. Tools built on Prism / tree-sitter parse the *syntax* perfectly (method defs, calls, constants, modules, blocks) but **cannot semantically resolve** which definition a call targets. So call-graph / impact / "find references" results on Ruby are **name-and-receiver heuristics**: high recall, real false-positive risk on common method names (`call`, `run`, `process`, `each`).

Treat Ruby relationship results as *candidates to verify*, not ground truth — the inverse of the trust level you'd give them on a statically-typed language.

## What to use (and how much to trust it)

| Need | Command | Trust on Ruby |
|---|---|---|
| Structural pattern / lint / rewrite | `ast-grep run --lang ruby --pattern '<pat>'` | High (pure syntax — its strength) |
| Impact / who-uses | `sem impact <Entity>` | Medium — name-based; verify the edges |
| Complexity | `lizard -w <path>` | High (Ruby-aware) |
| Entity diff / blame / history | `sem diff` / `sem blame` / `sem log` | High (git-derived, language-agnostic) |

## When you need precision

Heuristic resolution is the ceiling for plain Ruby. To get closer to semantic accuracy:

- **Sorbet** — on code with `# typed:` sigils, gives real type-aware resolution. Only as good as the annotation coverage.
- **ruby-lsp** (Prism-based) — indexes defs/refs with better heuristics + workspace awareness; useful as a second opinion.

Default to **ast-grep for structure** and **sem for relationships** on Ruby, and reach for Sorbet/ruby-lsp only when a relationship answer must be exact.

## Quick reference

- `ast-grep --lang ruby` — structural search/rewrite (most reliable structural tool here)
- `sem impact` — relationships, but **verify** the edges
- `lizard -w` — complexity offenders
