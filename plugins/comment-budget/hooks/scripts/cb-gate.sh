#!/usr/bin/env bash
# PreToolUse on Edit|Write|MultiEdit: deny writes whose NEW content contains
# high-precision banned comment patterns (changelog/provenance graffiti, step
# banners, STATE references). Density is deliberately not gated — docstrings on
# public APIs would false-positive. Fail open everywhere: no session id, no jq
# output, or 2 prior denies for the same file this prompt -> allow.
set -u
in=$(cat)
tn=$(jq -r '.tool_name // ""' <<<"$in" 2>/dev/null || true)
case "$tn" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac

fp=$(jq -r '.tool_input.file_path // ""' <<<"$in")
case "$fp" in
  *.cs|*.py|*.js|*.jsx|*.ts|*.tsx|*.go|*.rs|*.rb|*.sh|*.bash|*.c|*.h|*.cpp|*.hpp|*.java|*.kt|*.swift|*.lua|*.zig|*.sql|*.ps1|*.gd|*.shader|*.hlsl|*.glsl) ;;
  *) exit 0 ;;
esac

text=$(jq -r '[.tool_input.new_string, .tool_input.content, (.tool_input.edits[]?.new_string)] | map(select(. != null)) | join("\n")' <<<"$in" 2>/dev/null || true)
[ -n "$text" ] || exit 0

sid=$(jq -r '.session_id // ""' <<<"$in")
[ -n "$sid" ] || exit 0
dir="${TMPDIR:-/tmp}/claude-comment-budget/$sid"
key=$(printf '%s' "$fp" | shasum | cut -c1-12)
count=$(cat "$dir/$key" 2>/dev/null || echo 0)
[ "$count" -ge 2 ] && exit 0

marker='^[[:space:]]*(//|#|/\*+|\*|--|;+)[[:space:]]*'
banned="${marker}((Added|Fixed|Updated|Changed|Removed|Refactored|Renamed|Moved|Improved) (in|for|per|by|to support|support for) |V[0-9]+[.:]|Version [0-9]|New in |NEW:|Now (supports|handles|uses|returns) |Previously[ ,]|Was previously|(As|as|Per|per) (requested|review|discussed)|[Ss]ee STATE|STATE\.md|Step [0-9]+[.:)]|Phase [0-9]+[.:)]|[=~*#-]{8,}[[:space:]]*$)"

external="${marker}.*(https?://|[Ss]ee (RFC|IETF|JIRA|[Tt]icket))"

viol=$(grep -nE "$banned" <<<"$text" | head -3 || true)
extviol=$(grep -nE "$external" <<<"$text" | head -3 || true)
maxrun=$(awk 'BEGIN { m = "^[[:space:]]*(//|#|/[*]+|[*]|--|;+)" } { if ($0 ~ m) { r++; if (r > max) max = r } else r = 0 } END { print max + 0 }' <<<"$text")
[ -n "$viol" ] || [ -n "$extviol" ] || [ "$maxrun" -ge 4 ] || exit 0

mkdir -p "$dir" 2>/dev/null || exit 0
echo $((count + 1)) >"$dir/$key"
msgs=""
[ -n "$viol" ] && msgs="Banned comment pattern(s) (line numbers relative to your new content):
$viol
"
[ -n "$extviol" ] && msgs="${msgs}External-pointer comment(s) — pointer comments may only target docs IN this repo, never URLs/RFCs/tickets; carry the fact itself instead:
$extviol
"
[ "$maxrun" -ge 4 ] && msgs="${msgs}Comment block of $maxrun consecutive lines — budget is short comments; compress to <=3 lines (ideally 1) or let naming/structure carry it.
"
reason=$(printf 'Comment-budget gate — %s:\n%s\nHistory/changelog/banner comments never go in code; git and state docs own history, a comment carries current truth or nothing. Re-issue this edit with those comment lines fixed and the code itself unchanged.' "$fp" "$msgs")
jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
