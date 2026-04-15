#!/bin/bash
# Sets the cmux workspace title to "repo/branch"
# Skips silently if not inside cmux
[ -z "$CMUX_WORKSPACE_ID" ] && exit 0

repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
branch=$(git branch --show-current 2>/dev/null)

[ -z "$repo" ] && exit 0

printf '\033]0;%s/%s\007' "$repo" "${branch:-detached}" > /dev/tty 2>/dev/null
exit 0
