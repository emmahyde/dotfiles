#!/usr/bin/env bash
# gh-quality.sh <owner/repo> [<owner/repo>...] — compact repo signal.
# One line per repo: owner/repo|stars|pushed|open_issues|forks|archived|desc
# Uses `gh api` (auth = free quota). Failures emit: repo|ERR|<msg>
set -euo pipefail
for r in "$@"; do
  gh api "repos/$r" --jq \
    '[.full_name,(.stargazers_count|tostring),.pushed_at[0:10],
      (.open_issues_count|tostring),(.forks_count|tostring),
      (.archived|tostring),((.description // "")[0:80])]|join("|")' \
    2>/dev/null || echo "$r|ERR|fetch-failed"
done
