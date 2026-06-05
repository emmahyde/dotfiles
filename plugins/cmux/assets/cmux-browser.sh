#!/usr/bin/env bash
# Source this file to get an auto-annotating `cmux-browser` wrapper.
# Resolves browser-annotate.js relative to this script so it works wherever
# the cmux plugin is installed.

ANNOTATE_JS="${ANNOTATE_JS:-$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)/browser-annotate.js}"

cmux-browser() {
  # Pass through to cmux browser, capture output to extract surface ID
  local output
  output=$(cmux browser "$@" 2>&1)
  local rc=$?
  echo "$output"

  if [ $rc -ne 0 ]; then return $rc; fi

  # Extract surface ID from output (e.g. "OK surface=surface:21 ...")
  local surf
  surf=$(echo "$output" | grep -o 'surface:[0-9]*' | head -1)
  if [ -z "$surf" ]; then return 0; fi

  # Inject after a short delay for the page to initialize
  if [ -f "$ANNOTATE_JS" ]; then
    local js
    js=$(cat "$ANNOTATE_JS")
    local wrapped="if(document.body){${js}}else{document.addEventListener('DOMContentLoaded',function(){${js}})}"
    (
      sleep 0.5
      cmux browser --surface "$surf" addinitscript "$wrapped" 2>/dev/null
      cmux browser --surface "$surf" eval "$js" 2>/dev/null
    ) &
  fi
}
