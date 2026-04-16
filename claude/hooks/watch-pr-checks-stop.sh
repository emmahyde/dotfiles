#!/usr/bin/env bash
# Blocking Stop hook: if a push/PR-create was detected this turn, prevent
# Claude from stopping until it starts the PR checks monitor.

FLAG="/tmp/claude-pr-pushed"
[ -f "$FLAG" ] || exit 0

pr="$(cat "$FLAG")"
rm -f "$FLAG"

jq -n --arg pr "$pr" '{
  "decision": "block",
  "reason": ("PR #" + $pr + " was pushed. Invoke the watch-pr-checks skill to start monitoring CI checks before stopping.")
}'
