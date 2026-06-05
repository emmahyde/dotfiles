#!/usr/bin/env bash
# Install cmux-browser-annotate into all active cmux browser surfaces.
# Works as a curl-pipe-sh one-liner or run locally after cloning.
#
# Remote:  curl -sL https://raw.githubusercontent.com/emmahyde/dotfiles/main/plugins/cmux/assets/enable-browser-annotation.sh | sh
# Local:   ./enable-browser-annotation.sh [surface:N]

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/emmahyde/dotfiles/main/plugins/cmux/assets"

# Validate surface arg if provided (expected form: surface:N)
if [ -n "${1:-}" ] && ! printf '%s' "$1" | grep -qE '^surface:[0-9]+$'; then
  echo "error: '$1' is not a valid surface ref (expected surface:N)" >&2
  exit 1
fi

# Fetch the JS — prefer local file, fall back to GitHub
SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd 2>/dev/null || echo "")"
if [ -f "$SCRIPT_DIR/browser-annotate.js" ]; then
  JS_CONTENT="$(cat "$SCRIPT_DIR/browser-annotate.js")"
else
  JS_CONTENT="$(curl -sL "$REPO_RAW/browser-annotate.js")"
fi

if [ -z "$JS_CONTENT" ]; then
  echo "Error: could not load browser-annotate.js" >&2
  exit 1
fi

WRAPPED="if(document.body){${JS_CONTENT}}else{document.addEventListener('DOMContentLoaded',function(){${JS_CONTENT}})}"

inject_surface() {
  local surf="$1"
  if cmux browser --surface "$surf" addinitscript "$WRAPPED" 2>/dev/null && \
     cmux browser --surface "$surf" eval "$JS_CONTENT" 2>/dev/null; then
    echo "  Injected into $surf"
    return 0
  else
    echo "  Failed to inject into $surf" >&2
    return 1
  fi
}

if [ -n "${1:-}" ]; then
  inject_surface "$1"
  echo "Done. Ctrl+D to toggle annotation mode."
  exit 0
fi

# Auto-discover all browser surfaces and inject in parallel.
# inject_surface is idempotent — it just fails on non-browser surfaces, which
# is cheaper than gating on a serial `cmux browser url` round-trip per surface.
surfaces=$(cmux tree --all 2>/dev/null | grep -o 'surface:[0-9]*' | sort -u || true)
results_dir="$(mktemp -d)"
trap 'rm -rf "$results_dir"' EXIT
for surf in $surfaces; do
  ( inject_surface "$surf" && echo ok > "$results_dir/$surf" ) &
done
wait
count=$(find "$results_dir" -type f | wc -l | tr -d ' ')

if [ "$count" -eq 0 ]; then
  echo "No browser surfaces found. Open one with: cmux browser open <url>"
  echo "Then re-run this script."
else
  echo "Injected into $count surface(s). Ctrl+D to toggle annotation mode."
fi
