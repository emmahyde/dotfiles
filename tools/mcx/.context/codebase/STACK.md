# Stack

## Primary

- **Go module:** `github.com/emmahyde/dotfiles/tools/mcx`
- **MCP transport:** `github.com/modelcontextprotocol/go-sdk` pinned at v1.6.1
- **Build:** `go build -o bin/mcx ./cmd/mcx`

mcx builds as a single CLI binary without CGO.

## Optional chain runtimes

The executor probes for Ruby, Python, JavaScript, or POSIX shell at runtime. These interpreters run
user-selected chains but are not compile-time dependencies of the Go binary.

The benchmark uses Python `tiktoken` with the `cl100k_base` encoding for reproducible token counts.

## Platform integration

macOS keychain access shells out to `/usr/bin/security` from a Darwin-specific implementation.
Other platforms compile against a stub and may use statically configured transport headers.

Network access is limited to MCP calls and OAuth metadata or token refresh requests.

## Plugin assets

- `.claude-plugin/plugin.json` — plugin manifest
- `hooks/hooks.json` — PostToolUse and UserPromptSubmit commands
- `scripts/mcx` — packaged binary
- `filters.yml` and `chains.yml` — shipped defaults
- `chains/` — packaged chain sources
- `skills/` and `commands/` — user-facing guidance

## Configuration

Filters and chains resolve from plugin defaults, project `.mcx/`, and user `~/.config/mcx/`
layers. MCP server discovery reads project and user Claude Code configuration.

Public examples use `jira`, `notion`, `slack`, `gdocs`, and `gsheets`; full keys use
`mcp__<alias>__<tool>`.
