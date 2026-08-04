# Conventions

## Go structure

- Keep `cmd/mcx/main.go` focused on dispatch; subcommands use `cmdX(args []string) error`.
- Put subsystem logic in a focused package under `internal/`.
- Return wrapped errors with `fmt.Errorf("context: %w", err)`.
- Use build-tagged files for platform-specific keychain access.
- Pull positional names out before `flag.Parse` because Go flag parsing stops at the first
  positional argument.
- Compare values explicitly when `0`, `""`, or `false` are valid data.

## MCP naming

- Server aliases are exactly `jira`, `notion`, `slack`, `gdocs`, and `gsheets`.
- Complete tool keys follow `mcp__<alias>__<tool>`.
- Examples use synthetic identifiers such as `PROJ-123`, `example.invalid`, and placeholder UUIDs.

## Filters and hooks

- Filters are declarative data, never sandboxed scripts.
- Preserve the complete MCP output envelope when updating tool output.
- Exit zero with empty stdout on no-match, disabled filtering, malformed input, or internal error.
- Back each shipped filter with a synthetic fixture.
- Keep observation and recommendation output separate from `updatedToolOutput`.

## Chains

- Pass chain input as JSON rather than through ambient environment variables.
- Use the baked `forward()` and `emit()` helpers instead of custom MCP client plumbing.
- Keep generated skills isolated behind their management sentinel.
- Reject names containing `/` or `..`.

## Tests

- Never access a user's real keychain, tenant, pages, channels, projects, or spreadsheets.
- Redirect configuration roots to temporary directories.
- Use deterministic synthetic fixtures and local HTTP test servers.
- Prefer table-driven tests for transformations and compacted JSON comparisons for payloads.

## Comments

Comments explain non-obvious constraints, not mechanics. Keep them short and free of task, ticket,
or organizational references.
