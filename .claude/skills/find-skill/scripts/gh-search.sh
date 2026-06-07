#!/usr/bin/env bash
# gh-search.sh <topic-keywords> [scope] — find recent agentic-CLI repos.
# Output: full_name|stars|pushed|desc(<=80c). 25 max, sorted by stars.
# Filters: pushed >= 1 year ago, not archived. Stays cheap (1 API call).
set -euo pipefail
kw="${1:?usage: gh-search.sh <keywords> [scope]}"
scope="${2:-}"
case "$scope" in
  skill)      q="$kw skill SKILL.md" ;;
  hook)       q="$kw claude-code-hooks" ;;
  agent)      q="$kw agents claude" ;;
  mcp)        q="$kw mcp-server" ;;
  proxy)      q="$kw claude-code proxy" ;;
  plugin)     q="$kw claude-code plugin" ;;
  project-md|user-md) q="$kw CLAUDE.md AGENTS.md" ;;
  *)          q="$kw claude-code" ;;
esac
since="$(date -v-1y +%Y-%m-%d 2>/dev/null || date -d '1 year ago' +%Y-%m-%d)"
gh search repos "$q pushed:>=$since" --sort stars --limit 25 \
  --json fullName,stargazersCount,pushedAt,description,isArchived \
  --jq '.[] | select(.isArchived|not)
        | [.fullName,(.stargazersCount|tostring),.pushedAt[0:10],
           ((.description // "")|gsub("\\s+";" ")|.[0:80])]|join("|")'
