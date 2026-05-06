#!/bin/bash
# Speak text via TTS.
# Usage: speak.sh "text to speak"
#
# Provider auto-selected:
#   - ElevenLabs if ELEVENLABS_API_KEY env var is set (curl + afplay required)
#   - macOS `say` otherwise (or as fallback on any ElevenLabs failure)
#
# Voice resolution:
#   - say:        WISPR_VOICE → wispr_voice → Samantha
#   - ElevenLabs: WISPR_ELEVENLABS_VOICE_ID → ELEVENLABS_VOICE_ID → elevenlabs_voice_id → 21m00Tcm4TlvDq8ikWAM (Rachel)

set -u

CONFIG="$HOME/.claude/wispr-config.yml"

_cfg() {
  grep -E "^$1:[[:space:]]*" "$CONFIG" 2>/dev/null \
    | sed "s/^$1:[[:space:]]*//" \
    | tr -d '"'"'" \
    | xargs
}

TEXT="$*"
[ -z "$TEXT" ] && exit 0

_say_fallback() {
  local v="${WISPR_VOICE:-$(_cfg wispr_voice)}"
  say -v "${v:-Samantha}" -r 200 "$TEXT"
}

if [ -n "${ELEVENLABS_API_KEY:-}" ] && command -v curl >/dev/null 2>&1 && command -v afplay >/dev/null 2>&1; then
  VOICE_ID="${WISPR_ELEVENLABS_VOICE_ID:-${ELEVENLABS_VOICE_ID:-$(_cfg elevenlabs_voice_id)}}"
  VOICE_ID="${VOICE_ID:-21m00Tcm4TlvDq8ikWAM}"
  MODEL="${WISPR_ELEVENLABS_MODEL:-$(_cfg elevenlabs_model)}"
  MODEL="${MODEL:-eleven_turbo_v2_5}"

  TMP="$(mktemp -t wispr-tts).mp3"
  trap 'rm -f "$TMP"' EXIT

  PAYLOAD=$(TEXT="$TEXT" MODEL="$MODEL" python3 -c '
import json, os
print(json.dumps({"text": os.environ["TEXT"], "model_id": os.environ["MODEL"]}))
' 2>/dev/null)

  if [ -n "$PAYLOAD" ]; then
    HTTP_CODE=$(curl -sS -o "$TMP" -w "%{http_code}" \
      -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128" \
      -H "xi-api-key: $ELEVENLABS_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ] && [ -s "$TMP" ]; then
      afplay "$TMP"
      exit 0
    fi
    echo "wispr: ElevenLabs TTS failed (HTTP $HTTP_CODE), falling back to say" >&2
  fi
fi

_say_fallback
