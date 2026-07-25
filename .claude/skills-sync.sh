#!/usr/bin/env bash
set -euo pipefail

CLAUDE_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_SKILLS="$CLAUDE_DIR/skills"
LOCAL_SKILLS="$HOME/.claude/skills"
ALLOWLIST="$CLAUDE_DIR/skills.allow"
REDACTIONS="$CLAUDE_DIR/skills.redact.pl"

# This repo is public. Anything matching these lands in a public git history.
LEAK_PATTERN='gustohq|guideline-app|\bzenpayroll\b|RETIRE-[0-9]+|\bminions?\b|\bgroot\b|/Users/[a-z.]+/'

JUNK=(node_modules dist .parcel-cache .DS_Store __pycache__ .venv)
RSYNC_EXCLUDES=(); RG_EXCLUDES=(); DIFF_EXCLUDES=()
for j in "${JUNK[@]}"; do
  RSYNC_EXCLUDES+=("--exclude=$j")
  RG_EXCLUDES+=("--glob=!**/$j/**" "--glob=!**/$j")
  DIFF_EXCLUDES+=("--exclude=$j")
done

read_allowlist() {
  [[ -f "$ALLOWLIST" ]] || { echo "Missing allowlist: $ALLOWLIST" >&2; exit 1; }
  sed 's/#.*//' "$ALLOWLIST" | tr -d ' \t' | grep -v '^$'
}

scan_leaks() {
  local target="${1:-$REPO_SKILLS}" hits
  hits=$(rg -n --pcre2 -i "$LEAK_PATTERN" "${RG_EXCLUDES[@]}" "$target" 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    echo "Internal references found — refusing to publish:"
    echo "$hits" | head -40
    return 1
  fi
  echo "Leak scan clean: $target"
}

# Copies allowlisted local skills into $1 and rewrites them through skills.redact.sed.
# Everything published goes through here, so redaction can never be skipped by accident.
stage_local() {
  local staged="$1" verbose="${2:-}" skipped=0
  while IFS= read -r name; do
    local src="$LOCAL_SKILLS/$name"
    if [[ -L "$src" ]]; then
      [[ -n "$verbose" ]] && echo "  skip $name (symlink — vendored, not ours)"
      skipped=$((skipped + 1)); continue
    fi
    if [[ ! -d "$src" ]]; then
      [[ -n "$verbose" ]] && echo "  skip $name (not found locally)"
      skipped=$((skipped + 1)); continue
    fi
    rsync -a "${RSYNC_EXCLUDES[@]}" "$src/" "$staged/$name/"
    [[ -n "$verbose" ]] && echo "  $name"
  done < <(read_allowlist)

  if [[ -f "$REDACTIONS" ]]; then
    find "$staged" -type f ! -name '*.png' ! -name '*.zip' -print0 \
      | xargs -0 -n50 perl -pi "$REDACTIONS" 2>/dev/null || true
  fi
  return 0
}

push_to_repo() {
  echo "Push: ~/.claude/skills → repo"
  local staged
  staged=$(mktemp -d)
  trap 'rm -rf "$staged"' RETURN

  stage_local "$staged" verbose

  # Scan the staging area, not the destination — a leak must never reach the worktree.
  scan_leaks "$staged" || { echo "Push aborted. Nothing was written."; return 1; }

  # No --delete: repo-only files (skillopt/assets, diagram-workshop/d2) survive a push.
  rsync -a "$staged/" "$REPO_SKILLS/"
  echo "Done."
}

pull_to_local() {
  echo "Pull: repo → ~/.claude/skills"
  while IFS= read -r name; do
    local src="$REPO_SKILLS/$name"
    [[ -d "$src" ]] || { echo "  skip $name (not in repo)"; continue; }
    if [[ -L "$LOCAL_SKILLS/$name" ]]; then
      echo "  skip $name (local is a symlink)"; continue
    fi
    rsync -a "${RSYNC_EXCLUDES[@]}" "$src/" "$LOCAL_SKILLS/$name/"
    echo "  $name"
  done < <(read_allowlist)
  echo "Done."
}

show_diff() {
  local has_diff=false staged
  staged=$(mktemp -d)
  trap 'rm -rf "$staged"' RETURN
  # Compare the redacted form, else every redacted line reads as permanent drift.
  stage_local "$staged"

  while IFS= read -r name; do
    local l="$staged/$name" r="$REPO_SKILLS/$name"
    if [[ ! -d "$l" ]]; then echo "  ? $name (local only: missing)"; has_diff=true; continue; fi
    if [[ ! -d "$r" ]]; then echo "  + $name (not yet published)"; has_diff=true; continue; fi
    if ! diff -rq "${DIFF_EXCLUDES[@]}" "$l" "$r" >/dev/null 2>&1; then
      echo "--- $name ---"
      { diff -rq "${DIFF_EXCLUDES[@]}" "$l" "$r" 2>/dev/null || true; } | sed "s|$staged|local|g; s|$HOME/|~/|g; s|^|    |" | head -10
      has_diff=true
    fi
  done < <(read_allowlist)
  $has_diff || echo "No differences."
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  push    Copy allowlisted skills ~/.claude/skills → repo (leak-scanned, never deletes)
  pull    Copy repo → ~/.claude/skills (bring local up to date)
  diff    Show which allowlisted skills differ
  scan    Leak-scan the published skills tree only
  help    Show this message

Which skills sync is defined in skills.allow, not here.
EOF
}

case "${1:-}" in
  push) push_to_repo ;;
  pull) pull_to_local ;;
  diff) show_diff ;;
  scan) scan_leaks ;;
  help) usage ;;
  *)
    echo "Claude skills sync (~/.claude/skills <-> dotfiles)"
    echo ""
    echo "  1) push  — local → repo"
    echo "  2) pull  — repo → local"
    echo "  3) diff  — show differences"
    echo ""
    read -rp "Choose [1/2/3]: " choice
    case "$choice" in
      1|push) push_to_repo ;;
      2|pull) pull_to_local ;;
      3|diff) show_diff ;;
      *) echo "Invalid choice."; exit 1 ;;
    esac
    ;;
esac
