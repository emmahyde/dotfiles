#!/usr/bin/env bash
# awesome.sh <query> — search awesome.ecosyste.ms for curated lists.
# Token-shaped output: one TSV row per list — name<TAB>url<TAB>stars<TAB>desc(<=80c)
# Skips dead/stale lists (no commits in 18 months) and lists <50 stars.
set -euo pipefail
q="${1:?usage: awesome.sh <query>}"
api="https://awesome.ecosyste.ms/api/v1/lists"
curl -fsSL --get "$api" --data-urlencode "q=$q" --data "per_page=25" \
  | jq -r '
      .[] | select((.stars // 0) >= 50)
          | select(.last_synced_at != null)
          | [.name, .url, (.stars|tostring),
             ((.description // "") | gsub("\\s+"; " ") | .[0:80])]
          | @tsv'
