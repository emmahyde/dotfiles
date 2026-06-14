#!/usr/bin/env bash
# code-aware installer — wizards through the full "code-intelligence-first" setup:
#   1. system deps (ast-grep, ctx7, sem, lizard, ollama + embed model; grepai optional)
#   2. Claude Code marketplaces + dependency plugins (lumen, agentmemory, codemode, code-aware)
#   3. ~/.claude/settings.json (env, model, theme, statusline, ...) — idempotent jq merge
#   4. ~/.claude/CLAUDE.md behavioral + investigation rules + auto-detected environment block
#   5. optional firecrawl MCP (prompts for the API key; never hardcoded)
#
# Safe to re-run: every step is idempotent and backs up before writing.
# Flags: -y/--yes (assume yes), --no-deps, --no-settings, --no-claudemd, --dry-run
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
CLAUDEMD="$CLAUDE_DIR/CLAUDE.md"
STAMP="$(date +%Y%m%d-%H%M%S)"
EMBED_MODEL="nomic-embed-text"

ASSUME_YES=0; DO_DEPS=1; DO_SETTINGS=1; DO_CLAUDEMD=1; DRY=0
for a in "$@"; do case "$a" in
  -y|--yes) ASSUME_YES=1;; --no-deps) DO_DEPS=0;; --no-settings) DO_SETTINGS=0;;
  --no-claudemd) DO_CLAUDEMD=0;; --dry-run) DRY=1;;
  -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
esac; done

c() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
say()  { printf '%s\n' "$(c '1;36' "▸ $*")"; }
ok()   { printf '%s\n' "$(c '1;32' "  ✓ $*")"; }
warn() { printf '%s\n' "$(c '1;33' "  ! $*")"; }
err()  { printf '%s\n' "$(c '1;31' "  ✗ $*")" >&2; }
run()  { if [ "$DRY" = 1 ]; then printf '   [dry-run] %s\n' "$*"; else eval "$@"; fi; }
ask()  { # ask "Question?" -> returns 0 for yes
  [ "$ASSUME_YES" = 1 ] && return 0
  printf '%s ' "$(c '1;35' "? $1 [Y/n]")"; read -r r </dev/tty || return 0
  case "$r" in n|N|no|NO) return 1;; *) return 0;; esac
}
have() { command -v "$1" >/dev/null 2>&1; }
backup() { [ -f "$1" ] && { cp "$1" "$1.bak.$STAMP"; ok "backed up $(basename "$1") → $(basename "$1").bak.$STAMP"; }; }

require_jq() { have jq || { err "jq is required (settings/CLAUDE.md merge). Install jq, then re-run."; exit 1; }; }

printf '%s\n\n' "$(c '1;37' "code-aware installer — code-intelligence-first Claude Code setup")"
mkdir -p "$CLAUDE_DIR"

# ── 1. SYSTEM DEPS ────────────────────────────────────────────────────────────
if [ "$DO_DEPS" = 1 ] && ask "Install / verify the code-intelligence CLI stack?"; then
  say "System dependencies"
  if have brew; then
    for f in ast-grep ctx7 sem-cli; do
      bin="${f%-cli}"
      if have "$bin"; then ok "$bin present ($("$bin" --version 2>/dev/null | head -1))"
      else say "brew install $f"; run "brew install $f" && ok "$f installed" || err "$f failed"; fi
    done
  else
    warn "Homebrew not found. Install these manually:"
    warn "  ast-grep → 'cargo install ast-grep' or 'npm i -g @ast-grep/cli'"
    warn "  ctx7     → see https://context7.com  (or 'ctx7 setup')"
    warn "  sem      → the 'sem-cli' formula, or your platform's package"
  fi

  # lizard: python, runs via uvx — no install, just verify the runner exists.
  if have lizard; then ok "lizard present"
  elif have uvx; then ok "lizard available via 'uvx lizard' (no install needed)"
  else warn "Neither 'lizard' nor 'uvx' found — install uv (https://docs.astral.sh/uv) to use lizard."; fi

  # grepai: static binary, no verified package manager — detect only, never guess an installer.
  if have grepai; then ok "grepai present"
  else warn "grepai not found (optional — lumen covers semantic search). To add call-graph tracing, install grepai per the 'grepai-installation' skill / https://grepai.dev, then 'grepai init && grepai watch'."; fi

  # ollama + embed model (powers lumen / grepai local embeddings)
  if have ollama; then ok "ollama present"
  elif ask "  Install Ollama (official script: curl -fsSL https://ollama.com/install.sh | sh)?"; then
    run "curl -fsSL https://ollama.com/install.sh | sh" && ok "ollama installed" || err "ollama install failed"
  else warn "Skipped Ollama — lumen/grepai semantic search needs a local embed backend."; fi

  if have ollama; then
    if ollama list 2>/dev/null | grep -q "$EMBED_MODEL"; then ok "embed model '$EMBED_MODEL' present"
    elif ask "  Pull embed model '$EMBED_MODEL'?"; then
      run "ollama pull $EMBED_MODEL" && ok "pulled $EMBED_MODEL" || err "pull failed"
    fi
  fi
fi

