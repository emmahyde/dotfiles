#!/usr/bin/env bash
# SessionStart hook: records session_id + cwd + CMUX_* env to a registry file
# read by dock-sessions.py to enrich the panel with workspace info.
# Exits 0 always.
set -u
REG_DIR="$HOME/.claude/state/dock-sessions"
mkdir -p "$REG_DIR"
payload=$(cat 2>/dev/null || true)
[ -z "$payload" ] && exit 0
session_id=$(printf '%s' "$payload" | jq -r '.session_id // .sessionId // empty' 2>/dev/null)
[ -z "$session_id" ] && exit 0
cwd=$(printf '%s' "$payload" | jq -r '.cwd // .working_directory // empty' 2>/dev/null)
[ -z "$cwd" ] && cwd="$PWD"
now=$(date +%s)
jq -n \
  --arg sid "$session_id" \
  --arg cwd "$cwd" \
  --arg ws  "${CMUX_WORKSPACE_ID:-}" \
  --arg srf "${CMUX_SURFACE_ID:-}" \
  --arg pnl "${CMUX_PANEL_ID:-}" \
  --argjson ts "$now" \
  '{session_id:$sid, cwd:$cwd, cmux_workspace_id:$ws, cmux_surface_id:$srf, cmux_panel_id:$pnl, started_at:$ts}' \
  > "$REG_DIR/$session_id.json"
exit 0
