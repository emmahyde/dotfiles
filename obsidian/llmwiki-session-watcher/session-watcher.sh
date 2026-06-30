#!/usr/bin/env bash
# llmwiki session watcher
# ----------------------------------------------------------------------------
# Detects idle *human* work-segments and dispatches an autonomous wiki
# summarizer for each. Driven off ~/.claude/history.jsonl, which logs only
# interactive human prompts -- subagent/Task/headless runs never appear there,
# so the noisy 544 non-human transcripts on disk are filtered out structurally.
#
# Design (see scripts/README.md):
#   - Segment  = contiguous burst of a session, closed by IDLE_SECONDS of silence
#   - Baseline = on first run we stamp "now"; everything before install is ignored
#                (no cold-start storm summarizing 150 old sessions)
#   - Self-loop guard = each dispatch gets a generated --session-id recorded in
#                the ledger; the watcher skips any session-id it created, so our
#                own headless runs can never be re-ingested even if they DID log
#   - Single instance via atomic mkdir lock (macOS has no flock)
# ----------------------------------------------------------------------------
set -euo pipefail

# ---- config (override via env) ----
CLAUDE_BIN="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
WIKI_DIR="${WIKI_DIR:-$HOME/llmwiki}"
HISTORY="${HISTORY_FILE:-$HOME/.claude/history.jsonl}"
PROJECTS_DIR="${PROJECTS_DIR:-$HOME/.claude/projects}"
LEDGER="$WIKI_DIR/wiki/.session-ledger.json"
PROMPT_FILE="$WIKI_DIR/scripts/session-summarizer-prompt.md"
LOG="$WIKI_DIR/scripts/session-watcher.log"
IDLE_SECONDS="${IDLE_SECONDS:-3600}"               # 1h idle => segment closed
MIN_PROMPTS="${MIN_PROMPTS:-3}"                    # worthiness pre-filter
MAX_PER_RUN="${MAX_PER_RUN:-5}"                    # cap dispatches per tick
MODEL="${WATCHER_MODEL:-haiku}"
DRY_RUN="${DRY_RUN:-0}"                            # 1 = detect & log candidates, never dispatch
LOCKDIR="${LOCKDIR:-/tmp/llmwiki-session-watcher.lock}"
LOCK_STALE_SECONDS="${LOCK_STALE_SECONDS:-10800}"  # reclaim lock after 3h

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin${PATH:+:$PATH}"

