#!/usr/bin/env bash
# Poll a GitHub PR with a single batched GraphQL request per cycle.
# Streams change-events to stdout (for Monitor). Exits on MERGED/CLOSED.
# Usage: poll-checks.sh [PR_NUMBER] [POLL_INTERVAL_SECONDS]

set -u

PR="${1:-}"
INTERVAL="${2:-60}"

if [ -z "$PR" ]; then
  PR="$(gh pr view --json number -q .number 2>/dev/null || true)"
fi

if [ -z "$PR" ]; then
  echo "ERROR: No PR found for current branch"
  exit 1
fi

# Resolve owner/repo from PR URL (one-time).
PR_URL="$(gh pr view "$PR" --json url -q .url 2>/dev/null || true)"
if [ -z "$PR_URL" ]; then
  echo "ERROR: Could not resolve PR #${PR}"
  exit 1
fi
OWNER_REPO="${PR_URL#https://github.com/}"
OWNER_REPO="${OWNER_REPO%/pull/*}"
OWNER="${OWNER_REPO%%/*}"
REPO="${OWNER_REPO#*/}"

echo "Watching PR #${PR} in ${OWNER}/${REPO} (every ${INTERVAL}s)..."

QUERY='query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$pr){
      state
      mergeable
      author{login}
      comments(last:100){nodes{
        databaseId
        author{login}
        body
        createdAt
      }}
      commits(last:1){nodes{commit{statusCheckRollup{
        contexts(first:100){nodes{
          __typename
          ... on CheckRun{name conclusion status}
          ... on StatusContext{context state}
        }}
      }}}}
      reviewThreads(last:100){nodes{
        isResolved
        comments(first:50){nodes{
          databaseId
          author{login}
          body
          path
          line
          originalLine
          createdAt
        }}
      }}
    }
  }
}'

prev_check_summary=""
prev_mergeable=""
prev_pr_state=""
prev_unresolved_ids=""
# Initial high-water mark — only emit comments created after monitor start.
last_comment_iso="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

