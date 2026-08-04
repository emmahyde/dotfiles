#!/usr/bin/env bash
# UserPromptSubmit: wipe state so each turn starts debt-free — stale pending or
# cleaning markers must never block a later turn.
set -u
in=$(cat)
sid=$(jq -r '.session_id // ""' <<<"$in")
[ -n "$sid" ] || exit 0
rm -rf "${TMPDIR:-/tmp}/claude-comment-cleanup-cc/$sid" 2>/dev/null || true
exit 0
