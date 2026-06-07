# mex (`promexeus`) — TypeScript Markdown File Architecture

## What it is

CLI tool that gives AI coding agents persistent project memory via a structured markdown scaffold (`.mex/`) plus a drift-detection engine that checks whether the documentation still matches reality.

- **Source**: `https://github.com/theDakshJaitly/mex` (~686 stars, 110 commits on main)
- **npm**: `promexeus` (binary `mex`)
- **Lang**: TypeScript ~60%, Shell ~39%, Nix ~1%
- **Install**: `npx promexeus setup`
- **Build**: `tsup` → `dist/cli.js`
- **Test**: `vitest`
- **Position in suite**: orthogonal — it's the **scaffolded markdown documentation** layer; ccmanager's session-start memory comes from memesis, but project-level always-loaded reference comes from `.mex/` files installed by mex. Drift checkers verify the scaffold doesn't go stale.

## Repo layout

```
mex/
├── .github/                CI workflows
├── .mex/                   scaffold template (the output you'd see in a project)
├── .tool-configs/          per-AI-tool config integrations (Claude Code, Cursor, Windsurf, Copilot, OpenCode)
├── context/                example documentation
├── docs/                   setup guides + Vim integration notes
├── patterns/               task-specific pattern examples
├── src/                    TypeScript source — see AST below
├── templates/              scaffold templates used by `setup`
├── test/                   vitest suite
├── CLAUDE.md               main integration file (this is the scaffold's flagship output)
├── package.json
├── tsconfig.json
└── flake.nix               Nix dev shell
```

## AST graph — `src/`

```
src/
├── cli.ts                  ── entry point; commander.js registrations
├── config.ts               ── findConfig() — locate project config
├── git.ts                  ── simple-git wrapper for staleness checks
├── markdown.ts             ── unified + remark-parse + remark-frontmatter + unist-util-visit
├── reporter.ts             ── 4 output formatters: reportConsole / reportQuiet / reportJSON / reportVerbose
├── types.ts                ── shared TypeScript type defs
├── watch.ts                ── manageHook() — install/uninstall git hook
│
├── drift/                  ── DRIFT-DETECTION ENGINE
│   ├── index.ts            ── runDriftCheck() orchestrator
│   ├── claims.ts           ── parse claims (path/edge/dep references) from markdown
│   ├── frontmatter.ts      ── YAML frontmatter parsing for scaffold pages
│   ├── scoring.ts          ── aggregate per-checker scores into health number
│   └── checkers/           ── 9 plug-in checkers (factory pattern):
│       ├── command.ts
│       ├── cross-file.ts
│       ├── dependency.ts
│       ├── edges.ts
│       ├── index-sync.ts
│       ├── path.ts
│       ├── script-coverage.ts
│       ├── staleness.ts
│       └── tool-config-sync.ts
│
├── scanner/                ── `mex init` repo scan — builds initial scaffold
│   └── index.ts            ── runScan()
│
├── setup/                  ── `mex setup` — install scaffold + tool configs
│   └── index.ts            ── runSetup()
│
├── sync/                   ── `mex sync` — reconcile scaffold with current code
│   └── index.ts            ── runSync()
│
└── pattern/                ── `mex pattern add <name>` — append task-specific pattern doc
    └── index.ts            ── runPatternAdd()
```

## Dependencies (production)

```json
{
  "chalk": "^5.4.1",
  "commander": "^13.1.0",
  "glob": "^11.0.1",
  "remark-frontmatter": "^5.0.0",
  "remark-parse": "^11.0.0",
  "simple-git": "^3.27.0",
  "unified": "^11.0.5",
  "unist-util-visit": "^5.0.0",
  "yaml": "^2.7.0"
}
```

Tight, modern, modular. unified ecosystem (remark + unist) for markdown AST work; commander for CLI; simple-git for staleness; yaml for frontmatter. No framework, no transpiler magic, no async runtime. Native `tsup` build.

## Hot-path architecture

```
$ mex check
   │
   ├─ cli.ts: commander parses argv → resolves subcommand
   │
   ├─ config.ts: findConfig() — walks up from cwd to locate .mex/
   │
   ├─ drift/index.ts: runDriftCheck()
   │   │
   │   ├─ load all .mex/*.md files
   │   ├─ markdown.ts:
   │   │     parse via unified.use(remarkParse).use(remarkFrontmatter)
   │   │     visit AST via unist-util-visit to extract claims
   │   │
   │   ├─ frontmatter.ts: extract YAML metadata
   │   ├─ claims.ts: collect path/edge/dep references claimed in docs
   │   │
   │   ├─ FOR EACH checker in drift/checkers/*.ts:
   │   │     load checker module, call .check(claims, repoState)
   │   │     return findings (severity, location, message, fix-suggestion)
   │   │
   │   ├─ scoring.ts: aggregate findings → health score
   │   └─ git.ts: simple-git for staleness diffs
   │
   └─ reporter.ts: switch on flag → reportConsole | reportQuiet | reportJSON | reportVerbose
```

Single-shot. No daemon. No port. Persists nothing per run — drift state is recomputed each invocation against the live repo.

## Commands exposed

| Command | Handler | Flags |
|---|---|---|
| `mex setup` | `setup/index.ts → runSetup()` | `--dry-run` |
| `mex check` | `drift/index.ts → runDriftCheck()` | `--json`, `--quiet`, `--fix`, `--verbose`, staleness thresholds |
| `mex init` | `scanner/index.ts → runScan()` | `--json` |
| `mex sync` | `sync/index.ts → runSync()` | `--dry-run`, `--warnings` |
| `mex pattern add <name>` | `pattern/index.ts → runPatternAdd()` | — |
| `mex watch` | `watch.ts → manageHook()` | `--uninstall` |
| `mex commands` | (lists all) | — |

