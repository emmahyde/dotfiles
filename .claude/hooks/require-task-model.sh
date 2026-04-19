#!/bin/bash
# PreToolUse hook: Block Agent tool calls that don't specify an explicit model parameter.
# Prevents accidentally running expensive Opus agents when haiku/sonnet would suffice.

# Hook receives JSON on stdin with tool_input nested inside
if ! python3 -c "
import json, sys
data = json.load(sys.stdin)
tool_input = data.get('tool_input', {})
assert 'model' in tool_input
" 2>/dev/null; then
  echo '{"decision":"block","reason":"Agent tool requires explicit model parameter (e.g. model: \"haiku\"). Add model to avoid defaulting to expensive Opus."}'
  exit 0
fi

echo '{"decision":"allow"}'
exit 0
