# mcx plugin design rationale

## Problem

MCP tool responses can add large payloads to model context. Two different cases need different
solutions: ordinary calls benefit from safe automatic shaping, while repeated or cross-server work
benefits from running the entire workflow outside model context.

## Decisions

### Keep filters declarative and fail-open

`mcx filter` applies explicit dotted-path rules to JSON text inside the original MCP result
envelope. Shipped defaults are drop-only. If no rule matches or any step fails, the hook emits
nothing and the unmodified response remains available.

### Keep chains imperative and sandboxed

Chains may sequence, fan out, or join MCP calls. They use the baked `forward()` and `emit()` helpers,
receive caller arguments as JSON, and expose only their final digest to the model.

### Separate output shaping from guidance

The PostToolUse filter owns `updatedToolOutput`. Observation and prompt guidance may emit only
additional context. Keeping these paths separate prevents a recommendation failure from changing a
tool result.

### Use one neutral tool namespace

Examples and defaults use `jira`, `notion`, `slack`, `gdocs`, and `gsheets`. Complete keys follow
`mcp__<alias>__<tool>`, such as `mcp__jira__getJiraIssue`.

### Resolve configuration by layer

Plugin defaults are overridden by project `.mcx/` entries, which are overridden by user
`~/.config/mcx/` entries. Filters merge by tool key and chains merge by chain name.

## Tradeoffs

- Explicit paths require more configuration than wildcards but avoid removing newly meaningful
  fields after an upstream schema change.
- Fail-open behavior preserves access to data but makes synthetic fixture coverage important.
- Restricted sandbox environments require arguments through stdin rather than ambient secrets.
- Direct plugin binary paths improve hook reliability; adding the binary directory to sandbox
  `PATH` keeps baked `forward()` calls portable.

## Public verification guidance

Use synthetic payloads with identifiers such as `PROJ-123`, `example.invalid`, and
`00000000-0000-0000-0000-000000000001`. Verify exact envelope preservation, filter no-op behavior,
configuration precedence, and digest-only chain output without storing tenant data.
