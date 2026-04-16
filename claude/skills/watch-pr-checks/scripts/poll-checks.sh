#!/usr/bin/env bash
# Poll GitHub PR checks and stream status to stdout (for Monitor).
# Exits 0 when all green, exits 1 when any check fails.
# Usage: poll-checks.sh [PR_NUMBER] [POLL_INTERVAL_SECONDS]

PR="${1:-}"
INTERVAL="${2:-30}"

if [ -z "$PR" ]; then
  PR="$(gh pr view --json number -q .number 2>/dev/null || true)"
fi

if [ -z "$PR" ]; then
  echo "ERROR: No PR found for current branch"
  exit 1
fi

echo "Watching PR #${PR} (every ${INTERVAL}s)..."

prev_summary=""
last_comment_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check_comments() {
  local repo
  repo="$(gh pr view "$PR" --json url -q '.url' 2>/dev/null | sed 's|https://github.com/||; s|/pull/.*||')" || return
  [ -z "$repo" ] && return

  local comments
  comments="$(gh api "repos/${repo}/pulls/${PR}/comments?since=${last_comment_ts}&sort=created&direction=asc" 2>/dev/null)" || return

  local count
  count="$(echo "$comments" | jq 'length' 2>/dev/null)" || return
  [ "$count" -eq 0 ] && return

  echo "$comments" | jq -r '.[] | "PR #'"$PR"' COMMENT by \(.user.login) on \(.path):\(.line // "file"): \(.body | split("\n") | first)"' 2>/dev/null
  last_comment_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

while true; do
  check_comments

  json="$(gh pr checks "$PR" --json name,state,bucket 2>&1)" || {
    echo "ERROR: Failed to fetch checks — retrying"
    sleep "$INTERVAL"
    continue
  }

  total=$(echo "$json" | jq 'length' 2>/dev/null) || {
    echo "ERROR: Unexpected response from gh — retrying"
    sleep "$INTERVAL"
    continue
  }

  if [ "$total" -eq 0 ]; then
    echo "PR #${PR}: Waiting for checks to appear..."
    sleep "$INTERVAL"
    continue
  fi

  passed=$(echo "$json" | jq '[.[] | select(.bucket == "pass")] | length')
  failed=$(echo "$json" | jq '[.[] | select(.bucket == "fail")] | length')
  pending=$((total - passed - failed))

  summary="${passed}p-${failed}f-${pending}w"

  if [ "$pending" -gt 0 ]; then
    if [ "$summary" != "$prev_summary" ]; then
      echo "PR #${PR}: ${passed} passed, ${failed} failed, ${pending} pending [${total} total]"
    fi
    prev_summary="$summary"
  elif [ "$failed" -gt 0 ]; then
    failed_names=$(echo "$json" | jq -r '[.[] | select(.bucket == "fail")] | map(.name) | join(", ")')
    echo "PR #${PR} FAILED: ${failed}/${total} checks failed — ${failed_names}"
    exit 1
  else
    echo "PR #${PR} ALL GREEN: ${passed}/${total} checks passed"
    exit 0
  fi

  sleep "$INTERVAL"
done
