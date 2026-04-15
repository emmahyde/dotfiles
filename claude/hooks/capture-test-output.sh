#!/bin/bash
# PreToolUse:Bash — Captures test output to a unique tmp file.
# Strips head/tail truncation so full output is always available.

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

# Match test commands — must START with a test runner, not just contain one
if ! echo "$cmd" | grep -qE '^(bundle exec (rake test|rails test|m |minitest)|rake test|npx vitest|npm test|npm run test|npx nx test)'; then
  exit 0
fi

# Skip if already capturing
if echo "$cmd" | grep -qE 'tee |>/tmp/test-'; then
  exit 0
fi

# Strip trailing | head/tail with any flags (e.g. | head -50, | tail -n 20)
cleaned=$(echo "$cmd" | sed -E 's/[[:space:]]*\|[[:space:]]*(head|tail)([[:space:]]+-[^|]*)?[[:space:]]*$//')

# Unique output file per run
outfile="/tmp/test-$(date +%s)-$$.txt"

# Tee full output to file, show first 80 lines to keep context manageable
# The summary line runs AFTER tee finishes so wc -l sees the complete file
wrapped="{ ${cleaned}; } 2>&1 | tee ${outfile}; echo \"--- Full output: ${outfile} (\$(wc -l < ${outfile})) lines ---\""

jq -n --arg cmd "$wrapped" --arg outfile "$outfile" '{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "updatedInput": { "command": $cmd },
    "additionalContext": ("Test output saved to " + $outfile + ". Read that file for full results — do NOT re-run tests to see more output.")
  }
}'
