#!/usr/bin/env bash
# Find files that violate the Sandi Metz size rules:
#   - classes >100 LOC
#   - methods >5 LOC
#   - methods with >4 parameters
#
# Usage:
#   scripts/find-fat-files.sh [path]   # default: app/
#
# Output: a sorted report with file:line locations, sized to skim.

set -euo pipefail

ROOT="${1:-app}"

if [ ! -d "$ROOT" ]; then
  printf 'error: %s is not a directory\n' "$ROOT" >&2
  exit 1
fi

printf '\n=== Files >100 LOC (Metz Rule violation) ===\n'
find "$ROOT" -type f -name '*.rb' \
  | xargs -I{} sh -c 'lines=$(grep -cv "^\s*\(#\|$\)" "$1" || echo 0); if [ "$lines" -gt 100 ]; then printf "%5d %s\n" "$lines" "$1"; fi' _ {} \
  | sort -rn

printf '\n=== Methods >5 LOC (Metz Rule violation; rough heuristic) ===\n'
# Walk each .rb file and count lines between def...end pairs.
# This is a heuristic — it's wrong for nested defs and metaprogramming, but
# the false positives are still smells.
find "$ROOT" -type f -name '*.rb' | while read -r file; do
  awk '
    /^[[:space:]]*def / { name=$0; start=NR; depth=1; next }
    /^[[:space:]]*(class|module|do)\b/ { if (depth) depth++ }
    /^[[:space:]]*end\b/ {
      if (depth) {
        depth--
        if (depth == 0 && start) {
          if (NR - start - 1 > 5) printf "%5d %s:%d  %s\n", NR-start-1, FILENAME, start, name
          start = 0
        }
      }
    }
  ' "$file"
done | sort -rn -k1,1 | head -30

printf '\n=== Methods with >4 parameters (Metz Rule violation) ===\n'
# Find def lines with >4 commas in the parameter list.
grep -rn -E 'def [a-z_]+(!|\?)?\(([^,)]*,){4,}' "$ROOT" --include='*.rb' || true

printf '\n=== ActiveRecord callbacks (review for business logic) ===\n'
grep -rn -E '^\s*(before|after|around)_(save|create|update|destroy|validation|commit)' "$ROOT" --include='*.rb' || true

printf '\n--- Done. Use /find-smells for a graded review of these. ---\n'
