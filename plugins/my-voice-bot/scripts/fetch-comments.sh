#!/usr/bin/env bash
set -euo pipefail

# Batch-fetch GitHub PR review comments for a user via GraphQL.
# Minimizes API calls: ~3-6 total vs 150-300 with per-PR REST calls.
#
# Usage: fetch-comments.sh <username> <org> [--cutoff DATE] [--min-comments N] [--output PATH]
#
# Outputs a newline-delimited JSON file (one comment object per line).

USERNAME=""
ORG=""
CUTOFF="2025-11-01"
MIN_COMMENTS=200
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --cutoff) CUTOFF="$2"; shift 2 ;;
    --min-comments) MIN_COMMENTS="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    -*) echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$USERNAME" ]]; then USERNAME="$1"
      elif [[ -z "$ORG" ]]; then ORG="$1"
      else echo "Unexpected arg: $1" >&2; exit 1
      fi
      shift ;;
  esac
done

if [[ -z "$USERNAME" ]]; then
  echo "Usage: fetch-comments.sh <username> <org> [--cutoff DATE] [--min-comments N] [--output PATH]" >&2
  exit 1
fi

OUTPUT="${OUTPUT:-${USERNAME}-comments.ndjson}"

# shellcheck disable=SC2016
QUERY='
query($searchQuery: String!, $cursor: String) {
  search(query: $searchQuery, type: ISSUE, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        url
        repository { nameWithOwner }
        reviews(first: 100) {
          nodes {
            author { login }
            body
            createdAt
            comments(first: 100) {
              nodes {
                author { login }
                body
                path
                createdAt
                url
              }
            }
          }
        }
      }
    }
  }
}
'

SEARCH_QUERY="commenter:${USERNAME} is:pr updated:<${CUTOFF}"
if [[ -n "$ORG" ]]; then
  SEARCH_QUERY="commenter:${USERNAME} org:${ORG} is:pr updated:<${CUTOFF}"
fi

CURSOR="null"
HAS_NEXT="true"
PAGE=0
TOTAL_COMMENTS=0
TOTAL_PRS=0

: > "$OUTPUT"

echo "Fetching PRs where ${USERNAME} commented (before ${CUTOFF})..." >&2

while [[ "$HAS_NEXT" == "true" ]]; do
  PAGE=$((PAGE + 1))

  CURSOR_ARGS=()
  if [[ "$CURSOR" != "null" ]]; then
    CURSOR_ARGS=(-f cursor="$CURSOR")
  fi

  GH_STDERR=$(mktemp)
  RESULT=$(gh api graphql -f query="$QUERY" \
    -f searchQuery="$SEARCH_QUERY" \
    "${CURSOR_ARGS[@]}" 2>"$GH_STDERR") || {
    echo "GraphQL error (stderr): $(cat "$GH_STDERR")" >&2
    echo "GraphQL error (stdout): $RESULT" >&2
    rm -f "$GH_STDERR"
    exit 1
  }
  if [[ -s "$GH_STDERR" ]]; then
    echo "  warning: $(cat "$GH_STDERR")" >&2
  fi
  rm -f "$GH_STDERR"

  HAS_NEXT=$(echo "$RESULT" | jq -r '.data.search.pageInfo.hasNextPage')
  CURSOR=$(echo "$RESULT" | jq -r '.data.search.pageInfo.endCursor')

  PAGE_PRS=$(echo "$RESULT" | jq '.data.search.nodes | length')
  TOTAL_PRS=$((TOTAL_PRS + PAGE_PRS))

  PAGE_COMMENTS=$(jq --arg user "$USERNAME" '
    [.data.search.nodes[] |
      .url as $pr_url |
      .repository.nameWithOwner as $repo |
      .number as $pr_num |
      .reviews.nodes[] |
      (
        (select(.author.login == $user and .body != "" and .body != null) |
          {
            body: .body,
            path: null,
            created_at: .createdAt,
            pr_url: $pr_url,
            repo: $repo,
            pr_number: $pr_num,
            type: "review_body",
            url: $pr_url
          }
        ),
        (.comments.nodes[] |
          select(.author.login == $user) |
          {
            body: .body,
            path: .path,
            created_at: .createdAt,
            pr_url: $pr_url,
            repo: $repo,
            pr_number: $pr_num,
            type: "review_comment",
            url: .url
          }
        )
      )
    ]' <<< "$RESULT")

  COUNT=$(echo "$PAGE_COMMENTS" | jq 'length')
  TOTAL_COMMENTS=$((TOTAL_COMMENTS + COUNT))

  echo "$PAGE_COMMENTS" | jq -c '.[]' >> "$OUTPUT"

  echo "  page ${PAGE}: ${PAGE_PRS} PRs, ${COUNT} comments (total: ${TOTAL_COMMENTS})" >&2

  if [[ "$TOTAL_COMMENTS" -ge "$MIN_COMMENTS" ]]; then
    echo "Reached ${MIN_COMMENTS} comment threshold." >&2
    break
  fi

  if [[ "$PAGE" -ge 10 ]]; then
    echo "Hit page limit (10)." >&2
    break
  fi
done

echo "" >&2
echo "Done: ${TOTAL_COMMENTS} comments from ${TOTAL_PRS} PRs in ${PAGE} API calls." >&2
echo "Output: ${OUTPUT}" >&2
