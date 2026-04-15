#!/bin/sh
# PreToolUse hook: When Edit tool is used and old_string contains "replace",
# remind to consider replace_all: true

tool_name="$CLAUDE_TOOL_NAME"
tool_input="$CLAUDE_TOOL_INPUT"

case "$tool_name" in
  Edit)
    has_replace_all=$(echo "$tool_input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
replace_all = d.get('replace_all', False)
old = d.get('old_string', '')
new = d.get('new_string', '')
# If not using replace_all and the change looks like a rename (short strings, similar structure)
if not replace_all and len(old) < 80 and len(new) < 80 and old != new:
    # Check if old_string appears to be a symbol/variable/identifier rename
    old_words = old.strip().split()
    new_words = new.strip().split()
    if len(old_words) <= 3 and len(new_words) <= 3:
        print('CONSIDER')
    else:
        print('OK')
else:
    print('OK')
" 2>/dev/null)
    if [ "$has_replace_all" = "CONSIDER" ]; then
      printf '{"decision":"approve","message":"REMINDER: This looks like a rename. Did you mean to set replace_all: true to catch all occurrences?"}'
      exit 0
    fi
    ;;
esac

printf '{"decision":"approve"}'
