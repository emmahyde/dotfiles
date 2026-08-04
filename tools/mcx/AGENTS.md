# mcx

Standalone Go CLI. Two jobs, one binary — **it is an MCP *client*, never an MCP server**:

1. **forward** — call a tool on any external MCP server discovered from Claude Code config,
   injecting macOS-keychain OAuth bearer tokens (refreshing when expired).
2. **run/register/list/remove** — execute ad-hoc scripts without registration, or manage a durable local store of named scripts.

Shipped examples use the neutral MCP aliases `jira`, `notion`, `slack`, `gdocs`, and `gsheets`.
Full MCP tool keys follow `mcp__<alias>__<tool>`.

## Language / Tooling

- Go, module `github.com/emmahyde/dotfiles/tools/mcx`. Build: `go build -o bin/mcx ./cmd/mcx`.
- Test: `go test ./...`  ·  Vet: `go vet ./...`.
- MCP transport via `github.com/modelcontextprotocol/go-sdk` **pinned v1.6.1**. Do not float it
  to `@latest`; the API drifts.
- No CGO, no external services. Keychain access shells out to `/usr/bin/security` (macOS only).

## Layout

- `cmd/mcx/main.go` — CLI dispatch (forward / register / list / run / remove / filter / nudge / observe / scan / sync-connectors).
- `internal/mcpclient/` — server discovery (`resolve.go`), transport + header injection
  (`transport.go`), one-shot connect/call (`call.go`).
- `internal/keychain/` — keychain-backed OAuth: parse (`creds.go`), platform read/write
  (`keychain_darwin.go` + `keychain_other.go` stub), RFC 8414 discovery + refresh + write-back
  (`refresh.go`), config dir (`config.go`).
- `internal/registry/` — durable script store (`store.go`) + execution (`run.go`).
- `internal/executor/` — sandboxed runtimes (shell/python/js/ruby).
- `internal/filters/` — declarative JSON filter engine for the `filter` command: transform
  (`transform.go`), envelope unwrap/rewrap (`envelope.go`), precedence config (`config.go`),
  hook-payload glue (`run.go`). Pure data, no sandbox, no forward.
- `internal/nudge/` — fan-out detection + additionalContext message for the `nudge` command.
- `internal/observe/` — per-session tally + reminder text for the `observe` command (repeated-call →
  chain, bloated-result → filter). Pure logic; the command in `main.go` does the I/O + state file.
- `internal/scan/` — transcript (JSONL) analysis for the `scan` command: repeated MCP tools (chain
  candidates) + large unfiltered results (filter candidates). Reuses `observe`'s thresholds.
- `internal/connectors/` — plan/sync of shipped default connectors (`url_configs.yml`) into
  `~/.claude.json`'s `mcpServers` for the `sync-connectors` command. Pure config plumbing, no
  credentials.
- `internal/skillsync/` — reconciles `~/.claude/skills` against every resolved chain so each is
  invocable as `/<chain-name>`, called from `register`/`remove`.

## Plugin

This repo is also a Claude Code plugin. Plugin files live at repo root alongside the Go module:
`.claude-plugin/plugin.json`, `hooks/hooks.json` (PostToolUse→`mcx filter` + `mcx observe`, UserPromptSubmit→`mcx nudge`),
`skills/mcx` + `skills/new` + `skills/save`, `commands/setup.md` (the `/setup` command), `filters.yml` (shipped filter defaults), `chains.yml` (shipped default chains), and `scripts/mcx` (the built binary the hooks invoke via
`${CLAUDE_PLUGIN_ROOT}`). Rebuild it with `go build -trimpath -o scripts/mcx ./cmd/mcx`.

## Connecting knowledge to what you'll encounter

When you touch a piece of this code, the non-obvious facts behind it:

### Keychain OAuth (`internal/keychain/`)
- Claude Code stores MCP OAuth creds in **one** keychain generic-password item named
  `Claude Code-credentials` (constant `keychain.Service`). Read: `security find-generic-password
  -s "Claude Code-credentials" -w`. The read is non-interactive for the same user (no GUI prompt).
- Payload is JSON: top-level `mcpOAuth` map keyed `<serverName>|<hash>`, plus **sibling keys**
  (`claudeAiOauth`, `designOauth`) that are unrelated and must be preserved on write-back.
  Match servers on the `serverName` **field**, never the composite key.
- **`expiresAt` is epoch milliseconds** (e.g. `1783996282554`), not seconds. Compare with
  `time.Now().UnixMilli()`. (A naive reference treats it as seconds, so its expiry check is
  effectively always-false and it never refreshes until a real 401 — `mcx` does it correctly.)
- **Refresh does NOT read a stored token endpoint.** The real `discoveryState` only carries
  `authorizationServerUrl`/`resourceMetadataUrl`/`oauthMetadataFound` — there is no
  `token_endpoint` field. `refresh.go` rediscovers it via RFC 8414:
  `GET {origin}/.well-known/oauth-authorization-server` (falling back to `openid-configuration`).
