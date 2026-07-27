#!/usr/bin/env bash
# Merge a saved handoff's tasks into the current session's task list.
#
# Counterpart to handoff-save.sh. Task files dropped into the live session's
# directory are picked up by the running session, so this restores real tasks
# rather than printing something to retype.
#
# Ids are rewritten, never preserved: a saved 1.json would clobber the current
# session's own 1.json. Incoming tasks are renumbered from max(existing)+1 and
# their blocks/blockedBy arrays are remapped through the same table, so
# dependencies survive the move.
#
# By default only actionable tasks (pending, in_progress) are merged — a
# handoff document's LEDGER already records what finished, and completed items
# from a prior session are noise in a fresh list. Pass --all to include them.
#
# The target directory is looked up, not guessed. Create one task in the fresh
# session first — anything, including "picking up handoff <name>" — then pass an
# exact fragment of its subject as --anchor. The one directory containing that
# text is provably the directory this session reads. See _resolve-task-dir.sh
# for why the path cannot be computed from the environment.
#
# Usage:
#   handoff-load.sh <name> --anchor "<text from a task subject>" [--all]
#   handoff-load.sh <name> --into <session-dir> [--all]   # explicit path
#   handoff-load.sh <name> --newest [--all]               # recency guess, opt-in
set -euo pipefail

usage() {
  echo 'usage: handoff-load.sh <name> --anchor "<text from a task subject>" [--all]' >&2
  echo '       handoff-load.sh <name> --into <session-dir> | --newest [--all]' >&2
}

name="${1:-}"
if [[ -z "$name" || "$name" == -* ]]; then usage; exit 2; fi
shift

command -v jq > /dev/null 2>&1 || { echo "handoff-load.sh requires jq (brew install jq)" >&2; exit 1; }

source "$(dirname "${BASH_SOURCE[0]}")/_resolve-task-dir.sh"

handoff_dir="$HOME/.claude/handoffs"
src="$handoff_dir/$name.tasks.json"
doc="$handoff_dir/$name.md"
into=""
anchor=""
newest=false
include_completed=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) include_completed=true; shift ;;
    --into) into="${2:-}"; shift 2 ;;
    --anchor) anchor="${2:-}"; shift 2 ;;
    --newest) newest=true; shift ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -f "$src" ]] || { echo "no saved tasks at $src" >&2; exit 1; }

# ── resolve the target session directory ──────────────────────────
if [[ -z "$into" ]]; then
  if [[ -n "$anchor" ]]; then
    into=$(resolve_by_anchor "$anchor") || exit 1
  elif $newest; then
    into=$(resolve_by_recency) || exit 1
  else
    echo "no directory given. Create one task in this session, then pass a fragment" >&2
    echo "of its subject as --anchor. Or use --into <dir> / --newest." >&2
    exit 2
  fi
fi

[[ -d "$into" ]] || { echo "not a directory: $into" >&2; exit 1; }

# ── next free id ──────────────────────────────────────────────────
next=1
shopt -s nullglob
for f in "$into"/[0-9]*.json; do
  id=$(basename "$f" .json)
  [[ "$id" =~ ^[0-9]+$ ]] && (( id >= next )) && next=$(( id + 1 ))
done
shopt -u nullglob

filter='.'
$include_completed || filter='[ .[] | select(.status == "pending" or .status == "in_progress") ]'

# Build the old-id -> new-id table first, then rewrite every task through it in
# one pass so blocks/blockedBy still point at the right tasks after renumbering.
jq -c --argjson start "$next" --arg dir "$into" "
  $filter
  | ( [ to_entries[] | { key: .value.id, value: (\$start + .key | tostring) } ] | from_entries ) as \$map
  | to_entries[]
  | .value
  | .id = ( \$map[.id] // .id )
  | .blocks    = [ (.blocks    // [])[] | \$map[.] // empty ]
  | .blockedBy = [ (.blockedBy // [])[] | \$map[.] // empty ]
  | { path: (\$dir + \"/\" + .id + \".json\"), task: . }
" "$src" | while read -r line; do
  path=$(printf '%s' "$line" | jq -r '.path')
  printf '%s' "$line" | jq '.task' > "$path"
  printf '  %s  %s\n' "$(basename "$path")" "$(printf '%s' "$line" | jq -r '.task.subject')"
done > /tmp/handoff-load-$$.out

merged=$(wc -l < /tmp/handoff-load-$$.out | tr -d ' ')
echo "target:  $into"
echo "merged:  $merged task(s) from $src"
cat /tmp/handoff-load-$$.out
rm -f /tmp/handoff-load-$$.out

if [[ -s "$doc" ]]; then
  echo
  echo "Read the handoff document before acting: $doc"
fi
