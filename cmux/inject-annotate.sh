#!/bin/sh
# Inject the browser annotation overlay into cmux browser surfaces.
# Usage:
#   inject-annotate.sh              # inject into ALL browser surfaces
#   inject-annotate.sh surface:3    # inject into a specific surface
#
# Registers an init script so the overlay persists across navigations,
# and injects immediately into the current page.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANNOTATE_JS="$SCRIPT_DIR/browser-annotate.js"

if [ ! -f "$ANNOTATE_JS" ]; then
  echo "Error: browser-annotate.js not found at $ANNOTATE_JS" >&2
  exit 1
fi

JS_CONTENT="$(cat "$ANNOTATE_JS")"
WRAPPED="if(document.body){${JS_CONTENT}}else{document.addEventListener('DOMContentLoaded',function(){${JS_CONTENT}})}"

inject_surface() {
  local surf="$1"
  cmux browser --surface "$surf" addinitscript "$WRAPPED" 2>/dev/null && \
  cmux browser --surface "$surf" eval "$JS_CONTENT" 2>/dev/null && \
  echo "  Injected into $surf" || \
  echo "  Skipped $surf (not a browser)"
}

if [ -n "$1" ]; then
  inject_surface "$1"
else
  # Find all browser surfaces across all workspaces
  surfaces=$(cmux tree --all 2>/dev/null | grep -o 'surface:[0-9]*' | sort -u)
  if [ -z "$surfaces" ]; then
    echo "No surfaces found. Open a browser with: cmux browser open <url>"
    exit 1
  fi
  count=0
  for surf in $surfaces; do
    # Only inject into browser surfaces (eval will fail on terminals)
    if cmux browser --surface "$surf" url 2>/dev/null | grep -q '.' ; then
      inject_surface "$surf"
      count=$((count + 1))
    fi
  done
  if [ "$count" -eq 0 ]; then
    echo "No browser surfaces found. Open one with: cmux browser open <url>"
  else
    echo "Done. Ctrl+D to toggle annotation mode."
  fi
fi
