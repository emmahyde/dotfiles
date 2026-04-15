#!/usr/bin/env bash
set -euo pipefail

# Injects a 20k token budget into search/lookup agent prompts to prevent runaway research.
# Targets: web-search-researcher, codebase-locator, codebase-analyzer, explore agents,
# researcher-low, and documentation-researcher. (researcher is excluded — needs full budget)

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

[[ "$tool_name" == "Agent" ]] || exit 0

subagent_type=$(echo "$input" | jq -r '.tool_input.subagent_type // empty')

# Match search/lookup agent types
case "$subagent_type" in
  rpi:web-search-researcher|rpi:codebase-locator|rpi:codebase-analyzer|rpi:codebase-pattern-finder|rpi:documentation-researcher|\
  Explore|explore|explore-medium|explore-high|\
  researcher-low|\
  general-purpose)
    ;;
  *) exit 0 ;;
esac

original_prompt=$(echo "$input" | jq -r '.tool_input.prompt // empty')

budget_prefix="TOKEN BUDGET: You have a HARD LIMIT of 20,000 output tokens for this entire task. Be concise. Prioritize the most relevant findings. Stop searching once you have a clear answer — do not exhaustively explore every angle. If you reach 15,000 tokens, wrap up immediately with what you have.

---

"

updated_input=$(echo "$input" | jq -c --arg prefix "$budget_prefix" '.tool_input.prompt = ($prefix + .tool_input.prompt)')

# Return updatedInput to modify the agent's prompt
cat <<EOF
{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":$(echo "$updated_input" | jq -c '.tool_input')}}
EOF
