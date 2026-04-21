#!/usr/bin/env bash
# Poll GitHub PR checks, comments, and merge state. Stream events to stdout (for Monitor).
# Only emits when something CHANGES. Exits only on MERGED.
# Usage: poll-checks.sh [PR_NUMBER] [POLL_INTERVAL_SECONDS]

PR="${1:-}"
INTERVAL="${2:-60}"

if [ -z "$PR" ]; then
  PR="$(gh pr view --json number -q .number 2>/dev/null || true)"
fi

if [ -z "$PR" ]; then
  echo "ERROR: No PR found for current branch"
  exit 1
fi

REPO="$(gh pr view "$PR" --json url -q '.url' 2>/dev/null | sed 's|https://github.com/||; s|/pull/.*||')"
if [ -z "$REPO" ]; then
  echo "ERROR: Could not determine repo for PR #${PR}"
  exit 1
fi

echo "Watching PR #${PR} in ${REPO} (every ${INTERVAL}s)..."

prev_check_summary=""
prev_mergeable=""
prev_pr_state=""
last_comment_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
prev_unresolved_ids=""

check_pr_state() {
  local state
  state="$(gh pr view "$PR" --json state -q .state 2>/dev/null)" || return
  [ -z "$state" ] && return

  if [ "$state" != "$prev_pr_state" ]; then
    prev_pr_state="$state"
    if [ "$state" = "MERGED" ]; then
      echo "PR #${PR} MERGED"
      exit 0
    elif [ "$state" = "CLOSED" ]; then
      echo "PR #${PR} CLOSED"
      exit 0
    fi
  fi
}

check_comments() {
  local comments
  comments="$(gh api "repos/${REPO}/pulls/${PR}/comments?since=${last_comment_ts}&sort=created&direction=asc" 2>/dev/null)" || return

  local count
  count="$(echo "$comments" | jq 'length' 2>/dev/null)" || return
  [ "$count" -eq 0 ] && return

  # Only emit new comments not from the PR author (i.e., review comments from others)
  local pr_author
  pr_author="$(gh pr view "$PR" --json author -q .author.login 2>/dev/null)" || pr_author=""

  echo "$comments" | jq -r --arg author "$pr_author" '
    .[] | select(.user.login != $author) |
    "COMMENT by \(.user.login) on \(.path):\(.line // .original_line // "file") [id:\(.id)]\n\(.body)"
  ' 2>/dev/null

  last_comment_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

check_unresolved_comments() {
  # Fetch all review comments, find unresolved ones (no reply from PR author)
  local all_comments
  all_comments="$(gh api "repos/${REPO}/pulls/${PR}/comments?per_page=100&sort=created&direction=asc" 2>/dev/null)" || return

  local pr_author
  pr_author="$(gh pr view "$PR" --json author -q .author.login 2>/dev/null)" || pr_author=""

  # Find top-level comments (not replies) from non-authors that have no reply from the author
  local unresolved_ids
  unresolved_ids="$(echo "$all_comments" | jq -r --arg author "$pr_author" '
    # Group by thread (in_reply_to_id or self)
    group_by(.in_reply_to_id // .id) |
    map(
      # A thread is unresolved if:
      # - the root comment is not from the author
      # - no reply in the thread is from the author
      select(
        (.[0].user.login != $author) and
        (map(select(.user.login == $author)) | length == 0)
      ) |
      .[0].id
    ) | join(",")
  ' 2>/dev/null)" || return

  if [ "$unresolved_ids" != "$prev_unresolved_ids" ]; then
    prev_unresolved_ids="$unresolved_ids"
    if [ -n "$unresolved_ids" ]; then
      local count
      count="$(echo "$unresolved_ids" | tr ',' '\n' | wc -l | tr -d ' ')"
      echo "UNRESOLVED: ${count} review comment(s) need response"
    fi
  fi
}

check_mergeable() {
  local mergeable
  mergeable="$(gh pr view "$PR" --json mergeable -q .mergeable 2>/dev/null)" || return
  [ -z "$mergeable" ] && return
  [ "$mergeable" = "UNKNOWN" ] && return
  [ "$mergeable" = "$prev_mergeable" ] && return
  prev_mergeable="$mergeable"
  if [ "$mergeable" = "CONFLICTING" ]; then
    echo "MERGE CONFLICT: branch has conflicts with base — rebase or merge required"
  fi
}

check_ci() {
  local json
  json="$(gh pr checks "$PR" --json name,state,bucket 2>&1)" || {
    echo "ERROR: Failed to fetch checks — retrying"
    return
  }

  local total
  total=$(echo "$json" | jq 'length' 2>/dev/null) || {
    echo "ERROR: Unexpected response from gh — retrying"
    return
  }

  [ "$total" -eq 0 ] && return

  local passed failed pending
  passed=$(echo "$json" | jq '[.[] | select(.bucket == "pass")] | length')
  failed=$(echo "$json" | jq '[.[] | select(.bucket == "fail")] | length')
  pending=$((total - passed - failed))

  local summary="${passed}p-${failed}f-${pending}w"

  # Only emit on state change
  [ "$summary" = "$prev_check_summary" ] && return
  prev_check_summary="$summary"

  if [ "$pending" -gt 0 ]; then
    echo "CHECKS: ${passed} passed, ${failed} failed, ${pending} pending [${total} total]"
  elif [ "$failed" -gt 0 ]; then
    local failed_names
    failed_names=$(echo "$json" | jq -r '[.[] | select(.bucket == "fail")] | map(.name) | join(", ")')
    echo "CHECKS FAILED: ${failed}/${total} — ${failed_names}"
  else
    echo "ALL GREEN: ${passed}/${total} checks passed"
  fi
}

while true; do
  check_pr_state
  check_comments
  check_unresolved_comments
  check_mergeable
  check_ci
  sleep "$INTERVAL"
done
