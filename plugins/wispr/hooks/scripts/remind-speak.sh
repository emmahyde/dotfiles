#!/bin/bash
# Stop hook — blocks stop if user spoke via Wispr and Claude hasn't spoken back.
# Outputting text to stdout prevents the turn from ending.

PLUGIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SESSION_DIR=$(bash "$PLUGIN_DIR/hooks/scripts/find-session.sh") || exit 0

DICTATION="$SESSION_DIR/last-dictation"
SPEAK="$SESSION_DIR/last-speak"

# No dictation yet = allow stop
[[ ! -f "$DICTATION" ]] && exit 0

# If speak marker doesn't exist, or dictation is newer than speak, block stop
if [[ ! -f "$SPEAK" ]] || [[ "$DICTATION" -nt "$SPEAK" ]]; then
  echo "BLOCKED: The user spoke to you via Wispr voice and you have not spoken back yet. You MUST call speak.sh before your turn ends. Run: bash \$CLAUDE_PLUGIN_ROOT/scripts/speak.sh \"your reply here\" — then you may stop."
fi
exit 0
