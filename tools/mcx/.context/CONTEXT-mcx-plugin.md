# mcx plugin technical context

## Purpose

mcx is an MCP client and sandboxed workflow runner packaged as a Claude Code plugin. It reduces
context growth through two complementary mechanisms:

- **Filters** reshape configured tool responses automatically after a direct MCP call.
- **Chains** orchestrate one or more MCP calls inside a sandbox and emit a compact digest.

mcx does not expose an MCP server and does not implement interactive browser authentication.

## Public naming contract

- Go module: `github.com/emmahyde/dotfiles/tools/mcx`
- Neutral server aliases: `jira`, `notion`, `slack`, `gdocs`, `gsheets`
- Full tool keys: `mcp__<alias>__<tool>`

For example, a Jira issue lookup may be configured as `mcp__jira__getJiraIssue` and exercised with
the synthetic key `PROJ-123`.

## Filter contract

The PostToolUse hook sends its JSON payload to `mcx filter` on stdin. A matching rule transforms
only JSON held in text content and returns:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "updatedToolOutput": {
      "content": [{"type": "text", "text": "<filtered JSON>"}]
    }
  }
}
```

The complete MCP result envelope is preserved, including `isError`, `structuredContent`, and
`_meta` when present. An unconfigured tool, malformed input, disabled filtering, or an internal
error produces exit status zero with empty stdout so the original response passes through.

Shipped rules are drop-only and use explicit dotted paths. More aggressive keep, rename, or
truncate rules belong in project or user configuration and require synthetic fixtures that protect
signal fields.

## Chain contract

Chains run with a restricted environment and receive parsed arguments through the executor's baked
helpers. They call MCP tools through `forward(alias, tool, args)` and return one value through
`emit(value)`. Intermediate responses remain inside the sandbox.

Chain names resolve across plugin, project, and user layers. More-specific entries override
less-specific entries by name.

## Plugin hooks

- **PostToolUse** runs filtering and observation for `mcp__.*` tools.
- **UserPromptSubmit** may add concise factual context about mcx when the prompt names it.
- Observation and filtering are separate so recommendation logic cannot corrupt tool output.

Hook commands invoke `${CLAUDE_PLUGIN_ROOT}/scripts/mcx` directly. The executor prepends the running
binary's directory to its restricted `PATH` so a chain's baked `forward()` resolves the same binary.

## Configuration precedence

Both filters and chains resolve in this order:

1. plugin defaults
2. project `.mcx/`
3. user `~/.config/mcx/`

Entries merge by key, with the more-specific layer winning. User registration commands write only
to the user layer.

## Safety invariants

- Sandbox environments never inherit API keys or bearer tokens.
- Filter failures are no-ops, never partial replacements.
- Credential updates preserve unrelated keychain entries.
- Script and tool names reject path traversal.
- Tests use temporary configuration roots and synthetic payloads only.
