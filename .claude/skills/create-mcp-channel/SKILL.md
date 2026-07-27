---
name: create-mcp-channel
description: "Build an MCP channel server that pushes webhooks, alerts, and chat messages into a Claude Code session. Covers one-way notification channels, two-way chat bridges with reply tools, sender gating for security, and permission relay for remote tool approval. Requires Claude Code v2.1.80+."
---

You are an expert at building MCP channel servers for Claude Code. A channel is an MCP server that pushes events into a Claude Code session so Claude can react to things happening outside the terminal — webhook alerts, CI failures, chat messages from Telegram/Discord, or monitoring events.

# Architecture

A channel is an [MCP](https://modelcontextprotocol.io) server that runs on the same machine as Claude Code. Claude Code spawns it as a subprocess over stdio transport. Your server bridges external systems into the session:

- **Chat platforms** (Telegram, Discord): your plugin runs locally, polls the platform API, forwards messages to Claude. No URL to expose.
- **Webhooks** (CI, monitoring): your server listens on a local HTTP port. External systems POST to it; your server pushes the payload to Claude.

# Requirements

- [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) package
- Node.js-compatible runtime (Bun, Node, Deno all work; examples use Bun for built-in HTTP + TS)
- Claude Code v2.1.80 or later (v2.1.81+ for permission relay)

# Server Constructor Options

A channel sets these in the `Server` constructor:

| Field | Type | Description |
|:------|:-----|:------------|
| `capabilities.experimental['claude/channel']` | `object` | **Required.** Always `{}`. Registers the notification listener. |
| `capabilities.experimental['claude/channel/permission']` | `object` | Optional. Always `{}`. Opts into permission relay (v2.1.81+). |
| `capabilities.tools` | `object` | Two-way only. Always `{}`. Enables tool discovery for reply tools. |
| `instructions` | `string` | **Recommended.** Added to Claude's system prompt. Tell Claude what events to expect, what `<channel>` tag attributes mean, whether to reply, and which tool/attribute to use. |

```ts
const mcp = new Server(
  { name: 'your-channel', version: '0.0.1' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },  // registers the channel listener
      tools: {},  // omit for one-way channels
    },
    instructions: 'Messages arrive as <channel source="your-channel" ...>. Reply with the reply tool.',
  },
)
```

# MCP Config Registration

Add to `.mcp.json` (project-level) or `~/.claude.json` (user-level):

```json
{
  "mcpServers": {
    "webhook": { "command": "bun", "args": ["./webhook.ts"] }
  }
}
```

# Notification Format

Push events with `mcp.notification()` — method `notifications/claude/channel`:

| Param | Type | Description |
|:------|:-----|:------------|
| `content` | `string` | Event body. Becomes the body of the `<channel>` tag. |
| `meta` | `Record<string, string>` | Optional. Each entry becomes a tag attribute. Keys: letters, digits, underscores only (hyphens silently dropped). |

```ts
await mcp.notification({
  method: 'notifications/claude/channel',
  params: {
    content: 'build failed on main: https://ci.example.com/run/1234',
    meta: { severity: 'high', run_id: '1234' },
  },
})
```

Arrives in Claude's context as:

```text
<channel source="your-channel" severity="high" run_id="1234">
build failed on main: https://ci.example.com/run/1234
</channel>
```

**Delivery behavior:** `await mcp.notification()` resolves when the message is written to transport, not when Claude processes it. If the session hasn't loaded the channel or org policy blocks it, events are silently dropped. Events queue and are processed in order; if several arrive while Claude is busy, they're delivered together on the next turn.

# One-Way Channel (Webhook Receiver)

Minimal server — forwards HTTP POSTs into the session. No reply tool.

```ts
#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const mcp = new Server(
  { name: 'webhook', version: '0.0.1' },
  {
    capabilities: { experimental: { 'claude/channel': {} } },
    instructions: 'Events from the webhook channel arrive as <channel source="webhook" ...>. They are one-way: read them and act, no reply expected.',
  },
)

await mcp.connect(new StdioServerTransport())

Bun.serve({
  port: 8788,
  hostname: '127.0.0.1',  // localhost-only
  async fetch(req) {
    const body = await req.text()
    await mcp.notification({
      method: 'notifications/claude/channel',
      params: {
        content: body,
        meta: { path: new URL(req.url).pathname, method: req.method },
      },
    })
    return new Response('ok')
  },
})
```

# Two-Way Channel (Chat Bridge)

Add a reply tool so Claude can send messages back. Three components:

1. `tools: {}` in capabilities — enables tool discovery
2. Tool handlers — register schema + implement send logic
3. Updated `instructions` — tell Claude how to route replies

```ts
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// --- Tool registration (before mcp.connect()) ---
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'reply',
    description: 'Send a message back over this channel',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: 'The conversation to reply in' },
        text: { type: 'string', description: 'The message to send' },
      },
      required: ['chat_id', 'text'],
    },
  }],
}))

mcp.setRequestHandler(CallToolRequestSchema, async req => {
  if (req.params.name === 'reply') {
    const { chat_id, text } = req.params.arguments as { chat_id: string; text: string }
    send(`Reply to ${chat_id}: ${text}`)  // your outbound function
    return { content: [{ type: 'text', text: 'sent' }] }
  }
  throw new Error(`unknown tool: ${req.params.name}`)
})
```

Instructions for the constructor:
```ts
instructions: 'Messages arrive as <channel source="webhook" chat_id="...">. Reply with the reply tool, passing the chat_id from the tag.'
```

# Sender Gating (Security)

An ungated channel is a prompt injection vector. Gate on **sender identity** (not chat/room identity) before emitting:

```ts
const allowed = new Set(loadAllowlist())

// inside your inbound handler, before emitting:
if (!allowed.has(message.from.id)) {  // sender, not room
  return  // drop silently
}
await mcp.notification({ ... })
```

Gate on `message.from.id`, not `message.chat.id`. In group chats these differ — gating on room lets anyone in an allowlisted group inject.

# Permission Relay (v2.1.81+)

Two-way channels can opt in to forward tool-approval prompts to remote devices. Terminal dialog stays open — whichever answer arrives first (local or remote) wins.

**Three components:**

1. **Declare capability** — `'claude/channel/permission': {}` in constructor
2. **Handle incoming request** — format the prompt for your platform with the 5-letter `request_id`
3. **Intercept verdict in inbound handler** — recognize `yes <id>`/`no <id>` format before forwarding as chat

**Permission request fields:**

| Field | Description |
|:------|:------------|
| `request_id` | 5 lowercase letters (a-z, no `l`). Include verbatim in prompt; echo back in reply. |
| `tool_name` | e.g. `"Bash"`, `"Write"` |
| `description` | Human-readable summary of this call |
| `input_preview` | Tool args as JSON, truncated to ~200 chars |

```ts
import { z } from 'zod'

const PermissionRequestSchema = z.object({
  method: z.literal('notifications/claude/channel/permission_request'),
  params: z.object({
    request_id: z.string(),
    tool_name: z.string(),
    description: z.string(),
    input_preview: z.string(),
  }),
})

mcp.setNotificationHandler(PermissionRequestSchema, async ({ params }) => {
  send(
    `Claude wants to run ${params.tool_name}: ${params.description}\n\n` +
    `Reply "yes ${params.request_id}" or "no ${params.request_id}"`,
  )
})
```

**Inbound verdict interception:**

```ts
const PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i

async function onInbound(message: PlatformMessage) {
  if (!allowed.has(message.from.id)) return  // gate first

  const m = PERMISSION_REPLY_RE.exec(message.text)
  if (m) {
    await mcp.notification({
      method: 'notifications/claude/channel/permission',
      params: {
        request_id: m[2].toLowerCase(),
        behavior: m[1].toLowerCase().startsWith('y') ? 'allow' : 'deny',
      },
    })
    return  // handled as verdict, don't forward as chat
  }

  // fall through: normal chat forwarding
  await mcp.notification({
    method: 'notifications/claude/channel',
    params: { content: message.text, meta: { chat_id: String(message.chat.id) } },
  })
}
```

Only declare the permission capability if your channel authenticates the sender — anyone who can reply can approve/deny tool use.

# Testing During Research Preview

Custom channels need the development flag (not on the approved allowlist):

```bash
# Plugin-based channel
claude --dangerously-load-development-channels plugin:yourplugin@yourmarketplace

# Bare .mcp.json server
claude --dangerously-load-development-channels server:webhook
```

Test inbound with curl:
```bash
curl -X POST localhost:8788 -d "build failed on main: https://ci.example.com/run/1234"
```

Diagnosis: if curl succeeds but nothing reaches Claude, check `/mcp` in-session and `~/.claude/debug/<session-id>.txt`. If curl gets "connection refused", check `lsof -i :<port>` for stale processes.

# Plugin Packaging

Wrap in a [plugin](https://code.claude.com/docs/en/plugins) for sharing. Users install with `/plugin install`, enable with `--channels plugin:<name>@<marketplace>`. During research preview, custom plugins still need `--dangerously-load-development-channels`.

# Reference Implementations

- [Fakechat](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/fakechat) — two-way with web UI, file attachments, reply tool
- [Telegram](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram) — sender gating with pairing flow
- [Discord](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord) — sender gating with pairing flow
- [iMessage](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/imessage) — auto-detects user addresses from Messages database
