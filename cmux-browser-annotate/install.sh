#!/bin/sh
# Install cmux-browser-annotate into all active cmux browser surfaces.
# Works as a curl-pipe-sh one-liner or run locally after cloning.
#
# Remote:  curl -sL https://raw.githubusercontent.com/emmahyde/dotfiles/master/cmux-browser-annotate/install.sh | sh
# Local:   ./install.sh [surface:N]

set -e

REPO_RAW="https://raw.githubusercontent.com/emmahyde/dotfiles/master/cmux-browser-annotate"

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
  fi
}

if [ -n "$1" ]; then
  inject_surface "$1"
  echo "Done. Ctrl+D to toggle annotation mode."
  exit 0
fi

# Auto-discover all browser surfaces
count=0
surfaces=$(cmux tree --all 2>/dev/null | grep -o 'surface:[0-9]*' | sort -u)
for surf in $surfaces; do
  if cmux browser --surface "$surf" url 2>/dev/null | grep -q '.'; then
    inject_surface "$surf"
    count=$((count + 1))
  fi
done

if [ "$count" -eq 0 ]; then
  echo "No browser surfaces found. Open one with: cmux browser open <url>"
  echo "Then re-run this script."
else
  echo "Injected into $count surface(s). Ctrl+D to toggle annotation mode."
fi
