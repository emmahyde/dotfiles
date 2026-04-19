# gsd-linear

Syncs GSD planning artifacts to Linear — push-only, non-destructive.

## Mapping

| GSD | Linear |
|-----|--------|
| Milestone | Initiative |
| Phase | Issue (labeled "GSD") |
| Plan | Todo on the phase issue |

## Prerequisites

1. **Linear MCP plugin installed** — the `plugin_linear_linear` MCP server must be configured and authenticated in your Claude Code session.
2. **GSD installed** — `.planning/` directory with `STATE.md` and a roadmap file must exist.

## First Run

```
/gsd-linear:sync
```

On first run you'll be prompted to:
1. Pick a Linear **team** (where phase issues will be created)
2. Map the active GSD milestone to a Linear **initiative** (existing or new)

Config is saved to `.planning/linear-sync.json` and reused on subsequent syncs.

## Commands

| Command | What it does |
|---------|-------------|
| `/gsd-linear:sync` | Push all unsynced phases to Linear; post completion comments for completed ones |
| `/gsd-linear:sync --phase 70` | Sync a specific phase only |
| `/gsd-linear:sync --full` | Re-sync all phases (posts re-sync comments, no duplicates) |
| `/gsd-linear:status` | Show sync state table — what's synced, what's pending |

## Automatic Sync (Hook)

The plugin hooks into `gsd-tools.cjs` Bash calls:

- **Phase planned** (`init execute-phase`) → creates Linear issue + plan todos
- **Phase completed** (`phase complete`) → posts completion comment, marks issue Done

Both are non-blocking. If `linear-sync.json` is not configured, the hook skips silently.

## Data File

`.planning/linear-sync.json` stores all Linear entity IDs and config. It is committed to git and shared across the team.

## Non-Destructive Guarantee

The plugin only writes fields it owns:
- Creates issues (never recreates existing ones)
- Adds todos (never removes)
- Posts one completion comment per phase (idempotent)
- Sets status to Done on phase completion only
- Never touches: assignee, priority, custom labels, human-made status changes
