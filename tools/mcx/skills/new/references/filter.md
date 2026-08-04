# Configure a filter

Use a filter when one MCP tool repeatedly returns a result dominated by fields
the task does not need. Filters apply automatically through the PostToolUse
hook; they do not orchestrate multiple calls.

## Procedure

1. Identify the full MCP tool name and inspect a representative real result.
2. Enumerate the signal fields the user needs and the explicit cruft paths that
   can be removed. Dotted paths only; there are no wildcards or array traversal.
3. Choose the appropriate layer:
   - project: `.mcx/filters.yml`
   - user: `~/.config/mcx/filters.yml`
4. Ask before changing persistent filter configuration.
5. Add the smallest safe `drop`, `keep`, `rename`, or `truncate` transform.
6. Replay or call the tool again and verify that the output is smaller and all
   required signal remains. A no-op or invalid filter must leave the original
   result untouched.

Example:

```yaml
mcp__jira__getJiraIssue:
  drop:
    - expand
    - self
    - fields.reporter.avatarUrls
```

Prefer explicit drop-only transforms when uncertainty exists. Do not guess at
paths from memory; validate them against the observed payload.

Changing the plugin's shipped `filters.yml` is a maintainer workflow, not the
default user action. Do it only when explicitly requested in the mcx repository,
using a sanitized checked-in capture and the shipped-default safety tests.
