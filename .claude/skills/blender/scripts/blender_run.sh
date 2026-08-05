#!/usr/bin/env bash
# Headless Blender runner. Drives a bpy Python script with no GUI, clean startup.
#
# Usage:
#   blender_run.sh <script.py> [-- ARG ...]
#   blender_run.sh export_glb.py -- --in model.fbx --out model.glb
#
# Everything after the literal `--` is forwarded to the Python script and is
# readable there via scripts/lib.py:get_args(). Stdout/stderr from Blender is
# noisy; this wrapper leaves it intact so failures are visible (check the logs
# first when something breaks).
set -euo pipefail

BLENDER_BIN="${BLENDER_BIN:-$HOME/.local/bin/blender}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "usage: blender_run.sh <script.py> [-- ARG ...]" >&2
  exit 2
fi

PY="$1"; shift
# Resolve a bare script name against this skill's scripts/ dir.
if [[ ! -f "$PY" && -f "$SCRIPT_DIR/$PY" ]]; then
  PY="$SCRIPT_DIR/$PY"
fi

# `--factory-startup` ignores user prefs/addons for reproducibility.
# `--enable-autoexec` lets driver expressions in imported files evaluate.
# Blender's bundled Python runs isolated and ignores PYTHONPATH, so we prepend
# the scripts dir to sys.path via a --python-expr that runs before the script
# (Blender executes multiple --python* flags in command-line order).
exec "$BLENDER_BIN" --background --factory-startup --enable-autoexec \
  --python-expr "import sys; sys.path.insert(0, r'$SCRIPT_DIR')" \
  --python "$PY" "$@"
