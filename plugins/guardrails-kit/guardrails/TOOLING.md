<!-- User tool-stack playbook (not kit text — edit freely). Read the section your trigger named; obey it for the rest of the session. -->
You are here because a Tool routing row in ~/.claude/CLAUDE.md fired. These sections replace the always-loaded deleg8/browser/tokensave blocks of the old CLAUDE.md.

## §deleg8
`deleg8` wraps `omp --mode rpc` as persistent, resumable subagents via MCP. All subagent WORK goes through deleg8; native Task/Agent is reserved for read-only exploration. Consult the advisor as a reviewer before committing to a substantive approach, when available.
- `mcp__deleg8__spawn` (fan out; `background: true` for long builds/tests) → review → `mcp__deleg8__send` follow-ups to the same agent (it keeps context) → `mcp__deleg8__output` with `digest`/`summary`/`raw`.
- Wave orchestration: agent A analyzes → read it → agent B implements from it.
- Always pass a descriptive `agent_id` (`compiler`, `security-auditor`, `ui-builder`) — never an unnamed, role-less agent.
- Model: deleg8 agents default to the session model unless `model` is set. Native Agent-tool spawns default to `CLAUDE_CODE_SUBAGENT_MODEL` in `~/.claude/settings.json` (currently `claude-sonnet-5`) — pass `model` explicitly only to override it.
- After fan-out sessions: `mcp__deleg8__prune({ states: ["idle", "dead"] })`.
- Full reference: skill `deleg8` or `~/projects/deleg8/skills/deleg8/references/tools.md`.

## §browser
- Claude in Chrome / computer-use only for genuine interaction: clicking, form filling, logins, visual verification, screenshots.
- Searching or reading information → direct fetch instead (WebFetch / web search tools) — faster, cheaper, no browser overhead.

## §tokensave
`tokensave` — semantic code graph over 34 languages, a local index per project. **Conditional: it only exists where `.tokensave/` exists in the repo root.** Indexed as of 2026-07-24: `~/projects/sector`, `~/projects/art-game`. Measured value where indexed: 93 tool calls / 2.0M tokens saved over 30d in `~/projects/sector`; zero in unindexed projects, where every rule below is inert.
- `.tokensave/` present → answer "where does X live / who calls it / what breaks if I change it" with `tokensave_context`, `tokensave_search`, `tokensave_callers`, `tokensave_callees`, `tokensave_impact`, `tokensave_affected` before Grep or an Explore agent.
- `.tokensave/` absent → Grep and Glob are correct. Do not call `tokensave_status` to find out; `ls .tokensave` already answered it.
- Beyond the built-in tools → query `.tokensave/tokensave.db` directly (tables: `nodes`, `edges`, `files`).
- Spawning an Explore agent in an indexed project → put this in its prompt: "This project has tokensave initialised. Use `tokensave_context` as your ONLY exploration tool — call it with a plain-English question; the source sections it returns ARE the relevant code. Pass `seen_node_ids` forward as the next call's `exclude_node_ids`."
- A `PreToolUse` hook on `Agent|Grep|Bash` already intercepts this — the rule above is the intent, the hook is the enforcement.
- Audit whether it is still earning: `tokensave gain` (cwd-scoped), `tokensave list`. Gaps worth filing: https://github.com/aovestdipaperino/tokensave — strip proprietary code from the report first.
