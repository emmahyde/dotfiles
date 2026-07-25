# mcx

A small standalone CLI — and a Claude Code plugin — that cuts the context large MCP tool calls
burn, and stays out of your way. `mcx` is an MCP *client*; it is never itself an MCP server.

It does three things:

1. **forward** — call a tool on any external MCP server Claude Code already knows about, injecting
   the OAuth token from your macOS keychain (refreshed when expired).
2. **run / register** — run heredoc-fed source or a script path as an ad-hoc **chain**, or save it as a named chain only when
   reuse is requested; a chain fans several MCP calls out in one sandboxed run and returns only a digest.
3. **filter** — reshape a tool's result with declarative **filters**, so cruft never reaches the
   model. As a plugin, this runs automatically on every MCP call.

## Quickstart

The heart of mcx is two registries, split by what they do:

| | **Filters** | **Chains** |
|---|---|---|
| Purpose | filter cruft from *one* tool's result | collapse *many* MCP calls into one digest |
| Form | declarative YAML (`keep`/`drop`/`rename`/`truncate`) | a script (ruby/python/js/shell) |
| Runs | automatically, every matching call (PostToolUse hook) | deliberately, when you `mcx run` it |
| Config | `filters.yml`, keyed by MCP tool name | `chains.yaml` + inferred scripts, keyed by chain name |
| Command | `mcx filter` | `mcx run JSON LANG < SCRIPT` or `mcx run JSON PATH`; optionally `register` / `list` / `remove` |

Rule of thumb: **filters** cut cruft from a single call (safe, automatic); **chains** collapse a
fan-out or a cross-service join into one call whose only context cost is the answer.

```sh
go build -o bin/mcx ./cmd/mcx
# optionally: cp bin/mcx ~/.local/bin/
```

Requires Go 1.25+. The keychain OAuth path is macOS-only; elsewhere `forward` still works for
servers that carry static headers in config.

```sh
# see the MCP servers mcx can already reach (from config ∪ keychain)
mcx forward --list

# call a tool on one of them — the OAuth token is pulled from the keychain for you
mcx forward --server jiraconfluencegusto --tool atlassianUserInfo --args '{}'

# save a script as a reusable chain (name/lang/desc inferred) and run it
mcx register ./chains/batch_triage.rb
mcx run '{"cloudId":"…","field":"customfield_14733","value":"Testing Not Needed","keys":["TICKET-1234","TICKET-1234"]}' batch-triage
```

## Benchmarks

The same work done natively drops every raw payload into the window. Measured with
`tiktoken cl100k_base` against **real payloads** captured live from the RETIRE Jira project + Notion
+ Slack (`bench/capture_live.rb`):

| Scenario | Native ctx | % of 200k | mcx ctx | mcx % of native |
|---|---:|---:|---:|---:|
| batch-triage (14× editJiraIssue) | 22,050 | 11.0% | 223 | 1.0% |
| Sprint metrics → Sheet (40 issues) | 15,011 | 7.5% | 157 | 1.0% |
| Jira + Notion cross-ref | 16,123 | 8.1% | 233 | 1.4% |
| 5× getJiraIssue (fan-out) | 9,281 | 4.6% | 239 | 2.6% |
| editJiraIssue (bloated response) | 1,566 | 0.8% | 80 | 5.1% |
| Notion roadmap ↔ Jira reconcile | 26,337 | 13.2% | 1,922 | 7.3% |
| getJiraIssue | 1,559 | 0.8% | 172 | 11.0% |
| Slack thread → triaged bug | 1,613 | 0.8% | 180 | 11.2% |
| searchJiraIssues (10 results) | 2,985 | 1.5% | 408 | 13.7% |

The last column is what mcx keeps: the fan-out and cross-ref rows collapse to ~1% of the native
context because they multiply or join large payloads. Savings scale with payload size. Reproduce:
`CLOUD_ID=<id> ruby bench/capture_live.rb && MCX_FIXTURES=bench/captures ruby bench/bench.rb`. No
servers? `ruby bench/bench.rb` runs the same scenarios over synthetic fixtures. Full methodology in
`bench/README.md`.

## Configuration

Both registries merge across three layers, most specific winning:

```text
plugin default  ${CLAUDE_PLUGIN_ROOT}   shipped, everyone
project         <cwd>/.mcx/             team, committed
user            ~/.config/mcx/          personal   (honors XDG_CONFIG_HOME; where register writes)
```

A malformed config or a bad file reference in one layer is warned about on stderr and skipped — it
never hides the other layers' chains.

