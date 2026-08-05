#!/usr/bin/env bash
# SessionStart hook: injects project-conditional facts so static CLAUDE.md text
# doesn't have to carry per-project conditionality (guardrails R1).
# Fail-safe: any error exits 0 with no output — a broken detector must never
# block session start or inject garbage.
set -uo pipefail
input=$(cat) || exit 0
cwd=$(printf '%s' "$input" | jq -r '.cwd // ""') || exit 0
[ -n "$cwd" ] && [ -d "$cwd" ] || exit 0

lines=()

if [ -d "$cwd/.tokensave" ]; then
  lines+=("- .tokensave/ index PRESENT in this project: for code discovery (where code lives, callers, impact) read ~/.claude/guardrails/TOOLING.md §tokensave before any Grep/Glob sweep.")
else
  lines+=("- No .tokensave/ index here: use Grep/Glob directly for discovery; do not reference tokensave.")
fi

if ! git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  lines+=("- NOT a git repository: every git-diff/status evidence step in the guardrails kit is replaced by the shasum/ls -lT substitute owned by ~/.claude/guardrails/SESSION.md S1 — never N/A.")
fi

[ ${#lines[@]} -gt 0 ] || exit 0

ctx="Project capabilities detected at session start:"$'\n'
for l in "${lines[@]}"; do ctx+="$l"$'\n'; done

jq -n --arg c "$ctx" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $c
  }
}'
