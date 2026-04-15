#!/bin/bash
# Enforce explicit model selection when spawning subagents via the Agent tool.
# Blocks Agent calls that omit the model parameter.

input=$(cat)
model=$(echo "$input" | jq -r '.tool_input.model // empty')

# Allow if a valid model is specified
if [[ "$model" =~ ^(haiku|sonnet|opus)$ ]]; then
  exit 0
fi

cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Agent blocked: pass model: \"haiku\", \"sonnet\", or \"opus\".\n\nhaiku  — search, lookup, format, docs, simple well-defined tasks\nsonnet — implement, review, debug, research, build-fix (default)\nopus   — architecture, ambiguous problems, multi-file refactors, security audits"
  }
}
EOF
