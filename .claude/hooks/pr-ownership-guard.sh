#!/usr/bin/env bash
set -euo pipefail

# PreToolUse hook: block mutating actions on PRs the user doesn't own.
# ALWAYS block merge regardless of ownership.
#
# Covers:
#   - gh pr comment|review|edit|close|reopen|ready  (ownership check)
#   - gh pr merge                                    (always blocked)
#   - gh api -X POST/PUT/PATCH/DELETE to /pulls/ or /issues/ endpoints
#   - curl / xh to api.github.com PR endpoints
#   - GH_REPO= env prefix
#   - -R / --repo flag
#   - PR refs as numbers, URLs, or implicit (current branch)
#   - Heredoc-safe: strips heredoc bodies before matching

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')
[[ "$tool_name" != "Bash" ]] && exit 0

command=$(echo "$input" | jq -r '.tool_input.command // empty')
[[ -z "$command" ]] && exit 0

# ---- Strip heredoc bodies to avoid false matches on their content ----
# Keeps the line that opens the heredoc (<<MARKER) but removes body lines
# and the closing marker. This prevents text like "gh pr merge" inside a
# comment body from triggering the guard.

strip_heredocs() {
  local in_heredoc=0
  local marker=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    if (( in_heredoc )); then
      local trimmed="${line#"${line%%[![:space:]]*}"}"
      if [[ "$trimmed" == "$marker" ]]; then
        in_heredoc=0
      fi
      continue
    fi
    local heredoc_re='<<-?[[:space:]]*\\?'\''?\"?([A-Za-z_][A-Za-z_0-9]*)\"?'\''?\\?'
    if [[ "$line" =~ $heredoc_re ]]; then
      marker="${BASH_REMATCH[1]}"
      in_heredoc=1
    fi
    printf '%s\n' "$line"
  done
}

clean_command=$(printf '%s' "$command" | strip_heredocs)

# ---- Always block merge ----
if [[ "$clean_command" =~ gh[[:space:]]+pr[[:space:]]+merge ]]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"PR merge is always blocked. Merge PRs yourself in the GitHub UI."}}\n'
  exit 0
fi

# ---- Helpers ----

GH_USER_CACHE="$HOME/.claude/cache/gh-user"

get_gh_user() {
  if [[ -f "$GH_USER_CACHE" ]]; then
    local age
    age=$(( $(date +%s) - $(stat -f %m "$GH_USER_CACHE") ))
    if (( age < 604800 )); then
      cat "$GH_USER_CACHE"
      return
    fi
  fi
  local user
  user=$(gh api user -q .login 2>/dev/null || echo "")
  if [[ -n "$user" ]]; then
    mkdir -p "$(dirname "$GH_USER_CACHE")"
    echo "$user" > "$GH_USER_CACHE"
  fi
  echo "$user"
}

deny() {
  local reason
  reason=$(printf '%s' "$1" | sed 's/"/\\"/g' | tr '\n' ' ')
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
  exit 0
}

check_pr_owner() {
  local pr_ref="${1:-}"
  local repo_flag="${2:-}"

  local me
  me=$(get_gh_user)
  [[ -z "$me" ]] && return 0

  local args=()
  [[ -n "$pr_ref" ]] && args+=("$pr_ref")
  args+=(--json author -q '.author.login')
  [[ -n "$repo_flag" ]] && args+=(-R "$repo_flag")

  local author
  author=$(gh pr view "${args[@]}" 2>/dev/null || echo "")
  [[ -z "$author" ]] && return 0

  if [[ "$author" != "$me" ]]; then
    local label="${pr_ref:-current branch PR}"
    [[ -n "$repo_flag" ]] && label="${label} in ${repo_flag}"
    deny "Blocked: PR ${label} belongs to ${author}, not ${me}. You may only act on your own PRs."
  fi
}

