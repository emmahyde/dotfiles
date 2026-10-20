---
name: ruby-lsp-tooling
description: "Use when the user mentions Ruby LSP, ruby-lsp, Solargraph, Rails language server, Ruby editor intelligence, type checking Ruby code, configuring LSP for Ruby projects, or asks to debug/setup Ruby editor tooling."
---

# Ruby LSP Ecosystem: ruby-lsp, ruby-lsp-rails, Solargraph

Three complementary tools for Ruby editor intelligence. Prefer `ruby-lsp` for modern projects; reach for `solargraph` when static type checking or YARD doc generation is needed. The tools can coexist.

---

## Tool Comparison

| | ruby-lsp | solargraph |
|---|---|---|
| Parser | Prism (C, official) | Parser gem + YARD |
| Index | Static (no code load) | AST + YARD tags |
| Type checking | None (external) | Built-in (4 levels) |
| Rails support | `ruby-lsp-rails` addon (runtime) | `solargraph-rails` plugin |
| Gem docs | Lazy, on-demand | `solargraph gems` pre-cache |
| Config | Editor `initializationOptions` | `.solargraph.yml` |
| Add-on system | Yes (dynamic listeners) | Yes (plugins/extensions) |
| Startup | Composed bundle + launch | Single process |
| Version | 0.24+ (active) | 0.52+ (mature) |

---

## ruby-lsp (Shopify ~2,000 stars)

Modern, opinionated LSP server. Prism parser avoids loading application code. Composed bundle isolates tooling dependencies in `.ruby-lsp/Gemfile`.

### Installation
```ruby
# Gemfile — group :development
gem "ruby-lsp", "~> 0.24", require: false, group: :development
```

### CLI
```bash
ruby-lsp                          # Launch server (stdio)
ruby-lsp --version                # Print version
ruby-lsp --debug                  # Launch with debugger attached
ruby-lsp --time-index             # Benchmark indexing
ruby-lsp --doctor                 # Diagnostic checks on indexable globs
```

**Invariant**: Run through the project's version manager so Bundler resolves correctly:
```bash
mise x -- ruby-lsp --doctor
# or
bundle exec ruby-lsp --doctor
```

### Configuration
Configured via editor LSP client `initializationOptions` (JSON), not a project file:

```json
{
  "initializationOptions": {
    "enabledFeatures": {
      "codeActions": true,
      "codeLens": true,
      "completion": true,
      "definition": true,
      "diagnostics": true,
      "documentHighlights": true,
      "documentLink": true,
      "documentSymbols": true,
      "foldingRanges": true,
      "formatting": true,
      "hover": true,
      "inlayHint": true,
      "onTypeFormatting": true,
      "selectionRanges": true,
      "semanticHighlighting": true,
      "signatureHelp": true,
      "typeHierarchy": true,
      "workspaceSymbol": true
    },
    "featuresConfiguration": {
      "inlayHint": {
        "implicitHashValue": true,
        "implicitRescue": true
      }
    },
    "indexing": {
      "excludedPatterns": ["**/spec/**"],
      "includedPatterns": [],
      "excludedGems": [],
      "excludedMagicComments": ["compiled:true"]
    },
    "formatter": "auto",
    "linters": [],
    "addonSettings": {
      "Ruby LSP Rails": {
        "enablePendingMigrationsPrompt": false
      }
    },
    "experimentalFeaturesEnabled": false
  }
}
```

**Key settings for agent use**:
- `indexing.excludedPatterns`: Add `**/spec/**`, `**/test/**` to reduce index time in large projects.
- `formatter`: `"auto"` detects RuboCop → Standard → Syntax Tree. Set explicitly when ambiguous.
- `linters`: Array of linter names to run for diagnostics (e.g. `["rubocop"]`).
- `.ruby-lsp/Gemfile`: Auto-generated; never commit; add `.ruby-lsp/` to `.gitignore`.

