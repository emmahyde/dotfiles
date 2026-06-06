#!/usr/bin/env bash
# Recreate this exact Obsidian setup in a target vault.
#   ./install.sh /path/to/your/vault
#
# Plugins are (re)installed from their latest GitHub releases (see plugins.tsv),
# except folders2graph, which is vendored from a locally-patched build because
# the upstream release still crashes the graph view.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() { printf 'error: %s\n' "$1" >&2; exit 1; }

[ $# -eq 1 ] || die "usage: $0 /path/to/obsidian/vault"
VAULT="${1%/}"
[ -d "$VAULT" ] || die "vault directory not found: $VAULT"

command -v gh >/dev/null || die "gh CLI required (brew install gh; gh auth login)"
command -v jq >/dev/null || die "jq required (brew install jq)"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"

OBS="$VAULT/.obsidian"
mkdir -p "$OBS/plugins" "$OBS/themes" "$OBS/snippets"

# Optional secrets (gitignored). Injected into plugin settings below.
if [ -f "$SCRIPT_DIR/secrets.env" ]; then set -a; . "$SCRIPT_DIR/secrets.env"; set +a; fi

echo "==> config (app / appearance / graph / hotkeys / enabled-plugins / ...)"
cp "$SCRIPT_DIR"/config/*.json "$OBS"/

echo "==> themes + snippets"
cp -R "$SCRIPT_DIR/themes/."   "$OBS/themes/"
cp -R "$SCRIPT_DIR/snippets/." "$OBS/snippets/"

install_plugin() {
  local id="$1" repo="$2" dest="$OBS/plugins/$1"
  mkdir -p "$dest"
  if [ "$id" = "folders2graph" ]; then
    cp -R "$SCRIPT_DIR/vendor/folders2graph/." "$dest/"
    echo "   $id  (vendored patched build)"
    return 0
  fi
  if gh release download --repo "$repo" --pattern main.js --pattern manifest.json \
       --dir "$dest" --clobber >/dev/null 2>&1; then
    gh release download --repo "$repo" --pattern styles.css --dir "$dest" --clobber >/dev/null 2>&1 || true
    echo "   $id  <- $repo"
  else
    echo "   !! $id ($repo): no downloadable release assets — install manually" >&2
  fi
}

echo "==> plugins (latest releases)"
while IFS=$'\t' read -r id repo; do
  [ -n "${id:-}" ] || continue
  [ "$repo" = "MISSING" ] && { echo "   !! $id: not in community registry — skip" >&2; continue; }
  install_plugin "$id" "$repo"
done < "$SCRIPT_DIR/plugins.tsv"

echo "==> plugin settings (data.json)"
for d in "$SCRIPT_DIR"/plugin-data/*/data.json; do
  [ -e "$d" ] || continue
  id=$(basename "$(dirname "$d")")
  dest="$OBS/plugins/$id"
  mkdir -p "$dest"
  if [ "$id" = "eleven-labs" ] && [ -n "${ELEVEN_LABS_API_KEY:-}" ]; then
    jq --arg k "$ELEVEN_LABS_API_KEY" '.apiKey=$k' "$d" > "$dest/data.json"
    echo "   eleven-labs  (apiKey injected from secrets.env)"
  else
    cp "$d" "$dest/data.json"
  fi
done

echo
echo "Installed Obsidian config to: $OBS"
[ -n "${ELEVEN_LABS_API_KEY:-}" ] || \
  echo "note: ELEVEN_LABS_API_KEY unset — eleven-labs apiKey left blank (cp secrets.example.env secrets.env to set it)."
echo "note: Copilot API keys live in your OS keychain and are NOT captured — re-enter them in Copilot settings."
echo "Restart Obsidian (or 'Reload app without saving') to load the plugins."
