# ARCHITECTURE

mcx is a **plain CLI, MCP client only — never an MCP server.** Two jobs today; a third
(declarative trimming) and a plugin wrapper are being added.

## Current subsystems

### 1. forward (`cmd/mcx/main.go` `cmdForward` + `internal/mcpclient/`)
Call one tool on an external MCP server discovered from Claude Code config, injecting a
keychain OAuth bearer token.
- `resolve.go` — server discovery + precedence (`.mcp.json` → `~/.claude.json` → `~/.claude/*.json`).
- `transport.go` — StreamableHTTP transport + `headerRoundTripper` bearer injection.
- `call.go` — one-shot connect / call / close.
- `internal/keychain/` — read `Claude Code-credentials`, match `mcpOAuth` by `serverName` **field**
  (not composite key), `expiresAt` compared as **epoch ms**, refresh via RFC 8414 discovery
  (`/.well-known/oauth-authorization-server`), write back read-modify-write of the whole blob under
  a per-service `flock`. `injectAuth` only adds a bearer for HTTP servers with no existing auth header.

### 2. registry (`internal/registry/` + executor)
Durable named-script store: `register` / `list` / `run` / `remove`.
- `store.go` — scripts dir + `manifest.json`; `validName` blocks path traversal.
- `run.go` — feed args JSON to script **stdin**; execute via `internal/executor`.
- `internal/executor/` — sandboxed runtimes; env stripped to `safeEnv` allow-list (PATH/HOME/locale
  only — no API keys forwarded). Ruby chains get a baked `forward()`/`emit()` preamble
  (`runtimes.go rubyPreamble`) that shells to `mcx forward`.

## Planned architecture — two registries + plugin

- **Modifiers (Registry 1, passive):** declarative JSON reshaping (keep/drop/rename/truncate)
  applied to *every* call of a configured MCP tool. Native Go, no sandbox, no forward. New
  `mcx trim` command; auto-applied by a **PostToolUse** hook that returns `updatedToolOutput`
  (must preserve the tool's output envelope shape).
- **Chains (Registry 2, active):** the existing register/run script store — orchestrate MCP calls
  and return a digest. Model-invoked (`mcx run`), nudged by a **UserPromptSubmit** hook's
  `additionalContext`.
- **Config precedence (both registries):** plugin defaults → project `.mcx/` → user `~/.config/mcx/`;
  most-specific source wins, merged by key.
- **Plugin layout:** binary moves into plugin `scripts/`; `mcx` must stay resolvable on the
  sandbox `safeEnv` PATH for chain `forward()` to work.

## State machine — a single MCP tool response
`tool call → (PostToolUse fires) → mcx trim reads modifiers.json → matching entry? →
yes: reshape inner payload, re-wrap in envelope, return updatedToolOutput → no: pass through
(fail-open) → context`. Chains bypass this: one `mcx run` fans out N forwards inside the sandbox;
only the emitted digest re-enters context.
