#!/usr/bin/env bash
# Shared task-directory resolver for handoff-save.sh / handoff-load.sh.
# Sourced, not executed.
#
# The directory cannot be computed. Task state lives in
# ~/.claude/tasks/session-<8hex>/ keyed on the session LINEAGE ROOT, and
# CLAUDE_CODE_SESSION_ID holds the current transcript id instead — in a
# resumed or condensed chain these differ (tested 2026-07-26: transcript
# 5aa7bd2d read tasks from session-4869cabf and ignored a task written to
# session-5aa7bd2d entirely). Deriving the path from the environment fails
# silently, which is the worst available failure mode.
#
# So resolve by lookup, not inference: grep the store for the exact text of a
# task subject the caller can see in its own task list. Exactly one directory
# contains it, and that is the live one. Zero or several hits is an error, not
# a tiebreak — the caller is told what was found and nothing is written.

tasks_root="${TASKS_ROOT:-$HOME/.claude/tasks}"

# resolve_by_anchor <anchor-text> -> prints the directory, or fails
resolve_by_anchor() {
  local anchor="$1" hits count
  [[ -n "$anchor" ]] || { echo "resolve_by_anchor: empty anchor" >&2; return 2; }

  hits=$(grep -rlF -- "$anchor" "$tasks_root"/*/[0-9]*.json 2>/dev/null \
         | while read -r f; do dirname "$f"; done | sort -u)

  count=$(printf '%s' "$hits" | grep -c . || true)

  if [[ "$count" -eq 1 ]]; then
    printf '%s\n' "$hits"
    return 0
  fi

  if [[ "$count" -eq 0 ]]; then
    echo "no task contains the anchor text: $anchor" >&2
    echo "paste an exact fragment of a subject from your current task list;" >&2
    echo "if the list is empty, create one task first so the directory exists." >&2
  else
    echo "anchor text is ambiguous — $count directories contain it:" >&2
    printf '  %s\n' $hits >&2
    echo "use a longer, more distinctive fragment, or pass an explicit directory." >&2
  fi
  return 1
}

# resolve_by_recency -> prints the most recently modified dir holding task JSON
# Opt-in only. A concurrent subagent can win this race; nothing calls it unless
# the caller passed --newest.
resolve_by_recency() {
  local d
  for d in $(ls -td "$tasks_root"/*/ 2>/dev/null); do
    if compgen -G "${d}[0-9]*.json" > /dev/null; then printf '%s\n' "${d%/}"; return 0; fi
  done
  echo "no directory with task JSON found under $tasks_root" >&2
  return 1
}
