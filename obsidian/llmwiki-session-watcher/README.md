# llmwiki session-watcher

Autonomously folds finished Claude Code work-sessions into an llmwiki-pattern Obsidian vault. When one of your interactive sessions goes idle for an hour, a launchd agent dispatches a headless, cheap (`haiku`) `claude` run that reads that session's transcript and writes its durable knowledge into the wiki — the right page extended or a new one created, plus the spine files (`log.md`, `index.md`, `hot.md`) updated. You do nothing; the wiki compounds on its own.

> **This README is a runbook.** It is written so an LLM agent can set the system up end-to-end without guessing. Follow the steps in order. Each step has a **✅ Verify** gate — do not proceed past a gate that fails. The one genuinely manual, human-gated step (loading the launchd agent) is called out explicitly; everything before it is safe to automate.

---

## 0. Is this the right tool, and can it run here?

Hard prerequisites. Check **all** of them before doing anything else — the wizard will refuse if they are unmet, but verify first so you fail fast:

| Requirement | Why | Check |
|---|---|---|
| **macOS** | Scheduling is launchd; the script uses BSD `stat -f`, `date -r`, `uuidgen`, and an atomic `mkdir` lock (no `flock`). | `uname -s` → `Darwin` |
| **An llmwiki-pattern vault, already scaffolded** | The summarizer hard-assumes `CLAUDE.md` conventions plus `wiki/{index,log,hot}.md` and `wiki/codebases/`. On a bare vault every dispatch writes into a structure that is not there. | `test -f <vault>/CLAUDE.md && test -f <vault>/wiki/index.md` |
| **`claude` CLI, installed and authenticated** | It runs the headless summarizer. Auth is read from the macOS keychain (see Troubleshooting). | `claude --version` and you have logged in before |
| **`jq`** | All ledger and candidate logic is `jq`. | `command -v jq` (`brew install jq`) |
| **Existing `~/.claude/history.jsonl`** | This is the *only* trigger source — it logs interactive human prompts. No history ⇒ nothing to watch (yet). | `test -f ~/.claude/history.jsonl` |

If the vault is **not** scaffolded yet: scaffold it first (in the vault, run the `/wiki` skill), confirm `wiki/index.md` exists, then come back. This is step 0, not a footnote — skipping it produces silent, misfiled writes.

**Not on macOS?** The watcher logic is portable shell; only the scheduler and a few BSD-isms are not. A Linux port means: a systemd `--user` timer instead of the plist, and GNU-coreutils equivalents (`stat -c %Y`, `date -d @…`). That port is out of scope for this wizard.

---

## 1. Run the wizard

From this directory:

```sh
./install.sh /path/to/your/llmwiki-vault      # omit the arg to default to ~/llmwiki
```

The installer is idempotent and **does not go live**. In order it:

