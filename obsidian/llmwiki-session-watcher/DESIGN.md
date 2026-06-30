# Design notes — llmwiki session-watcher

Why the system is shaped the way it is, and which lines are load-bearing. Read this before changing `session-watcher.sh` or `session-summarizer-prompt.md`; several non-obvious decisions exist specifically to prevent failure modes that an earlier, simpler design hit in practice.

## The problem

A long-lived Claude Code user accumulates hundreds of session transcripts. Most of their durable value — decisions, findings, architecture, gotchas — evaporates when the session ends. The goal is to capture that value into a persistent wiki **without** the user lifting a finger, and **without** the capture process degrading the wiki (duplicate pages, date-stamped clutter, summaries of trivial Q&A, or summaries of the capture runs themselves).

The whole design is a series of answers to "how does this stay correct and low-noise while running unattended forever?"

## Trigger source: `~/.claude/history.jsonl` (human prompts only)

The watcher reads idle segments off `~/.claude/history.jsonl`, not off the transcript files on disk. This is the single most important design choice. `history.jsonl` logs **only interactive human prompts** — subagent runs, `Task` tool runs, and headless `claude -p` runs never write to it. The hundreds of non-human transcripts on disk are therefore filtered out *structurally*, with no classifier and no heuristics. Critically, this also means the watcher's **own** headless summarization runs never appear as triggers — the system cannot see its own work as new work to summarize. (A generated-session-id guard, below, is the belt-and-suspenders backup for this.)

If you ever change the trigger to scan transcripts directly, you reintroduce every problem this choice eliminates. Don't, unless you replace it with an equally strong structural filter.

## Segments and the idle gate

A *segment* is a contiguous burst of activity for one `sessionId`, considered closed once `IDLE_SECONDS` (default 3600 = 1h) have elapsed since its last prompt. Idle is `now − max(timestamp for that sessionId)`. Closing on idle — rather than on a session-ended signal, which does not reliably exist — is what lets a session be summarized while it is still technically "open," and what lets a *returning* session (new burst, same id, or more often a brand-new id) be re-summarized later as a continuation.

## Cold-start baseline

The ledger stores `baseline_ms`. Only segments whose last activity is strictly after the baseline are eligible. The very first run stamps `baseline_ms = now` and exits without dispatching anything. This is what prevents a cold-start storm: installing the watcher on a machine with 150 old sessions does **not** trigger 150 summarizations. Backfilling is then an explicit, opt-in act of rolling the baseline backwards (see README §4). The watcher processes candidates oldest-first precisely so that backfills build the per-project dedup anchor in causal order.

## Self-loop guard

