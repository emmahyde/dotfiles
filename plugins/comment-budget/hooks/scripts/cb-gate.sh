#!/usr/bin/env bash
# PreToolUse gate for Edit|Write|MultiEdit; rejects high-confidence comment noise.
# Density stays ungated to protect API docs. Unreadable JSON and a third same-file
# denial allow; missing sessions enforce patterns without retry counting.
set -u
in=$(cat)
tn=$(jq -r '.tool_name // ""' <<<"$in" 2>/dev/null || true)
case "$tn" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac

top_fp=$(jq -r '.tool_input.file_path // ""' <<<"$in" 2>/dev/null || true)
if [ "$tn" = MultiEdit ] && [ -z "$top_fp" ]; then
  request_sid=$(jq -r '.session_id // ""' <<<"$in" 2>/dev/null || true)
  while IFS= read -r edit_entry; do
    nested=$(jq -nc --argjson e "$edit_entry" --arg s "$request_sid" \
      '{tool_name:"Edit",session_id:$s,tool_input:{file_path:($e.file_path // ""),new_string:($e.new_string // "")}}')
    out=$(printf '%s' "$nested" | bash "$0" 2>/dev/null)
    if [ -n "$out" ]; then
      printf '%s\n' "$out"
      exit 0
    fi
  done < <(jq -c '.tool_input.edits[]?' <<<"$in" 2>/dev/null)
  exit 0
fi
fp="$top_fp"
case "$fp" in
  *.md|*.rst|*.txt) exit 0 ;;
  *.json|*.yaml|*.yml|*.toml|*.ini|*.env|*.conf|*.cfg|*.lock) exit 0 ;;
  *.min.js|*.min.ts|*_generated.*|*-generated.*|*.generated.*) exit 0 ;;
  docs/*|*/docs/*|documentation/*|*/documentation/*) exit 0 ;;
  generated/*|*/generated/*|__generated__/*|*/__generated__/*|scratch/*|*/scratch/*) exit 0 ;;
esac

case "$fp" in
  *.cs|*.py|*.js|*.jsx|*.ts|*.tsx|*.vue|*.svelte|*.css|*.scss|*.sass|*.less|*.go|*.rs|*.rb|*.sh|*.bash|*.c|*.h|*.cpp|*.hpp|*.java|*.kt|*.swift|*.lua|*.zig|*.sql|*.ps1|*.gd|*.shader|*.hlsl|*.glsl) ;;
  *) exit 0 ;;
esac

text=$(jq -r '[.tool_input.new_string, .tool_input.content, (.tool_input.edits[]?.new_string)] | map(select(. != null)) | join("\n")' <<<"$in" 2>/dev/null || true)
[ -n "$text" ] || exit 0

sid=$(jq -r '.session_id // ""' <<<"$in" 2>/dev/null || true)
count=0
if [ -n "$sid" ]; then
  dir="${TMPDIR:-/tmp}/claude-comment-budget/$sid"
  key=$(printf '%s' "$fp" | cksum | cut -d ' ' -f1)
  count=$(cat "$dir/$key" 2>/dev/null || echo 0)
  [ "$count" -ge 2 ] && exit 0
fi

marker='^[[:space:]]*(//|#|/\*+|\*|--|;+)[[:space:]]*'

# Removal markers exempt ticket refs; RFC/vendor refs stay; URLs/docs never do.
banned="${marker}((Added|Fixed|Updated|Changed|Removed|Refactored|Renamed|Moved|Improved) (in|for|per|by|to support|support for) |V[0-9]+[.:]|Version [0-9]|New in |NEW:|Now (supports|handles|uses|returns) |Previously[ ,]|Was previously|(As|as|Per|per) (requested|review|discussed|feedback)[ ,]|[Ss]ee STATE|STATE\.md|Step [0-9]+[.:)]|Phase [0-9]+[.:)]|[=~*#-]{8,}[[:space:]]*$|Originally[, ]|Historically[, ]|Note: as of |Prior to v|Ported from )"

narration_label="increment(s)?([[:space:]][[:alnum:]_]+)?|decrement(s)?([[:space:]][[:alnum:]_]+)?|(constructor|destructor|getter|setter)"
narration="${marker}(loop(s)?[[:space:]]+(through|over|all|each)[[:space:]]|iterate(s)?[[:space:]]+(over|through)[[:space:]]|(${narration_label})[[:space:]]*$)"
# No-space `//` requires code punctuation, avoiding URL path separators.
narration_inline="(([[:space:]]+|[+]|;|[}]|[)]))//[[:space:]]+(${narration_label})[[:space:]]*$|[[:space:]]+#[[:space:]]+(${narration_label})[[:space:]]*$"
narration_cstyle="(^|.)/[*]+[[:space:]]*(${narration_label})[[:space:]]*[*]/[[:space:]]*$"

hist_url="${marker}.*https?://[^[:space:]]*/(pull|commit|compare)/[^[:space:]]+"
text_ref="${marker}.*see[[:space:]]+(jira|ticket|pr|commit|branch)([[:space:]#:]|$)"
sha_ref="${marker}.*(see|original|from|commit|revision|sha)[^[:xdigit:]]*[[:xdigit:]]{7,40}([^[:xdigit:]]|$)"
internal_ref="${marker}.*see[[:space:]]+((\./|\.\./)*)(docs?|documentation)/"

