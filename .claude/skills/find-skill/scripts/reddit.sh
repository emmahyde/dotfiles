#!/usr/bin/env bash
# reddit.sh <query> [subreddit-csv] — top recent reddit hits, no auth.
# Output: score|num_comments|created(YYYY-MM-DD)|subreddit|title|url
# Hits old.reddit JSON. Default subs cover agentic-CLI ecosystem.
set -euo pipefail
q="${1:?usage: reddit.sh <query> [subs]}"
subs="${2:-ClaudeAI+ClaudeCode+cursor+LocalLLaMA+mcp}"
ua="find-skill/1.0"
curl -fsSL -A "$ua" --get \
  "https://old.reddit.com/r/${subs}/search.json" \
  --data-urlencode "q=$q" \
  --data "restrict_sr=on&sort=top&t=year&limit=15" \
  | jq -r '.data.children[].data
      | select(.score >= 5)
      | [(.score|tostring),(.num_comments|tostring),
         (.created_utc|todate|.[0:10]),.subreddit,
         (.title|gsub("\\|";"-")|.[0:90]),
         ("https://reddit.com"+.permalink)]
      | join("|")'
