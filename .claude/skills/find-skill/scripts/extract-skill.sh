#!/usr/bin/env bash
# extract-skill.sh <raw-or-blob-url> — token-cheap structural digest.
# Pulls frontmatter (description/triggers/argument-hint) + H2/H3 headers
# + code-fence count. Skips body prose. Useful for hybridization Step 6.1.
set -euo pipefail
url="${1:?usage: extract-skill.sh <SKILL.md raw url>}"
raw="${url/github.com/raw.githubusercontent.com}"
raw="${raw/\/blob\//\/}"
body="$(curl -fsSL --max-time 10 "$raw")" || { echo "FETCH-FAIL: $url"; exit 1; }

# frontmatter
echo "## frontmatter"
printf '%s\n' "$body" | awk '/^---$/{c++; next} c==1{print} c>=2{exit}'

# headers
echo
echo "## headers"
printf '%s\n' "$body" | grep -E '^#{2,3} ' | head -20

# code fence count + wc
fences=$(printf '%s\n' "$body" | grep -c '^```' || true)
lines=$(printf '%s\n' "$body" | wc -l | tr -d ' ')
echo
echo "## stats: lines=$lines fences=$((fences/2))"
