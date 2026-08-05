#!/usr/bin/env bash
# guardrails-kit installer — idempotently deploys the guardrails discipline kit
# into your Claude Code config directory.
#
# Safe to re-run: every step is idempotent, backs up before writing, and
# preserves user content between the kit markers in CLAUDE.md.
#
# Flags:
#   -y, --yes        Skip prompts (assume yes to deploy)
#   --dry-run        Print actions, write nothing
#   --no-settings    Skip settings.json hook registration
#   -h, --help       Show this help
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
STAMP="$(date +%Y%m%d-%H%M%S)-$$"

# ── Flags ──
ASSUME_YES=0
DRY_RUN=0
NO_SETTINGS=0
for a in "$@"; do
  case "$a" in
    -y|--yes) ASSUME_YES=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --no-settings) NO_SETTINGS=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  esac
done

# ── Helpers ──
c()   { printf '\033[%sm%s\033[0m' "$1" "$2"; }
say() { printf '%s\n' "$(c '1;36' "▸ $*")"; }
ok()  { printf '%s\n' "$(c '1;32' "  ✓ $*")"; }
warn(){ printf '%s\n' "$(c '1;33' "  ! $*")"; }
err() { printf '%s\n' "$(c '1;31' "  ✗ $*")" >&2; }
ask() {
  [ "$ASSUME_YES" = 1 ] && return 0
  printf '%s ' "$(c '1;35' "? $1 [Y/n]")"; read -r r </dev/tty || return 0
  case "$r" in n|N|no|NO) return 1 ;; *) return 0 ;; esac
}
have() { command -v "$1" >/dev/null 2>&1; }

run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '   [dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

backup_file() {
  [ -f "$1" ] || return 0
  run cp "$1" "$1.bak.$STAMP"
  ok "backed up $(basename "$1") → $(basename "$1").bak.$STAMP"
}

backup_dir() {
  [ -d "$1" ] || return 0
  run cp -R "$1" "$1.bak.$STAMP"
  ok "backed up $(basename "$1")/ → $(basename "$1").bak.$STAMP"
}

# ── Python block splicer ──
# Replaces or inserts a kit block in CLAUDE.md using literal str.index (NOT regex).
# Args: template_file target_file begin_marker end_marker mode [claude_dir]
# Mode: create (no target file yet), replace (marker span → template), prepend, append
splice_block() {
  local template_file="$1" target_file="$2" begin_marker="$3" end_marker="$4" mode="$5" claude_dir="${6:-}"
  python3 - "$template_file" "$target_file" "$begin_marker" "$end_marker" "$mode" "$claude_dir" << 'PYEOF'
import sys, os, tempfile, shutil

template_file = sys.argv[1]
target_file  = sys.argv[2]
begin_marker = sys.argv[3]
end_marker   = sys.argv[4]
mode         = sys.argv[5]
claude_dir   = sys.argv[6] if len(sys.argv) > 6 else ""

with open(template_file) as f:
    template = f.read()
if claude_dir:
    template = template.replace("{{CLAUDE_DIR}}", claude_dir)

if mode == "create":
    os.makedirs(os.path.dirname(os.path.abspath(target_file)), exist_ok=True)
    result = template.rstrip("\n") + "\n"

elif mode == "replace":
    # Strip any preamble before the BEGIN marker in the template.
    # This prevents duplication when the target file already has kit-version
    # comment lines sitting outside the marker span.
    tmpl_begin = template.find(begin_marker)
    if tmpl_begin != -1:
        tmpl_line_start = template.rfind("\n", 0, tmpl_begin)
        tmpl_line_start = 0 if tmpl_line_start == -1 else tmpl_line_start + 1
        if tmpl_line_start > 0:
            template = template[tmpl_line_start:]

    with open(target_file) as f:
        content = f.read()
    begin_idx = content.index(begin_marker)
    # Start of the line containing the begin marker
    line_start = content.rfind("\n", 0, begin_idx)
    line_start = 0 if line_start == -1 else line_start + 1
    end_idx = content.index(end_marker, begin_idx)
    # End of the line containing the end marker
    end_marker_end = end_idx + len(end_marker)
    line_end = content.find("\n", end_marker_end)
    line_end = len(content) if line_end == -1 else line_end + 1
    before = content[:line_start]
    after  = content[line_end:]
    if not template.endswith("\n"):
        template += "\n"
    result = before + template + after

elif mode == "prepend":
    with open(target_file) as f:
        content = f.read()
    if not template.endswith("\n"):
        template += "\n"
    result = template + content

elif mode == "append":
    with open(target_file) as f:
        content = f.read()
    if content and not content.endswith("\n"):
        content += "\n"
    if content and not content.endswith("\n\n"):
        content += "\n"
    if not template.endswith("\n"):
        template += "\n"
    result = content + template

else:
    sys.exit(1)

# Atomic write via tempfile + rename
target_dir = os.path.dirname(os.path.abspath(target_file))
os.makedirs(target_dir, exist_ok=True)
fd, tmpname = tempfile.mkstemp(dir=target_dir, suffix=".tmp")
with os.fdopen(fd, "w") as f:
    f.write(result)
shutil.move(tmpname, target_file)
PYEOF
}

