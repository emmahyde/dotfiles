---
name: sync
description: Push GSD planning state to Linear. Creates issues for phases, todos for plans, posts completion comments. First run prompts for team and initiative configuration.
argument-hint: "[--phase <N>] [--full]"
allowed-tools: ["Read", "Write", "Bash", "mcp__plugin_linear_linear__list_teams", "mcp__plugin_linear_linear__list_issues", "mcp__plugin_linear_linear__save_issue", "mcp__plugin_linear_linear__save_comment", "mcp__plugin_linear_linear__list_milestones", "mcp__plugin_linear_linear__save_milestone", "mcp__plugin_linear_linear__list_initiatives", "mcp__plugin_linear_linear__get_issue", "mcp__plugin_linear_linear__create_issue_label", "mcp__plugin_linear_linear__list_issue_labels", "mcp__plugin_linear_linear__list_issue_statuses"]
---

Sync GSD planning artifacts to Linear. Invoke the `gsd-linear:linear-syncer` agent with the following context:

1. Read `.planning/linear-sync.json` to load current config and ID mappings (may not exist on first run).
2. Read the active GSD roadmap (check `.planning/STATE.md` for active milestone, then read that roadmap file — e.g. `.planning/ROADMAP-v5.md` or `.planning/ROADMAP.md`).
3. Read `.planning/STATE.md` for current phase and progress.

**If `linear-sync.json` has no `config` section (first run):**
- List available Linear teams and ask the user to pick one.
- Ask the user: "Which Linear initiative should GSD milestones map to? (name an existing one, or type a new name to create it)"
- Create the initiative if new, or look up existing by name.
- Look up or create a "GSD" label in the selected team.
- Save config to `linear-sync.json`.

**Arguments:**
- `--phase <N>`: Sync only the specified phase number.
- `--full`: Re-sync all phases, even ones already in `linear-sync.json` (posts a re-sync comment instead of creating duplicates).
- No args: Sync any phases missing from `linear-sync.json`, post completion comments for completed phases not yet commented.

**Sync rules:**
- For each phase in the roadmap: if no Linear issue ID in `linear-sync.json`, create one.
- For each plan in a phase: add as a todo on the Linear issue (if not already present).
- For completed phases: post a comment "Phase {N} complete: {plan_count}/{plan_count} plans ✓" and update issue status to Done.
- Never modify issue fields set by humans (assignee, priority, custom labels).
- Always apply the "GSD" label to issues created by this plugin.
- Write all new/updated IDs back to `.planning/linear-sync.json`.