Before each dispatch the watcher generates a `--session-id` (a fresh UUID, lowercased to match `history.jsonl`'s casing) and records it in `dispatched_session_ids` **before** running. The candidate filter excludes any id in that list. So even in the impossible-by-construction case where a headless summarizer run *did* log to `history.jsonl`, the watcher would still skip it. The list is capped to the most recent 200 ids. The lowercasing matters: the `IN()` comparison in the candidate `jq` is case-sensitive, and a mismatch would let a re-logged dispatch slip through.

## The watcher is the sole writer of the ledger

This is the second most important choice. An earlier design had the haiku summarizer surgically `Edit` the shared ledger JSON to record its own result. It reliably broke the JSON — models are not reliable at byte-precise edits to a growing structured file under concurrency. The fix: **the summarizer never touches the ledger.** It writes a tiny result file (`{project, wiki_pages, note}`) to a per-dispatch `result_path`, and the watcher merges that into the ledger deterministically with `jq` after the run. If the result file is missing or invalid (model skipped it, crashed, wrote garbage), the watcher writes a safe fallback entry (`note: "result-missing"`, `wiki_pages: []`) so the session is still marked seen and can never loop. Ledger corruption is thus structurally impossible from the LLM side; the remaining `jq -e` validity guard at the top of the script is pure belt-and-suspenders for manual edits or disk glitches, and on failure it backs the file up and skips the tick rather than crash-looping.

## Integrate vs. spin-off (dedup)

The hardest correctness problem is "this session continued work that already has a wiki page — extend it, don't fork a `foo-2`." Per-session history cannot anchor this, because a returning work-session almost always launches with a **new** session id. The stable key is the **project**. The ledger records each session's `project`, and before each dispatch the watcher aggregates every wiki page any prior run recorded for that project into `prior_project_pages`, handed to the summarizer as a deterministic "extend one of these, do not duplicate" anchor. The summarizer reads those pages first; an `index.md` / glob / grep topic search is only the bootstrap fallback when the anchor is empty. Verified in practice: a fresh session with empty per-session history correctly extended the existing project page instead of forking a duplicate.

## Worthiness and anti-fragmentation (in the prompt)

Two layers keep the wiki dense. First, a cheap pre-filter: segments with fewer than `MIN_PROMPTS` (default 3) prompts are dropped before any dispatch. Second, the summarizer prompt itself is a strict gatekeeper, and this is where the anti-fragmentation rules live — they are load-bearing, not stylistic:

- **A session is never a topic.** One topic = one page. Prep, planning, scaffolding, status snapshots, and "what we did" work-logs get folded into the project's anchor page as a dated section or bullet — they do not get their own page.
- **Never name a page with a date prefix or after a session.** Dates belong in `created`/`updated` frontmatter, not filenames. Page names are topic names.
- **Extend over fork.** A new page is created only for a genuinely new, self-contained, named reference artifact a future unrelated session would seek out *by name*.
- **Trivial segments produce no page** — the summarizer emits `note: "trivial-skipped"` and stops, at most appending a single dated bullet to the most relevant existing page.

These rules exist because the default behavior of a summarizer pointed at session transcripts is to mint one page per session, which fragments the wiki into date-stamped sediment. If you weaken them, that is the failure you will see.

## Concurrency and backpressure

A single-instance lock via atomic `mkdir` (macOS has no `flock`); a stale lock older than `LOCK_STALE_SECONDS` (3h) is reclaimed. `MAX_PER_RUN` (default 5) caps dispatches per tick. A run that outlasts the `StartInterval` simply causes the next tick to find the lock held and exit immediately. Nothing queues; the next tick re-derives candidates from scratch, so a skipped tick loses nothing.

## Ledger schema

```json
{
  "baseline_ms": 1782833752000,
  "dispatched_session_ids": ["<generated uuid>", "..."],
  "sessions": {
    "<source session id>": {
      "last_summarized_ms": 1782513624359,
      "segment_count": 1,
      "project": "/abs/path/to/project",
      "wiki_pages": ["wiki/codebases/foo.md", "wiki/log.md", "wiki/hot.md"],
      "note": "summarized | trivial-skipped | transcript-pruned | result-missing",
      "updated_ms": 1782833900000
    }
  }
}
```

`last_summarized_ms` is the dedup-by-time key: a session re-qualifies only when new activity pushes its `last_ms` past what was already summarized. `wiki_pages` across all sessions of a project is what builds `prior_project_pages`.

## Invariants — do not break these

1. The trigger stays `history.jsonl` (human-only). Scanning transcripts directly reintroduces self-ingestion and noise.
2. The summarizer never reads or writes the ledger. Only the watcher does, only via `jq`, only from the result file.
3. Every dispatch records its generated id in `dispatched_session_ids` **before** running.
4. The first run stamps the baseline and dispatches nothing.
5. The prompt's page-vs-section and naming rules stay strict. They are the only thing standing between "dense wiki" and "date-stamped sediment."

## Security / blast radius

Each dispatch runs `claude -p --permission-mode acceptEdits` with `--allowedTools Read Edit Write Glob Grep` and `--add-dir ~/.claude/projects`, prompt piped via **stdin** (a variadic flag like `--allowedTools` would otherwise swallow a trailing positional prompt). The effect: a dispatch can read session transcripts and edit the vault, and nothing else — no Bash, no network. Auth is the macOS keychain item `Claude Code-credentials`, reachable from the GUI login session that launchd runs in (see README Troubleshooting for why a bare `env -i` test misleadingly reports "Not logged in").
