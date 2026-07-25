#!/usr/bin/env bash
# Spawn a fresh `claude` agent in a new iTerm2 split, seeded with a prompt read from a file.
#
# Usage: spawn_in_split.sh <prompt-file> [vertical|horizontal]
#
# The prompt is passed via a file (never as a shell/AppleScript argument), so arbitrary
# content — quotes, $, backticks, newlines — is safe. A tiny launcher script keeps the
# iTerm2 `write text` payload quote-free.
set -euo pipefail

PROMPT_FILE="${1:-}"
DIRECTION="${2:-vertical}"
WORKDIR="$PWD"

if [[ -z "$PROMPT_FILE" ]]; then
  echo "usage: spawn_in_split.sh <prompt-file> [vertical|horizontal]" >&2
  exit 2
fi
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "error: prompt file not found: $PROMPT_FILE" >&2
  exit 2
fi
if [[ "${TERM_PROGRAM:-}" != "iTerm.app" ]]; then
  echo "error: requires iTerm2 (TERM_PROGRAM='${TERM_PROGRAM:-unset}'). Open this session in iTerm2 and retry." >&2
  exit 1
fi

case "$DIRECTION" in
  vertical)   SPLIT_CMD="split vertically with default profile" ;;
  horizontal) SPLIT_CMD="split horizontally with default profile" ;;
  *) echo "error: direction must be 'vertical' or 'horizontal' (got '$DIRECTION')" >&2; exit 2 ;;
esac

# Absolute path — the launcher reads this file at spawn time, in the new pane.
PROMPT_FILE="$(cd "$(dirname "$PROMPT_FILE")" && pwd)/$(basename "$PROMPT_FILE")"

# Write a one-shot launcher so the command iTerm2 runs is a quote-free `bash <path>`.
LAUNCHER="$(mktemp "${TMPDIR:-/tmp}/spawn-agent.XXXXXX")"
# Launch through the user's interactive shell so their `claude` wrapper
# (flags, --append-system-prompt-file, env) applies — not a bare binary.
# Primary: a fish `claude` function/alias. Fallback: plain claude.
if command -v fish >/dev/null 2>&1 && fish -c 'functions -q claude' >/dev/null 2>&1; then
  cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
cd $(printf %q "$WORKDIR")
exec fish -l -c 'claude (cat $(printf %q "$PROMPT_FILE") | string collect)'
EOF
else
  cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
cd $(printf %q "$WORKDIR")
exec claude "\$(cat $(printf %q "$PROMPT_FILE"))"
EOF
fi

# Use fully-qualified inline references throughout. Capturing a `current tab`
# variable goes stale on iTerm2 3.7 beta ("Can't get tab 1"); the inline form
# `sessions of current tab of current window` is reliable. The new pane is the
# one whose tty wasn't present before the split.
osascript <<OSA
tell application "iTerm2"
  set oldTtys to (tty of sessions of current tab of current window)
  tell current session of current tab of current window to $SPLIT_CMD
  delay 0.5
  repeat with s in (sessions of current tab of current window)
    if (tty of s) is not in oldTtys then
      tell s to write text "bash $LAUNCHER"
    end if
  end repeat
end tell
OSA

echo "Spawned a fresh Claude agent in a $DIRECTION iTerm2 split (cwd: $WORKDIR)."
