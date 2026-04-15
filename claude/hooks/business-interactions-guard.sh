#!/usr/bin/env bash
set -euo pipefail

# After-hours guard: blocks outgoing interactions (pushes, PRs, comments, messages)
# between 11 PM and 7 AM ET. Always on — no toggle needed.
#
# Blocked commands are queued to SQLite for replay at 7 AM via launchd.
# Manual drain: /business-interactions drain
# Check queue: /business-interactions status

DB="$HOME/.claude/queue/business-interactions.db"

# Check current hour in ET
current_hour=$(TZ=America/New_York date +%-H)

# Allow during business hours (7 AM - 11 PM ET)
if (( current_hour >= 7 && current_hour < 23 )); then
  exit 0
fi

# After hours — read tool info from stdin
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

queue_and_block() {
  local reason="$1"
  local timestamp
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  # Ensure DB and table exist
  sqlite3 "$DB" "CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    tool_input TEXT NOT NULL,
    block_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    executed_at TEXT
  );"

  local tool_input
  tool_input=$(echo "$input" | jq -c '.tool_input // {}')

  sqlite3 "$DB" "INSERT INTO queue (created_at, tool_name, tool_input, block_reason)
    VALUES ('$timestamp', '$tool_name', '$(echo "$tool_input" | sed "s/'/''/g")', '$(echo "$reason" | sed "s/'/''/g")');"

  cat <<BLOCK_JSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"$reason"}}
BLOCK_JSON
  exit 0
}

MSG="Queued for 7 AM ET. Run /business-interactions status to see queue."

# --- Bash commands ---
if [[ "$tool_name" == "Bash" ]]; then
  command=$(echo "$input" | jq -r '.tool_input.command // empty')

  [[ "$command" =~ ^git[[:space:]]+push ]] && queue_and_block "git push blocked. $MSG"
  [[ "$command" =~ ^gh[[:space:]]+pr[[:space:]]+(create|comment|review|merge|close|edit) ]] && queue_and_block "PR operation blocked. $MSG"
  [[ "$command" =~ ^gh[[:space:]]+issue[[:space:]]+(create|comment|close|edit) ]] && queue_and_block "Issue operation blocked. $MSG"
  [[ "$command" =~ ^gh[[:space:]]+api && "$command" =~ (-X|--method)[[:space:]]*(POST|PUT|PATCH|DELETE) ]] && queue_and_block "GitHub API write blocked. $MSG"
fi

# --- MCP tools: Slack ---
case "$tool_name" in
  mcp__slackgusto__send*|mcp__slackgusto__post*|mcp__slackgusto__reply*|mcp__slackgusto__update*|mcp__slackgusto__chat*)
    queue_and_block "Slack message blocked. $MSG" ;;
esac

# --- MCP tools: Jira/Confluence ---
case "$tool_name" in
  mcp__jiraconfluencegusto__addComment*|mcp__jiraconfluencegusto__createJiraIssue|mcp__jiraconfluencegusto__editJiraIssue|mcp__jiraconfluencegusto__createConfluence*|mcp__jiraconfluencegusto__createIssueLink|mcp__jiraconfluencegusto__transitionJiraIssue)
    queue_and_block "Jira/Confluence write blocked. $MSG" ;;
esac

# --- MCP tools: Notion ---
case "$tool_name" in
  mcp__notiongusto__notion-create-*|mcp__notiongusto__notion-update-*|mcp__notiongusto__notion-move-*)
    queue_and_block "Notion write blocked. $MSG" ;;
esac

# --- MCP tools: Google Docs/Sheets/Slides ---
case "$tool_name" in
  mcp__gdocsgusto__insert_text|mcp__gdocsgusto__replace_text|mcp__gdocsgusto__add_comment|mcp__gdocsgusto__delete_text|mcp__gdocsgusto__resolve_comment)
    queue_and_block "Google Docs write blocked. $MSG" ;;
  mcp__gsheetsgusto__append|mcp__gsheetsgusto__update|mcp__gsheetsgusto__create)
    queue_and_block "Google Sheets write blocked. $MSG" ;;
  mcp__gslidesgusto__add_*|mcp__gslidesgusto__create*|mcp__gslidesgusto__delete_*|mcp__gslidesgusto__update_*|mcp__gslidesgusto__set_*|mcp__gslidesgusto__style_*|mcp__gslidesgusto__reorder_*|mcp__gslidesgusto__duplicate*)
    queue_and_block "Google Slides write blocked. $MSG" ;;
esac

# Allow everything else
exit 0