# Marker strings
CORE_BEGIN="<!-- BEGIN KIT CORE v1.3 -->"
CORE_END="<!-- END KIT CORE -->"
FOOTER_BEGIN="<!-- BEGIN KIT FOOTER v1.3 -->"
FOOTER_END="<!-- END KIT FOOTER -->"

CORE_TEMPLATE="$SCRIPT_DIR/templates/kit-core.md"
FOOTER_TEMPLATE="$SCRIPT_DIR/templates/kit-footer.md"

# ── Banner ──
printf '%s\n' "$(c '1;37' "guardrails-kit installer — deploy guardrails into $CLAUDE_DIR")"
printf '\n'

# ── Prompt ──
ask "Deploy guardrails-kit to $CLAUDE_DIR?" || { say "Aborted."; exit 0; }

# ── Backup ──
say "Backing up existing files (if any)..."
backup_file "$CLAUDE_DIR/CLAUDE.md"
backup_dir  "$CLAUDE_DIR/guardrails"
backup_dir  "$CLAUDE_DIR/rules"
backup_dir  "$CLAUDE_DIR/hooks"

# ── Deploy guardrails docs ──
say "Deploying guardrail docs..."
run mkdir -p "$CLAUDE_DIR/guardrails" "$CLAUDE_DIR/rules"
run cp -p "$SCRIPT_DIR/guardrails/"*.md "$CLAUDE_DIR/guardrails/"
run cp -p "$SCRIPT_DIR/rules/"* "$CLAUDE_DIR/rules/"

# Mechanical ~/.claude → $CLAUDE_DIR substitution (literal-string only)
if [ "$DRY_RUN" = 0 ]; then
  for f in "$CLAUDE_DIR/guardrails/"*.md "$CLAUDE_DIR/rules/"*.md; do
    [ -f "$f" ] || continue
    sed -i '' 's|~/\.claude|'"$CLAUDE_DIR"'|g' "$f"
  done
else
  say "  [dry-run] would substitute ~/.claude → $CLAUDE_DIR in deployed docs"
fi
ok "docs deployed"

# ── Deploy hooks ──
say "Deploying hooks..."
run mkdir -p "$CLAUDE_DIR/hooks"
run cp -p "$SCRIPT_DIR/hooks/"* "$CLAUDE_DIR/hooks/"
ok "hooks deployed"

# ── Splice CLAUDE.md ──
say "Splicing guardrails blocks into $CLAUDE_DIR/CLAUDE.md..."

if [ -f "$CLAUDE_DIR/CLAUDE.md" ]; then
  # Core block
  if grep -qF "$CORE_BEGIN" "$CLAUDE_DIR/CLAUDE.md"; then
    run splice_block "$CORE_TEMPLATE" "$CLAUDE_DIR/CLAUDE.md" "$CORE_BEGIN" "$CORE_END" replace "$CLAUDE_DIR"
  else
    run splice_block "$CORE_TEMPLATE" "$CLAUDE_DIR/CLAUDE.md" "$CORE_BEGIN" "$CORE_END" prepend "$CLAUDE_DIR"
  fi
  # Footer block (file may have been updated by core splice above)
  if grep -qF "$FOOTER_BEGIN" "$CLAUDE_DIR/CLAUDE.md"; then
    run splice_block "$FOOTER_TEMPLATE" "$CLAUDE_DIR/CLAUDE.md" "$FOOTER_BEGIN" "$FOOTER_END" replace "$CLAUDE_DIR"
  else
    run splice_block "$FOOTER_TEMPLATE" "$CLAUDE_DIR/CLAUDE.md" "$FOOTER_BEGIN" "$FOOTER_END" append "$CLAUDE_DIR"
  fi
