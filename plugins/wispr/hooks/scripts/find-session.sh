#!/bin/bash
# Finds the active wispr session directory.
# Prints the session dir path to stdout if found, exits 1 otherwise.

for f in /tmp/wispr-session-current-*; do
  [[ ! -f "$f" ]] && continue
  PID="${f##*-}"
  if kill -0 "$PID" 2>/dev/null; then
    SESSION_DIR=$(cat "$f")
    if [[ -d "$SESSION_DIR" && -f "$SESSION_DIR/active" ]]; then
      echo "$SESSION_DIR"
      exit 0
    fi
  else
    rm -f "$f"
  fi
done
exit 1
