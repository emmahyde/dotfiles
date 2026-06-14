---
description: Interactive setup wizard for code-aware — choose which parts of the code-intelligence stack to turn on, then install tools, wire MCPs/hooks, inject CLAUDE.md rules, run grepai agent-setup, and pull down skills.
disable-model-invocation: true
---

You are running the **code-aware setup wizard**. Walk the user through configuring the code-intelligence-first environment, turning each component on or off per their choice, then execute the selected steps. Be idempotent, back up before writing, and report what changed.

`$CLAUDE_PLUGIN_ROOT` points at this plugin. The non-interactive engine lives at `$CLAUDE_PLUGIN_ROOT/install.sh` — drive it with flags for the heavy lifting, and run the extra integration commands yourself.

## 1. Detect current state first (don't assume)

Run these read-only probes and summarize what's already configured:
- Tools: `command -v ast-grep ctx7 sem lumen grepai ollama; command -v uvx && echo 'lizard via uvx'`
- Embed model: `ollama list 2>/dev/null | grep nomic-embed-text`
- Config: does `~/.claude/CLAUDE.md` contain `code-aware managed`? Is `~/.claude/.code-aware-configured` present? Which of `code-aware@emmahyde`, `lumen@ory`, `agentmemory@agentmemory`, `codemode@codemode-mcp` are in `~/.claude/settings.json` → `enabledPlugins`?
- Per-repo: is there a `.grepai/` here? a `.claude/agents/deep-explore.md`?

Show a short "current state" table so the user only turns on what's missing.

## 2. Ask what they want (use AskUserQuestion, multiSelect)

Offer these toggles, pre-noting which are already done:
1. **CLI tool stack** — ast-grep, ctx7, sem (brew), lizard (uvx), Ollama + `nomic-embed-text`.
2. **Marketplaces + plugins** — enable `code-aware`, `lumen`, `agentmemory`, `codemode`.
3. **Global settings mirror** — env, model, theme, statusline into `settings.json`.
4. **CLAUDE.md rules** — behavioral + investigation rules + auto-detected environment block.
5. **grepai integration (this repo)** — `grepai init` + `grepai agent-setup` (and the `--with-subagent` deep-explore agent).
6. **firecrawl MCP** — web scraping (will prompt for an API key, never stored in the repo).
7. **Skill packs / extra integrations** — pull down skill marketplaces the user names (e.g. the grepai skill set, design skills).

Confirm the selection before doing anything that writes.

## 3. Execute the selected steps

- **1–4 and 6** → call the engine with matching flags, e.g.
  `bash "$CLAUDE_PLUGIN_ROOT/install.sh" -y` for everything, or scope it:
  `--no-deps`, `--no-settings`, `--no-claudemd` to skip what they unchecked. It backs up and merges idempotently. (firecrawl is prompted at the end of the run.)
- **5 grepai (per-repo, verified commands)** — only inside a git repo:
  - `grepai init --provider ollama --model nomic-embed-text --yes` (skip if `.grepai/` exists)
  - `grepai agent-setup` — idempotently appends grepai usage to this repo's `CLAUDE.md`/`AGENTS.md`
  - if they want the subagent: `grepai agent-setup --with-subagent` — creates `.claude/agents/deep-explore.md`
  - offer to start the watcher: `grepai watch` (background daemon; mention it keeps the index fresh)
- **7 skill packs** — for each marketplace the user names: `/plugin marketplace add <owner/repo>` then `/plugin install <name>@<marketplace>`. Do **not** invent repos — only add ones the user confirms. Their config already knows `claude-design-skillstack` (freshtechbro/claudedesignskills).

## 4. Finish

- Write the sentinel so the session nudge stops: `touch ~/.claude/.code-aware-configured` (the engine does this too on a full run).
- Tell the user to **restart Claude Code** so new marketplaces, plugins, settings, and CLAUDE.md take effect.
- Print a one-line verification: `lumen index_status` · `sem --version` · `ast-grep --version` · `uvx lizard --version` · `ctx7 --version` · `grepai status`.

Keep it conversational and fast — surface state, confirm choices, apply, report. Never write a secret into the repo.
