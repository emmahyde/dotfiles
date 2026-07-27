---
name: mcp-integration
description: "Reference for configuring, managing, and troubleshooting MCP servers in Claude Code. Covers CLI commands, transport types, scopes, authentication, environment variables, tool search, plugin-provided servers, and managed enterprise configuration."
---

You are a Claude Code MCP integration specialist. Use this reference when adding, configuring, debugging, or removing MCP servers, or when the user mentions MCP, Model Context Protocol, `claude mcp`, `.mcp.json`, server connection issues, tool search, or managed MCP policies.

## CLI Commands

```
claude mcp add --transport http <name> <url>              # Add remote HTTP server
claude mcp add --transport http <name> <url> --header "..." # With auth header
claude mcp add --transport sse <name> <url>               # SSE (deprecated; use HTTP)
claude mcp add --env KEY=value --transport stdio <name> -- <cmd> [args...]
claude mcp add [--scope local|project|user] ...            # Scope (default: local)
claude mcp add-json <name> '<json>'                        # Add from raw JSON config
claude mcp add-json <name> '<json>' --client-secret        # With OAuth secret prompt
claude mcp add-from-claude-desktop                         # Import from Desktop (macOS/WSL)
claude mcp list                                            # List all servers + status
claude mcp get <name>                                      # Detail for one server
claude mcp remove <name> [--scope local|project|user]      # Remove a server
claude mcp login <name> [--no-browser] [--callback-port N] # OAuth login from shell
claude mcp logout <name>                                   # Clear stored OAuth creds
claude mcp reset-project-choices                           # Reset project-scope approvals
claude mcp serve                                           # Run Claude Code as MCP server
/mcp                                                       # Interactive panel (in-session)
```

**Critical syntax rule for stdio**: Everything after `--` is the server command verbatim. Without `--`, Claude Code misparses server flags as its own options.

```
claude mcp add --transport stdio myserver -- npx -y @scope/package --port 8080
#                                              ^^ separator
```

## Transport Types

| Transport | Use                                  | `--transport` flag | OAuth | `claude mcp add` support |
|-----------|--------------------------------------|---------------------|-------|--------------------------|
| HTTP      | Remote hosted servers (recommended)  | `http`              | Yes   | Yes                      |
| SSE       | Deprecated remote; use HTTP          | `sse`               | Yes   | Yes                      |
| Stdio     | Local subprocess on your machine     | `stdio` (default)   | No    | Yes                      |
| WebSocket | Bidirectional push-capable remote    | N/A (JSON only)     | No    | `add-json` only          |

In `.mcp.json` / `add-json`, the `type` field uses `"http"` or `"streamable-http"` (aliases), `"sse"`, `"stdio"`, or `"ws"`.

## Scopes

| Scope     | Stored in                           | Active in           | Shared  |
|-----------|-------------------------------------|---------------------|---------|
| `local`   | `~/.claude.json` (per-project key)  | This project only   | No      |
| `project` | `.mcp.json` in project root         | This project only   | Yes (VC)|
| `user`    | `~/.claude.json` (top-level key)    | All projects        | No      |

Precedence (highest first): local > project > user > plugins > claude.ai connectors. Entire server entry used from highest-precedence source; no field merging.

## Configuration Files

### `.mcp.json` (project scope)

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" }
    },
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "internal-api": {
      "type": "http",
      "url": "https://mcp.internal.example.com",
      "headersHelper": "/opt/bin/get-mcp-auth-headers.sh"
    }
  }
}
```

### `~/.claude.json` structure

```json
{
  "projects": {
    "/path/to/project": { "mcpServers": { ... } }
  },
  "mcpServers": { ... }
}
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `MCP_TIMEOUT` | Server startup timeout (ms) | — |
| `MCP_TOOL_TIMEOUT` | Per-tool execution timeout (ms) | ~28 hours |
| `MAX_MCP_OUTPUT_TOKENS` | Output warning + cap threshold (tokens) | 25000 |
| `ENABLE_TOOL_SEARCH` | Defer MCP tool definitions (`true`/`false`/`auto`/`auto:N`) | `true` |
| `CLAUDE_PROJECT_DIR` | Set in stdio server env to project root | — |
| `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` | Idle timeout for remote tool calls (ms; 0=off) | 300000 |
| `MCP_CLIENT_SECRET` | OAuth client secret for non-interactive add | — |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | Set `false` to block claude.ai connectors | — |

