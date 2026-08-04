#!/usr/bin/env bash
# Stop hook: block turn-end while pending files lack a comment-cleanup pass.
# Max 3 blocks per turn; comment-cleanup-reset.sh wipes state on each new prompt.
set -u
in=$(cat)
# No session id → no per-session debt to read (see nudge). Never gate on a shared
# fallback bucket: that would block one session's turn over another's pending.
sid=$(jq -r '.session_id // ""' <<<"$in")
[ -n "$sid" ] || exit 0
dir="${TMPDIR:-/tmp}/claude-comment-cleanup-cc/$sid"
pend="$dir/pending"

# Prune vanished files (e.g. removed subagent worktrees) — never demand uneditable paths.
if [ -s "$pend" ]; then
  kept=$(while IFS= read -r f; do [ -f "$f" ] && printf '%s\n' "$f"; done <"$pend")
  printf '%s' "${kept:+$kept$'\n'}" >"$pend"
fi

if [ ! -s "$pend" ]; then
  rm -f "$dir/cleaning" "$dir/cleaned" "$dir/blocks" 2>/dev/null || true
  exit 0
fi

blocks=$(($(cat "$dir/blocks" 2>/dev/null || echo 0) + 0))
if [ "$blocks" -ge 3 ]; then
  rm -f "$pend" "$dir/cleaning" "$dir/cleaned" "$dir/blocks" 2>/dev/null || true
  exit 0
fi
echo $((blocks + 1)) >"$dir/blocks"

files=$(sort -u "$pend" | sed 's/^/- /')
reason=$(printf 'You added or changed comments in these files this turn but have not run /comment-cleanup:comment-cleanup:\n%s\n\nInvoke the Skill tool with skill "comment-cleanup:comment-cleanup" now, scoped to those files, before finishing.' "$files")
jq -nc --arg r "$reason" '{decision:"block",reason:$r}'
exit 0