- **Write-back is read-modify-write of the whole blob** (`persistLocked`): re-read, replace only
  the one entry's changed fields, keep every other top-level key and every other `mcpOAuth` entry.
  A partial write would clobber other servers' credentials. Guarded by a per-service `flock`
  (`withServiceLock`) so concurrent `mcx` runs can't both spend a rotating refresh token.
- `mcx` deliberately omits the browser PKCE re-auth flow: on refresh failure it errors and tells the
  user to re-authenticate in Claude Code.

### Forward (`cmd/mcx/main.go` `injectAuth`, `internal/mcpclient/`)
- Server discovery precedence lives in `resolve.go` (`<cwd>/.mcp.json` → `~/.claude.json`
  project/global/other → `~/.claude/*.json`). Keychain-backed servers appear in config as
  `{"type":"http","url":...}` with **no** auth fields — the token is only in the keychain.
- `injectAuth` only adds a bearer header for HTTP servers with no existing auth header. A server
  with no keychain entry (`keychain.ErrNoCredential`) is left untouched so static-header servers
  still work. Non-macOS returns `errUnsupported`; forward via static headers still works there.

### Registry + executor
- **Chains resolve across three layers merged by name** (`store.go` `layers()`/`resolveAll`):
  plugin (`${CLAUDE_PLUGIN_ROOT}`) → project (`<cwd>/.mcx`) → user (`~/.config/mcx`, honoring
  `XDG_CONFIG_HOME`); most-specific wins. Each layer supplies chains via a `chains.yaml` (keyed by
  name, entry carries inline `source` as a block scalar **or** a `path`; legacy `chains.json` is still
  read via `loadChainsConfig`, which parses YAML — a JSON superset) and/or loose scripts under a
  `chains/` dir (metadata inferred). `register`/`remove` write **only** the user layer; `register`
  stores the source **inline** in `chains.yaml` (no separate script file). Chains use only the baked
  `forward`/`emit` — they never define their own client plumbing. `run` takes args JSON as its first
  positional operand and a runtime, script path, or resolved chain name as its second. A runtime
  means heredoc-fed source: mcx consumes stdin as code, then feeds the first operand to the child
  script's **stdin** (`executor.ExecOptions.Stdin`). Registration is only for explicitly requested
  persistence through `/mcx:save`.
- Chain-name/language/description inference lives in `registry` (`InferName`, `LangFromExt`,
  `DescFromSource`, `InferFromFile`) — shared by `register` and the dir-backed layer loader.
  `DescFromSource` skips shebangs and interpreter pragmas (frozen_string_literal, encoding).
- **The executor strips the environment** to a safe allow-list (`safeEnv`): PATH/HOME/locale only.
  API keys and tokens are NOT forwarded to sandboxed scripts. Don't rely on env for passing data —
  use stdin. `safeEnv` also **prepends the running binary's own directory to PATH** so a chain's
  baked `forward()` (which shells to bare `mcx`) resolves even when mcx runs from the plugin's
  `scripts/` dir, which isn't on the user's PATH.
- `validName` blocks path traversal in tool names (no `/`, `..`); keep it that way.
- Ruby/python/javascript chains get baked `forward()`/`emit()`/`args` (the parsed stdin JSON) via
  `rubyPreamble`/`pythonPreamble`/`jsPreamble` — a chain writes none of that plumbing and never reads
  stdin itself. Shell chains get no preamble (raw JSON on stdin; call `mcx forward` directly).
  The default dynamic form is heredoc-fed `mcx run '{...}' ruby`; path-based
  `mcx run '{...}' ./chain.rb` is also ad hoc. `register` infers name/lang/desc from a file when the user
  explicitly asks `/mcx:save` to persist it (`mcx register ./chain.rb`).

### Skillsync (`internal/skillsync/`)
- Every `mcx register`/`mcx remove` call reconciles **all** resolved chains against
  `~/.claude/skills` — not just the one chain that command touched — so a skill orphaned by an
  earlier removal (e.g. from a different session, or a shipped chain that got renamed) is pruned
  the next time either command runs.
- Skills always land in the user's personal `~/.claude/skills`, never inside a plugin's installed
  cache — that directory is owned by the marketplace installer and gets replaced on every update,
  so anything written there would vanish silently.
- **Never touches a skill it didn't create.** Each generated skill dir carries a sentinel
  `.mcx-managed` file; `Sync` only deletes or overwrites dirs that have one, so a hand-authored
  skill sharing a chain's name is left alone (reported back as `skipped`, not overwritten).
- The generated `SKILL.md`'s frontmatter `description` is the chain's own `Description` field
  verbatim (falling back to a generic line only when the chain has none) — Claude's skill matcher
  triggers on that text, so a chain's registered description doubles as its skill's trigger copy.