# Extract -R/--repo flag or GH_REPO= env prefix
extract_repo() {
  local cmd="$1"
  if [[ "$cmd" =~ (-R|--repo)[[:space:]]+([^[:space:]]+) ]]; then
    echo "${BASH_REMATCH[2]}"
  elif [[ "$cmd" =~ GH_REPO=([^[:space:]]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

# Extract PR ref (number or from URL). Bare number after 'gh pr <action>'.
extract_pr_ref() {
  local cmd="$1"
  # URL: github.com/owner/repo/pull/123
  if [[ "$cmd" =~ github\.com/[^/[:space:]]+/[^/[:space:]]+/pull/([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  # First standalone number after 'gh pr <action>'
  if [[ "$cmd" =~ gh[[:space:]]+pr[[:space:]]+[a-z]+[[:space:]]+(.*) ]]; then
    local rest="${BASH_REMATCH[1]}"
    if [[ "$rest" =~ (^|[[:space:]])([0-9]+)([[:space:]]|$) ]]; then
      echo "${BASH_REMATCH[2]}"
      return
    fi
  fi
}

# ---- 1. gh pr <write-action> (excluding merge, handled above) ----

PR_WRITE="(comment|review|edit|close|reopen|ready)"
if [[ "$clean_command" =~ gh[[:space:]]+pr[[:space:]]+${PR_WRITE} ]]; then
  repo_flag=$(extract_repo "$clean_command")

  # Also grab repo from URL if no flag
  if [[ -z "$repo_flag" && "$clean_command" =~ github\.com/([^/[:space:]]+/[^/[:space:]]+)/pull/ ]]; then
    repo_flag="${BASH_REMATCH[1]}"
  fi

  pr_ref=$(extract_pr_ref "$clean_command")
  check_pr_owner "$pr_ref" "$repo_flag"
fi

# ---- 2. gh api writes to PR endpoints ----

if [[ "$clean_command" =~ gh[[:space:]]+api ]]; then
  is_write=false
  [[ "$clean_command" =~ (-X|--method)[[:space:]]*(POST|PUT|PATCH|DELETE) ]] && is_write=true
  [[ "$clean_command" =~ --method=(POST|PUT|PATCH|DELETE) ]] && is_write=true

  if $is_write; then
    # /repos/{owner}/{repo}/pulls/{number}
    if [[ "$clean_command" =~ repos/([^/[:space:]]+)/([^/[:space:]]+)/pulls/([0-9]+) ]]; then
      check_pr_owner "${BASH_REMATCH[3]}" "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    fi
    # PRs are issues too — /repos/{owner}/{repo}/issues/{number}
    if [[ "$clean_command" =~ repos/([^/[:space:]]+)/([^/[:space:]]+)/issues/([0-9]+) ]]; then
      repo="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
      num="${BASH_REMATCH[3]}"
      if gh api "repos/${repo}/pulls/${num}" -q .number &>/dev/null; then
        check_pr_owner "$num" "$repo"
      fi
    fi
  fi
fi

# ---- 3. curl / xh to GitHub API ----

if [[ "$clean_command" =~ (curl|xh)[[:space:]] ]]; then
  if [[ "$clean_command" =~ api\.github\.com/repos/([^/[:space:]]+)/([^/[:space:]]+)/pulls/([0-9]+) ]]; then
    repo="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
    pr_num="${BASH_REMATCH[3]}"
    is_write=false
    [[ "$clean_command" =~ (-X|--request)[[:space:]]*(POST|PUT|PATCH|DELETE) ]] && is_write=true
    [[ "$clean_command" =~ (^|[[:space:]])xh[[:space:]]+(POST|PUT|PATCH|DELETE) ]] && is_write=true
    [[ "$clean_command" =~ (-d[[:space:]]|--data[[:space:]]|--json[[:space:]]) ]] && is_write=true
    $is_write && check_pr_owner "$pr_num" "$repo"
  fi
fi

exit 0
