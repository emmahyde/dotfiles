#!/bin/bash
LOG=~/.claude/hooks/clean-copy.log
echo "$(date): triggered" >> "$LOG"

# 1. Simulate Cmd+C to grab selection
osascript -e 'tell application "System Events" to keystroke "c" using command down'
sleep 0.3

BEFORE=$(pbpaste | head -c 200)
echo "BEFORE: $BEFORE" >> "$LOG"

# 2. Strip ⏺ prefix, strip all leading whitespace, rejoin soft-wrapped lines
pbpaste | \
  sed 's/^⏺ //' | \
  sed 's/^[[:space:]]*//' | \
  perl -00 -pe 's/\n(?!\n)/ /g; s/  +/ /g' | \
  pbcopy

AFTER=$(pbpaste | head -c 200)
echo "AFTER: $AFTER" >> "$LOG"
echo "---" >> "$LOG"
