# Claude Code Configuration

Custom skills, hooks, commands, and settings for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

## Structure

```
claude/
  CLAUDE.md          # Global instructions (loaded into every session)
  settings.json      # Permissions, hooks, plugins, model config
  settings.local.json # Machine-local env overrides
  hooks.json         # File-pattern hooks (e.g. protect schema.rb)
  skills/            # Custom skills (~35 skills)
  hooks/             # Hook scripts referenced by settings.json
  commands/          # Slash commands (currently: gsd/*)
```

## Installation

Symlink or copy into `~/.claude/`:

```bash
# Symlink approach (recommended — changes sync with git)
./install.sh

# Or copy manually
cp -R claude/* ~/.claude/
```

## Notes

- `settings.json` contains absolute paths to `~/.claude/hooks/` — these work as-is if installed to the default location.
- Plugin-installed skills are **not** included here; install them via their marketplace repos.
- The `settings.json` `permissions` block includes project-specific entries that you may want to prune for your setup.
