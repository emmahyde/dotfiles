#!/usr/bin/env bash
# ============================================================================
# Wizard installer for the llmwiki session-watcher (macOS / launchd).
#
#   ./install.sh [/path/to/your/llmwiki-vault]      (default: ~/llmwiki)
#
# What it does, in order:
#   1. Verifies prerequisites and that the target is a real llmwiki vault.
#   2. Stages the watcher + summarizer prompt into <vault>/scripts/.
#   3. Generates a launchd plist from the template (absolute paths, your env).
#   4. Keeps the ledger + logs out of the vault's git history.
#   5. Initialises the ledger (a no-op first run that stamps baseline = now).
#   6. Runs a DRY detection test (writes nothing, dispatches nothing).
#
# What it intentionally does NOT do: load the launchd agent. Going live is a
# manual step you take after reviewing the dry run -- see the printed
# next-steps and README.md ("Go live"). This preserves the test-before-launchd
# discipline: never let an autonomous, token-spending agent loose untested.
# ============================================================================
set -euo pipefail

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
note() { printf '==> %s\n' "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- arg: vault path -------------------------------------------------------
VAULT="${1:-$HOME/llmwiki}"
VAULT="${VAULT%/}"                       # strip any trailing slash
[ -n "$VAULT" ] || die "usage: ./install.sh /path/to/your/llmwiki-vault"

# ---- platform + tool prerequisites -----------------------------------------
[ "$(uname -s)" = "Darwin" ] || die "this installer targets macOS/launchd; see README.md for a Linux/systemd port"
command -v jq >/dev/null 2>&1      || die "jq not found (brew install jq)"
command -v uuidgen >/dev/null 2>&1 || die "uuidgen not found (it ships with macOS; check your PATH)"
command -v plutil >/dev/null 2>&1  || die "plutil not found (it ships with macOS; check your PATH)"

CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
if [ ! -x "$CLAUDE_BIN" ]; then
  if command -v claude >/dev/null 2>&1; then
    CLAUDE_BIN="$(command -v claude)"
  else
    die "claude CLI not found; install it or run with CLAUDE_BIN=/path/to/claude ./install.sh ..."
  fi
fi

# ---- the vault must already be an llmwiki-pattern vault (step 0) ------------
# The summarizer hard-assumes this layout. Dropped on a bare vault, every
# dispatch writes into a structure that is not there. Scaffold first (/wiki).
[ -d "$VAULT" ]                || die "vault directory does not exist: $VAULT"
[ -f "$VAULT/CLAUDE.md" ]      || die "$VAULT/CLAUDE.md missing -- not an llmwiki vault. Scaffold it first (run /wiki), then re-run."
[ -f "$VAULT/wiki/index.md" ]  || die "$VAULT/wiki/index.md missing -- scaffold the vault first (run /wiki), then re-run."

# ---- tuning (env-overridable; baked into the generated plist) ---------------
MODEL="${WATCHER_MODEL:-haiku}"
IDLE_SECONDS="${IDLE_SECONDS:-3600}"
INTERVAL="${START_INTERVAL:-1200}"
LABEL="${LAUNCHD_LABEL:-com.$(id -un).llmwiki-session-watcher}"

# Homebrew prefix differs by arch; the bundled script also re-exports its own
# PATH internally (with /opt/homebrew). On Intel see the README PATH note.
BREW_BIN="/opt/homebrew/bin"
if [ ! -d "$BREW_BIN" ]; then
  BREW_BIN="/usr/local/bin"
  note "NOTE: Intel/non-/opt/homebrew Mac detected. The bundled session-watcher.sh"
  printf '    hardcodes /opt/homebrew in its internal PATH; if jq is in /usr/local/bin\n'
  printf '    add it there (one line) -- see README.md "Troubleshooting > PATH".\n'
fi
PATH_ENV="$HOME/.local/bin:$BREW_BIN:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPTS_DIR="$VAULT/scripts"
LEDGER="$VAULT/wiki/.session-ledger.json"
WATCHER="$SCRIPTS_DIR/session-watcher.sh"

# ---- 2. stage watcher + prompt --------------------------------------------
note "staging watcher into $SCRIPTS_DIR"
mkdir -p "$SCRIPTS_DIR"
cp "$SCRIPT_DIR/session-watcher.sh" "$WATCHER"
chmod +x "$WATCHER"
# Substitute the vault path into the prompt's __WIKI_DIR__ tokens.
sed "s|__WIKI_DIR__|$VAULT|g" "$SCRIPT_DIR/session-summarizer-prompt.md" \
  > "$SCRIPTS_DIR/session-summarizer-prompt.md"

# ---- 3. generate launchd plist from template ------------------------------
note "generating launchd plist"
PLIST_OUT="$SCRIPTS_DIR/$LABEL.plist"
sed -e "s|__LABEL__|$LABEL|g" \
    -e "s|__SCRIPT__|$WATCHER|g" \
    -e "s|__PATH__|$PATH_ENV|g" \
    -e "s|__WIKI_DIR__|$VAULT|g" \
    -e "s|__CLAUDE_BIN__|$CLAUDE_BIN|g" \
    -e "s|__MODEL__|$MODEL|g" \
    -e "s|__IDLE_SECONDS__|$IDLE_SECONDS|g" \
    -e "s|__INTERVAL__|$INTERVAL|g" \
    -e "s|__STDOUT__|$SCRIPTS_DIR/launchd.out.log|g" \
    -e "s|__STDERR__|$SCRIPTS_DIR/launchd.err.log|g" \
    "$SCRIPT_DIR/com.llmwiki-session-watcher.plist.template" > "$PLIST_OUT"
plutil -lint "$PLIST_OUT" >/dev/null || die "generated plist failed plutil -lint: $PLIST_OUT"

# ---- 4. keep ledger + logs out of git -------------------------------------
# wiki/ is typically its own nested repo; the ledger lives there, the logs live
# under scripts/ (vault-root repo). Ignore both so an auto-committer cannot
# version per-tick state or logs.
note "ensuring git ignores ledger + logs"
ensure_ignored() {  # $1=gitignore-file  $2..=patterns
  local gi="$1"; shift
  mkdir -p "$(dirname "$gi")"
  local pat
  for pat in "$@"; do
    grep -qxF "$pat" "$gi" 2>/dev/null || printf '%s\n' "$pat" >> "$gi"
  done
}
ensure_ignored "$VAULT/wiki/.gitignore" ".session-ledger.json" ".session-ledger.json.corrupt"
ensure_ignored "$VAULT/.gitignore" \
  "scripts/session-watcher.log" "scripts/launchd.out.log" "scripts/launchd.err.log" \
  "scripts/$LABEL.plist"

# ---- 5. initialise the ledger (no-op first run; stamps baseline = now) -----
note "initialising ledger (first run is a no-op that stamps baseline = now)"
WIKI_DIR="$VAULT" CLAUDE_BIN="$CLAUDE_BIN" "$WATCHER" || die "ledger init run failed; check $SCRIPTS_DIR/session-watcher.log"

if [ ! -f "$LEDGER" ]; then
  note "no ledger yet -- this usually means ~/.claude/history.jsonl does not exist."
  printf '    You have not produced any interactive Claude Code history on this machine yet.\n'
  printf '    The ledger will be created on the first real run once you have. Skipping dry test.\n'
else
  jq -e . "$LEDGER" >/dev/null || die "ledger is not valid JSON: $LEDGER"
  note "ledger OK (baseline_ms=$(jq -r '.baseline_ms' "$LEDGER"))"

  # ---- 6. DRY detection test (writes nothing, dispatches nothing) ----------
  note "dry detection test (rolls baseline to 0, detects, restores baseline)"
  saved_baseline="$(jq -r '.baseline_ms' "$LEDGER")"
  tmp="$(mktemp)"; jq '.baseline_ms = 0' "$LEDGER" > "$tmp" && mv "$tmp" "$LEDGER"
  WIKI_DIR="$VAULT" CLAUDE_BIN="$CLAUDE_BIN" DRY_RUN=1 MAX_PER_RUN=12 "$WATCHER" || true
  tmp="$(mktemp)"; jq --argjson b "$saved_baseline" '.baseline_ms = $b' "$LEDGER" > "$tmp" && mv "$tmp" "$LEDGER"
  printf '    detected candidates (from the log):\n'
  grep 'DRY would-dispatch\|found .* candidate' "$SCRIPTS_DIR/session-watcher.log" | tail -8 \
    || printf '    (none yet -- expected on a fresh machine with little idle history)\n'
fi

# ---- next steps (manual, on purpose) --------------------------------------
cat <<EOF

------------------------------------------------------------------------------
Staged successfully -- but NOT yet live. The launchd agent is intentionally
not loaded. Review the dry-run output above, optionally do one real dispatch
(README.md > "Manual test: one real dispatch"), then go live yourself:

    cp "$PLIST_OUT" ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/$LABEL.plist
    launchctl list | grep llmwiki        # confirm it is registered

To uninstall later:

    launchctl unload ~/Library/LaunchAgents/$LABEL.plist
    rm ~/Library/LaunchAgents/$LABEL.plist

Logs:   $SCRIPTS_DIR/session-watcher.log   (check here first on any issue)
Ledger: $LEDGER
------------------------------------------------------------------------------
EOF
