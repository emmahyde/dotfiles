#!/usr/bin/env bash
# PreToolUse hook on Bash: forces an approval prompt on any `git push`.
# Mirrors CLAUDE.md hard stop: never push unless the user asked in this conversation.
set -euo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-][^[:space:]]*)?)*[[:space:]]+push([[:space:]]|$)'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason: "git push publishes irreversibly. Approve only if you asked for a push in this conversation."
    }
  }'
else
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse"}}\n'
fi
