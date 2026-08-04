#!/usr/bin/env bash
# PostToolUse: silently record files that gained comment-looking content as owing
# cleanup. No output — the instruction lives only in the Stop gate's block reason.
set -u
in=$(cat)
tn=$(jq -r '.tool_name // ""' <<<"$in")
# Key state on the session id alone. A missing id would collapse every such turn
# into one shared bucket, leaking one session's debt into another's Stop gate — so
# no id means we can't safely attribute debt: record nothing.
sid=$(jq -r '.session_id // ""' <<<"$in")
[ -n "$sid" ] || exit 0
dir="${TMPDIR:-/tmp}/claude-comment-cleanup-cc/$sid"

# Project tree the turn belongs to: only files under it can owe cleanup. Anything
# outside (e.g. /tmp scratch, sibling repos) is never the agent's to tidy here.
proj="${CLAUDE_PROJECT_DIR:-}"
[ -n "$proj" ] || proj=$(jq -r '.cwd // ""' <<<"$in")
[ -n "$proj" ] || proj="$PWD"
proj="${proj%/}"
in_project() {
  # Fail closed: an undeterminable root (never happens — proj falls back to PWD)
  # means we can't prove a file is ours, so don't track it.
  [ -n "$proj" ] || return 1
  case "$1" in "$proj"|"$proj"/*) return 0 ;; *) return 1 ;; esac
}

# Lexically collapse ./.. in an absolute path — no filesystem access, so it works on
# a target that doesn't exist yet (a fresh Write). Callers resolve to an absolute path
# first; without this "$proj/../escape" string-prefix-matches in_project and leaks out
# of the tree. Non-absolute input is returned as-is (in_project rejects it anyway,
# since proj is absolute). Pure shell: realpath -m / readlink -f are GNU-only and break
# on the user's macOS box. ".." above root clamps to root — never an empty string.
normalize() {
  case "$1" in /*) ;; *) printf '%s\n' "$1"; return ;; esac
  local p="$1" out="" seg
  while [ -n "$p" ]; do
    seg="${p%%/*}"
    case "$p" in */*) p="${p#*/}" ;; *) p="" ;; esac
    case "$seg" in
      ''|.) ;;
      ..) out="${out%/*}" ;;
      *) out="$out/$seg" ;;
    esac
  done
  printf '%s\n' "${out:-/}"
}

# Start-of-line or trailing inline; space required both sides of marker ("#fff",
# "http://" don't match). Known cost: "a // b" floor division false-positives.
has_comment() {
  printf '%s\n' "$1" | grep -qE '^[[:space:]]*(//|/\*|#[^!{(\[a-zA-Z0-9_]|"""|'\'\'\'')' && return 0
  printf '%s\n' "$1" | grep -qE '[^[:space:]][[:space:]]+(#|//|/\*)[[:space:]]+[A-Za-z]' && return 0
  # Quoted comment text, e.g. echo '# why' >> f
  printf '%s\n' "$1" | grep -qE "[[:space:]]['\"](#|//)[[:space:]]+[A-Za-z]"
}

# Generated/templated/doc output — intentional markers; don't strip them. Temp/scratch
# paths (/tmp, tmp/ segments, macOS /var/folders) are throwaway, not source.
skip_path() {
  case "$1" in ""|*.md|*.mdx|*.json|*.yaml|*.yml|*.toml|*.lock|*.txt|*.csv|*.xml|*.svg|*.log|*/.claude/*|*/assets/*|*/examples/*|*/templates/*|*/fixtures/*|/tmp/*|*/tmp/*|/var/folders/*|/private/var/folders/*) return 0 ;; *) return 1 ;; esac
}

files=""
case "$tn" in
  Edit|Write|MultiEdit)
    fp=$(jq -r '.tool_input.file_path // ""' <<<"$in")
    fp=$(normalize "$fp")
    skip_path "$fp" && exit 0
    in_project "$fp" || exit 0
    text=$(jq -r '[.tool_input.new_string, .tool_input.content, (.tool_input.edits[]?.new_string)] | map(select(.)) | join("\n")' <<<"$in")
    printf '%s\n' "$text" | grep -qF '{{' && exit 0
    if ! has_comment "$text"; then
      # A comment-free Write is a full overwrite — it provably erases any debt
      # recorded for this file earlier in the turn. (Edit/Bash see only fragments,
      # so their debt stays until cleaned.)
      if [ "$tn" = "Write" ] && [ -s "$dir/pending" ]; then
        kept=$(grep -vxF "$fp" "$dir/pending" || true)
        printf '%s' "${kept:+$kept$'\n'}" >"$dir/pending"
      fi
      exit 0
    fi
    files="$fp"$'\n'
    ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$in")
    printf '%s\n' "$cmd" | grep -qF '{{' && exit 0
    has_comment "$cmd" || exit 0
    cwd=$(jq -r '.cwd // ""' <<<"$in")
    # Best-effort targets: >/>> redirects, tee args, sed/perl -i extension tokens.
    # $var targets unresolvable — skipped; junk pruned by gate's existence check.
    t1=$(grep -oE '(^|[[:space:];|&(])[12]?>{1,2}[[:space:]]*"?[A-Za-z0-9_./~-]+' <<<"$cmd" | sed -E 's/.*>>?[[:space:]]*"?//')
    t2=$(grep -oE '(^|[[:space:];|&(])tee[[:space:]]+(-a[[:space:]]+)?"?[A-Za-z0-9_./~-]+' <<<"$cmd" | sed -E 's/.*tee[[:space:]]+(-a[[:space:]]+)?"?//')
    t3=""
    if grep -qE '(^|[[:space:];|&(])(sed|perl)[[:space:]]+(-[A-Za-z]+[[:space:]]+)*-[A-Za-z]*i' <<<"$cmd"; then
      t3=$(grep -oE '[A-Za-z0-9_./~-]+\.[A-Za-z][A-Za-z0-9]*' <<<"$cmd")
    fi
    while IFS= read -r t; do
      [ -n "$t" ] || continue
      case "$t" in *'$'*|/dev/*) continue ;; esac
      # shellcheck disable=SC2088  # "~/" is a case glob pattern here, not a path to expand
      case "$t" in /*) p="$t" ;; "~/"*) p="$HOME/${t#\~/}" ;; *) p="${cwd:+${cwd%/}/}$t" ;; esac
      p=$(normalize "$p")
      skip_path "$p" && continue
      in_project "$p" || continue
      files="$files$p"$'\n'
    done < <(printf '%s\n%s\n%s\n' "$t1" "$t2" "$t3" | sort -u)
    [ -n "$files" ] || exit 0
    ;;
  *) exit 0 ;;
esac

# Subagent edits share the session_id: same pending list, cleaned at the main loop's Stop.
mkdir -p "$dir" 2>/dev/null || true
# During cleanup, suppress only edits to the files being cleaned — the skill's
# own edits must not re-arm the gate, but new debt elsewhere still counts.
if [ -f "$dir/cleaning" ] && [ -s "$dir/cleaned" ]; then
  files=$(printf '%s' "$files" | grep -vxF -f "$dir/cleaned" || true)
  [ -n "$files" ] || exit 0
  files="$files"$'\n'
fi
printf '%s' "$files" >>"$dir/pending"
exit 0
