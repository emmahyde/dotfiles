#!/usr/bin/env bash
# SessionStart (startup|resume|compact): emit the full doctrine as context.
# Reads doctrine.md so edits to the source of truth propagate; falls back to a
# minimal rule if the file is missing so activation never silently no-ops.
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
  printf 'COMMENT BUDGET ACTIVE. Comments say only why / watch-out / pointer / contract / marker / units — never what, never history ("Added/Fixed/V2/see STATE"). At most ~1 comment line per 10 code lines, one line each.'
fi
exit 0
