---
description: Install the mcx binary on your PATH, install mcx guidance into your global CLAUDE.md, optionally scan a recent transcript for MCP calls a chain or filter could collapse, and optionally sync claude.ai connectors into local config. Invoke as /setup.
---

# mcx setup

Bootstrap mcx for this machine. Do the steps in order and report what happened after each.

## 1. Install the binary on PATH

The plugin ships a prebuilt binary at `${CLAUDE_PLUGIN_ROOT}/scripts/mcx`. The hooks already call that plugin copy directly, so filtering and nudging work without this step — installing globally just lets the user run `mcx forward`/`register`/`run`/`scan` themselves from any shell.

`${CLAUDE_PLUGIN_ROOT}` resolves to a version-pinned cache path (e.g. `~/.claude/plugins/cache/<marketplace>/mcx/0.1.0/`), so copying that binary onto PATH once would go stale on the next plugin update. Instead, install a wrapper that re-resolves the newest cached version on every call:

```sh
mkdir -p ~/.local/bin && cat > ~/.local/bin/mcx <<'SH'
#!/bin/sh
bin=$(ls -td "$HOME"/.claude/plugins/cache/*/mcx/*/scripts/mcx 2>/dev/null | head -1)
if [ -z "$bin" ]; then
  echo "mcx: no installed mcx plugin found under ~/.claude/plugins/cache" >&2
  exit 1
fi
exec "$bin" "$@"
SH
chmod +x ~/.local/bin/mcx
```

- Verify: `mcx --help` should list `forward`/`register`/`run`/`filter`/`observe`/`scan`. If the shell can't find `mcx`, tell the user to add `~/.local/bin` to their PATH.
- The wrapper picks the most-recently-modified `mcx` version across any installed marketplace, so plugin updates (which land in a new version directory) take effect immediately — no re-running `/setup`.
- The shipped binary is **darwin/arm64 only**. On another platform, build from source from the plugin root instead (needs Go): `go build -o ~/.local/bin/mcx ${CLAUDE_PLUGIN_ROOT}/cmd/mcx` (this one-off build does need to be redone after an update, since it bypasses the wrapper).

## 2. Verify chains and filters are live

Run `mcx doctor`. It reports the resolved plugin root, whether the shipped filters actually reshape a payload (a self-check, not just "the file parsed"), and how many chains resolve. A non-zero exit means something is wrong — read the report.

- `mcx doctor` resolves the plugin cache on its own, so it works from any shell even though `CLAUDE_PLUGIN_ROOT` is only set inside Claude Code's own hooks/commands. The same auto-detection is why `mcx list`/`mcx run` now see the shipped chains from your terminal.
- The report ends with a caveat: the self-check proves the binary and config reshape correctly, but it cannot confirm Claude Code applies the `PostToolUse` result in *this* session. To confirm end-to-end, call a filtered MCP tool (e.g. `getJiraIssue`) and check the dropped fields (`expand`, `self`) are absent from the result. If they're still present, the hook isn't taking effect — check the plugin is enabled.

## 3. Install mcx guidance into the user's global CLAUDE.md

Teach the assistant to reach for mcx across all future sessions by installing a small guidance block into the user's **global** `~/.claude/CLAUDE.md` (never the mcx project CLAUDE.md, never a project-local file). Ask the user (yes/no) whether to install it; only continue if yes.

The block is delimited by the sentinels `<!-- mcx:begin -->` and `<!-- mcx:end -->` so this step is idempotent. Do this:

