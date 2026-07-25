# Panel: mcx plugin wave 1
*(Lena — hooks / plugin packaging)*

Grounded against `.claude/research/claude-code-steering-plugins-20260713/pages/01-code-claude-com-docs-en-hooks.md`, `.context/codebase/ARCHITECTURE.md`, and the pinned `github.com/modelcontextprotocol/go-sdk@v1.6.1` `mcp/protocol.go` (for the envelope shape — the hooks doc itself does not print an MCP `tool_response` example, trafilatura stripped code blocks).

## 1. `hooks/hooks.json` structure

Two hook groups, both plugin-scoped (`Plugin` source in `/hooks`), both fail-open:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/mcx",
            "args": ["trim", "--hook"],
            "timeout": 10
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/mcx",
            "args": ["nudge", "--hook"],
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**Matcher: `mcp__.*`, not per-server, not plugin-scoped.** The doc's `mcp__plugin_<plugin>_<server>__<tool>` form (line 166-168 of the source page) only applies to MCP servers the *plugin itself bundles* via `.mcp.json`. mcx is a client to whatever *external* servers the user's Claude Code config resolves (`.mcp.json` → `~/.claude.json` → `~/.claude/*.json` per `resolve.go`) — that set is dynamic and unknowable at hooks.json-authoring time. So: broad `mcp__.*` catch-all, and push all "does this tool have a modifier" logic into `mcx trim` reading `modifiers.json` at runtime (plugin defaults → project `.mcx/` → user `~/.config/mcx/`, most-specific wins). A narrower per-server matcher (`mcp__github__.*`) is a spawn-cost optimization to revisit only if profiling shows the extra `mcx trim` invocations cost real latency — not a correctness requirement, since `mcx trim` itself must already fail open on no-match.

**Use exec form (`args` set), not shell form.** `${CLAUDE_PLUGIN_ROOT}` gets substituted as a plain string into `command`/each `args` element with zero shell tokenization — no quoting hazards, no risk of `sh -c` mangling a path with spaces. Shell form is unnecessary here since there's no pipe/`&&`.

