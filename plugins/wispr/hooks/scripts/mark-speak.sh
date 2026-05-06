#!/bin/bash
# PostToolUse hook for Bash — marks when speak.sh was last used.
# Reads tool input from stdin (JSON), checks if command contains speak.sh.

INPUT=$(cat)
if echo "$INPUT" | grep -q 'speak\.sh'; then
  PLUGIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
  SESSION_DIR=$(bash "$PLUGIN_DIR/hooks/scripts/find-session.sh") || exit 0
  touch "$SESSION_DIR/last-speak"
fi
exit 0
