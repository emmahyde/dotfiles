#!/usr/bin/env bash
# Kills every Unity editor, import worker, and Unity MCP bridge by resolved PID.
# Unity MCP bridges are stateless and respawn with the next session; the editor is not.
set -uo pipefail

FORCE="${1:-}"
UNITY_CLI="${UNITY_CLI:-$HOME/.unity/bin/unity}"

collect() { ps -Ao pid,etime,command | grep -E "$1" | grep -v grep | awk '{print $1}'; }

EDITOR_RE='Unity\.app/Contents/MacOS/Unity'
MCP_RE='mcpforunityserver|mcp-for-unity|gamedev-mcp-server|UnityMCP'

editors=$(collect "$EDITOR_RE")
mcps=$(collect "$MCP_RE")

if [ -z "$editors$mcps" ]; then echo "Nothing to kill."; exit 0; fi

echo "=== targets ==="
for p in $editors $mcps; do
  ps -p "$p" -o pid,etime,rss,command 2>/dev/null | tail -1 | cut -c1-130
done

# An MCP bridge belonging to a live session is safe to drop; unsaved scene state is not.
if [ -n "$editors" ] && [ "$FORCE" != "--force" ]; then
  if [ -x "$UNITY_CLI" ]; then
    dirty=$("$UNITY_CLI" cmd eval --code \
      'var n=0; for(int i=0;i<UnityEditor.SceneManagement.EditorSceneManager.sceneCount;i++){ if(UnityEditor.SceneManagement.EditorSceneManager.GetSceneAt(i).isDirty) n++; } return n.ToString();' \
      --timeout 20 2>/dev/null | grep -oE '"result":"[0-9]+"' | grep -oE '[0-9]+' | head -1)
    if [ -n "${dirty:-}" ] && [ "$dirty" -gt 0 ]; then
      echo "REFUSING: $dirty unsaved scene(s). Save, or re-run with --force."
      exit 1
    fi
  else
    echo "WARNING: unity CLI absent, cannot check for unsaved scenes. Re-run with --force to proceed."
    exit 1
  fi
fi

echo
echo "=== stopping ==="
osascript -e 'tell application "Unity" to quit' >/dev/null 2>&1 || true
for p in $editors $mcps; do kill "$p" 2>/dev/null && echo "TERM $p"; done

for _ in $(seq 1 20); do
  remaining=""
  for p in $editors $mcps; do kill -0 "$p" 2>/dev/null && remaining="$remaining $p"; done
  [ -z "$remaining" ] && break
  sleep 1
done

for p in $editors $mcps; do
  if kill -0 "$p" 2>/dev/null; then kill -9 "$p" 2>/dev/null && echo "KILL $p"; fi
done

echo
echo "survivors: $(ps -Ao command | grep -E "$EDITOR_RE|$MCP_RE" | grep -vc grep)"