**UserPromptSubmit has no matcher support at all** (it's in the "always fires on every occurrence" list in the matcher-support table) — the entire filtering burden is inside `mcx nudge`, not hooks.json. This is the doc's actual constraint, not a choice.

## 2. PostToolUse envelope: how `mcx trim` gets the result and returns it intact

**Input:** Claude Code sends the full `PostToolUse` JSON on stdin, including `tool_name` and `tool_response`. For an MCP tool, `tool_response` is the SDK's `CallToolResult` serialized to JSON — verified directly from the pinned dependency, `go-sdk@v1.6.1/mcp/protocol.go:71-86`:

```go
type CallToolResult struct {
    Meta              `json:"_meta,omitempty"`
    Content           []Content `json:"content"`
    StructuredContent any       `json:"structuredContent,omitempty"`
    IsError           bool      `json:"isError,omitempty"`
}
```

`Content` is a discriminated union (`TextContent`/`ImageContent`/`AudioContent`/`EmbeddedResource`), each serializing with its own `type` field (`"text"`, `"image"`, etc.). So the wire shape `mcx trim` receives as `tool_response` is:

```json
{"content": [{"type": "text", "text": "..."}], "isError": false}
```

optionally with `structuredContent` and `_meta`.

**Output contract:** `mcx trim` must emit, on exit 0, a JSON object whose `hookSpecificOutput.updatedToolOutput` is **that same shape** — `{"content": [...], "isError": ..., "structuredContent": ...}` — never a bare string, never a reshaped custom object. The doc states this explicitly: "The value must match the tool's output shape." Concretely:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "updatedToolOutput": {
      "content": [{"type": "text", "text": "<trimmed JSON>"}],
      "isError": false
    }
  }
}
```

Prefer `updatedToolOutput` over `updatedMCPToolOutput` — the doc says the latter is MCP-only and to prefer the former, "which works for all tools." Since `PostToolUse` fires on every tool (not just MCP), keeping `mcx trim` on the universal field means the same code path works if a future non-MCP modifier target is added.

**Fail-open, precisely:** if no `modifiers.json` entry matches `tool_name`, or `mcx trim` hits any internal error, it must exit 0 with **empty stdout** (no JSON at all) — not an empty/partial `updatedToolOutput`, and not `decision: "block"`. Empty stdout on exit 0 means "no decision," so Claude Code passes the original `tool_response` through untouched. This matches the state machine already documented in ARCHITECTURE.md ("no: pass through (fail-open)"). Do not conflate "no modifier configured" with "trim failed" in the hook's exit code — both should be silent no-ops from Claude Code's perspective, but the failure case should still log to stderr (shown as a non-blocking `<hook name> hook error` notice) so it's debuggable without corrupting the tool result.

One more correctness trap given the repo's own truthiness rule: if a modifier's `keep` rule resolves a field to `""`, `[]`, or `0`, that is valid trimmed data, not "nothing to output" — `mcx trim` must still emit `updatedToolOutput` for it, never silently fall through to the fail-open path just because a value looks empty.

## 3. Keeping the UserPromptSubmit nudge from becoming noise

No native cooldown exists for plugin `hooks.json` — the doc's `once` field is explicit that it is "ignored in settings files and agent frontmatter," and plugin hooks are configured via settings-file-equivalent `hooks/hooks.json`, so `once` does not apply here. Cooldown must be hand-rolled:

- **Heuristic gate first, cheap and local**: `mcx nudge` runs a fast keyword/shape check against the `prompt` field (fan-out language: "for each", "across all", "every repo", multiple named servers in one sentence, etc.) entirely in-process — no network, no MCP calls — before deciding to emit anything. Anything that doesn't match exits 0 with empty stdout immediately.
- **State-file cooldown in `${CLAUDE_PLUGIN_DATA}`**, keyed by `session_id` (present in every hook's common input fields) or `prompt_id` (present from v2.1.196+): write a timestamp/counter after a nudge fires, and skip re-nudging within N turns or M minutes for the same session. This is inference from the doc's `CLAUDE_PLUGIN_DATA` persistent-data-directory description, not an observed pattern — treat as the weakest-verified part of this design and dogfood it before shipping broadly.
- **Speed is the hard constraint, not the heuristic's precision.** `UserPromptSubmit` defaults to a 30s timeout, but a hook that times out is silently canceled and its `additionalContext` discarded (with a transcript notice as of v2.1.196) — the prompt still goes through with no nudge. Target well under 1s: no MCP calls, no subprocess forking beyond the single `mcx` invocation, no filesystem scans beyond the one state-file read/write.
- **Factual phrasing, not imperative**, per the doc's explicit prompt-injection-defense warning: write "A registered chain exists for fan-out across MCP servers; `mcx list` shows available chains" rather than "You must use mcx run for this." Imperative out-of-band phrasing risks Claude surfacing the injected text back to the user instead of acting on it.
- **No JSON when not nudging** — exit 0, empty stdout — so a non-match costs nothing beyond the heuristic's own runtime and never grows the transcript.

## 4. Skill description-writing

**`skills/mcx-author`** must auto-trigger on intent to build/register a reusable multi-step MCP workflow, not on every mention of "mcx." Third-person, keyword-dense, per the official best-practices guidance (page 02 of the corpus): something like — *"Writes and registers a reusable mcx chain script — a sandboxed Ruby/shell/Python/JS script, stored via `mcx register`, that orchestrates multiple MCP tool calls and returns a digest. Use when the user wants to create, register, or reuse a repeatable multi-step or fan-out workflow across MCP servers, or asks to turn a one-off sequence of tool calls into something they can run again."* Cover both trigger surfaces explicitly: (a) "build me something reusable" intent, (b) the fan-out/multi-server language that the `UserPromptSubmit` nudge itself uses — so the nudge's `additionalContext` and the skill's own `description` are consistent vocabulary, reinforcing each other instead of competing.

**`skills/mcx`** (`/mcx`) is user-invoked, so its description should be **deliberately narrow** so it does *not* also auto-fire and shadow `mcx-author` — e.g. *"Displays the mcx quickstart and command cheatsheet (forward, register, list, run, remove, trim) when the user explicitly runs `/mcx`."* Structure the body as a flat cheatsheet: one-line command table (`mcx forward`, `mcx register`, `mcx run`, `mcx trim`, `mcx list`), a "when to use a modifier vs a chain" one-liner, and a link out to `mcx-author` for the authoring flow rather than duplicating it — keeps progressive disclosure honest (one level of nesting, per the best-practices doc) and avoids two skills teaching the same thing differently.

## 5. Top risk and the one correctness check that matters most

**Top risk:** `updatedToolOutput` shape mismatch. If `mcx trim` ever emits anything other than the exact `CallToolResult` JSON shape (`content[]` + optional `isError`/`structuredContent`/`_meta`) — e.g. a bare trimmed string, or a custom `{trimmed: true, data: ...}` wrapper — Claude Code either silently mis-renders the result or the tool's own downstream consumer (any code expecting `content[0].text` to be a string) breaks with no visible error, because `PostToolUse` cannot signal a blocking failure back (it's already in the "can't block" bucket per the exit-code-2 table).

**Single most important check before shipping:** feed `mcx trim --hook` a captured real `PostToolUse` payload for at least one MCP tool call (real `tool_response` JSON, not a hand-written fixture) and diff the hook's stdout against the input's `tool_response` field-for-field except the intentionally-trimmed keys — confirming `content[].type` discriminators, `isError`, and any `structuredContent` survive untouched when no modifier matches, and remain a valid `CallToolResult` when one does.
