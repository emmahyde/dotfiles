#!/usr/bin/env bash
# UserPromptSubmit: wipe per-prompt gate counters, then emit the two-line
# reminder that keeps the budget inside the model's attention window every turn.
set -u
in=$(cat)
sid=$(jq -r '.session_id // ""' <<<"$in" 2>/dev/null || true)
[ -n "$sid" ] && rm -rf "${TMPDIR:-/tmp}/claude-comment-budget/$sid" 2>/dev/null
printf 'COMMENT BUDGET: a comment is why / watch-out / pointer / contract / marker / units — never what, never history ("Added/Fixed/V2/see STATE"). At most ~1 comment line per 10 code lines, one line each; untouched code keeps its comments.'
exit 0
