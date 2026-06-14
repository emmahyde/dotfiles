#!/usr/bin/env bash
# SessionStart hook: until code-aware is configured, inject a one-line nudge to run /wizard.
# Goes quiet once ~/.claude/.code-aware-configured exists (written by /wizard or install.sh).
# Fires at most once per session (sentinel keyed on session_id). stdout = additionalContext.
set -uo pipefail

input="$(cat 2>/dev/null || true)"
sid="$(printf '%s' "$input" | jq -r '.session_id // "nosid"' 2>/dev/null || echo nosid)"
session_marker="${TMPDIR:-/tmp}/cc-codeaware-wiz-${sid}"
configured="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.code-aware-configured"

# Already set up, or already nudged this session → stay silent.
[ -e "$configured" ] && exit 0
[ -e "$session_marker" ] && exit 0
touch "$session_marker" 2>/dev/null || true

cat <<'EOF'
<code-aware-setup>
The **code-aware** plugin is installed but not yet configured on this machine.
Suggest the user run **/wizard** to walk through setup — it installs the code-intelligence
CLI stack (lumen · sem · grepai · ast-grep · lizard · ctx7), enables the dependency plugins,
injects the investigation rules into CLAUDE.md, runs `grepai agent-setup`, and pulls down skills.
Mention this once; don't repeat it unprompted.
</code-aware-setup>
EOF
exit 0
