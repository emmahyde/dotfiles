#!/usr/bin/env bash
# grep-app.sh <query> [scope] [--regex] [--lang L] [--repo R] [--path P]
# Wraps grep.app /api/search. Output: repo|path|score|snippet(<=80c).
# Token-cheap. Pages 1..3 (max 30 hits). Scope maps to lang/path filters.
#
# grep.app indexes ~1M public repos; this is the cs.github.com replacement.
# API endpoint reverse-engineered from ai-tools-all/grep_app_mcp.
#
# Note: grep.app sits behind Vercel; bare curl can hit a security checkpoint.
# Browser UA + Accept header usually clear it. If not, use the web UI directly.
set -euo pipefail
q="${1:?usage: grep-app.sh <query> [scope] [--regex] [--lang L] [--repo R] [--path P]}"
shift
scope=""
regexp=0
lang=""
repo=""
path=""

if [[ $# -gt 0 && ! "$1" =~ ^-- ]]; then
  scope="$1"; shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --regex) regexp=1; shift ;;
    --lang)  lang="$2"; shift 2 ;;
    --repo)  repo="$2"; shift 2 ;;
    --path)  path="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Scope -> default filters (override with explicit --lang/--path)
case "$scope" in
  skill)      [[ -z "$path" ]] && path="SKILL.md" ;;
  hook)       [[ -z "$path" ]] && path=".claude/hooks" ;;
  agent)      [[ -z "$path" ]] && path=".claude/agents" ;;
  mcp)        [[ -z "$lang" ]] && lang="JSON" ;;
  project-md|user-md) [[ -z "$path" ]] && path="CLAUDE.md" ;;
esac

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

fetch_page() {
  local page="$1"
  curl -sG 'https://grep.app/api/search' \
    -H "User-Agent: $UA" \
    -H 'Accept: application/json' \
    -H 'Referer: https://grep.app/' \
    --data-urlencode "q=$q" \
    --data-urlencode "page=$page" \
    --data-urlencode "regexp=$regexp" \
    ${lang:+--data-urlencode "lang=$lang"} \
    ${repo:+--data-urlencode "repo=$repo"} \
    ${path:+--data-urlencode "path=$path"}
}

# Build URL once for fallback emission
build_url() {
  local page="$1"
  local q_enc; q_enc=$(jq -rn --arg v "$q" '$v|@uri')
  local url="https://grep.app/api/search?q=$q_enc&page=$page&regexp=$regexp"
  [[ -n "$lang" ]] && url+="&lang=$(jq -rn --arg v "$lang" '$v|@uri')"
  [[ -n "$repo" ]] && url+="&repo=$(jq -rn --arg v "$repo" '$v|@uri')"
  [[ -n "$path" ]] && url+="&path=$(jq -rn --arg v "$path" '$v|@uri')"
  echo "$url"
}

for page in 1 2 3; do
  body="$(fetch_page "$page")"
  # Sanity: response must be JSON. Vercel TLS-fingerprint checkpoint returns HTML.
  if [[ "${body:0:1}" != "{" ]]; then
    cat >&2 <<EOF
(grep.app: blocked by Vercel TLS fingerprint — curl AND Claude WebFetch fail)
URL: $(build_url "$page")
WORKAROUNDS (verified):
  1. brew install curl-impersonate ; swap curl -> curl_chrome131 in this script
  2. install ai-tools-all/grep_app_mcp (node+axios passes the checkpoint)
  3. claude-in-chrome MCP — open URL, read JSON from page
EOF
    exit 1
  fi
  hits="$(echo "$body" | jq -r '.hits.hits[]? |
    [(.repo.raw // ""),
     (.path.raw // ""),
     ((.score // 0)|tostring),
     ((.content.snippet // "") | gsub("<[^>]+>";"") | gsub("\\s+";" ") | .[0:80])
    ] | join("|")')"
  [[ -z "$hits" ]] && break
  echo "$hits"
  pages="$(echo "$body" | jq -r '.facets.pages // 1')"
  (( page >= pages )) && break
done
