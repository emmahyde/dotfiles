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

**Pre-commit a hypothesis→observation map before you ask.** Before requesting a
test, privately enumerate the likely failure modes and, for each, the *specific
observable* that would confirm it. Then ask in terms of those observables. If
you can't predict what distinct symptoms would look like, you're not ready to
ask yet — reason more first.

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

Use a single-select question tool when available; otherwise number the options
and ask them to reply with a number.

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

### 4. Separate your-fix's-target from known-separate noise
When the output will contain effects you already understand and aren't fixing,
say so up front, and tell the human exactly what to ignore and what to judge.
"The notices will still interleave — that's a separate concern. Only tell me
whether the *text merges*." This stops their signal from drowning in noise you'd
otherwise have to re-explain away.

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

## Workflow

1. **Build / change** — make the smallest change that tests one hypothesis.
2. **Predict** — privately list expected observables (pass and each fail mode).
3. **Direct** — give the human: the exact command to run, the make-or-break test
   first, what to look at, what to ignore, and how to recover.
4. **Discriminate** — ask via a symptom menu mapped to causes, or request an
   artifact.
5. **Map** — translate their observable back to the root cause; don't re-ask.
6. **Loop** — one change, attributed, repeat. Confirm the foundation before
   moving to edge cases.

## Anti-patterns

- Asking "does it work now?" with no menu and no prediction.
- Shipping five fixes and asking for one yes/no — you can't attribute the result.
- Letting the human test the hardest/most-coupled path first.
- Accepting a diagnosis ("the mutex is wrong") in place of an observable.
- Re-explaining away known noise every round instead of telling them to ignore it.
- Asking for info that wouldn't change your next move.

## Reusable phrasings

- "Test this in order — step 1 is make-or-break, don't do step 3 until step 1 is clean."
- "Which of these did you see?" + a mapped menu.
- "Tell me what it looks like (e.g. 'prompt duplicates', 'text one row lower'), not what you think caused it."
- "This should fix A; B will still look busy — that's separate. Only judge A."
- "If it corrupts the screen: Ctrl+C twice, then `stty sane`. Then tell me the last thing that rendered correctly."
- "Paste/screenshot what you see — for layout bugs that's worth more than any description."