# ── 2 & 3. MARKETPLACES + PLUGINS + SETTINGS (one jq merge) ───────────────────
if [ "$DO_SETTINGS" = 1 ] && ask "Merge marketplaces, plugins, and settings into $SETTINGS?"; then
  require_jq
  say "Claude Code settings (idempotent merge)"
  merge="$SCRIPT_DIR/templates/settings.merge.json"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
  backup "$SETTINGS"
  # Recursive object merge: nested objects (env, enabledPlugins, extraKnownMarketplaces)
  # merge by key; scalars from the template win. Existing unrelated keys are preserved.
  if [ "$DRY" = 1 ]; then
    printf '   [dry-run] jq -s ".[0] * .[1]" %s %s\n' "$SETTINGS" "$merge"
    jq -s '.[0] * .[1]' "$SETTINGS" "$merge" | head -40
  else
    tmp="$(mktemp)"; jq -s '.[0] * .[1]' "$SETTINGS" "$merge" > "$tmp" && mv "$tmp" "$SETTINGS" \
      && ok "settings merged (marketplaces + plugins: code-aware, lumen, agentmemory, codemode)" \
      || err "settings merge failed (original restored from .bak)"
  fi
  warn "Claude Code resolves new marketplaces & installs enabled plugins on next launch."
fi

# ── 4. CLAUDE.md RULES + ENVIRONMENT ──────────────────────────────────────────
if [ "$DO_CLAUDEMD" = 1 ] && ask "Inject behavioral + investigation rules into $CLAUDEMD?"; then
  say "Global CLAUDE.md"
  BEGIN="<!-- >>> code-aware managed (regenerated by install.sh; edits inside are overwritten) >>> -->"
  END="<!-- <<< code-aware managed <<< -->"
  block="$(cat "$SCRIPT_DIR/templates/claude-md-block.md")"
  envblock="$(bash "$SCRIPT_DIR/scripts/detect-env.sh" 2>/dev/null || echo '')"
  managed=$(printf '%s\n%s\n\n%s\n%s\n' "$BEGIN" "$block" "$envblock" "$END")

  [ -f "$CLAUDEMD" ] || : > "$CLAUDEMD"
  backup "$CLAUDEMD"
  if [ "$DRY" = 1 ]; then
    printf '   [dry-run] would write managed block (%s lines)\n' "$(printf '%s' "$managed" | wc -l)"
  elif grep -qF "$BEGIN" "$CLAUDEMD"; then
    # Replace existing managed region in place (awk, marker-delimited).
    tmp="$(mktemp)"
    BEGIN="$BEGIN" END="$END" MANAGED="$managed" awk '
      $0==ENVIRON["BEGIN"]{print ENVIRON["MANAGED"]; skip=1; next}
      $0==ENVIRON["END"]{skip=0; next}
      !skip{print}
    ' "$CLAUDEMD" > "$tmp" && mv "$tmp" "$CLAUDEMD" && ok "refreshed managed block"
  else
    # Prepend (rules belong at the top), keep any existing content below.
    tmp="$(mktemp)"; { printf '%s\n\n' "$managed"; cat "$CLAUDEMD"; } > "$tmp" && mv "$tmp" "$CLAUDEMD" \
      && ok "inserted managed block at top of CLAUDE.md"
  fi
fi

# ── 5. grepai per-repo integration (verified commands) ───────────────────────
if have grepai && git rev-parse --is-inside-work-tree >/dev/null 2>&1 \
   && ask "Set up grepai in the current repo (init + agent-setup)?"; then
  say "grepai integration ($(pwd))"
  if [ -d .grepai ]; then ok ".grepai/ already present — skipping init"
  else run "grepai init --provider ollama --model $EMBED_MODEL --yes" && ok "grepai initialized"; fi
  run "grepai agent-setup" && ok "appended grepai usage to repo CLAUDE.md/AGENTS.md (idempotent)"
  if ask "  Also create the Claude Code deep-explore subagent (.claude/agents/deep-explore.md)?"; then
    run "grepai agent-setup --with-subagent" && ok "deep-explore subagent created"
  fi
  warn "Start the live index any time with: grepai watch"
fi

# ── 6. OPTIONAL: firecrawl MCP ────────────────────────────────────────────────
if ask "Configure the firecrawl MCP server (web scraping)? (needs an API key)"; then
  require_jq
  printf '%s ' "$(c '1;35' "  Paste FIRECRAWL_API_KEY (blank to skip):")"
  read -r FCKEY </dev/tty || FCKEY=""
  if [ -n "$FCKEY" ]; then
    MCP="$CLAUDE_DIR/.mcp.json"; [ -f "$MCP" ] || echo '{"mcpServers":{}}' > "$MCP"; backup "$MCP"
    add="$(jq -n --arg k "$FCKEY" '{mcpServers:{firecrawl:{command:"npx",args:["-y","firecrawl-mcp"],env:{FIRECRAWL_API_KEY:$k}}}}')"
    if [ "$DRY" = 1 ]; then warn "[dry-run] would merge firecrawl into $MCP";
    else tmp="$(mktemp)"; jq -s '.[0] * .[1]' "$MCP" <(printf '%s' "$add") > "$tmp" && mv "$tmp" "$MCP" && ok "firecrawl MCP configured"; fi
  else warn "Skipped firecrawl (no key)."; fi
fi

# Silence the /wizard SessionStart nudge — setup has run at least once.
[ "$DRY" = 1 ] || touch "$CLAUDE_DIR/.code-aware-configured" 2>/dev/null || true

printf '\n%s\n' "$(c '1;32' "Done.")"
printf '%s\n' "Restart Claude Code so it picks up new marketplaces, plugins, settings, and CLAUDE.md."
printf '%s\n' "Verify the stack inside a repo:  lumen index_status · sem --version · ast-grep --version · uvx lizard --version · ctx7 --version"
