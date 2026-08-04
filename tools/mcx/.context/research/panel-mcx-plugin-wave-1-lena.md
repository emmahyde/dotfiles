# Hook and plugin packaging guidance

## Hook scope

PostToolUse matches `mcp__.*` because mcx discovers external MCP servers dynamically. Tool-specific
selection belongs in filter configuration, keyed as `mcp__<alias>__<tool>`.

The hook invokes `${CLAUDE_PLUGIN_ROOT}/scripts/mcx filter` directly. This avoids shell quoting and
user-`PATH` assumptions.

## Output contract

PostToolUse input includes `tool_name` and `tool_response`. For MCP calls, `tool_response` is a
`CallToolResult`-shaped object with `content` and optional `isError`, `structuredContent`, and
`_meta` fields.

When a filter changes JSON text, output uses:

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

The value under `updatedToolOutput` must retain the original result shape. Returning only the inner
JSON would violate the hook contract. If nothing changes or an error occurs, exit zero with empty
stdout.

## Recommendation hooks

Filtering and observation run as separate PostToolUse commands. Filtering may update tool output;
observation may add factual context about repeated calls or large unfiltered results. Keeping them
separate protects the fail-open output path.

UserPromptSubmit guidance stays short, local, and factual. It does not perform MCP calls or inspect
tenant data. `MCX_NUDGE=off` and `MCX_OBSERVE=off` disable their respective paths.

## Skill boundaries

- `/mcx:mcx` is a concise command and concept reference.
- `/mcx:new` teaches authoring an ad hoc chain.
- `/mcx:save` persists a chain only when the user explicitly requests reuse.

Descriptions should distinguish reference, authoring, and persistence so multiple skills do not
compete for the same request.

## Neutral examples

Use only the aliases `jira`, `notion`, `slack`, `gdocs`, and `gsheets`. A safe example key is
`mcp__jira__getJiraIssue` with `{"issueIdOrKey":"PROJ-123"}`. URLs use `example.invalid`; account,
page, channel, project, and spreadsheet identifiers use obvious placeholders supplied by the
caller.
