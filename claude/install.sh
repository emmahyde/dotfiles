#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.claude"

items=(CLAUDE.md settings.json settings.local.json hooks.json skills hooks commands)

for item in "${items[@]}"; do
  src="$SCRIPT_DIR/$item"
  dest="$TARGET/$item"

  if [ ! -e "$src" ]; then
    continue
  fi

  if [ -e "$dest" ] && [ ! -L "$dest" ]; then
    echo "Backing up existing $dest -> ${dest}.bak"
    mv "$dest" "${dest}.bak"
  fi

  ln -sfn "$src" "$dest"
  echo "Linked $dest -> $src"
done

echo "Done. Restart Claude Code to pick up changes."