### Custom LSP Methods
- `rubyLsp/workspace/dependencies` — list project gem dependencies with local paths.
- `rubyLsp/ancestorsHierarchy` — inspect class/module inheritance chain.
- `rubyLsp/discoverTests` — discover test suites and cases.

### Agent Patterns
- **Index verification**: Run `ruby-lsp --doctor` after large refactors to confirm the indexer can parse all files.
- **Diagnostic capture**: Pull diagnostics via `textDocument/diagnostic` instead of shelling out to RuboCop separately.
- **Symbol resolution**: Use `workspace/symbol` over `grep` for constant/class lookups across workspace + gems.

---

## ruby-lsp-rails (Shopify ~688 stars)

Add-on that pairs Prism static analysis with runtime Rails introspection via `rails runner`.

### Architecture
```
Ruby LSP → Addon.activate → RunnerClient.spawn
                                    ↓
                    bin/rails runner server.rb start
                    (Content-Length framed JSON-RPC over pipes)
                                    ↓
                    stdin/stdout: model schemas, routes, I18n
                    stderr:       LSP notifications
```

### Features
| Feature | How |
|---|---|
| **Model schema hover** | Hover on `User` → columns, types, PK/FK, nullability, indexes |
| **Route → definition** | `users_path` → jumps to `config/routes.rb` line |
| **Controller → view** | CodeLens above action links to `app/views/` template |
| **DSL go-to-def** | `before_action :set_user` → definition of `set_user` |
| **Association target** | `belongs_to :user` → `User` model |
| **Column completion** | `User.where(|` → schema column names |
| **I18n hover** | `t(".greeting")` → YAML values across locales |
| **Migration runner** | CodeLens to run pending migrations |

### Agent Patterns
- **Schema inspection without `db/schema.rb` parse**: Hover or query `model` method on RunnerClient.
- **Route audit**: Walk controller action CodeLens entries to verify route bindings.
- **I18n coverage**: Hover over `t()` calls to verify translation key existence across locale files.
- **Activation check**: Confirm `bin/rails` exists in workspace root; Rails add-on auto-activates.

---

## Solargraph (castwide ~2,000 stars)

Comprehensive Ruby language server with built-in static type checking, YARD documentation generation, and gem documentation caching.

### Installation
```ruby
# Gemfile — group :development
gem "solargraph", group: :development
# Optional extensions
gem "solargraph-rails", group: :development
gem "solargraph-rspec", group: :development
```

### CLI
```bash
solargraph stdio                     # Start LSP server (default)
solargraph socket --port 7658        # Start on TCP socket
solargraph config                    # Generate .solargraph.yml
solargraph typecheck [FILES...]      # Static type checking
solargraph typecheck --level strict .  # Strict mode on whole project
solargraph scan                      # Test workspace parsing
solargraph gems --rebuild            # Pre-cache core/stdlib/gem docs
solargraph reporters                 # List available diagnostic reporters
solargraph clear                     # Clear documentation cache
```

### Configuration (`.solargraph.yml` at project root)
```yaml
include:
  - "**/*.rb"
  - "Rakefile"
  - "Gemfile"
exclude:
  - spec/**/*
  - test/**/*
  - vendor/**/*
  - .bundle/**/*
require: []
require_paths: []
domains: []
reporters:
  - rubocop
  - require_not_found
formatter:
  rubocop:
    cops: safe
    except: []
    only: []
    extra_args: []
plugins: []
max_files: 5000
```

### Type Checking Levels
| Level | What it checks |
|---|---|
| `normal` | Basic type inference, no strict annotations required |
| `typed` | Files with `# typed:` comment are checked |
| `strict` | All files checked; missing types are errors |
| `strong` | Full type soundness; every method needs type annotation |

### Custom LSP Methods (`$/solargraph/*`)
- `$/solargraph/document` — HTML/markdown docs for a symbol.
- `$/solargraph/search` — Search docs across workspace + gems.
- `$/solargraph/documentGems` — Background gem doc build.
- `$/solargraph/downloadCore` — Download Ruby core docs.
- `$/solargraph/environment` — Report config/environment status.
- `$/solargraph/checkGemVersion` — Check for newer gem versions.

