# guardrails-kit — just-in-time instruction loader for Claude Code

The guardrails kit replaces the conventional "style guide in CLAUDE.md" pattern with a dispatch table. Instead of front-loading every rule into every context window, `CLAUDE.md` becomes a routing layer: a table of observable events triggers a just-in-time read of the single document that applies right now. The dispatched docs (`PLAN.md`, `CODE.md`, `DEBUG.md`, `VERIFY.md`, `WRITING.md`, `SESSION.md`, `TOOLING.md`, `TASKS.md`, `EFFICIENCY.md`, `_FORMAT.md`, `TRAPS.md`, `README.md`) are short, budgeted, versioned, and mechanically enforceable — read only when their trigger fires, never pre-loaded. Budget philosophy: rules consume context budget only when they're relevant, so every line can pull its weight without starving the real task.

## Layout

| Path | Contents |
|---|---|
| `guardrails/` | 12 routed kit docs (PLAN, CODE, DEBUG, VERIFY, WRITING, SESSION, TOOLING, TASKS, EFFICIENCY, FORMAT, TRAPS, README) |
| `rules/markdown-writing.md` | Source-only writing conventions file (referenced by WRITING.md) |
| `hooks/` | 5 enforcement hooks (git-push-guard.sh, kill-by-name-guard.sh, generated-file-read-guard.sh, session-capabilities.sh, task-framework.py) |
| `templates/` | CLAUDE.md blocks (`kit-core.md`, `kit-footer.md`) with `{{CLAUDE_DIR}}` placeholders for install-time substitution |
| `install.sh` | Idempotent installer — deploys docs, hooks, and splices routing blocks into CLAUDE.md |

## Install

1. Subscribe to the emmahyde marketplace in `settings.json` under `extraKnownMarketplaces`:
   ```json
   "emmahyde-dotfiles": {
     "source": { "source": "github", "repo": "emmahyde/dotfiles" },
     "plugins": { "guardrails-kit@emmahyde-dotfiles": true }
   }
   ```
2. Run `./install.sh` from the plugin directory.

The installer deploys docs to `$CLAUDE_CONFIG_DIR` (or `~/.claude`), registers the five kit hooks, and splices the routing table into `CLAUDE.md` between the `<!-- BEGIN KIT CORE v1.3 -->` … `<!-- END KIT CORE -->` and `<!-- BEGIN KIT FOOTER v1.3 -->` … `<!-- END KIT FOOTER -->` marker pairs. Everything between those markers is managed by the kit; everything outside them (most importantly, the `## Project` user layer) is preserved untouched.

## Update

Pull new kit versions, then re-run `./install.sh`. The installer is idempotent and safe to run repeatedly — it backs up existing files (`.bak.<timestamp>`) before writing, and only overwrites what it owns between the kit markers.

## What stays user-local

- The `## Project` section of `CLAUDE.md` — your personal workspace rules, tool preferences, constraints, and environment notes live between the kit footer and the end of the file, and the installer never touches them.
- Non-kit hooks in `~/.claude/hooks/` — only the five kit hooks listed above are managed; any user-authored hooks remain yours.
- `settings.json` fields beyond the five hook registrations — the installer only manages the hook entries owned by the kit.

## Kit text contract

Kit docs are budgeted (trimmed to the minimum that shifts behavior), versioned (`<!-- guardrails-kit: vN.N -->` comments at document heads), and ID-stable (every rule carries a fixed label like `F12` so references don't drift across versions). Edit these documents deliberately and per the conventions in `_FORMAT.md`; never paraphrase, reflow, or "clean up" kit prose — the exact wording is part of the mechanism. New editions ship through the marketplace; local edits are your own fork.
