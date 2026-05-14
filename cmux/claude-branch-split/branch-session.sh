#!/usr/bin/env bash
# Fork current Claude Code session into a new cmux vertical split.
# Current pane keeps running; new split resumes a clone of the transcript so
# the two diverge from this point forward.
set -euo pipefail

if [[ -z "${CMUX_WORKSPACE_ID:-}" ]]; then
  echo "error: not running inside a cmux terminal (CMUX_WORKSPACE_ID unset)" >&2
  exit 2
fi

if ! command -v cmux >/dev/null 2>&1; then
  echo "error: cmux CLI not found on PATH" >&2
  exit 2
fi

# Locate the project transcript directory: ~/.claude/projects/<cwd with / -> ->.
cwd="$(pwd)"
slug="${cwd//\//-}"
slug="${slug//./-}"
proj_dir="$HOME/.claude/projects/${slug}"
if [[ ! -d "$proj_dir" ]]; then
  echo "error: no Claude project dir at $proj_dir" >&2
  exit 3
fi

# Current session = most recently modified jsonl in the project dir.
orig_file="$(ls -t "$proj_dir"/*.jsonl 2>/dev/null | head -n1 || true)"
if [[ -z "$orig_file" ]]; then
  echo "error: no transcript jsonl files in $proj_dir" >&2
  exit 3
fi
orig_id="$(basename "$orig_file" .jsonl)"

# New UUID for the fork.
new_id="$(uuidgen | tr 'A-Z' 'a-z')"
new_file="${proj_dir}/${new_id}.jsonl"

# Clone transcript and rewrite sessionId field on every line.
python3 - "$orig_file" "$new_file" "$orig_id" "$new_id" <<'PY'
import json, sys
src, dst, old, new = sys.argv[1:5]
with open(src) as f, open(dst, "w") as g:
    for line in f:
        line = line.rstrip("\n")
        if not line:
            g.write("\n"); continue
        try:
            d = json.loads(line)
        except Exception:
            g.write(line + "\n"); continue
        if isinstance(d, dict) and d.get("sessionId") == old:
            d["sessionId"] = new
        g.write(json.dumps(d) + "\n")
PY

# Spawn a new vertical (right) split and resume the cloned session there.
# new-pane returns the new surface ref on stdout; we feed `claude --resume` to it.
split_out="$(cmux new-pane --direction down --workspace "$CMUX_WORKSPACE_ID" --focus true)"
# Try to extract a surface ref like "surface:N" from the output; fall back to
# the workspace default (cmux send targets focused surface when omitted).
surface_ref="$(printf '%s\n' "$split_out" | grep -oE 'surface:[0-9]+' | head -n1 || true)"

cmd="claude --resume ${new_id}"
if [[ -n "$surface_ref" ]]; then
  cmux send --workspace "$CMUX_WORKSPACE_ID" --surface "$surface_ref" "$cmd"
  cmux send-key --workspace "$CMUX_WORKSPACE_ID" --surface "$surface_ref" Enter
else
  cmux send --workspace "$CMUX_WORKSPACE_ID" "$cmd"
  cmux send-key --workspace "$CMUX_WORKSPACE_ID" Enter
fi

echo "forked session ${orig_id} -> ${new_id}"
echo "new split resumes clone; this pane continues original."
