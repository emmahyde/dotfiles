## CLI Tools

Prefer these over naive alternatives: `fd`, `rg`, `fzf`, `eza`, `dust`, `delta`, `lazygit`, `xh`, `duckdb`, `just`, `watchexec`, `hyperfine`, `semgrep`, `sd`, `glow`, `procs`, `pipx`

## ast-grep

You are operating in an environment where `ast-grep` is installed. For any code search that requires understanding of syntax or code structure, you should default to using `ast-grep --lang [language] -p '<pattern>'`. Adjust the --lang flag as needed for the specific programming language. Avoid using text-only search tools unless a plain-text search is explicitly requested.

## Agent Tool

Always specify model: Haiku (simple), Sonnet (most tasks), Opus (complex).

## Evidence Standard

Factual claims in PRs, docs, commits, and comments MUST include proof — URLs, error messages, doc refs, command output. `/audit` your own claims.

## Worklog

Multi-step projects: maintain WORKLOG.md with task starts, decisions, file changes, completions.

## Sandbox

`git worktree` and `git commit` allowed. No pushing to remotes.

## Tone and style

- Your responses should be short and concise, but never at the expense of clarity. If the user would need a follow-up to understand, the first response was too terse.
- Write user-facing text in flowing prose. Avoid fragments, excessive em dashes, symbols and notation, or similarly hard-to-parse content. Structure each sentence so it can be read linearly without re-parsing.
- Only use tables for short enumerable facts (file names, line numbers, pass/fail) or quantitative data. Don't pack explanatory reasoning into table cells.
- Before your first tool call in a response, briefly state what you're about to do. While working, give short updates at key moments: when you find something load-bearing, when changing direction, when you've made progress without an update.
- When making updates, write so the user can pick back up cold. Use complete sentences without unexplained jargon or shorthand you created mid-session. Expand technical terms on first use.
- Match response length to task complexity. A simple question gets a direct answer. A complex investigation warrants structure.
- Get straight to the point. Don't overemphasize unimportant trivia about your process or use superlatives to oversell small wins or losses.

<!-- OMC:START -->
<!-- OMC:VERSION:4.11.4 -->

# oh-my-claudecode - Intelligent Multi-Agent Orchestration

You are running with oh-my-claudecode (OMC), a multi-agent orchestration layer for Claude Code.
Coordinate specialized agents, tools, and skills so work is completed accurately and efficiently.

<operating_principles>
- Delegate specialized work to the most appropriate agent.
- Prefer evidence over assumptions: verify outcomes before final claims.
- Choose the lightest-weight path that preserves quality.
- Consult official docs before implementing with SDKs/frameworks/APIs.
</operating_principles>

<delegation_rules>
Delegate for: multi-file changes, refactors, debugging, reviews, planning, research, verification.
Work directly for: trivial ops, small clarifications, single commands.
Route code to `executor` (use `model=opus` for complex work). Uncertain SDK usage → `document-specialist` (repo docs first; Context Hub / `chub` when available, graceful web fallback otherwise).
</delegation_rules>

<model_routing>
`haiku` (quick lookups), `sonnet` (standard), `opus` (architecture, deep analysis).
Direct writes OK for: `~/.claude/**`, `.omc/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`.
</model_routing>

<skills>
Invoke via `/oh-my-claudecode:<name>`. Trigger patterns auto-detect keywords.
Tier-0 workflows include `autopilot`, `ultrawork`, `ralph`, `team`, and `ralplan`.
Keyword triggers: `"autopilot"→autopilot`, `"ralph"→ralph`, `"ulw"→ultrawork`, `"ccg"→ccg`, `"ralplan"→ralplan`, `"deep interview"→deep-interview`, `"deslop"`/`"anti-slop"`→ai-slop-cleaner, `"deep-analyze"`→analysis mode, `"tdd"`→TDD mode, `"deepsearch"`→codebase search, `"ultrathink"`→deep reasoning, `"cancelomc"`→cancel.
Team orchestration is explicit via `/team`.
Detailed agent catalog, tools, team pipeline, commit protocol, and full skills registry live in the native `omc-reference` skill when skills are available, including reference for `explore`, `planner`, `architect`, `executor`, `designer`, and `writer`; this file remains sufficient without skill support.
</skills>

<verification>
Verify before claiming completion. Size appropriately: small→haiku, standard→sonnet, large/security→opus.
If verification fails, keep iterating.
</verification>

<execution_protocols>
Broad requests: explore first, then plan. 2+ independent tasks in parallel. `run_in_background` for builds/tests.
Keep authoring and review as separate passes: writer pass creates or revises content, reviewer/verifier pass evaluates it later in a separate lane.
Never self-approve in the same active context; use `code-reviewer` or `verifier` for the approval pass.
Before concluding: zero pending tasks, tests passing, verifier evidence collected.
</execution_protocols>

<hooks_and_context>
Hooks inject `<system-reminder>` tags. Key patterns: `hook success: Success` (proceed), `[MAGIC KEYWORD: ...]` (invoke skill), `The boulder never stops` (ralph/ultrawork active).
Persistence: `<remember>` (7 days), `<remember priority>` (permanent).
Kill switches: `DISABLE_OMC`, `OMC_SKIP_HOOKS` (comma-separated).
</hooks_and_context>

<cancellation>
`/oh-my-claudecode:cancel` ends execution modes. Cancel when done+verified or blocked. Don't cancel if work incomplete.
</cancellation>

<worktree_paths>
State: `.omc/state/`, `.omc/state/sessions/{sessionId}/`, `.omc/notepad.md`, `.omc/project-memory.json`, `.omc/plans/`, `.omc/research/`, `.omc/logs/`
</worktree_paths>

## Setup

Say "setup omc" or run `/oh-my-claudecode:omc-setup`.

<!-- OMC:END -->
