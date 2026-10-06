---
name: human-in-the-loop-testing
description: >
  Direct a human tester so each reply maximally narrows the problem when you
  cannot observe the system yourself. Use whenever you are iterating on
  something you can't directly verify — terminal UIs/TUIs, GUIs, visual layout
  and rendering, animations, audio, timing/races, hardware, device- or
  terminal-specific behavior, or UX "feel" — and must rely on a human as your
  eyes and hands. Triggers: "I can't test this here", building/debugging a TUI
  or GUI that won't run headless, a vague "it's not working" with no detail,
  repeated low-information bug reports, or any build→ask-human→fix loop. Not for
  work you can verify yourself with tests, builds, or scripts — run those first.
---

# Human-in-the-loop testing

When you can't run or see the thing, the human is your only instrument. Their
time and patience are the scarce resource. A vague exchange ("it's broken" →
"can you say more?") burns a full round-trip. Every question you ask should be
shaped so the answer collapses the space of possible causes as much as
possible. Treat it like binary search with a human oracle.

## The prime directive

**Pre-commit a hypothesis→observation map before you ask.** Before requesting a test, write into the ledger (see Durable state below) the likely failure modes and, for each, the *specific observable* that would confirm it — never just mentally: an unwritten prediction gets retrofitted to whatever the human reports. Then ask in terms of those observables. If you can't predict what distinct symptoms would look like, you're not ready to ask yet — reason more first.

If your question can't change what you do next regardless of the answer, don't
ask it.

## Core techniques

### 1. Offer discriminating symptom menus, not open questions
Replace "what happened?" with 3–4 concrete symptom descriptions, each mapping to
a *different* root cause or code location. The human recognizes far more
reliably than they describe, and the choice itself does your triage.