viol=$(grep -niE "$banned" <<<"$text" | head -3 || true)
narviol=$(grep -niE "$narration|$narration_inline" <<<"$text" | head -3 || true)
cstyleviol=$(grep -niE "$narration_cstyle" <<<"$text" | head -3 || true)
extviol_url=$(grep -niE "$hist_url" <<<"$text" | head -3 || true)
extviol_txt=$(grep -niE "$text_ref|$sha_ref" <<<"$text" | grep -viE 'TODO|FIXME|HACK' | head -3 || true)
internalviol=$(grep -niE "$internal_ref" <<<"$text" | head -3 || true)

# Provenance blocks deny at 4 lines; clean blocks allow 7 and deny at 8.
_runstats=$(awk '
BEGIN {
  cm = "^[[:space:]]*(//|#|/[*]+|[*]|--|;+)"
  prov = "([=~*#-]{8,}|step [0-9]|phase [0-9]|(added|fixed|updated|changed|removed|originally|historically|previously)[[:space:]])"
}
{
  if ($0 ~ cm) {
    run++
    if (tolower($0) ~ prov) run_prov = 1
  } else {
    if (run > 0) {
      if (run_prov) { if (run > maxp) maxp = run }
      else { if (run > maxc) maxc = run }
    }
    run = 0; run_prov = 0
  }
}
END {
  if (run > 0) {
    if (run_prov) { if (run > maxp) maxp = run }
    else { if (run > maxc) maxc = run }
  }
  print maxp+0, maxc+0
}' <<<"$text")
read -r maxprov maxclean <<< "${_runstats:-0 0}"

# Docstring narration stays ungated because lexical markers cannot distinguish API docs.
_tq="'''"
blockbanned=$(awk -v TQ="$_tq" '
  /^[[:space:]]*""".*"""[[:space:]]*$/ { next }
  /^[[:space:]]*"""/ { in_dq = !in_dq; next }
  $0 ~ ("^[[:space:]]*" TQ ".*" TQ "[[:space:]]*$") { next }
  $0 ~ ("^[[:space:]]*" TQ) { in_sq = !in_sq; next }
  (in_dq || in_sq) && /(Added|Fixed|Updated|Changed|Removed) (in|for|per|by)|Version [0-9]|Previously |Was previously|(Per|As per) (review|request|feedback)|Step [0-9]+[.:]/ {
    print NR": "$0
  }
' <<<"$text" | head -3 || true)

[ -n "$viol" ] || [ -n "$narviol" ] || [ -n "$cstyleviol" ] || [ -n "$extviol_url" ] || [ -n "$extviol_txt" ] || [ -n "$internalviol" ] || [ "$maxprov" -ge 4 ] || [ "$maxclean" -ge 8 ] || [ -n "$blockbanned" ] || exit 0

if [ -n "$sid" ]; then
  mkdir -p "$dir" 2>/dev/null || exit 0
  printf '%s\n' $((count + 1)) >"$dir/$key"
fi
msgs=""
[ -n "$viol" ] && msgs="Banned comment pattern(s) (line numbers relative to your new content):
$viol
"
[ -n "$narviol$cstyleviol" ] && msgs="${msgs}Narration/translation comment (restates what code says — delete it):
$narviol
$cstyleviol
"
[ -n "$extviol_url" ] && msgs="${msgs}History URL in comment — belongs in commit messages only; remove it:
$extviol_url
"
[ -n "$extviol_txt" ] && msgs="${msgs}History/ticket pointer in comment — carry the fact inline; ticket refs belong only in TODO/FIXME marking a removal condition:
$extviol_txt
"
[ -n "$internalviol" ] && msgs="${msgs}Internal repository pointer in comment — carry the current fact in code or the owning documentation:
$internalviol
"
[ "$maxprov" -ge 4 ] && msgs="${msgs}Comment block of $maxprov consecutive lines containing decorative/provenance content — budget is 1 line; remove banners and graffiti.
"
[ "$maxclean" -ge 8 ] && msgs="${msgs}Comment block of $maxclean consecutive lines — genuinely excessive; budget is 1 line; move prose to docs or commit messages.
"
[ -n "$blockbanned" ] && msgs="${msgs}Provenance content inside docstring body:
$blockbanned
"
reason=$(printf 'Comment-budget gate — %s:\n%s\nProvenance/changelog/narration belongs in git and state docs, not code. Re-issue this edit with those comment lines removed and the code itself unchanged.' "$fp" "$msgs")
jq -nc --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
exit 0
