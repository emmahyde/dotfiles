#!/usr/bin/env bash
# PreToolUse on Skill: comment-cleanup invocation clears the pending list and sets
# the cleaning marker so the skill's own edits don't re-arm the Stop gate.
set -u
in=$(cat)
[ "$(jq -r '.tool_name // ""' <<<"$in")" = "Skill" ] || exit 0
case "$(jq -r '.tool_input.skill // ""' <<<"$in")" in *comment-cleanup*) ;; *) exit 0 ;; esac

sid=$(jq -r '.session_id // ""' <<<"$in")
[ -n "$sid" ] || exit 0
dir="${TMPDIR:-/tmp}/claude-comment-cleanup-cc/$sid"
mkdir -p "$dir" 2>/dev/null || true
# Move the debt to a "cleaned" list: the nudge suppresses only edits to these
# files, so comment edits to other files after the skill still re-arm the gate.
sort -u "$dir/pending" >>"$dir/cleaned" 2>/dev/null || true
: >"$dir/pending" 2>/dev/null || true
touch "$dir/cleaning" 2>/dev/null || true
rm -f "$dir/blocks" 2>/dev/null || true
exit 0