log(){ printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$*" >> "$LOG"; }

# ---- single-instance lock (mkdir is atomic and portable; no flock on macOS) ----
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  age=$(( $(date +%s) - $(stat -f %m "$LOCKDIR" 2>/dev/null || echo "$(date +%s)") ))
  if [ "$age" -gt "$LOCK_STALE_SECONDS" ]; then
    log "reclaiming stale lock (age=${age}s)"
    rmdir "$LOCKDIR" 2>/dev/null || true
    mkdir "$LOCKDIR" 2>/dev/null || { log "lock contended after reclaim; exit"; exit 0; }
  else
    exit 0   # a live instance owns the lock
  fi
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null || true' EXIT

# ---- preflight (fail loud to the log; launchd has a bare env) ----
[ -x "$CLAUDE_BIN" ]    || { log "FATAL: claude not executable at $CLAUDE_BIN"; exit 1; }
command -v jq >/dev/null || { log "FATAL: jq not found on PATH=$PATH"; exit 1; }
[ -f "$PROMPT_FILE" ]   || { log "FATAL: prompt file missing: $PROMPT_FILE"; exit 1; }
[ -f "$HISTORY" ]       || { log "no history file at $HISTORY; nothing to do"; exit 0; }
mkdir -p "$(dirname "$LEDGER")"
cd "$WIKI_DIR" || { log "FATAL: cannot cd to $WIKI_DIR"; exit 1; }

now_ms=$(( $(date +%s) * 1000 ))
idle_ms=$(( IDLE_SECONDS * 1000 ))

# ---- ledger init: cold-start baseline => ignore all pre-install activity ----
if [ ! -f "$LEDGER" ]; then
  jq -n --argjson b "$now_ms" \
    '{baseline_ms:$b, sessions:{}, dispatched_session_ids:[]}' > "$LEDGER"
  log "initialized ledger; baseline_ms=$now_ms. Pre-install sessions ignored; first run is a no-op."
  exit 0
fi
# ---- validate ledger JSON before use ----
# The watcher is the SOLE writer of this file (the summarizer only emits a small
# result JSON to its own result_path; see the dispatch loop). This guard is now a
# belt-and-suspenders check: if the ledger is ever invalid (manual edit, disk
# glitch), back up once and skip this tick instead of crash-looping.
if ! jq -e . "$LEDGER" >/dev/null 2>&1; then
  cp "$LEDGER" "$LEDGER.corrupt" 2>/dev/null || true
  log "FATAL: ledger is invalid JSON; backed up to $LEDGER.corrupt; skipping tick (needs manual repair)"
  exit 1
fi
baseline_ms=$(jq -r '.baseline_ms // 0' "$LEDGER")

# ---- candidate segments ----
# idle past threshold, after baseline, >= MIN_PROMPTS, not one of our own
# dispatch ids, and with activity newer than what we already summarized.
candidates=$(jq -s -c \
  --argjson now "$now_ms" --argjson idle "$idle_ms" \
  --argjson baseline "$baseline_ms" --argjson minp "$MIN_PROMPTS" \
  --slurpfile led "$LEDGER" '
    ($led[0].dispatched_session_ids // []) as $self
    | ($led[0].sessions // {})            as $sessions
    | group_by(.sessionId)[]
    | { sid:      .[0].sessionId,
        project:  (.[-1].project),
        last_ms:  (map(.timestamp) | max),
        first_ms: (map(.timestamp) | min),
        prompts:  length }
    | select((.sid | IN($self[])) | not)
    | select(.last_ms > $baseline)
    | select(($now - .last_ms) > $idle)
    | select(.prompts >= $minp)
    | select(.last_ms > (($sessions[.sid].last_summarized_ms) // 0))
  ' "$HISTORY" 2>>"$LOG" | jq -s -c 'sort_by(.last_ms)' 2>>"$LOG") \
  || { log "FATAL: jq candidate extraction failed (malformed history?)"; exit 1; }

n=$(printf '%s' "$candidates" | jq 'length')
if [ "$n" -eq 0 ]; then exit 0; fi
log "found $n candidate segment(s)"

dispatched=0
while IFS= read -r c; do
  if [ "$dispatched" -ge "$MAX_PER_RUN" ]; then
    log "hit MAX_PER_RUN=$MAX_PER_RUN; deferring remaining to next tick"; break
  fi
  sid=$(printf '%s'     "$c" | jq -r '.sid')
  project=$(printf '%s' "$c" | jq -r '.project')
  last_ms=$(printf '%s' "$c" | jq -r '.last_ms')
  transcript=$(ls "$PROJECTS_DIR"/*/"$sid".jsonl 2>/dev/null | head -1 || true)

  if [ "$DRY_RUN" = "1" ]; then
    log "DRY would-dispatch sid=$sid project=$project last_ms=$last_ms transcript=${transcript:-MISSING}"
    dispatched=$(( dispatched + 1 )); continue
  fi

  # transcript pruned (only happens for sessions older than the prune window;
  # live 2h-idle segments always still have one). Mark seen so we don't retry forever.
  if [ -z "$transcript" ]; then
    log "transcript pruned for sid=$sid; marking seen (no page)"
    tmp=$(mktemp)
    jq --arg sid "$sid" --arg proj "$project" --argjson lm "$last_ms" --argjson now "$now_ms" '
      .sessions[$sid] = {
        last_summarized_ms: $lm,
        segment_count:     ((.sessions[$sid].segment_count // 0) + 1),
        project:            $proj,
        wiki_pages:         (.sessions[$sid].wiki_pages // []),
        note:              "transcript-pruned",
        updated_ms:         $now }
    ' "$LEDGER" > "$tmp" && mv "$tmp" "$LEDGER"
    continue
  fi

  # Record our generated dispatch id BEFORE running => unconditional self-loop guard.
  # Lowercase it: history.jsonl session ids are lowercase, and the candidate
  # filter compares against this list with IN() — a case mismatch would let a
  # re-logged dispatch slip through.
  gen_sid=$(uuidgen | tr 'A-Z' 'a-z')
  tmp=$(mktemp)
  jq --arg g "$gen_sid" '.dispatched_session_ids = ((.dispatched_session_ids // []) + [$g])[-200:]' \
    "$LEDGER" > "$tmp" && mv "$tmp" "$LEDGER"

  # The summarizer writes its structured result here (project/wiki_pages/note); the
  # watcher reads it back AFTER the run and is the only thing that touches the ledger.
  result_path="/tmp/llmwiki-result-${gen_sid}.json"
  rm -f "$result_path"

  prior_pages=$(jq -rc  --arg sid "$sid" '.sessions[$sid].wiki_pages // []'      "$LEDGER")
  # Deterministic dedup anchor: every wiki page any prior run recorded for THIS
  # project. A returning work-session almost always has a *new* session id (so
  # prior_pages above is empty), but the project is stable -- this hands the
  # summarizer the exact existing pages to extend instead of relying on it
  # re-discovering them by grep. Backfill runs oldest-first, so page-creating
  # runs populate this for every later same-project session.
  prior_project_pages=$(jq -rc --arg p "$project" \
    '[.sessions[] | select(.project == $p) | .wiki_pages[]?] | unique' "$LEDGER")
  prior_through=$(jq -r --arg sid "$sid" '.sessions[$sid].last_summarized_ms // 0' "$LEDGER")
  # Render the cutoff as ISO-8601 so the summarizer can compare it directly to the
  # transcript's ISO timestamp strings (raw epoch-ms is not comparable to them).
  if [ "${prior_through:-0}" -gt 0 ]; then
    prior_through_iso=$(date -r "$(( prior_through / 1000 ))" -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo none)
  else
    prior_through_iso=none
  fi
  segment_date=$(date -r "$(( last_ms / 1000 ))" '+%Y-%m-%d %H:%M' 2>/dev/null || echo unknown)
  today=$(date '+%Y-%m-%d')

  header="## Dispatch context (consumed by the summarizer)
- source_session_id: ${sid}
- project: ${project}
- transcript: ${transcript}
- prior_wiki_pages: ${prior_pages}   # pages from THIS exact session id (usually empty — a returning session gets a new id)
- prior_project_pages: ${prior_project_pages}   # pages the wiki ALREADY has for this project — extend the right one, do NOT duplicate
- already_summarized_through: ${prior_through_iso}   # ISO-8601 cutoff (or 'none'); focus on transcript lines after this
- this_segment_last_ms: ${last_ms}
- segment_date: ${segment_date}
- today: ${today}
- result_path: ${result_path}   # WRITE your result JSON here when done; do NOT touch any ledger

---

"
  log "dispatch sid=$sid project=$project gen_sid=$gen_sid transcript=$transcript"
  # Prompt via stdin: a variadic flag like --allowedTools would otherwise eat a
  # trailing positional prompt. stdin removes that ambiguity entirely.
  if printf '%s' "${header}$(cat "$PROMPT_FILE")" | "$CLAUDE_BIN" -p \
        --session-id "$gen_sid" \
        --model "$MODEL" \
        --permission-mode acceptEdits \
        --allowedTools "Read" "Edit" "Write" "Glob" "Grep" \
        --add-dir "$PROJECTS_DIR" >>"$LOG" 2>&1; then
    log "OK sid=$sid"
  else
    log "FAILED sid=$sid (exit $?)"
  fi

  # ---- Watcher is the SOLE ledger writer ----
  # Read the summarizer's result file and merge it deterministically via jq. An LLM
  # never edits the ledger, so corruption is structurally impossible. If the result
  # is missing/invalid (model skipped it, crashed, or wrote garbage), record a safe
  # fallback entry so the session is still marked seen and never re-loops.
  if [ -f "$result_path" ] && jq -e . "$result_path" >/dev/null 2>&1; then
    r_project=$(jq -r '.project // empty' "$result_path"); [ -z "$r_project" ] && r_project="$project"
    r_pages=$(jq -c '(.wiki_pages // []) | if type=="array" then . else [] end' "$result_path")
    r_note=$(jq -r '.note // "summarized"' "$result_path")
  else
    log "no/invalid result file for sid=$sid; writing fallback ledger entry"
    r_project="$project"; r_pages='[]'; r_note='result-missing'
  fi
  rm -f "$result_path"

  tmp=$(mktemp)
  if jq --arg sid "$sid" --arg proj "$r_project" --argjson pages "$r_pages" \
        --arg note "$r_note" --argjson lm "$last_ms" --argjson now "$now_ms" '
        .sessions[$sid] = {
          last_summarized_ms: $lm,
          segment_count:     ((.sessions[$sid].segment_count // 0) + 1),
          project:            $proj,
          wiki_pages:         $pages,
          note:               $note,
          updated_ms:         $now }
      ' "$LEDGER" > "$tmp" 2>>"$LOG" && [ -s "$tmp" ] && jq -e . "$tmp" >/dev/null 2>&1; then
    mv "$tmp" "$LEDGER"
    log "ledger sid=$sid project=$r_project pages=$r_pages note=$r_note"
  else
    rm -f "$tmp"
    log "WARN ledger write failed for sid=$sid (prior ledger kept; will retry next tick)"
  fi
  dispatched=$(( dispatched + 1 ))
done < <(printf '%s' "$candidates" | jq -c '.[]')

log "tick complete (dispatched up to $MAX_PER_RUN this run)"
