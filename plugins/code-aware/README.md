# code-aware

A Claude Code plugin that bottles a **code-intelligence-first** working style: route every *discovery, impact, structure, and complexity* question to a purpose-built tool instead of `grep`/`Read`, and **never assume behavior without verifying it against real source**.

It ships:

- the **`codebase-investigation` skill** — a goal→tool routing table (lumen · sem · grepai · ast-grep · lizard · ctx7 · agentmemory), worked scenarios, exact tool APIs, and per-language gotchas (C#, Ruby);
- a **`/wizard` command** — an interactive setup flow that detects current state, asks what you want on/off, then installs tools, enables plugins, wires MCPs/hooks, injects CLAUDE.md rules, runs `grepai agent-setup`, and pulls down skills;
- two **SessionStart hooks** — one nudges you to run `/wizard` until the machine is configured (then goes quiet), the other reminds the agent the tool stack exists (once per session, in git repos);
- an **`install.sh` wizard** — the non-interactive engine `/wizard` drives; also runnable standalone to provision tools and mirror the author's global Claude Code config.

## Install

### A. The plugin (skill + reminder hook)

```
/plugin marketplace add emmahyde/dotfiles
/plugin install code-aware@emmahyde
```

`code-aware` declares cross-marketplace **dependencies** on `lumen@ory`, `agentmemory@agentmemory`, and `codemode@codemode-mcp` (the MCP servers behind the stack), so those are pulled in with it.

### B. The full environment (system tools + global config)

After installing the plugin, just run the command — a SessionStart nudge will remind you until you do:

```
/wizard
```

It detects what's already set up, asks which components you want, and applies only those. Prefer a non-interactive run? The engine it drives is runnable directly:

```bash
bash "$CLAUDE_PLUGIN_ROOT/install.sh"        # or clone the repo and run plugins/code-aware/install.sh
```

It is **idempotent** and **backs up** before every write. Flags:

| Flag | Effect |
|---|---|
| `-y`, `--yes` | assume yes (non-interactive) |
| `--dry-run` | show what would change, write nothing |
| `--no-deps` | skip system-tool install |
| `--no-settings` | skip the `settings.json` merge |
| `--no-claudemd` | skip the `CLAUDE.md` injection |

## What the wizard does

1. **System deps** — `brew install ast-grep ctx7 sem-cli`; verifies `uvx` for `lizard`; installs **Ollama** (official script, with confirmation) and pulls the `nomic-embed-text` embed model. `grepai` is treated as optional (no verified package source — it points you to the `grepai-installation` skill).
2. **Marketplaces + plugins** — merges the 5 marketplaces and enables `code-aware`, `lumen`, `agentmemory`, `codemode` via `settings.json`. Claude Code resolves and installs them on next launch.
3. **settings.json** — recursive `jq` merge of `env`, `model`, `statusLine`, `theme`, and the rest. Existing unrelated keys are preserved; the global SessionStart hook is intentionally **not** added (the plugin owns it, to avoid double-firing).
4. **CLAUDE.md** — injects the behavioral + investigation rules between managed markers (re-runnable), and appends an **auto-detected environment block** (`scripts/detect-env.sh`) that reports *actual* tool resolution rather than trusting a version manager.
5. **grepai integration** *(per-repo, optional)* — `grepai init` + `grepai agent-setup` (and `--with-subagent` for the `.claude/agents/deep-explore.md` exploration agent). Verified commands, run only inside a git repo.
6. **firecrawl MCP** *(optional)* — prompts for the API key; **never** hardcoded.

On a successful run it writes `~/.claude/.code-aware-configured`, which silences the `/wizard` nudge.

## The one rule

Before reaching for grep/Read/Glob: **"Do I already know the exact literal string?"** If no — you're exploring, understanding, or tracing relationships — use a tool from the skill. If yes — `rg` is the right, fast choice.

## Layout

```
code-aware/
├── .claude-plugin/plugin.json
├── commands/wizard.md               # /wizard interactive setup
├── skills/codebase-investigation/   # SKILL.md + resources/ + languages/
├── hooks/
│   ├── hooks.json                   # SessionStart → wizard-nudge + session-reminder
│   └── wizard-nudge.sh              # nags to run /wizard until configured
├── scripts/detect-env.sh            # generates the CLAUDE.md environment block
├── templates/                       # claude-md-block.md, settings.merge.json
├── install.sh
└── README.md
```
