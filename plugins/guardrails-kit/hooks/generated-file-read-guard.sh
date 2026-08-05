#!/usr/bin/env bash
# PreToolUse hook on Read: denies reads of lockfiles and generated/vendored
# artifacts (EFFICIENCY.md E12). These files are huge and machine-written;
# reading them dumps thousands of useless lines into context.
set -euo pipefail
input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""')

if printf '%s' "$path" | grep -qE '(/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|uv\.lock|Gemfile\.lock|composer\.lock)$|/node_modules/|/dist/|/build/[^/]+\.(js|css|map)$|\.min\.(js|css)$|\.map$)'; then
  jq -n --arg p "$path" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("Read of " + $p + " blocked: lockfile/generated/vendored artifact (EFFICIENCY E12). Query it surgically via Bash instead — e.g. jq .packages[] or grep -n <name> — never a full Read.")
    }
  }'
else
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse"}}\n'
fi
