#!/usr/bin/env bash
# Save the current session's task list beside a handoff document.
#
# Task state lives in ~/.claude/tasks/<session-dir>/<id>.json and is per-session:
# a new session reads a different directory, so nothing migrates across /clear.
# This copies the JSON into ~/.claude/handoffs/ under a chosen name, where it
# survives the wipe and can be merged back by handoff-load.sh.
#
# The session directory cannot be derived from the environment, so it is looked
# up instead of guessed: pass --anchor with an exact fragment of a subject from
# the task list you can see, and the one directory containing that text is the
# live one. Zero or several matches is an error — nothing is written.
#
# Usage:
#   handoff-save.sh <name> --anchor "<text from a task subject>"
#   handoff-save.sh <name> --from <session-dir>    # explicit path
#   handoff-save.sh <name> --newest                # recency guess, opt-in only
#
# Writes:
#   ~/.claude/handoffs/<name>.tasks.json   all tasks, newest snapshot
#   ~/.claude/handoffs/<name>.md           created empty if absent (you write the doc)
set -euo pipefail

usage() {
  echo 'usage: handoff-save.sh <name> --anchor "<text from a task subject>"' >&2
  echo '       handoff-save.sh <name> --from <session-dir> | --newest' >&2
}

name="${1:-}"
if [[ -z "$name" || "$name" == -* ]]; then usage; exit 2; fi
shift

source "$(dirname "${BASH_SOURCE[0]}")/_resolve-task-dir.sh"

handoff_dir="$HOME/.claude/handoffs"
from=""
anchor=""
newest=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from) from="${2:-}"; shift 2 ;;
    --anchor) anchor="${2:-}"; shift 2 ;;
    --newest) newest=true; shift ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

# ── resolve the session directory ─────────────────────────────────
if [[ -z "$from" ]]; then
  if [[ -n "$anchor" ]]; then
    from=$(resolve_by_anchor "$anchor") || exit 1
  elif $newest; then
    from=$(resolve_by_recency) || exit 1
  else
    echo "no directory given. Pass --anchor with text you can see in your task list," >&2
    echo "or --from <dir>, or --newest to accept the recency guess." >&2
    exit 2
  fi
fi

[[ -d "$from" ]] || { echo "not a directory: $from" >&2; exit 1; }

shopt -s nullglob
files=("$from"/[0-9]*.json)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "no task files in $from — nothing to save" >&2
  exit 1
fi

# ── bundle every task into one array ──────────────────────────────
mkdir -p "$handoff_dir"
out="$handoff_dir/$name.tasks.json"
doc="$handoff_dir/$name.md"

if command -v jq > /dev/null 2>&1; then
  jq -s '.' "${files[@]}" > "$out"
else
  # Concatenate by hand so the script works without jq. Task files are written
  # by Claude Code and are always a single well-formed object each.
  { echo "["
    sep=""
    for f in "${files[@]}"; do printf '%s\n' "$sep"; cat "$f"; sep=","; done
    echo "]"
  } > "$out"
fi

[[ -f "$doc" ]] || : > "$doc"

count=${#files[@]}
echo "source:  $from"
echo "tasks:   $count -> $out"
echo "doc:     $doc"
echo
echo "Subjects saved — confirm these match the task list you can see:"
grep -h '"subject"' "${files[@]}" | sed 's/.*"subject": "/  - /; s/",$//; s/"$//'
