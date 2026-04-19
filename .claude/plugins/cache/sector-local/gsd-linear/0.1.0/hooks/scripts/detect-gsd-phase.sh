#!/bin/bash
# Detects GSD phase lifecycle bash calls and emits a system message
# asking Claude to sync the affected phase to Linear.
set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only act on gsd-tools.cjs calls
if ! echo "$COMMAND" | grep -q "gsd-tools.cjs"; then
  exit 0
fi

# Phase complete: phase just finished — post completion comment + mark Done
if echo "$COMMAND" | grep -qE "phase complete|phase-complete"; then
  PHASE=$(echo "$COMMAND" | grep -oE '"[0-9]+(\.[0-9]+)?"' | tr -d '"' | head -1)
  if [ -n "$PHASE" ]; then
    echo "{\"systemMessage\": \"GSD phase $PHASE just completed. If .planning/linear-sync.json exists and is configured, invoke the gsd-linear:linear-syncer agent to post the completion comment and mark the Linear issue Done for phase $PHASE. Skip silently if linear-sync.json is missing or unconfigured.\"}"
  fi
  exit 0
fi

# Phase init (execute-phase): phase about to be executed — create issue + todos
if echo "$COMMAND" | grep -qE "init execute-phase|init.+execute-phase"; then
  PHASE=$(echo "$COMMAND" | grep -oE '"[0-9]+(\.[0-9]+)?"' | tr -d '"' | head -1)
  if [ -n "$PHASE" ]; then
    echo "{\"systemMessage\": \"GSD is about to execute phase $PHASE. If .planning/linear-sync.json exists and is configured, invoke the gsd-linear:linear-syncer agent to create a Linear issue for phase $PHASE (if one doesn't already exist) and add its plans as todos. Skip silently if linear-sync.json is missing or unconfigured.\"}"
  fi
  exit 0
fi

exit 0
