#!/usr/bin/env bash
# Blocking Stop hook: if a push/PR-create was detected this turn, prevent
# Claude from stopping until it starts the PR checks monitor.

flag="$(ls /tmp/claude-pr-pushed-* 2>/dev/null | head -1)"
[ -n "$flag" ] || exit 0

pr="$(head -1 "$flag")"
repo="$(tail -1 "$flag")"
rm -f "$flag"

jq -n --arg pr "$pr" --arg repo "$repo" '{
  "decision": "block",
  "reason": ("PR #" + $pr + " (" + $repo + ") was pushed. Run /watch-pr-checks to start monitoring CI checks before stopping.")
}'
