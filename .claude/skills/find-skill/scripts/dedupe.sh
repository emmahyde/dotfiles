#!/usr/bin/env bash
# dedupe.sh — stdin pipe-delimited rows in, dedupe by first field (name/url),
# keep highest-stars row when fields look like name|stars|...
# Usage: cat hits.txt | dedupe.sh
set -euo pipefail
awk -F'|' '
  { key=$1; stars=($2+0)
    if (!(key in best) || stars > bestStars[key]) { best[key]=$0; bestStars[key]=stars }
  }
  END { for (k in best) print best[k] }
' | sort -t'|' -k2 -nr
