#!/usr/bin/env bash
# self-improve target map: resolve the durable-artifact homes for the CURRENT
# environment so the agent never re-derives paths. Terse by design.
set -euo pipefail

claude_home="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
proj_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# memory dir = ~/.claude/projects/<cwd-with-slashes-as-dashes>/memory
enc="$(printf '%s' "$proj_root" | sed 's#/#-#g')"
mem_dir="$claude_home/projects/$enc/memory"

exists() { [ -e "$1" ] && echo "ok" || echo "MISSING"; }

cat <<MAP
SELF-IMPROVE TARGET MAP  (route artifacts here; do not re-derive)
project root      : $proj_root
project CLAUDE.md : $proj_root/CLAUDE.md            [$(exists "$proj_root/CLAUDE.md")]
global  CLAUDE.md : $claude_home/CLAUDE.md          [$(exists "$claude_home/CLAUDE.md")]
project scripts/  : $proj_root/scripts             [$(exists "$proj_root/scripts")]
memory dir        : $mem_dir                        [$(exists "$mem_dir")]
memory index      : $mem_dir/MEMORY.md              [$(exists "$mem_dir/MEMORY.md")]
skills dir        : $claude_home/skills            [$(exists "$claude_home/skills")]
settings (proj)   : $proj_root/.claude/settings.json [$(exists "$proj_root/.claude/settings.json")]
settings (global) : $claude_home/settings.json      [$(exists "$claude_home/settings.json")]
delegate skills   : write-a-skill (new skill) | update-config (hook/perm/env)
MAP