else
  run splice_block "$CORE_TEMPLATE" "$CLAUDE_DIR/CLAUDE.md" "$CORE_BEGIN" "$CORE_END" create "$CLAUDE_DIR"
  run splice_block "$FOOTER_TEMPLATE" "$CLAUDE_DIR/CLAUDE.md" "$FOOTER_BEGIN" "$FOOTER_END" append "$CLAUDE_DIR"
fi
ok "CLAUDE.md updated"

# ── Register hooks in settings.json ──
if [ "$NO_SETTINGS" = 1 ]; then
  say "Skipping settings.json hook registration (--no-settings)."
elif [ ! -f "$CLAUDE_DIR/settings.json" ]; then
  warn "No settings.json at $CLAUDE_DIR/settings.json — skipping hook registration."
elif ! have jq; then
  warn "jq is required for settings.json hook registration. Install jq, then re-run."
else
  say "Registering kit hooks in $CLAUDE_DIR/settings.json..."
  SETTINGS="$CLAUDE_DIR/settings.json"

  # Parallel indexed arrays (bash 3.2 compatible)
  SCRIPTS=()
  EVENTS=()
  MATCHERS=()
  COMMANDS=()

  SCRIPTS+=(git-push-guard.sh)           ; EVENTS+=(PreToolUse)      ; MATCHERS+=(Bash)  ; COMMANDS+=("bash $CLAUDE_DIR/hooks/git-push-guard.sh")
  SCRIPTS+=(kill-by-name-guard.sh)       ; EVENTS+=(PreToolUse)      ; MATCHERS+=(Bash)  ; COMMANDS+=("bash $CLAUDE_DIR/hooks/kill-by-name-guard.sh")
  SCRIPTS+=(generated-file-read-guard.sh); EVENTS+=(PreToolUse)      ; MATCHERS+=(Read)  ; COMMANDS+=("bash $CLAUDE_DIR/hooks/generated-file-read-guard.sh")
  SCRIPTS+=(session-capabilities.sh)     ; EVENTS+=(SessionStart)    ; MATCHERS+=("*")   ; COMMANDS+=("bash $CLAUDE_DIR/hooks/session-capabilities.sh")
  SCRIPTS+=(task-framework.py)           ; EVENTS+=(UserPromptSubmit); MATCHERS+=("*")   ; COMMANDS+=("python3 $CLAUDE_DIR/hooks/task-framework.py")
  for i in "${!SCRIPTS[@]}"; do
    script="${SCRIPTS[$i]}"
    event="${EVENTS[$i]}"
    matcher="${MATCHERS[$i]}"
    command="${COMMANDS[$i]}"


    # Skip if this command is already registered under the event
    # (real settings.json nests hooks per event: hooks.<event>[].hooks[].command)
    existing=$(jq -r --arg ev "$event" --arg cmd "$command" \
      '[.hooks[$ev]? // [] | .[].hooks[]?.command? // empty | select(contains($cmd))] | length' "$SETTINGS")
    if [ "$existing" -gt 0 ]; then
      warn "hook for $script already registered, skipping"
      continue
    fi

    if [ "$DRY_RUN" = 1 ]; then
      printf '   [dry-run] register %s (%s / %s)\n' "$script" "$event" "$matcher"
      continue
    fi
    # Append to an existing group with the same matcher, else create a group
    jq --arg ev "$event" --arg matcher "$matcher" --arg cmd "$command" \
      '(.hooks[$ev]? // []) as $groups
       | if ([$groups[] | select(.matcher == $matcher)] | length) > 0 then
           .hooks[$ev] |= map(if .matcher == $matcher then .hooks += [{type: "command", command: $cmd}] else . end)
         else
           .hooks[$ev] = $groups + [{matcher: $matcher, hooks: [{type: "command", command: $cmd}]}]
         end' \
      "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
    ok "registered $script ($event / $matcher)"
  done

  # Validate JSON
  if jq . "$SETTINGS" >/dev/null 2>&1; then
    ok "settings.json is valid JSON"
  else
    err "settings.json is NOT valid JSON after hook registration"
  fi
fi

# ── Summary ──
printf '\n%s\n' "$(c '1;32' "Done.")"
printf '%s\n' "Restart Claude Code so it picks up the new CLAUDE.md, hooks, and settings."