## Authentication

### OAuth 2.0 (HTTP/SSE servers)
- Auto-detected when server returns 401/403. Use `/mcp` to complete browser flow.
- `claude mcp login <name>` — authenticate from shell (v2.1.186+).
- Pre-configured credentials: `--client-id`, `--client-secret`, `--callback-port`.
- `oauth.scopes` in config pins requested scopes. `authServerMetadataUrl` overrides discovery.

### Static Headers
- `--header "Authorization: Bearer <token>"` at add time.
- In JSON: `"headers": { "Authorization": "Bearer ${TOKEN}" }`.

### Dynamic Headers (`headersHelper`)
- Shell command producing JSON `{ "key": "value" }` on stdout.
- Runs fresh on every connection. 10-second timeout.
- Env vars set: `CLAUDE_CODE_MCP_SERVER_NAME`, `CLAUDE_CODE_MCP_SERVER_URL`.

## Authentication in `.mcp.json` — OAuth fields

```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "clientId": "pre-registered-client-id",
        "callbackPort": 8080,
        "scopes": "channels:read chat:write",
        "authServerMetadataUrl": "https://auth.example.com/.well-known/openid-configuration"
      }
    }
  }
}
```

`--client-secret` prompts for secret with masked input at add time; stored in system keychain (macOS) or credentials file.

## Per-Server `timeout` Field

Add `"timeout": <ms>` to a server's `.mcp.json` entry to override `MCP_TOOL_TIMEOUT` per-server. Values < 1000 ignored → falls through to `MCP_TOOL_TIMEOUT`. Progress notifications do not extend the wall-clock limit.

## Tool Search (`ENABLE_TOOL_SEARCH`)

| Value | Behavior |
|-------|----------|
| (unset) / `true` | All MCP tools deferred, loaded on demand |
| `auto` | Load upfront if ≤10% of context window; defer overflow |
| `auto:N` | Threshold mode at N% (0-100) |
| `false` | All tools loaded upfront, no deferral |

Disabled by default on Vertex AI and when `ANTHROPIC_BASE_URL` is non-first-party. Requires model supporting `tool_reference` blocks (not Haiku).

**Per-server override**: `"alwaysLoad": true` in server config loads all its tools at startup. Individual tools can set `"anthropic/alwaysLoad": true` in `_meta`.

## Plugin-Provided MCP Servers

- Defined in plugin's `.mcp.json` or inline in `plugin.json`.
- Auto-connect on session start; `/reload-plugins` to pick up enable/disable changes.
- Tool names: `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`.
- `${CLAUDE_PLUGIN_ROOT}` = plugin directory; `${CLAUDE_PLUGIN_DATA}` = persistent data.

## Environmental Variables in `.mcp.json`

Supported in `command`, `args`, `env`, `url`, `headers`:
- `${VAR}` — expands to env var value; fails if unset.
- `${VAR:-default}` — expands to default if unset.
- `${CLAUDE_PROJECT_DIR:-.}` — safe for project-scope `.mcp.json`.

## Claude Code as MCP Server

```bash
claude mcp serve   # Exposes Claude Code's tools (Read, Edit, Bash, etc.) via stdio
```

Configure in `claude_desktop_config.json`:
```json
{ "mcpServers": { "claude-code": { "type": "stdio", "command": "claude", "args": ["mcp", "serve"] } } }
```

## MCP Resources & Prompts

- **Resources**: Reference via `@server:protocol://resource/path` in prompts. Fuzzy-searchable in autocomplete.
- **Prompts**: Appear as `/mcp__servername__promptname` commands. Accept space-separated args.

## Elicitation

MCP servers can request structured input mid-task. Two modes:
- **Form**: Interactive dialog with server-defined fields.
- **URL**: Browser flow for auth/approval.
Auto-respond without dialog via `Elicitation` hook.

## Output Limits

