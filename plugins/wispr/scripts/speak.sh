#!/bin/bash
# Speak text using macOS say.
# Usage: speak.sh "text to speak"
#
# Voice resolved in order:
#   1. WISPR_VOICE env var
#   2. wispr_voice in ~/.claude/wispr-config.yml
#   3. Default: Samantha

CONFIG="$HOME/.claude/wispr-config.yml"

_cfg() {
  grep -E "^$1:[[:space:]]*" "$CONFIG" 2>/dev/null \
    | sed "s/^$1:[[:space:]]*//" \
    | tr -d '"'"'" \
    | xargs
}

TEXT="$*"
SAY_VOICE="${WISPR_VOICE:-$(_cfg wispr_voice)}"
say -v "${SAY_VOICE:-Samantha}" -r 200 "$TEXT"