### Agent Patterns
- **Type checking**: `bundle exec solargraph typecheck --level strict <file>` returns line-by-line type errors.
- **Config bootstrap**: `bundle exec solargraph config` generates a default `.solargraph.yml`.
- **Gem doc pre-warming**: `bundle exec solargraph gems --rebuild` populates the doc cache so completions work immediately.
- **Doc cache location**: `~/.cache/solargraph/` — clear with `solargraph clear` if completions show stale types.

---

## Diagnostic Recipes

### "Ruby LSP isn't starting"
```bash
# 1. Check Ruby version matches project
ruby --version && cat .ruby-version

# 2. Run doctor
bundle exec ruby-lsp --doctor

# 3. Check composed bundle
ls -la .ruby-lsp/Gemfile .ruby-lsp/Gemfile.lock

# 4. Regenerate composed bundle
rm -rf .ruby-lsp && bundle exec ruby-lsp --version
```

### "Solargraph completions are wrong or missing"
```bash
# 1. Clear cache and rebuild
solargraph clear
bundle exec solargraph gems --rebuild

# 2. Verify config
bundle exec solargraph config

# 3. Scan for parse errors
bundle exec solargraph scan --verbose
```

### "Can't find Rails routes/associations in editor"
- Verify `ruby-lsp-rails` is in Gemfile (not just installed globally).
- Check `bin/rails` exists in workspace root.
- Restart LSP after `db/schema.rb` changes.
- Check `addonSettings["Ruby LSP Rails"]` in editor config.

---

## Editor Integration Quick Reference

### Neovim (lspconfig)
```lua
require("lspconfig").ruby_lsp.setup({
  init_options = { -- initializationOptions here },
})
```

### VS Code
Install `shopify.ruby-lsp` extension. Settings in `.vscode/settings.json` under `"rubyLsp.*"` keys.

### Helix
```toml
[[language]]
name = "ruby"
language-servers = ["ruby-lsp"]
[language-server.ruby-lsp]
command = "mise"
args = ["x", "--", "ruby-lsp"]
```

### Zed
Built-in Ruby LSP support. Settings: `"lsp": { "ruby-lsp": { "initialization_options": { ... } } }`.

---

## Omnicontext Lens — Cross-Pollination

Ruby LSP tools are **editor-facing** — they serve a human at an IDE with completions, hover, go-to-definition. Omnicontext is **agent-facing** — it serves an LLM with persistent, temporally-provenanced context across sessions. The design patterns transfer in both directions.

### What Omnicontext Already Does That Mirrors ruby-lsp

| ruby-lsp pattern | Omnicontext equivalent |
|---|---|
| **Prism dispatcher** — fine-grained AST node events (`on_class_node_enter`, `on_call_node_enter`) | Tree-sitter workers (`treesitter_worker.py`) parse source into `SymbolRecord`/`RelationRecord`/`ReferenceRecord` with line-byte spans |
| **RubyIndexer** — static indexing without loading application code | `parser_relation` + `parser_reference` tables built entirely from tree-sitter AST, no code execution |
| **Runtime + static hybrid** (ruby-lsp-rails spawns `rails runner`) | `_scenario_symbol_pack` in `query.py` spawns out-of-process semantic workers (`parsers/workers.py`) for Ruby ancestry resolution at query time, falling back to static `parser_relation` walk |
| **Add-on lifecycle** (activate/deactivate/workspace_did_change_watched_files) | `registry.py` — worker registry maps language → `SemanticWorker`; workers are lazily spawned, cached in `_WORKERS` dict, cleaned up via `atexit` |
| **Composed bundle** (`.ruby-lsp/Gemfile` isolates tooling deps) | `pyproject.toml` `[project.optional-dependencies] dev` + `uv` managed venv — Omnicontext runs from its own venv, never pollutes the project being indexed |

### Where ruby-lsp Is Ahead — Patterns Omnicontext Should Adopt