Bad: "Did it work?" / "Tell me what you saw."
Good (each option pre-mapped to a cause you'll act on):
- "No prompt appeared at all" → feature isn't activating
- "A prompt appeared but output drew over it" → cursor/positioning math
- "Garbled escape codes / trailing glyphs" → flush or stream-ordering
- "Prompt showed but typing did nothing" → input wiring

Use a single-select question tool when available; otherwise number the options and ask them to reply with a number.

Always include a final "none of these — describe what you saw" option (the question tool adds Other automatically; a numbered list needs it added by hand). An off-menu answer is not noise to fit into the nearest listed cause — it falsifies the hypothesis map itself. Stop, re-derive the map, then re-ask.

### 2. Ask for observables, never diagnoses
Request what they *see or hear*, not their theory of the cause. "The prompt
duplicates on every keystroke" or "each line prints one row lower than the last"
is gold; "I think the buffer is wrong" sends you chasing their guess. You own
the mapping from observable → cause.

### 3. Foundation first, edge cases last
Sequence tests from the one that validates the core mechanism to the ones that
probe edge cases. Never let the human's first test be the hardest path. Name the
**make-or-break test** — the single observation that most reduces uncertainty —
and ask for that one first. Hold the rest until the foundation is confirmed.

### 4. Keep a standing known-noise ledger
When the output will contain effects you already understand and aren't fixing, say so up front, and tell the human exactly what to ignore and what to judge. "The notices will still interleave — that's a separate concern. Only tell me whether the *text merges*." This stops their signal from drowning in noise you'd otherwise have to re-explain away.

Maintain it as a cumulative ledger, not a per-question aside: one "Known noise (don't report): X, Y, Z" list that covers ALL steps of the session, restated in full whenever you hand over a new test script. Every accepted-defect, parked finding, and known-cosmetic issue goes in the moment it's classified. The human should never have to wonder mid-test "is this worth mentioning?" — the ledger pre-answers it.

### 5. State what a change should AND shouldn't change
Before a re-test, predict the expected delta in observable terms: "If this
worked, X now happens; Y will look the same; Z is still broken and expected." A
confirmed prediction is strong evidence; a surprised "no, Y changed too" is
often more informative than the thing you were testing.

### 6. Lower the cost of testing
Give recovery instructions so a bad result isn't scary: how to abort, reset, or
restore (e.g. "Ctrl+C twice to force-quit, then `stty sane`"). Cheap-to-run,
safe-to-fail tests get run more and reported faster.

### 7. Ask for an artifact when words are ambiguous
For anything visual/spatial/temporal, a screenshot, paste, copied terminal
buffer, or short screen recording resolves in one shot what paragraphs of prose
won't. Ask for it explicitly when the symptom is layout/rendering/ordering.

### 8. One change per round, attributed
Change one variable at a time so the next observation is unambiguous. If you
ship several fixes at once, tell the human which symptom each one targets, so
their report can confirm or refute each independently.

### 9. Calibrate the instrument before spending human rounds
Before the first ask, put the system into a known-good state yourself and prove it: clean compile, fresh boot/session, your own smoke check (logs empty, process alive, screenshot sane). A human round spent discovering "the build was stale" or "that session had been running for 11 hours" is the most expensive way to learn it. Trigger: you are about to send the first test script of a session.

### 10. Machine-check before human-recheck
When a follow-up question could be answered by an instrument you DO have — a log probe, an object inspection, a screenshot, reading the source of the thing they described — use it instead of sending the human back to squint. "I can discriminate that from here" saves a round AND returns ground truth instead of a second impression. Trigger: you're about to ask the human to "look again" or "confirm" something.

### 11. Attribute unexpected state changes with one cheap binary
Mid-session, when the system state changes in a way you didn't cause (process stopped, window closed, mode exited), ask "did you do X?" before investigating — humans touch things and often won't think to mention it. And when they volunteer "sorry, that was me," accept it and drop the thread immediately. Trigger: an anomaly appears between your last action and their next report.

### 12. Log vibes as findings with the human's own priority
Enthusiasm and complaints are real data — convert each to a ledger entry with an observable and the priority the human assigned, verbatim ("a little jittery, not my top pri" → PARKED: thrust feel, wants heavy-boat). Never interleave fixes for parked findings into the live test run; one change per round still rules. Trigger: the human editorializes ("love it", "feels off", "not now").

### 13. Stamp the build so every report self-authenticates
The most expensive silent failure is the human testing stale code — an editor that didn't recompile, an old process still bound to the port. Put a visible version nonce where they can't miss it (a round number in the HUD corner, a versioned window title), bump it every round, and have each report open with it. A screenshot then proves which build it shows for free. Trigger: any loop where the human relaunches, or the toolchain hot-reloads, between rounds.

### 14. Escalate when the loop itself stops converging
Two consecutive rounds that fail to collapse the hypothesis space mean the instrument is the problem, not the questions. Stop asking; spend the next round building instrumentation — a log probe, an on-screen debug readout, a screenshot harness — so the answer becomes machine-checkable instead of human-reported. Trigger: you're drafting a third ask with the same hypothesis list the first one had.

## Durable state: the ledger lives in docs/STATE.md

Context compacts mid-playtest; anything held only in conversation resets silently, and a resuming session re-reads STATE.md anyway (SESSION.md S1) — so the ledger survives for free there. Restate from the file, never from memory:

- `## Playtest` (create at round 1, delete when the playtest ends): the cumulative known-noise ledger, the current hypothesis→observable map, the build stamp, and a round log — one line per round: `R<n>: <change> | predicted <observable> | saw <observable> | <verdict>`.
- Predictions land in `## Playtest` BEFORE the ask; the file's history proves the prediction preceded the observation.
- Parked findings and vibes → `## Open items`, with the human's verbatim priority attached.
- Failed rounds → `## Failed attempts` in ATTEMPT format.

Write the human's words verbatim at the moment they happen — session-retro harvests these entries at the session boundary.

## Workflow

1. **Build / change** — make the smallest change that tests one hypothesis.
2. **Predict** — write expected observables (pass and each fail mode) into `## Playtest` before the ask; a prediction recorded after the report is not evidence.
3. **Direct** — give the human: the exact command to run, the make-or-break test
   first, what to look at, what to ignore, and how to recover.
4. **Discriminate** — ask via a symptom menu mapped to causes, or request an
   artifact.
5. **Map** — translate their observable back to the root cause; don't re-ask.
6. **Loop** — one change, attributed; append the `R<n>:` round line to `## Playtest`; repeat. Confirm the foundation before moving to edge cases. Two non-converging rounds → technique 14.

## Anti-patterns

- Asking "does it work now?" with no menu and no prediction.
- Shipping five fixes and asking for one yes/no — you can't attribute the result.
- Letting the human test the hardest/most-coupled path first.
- Accepting a diagnosis ("the mutex is wrong") in place of an observable.
- Re-explaining away known noise every round instead of telling them to ignore it.
- Asking for info that wouldn't change your next move.
- Spending the human's first round on a stale build or dirty session you could have reset yourself.
- Sending the human back to re-observe something a probe, screenshot, or source read could settle.
- Re-listing known noise only for the current step — the ledger is cumulative or it's useless.
- Fixing a parked finding mid-run because it was easy, invalidating the round's attribution.
- A menu with no "none of these" escape — off-menu reality gets force-fitted into your nearest listed cause.
- Predicting "privately" — an unwritten prediction gets retrofitted to whatever the human reports.
- Keeping the ledger only in conversation — one compaction resets it; it lives in docs/STATE.md.
- No build stamp — a whole round spent testing stale code.
- Drafting a third ask with an unchanged hypothesis list — the loop has stalled; instrument instead.

## Reusable phrasings

- "Test this in order — step 1 is make-or-break, don't do step 3 until step 1 is clean."
- "Which of these did you see?" + a mapped menu.
- "Tell me what it looks like (e.g. 'prompt duplicates', 'text one row lower'), not what you think caused it."
- "This should fix A; B will still look busy — that's separate. Only judge A."
- "If it corrupts the screen: Ctrl+C twice, then `stty sane`. Then tell me the last thing that rendered correctly."
- "Paste/screenshot what you see — for layout bugs that's worth more than any description."
- "First: what build number is in the corner? If it isn't <n>, stop — relaunch first."
- "None of those? Describe what you actually saw — that's the most useful answer on the list."
