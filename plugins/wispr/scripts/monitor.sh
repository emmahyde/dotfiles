#!/bin/bash
# Wispr Flow voice monitor — polls History table, emits new transcriptions to stdout.
# Each stdout line becomes a Claude Code Monitor notification.
#
# Config: ~/.claude/wispr-config.yml
#   trigger_word  — only forward dictations starting with this word (stripped before emit)
#                   set to empty string to forward all dictations (default: claude)
#
# Env vars (override config):
#   WISPR_APP            — filter to specific app bundle ID (default: all apps)
#   WISPR_POLL_INTERVAL  — poll frequency in seconds (default: 0.5)

CONFIG="$HOME/.claude/wispr-config.yml"

# Create default config on first run
if [[ ! -f "$CONFIG" ]]; then
  mkdir -p "$(dirname "$CONFIG")"
  cat > "$CONFIG" <<'YAML'
# Wispr Voice plugin configuration

# Trigger word: only forward dictations that start with this word (case-insensitive).
# The trigger word is stripped before the text reaches Claude.
# Set to empty string to forward all dictations.
trigger_word: claude

# Terminal app filter — only forward dictations from this app (leave blank for all apps).
# Find your bundle ID: osascript -e 'id of app "YourApp"'
# wispr_app:

# macOS say voice for TTS responses.
# Premium voices give much better quality — install via System Settings → Accessibility → Spoken Content.
# wispr_voice: Samantha
YAML
  echo "[wispr-monitor] created default config at $CONFIG" >&2
fi

_cfg() {
  grep -E "^$1:[[:space:]]*" "$CONFIG" 2>/dev/null \
    | sed "s/^$1:[[:space:]]*//" \
    | tr -d '"'"'" \
    | xargs
}

TRIGGER=$(_cfg trigger_word | tr '[:upper:]' '[:lower:]')

DB="$HOME/Library/Application Support/Wispr Flow/flow.sqlite"
POLL="${WISPR_POLL_INTERVAL:-0.5}"
# WISPR_APP env var takes precedence; fall back to wispr_app in config
APP="${WISPR_APP:-$(_cfg wispr_app)}"

if [[ ! -f "$DB" ]]; then
  echo "[wispr-monitor] error: Wispr Flow database not found at $DB" >&2
  exit 1
fi

SESSION_DIR=$(mktemp -d /tmp/wispr-session-XXXXXX)
SEEN_IDS="$SESSION_DIR/seen-ids"
LAST_TS_FILE="$SESSION_DIR/last-ts"
ACTIVE_MARKER="$SESSION_DIR/active"
DICTATION_MARKER="$SESSION_DIR/last-dictation"

echo $$ > "$ACTIVE_MARKER"
touch "$SEEN_IDS"

# Write session dir path so hooks can find it
echo "$SESSION_DIR" > /tmp/wispr-session-current-$$
trap 'rm -rf "$SESSION_DIR" /tmp/wispr-session-current-$$' EXIT

sqlite3 "file:$DB?mode=ro" \
  "SELECT transcriptEntityId FROM History
   WHERE status='formatted' AND isArchived=0
     AND timestamp >= (SELECT MAX(timestamp) FROM History
                       WHERE status='formatted' AND isArchived=0)" \
  2>/dev/null | sort -u > "$SEEN_IDS"

LAST_TS=$(sqlite3 "file:$DB?mode=ro" \
  "SELECT COALESCE(MAX(timestamp),'') FROM History
   WHERE status='formatted' AND isArchived=0" \
  2>/dev/null)
echo "$LAST_TS" > "$LAST_TS_FILE"

LABEL="(all apps)"
[[ -n "$APP" ]] && LABEL="(app=$APP)"
[[ -n "$TRIGGER" ]] && LABEL="$LABEL trigger=$TRIGGER"
echo "[wispr-monitor] ready $LABEL"

while true; do
  sleep "$POLL"
  LAST_TS=$(cat "$LAST_TS_FILE")

  if [[ -n "$APP" ]]; then
    QUERY="SELECT transcriptEntityId, formattedText, timestamp FROM History
           WHERE status='formatted' AND isArchived=0
             AND timestamp > '$LAST_TS' AND app='$APP'
           ORDER BY timestamp ASC"
  else
    QUERY="SELECT transcriptEntityId, formattedText, timestamp FROM History
           WHERE status='formatted' AND isArchived=0
             AND timestamp > '$LAST_TS'
           ORDER BY timestamp ASC"
  fi

  sqlite3 -separator $'\t' "file:$DB?mode=ro" "$QUERY" 2>/dev/null | while IFS=$'\t' read -r eid text ts; do
    [[ -z "$text" ]] && continue
    text="${text#"${text%%[![:space:]]*}"}"
    text="${text%"${text##*[![:space:]]}"}"
    [[ -z "$text" ]] && continue

    # Apply trigger word gate
    if [[ -n "$TRIGGER" ]]; then
      lower="${text,,}"
      if [[ "$lower" != "$TRIGGER" && "$lower" != "$TRIGGER "* ]]; then
        continue
      fi
      # Strip the trigger word and any following whitespace
      text="${text:${#TRIGGER}}"
      text="${text#"${text%%[![:space:]]*}"}"
      [[ -z "$text" ]] && continue
    fi

    if ! grep -qxF "$eid" "$SEEN_IDS" 2>/dev/null; then
      echo "$eid" >> "$SEEN_IDS"
      echo "$text"
      echo "$ts" > "$LAST_TS_FILE"
      touch "$DICTATION_MARKER"
    fi
  done
done
