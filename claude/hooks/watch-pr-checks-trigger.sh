#!/usr/bin/env bash
# PostToolUse hook (Bash): silently record that a push/PR-create happened.
# The Stop hook reads this flag and surfaces the reminder at the turn boundary.

input=$(cat)
cmd="$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"

echo "$cmd" | grep -qE 'git\b.*\bpush|gh pr create' || exit 0

stdout="$(echo "$input" | jq -r '.tool_response.stdout // empty' 2>/dev/null)"
stderr="$(echo "$input" | jq -r '.tool_response.stderr // empty' 2>/dev/null)"
output="${stdout}
${stderr}"
if echo "$output" | grep -qE 'fatal:|rejected|! \[remote rejected\]'; then
  exit 0
fi

# Extract repo from push output — handles both SSH (github.com:org/repo) and HTTPS (github.com/org/repo)
# git push writes to stderr, gh pr create writes to stdout
repo_url="$(echo "$output" | grep '^To ' | sed 's/^To //' | sed 's/\.git$//' | head -1)"
repo="$(echo "$repo_url" | sed 's|.*github\.com[:/]||')"
branch="$(echo "$output" | grep -oE '[^ ]+ -> [^ ]+' | head -1 | sed 's/ -> .*//')"

if [ -z "$repo" ] || [ -z "$branch" ]; then
  exit 0
fi

session="$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)"
if [ -z "$session" ]; then
  exit 0
fi

pr="$(gh pr view "$branch" --repo "$repo" --json number -q .number 2>/dev/null || true)"
if [ -n "$pr" ]; then
  flag="/tmp/claude-pr-pushed-${session}-${repo//\//-}-${pr}"
  echo "$pr" > "$flag"
  echo "$repo" >> "$flag"
fi