### Filters

*`filters.yml`, keyed by full MCP tool name*

Operations apply in the fixed order **keep → drop → rename → truncate**, over **dotted paths** (no
wildcards — every touched field is explicit). This example exercises all four on one tool:

```yaml
mcp__jiraconfluencegusto__getJiraIssue:
  keep: ["key", "fields.summary", "fields.description", "fields.status", "fields.reporter"]
  drop:
    - fields.status.self
    - fields.status.iconUrl
    - fields.reporter.self
    - fields.reporter.avatarUrls
    - fields.reporter.active
    - fields.reporter.accountType
    - fields.reporter.timeZone
  rename:
    fields.reporter.emailAddress: fields.reporter.email
  truncate:
    fields.summary: 20
    fields.description: 30
```

- **`keep`** — allowlist. Keep only these paths (whole subtrees included); prune everything else.
- **`drop`** — denylist. Remove these paths (here, cruft *within* what `keep` retained).
- **`rename`** — move `"from.path": "to.path"` (here `reporter.emailAddress` → `reporter.email`).
- **`truncate`** — cap a string field at N chars: `"path": maxChars`.

That's the whole surface. Reaching past it means you want a *chain*, not a filter. Shipped defaults
are **drop-only** (they can't hide signal); `keep`/`rename`/`truncate` are yours to add per project or
per user.

### Chains

*`chains.yaml`, keyed by chain name; three ways to supply the script*

A chain entry carries its script one of three ways. All three resolve identically at `run` time. The
config is YAML, so an inline `source` is a real multi-line block scalar (`|`) — not an escaped string:

```yaml
batch-triage:
  language: ruby
  description: flip one custom field across many Jira issues; return only a count
  source: |
    done = args["keys"].map do |key|
      forward(
        "jiraconfluencegusto",
        "editJiraIssue",
        {
          "cloudId" => args["cloudId"],
          "issueIdOrKey" => key,
          "fields" => {
            args["field"] => {
              "value" => args["value"]
            }
          }
        }
      )
      key
    end
    emit(
      {
        "updated" => done.length,
        "field" => args["field"],
        "value" => args["value"],
        "keys" => done
      }
    )

sprint-to-sheet:
  language: ruby
  path: chains/sprint_to_sheet.rb
```

1. **Inline source** (`batch-triage` above) — the script lives in the `source` block scalar, so the
   chain is self-contained. This is what `mcx register` writes. It fans `editJiraIssue` over every key,
   then `emit`s just a count and the keys touched (see [the before/after](#chain-batch-field-update-across-14-issues)).
2. **File path** (`sprint-to-sheet` above) — `path` points at a script file, resolved relative to the
   config's layer directory.
3. **Loose script** — drop a file into a `chains/` directory beside `chains.yaml`; name, language, and
   description are inferred (filename → name, extension → language, first comment → description), no
   `chains.yaml` entry needed. This is how the plugin ships its examples.

*(Legacy `chains.json` is still read, so existing JSON configs keep working; `register` writes YAML.)*

`mcx register ./chain.rb` is the minimal path: it infers everything and writes an inline-source entry
to your user layer.

```sh
$ mcx register ./chains/batch_triage.rb
registered "batch-triage" (ruby) inline in the user config
$ mcx list
batch-triage         ruby     user     flip one custom field across many Jira issues; return only a count
sprint-to-sheet      ruby     plugin   sprint_to_sheet — roll up the open sprint into status/assignee counts.
…
```

## Before and after

Each configured example above, as the model actually sees it.

### Filter: getJiraIssue

The model calls the tool as usual:

```
mcp__jiraconfluencegusto__getJiraIssue({"cloudId":"…","issueIdOrKey":"PROJ-1234"})
```

**Before** — the raw result (excerpt; the full payload is 15 top-level and nested-object fields, most
of them `self` URLs, avatar URLs, and account metadata):

```json
{
  "expand": "renderedFields,names,schema,…",
  "id": "10042",
  "self": "https://example.atlassian.net/rest/api/3/issue/10042",
  "key": "PROJ-1234",
  "fields": {
    "summary": "Sanitized example issue summary",
    "description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "created": "…", "updated": "…", "labels": [...], "issuetype": {...}, "priority": {...},
    "project": {...}, "components": [...],
    "status": {"self": "…", "iconUrl": "…", "name": "In Progress", "id": "10002", "statusCategory": {...}},
    "reporter": {
      "self": "https://example.atlassian.net/rest/api/3/user?accountId=…",
      "accountId": "aaaaaaaaaaaaaaaaaaaaaaaa", "emailAddress": "reporter@example.com",
      "displayName": "Example Reporter", "active": true, "timeZone": "America/Los_Angeles",
      "accountType": "atlassian", "avatarUrls": {"48x48": "…", "24x24": "…", "16x16": "…", "32x32": "…"}
    }
  }
}
```

**After** — the filter above, applied by the PostToolUse hook, replaces it with exactly this:

```json
{
  "key": "PROJ-1234",
  "fields": {
    "summary": "Sanitized example is",
    "description": "Lorem ipsum dolor sit amet, co",
    "status": {
      "description": "Work is in progress.", "name": "In Progress", "id": "10002",
      "statusCategory": {"key": "indeterminate", "name": "In Progress", "colorName": "yellow", "id": 4, "self": "…"}
    },
    "reporter": {"accountId": "aaaaaaaaaaaaaaaaaaaaaaaa", "displayName": "Example Reporter", "email": "reporter@example.com"}
  }
}
```

`keep` dropped `expand`/`id`/`self` and eight unkept `fields.*`; `drop` stripped the `self`/`iconUrl`
and reporter metadata within what survived; `rename` turned `reporter.emailAddress` into
`reporter.email`; `truncate` cut summary to 20 chars and description to 30. Measured on the
checked-in capture: **779 → 108 tokens — ~14% of the original**, and reproducible with
`mcx filter --config <this> < testdata/captures/getJiraIssue.json`.

### Chain: batch field update across 14 issues

Say you're flipping one custom field (`customfield_14733` → `"Testing Not Needed"`) across an epic's
14 stories.

**Before** — done natively, the model calls `editJiraIssue` 14 times, and Jira echoes the **entire
updated issue** on every call — summary, description, project, reporter, avatars, status — even though
you changed one field. Two of the fourteen echoes, abbreviated:

```
editJiraIssue(issueIdOrKey: "TICKET-1234", fields: {"customfield_14733": {"value": "Testing Not Needed"}})
{
  "expand": "renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations",
  "id": "3012909", "self": "https://api.atlassian.com/ex/jira/…/issue/3012909", "key": "TICKET-1234",
  "fields": {
    "summary": "WU-01: [DB] Batch execution columns, WorkUnit state, and events table",
    "description": "**Summary:** The additive schema migration set for the Model B engine. Verified NOT merged on `main`…",  // ~1,400 chars
    "issuetype": {"self": "…", "iconUrl": "…", "avatarId": 10315, …},
    "project": {"self": "…", "avatarUrls": {"48x48": "…", "24x24": "…", "16x16": "…", "32x32": "…"}, …},
    "reporter": {"self": "…", "avatarUrls": {"48x48": "…", …}, "accountId": "712020:…", …},
    "priority": {"self": "…", "iconUrl": "…"}, "status": {"self": "…", "iconUrl": "…", …}, …
  }
}

editJiraIssue(issueIdOrKey: "TICKET-1234", fields: {"customfield_14733": {"value": "Testing Not Needed"}})
{
  "expand": "renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations",
  "id": "3012910", "self": "…", "key": "TICKET-1234",
  "fields": { "summary": "WU-03: Durable event-log port (Medusa::Event + Events.emit, persist only)", … }
}
```

At ~1,566 tokens per echoed issue, fourteen echoes plus the fourteen `editJiraIssue` calls the model
emits come to **22,050 tokens** — the `batch-triage` benchmark row — none of which you needed to see.
The model just wanted to know the edits landed.

**After** — the `batch-triage` chain (defined in [Chains](#chains) above) does all 14 edits inside the
sandbox and emits one line:

```sh
$ mcx run '{"cloudId":"…","field":"customfield_14733","value":"Testing Not Needed","keys":["TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234"]}' batch-triage
{"updated":14,"field":"customfield_14733","value":"Testing Not Needed","keys":["TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234","TICKET-1234"],"failed":[]}
```

**223 tokens end to end — the `mcx run` command plus the returned digest — ~1% of the native context.** All fourteen
full echoes are read and discarded inside the sandbox; the model sees only the confirmation, the keys
touched, and any that failed. *(Both figures from the `batch-triage` benchmark row, `tiktoken
cl100k_base`, measured against 14× a real `editJiraIssue` capture; live payloads with long descriptions
run larger.)*

## How the plugin wires into Claude Code

Installed, mcx registers two hooks and two skills (`.claude-plugin/plugin.json`, `hooks/hooks.json`).
Both hooks are **fail-open**: a failure never breaks the tool call or the prompt.

### Tool-output override (PostToolUse)

The plugin registers a PostToolUse hook with matcher `mcp__.*`, so after *any* external MCP tool
returns, Claude Code runs:

```
${CLAUDE_PLUGIN_ROOT}/scripts/mcx filter --config ${CLAUDE_PLUGIN_ROOT}/filters.yml
```

The hook receives the tool call's result on stdin. When the tool has a configured filter, `mcx filter`
emits a `hookSpecificOutput.updatedToolOutput` object, and Claude Code **substitutes it for the real
result** before the model sees anything:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "updatedToolOutput": { "content": [{"type": "text", "text": "<reshaped JSON>"}], "isError": false }
  }
}
```

The reshape happens only inside `content[].text`; `isError`, `structuredContent`, and `_meta` are
preserved, so the replacement still matches the `CallToolResult` shape the field requires. The Filter
before/after above is this same path — but note it uses an *illustrative* all-ops config (keep + drop +
rename + truncate → 108 tokens). The config **shipped** in `filters.yml` is deliberately **drop-only**,
so out of the box `getJiraIssue` is pruned (cruft/URLs/avatars dropped) but *not* renamed or truncated —
a larger, differently-shaped result than the 108-token example. Add the keep/rename/truncate ops yourself
(per project or user) to get there. If the tool has no filter, the input is malformed, the reshape is a
no-op, or **`MCX_FILTER=off`**, the hook emits nothing (exit 0) and the original result stands untouched.

### mcx mention routing (UserPromptSubmit)

The `mcx nudge` hook runs on every user prompt. When the prompt contains the word **mcx**, it injects
`additionalContext` requiring the agent to consult `/mcx:mcx` instead of guessing at the CLI or treating
the name as a typo. It fires at most once per session (guarded by a marker under
`CLAUDE_PLUGIN_DATA`), is fail-open, and can be disabled with **`MCX_NUDGE=off`**:

```sh
$ echo '{"prompt":"use mcx for this","session_id":"s1"}' | mcx nudge
```
```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "mcx note: this prompt mentions \"mcx\" — that is the mcx CLI/plugin (forwarding to MCP servers, registered chains, filters), never a typo. Call the /mcx:mcx skill for usage guidance before acting on this."
  }
}
```

### Live routing gate (PostToolUse)

Alongside filtering, `mcx observe` counts MCP calls in the session. From the second unchained call onward,
its `additionalContext` says **STOP before another direct MCP call**, requires invoking `/mcx:new`, and
requires an explicit choice between an existing chain, a heredoc-fed ad-hoc `mcx run`, or the narrow isolated-
call exception. `/mcx:save` handles persistence only when the user asks. A large unfiltered result
similarly routes `/mcx:new` to the filter workflow. The handler remains fail-open;
**`MCX_OBSERVE=off`** disables these gates.

### How an inline chain runs

Take the inline `batch-triage` entry above. When you `mcx run batch-triage`:

1. **Resolve.** mcx merges the three layers by name and picks the winner; the resolved chain's `source`
   (or the contents of its `path`, or the loose file) becomes the code to execute — no file is read at
   run time for an inline chain.
2. **Bake helpers.** The chosen runtime (ruby/python/javascript, by `language`) is prefixed with a
   preamble defining `forward(server, tool, args = {})` — which shells out to `mcx forward` (keychain
   OAuth handled) and parses the result, raising on a tool error — `emit(obj)`, the single digest sink
   (a String passes through; anything else is JSON-encoded), and `args`, the parsed `--args` JSON. A
   chain writes none of this plumbing itself.
3. **Sandbox.** The script runs in a sandbox whose environment is stripped to a safe allow-list
   (PATH/HOME/locale only) — **no API keys or tokens reach the script**. Data comes in only through
   `args` (the `--args` JSON, delivered on stdin and parsed for you).
4. **Digest out.** Whatever the script `emit`s is written to stdout. Every `forward` payload it fetched
   stays inside the sandbox and is discarded; only the emitted digest survives.

So a chain that edits fourteen issues — fourteen full echoes inside the sandbox — costs the context
only the 223-token confirmation, because steps 3–4 guarantee the raw payloads never leave the sandbox.

## Command reference

### `mcx forward`: call one MCP tool

Resolves a server from your config, injects a keychain bearer token if the server needs one, calls the
tool, and prints the JSON result.

```sh
$ mcx forward --server jiraconfluencegusto --tool atlassianUserInfo --args '{}'
```
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"account_id\":\"712020:8675c700-…\",\"name\":\"Jane Doe\",\"email\":\"jane.doe@example.com\"}"
    }
  ]
}
```

`--server` is any name from your MCP config (`<cwd>/.mcp.json`, `~/.claude.json` global or per-project
`mcpServers`, or `~/.claude/*.json`). For an HTTP server with no auth header of its own, mcx looks up the
OAuth entry Claude Code stored under the keychain item `Claude Code-credentials`, injects
`Authorization: Bearer <token>`, and refreshes it via the `refresh_token` grant if expired (rediscovering
the token endpoint per RFC 8414).

### `mcx forward --list`: discover servers

`[keychain-auth]` marks HTTP servers whose token lives only in the keychain.

```text
bamboo                       stdio    /opt/homebrew/opt/mise/bin/mise
context7                     http     https://…/mcp [keychain-auth]
jiraconfluencegusto          http     https://…/mcp [keychain-auth]
notiongusto                  http     https://…/mcp [keychain-auth]
sentry                       stdio    npx
```

### `mcx run` / `register` / `list` / `remove`

The default for a newly written workflow is a heredoc-fed ad-hoc run, which creates neither a file nor a registry entry:

```sh
$ mcx run '{…}' ruby <<'RUBY'
rows = args["keys"].map do |key|
  forward("jiraconfluencegusto", "getJiraIssue", {
    "cloudId" => args["cloudId"], "issueIdOrKey" => key
  })
end
emit(rows.map { |issue| { key: issue["key"], summary: issue.dig("fields", "summary") } })
RUBY
```

`mcx run JSON PATH` is also ad hoc. `/mcx:save` registers only when the user asks to persist the proven workflow:

```sh
$ mcx register ./chains/fanout_get_jira.rb        # name/lang/desc inferred; stored inline
$ mcx list                                        # all chains across layers, with origin
$ mcx run '{…}' fanout-get-jira            # args JSON on stdin; prints the digest
$ mcx remove fanout-get-jira                      # user-layer only
```

A plugin- or project-provided chain can't be removed (it isn't yours):

