#!/usr/bin/env bash
# Blocking Stop hook: if push/PR-create was detected this turn, prevent
# Claude from stopping until it starts the PR checks monitor.

input=$(cat)
session="$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)"
[ -n "$session" ] || exit 0

flags=(/tmp/claude-pr-pushed-${session}-*)
[ -e "${flags[0]}" ] || exit 0

prs=()
for flag in "${flags[@]}"; do
  pr="$(head -1 "$flag")"
  repo="$(tail -1 "$flag")"
  prs+=("PR #${pr} (${repo})")
  rm -f "$flag"
done

msg="$(printf '%s, ' "${prs[@]}")"
msg="${msg%, }"

jq -n --arg msg "$msg" '{
  "decision": "block",
  "reason": ($msg + " pushed. Run /watch-pr-checks to start monitoring CI checks before stopping.")
}'
