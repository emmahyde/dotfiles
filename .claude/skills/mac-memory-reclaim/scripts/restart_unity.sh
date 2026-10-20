#!/usr/bin/env bash
# Cold-restarts the Unity editor for one project. Refuses rather than risking unsaved work.
set -uo pipefail

UNITY_CLI="${UNITY_CLI:-$HOME/.unity/bin/unity}"
PROJECT="${1:-}"

[ -x "$UNITY_CLI" ] || { echo "ERROR: unity CLI not found at $UNITY_CLI"; exit 1; }

status_json=$("$UNITY_CLI" status --json 2>/dev/null || true)
if [ -z "$status_json" ] || ! grep -q '"pid"' <<<"$status_json"; then
  echo "No running editor found. Nothing to restart."
  exit 0
fi

PID=$(sed -n 's/.*"pid":[[:space:]]*\([0-9]*\).*/\1/p' <<<"$status_json" | head -1)
[ -n "$PROJECT" ] || PROJECT=$(sed -n 's/.*"project":[[:space:]]*"\([^"]*\)".*/\1/p' <<<"$status_json" | head -1)
echo "editor pid=$PID project=$PROJECT"

# Play mode holds unsaved runtime state that no save can recover.
if "$UNITY_CLI" cmd eval --code 'return UnityEditor.EditorApplication.isPlaying.ToString();' 2>/dev/null | grep -qi 'true'; then
  echo "REFUSING: editor is in play mode. Exit play mode first."
  exit 1
fi

dirty=$("$UNITY_CLI" cmd eval --code \
  'var n=0; for(int i=0;i<UnityEditor.SceneManagement.EditorSceneManager.sceneCount;i++){ if(UnityEditor.SceneManagement.EditorSceneManager.GetSceneAt(i).isDirty) n++; } return n.ToString();' \
  2>/dev/null | grep -oE '"result":"[0-9]+"' | grep -oE '[0-9]+' | head -1)
if [ -n "${dirty:-}" ] && [ "$dirty" -gt 0 ]; then
  echo "REFUSING: $dirty unsaved scene(s). Save in the editor first."
  exit 1
fi

echo "quitting gracefully..."
osascript -e 'tell application "Unity" to quit' >/dev/null 2>&1 || kill "$PID" 2>/dev/null

for _ in $(seq 1 60); do
  kill -0 "$PID" 2>/dev/null || break
  sleep 1
done

if kill -0 "$PID" 2>/dev/null; then
  # Escalate only against this one resolved pid, never a name pattern.
  echo "still alive after 60s; sending SIGTERM to pid $PID"
  kill "$PID" 2>/dev/null
  sleep 10
  kill -0 "$PID" 2>/dev/null && { echo "ERROR: pid $PID will not exit. Investigate manually."; exit 1; }
fi

echo "relaunching $PROJECT"
"$UNITY_CLI" open "$PROJECT" >/dev/null 2>&1 &

for _ in $(seq 1 120); do
  "$UNITY_CLI" status 2>/dev/null | grep -q 'ready' && { echo "editor ready"; exit 0; }
  sleep 2
done
echo "WARNING: editor did not report ready within 240s"
exit 1
