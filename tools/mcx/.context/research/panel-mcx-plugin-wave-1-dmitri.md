# CLI and filter implementation guidance

## Command boundary

`mcx filter` accepts a PostToolUse JSON payload on stdin. The command delegates parsing,
configuration, transformation, and envelope handling to `internal/filters/`; command dispatch stays
in `cmd/mcx/main.go`.

A successful transformation emits `hookSpecificOutput.updatedToolOutput` with the complete MCP
result envelope. No matching rule, disabled filtering, malformed input, or any internal failure
returns exit status zero with empty stdout.

## Filter package responsibilities

- `config.go` loads and merges filter entries from plugin, project, and user layers.
- `transform.go` applies explicit dotted-path operations to decoded JSON.
- `envelope.go` updates JSON text content without dropping other content or metadata.
- `run.go` interprets the hook payload and decides whether output is safe to emit.

Configuration merges by full tool key rather than stopping at the first readable file. Full keys
follow `mcp__<alias>__<tool>`; the supported aliases are `jira`, `notion`, `slack`, `gdocs`, and
`gsheets`.

## Portability

Plugin hooks call `${CLAUDE_PLUGIN_ROOT}/scripts/mcx` directly and do not depend on the user's
`PATH`. Chain helpers invoke `mcx forward` from a restricted subprocess, so the executor prepends
the running binary's directory to its outgoing `PATH`.

Keep this adjustment in the shared environment builder. A second command-specific path rule would
make runtime behavior depend on the selected chain language.

## Safety

- Preserve false, zero, empty strings, empty arrays, and empty objects as valid values.
- Never emit a partial replacement envelope.
- Keep shipped filters drop-only.
- Reject traversal in script and tool names.
- Preserve unrelated keychain and connector configuration during writes.

## Synthetic checks

Use a fixture such as `mcp__jira__getJiraIssue` returning `PROJ-123` with links under
`example.invalid`. Check exact envelope preservation, no-match behavior, precedence, and portable
binary resolution without reading user credentials or tenant data.
