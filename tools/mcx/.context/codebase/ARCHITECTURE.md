# Architecture

mcx is a Go CLI and MCP client packaged as a Claude Code plugin. The module path is
`github.com/emmahyde/dotfiles/tools/mcx`.

## Request paths

### Direct MCP call

1. Claude Code invokes a tool named `mcp__<alias>__<tool>`.
2. PostToolUse runs `mcx filter` and `mcx observe`.
3. A configured filter reshapes JSON text while preserving the MCP result envelope.
4. An unconfigured or invalid filter exits cleanly without output, leaving the result unchanged.

### Chain call

1. The model invokes `mcx run` with JSON arguments and a chain name or source.
2. The executor starts a supported sandbox runtime with a restricted environment.
3. The chain calls one or more tools through the baked `forward()` helper.
4. Only the value passed to `emit()` returns to model context.

## Components

- `cmd/mcx/main.go` — command dispatch.
- `internal/mcpclient/` — server discovery, transport, header injection, and one-shot calls.
- `internal/keychain/` — macOS OAuth credential lookup, refresh, and preserving write-back.
- `internal/registry/` — layered chain discovery, registration, removal, and execution.
- `internal/executor/` — Ruby, Python, JavaScript, and shell sandboxes.
- `internal/filters/` — filter configuration, transformations, envelope handling, and hook input.
- `internal/observe/` and `internal/scan/` — live and retrospective workflow-candidate detection.
- `internal/connectors/` — connector URL planning and configuration synchronization.
- `internal/skillsync/` — generated skill reconciliation for registered chains.

## Naming

Public examples use the aliases `jira`, `notion`, `slack`, `gdocs`, and `gsheets`. Full tool keys
follow `mcp__<alias>__<tool>`. A synthetic example is `mcp__jira__getJiraIssue` with key
`PROJ-123`.

## Configuration layers

Plugin defaults are merged with project `.mcx/` configuration and then user
`~/.config/mcx/` configuration. Later layers override earlier entries by key.

## Boundaries

- mcx is not an MCP server.
- Credentials are injected only into eligible HTTP transports.
- Sandbox processes receive no ambient API keys.
- Filters never replace output on failure.
- Connector synchronization preserves unrelated configuration.