emit_from_json() {
  local json="$1"

  # PR state — exit on MERGED/CLOSED.
  local state
  state="$(echo "$json" | jq -r '.data.repository.pullRequest.state // empty')"
  if [ -n "$state" ] && [ "$state" != "$prev_pr_state" ]; then
    prev_pr_state="$state"
    case "$state" in
      MERGED) echo "PR #${PR} MERGED"; exit 0 ;;
      CLOSED) echo "PR #${PR} CLOSED"; exit 0 ;;
    esac
  fi

  # Mergeable — emit only on transition into CONFLICTING.
  local mergeable
  mergeable="$(echo "$json" | jq -r '.data.repository.pullRequest.mergeable // empty')"
  if [ -n "$mergeable" ] && [ "$mergeable" != "UNKNOWN" ] && [ "$mergeable" != "$prev_mergeable" ]; then
    prev_mergeable="$mergeable"
    [ "$mergeable" = "CONFLICTING" ] && echo "MERGE CONFLICT: branch has conflicts with base — rebase or merge required"
  fi

  local author
  author="$(echo "$json" | jq -r '.data.repository.pullRequest.author.login // empty')"

  # New comments since last_comment_iso. Covers review-thread comments AND
  # top-level PR (issue) comments. Non-author comments always pass. Self
  # (PR author) comments pass only when open-ended / requesting changes —
  # heuristic: ends with "?", or contains TODO/FIXME/WIP/`[ ]`, or imperative
  # verbs (please|need to|should|let's|can we|could we|fix|update|change|
  # remove|rework|follow up). Pure status replies are filtered out.
  local self_keep_regex='\?\s*$|\b(TODO|FIXME|WIP)\b|\[ \]|\b(please|need to|should|let'\''?s|can we|could we|fix|update|change|remove|rework|follow ?up)\b'
  local new_comments_block
  new_comments_block="$(echo "$json" | jq -r --arg author "$author" --arg since "$last_comment_iso" --arg self_re "$self_keep_regex" '
    (
      [.data.repository.pullRequest.reviewThreads.nodes[]?.comments.nodes[]?
        | {kind:"review", id:.databaseId, login:.author.login, body:.body, path:.path, line:(.line // .originalLine // "file"), createdAt:.createdAt}]
      +
      [.data.repository.pullRequest.comments.nodes[]?
        | {kind:"issue", id:.databaseId, login:.author.login, body:.body, path:"PR conversation", line:"-", createdAt:.createdAt}]
    )
    | map(select(.createdAt > $since))
    | map(select((.login != $author) or ((.body // "") | test($self_re; "i"))))
    | sort_by(.createdAt)
    | .[] |
      "COMMENT (\(.kind)) by \(.login) on \(.path):\(.line) [id:\(.id)]\n\(.body)\n---END---"
  ')"
  if [ -n "$new_comments_block" ]; then
    echo "$new_comments_block" | sed '/^---END---$/d'
    # Advance high-water across BOTH streams regardless of filtering, so the
    # next cycle doesn't re-emit filtered-out comments.
    local newest
    newest="$(echo "$json" | jq -r --arg since "$last_comment_iso" '
      ([.data.repository.pullRequest.reviewThreads.nodes[]?.comments.nodes[]?.createdAt]
       + [.data.repository.pullRequest.comments.nodes[]?.createdAt])
      | map(select(. > $since)) | max // empty
    ')"
    [ -n "$newest" ] && last_comment_iso="$newest"
  fi

  # Unresolved threads: root comment from non-author + zero author replies + GitHub thread not resolved.
  local unresolved_ids
  unresolved_ids="$(echo "$json" | jq -r --arg author "$author" '
    [.data.repository.pullRequest.reviewThreads.nodes[]?
      | select(.isResolved == false)
      | select((.comments.nodes[0].author.login // "") != $author)
      | select([.comments.nodes[]? | select(.author.login == $author)] | length == 0)
      | .comments.nodes[0].databaseId]
    | sort | join(",")
  ')"
  if [ "$unresolved_ids" != "$prev_unresolved_ids" ]; then
    prev_unresolved_ids="$unresolved_ids"
    if [ -n "$unresolved_ids" ]; then
      local count
      count="$(echo "$unresolved_ids" | tr ',' '\n' | wc -l | tr -d ' ')"
      echo "UNRESOLVED: ${count} review comment(s) need response"
      echo "$json" | jq -r --arg author "$author" '
        .data.repository.pullRequest.reviewThreads.nodes[]?
        | select(.isResolved == false)
        | select((.comments.nodes[0].author.login // "") != $author)
        | select([.comments.nodes[]? | select(.author.login == $author)] | length == 0)
        | .comments.nodes[0] as $root
        | "  - [id:\($root.databaseId)] \($root.author.login) on \($root.path):\($root.line // $root.originalLine // "file")\n    \($root.body | gsub("\n";"\n    "))"
      '
    fi
  fi

  # CI: aggregate latest commit's CheckRun + StatusContext.
  local counts
  counts="$(echo "$json" | jq -r '
    [.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[]?
      | if .__typename == "CheckRun" then
          (if .status != "COMPLETED" then "pending"
           elif (.conclusion // "") | IN("SUCCESS","NEUTRAL","SKIPPED") then "pass"
           else "fail" end)
        elif .__typename == "StatusContext" then
          (.state | ascii_downcase
            | if . == "success" then "pass"
              elif . == "failure" or . == "error" then "fail"
              else "pending" end)
        else empty end]
    | {total: length,
       passed: ([.[] | select(. == "pass")] | length),
       failed: ([.[] | select(. == "fail")] | length),
       pending: ([.[] | select(. == "pending")] | length)}
    | "\(.total) \(.passed) \(.failed) \(.pending)"
  ')"
  local total passed failed pending
  read -r total passed failed pending <<<"$counts"
  if [ "${total:-0}" -gt 0 ]; then
    local summary="${passed}p-${failed}f-${pending}w"
    if [ "$summary" != "$prev_check_summary" ]; then
      prev_check_summary="$summary"
      if [ "$pending" -gt 0 ]; then
        echo "CHECKS: ${passed} passed, ${failed} failed, ${pending} pending [${total} total]"
      elif [ "$failed" -gt 0 ]; then
        local failed_names
        failed_names="$(echo "$json" | jq -r '
          [.data.repository.pullRequest.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[]?
            | if .__typename == "CheckRun" then
                (if .status == "COMPLETED" and ((.conclusion // "") | IN("SUCCESS","NEUTRAL","SKIPPED") | not) then .name else empty end)
              elif .__typename == "StatusContext" then
                (if (.state | ascii_downcase) == "failure" or (.state | ascii_downcase) == "error" then .context else empty end)
              else empty end]
          | join(", ")')"
        echo "CHECKS FAILED: ${failed}/${total} — ${failed_names}"
      else
        echo "ALL GREEN: ${passed}/${total} checks passed"
      fi
    fi
  fi
}

while true; do
  json="$(gh api graphql -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" -f query="$QUERY" 2>/dev/null || true)"
  if [ -z "$json" ] || ! echo "$json" | jq -e '.data.repository.pullRequest' >/dev/null 2>&1; then
    echo "ERROR: GraphQL fetch failed — retrying"
  else
    emit_from_json "$json"
  fi
  sleep "$INTERVAL"
done
