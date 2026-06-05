#!/usr/bin/env bash
set -euo pipefail

# Drains pending after-hours commands from the SQLite queue.
# Called by launchd at 7 AM ET, or manually via /business-interactions drain.
#
# Only replays Bash tool commands (git push, gh pr create, etc.).
# MCP tool calls are flagged as "needs_claude" — drain those via /business-interactions drain.

DB="$HOME/.claude/queue/business-interactions.db"
LOG="$HOME/.claude/queue/business-interactions-drain.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

if [[ ! -f "$DB" ]]; then
  exit 0
fi

pending_count=$(sqlite3 "$DB" "SELECT COUNT(*) FROM queue WHERE status = 'pending';")
if (( pending_count == 0 )); then
  log "No pending commands to drain."
  exit 0
fi

log "Draining $pending_count pending command(s)..."

# Process Bash commands automatically
sqlite3 -separator $'\t' "$DB" \
  "SELECT id, tool_name, tool_input FROM queue WHERE status = 'pending' AND tool_name = 'Bash' ORDER BY id;" \
| while IFS=$'\t' read -r id tool_name tool_input; do
  command=$(echo "$tool_input" | jq -r '.command // empty')
  if [[ -z "$command" ]]; then
    log "  [id=$id] SKIP: empty command"
    sqlite3 "$DB" "UPDATE queue SET status = 'skipped', executed_at = datetime('now') WHERE id = $id;"
    continue
  fi

  log "  [id=$id] EXEC: $command"
  if eval "$command" >> "$LOG" 2>&1; then
    sqlite3 "$DB" "UPDATE queue SET status = 'executed', executed_at = datetime('now') WHERE id = $id;"
    log "  [id=$id] OK"
  else
    sqlite3 "$DB" "UPDATE queue SET status = 'failed', executed_at = datetime('now') WHERE id = $id;"
    log "  [id=$id] FAILED (exit $?)"
  fi
done

# Flag MCP tool calls — these need a Claude Code session to replay
mcp_count=$(sqlite3 "$DB" "SELECT COUNT(*) FROM queue WHERE status = 'pending' AND tool_name != 'Bash';")
if (( mcp_count > 0 )); then
  sqlite3 "$DB" "UPDATE queue SET status = 'needs_claude' WHERE status = 'pending' AND tool_name != 'Bash';"
  log "$mcp_count MCP tool call(s) flagged as needs_claude — drain via /business-interactions drain"
fi

log "Drain complete."