1. Read `~/.claude/CLAUDE.md` if it exists.
2. If a `<!-- mcx:begin -->` ... `<!-- mcx:end -->` block is already present, **replace everything between and including those sentinels** with the block below (in place — do not append a second copy).
3. If the file exists but has no sentinels, append the block below (add a blank line before it if the file doesn't already end with one).
4. If the file does not exist, create it containing exactly the block below.

Never insert the block more than once; the sentinels are the sole marker to check. The block to install (verbatim, sentinels included):

```markdown
<!-- mcx:begin -->
## mcx — collapse MCP overhead

**mcx** cuts MCP cost two ways: *chains* run a fan-out of MCP calls in one sandboxed script (`mcx run <args-json> <language>` accepts source from a heredoc); *filters* auto-trim bloated MCP tool output.

**mcx routing is a requirement, not a suggestion.** When an mcx hook injects a routing gate, STOP before the next direct MCP call and invoke `/mcx:new`. It MUST choose one path: use a matching registered chain; run ad-hoc source for a multi-call fan-out; configure a filter for a bloated result; or continue directly only for an isolated call that cannot benefit from either. Invoke `/mcx:save` only when the user explicitly asks to persist a proven chain. A one-time task with multiple related calls is still a fan-out, not an exception.

| The moment you... | Do this |
|---|---|
| are about to make a 2nd+ related MCP call in one task (same or different server), or one call's output feeds the next | STOP and invoke `/mcx:new` before the next call; default to a heredoc-fed ad-hoc `mcx run` |
| see an MCP tool result dominated by fields you won't use (bloated JSON) | invoke `/mcx:new` before calling that tool again; it will evaluate a filter |

For chain/filter creation, the source of truth is `/mcx:new`; for general CLI reference use `/mcx:mcx`.
<!-- mcx:end -->
```

Report whether you created the file, replaced an existing block, or appended a new one.

## 4. Offer a transcript scan

Ask the user (yes/no) whether to scan a recent transcript for MCP calls a chain or filter could collapse. Only continue if they say yes.

Run:
`mcx scan --config "${CLAUDE_PLUGIN_ROOT}/filters.yml"`

(scans the newest transcript for this project; pass `--transcript <path>` to target a specific one.)

Then summarize the report:
- **Chain candidates** — tools called repeatedly. Invoke `/mcx:new` to run the fan-out ad hoc; invoke `/mcx:save` only when the user asks to persist it.
- **Filter candidates** — tools returning large, unfiltered results. Invoke `/mcx:new` to configure a project or user filter. Change shipped defaults only when explicitly requested in the mcx repository.

Do not register a chain or edit a filter without the user's confirmation.

For command syntax reference, invoke `/mcx:mcx` — the cheatsheet.

## 5. Offer to sync claude.ai connectors into local config

mcx only forwards to servers it can find in local config (`.mcp.json`/`~/.claude.json`) plus a
matching keychain credential — it never reads claude.ai account-level "connectors" directly, even
though many of those connectors point at the exact same backend URL (commonly a RunLayer-proxied
one, since org policy requires MCP traffic to route through RunLayer). A connector the user has
authorized on claude.ai but never mirrored into local config is invisible to mcx and to any chain.

Ask the user (yes/no) whether to review claude.ai connectors for syncing. Only continue if yes.

Run: `mcx sync-connectors --list`

This prints a JSON array of every connector ever connected (`claudeAiMcpEverConnected`, minus
"Claude Code Remote"), each with:
- `url`/`status` — resolved from `claude mcp list`, empty if that connector was never actually
  connected (nothing to sync).
- `alreadyConfigured` — true if a local server entry already targets the same URL.
- `localName`/`standardKey`/`needsRename` — the local entry's current key vs. the canonical
  lowercase key filters.yml/chains.yml expect; `needsRename: true` means the entry works today but
  under a name that won't match a shipped filter.

Present every candidate that isn't a dead end (skip entries with no `url` and
`alreadyConfigured: false` — nothing resolvable to sync) as rows in **one table**, not raw JSON,
ordered checkmarks first, then warnings, then question marks:

| Connector | Status | Detail |
|---|---|---|
| Notion_Gusto | ✅ | configured as `notiongusto` |
| Slack_Gusto_Offical | ⚠️ | configured as `slackgustoofficialmcp` — should be `slackofficalgusto` |
| Wiz_Gusto | ❓ | not configured yet |

- ✅ `alreadyConfigured: true` and `needsRename: false` — already configured correctly.
- ⚠️ `alreadyConfigured: true` and `needsRename: true` — configured, but under a name that won't
  match a shipped filter (Detail: current `localName` -> the `standardKey` it should be).
- ❓ non-empty `url` and `alreadyConfigured: false` — a connector this account has used before
  (`claudeAiMcpEverConnected`) that's currently reachable (has a live URL in `claude mcp list`) but
  isn't mirrored locally yet.

If there are no ⚠️ or ❓ rows, say everything's already configured correctly and skip the rest of
this step.

After the table, if there are any ⚠️ rows: tell the user the next step is renaming those so they
work correctly — mcx's shipped filters key off the tool name (e.g. `getJiraIssue`), and a filter
config only matches when the local server's key is the canonical lowercase form; a mismatched name
means the connector forwards fine but never gets filtered. Ask if they want those renamed now via
`mcx sync-connectors --only <name1>,<name2>,...` (it renames in place, no data loss).

Then, for the ❓ rows: ask the user which of these previously-used connectors they want to configure
now — they can reply with names, or ask to see the full list (some candidates may not fit legibly in
the table above; on request, re-print them as a **plain numbered list in prose**, not via the
question tool, since this list commonly runs 15-20+ items, well past its 4-option cap). Accept a
comma-separated reply, or "all"/"none", and parse their free-text reply yourself.

For whatever they chose (plus anything flagged `needsRename`, if they agreed to fix those too), run:
`mcx sync-connectors --only <name1>,<name2>,...`

Report exactly what the command printed (added / renamed / skipped-no-url). If anything was added
or renamed, tell the user: config changed, but credentials didn't — run `/mcp` (or just call the
tool once) to authenticate each new or renamed server before it will actually forward.

## 6. Offer to disable claude.ai MCP servers

Registering a connector locally (step 4) creates a second, redundant path to the same backend
alongside the original claude.ai connector — both work, but that duplication is confusing and the
claude.ai path bypasses mcx entirely (no filters, no chains, no keychain-based forwarding).

Ask the user, via the question tool (this is a single yes/no, not a list): do they want to set
`ENABLE_CLAUDEAI_MCP_SERVERS=false` in `~/.claude/settings.json`'s `env` block, to disable
claude.ai-sourced MCP servers now that the ones they use are mirrored locally?

If yes: read `~/.claude/settings.json`, add/update `env.ENABLE_CLAUDEAI_MCP_SERVERS` to `"false"`
preserving every other key, and tell the user this takes effect on their next Claude Code restart.
If no, or if they haven't synced anything they rely on yet, leave it untouched and say why.
