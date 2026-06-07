#!/usr/bin/env bash
#
# Phase 2 — budgeted Opus audit of an optimized best_skill.md. Report-only.
#
# The validation gate proves the selection score rose; it does NOT prove the
# artifact is faithful, well-triggered, or anti-pattern-free. This runs ONE
# bounded Opus pass (the hard gate is max 2 review→fix rounds — this script is
# one round; re-run after applying fixes for the second).
#
# Usage:
#   bash audit.sh <path/to/best_skill.md> [report_path]
#   bash audit.sh outputs/my-run            # dir → uses <dir>/best_skill.md
#
# Output: an audit report (default <skill_dir>/audit_report.md). Does NOT edit
# the skill — apply fixes yourself, then re-score on held-out test before ship.
#
set -euo pipefail

die() { printf '❌ %s\n' "$*" >&2; exit 1; }

main() {
    [ $# -ge 1 ] || die "usage: audit.sh <best_skill.md | run_dir> [report_path]"
    command -v claude >/dev/null 2>&1 || die "\`claude\` CLI not on PATH"

    local target="$1"
    if [ -d "$target" ]; then target="${target%/}/best_skill.md"; fi
    [ -f "$target" ] || die "skill not found: $target (run skilldoc_run.py first)"

    local skill_dir; skill_dir="$(cd "$(dirname "$target")" && pwd)"
    local report="${2:-${skill_dir}/audit_report.md}"
    local model="${SKILLOPT_AUDIT_MODEL:-opus}"

    local prompt
    prompt="$(cat <<EOF
You are a strict, report-only auditor. Read the optimized skill at:
  ${target}
(and any references it links). Audit it on these dimensions, FAIL/CONCERN/PASS each:
  1. Faithfulness — does it actually serve its stated task, no drift?
  2. Triggering precision — will it fire when it should and not otherwise?
  3. Deterministic-eval alignment — guidance matches what graders reward?
  4. No leaked eval internals — it must not teach the target to game graders.
  5. Shell/safety anti-patterns — no dangerous, brittle, or unsafe instructions.

Output a markdown verdict TABLE (dimension | verdict | evidence | fix) followed
by a prioritized findings list, each with file-level evidence and a concrete
fix. Keep it to a single bounded pass (~150k tokens max), do NOT loop, and do
NOT edit any files — report only.
EOF
)"

    printf '  auditing %s with model=%s …\n' "$target" "$model"
    claude -p "$prompt" \
        --model "$model" \
        --permission-mode plan \
        --add-dir "$skill_dir" \
        --output-format text \
        > "$report" 2>/dev/null || die "claude audit call failed"

    printf '✅ audit report → %s\n' "$report"
    printf '   Next: apply FAIL-tier fixes, re-score on held-out test, then ship. Max 2 rounds.\n'
}

main "$@"
