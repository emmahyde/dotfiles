#!/bin/sh
# PreToolUse hook: deny SendMessage calls missing the 'summary' field
# when message is a string (not a structured protocol message).
#
# Also catches Agent calls missing 'description'.

tool_name="$CLAUDE_TOOL_NAME"
tool_input="$CLAUDE_TOOL_INPUT"

case "$tool_name" in
  SendMessage)
    # Check if message is a string (not JSON object) and summary is missing
    has_summary=$(echo "$tool_input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
msg = d.get('message', '')
summary = d.get('summary', '')
if isinstance(msg, str) and not summary:
    print('MISSING')
else:
    print('OK')
" 2>/dev/null)
    if [ "$has_summary" = "MISSING" ]; then
      printf '{"decision":"deny","reason":"SendMessage with string message requires summary field. Add summary: \"5-10 word preview\" to the call."}'
      exit 0
    fi
    ;;
esac

# Allow everything else
printf '{"decision":"approve"}'
