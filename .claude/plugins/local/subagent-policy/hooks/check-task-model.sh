#!/bin/bash
set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# Only check Task tool calls
if [ "$tool_name" != "Task" ]; then
  exit 0
fi

model=$(echo "$input" | jq -r '.tool_input.model // empty')

if [ -z "$model" ]; then
  cat >&2 <<'EOF'
{
  "hookSpecificOutput": {
    "permissionDecision": "deny"
  },
  "systemMessage": "BLOCKED: Task tool requires an explicit `model` parameter. Select the cheapest model that can handle the job:\n\n- **haiku**: Default. Grep/search, single-file edits, straightforward fixes, formatting, simple reads.\n- **sonnet**: Multi-file analysis, moderate debugging, code review, refactoring.\n- **opus**: Orchestration, architectural planning, complex multi-step investigation.\n\nRetry with `model` set."
}
EOF
  exit 2
fi

exit 0