```sh
$ mcx remove sprint-to-sheet
mcx: registry: no user chain named "sprint-to-sheet" (plugin/project chains can't be removed)
```

### `mcx filter` / `nudge` / `observe`

The three hook entry points, documented above. You rarely run them by hand. `filter` reshapes a tool
result (PostToolUse); `observe` (also PostToolUse) imposes the chain/filter routing gate; `nudge`
routes prompts that name mcx to `/mcx:mcx` (UserPromptSubmit). All are fail-open.

### `mcx scan`

Analyze a transcript for MCP calls a chain or filter could collapse:

```sh
mcx scan                          # newest transcript for this project
mcx scan --transcript path.jsonl  # a specific transcript
```

Reports **chain candidates** once a transcript contains at least two MCP calls and **filter candidates** (large results with no
filter configured). The `/setup` command runs this for you and offers to act on the results.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `MCX_FORWARD_TIMEOUT` | per-call forward timeout (`2m`, `90s`, or bare seconds) | `120s` |
| `MCX_EXECUTE_TIMEOUT` | per-run chain timeout | `120s` |
| `MCX_FILTER` | set to `off` to disable filter reshaping | (on) |
| `MCX_NUDGE` | set to `off` to disable the prompt-mentions-mcx reminder | (on) |
| `MCX_OBSERVE` | set to `off` to disable the chain/filter routing gates | (on) |
| `XDG_CONFIG_HOME` | base dir for the user layer (chains + config) and refresh locks | `~/.config` |

## Development

```sh
go build ./...
go vet ./...
go test ./...
GOOS=linux go build ./...   # verify the non-macOS keychain stub still builds
```

Plugin layout: `.claude-plugin/plugin.json`, `hooks/hooks.json`, `scripts/mcx` (the built binary the
hooks invoke via `${CLAUDE_PLUGIN_ROOT}`), `skills/` (`/mcx:mcx` routing/reference + `/mcx:new` ephemeral creation + `/mcx:save` persistence),
`commands/setup.md` (the `/setup` command), `filters.yml` (shipped drop-only defaults), `chains/*.rb`
(example chains). Rebuild with `go build -o scripts/mcx ./cmd/mcx` — a `lefthook` pre-commit hook does
this automatically on any Go change (run `lefthook install` once per clone).

See `CLAUDE.md` for the internals — the keychain credential shape, the RFC 8414 refresh path, the
filter/chain resolution model, and the gotchas worth knowing before changing anything.
