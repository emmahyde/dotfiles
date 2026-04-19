---
name: status
description: Show which GSD phases are synced to Linear, which are pending, and the current config.
allowed-tools: ["Read", "Bash"]
---

Show the current GSD→Linear sync state. Do not call any Linear MCP tools — read only from local files.

1. Read `.planning/linear-sync.json`. If it doesn't exist, report "Not configured — run `/gsd-linear:sync` to set up."
2. Read the active GSD roadmap (check `.planning/STATE.md` for active milestone, load that roadmap).
3. Read `.planning/STATE.md` for current phase progress.

**Output format:**

```
## GSD → Linear Sync Status

**Config:** Team: {team_name} | Initiative: {initiative_name}
**Label:** GSD

| Phase | Name | Linear Issue | Plans | Status |
|-------|------|-------------|-------|--------|
| 69 | engine-foundations | SEC-123 ✓ | 4/4 todos | Done |
| 70 | session-state | — | — | Not synced |
| 71 | patrol-wiring | — | — | Not synced |

**{N} synced / {M} pending**

Run `/gsd-linear:sync` to push pending phases.
```

Mark issues with ✓ if all their plans have corresponding todos in Linear.
Mark phases as "Not synced" if they have no entry in `linear-sync.json`.
