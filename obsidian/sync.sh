#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
VAULT_OBSIDIAN="$HOME/llmwiki/.obsidian"

CONFIG_FILES=(
  app.json
  appearance.json
  backlink.json
  canvas.json
  community-plugins.json
  core-plugins.json
  graph.json
  hotkeys.json
  page-preview.json
  types.json
)

SNIPPET_DIR="snippets"
THEMES_DIR="themes"

push_to_dotfiles() {
  local src="$VAULT_OBSIDIAN"
  local dst="$DOTFILES_DIR/llmwiki"

  echo "Push: vault → dotfiles"
  for f in "${CONFIG_FILES[@]}"; do
    [[ -f "$src/$f" ]] && cp "$src/$f" "$dst/$f" && echo "  $f"
  done

  if [[ -d "$src/$SNIPPET_DIR" ]]; then
    rsync -a --delete "$src/$SNIPPET_DIR/" "$dst/$SNIPPET_DIR/"
    echo "  $SNIPPET_DIR/"
  fi

  if [[ -d "$src/$THEMES_DIR" ]]; then
    rsync -a "$src/$THEMES_DIR/" "$dst/$THEMES_DIR/" \
      --include='*/' --include='manifest.json' --include='theme.css' --exclude='*'
    echo "  $THEMES_DIR/"
  fi

  echo "Done."
}

pull_to_vault() {
  local src="$DOTFILES_DIR/llmwiki"
  local dst="$VAULT_OBSIDIAN"

  echo "Pull: dotfiles → vault"
  for f in "${CONFIG_FILES[@]}"; do
    [[ -f "$src/$f" ]] && cp "$src/$f" "$dst/$f" && echo "  $f"
  done

  if [[ -d "$src/$SNIPPET_DIR" ]]; then
    rsync -a --delete "$src/$SNIPPET_DIR/" "$dst/$SNIPPET_DIR/"
    echo "  $SNIPPET_DIR/"
  fi

  if [[ -d "$src/$THEMES_DIR" ]]; then
    rsync -a --delete "$src/$THEMES_DIR/" "$dst/$THEMES_DIR/"
    echo "  $THEMES_DIR/"
  fi

  echo "Done."
}

show_diff() {
  local src="$VAULT_OBSIDIAN"
  local dst="$DOTFILES_DIR/llmwiki"
  local has_diff=false

  for f in "${CONFIG_FILES[@]}"; do
    if [[ -f "$src/$f" ]] && [[ -f "$dst/$f" ]]; then
      if ! diff -q "$src/$f" "$dst/$f" > /dev/null 2>&1; then
        echo "--- $f ---"
        diff --color=auto "$dst/$f" "$src/$f" || true
        has_diff=true
      fi
    elif [[ -f "$src/$f" ]]; then
      echo "  + $f (only in vault)"
      has_diff=true
    elif [[ -f "$dst/$f" ]]; then
      echo "  - $f (only in dotfiles)"
      has_diff=true
    fi
  done

  $has_diff || echo "No differences."
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  push    Copy vault config → dotfiles (you changed something locally)
  pull    Copy dotfiles → vault (bring vault up to date with repo)
  diff    Show differences between dotfiles and vault
  help    Show this message
EOF
}

case "${1:-}" in
  push)  push_to_dotfiles ;;
  pull)  pull_to_vault ;;
  diff)  show_diff ;;
  help)  usage ;;
  *)
    echo "Obsidian config sync (llmwiki)"
    echo ""
    echo "  1) push  — vault → dotfiles (sync local changes to repo)"
    echo "  2) pull  — dotfiles → vault (update vault from repo)"
    echo "  3) diff  — show differences"
    echo ""
    read -rp "Choose [1/2/3]: " choice
    case "$choice" in
      1|push)  push_to_dotfiles ;;
      2|pull)  pull_to_vault ;;
      3|diff)  show_diff ;;
      *)       echo "Invalid choice."; exit 1 ;;
    esac
    ;;
esac
