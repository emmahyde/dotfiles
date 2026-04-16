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

# Extract repo and branch from push output (e.g. "To https://github.com/org/repo.git")
repo_url="$(echo "$output" | grep '^To ' | sed 's/^To //' | sed 's/\.git$//' | head -1)"
repo="$(echo "$repo_url" | grep -oE '[^/]+/[^/]+$')"
branch="$(echo "$output" | grep -oE '[^ ]+ -> [^ ]+' | head -1 | sed 's/ -> .*//')"

if [ -z "$repo" ] || [ -z "$branch" ]; then
  exit 0
fi

pr="$(gh pr view "$branch" --repo "$repo" --json number -q .number 2>/dev/null || true)"
if [ -n "$pr" ]; then
  flag="/tmp/claude-pr-pushed-${repo//\//-}-${pr}"
  echo "$pr" > "$flag"
  echo "$repo" >> "$flag"
fi
