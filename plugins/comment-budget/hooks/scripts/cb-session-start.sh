#!/usr/bin/env bash
set -u
doc=""
for candidate in \
  "${CLAUDE_PLUGIN_ROOT:-}/doctrine.md" \
  "$(dirname "$0")/../../doctrine.md"; do
  [ -f "$candidate" ] && doc=$(cat "$candidate") && break
done
if [ -n "$doc" ]; then
  printf '%s' "$doc"
else
  printf 'COMMENT BUDGET ACTIVE. Before typing any comment, default DELETE. Keep only non-obvious WHY; WATCH-OUT; POINTER for a removal condition, unavoidable vendor constraint, or external contract; public CONTRACT; TODO/FIXME/HACK with owner+problem+action and a ticket identifying the removal condition; or units/magic constant/empty catch. One line by default; scope to changed constructs.'
fi
exit 0
