#!/bin/bash
set -euo pipefail

input=$(cat)
agent_id=$(echo "$input" | jq -r '.agent_id // empty')
agent_type=$(echo "$input" | jq -r '.agent_type // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')

# --- Find active session (most recent by directory name) ---
session_base="$cwd/.claude/sessions"
[ ! -d "$session_base" ] && exit 0

session_dir=$(ls -d "$session_base"/[0-9]*-[0-9]*/ 2>/dev/null | sort -r | head -1)
[ -z "$session_dir" ] && exit 0

session_name=$(basename "$session_dir")

# --- Find or create agent directory ---
agent_dir=""

# Scan for a pre-created directory the orchestrator tagged for this agent type.
# Protocol: orchestrator writes `echo "agent_type" > {dir}/.agent_type` when
# pre-staging a directory. The hook claims the first unclaimed match.
for dir in "$session_dir"*/; do
  [ ! -d "$dir" ] && continue
  dname=$(basename "$dir")
  [ "$dname" = "orchestrator" ] && continue
  [[ "$dname" = .* ]] && continue

  # Skip already-claimed directories
  [ -f "$dir/.claimed" ] && continue

  # If tagged, only match our type
  if [ -f "$dir/.agent_type" ]; then
    tagged_type=$(cat "$dir/.agent_type")
    [ "$tagged_type" != "$agent_type" ] && continue
  else
    # Untagged directory — skip (could belong to anyone)
    continue
  fi

  # Claim atomically: mkdir is atomic on POSIX
  lock_dir="$dir/.claim_lock_$$"
  if mkdir "$lock_dir" 2>/dev/null; then
    echo "$agent_id" > "$dir/.claimed"
    rmdir "$lock_dir"
    agent_dir="$dir"
    break
  fi
done

# Fallback: no pre-staged directory found — create one
if [ -z "$agent_dir" ]; then
  ts=$(date +%Y%m%d-%H%M%S)
  agent_dir="${session_dir}${agent_type}-${ts}/"
  mkdir -p "$agent_dir"
  echo "$agent_id" > "$agent_dir/.claimed"
  echo "$agent_type" > "$agent_dir/.agent_type"
fi

# --- Build context injection ---
context="SUBAGENT CONTEXT
type: ${agent_type}
session: ${session_name}
output_dir: ${agent_dir}

Write all deliverables to files in your output directory.
When finished, respond ONLY: task complete: ${agent_dir}output.md"

# --- Load pre-staged resources (non-hidden files placed before spawn) ---
has_resources=false
for f in "$agent_dir"*; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  [[ "$fname" = .* ]] && continue

  if [ "$has_resources" = false ]; then
    context="${context}

PRE-STAGED RESOURCES (loaded from your output directory):"
    has_resources=true
  fi

  context="${context}

--- ${fname} ---
$(cat "$f")"
done

# --- Emit ---
jq -n --arg ctx "$context" '{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": $ctx
  }
}'