1. Verifies the prerequisites above (and refuses, with a precise reason, if any fail).
2. Stages `session-watcher.sh` and `session-summarizer-prompt.md` into `<vault>/scripts/` (the prompt's `__WIKI_DIR__` tokens are substituted with your vault path).
3. Generates `<vault>/scripts/com.<you>.llmwiki-session-watcher.plist` from the template (absolute paths, your `PATH`, your `claude` binary) and `plutil -lint`s it.
4. Appends the ledger + log filenames to the vault's `.gitignore` files so per-tick state never gets committed.
5. Initialises the ledger — a **no-op first run** that stamps `baseline_ms = now` and exits (see [§4](#4-the-baseline-what-gets-captured)).
6. Runs a **dry detection test** (writes nothing, dispatches nothing) and prints the candidate sessions it would have processed.

**✅ Verify:** the installer ends with `Staged successfully -- but NOT yet live` and prints a non-error candidate list (an empty list is fine on a fresh machine). If it `die`d, fix the stated cause and re-run — re-running is safe.

---

## 2. Manual test before going live

This is the safety gate. The watcher spends tokens and writes to your wiki, so prove it behaves on **one** real session before letting launchd run it every 20 minutes. `wiki/` is usually its own nested git repo, so review and revert with `git -C <vault>/wiki …`.

### 2a. One real dispatch

Pick the most recent real work-session, point the baseline just below it, and force a single dispatch with the idle gate disabled:

```sh
VAULT=/path/to/your/llmwiki-vault
L="$VAULT/wiki/.session-ledger.json"

# roll baseline back so recent sessions are visible again
tmp=$(mktemp); jq '.baseline_ms = 0' "$L" > "$tmp" && mv "$tmp" "$L"

IDLE_SECONDS=0 MAX_PER_RUN=1 WIKI_DIR="$VAULT" "$VAULT/scripts/session-watcher.sh"

tail -40 "$VAULT/scripts/session-watcher.log"   # expect: dispatch … then OK … then ledger …
git -C "$VAULT/wiki" status                      # review exactly what the summarizer wrote
```

**✅ Verify:** the log shows `dispatch …` → `OK …` → `ledger … note=summarized` (or `note=trivial-skipped`, which is also correct — the summarizer is a strict gatekeeper). `git -C "$VAULT/wiki" status` shows a sane, on-topic edit to a real page plus spine updates — **not** a date- or session-named page, and **not** a duplicate of a page that already covers the topic.

Keep it, or revert and tune:

```sh
# revert this test's wiki writes if you want a clean slate:
git -C "$VAULT/wiki" checkout . && git -C "$VAULT/wiki" clean -fd
```

### 2b. Reset the baseline before going live

So the first live tick does **not** re-ingest all of history:

```sh
tmp=$(mktemp); jq --argjson n "$(( $(date +%s) * 1000 ))" '.baseline_ms = $n' "$L" > "$tmp" && mv "$tmp" "$L"
```

**✅ Verify:** `jq -r '.baseline_ms' "$L"` is within a few seconds of `echo $(( $(date +%s) * 1000 ))`.

---

## 3. Go live — load the launchd agent (manual, human-gated)

> **Do this step by hand, only once you are satisfied with §2.** The wizard deliberately does **not** load launchd for you: an autonomous, token-spending agent should never be activated untested. If you are an LLM running this for a user, **stop here and hand these three commands to the user** rather than running them yourself, unless they have explicitly told you to activate it.

```sh
LABEL="com.$(id -un).llmwiki-session-watcher"
cp "<vault>/scripts/$LABEL.plist" ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/$LABEL.plist
launchctl list | grep llmwiki        # ✅ Verify: the label is listed
```

It now ticks every 20 minutes (`StartInterval`), summarising any human session that has been idle ≥ 1h, capped at 5 dispatches per tick.

**Uninstall:**

```sh
launchctl unload ~/Library/LaunchAgents/$LABEL.plist
rm ~/Library/LaunchAgents/$LABEL.plist
```

---

## 4. The baseline: what gets captured

The ledger holds `baseline_ms`. Only sessions whose last activity is **after** the baseline are ever considered. The first install run stamps it to *now*, so all pre-install history is ignored — no cold-start storm summarising hundreds of old sessions.

- **Go forward only (default):** do nothing; the install-time baseline is already "now".
- **Backfill the last N days:** before going live, roll the baseline back, then let it run (or drive a few manual ticks). The watcher processes oldest-first, so earlier page-creating runs populate the dedup anchor for later same-project sessions:

  ```sh
  # capture everything from the last 30 days:
  tmp=$(mktemp); jq --argjson n "$(( ( $(date +%s) - 30*86400 ) * 1000 ))" '.baseline_ms = $n' "$L" > "$tmp" && mv "$tmp" "$L"
  ```

  When the backfill is done, reset the baseline to *now* (§2b) so you don't reconsider that window forever.

---

## 5. Configuration

Override via the plist's `EnvironmentVariables` (re-`load` after editing) or per-invocation on the CLI. The installer writes your chosen values into the generated plist.

| Var | Default | Meaning |
|---|---|---|
| `IDLE_SECONDS` | `3600` | Silence (seconds) before a session segment is considered closed and eligible. |
| `MIN_PROMPTS` | `3` | Pre-filter: skip segments with fewer than this many human prompts. |
| `MAX_PER_RUN` | `5` | Max dispatches per tick (backpressure). |
| `WATCHER_MODEL` | `haiku` | Model for the summarizer runs. |
| `CLAUDE_BIN` | `~/.local/bin/claude` | Path to the `claude` binary. |
| `WIKI_DIR` | `~/llmwiki` | Vault root. Everything (ledger, prompt, logs) derives from this. |
| `START_INTERVAL` | `1200` | (install-time only) launchd tick cadence, seconds. |
| `LAUNCHD_LABEL` | `com.<user>.llmwiki-session-watcher` | (install-time only) launchd label + plist filename. |

---

## 6. How it works (short version)

The trigger is `~/.claude/history.jsonl`, which logs **only interactive human prompts** — subagent, Task, and headless runs never write there, so the system filters its own noise (and its own summarization runs) *structurally*, no classifier needed. A watcher owns a small JSON ledger; each dispatched summarizer writes a tiny result file that the watcher merges in deterministically, so an LLM never edits shared state and corruption is structurally impossible. Dedup is anchored on the project: the watcher hands each dispatch every wiki page already known for that project and tells it to extend the right one rather than fork a duplicate.

Full rationale, invariants, and the failure-mode reasoning are in **[DESIGN.md](./DESIGN.md)**. Read it before changing the script or the prompt — several non-obvious lines are load-bearing.

---

## 7. Troubleshooting

**Check the log first** — everything lands in `<vault>/scripts/session-watcher.log`.

- **Silent failure under launchd, works by hand** → almost always `PATH` or auth in launchd's bare environment. Confirm `claude` and `jq` resolve under the plist's `PATH`, and that auth works in the GUI login session.
- **Auth / "Not logged in"** → `claude` authenticates from the macOS keychain item `Claude Code-credentials`; no API-key env var is needed. A real LaunchAgent runs in your GUI login session and can reach the keychain. **A bare `env -i … claude` test will falsely report "Not logged in"** because it strips the session context keychain access needs — that is *not* representative of launchd, so don't chase it.
- **`jq: command not found` in the log (Intel Mac)** → the bundled `session-watcher.sh` re-exports its own `PATH` containing `/opt/homebrew/bin` (Apple Silicon). On Intel, Homebrew is `/usr/local/bin`; add it to the `export PATH=…` line near the top of `<vault>/scripts/session-watcher.sh`.
- **No candidates ever** → expected right after install (baseline = now). Confirm with the dry test in §1; only sessions idle ≥ `IDLE_SECONDS` and newer than the baseline qualify.
- **`ledger is invalid JSON`** → the watcher backs the file up to `…json.corrupt` and skips the tick rather than crash-looping. Inspect the backup, repair or delete `…json` (a fresh one re-inits with baseline = now), and the next tick recovers.

---

## 8. Manual install (no `install.sh`)

If you are wiring this up by hand or onto a non-standard layout, replicate what the wizard does:

1. `cp session-watcher.sh <vault>/scripts/` and `chmod +x` it. **Do not edit it** — it is portable via `$HOME` and the env vars in §5.
2. `sed 's|__WIKI_DIR__|<vault>|g' session-summarizer-prompt.md > <vault>/scripts/session-summarizer-prompt.md`.
3. Substitute every `__TOKEN__` in `com.llmwiki-session-watcher.plist.template` and write the result to `~/Library/LaunchAgents/<Label>.plist`:

   | Token | Value |
   |---|---|
   | `__LABEL__` | `com.<user>.llmwiki-session-watcher` |
   | `__SCRIPT__` | `<vault>/scripts/session-watcher.sh` (absolute) |
   | `__PATH__` | `$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin` |
   | `__WIKI_DIR__` | `<vault>` (absolute) |
   | `__CLAUDE_BIN__` | absolute path to `claude` |
   | `__MODEL__` | `haiku` |
   | `__IDLE_SECONDS__` | `3600` |
   | `__INTERVAL__` | `1200` |
   | `__STDOUT__` / `__STDERR__` | `<vault>/scripts/launchd.out.log` / `…err.log` |

4. Ignore `wiki/.session-ledger.json` (+ `.corrupt`) in `<vault>/wiki/.gitignore`, and `scripts/*.log` in `<vault>/.gitignore`.
5. Run the watcher once to init the ledger, do the §2 manual test, then load the plist (§3).

---

## 9. File manifest

| File | Role |
|---|---|
| `install.sh` | The wizard. Stages, templates, lints, inits, dry-tests. Does **not** load launchd. |
| `session-watcher.sh` | The watcher (run by launchd). Sole owner of the ledger. Copied verbatim — portable as-is. |
| `session-summarizer-prompt.md` | Instructions handed to each dispatched `claude` run (`__WIKI_DIR__`-templated). |
| `com.llmwiki-session-watcher.plist.template` | launchd agent template; `__TOKEN__`s filled at install time. |
| `README.md` | This runbook. |
| `DESIGN.md` | Architecture, invariants, and failure-mode rationale — read before modifying. |