### Filters / `mcx filter` (`internal/filters/`)
- **Fail-open is the invariant.** `Run` returns `emit=false` (→ exit 0, no stdout) on any error,
  an unconfigured tool, `MCX_FILTER=off`, or a no-op reshape. It must NEVER emit a partial/empty
  `updatedToolOutput` — that would blank the real tool result.
- **Envelope-preserving.** `ApplyToEnvelope` reshapes only the JSON inside `content[].text` and
  keeps `isError`/`structuredContent`/`_meta` intact, so the value still matches the go-sdk v1.6.1
  `CallToolResult` shape the PostToolUse `updatedToolOutput` field requires.
- Shipped `filters.yml` defaults are **drop-only** and validated against synthetic fixtures such as
  `testdata/captures/getJiraIssue.json`; tests assert that every removed path exists and that signal
  fields remain available. Add a filter only with a matching synthetic fixture.
- Shipped `chains.yml` provides example chains as defaults; all entries point via `path` to
  `chains/` scripts (metadata inferred). The three-layer precedence (plugin → project → user)
  still applies — a user's registered chain overrides a shipped one by name.
- Dotted paths only, **no wildcards** and no array traversal — cruft inside array elements
  (e.g. `fields.components[].self`) is intentionally not filtered.

### Nudge (`internal/nudge/`, `mcx nudge`)
- UserPromptSubmit handler; fires at most **once per session** via a marker file under
  `CLAUDE_PLUGIN_DATA`. Fires when the prompt names "mcx" itself (`MentionsMcx`, a `\bmcx\b` word
  match) — "mcx" is never a typo for something else, so any mention points the model at the
  `/mcx:mcx` skill. Fail-open like filter; `MCX_NUDGE=off` disables it. Live MCP fan-out detection
  lives in `observe` instead (it sees actual calls, not guessed intent from prompt wording).

### Observe (`internal/observe/`, `mcx observe`)
- **Second PostToolUse hook on `mcp__.*`**, run alongside `filter`. Separate on purpose: `filter`
  owns `updatedToolOutput` and must stay strictly fail-open, so the nudging logic lives apart and
  only ever emits `additionalContext` (PostToolUse supports it — verified against the hooks docs).
- Per-session state is a JSON tally in `CLAUDE_PLUGIN_DATA` (`observe-<session>.json`). Two
  independent routing gates: a **batching** gate once the session's total MCP call count (any tool,
  not just repeats of one) reaches `SequentialThreshold` (2) and **no registered chain references
  it** (heuristic: `Tool.Code()` contains the bare tool name) — this repeats on every subsequent
  call; a **cruft** gate, at most once per tool per session, when a result exceeds
  `CruftTokenThreshold` (~800 tokens, estimated as bytes/4) and **no filter is configured** for it.
  Fail-open; `MCX_OBSERVE=off` disables it. Only acts on `mcp__*` tools.

### Scan (`internal/scan/`, `mcx scan`)
- Retrospective counterpart to observe: parses a transcript JSONL (`--transcript`, else the newest
  under `~/.claude/projects/<cwd-slug>/`) and reports chain candidates (every distinct MCP tool
  seen once the transcript's total MCP call count reaches `observe.SequentialThreshold`) and filter
  candidates (large results, no filter). Maps `tool_use.id`→name then measures each
  `tool_result.content`. Driven by the `/setup` command (`commands/setup.md`).

### Sync-connectors (`mcx sync-connectors`, `internal/connectors/`)
- Bridges the plugin's shipped default connectors (canonical local key -> backend URL, in
  `url_configs.yml`) into `~/.claude.json`'s `mcpServers` map. Matching is by **URL only** — display
  names and `claude mcp list` output play no part. `--list` reports the diff without writing; with
  no flag, `Sync` performs the write.
- The write is a read-modify-write of `~/.claude.json`: untouched top-level keys and untouched
  server entries round-trip as raw JSON bytes. If a candidate's URL already exists under a
  different key, that entry is renamed in place rather than duplicated; key collisions receive a
  numeric suffix (`_2`, `_3`, ...).
- Registering a connector's URL locally does **not** carry over claude.ai-side auth. `/setup` tells
  the user to re-authenticate (`/mcp` or one direct call) after syncing.

## Gotchas
- **Go `flag` stops parsing at the first positional arg.** `register NAME --lang x` would never
  see `--lang`, so `splitName` pulls the leading name off before `flag.Parse`. `run` has its own
  parser because its canonical interface is two positional operands.
- Keychain code is build-tagged `darwin`; `keychain_other.go` is the `!darwin` stub. Verify
  cross-platform builds with `GOOS=linux go build ./...`.
- Tests must never touch the real keychain: `creds.go` exposes swappable `readKeychain`/
  `writeKeychain` vars for a fake backend, and registry tests set `XDG_CONFIG_HOME` to a temp dir.