## The 9 drift checkers (the standout design)

Each checker lives in its own file under `drift/checkers/`. Each is a small module exporting a `check()` function. Adding a new check = drop a new `.ts` file. No central if/else dispatch, no register-this-checker boilerplate beyond the `index.ts` glob.

| Checker | What it verifies |
|---|---|
| `path.ts` | file paths claimed in docs still exist in repo |
| `edges.ts` | claimed import/dependency edges between files match real `import` graph |
| `staleness.ts` | last edit time of doc vs last edit time of code it describes (uses `simple-git`) |
| `dependency.ts` | claimed package deps match `package.json` / `Cargo.toml` / `requirements.txt` |
| `command.ts` | claimed CLI commands still resolve (binary in PATH or in scripts) |
| `cross-file.ts` | doc-A says X, doc-B says Y about same thing — flag inconsistencies |
| `index-sync.ts` | scaffold's index file lists all real scaffold pages |
| `script-coverage.ts` | every `package.json` script is documented somewhere in scaffold |
| `tool-config-sync.ts` | `.tool-configs/*` matches what AI tool configs expect |

This is the same **per-variant declarative module** pattern as RTK's `filters/*.toml` — just expressed in TypeScript modules instead of TOML files. Same win: contributor friction is low (one file per concern), and the dispatcher stays simple.

## Notable patterns worth stealing

### 1. unified + remark + unist-util-visit for markdown AST work

If your code parses markdown, do not regex it. The `unified` pipeline is the right answer:

```ts
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import { visit } from 'unist-util-visit'

const tree = unified().use(remarkParse).use(remarkFrontmatter).parse(source)
visit(tree, 'link', (node) => { /* every link */ })
visit(tree, 'code', (node) => { /* every code block */ })
```

mex uses this in `markdown.ts` and `drift/claims.ts` to extract the path/edge/command claims it then verifies. Any tool that reads structured info out of markdown should follow this shape — including ccmanager's planned wave 7 Consolidation Studio if you want to render rationale text with embedded references.

### 2. Plug-in checker modules in `drift/checkers/`

9 separate files, each exports `check()`, scored together. Mirror this for ccmanager's interceptor pipeline: each interceptor a file, registered by glob, central orchestrator stays trivial. Already partially in place via `INTERCEPTOR_FACTORIES` map in `apps/proxy/src/server.js`, but glob-based auto-discovery would eliminate the manual registration.

### 3. Reporters split by output format, not by command

`reportConsole / reportQuiet / reportJSON / reportVerbose` are 4 functions, all consume the same finding shape, all swap by flag. Compare to embedding `if (json) ... else ...` inside command handlers. The mex split keeps command handlers free of formatting concerns. Apply anywhere ccmanager has multi-format output (e.g., dashboard JSON vs SSE event vs log line).

### 4. Drift via claims-vs-reality parser

Rather than ad-hoc lint rules, mex extracts every **claim** ("this doc says path X exists") into a uniform structure and then asks each checker "is this claim still true?" The data model unifies otherwise-disparate checks. Worth borrowing for any "verify scaffold matches reality" surface — including ccmanager's potential wave 7 acceptance verifier (similar to `.context/ACCEPTANCE-observer-mvp.md`).

### 5. Frontmatter-as-metadata for scaffold pages

YAML frontmatter on each `.mex/*.md` carries machine-readable metadata (claimed paths, owners, freshness rules). Body is human-readable prose. Same page serves both audiences. Same pattern as memesis `consolidation_log.rationale` (machine `action` + human prose) and Headroom's `PERF` line (machine kv) + `STAGE_TIMINGS` (machine JSON) on adjacent log lines.

## Why TypeScript fits mex

| Constraint | Why TS wins over Rust/Python |
|---|---|
| Markdown AST tooling | unified ecosystem is npm-native and battle-tested; Rust equivalents are less mature |
| Per-invocation use | tsup-built `dist/cli.js` cold-starts in tens of ms — fine, since mex isn't hot-pathed like RTK |
| AI-tool integration | every AI coding agent (Claude Code, Cursor, Windsurf, Copilot) has TypeScript-friendly config formats and hooks |
| Contributor base | the agent-coding-tools community lives in TS and Python; PRs flow easier |
| Type-safe markdown trees | unist node types are extensively typed; mex can let TS catch malformed AST handling |

If mex were Rust, it would beat the cold-start time but lose unified+remark, which is the heart of how it works. Right tool for the job.

## How ccmanager (Observer) integrates mex

mex is **not** currently integrated into Observer's adapter layer — it's a sibling-class tool but operates on the file system rather than emitting on-disk metrics like RTK or Headroom. Possible future integrations:

- Read `.mex/` scaffold pages from any project Observer knows about and surface drift health on the dashboard
- Subscribe to `mex check --json` output in the Knowledge surface
- Use mex's claims structure to build the Observer Knowledge graph more reliably than raw repomix output
- Adopt mex's drift checker pattern as the model for ccmanager's own acceptance/audit subsystem (Wave 8+ candidate)

For now: cite mex when designing any Observer feature that does "scaffold + drift verify"; copy its checker plug-in shape; do not yet wire it as a feed.

## Pitfalls when integrating mex

- **`.mex/` location**: walks up from cwd; respect that boundary — don't cache claim data across project switches.
- **Scaffold version drift**: `mex setup --dry-run` first; the scaffold version embedded in `templates/` evolves and `mex sync` may rewrite pages.
- **Checker output schema**: not yet exposed as a public TS type — pinning on it from outside requires reading `src/types.ts` at the version you depend on.
- **`mex` vs `npx promexeus`**: binary name `mex` collides with the `mex` (Math Editor for X) package on some systems. Prefer `npx promexeus` in scripts.
