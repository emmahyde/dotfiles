#!/usr/bin/env bash
# Install the /branch slash command into ~/.claude.
# Symlinks branch.md into ~/.claude/commands and branch-session.sh
# into ~/.claude/scripts. Backs up any pre-existing files.
#
# Local:   ./install.sh
# Remote:  curl -sL https://raw.githubusercontent.com/emmahyde/dotfiles/master/cmux/claude-branch-split/install.sh | bash

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/emmahyde/dotfiles/master/cmux/claude-branch-split"
SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd 2>/dev/null || echo "")"

CMD_DIR="$HOME/.claude/commands"
SCRIPTS_DIR="$HOME/.claude/scripts"
mkdir -p "$CMD_DIR" "$SCRIPTS_DIR"

install_file() {
  local name="$1" dest="$2" mode="$3"
  local src=""

  if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/$name" ]; then
    src="$SCRIPT_DIR/$name"
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      echo "Backing up existing $dest -> ${dest}.bak"
      mv "$dest" "${dest}.bak"
    fi
    ln -sfn "$src" "$dest"
    echo "Linked $dest -> $src"
  else
    # Curl-piped install: no local file. Fetch and write contents.
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      echo "Backing up existing $dest -> ${dest}.bak"
      mv "$dest" "${dest}.bak"
    fi
    curl -sL "$REPO_RAW/$name" -o "$dest"
    chmod "$mode" "$dest"
    echo "Wrote $dest"
  fi
}

install_file "branch.md"         "$CMD_DIR/branch.md"            "0644"
install_file "branch-session.sh" "$SCRIPTS_DIR/branch-session.sh" "0755"

echo
echo "Done. Restart Claude Code, then type /branch inside a cmux pane."
