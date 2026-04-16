#!/usr/bin/env bash
# PostToolUse hook (Bash): silently record that a push/PR-create happened.
# The Stop hook reads this flag and surfaces the reminder at the turn boundary.

input=$(cat)
cmd="$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"

echo "$cmd" | grep -qE 'git push|gh pr create' || exit 0

output="$(echo "$input" | jq -r '.tool_output.stdout // empty' 2>/dev/null)"
if echo "$output" | grep -qE 'fatal:|rejected|! \[remote rejected\]'; then
  exit 0
fi

pr="$(gh pr view --json number -q .number 2>/dev/null || true)"
if [ -n "$pr" ]; then
  echo "$pr" > /tmp/claude-pr-pushed
fi
