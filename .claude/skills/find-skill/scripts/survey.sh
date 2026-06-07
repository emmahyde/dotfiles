#!/usr/bin/env bash
# survey.sh <topic> <scope> — one-shot fan-out: awesome + gh + reddit, deduped.
# Token-cheap orchestrator. Output: section per source, all <120 chars/line.
# Use as the first cheap pass before sending haiku agents at the survivors.
set -euo pipefail
topic="${1:?usage: survey.sh <topic> <scope>}"
scope="${2:-skill}"
here="$(cd "$(dirname "$0")" && pwd)"

echo "# survey: $topic | scope=$scope"
echo
echo "## awesome lists"
"$here/awesome.sh" "$topic" 2>/dev/null | head -10 || echo "(awesome.ecosyste.ms unreachable)"
echo
echo "## github repos"
"$here/gh-search.sh" "$topic" "$scope" 2>/dev/null | head -15 || echo "(gh search failed)"
echo
echo "## reddit threads"
"$here/reddit.sh" "$topic" 2>/dev/null | head -8 || echo "(reddit unreachable)"
echo
echo "## grep.app code hits"
"$here/grep-app.sh" "$topic" "$scope" 2>/dev/null | head -10 || echo "(grep.app unreachable / blocked)"
