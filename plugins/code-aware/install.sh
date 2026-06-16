#!/usr/bin/env bash
# code-aware installer — wizards through the full "code-intelligence-first" setup:
#   1. system deps (ast-grep, ctx7, sem, grepai, lizard, ollama + embed model)
#   2. agentmemory memory daemon (mise-managed: npm:@agentmemory/agentmemory) + launchd autostart
#   3. Claude Code marketplaces + dependency plugins — idempotent jq merge (plugins only, no personal settings)
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

  if have grepai; then ok "grepai present ($(grepai version 2>/dev/null | head -1))"
  elif have brew; then say "brew install yoanbernabeu/tap/grepai"; run "brew install yoanbernabeu/tap/grepai" && ok "grepai installed" || err "grepai failed"
  else say "curl install grepai"; run "curl -sSL https://raw.githubusercontent.com/yoanbernabeu/grepai/main/install.sh | sh" && ok "grepai installed" || err "grepai failed"; fi

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

# ── 2. AGENTMEMORY DAEMON (mise-managed) + launchd autostart ───────────────────────────
if [ "$DO_DEPS" = 1 ] && ask "Install + autostart the agentmemory memory daemon?"; then
  say "agentmemory daemon"
  if ! have mise; then
    warn "mise not found — install mise (https://mise.jdx.dev), then re-run. Skipping agentmemory."
  else
    # mise owns the package (npm backend), so its shim floats across node versions — no version-locked path.
    say "mise use -g npm:@agentmemory/agentmemory@latest"
    run "mise use -g \"npm:@agentmemory/agentmemory@latest\"" && ok "agentmemory installed (mise-managed)" || err "mise install failed"
    [ "$DRY" = 1 ] || mise reshim >/dev/null 2>&1 || true

    shims="${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims"
    if have launchctl && { [ "$DRY" = 1 ] || [ -x "$shims/agentmemory" ]; }; then
      mise_bin="$(dirname "$(command -v mise)")"
      plist="$HOME/Library/LaunchAgents/dev.agentmemory.daemon.plist"
      mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.agentmemory"
      # Don't run `agentmemory connect` — the enabled plugin already registers this MCP server (avoids double-wiring).
      if [ "$DRY" = 1 ]; then warn "[dry-run] would write $plist (ProgramArguments=$shims/agentmemory) + launchctl load"
      else
        cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>dev.agentmemory.daemon</string>
  <key>ProgramArguments</key><array><string>$shims/agentmemory</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$shims:$mise_bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/.agentmemory/daemon.log</string>
  <key>StandardErrorPath</key><string>$HOME/.agentmemory/daemon.err</string>
</dict></plist>
PLIST
        launchctl unload "$plist" 2>/dev/null || true
        run "launchctl load \"$plist\"" && ok "autostart installed (launchd: dev.agentmemory.daemon → mise shim)"
        # iii engine is fetched on first boot, so poll livez briefly before declaring health.
        for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fsS --max-time 2 http://localhost:3111/agentmemory/livez >/dev/null 2>&1 && break; sleep 1; done
        curl -fsS --max-time 2 http://localhost:3111/agentmemory/livez >/dev/null 2>&1 \
          && ok "daemon healthy on :3111" || warn "daemon not answering yet — see $HOME/.agentmemory/daemon.err"
      fi
    elif [ -x "$shims/agentmemory" ]; then
      warn "no launchctl — start the daemon manually: 'agentmemory &' (the plugin's MCP client needs it on :3111)."
    fi
  fi
fi

# ── 3. MARKETPLACES + PLUGINS (one jq merge; plugins only, no personal settings) ───────────────────
if [ "$DO_SETTINGS" = 1 ] && ask "Register marketplaces + enable the dependency plugins in $SETTINGS?"; then
  require_jq
  say "Claude Code marketplaces + plugins (idempotent merge)"
  merge="$SCRIPT_DIR/templates/settings.merge.json"
  [ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
  backup "$SETTINGS"
  # Deep-merge writes only enabledPlugins + extraKnownMarketplaces; the user's other settings stay untouched.
  if [ "$DRY" = 1 ]; then
    printf '   [dry-run] jq -s ".[0] * .[1]" %s %s\n' "$SETTINGS" "$merge"
    jq -s '.[0] * .[1]' "$SETTINGS" "$merge" | head -40
  else
    tmp="$(mktemp)"; jq -s '.[0] * .[1]' "$SETTINGS" "$merge" > "$tmp" && mv "$tmp" "$SETTINGS" \
      && ok "plugins enabled (code-aware, lumen, agentmemory, codemode, grepai-complete) + marketplaces" \
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
