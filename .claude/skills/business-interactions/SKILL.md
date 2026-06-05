---
name: business-interactions
description: After-hours guard status and queue management. Always active — blocks outgoing interactions (PRs, pushes, comments, messages) 11 PM - 7 AM ET. Queued commands auto-drain at 7 AM via launchd.
---

# Business Interactions Guard

Always-on guard that blocks outgoing interactions (git push, PRs, comments, Slack messages, Jira/Notion/Docs writes) between 11 PM and 7 AM ET. No toggle — purely time-based.

Blocked commands are queued to SQLite and auto-drained at 7 AM ET via launchd. MCP tool calls that can't be replayed outside Claude are flagged for manual drain.

## Usage

- `/business-interactions` or `/business-interactions status` — Show queue and guard state
- `/business-interactions drain` — Manually replay queued commands now

## Instructions

**Parse the argument** from the user's invocation. Default to "status" if no argument.

### status

1. Check current ET hour: `TZ=America/New_York date +%-H`
2. Query the SQLite queue:
   ```bash
   sqlite3 ~/.claude/queue/business-interactions.db "SELECT status, COUNT(*) FROM queue GROUP BY status;" 2>/dev/null
   sqlite3 ~/.claude/queue/business-interactions.db "SELECT id, created_at, tool_name, substr(tool_input, 1, 80), block_reason, status FROM queue WHERE status IN ('pending', 'needs_claude') ORDER BY id;" 2>/dev/null
   ```
3. Report:
   - Current time in ET
   - Whether blocking is active right now (hour >= 23 or hour < 7)
   - Pending command count by status
   - Table of pending/needs_claude items

### drain

1. Query pending items:
   ```bash
   sqlite3 -separator $'\t' ~/.claude/queue/business-interactions.db \
     "SELECT id, tool_name, tool_input FROM queue WHERE status IN ('pending', 'needs_claude') ORDER BY id;"
   ```
2. If no results, say "Queue is empty."
3. Show the user what will be run:
   - For Bash tools: show the command
   - For MCP tools: show tool name and key input fields
4. Ask the user to confirm before executing
5. Execute each queued command:
   - **Bash**: run the command directly
   - **MCP tools**: invoke the named MCP tool with the stored input
6. After each successful execution:
   ```bash
   sqlite3 ~/.claude/queue/business-interactions.db "UPDATE queue SET status = 'executed', executed_at = datetime('now') WHERE id = <ID>;"
   ```
7. On failure, mark as failed:
   ```bash
   sqlite3 ~/.claude/queue/business-interactions.db "UPDATE queue SET status = 'failed', executed_at = datetime('now') WHERE id = <ID>;"
   ```

## Architecture

| Component | Path |
|-----------|------|
| PreToolUse hook | `~/.claude/hooks/business-interactions-guard.sh` |
| Drain script | `~/.claude/hooks/business-interactions-drain.sh` |
| SQLite queue | `~/.claude/queue/business-interactions.db` |
| Drain log | `~/.claude/queue/business-interactions-drain.log` |
| launchd plist | `~/Library/LaunchAgents/com.claude.business-interactions-drain.plist` |

## What gets blocked (11 PM - 7 AM ET)

| Category | Blocked operations |
|----------|-------------------|
| Git | `git push` |
| GitHub PRs | create, comment, review, merge, close, edit |
| GitHub Issues | create, comment, close, edit |
| GitHub API | POST, PUT, PATCH, DELETE methods |
| Slack | send, post, reply, update, chat |
| Jira/Confluence | comments, issue create/edit, transitions, page create |
| Notion | create, update, move |
| Google Docs | insert, replace, delete, comment |
| Google Sheets | append, update, create |
| Google Slides | add, create, delete, update, style, reorder |
