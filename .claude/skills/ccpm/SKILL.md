---
name: ccpm
description: Search, browse, and install Claude Code skills/plugins via the ccpm package manager. Use when the user asks to find skills, search for plugins, install community skills, or browse popular/recent packages.
---

# CCPM — Claude Code Plugin Manager

CLI tool for discovering and managing community Claude Code skills and plugins.

## Commands

All commands use `npx @daymade/ccpm`.

### Search & Browse

```bash
# Search by keyword
npx @daymade/ccpm search <query>

# Show most popular skills
npx @daymade/ccpm popular

# Show recently published/updated skills
npx @daymade/ccpm recent

# Detailed info about a skill
npx @daymade/ccpm info <name>

# Read reviews
npx @daymade/ccpm reviews <skill>
```

### Install & Manage

```bash
# Install a skill
npx @daymade/ccpm install <name>
# or a specific version
npx @daymade/ccpm install <name>@1.0.0

# Install a bundle of skills
npx @daymade/ccpm install-bundle <bundle-name>

# List installed skills
npx @daymade/ccpm list

# Update a skill (or all)
npx @daymade/ccpm update [name]

# Uninstall
npx @daymade/ccpm uninstall <name>
```

### Publish

```bash
npx @daymade/ccpm login          # auth with GitHub
npx @daymade/ccpm init           # scaffold a new skill
npx @daymade/ccpm link           # symlink for local testing
npx @daymade/ccpm version patch  # bump version
npx @daymade/ccpm publish        # publish to registry
```

## Usage Notes

- Run search/browse commands via Bash tool and present results to the user
- For install, confirm with the user first — it writes to their `.claude/` directory
- Registry is at ccpm.ai / ccpm.dev