- Warning at >10,000 tokens; capped at `MAX_MCP_OUTPUT_TOKENS` (default 25,000).
- Server authors: annotate `_meta["anthropic/maxResultSizeChars"]` on a tool to raise its text-content threshold (hard cap 500,000 chars). Does not affect image-content tools.
- Remote tool idle timeout (v2.1.187+): 5 min with no response/progress → abort. Set `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` in ms, or `0` to disable.

## Connection Lifecycle

- **HTTP/SSE**: Auto-reconnect with exponential backoff (5 attempts, 1s→16s). Initial connection retries up to 3× on transient errors (5xx, refused, timeout) — not on 4xx/auth.
- **Stdio**: Local process; no automatic reconnect.
- **Dynamic updates**: Servers can send `list_changed` notifications → tools/prompts/resources auto-refresh.

## Managed MCP (Enterprise)

### `managed-mcp.json` (exclusive control)

Placed at:
| Platform | Path |
|----------|------|
| macOS | `/Library/Application Support/ClaudeCode/managed-mcp.json` |
| Linux/WSL | `/etc/claude-code/managed-mcp.json` |
| Windows | `C:\Program Files\ClaudeCode\managed-mcp.json` |

When present, only its servers load. Users cannot add/remove servers. Empty `"mcpServers": {}` disables MCP entirely.

### Allowlists / Denylists

Configured via `allowedMcpServers` and `deniedMcpServers` in managed settings. Match by:
- `serverUrl` — URL with `*` wildcards (case-insensitive hostname, case-sensitive path)
- `serverCommand` — exact command + args match
- `serverName` — exact label (NOT a security control; users can rename)

Set `allowManagedMcpServersOnly: true` to prevent users from broadening the allowlist in their own settings.

### Server Evaluation Order
1. Merge lists from all sources (allowlist restricted to managed if `allowManagedMcpServersOnly`).
2. Check denylist (always applies; nothing overrides a deny).
3. Check allowlist; if set, must match by URL (remote) or command (stdio). Name-only match only when no URL/command entries exist for that transport.

### Validation Commands
```bash
claude mcp list              # Should show only managed servers
claude mcp add --transport http test https://example.com/mcp  # Should fail
```

## Common Patterns

### Add a server with OAuth
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
# Then in-session: /mcp → select server → Authenticate
```

### Add a local stdio server with env vars
```bash
claude mcp add --env AIRTABLE_API_KEY=key123 --transport stdio airtable -- npx -y airtable-mcp-server
```

### Share a server with the team
```bash
claude mcp add --scope project --transport http stripe https://mcp.stripe.com
# Commits .mcp.json to version control
```

### Debug a server
```bash
claude mcp list                    # Status overview
claude mcp get <name>              # Detailed error
/mcp                               # In-session panel with reconnect/auth
```

## Connection Status Indicators

| Status | Meaning |
|--------|---------|
| `✓ Connected` | Ready |
| `! Connected · tools fetch failed` | Connected but can't list tools |
| `! Needs authentication` | OAuth or token required |
| `✗ Failed to connect` | Server didn't respond |
| `✗ Connection error` | Connection threw an error |
| `⏸ Pending approval` | Project-scoped server not yet approved |

## Troubleshooting Quick Reference

- **"No MCP servers configured"**: Wrong project directory for local-scoped servers, or wrong config file path.
- **Stdio server not connecting on first check**: `npx` may be downloading; wait and recheck.
- **`! Needs authentication`**: Run `/mcp`, select server, choose Authenticate. Or `claude mcp login <name>`.
- **Browser doesn't open for OAuth**: Copy URL manually; if redirect fails, paste callback URL from address bar.
- **"Incompatible auth server: does not support dynamic client registration"**: Use `--client-id` + `--client-secret` with pre-registered OAuth app.
- **`spawn claude ENOENT`** (using `claude mcp serve`): Use full path from `which claude`.
- **`Cannot add MCP server: enterprise MCP configuration is active`**: `managed-mcp.json` is deployed; users can't add servers.
- **Server shows as failed after 5 retries**: Use `/mcp` to retry manually.
- **`--env` placed before server name rejects the name**: Insert another option (`--transport`, `--scope`) between `--env` and the name.
