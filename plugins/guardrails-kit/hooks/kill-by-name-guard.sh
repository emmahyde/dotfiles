#!/usr/bin/env bash
# PreToolUse hook on Bash: denies killing processes by image name.
# Mirrors CLAUDE.md hard stop: image-name kills can take down the agent harness itself.
set -euo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])(pkill|killall)([[:space:]]|$)|taskkill[^;&|]*\/IM'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "Killing by image name is blocked (it can kill your own harness). Find the PID via the port instead: lsof -ti :PORT, then kill <PID>."
    }
  }'
else
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse"}}\n'
fi
