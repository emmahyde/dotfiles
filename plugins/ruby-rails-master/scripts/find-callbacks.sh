#!/usr/bin/env bash
# Surface AR callback usage in models/. Callbacks doing business logic are a
# refactoring target — extract to service objects.
#
# Usage:
#   scripts/find-callbacks.sh [path]   # default: app/models
#
# Distinguishes "probably housekeeping" (slug, normalize, set defaults, touch)
# from "probably business logic" (charge, send, notify, etc.) so the reader
# knows where to look first.

set -euo pipefail

ROOT="${1:-app/models}"

if [ ! -d "$ROOT" ]; then
  printf 'error: %s is not a directory\n' "$ROOT" >&2
  exit 1
fi

CALLBACK_PATTERN='(before|after|around)_(save|create|update|destroy|validation|commit|initialize|find|touch)\b'

# Likely housekeeping (less suspicious)
HOUSEKEEPING_PATTERN='(slug|normalize|cleanup|set_default|set_defaults|touch|cache|count|format|sanitize|normalize)'

printf '\n=== All callbacks in %s ===\n' "$ROOT"
grep -rn -E "$CALLBACK_PATTERN" "$ROOT" --include='*.rb' || true

printf '\n=== Likely BUSINESS LOGIC callbacks (review and consider extracting to services) ===\n'
grep -rn -E "$CALLBACK_PATTERN" "$ROOT" --include='*.rb' \
  | grep -vE ":\s*$HOUSEKEEPING_PATTERN" \
  | grep -vE 'before_validation\s+:?(set_|generate_|normalize_|sanitize_|format_)' \
  || printf '  (none found — looking pretty clean)\n'

printf '\n=== Hooks that mutate state (high suspicion) ===\n'
# These tend to indicate that the model is doing too much.
grep -rn -E 'after_(create|update|save|commit).+:.*(send|notify|charge|process|enqueue|deliver|publish|log|track)' \
  "$ROOT" --include='*.rb' || printf '  (none)\n'

printf '\n--- Done. Strong candidates above for `/extract-service`. ---\n'