1. **Formal add-on lifecycle hooks**: ruby-lsp's `Addon.activate` / `deactivate` / `workspace_did_change_watched_files` is a clean contract. Omnicontext's worker spawning (`worker_for("ruby", root=...)` → `worker.call(...)`) is ad-hoc — no deactivate, no watched-file change notification, no settings-per-worker. A formal `ParserAddon` base class with lifecycle hooks would make the parser registry extensible without touching core.

2. **Content-Length framed JSON-RPC pipe protocol**: ruby-lsp-rails communicates with its Rails runner daemon over `Content-Length: N\r\n\r\n{json}` framed stdio. Omnicontext's semantic workers use raw JSONL — fragile on partial writes, no framing, no request/response correlation. The framed protocol survives buffer boundaries and enables concurrent multiplexed requests.

3. **Prism's per-node-type listener registration**: Each AST node type has a dedicated callback (`on_class_node_enter`, `on_def_node_enter`). Omnicontext's tree-sitter integration uses a monolithic `_index_symbols` function that walks children manually. Decomposing into typed callbacks would let parser add-ons register interest in specific node kinds without understanding the whole grammar.

4. **Gem-level resolution in the indexer**: The `RubyIndexer` resolves constants and methods across installed gems. Omnicontext's symbol index is workspace-scoped — it doesn't index gem source. For Ruby projects, gem-level resolution would answer "where is this Rails method defined" without grepping `vendor/bundle`.

### Where Omnicontext Is Ahead — The Innovation Gap

These are the patterns that make Omnicontext genuinely novel compared to any existing LSP tool:

1. **Temporal provenance on every entity**: ruby-lsp answers "what is this symbol *right now*." Omnicontext answers "what was this symbol when commit `c1a2b3` landed, who discussed it in session `01a0...`, and what did `STATE.md` say at that time." Every entity links back to source events with millisecond timestamps; every edge carries `observed_at_ms`. The `evidence_tier` system (causal > structural > derived > temporal) ranks answers by proof quality.

2. **Cross-domain fusion in a single query**: `run_query("Animal#speak")` returns definition + ancestry + inheritors + references + recent commits — fused from `symbol_identity`, `parser_relation`, `parser_reference`, `event_fts`, and `entity_fts`, ordered by evidence tier, capped at 1,200 tokens. An LSP hover returns a docstring.

3. **Agent session as a first-class entity**: Sessions, turns, messages, tool calls, tool results are all indexed entities with causal edges. ruby-lsp has no concept of "what was happening when this code was written." Omnicontext can answer "show me the discussion that led to this function existing."

4. **Evidence-backed edges with confidence**: `edge` rows carry `confidence` (0–1), `edge_class` (causal/structural/derived), and `provenance_event_id`. A structural edge ("this file tests that file") carries different weight than a causal edge ("this commit introduced this symbol"). No LSP has an edge provenance model.

5. **Reciprocal-rank fusion over heterogeneous channels**: `_free_items` in `query.py` merges FTS5 BM25 hits, MLX vector similarity, and wiki-tree matches via RRF (`k=60`), then deduplicates by `(entity_id, revision_id)`. Each channel can degrade independently — a missing MLX model never blocks FTS5.

### Architectural Analogy

```
ruby-lsp : IDE          = Omnicontext : Agent
Prism    : Ruby AST     = Tree-sitter : polyglot AST
LSP      : editor API   = MCP + CLI  : agent API  
Add-on   : listener     = Worker     : semantic parser
Indexer  : current code = Index      : code + sessions + git + wiki + state
Hover    : docstring    = Pack       : definition + ancestry + refs + commits + discussion
```

The key insight: **ruby-lsp optimizes for instant feedback to a human reading code. Omnicontext optimizes for rich, temporally-grounded retrieval for an LLM that has no memory of the project.** The LSP pattern is "answer one question about one symbol right now." The Omnicontext pattern is "given 1,200 tokens, what is the most load-bearing context about this thing, ranked by evidence quality, spanning every domain we track."
