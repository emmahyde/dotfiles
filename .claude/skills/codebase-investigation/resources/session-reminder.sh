#!/usr/bin/env bash
# SessionStart hook: nudge toward the codebase-investigation skill.
# Fires at most once per session (sentinel keyed on session_id) and only inside a git repo.
# stdout is injected as additionalContext on SessionStart.
set -euo pipefail

input="$(cat 2>/dev/null || true)"
sid="$(printf '%s' "$input" | jq -r '.session_id // "nosid"' 2>/dev/null || echo nosid)"
marker="${TMPDIR:-/tmp}/cc-cbinv-${sid}"

# Only in a git repo, and only the first time this session.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [ ! -e "$marker" ]; then
  touch "$marker" 2>/dev/null || true
  cat "$HOME/.claude/skills/codebase-investigation/resources/reminder.md"
fi
exit 0
