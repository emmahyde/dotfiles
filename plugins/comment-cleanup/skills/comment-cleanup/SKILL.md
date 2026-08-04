---
description: Aggressively prune comments from source code so that every remaining comment delivers information the reader cannot get from the code itself. Use whenever the user asks to clean up, prune, strip, audit, minimize, or "make professional" the comments in a file; whenever they mention "AI-flavored," "AI-generated," "narrating," "obvious," or "noisy" comments; whenever they ask for a code review focused on comment quality; or any time they hand over code (especially LLM-generated code) and ask for it to look like it was written by an experienced engineer. ALSO invoke this skill proactively — without waiting for the user to ask — after you write or edit source code that adds or modifies comments, and before declaring the task complete, staging a commit, or opening a PR. If a `PostToolUse` system-reminder flags that an Edit/Write touched comment lines, scope this skill to the code you changed and the comments attached to it — read the surrounding block for context so you can judge each comment fairly (and catch ones your change made stale), but do NOT refactor comments on pre-existing code you did not touch (a brand-new file you wrote is entirely yours, so audit all of it). If you are mid-task with unfinished deliverables (more files to write, a multi-step generation in progress), finish primary work first and apply cleanup as a final step before returning your result — do not abandon unfinished work to run comment cleanup. Go further than simply deleting tutorial-style comments — apply a strict "earn-your-place" doctrine where the default action is DELETE and a comment must clear a specific bar to survive.
---

# Comment Cleanup

## Core Doctrine

**The default action for any comment is DELETE.** A comment is dead weight unless it gives the reader something the code alone cannot. The reader is a competent engineer who can read the language. Do not insult them by translating syntax into English.

Code says _what_. A good comment says _why_, _what-not_, or _watch-out_ — never _what_.

This skill is stricter than the typical "remove AI comments" rule. Pruning tutorial-style narration is the floor, not the ceiling. Hold every surviving comment to the bar in the Survival Test below. When in doubt, delete.

## The Survival Test

A comment survives if and only if it answers **yes** to at least one of these:

1. **Does it explain a _why_ that the code cannot show?** Business rules, historical context, a decision that looks weird but is correct, a tradeoff that was considered and rejected.
2. **Does it warn about a non-obvious consequence?** Side effects, ordering constraints, thread-safety assumptions, performance cliffs, off-by-one boundaries chosen on purpose.
3. **Does it point to something outside the file?** A spec, RFC, bug ticket, paper, datasheet section, regulatory citation, vendor quirk.
4. **Is it a public API contract?** A docstring/JSDoc on an exported function, class, or module that documents inputs, outputs, errors, and invariants for callers who shouldn't have to read the body.
5. **Is it an actionable marker?** `TODO`/`FIXME`/`HACK`/`XXX` with enough detail to act on (ideally a ticket reference).
6. **Does it disambiguate something genuinely ambiguous?** Units on a bare number (`timeout_ms`), the meaning of a magic constant whose name can't carry it, the reason an empty `catch` is intentional.

If the answer to all six is no, **delete the comment**.

## What to Delete (Non-Exhaustive)

Apply these categories aggressively. They cover the common cases, but the Survival Test above is the authority — if a comment doesn't match a category below but still fails the test, delete it anyway.

### 1. Narrators

Comments that announce a construct the reader can see.

- `// loop through users`
- `// constructor`
- `# main function`
- `// end of if block`

### 2. Translators

Comments that restate the line in English.

- `i++  // increment i`
- `return result  // return the result`
- `users = []  // empty list of users`
- `# set name to "Alice"`

### 3. Tutorial Steppers

Numbered or phased narration of ordinary control flow.

- `// Step 1: parse input`
- `// Step 2: validate`
- `# --- Phase 3: write output ---`
- Section banners like `# ==== HELPERS ====` inside a small file.

### 4. Redundant Docstrings

Docstrings that only restate the function signature.

```python
def add(a: int, b: int) -> int:
    """Adds a and b and returns the result."""   # DELETE — signature already says this
    return a + b
```

A docstring earns its place by documenting _contract_ (errors raised, invariants, edge cases, units, ownership), not by paraphrasing the name.

### 5. Changelog Graffiti

- `// Added by Jane 2019-04-02`
- `// Fixed bug here`
- `// Refactored from old version`
- `// NEW: now supports unicode`
  Version control owns this history. Delete.

### 6. Commented-Out Code

Dead code in a comment. Delete it. If it might come back, that's what git is for. Exception: a _tiny_ alternative explicitly labeled as such for a documented reason (extremely rare).

### 7. Decorative Noise

- ASCII separators (`// ============`)
- Boxed headers (`/***** UTILITIES *****/`)
- `// ---` between every two functions
  Whitespace already separates things. Visual clutter goes.

### 8. Apologies and Self-Talk

- `// not sure if this is right`
- `// hacky but works`
- `// TODO: clean this up later` _with no specifics_
- `// I think this handles the edge case`
  Either fix it, file a ticket with specifics, or delete the comment. Vague self-doubt isn't documentation.

### 9. Stale or Lying Comments

A comment that contradicts the current code is worse than no comment — it actively misleads. If you find one while pruning, either correct it (only if it would then pass the Survival Test) or delete it.

### 10. Empty Placeholders

- `// TODO: implementation` above code that is already implemented
- `/* your code here */` left in
- `// ...` as filler

## What to Keep — and How to Sharpen It

Comments that pass the Survival Test stay, but consider whether they can be tightened:

- **Cut hedging.** "This might be because..." → state it or delete it.
- **Cut narration of the next line.** A _why_ comment should explain rationale, not preview the syntax below it.
- **One line. Always try for one line.** If a _why_ won't fit on one line, link to a ticket, RFC, or design doc instead of paraphrasing it in source. Multi-line prose is reserved for public API docstrings — and even those should be terse.
- **Prefer linking over re-explaining.** `// See RFC 7231 §6.5.1` beats two paragraphs paraphrasing the RFC.
- **Co-locate with the surprising line, not the obvious one.** The comment goes on the line a reader would stop and squint at.
- **Use the full word instead of niche acronyms.** This is a word-choice rule, not a deletion rule — a comment that earns its place stays. The question is _how_ to write it. Industry-standard acronyms (`HTTP`, `JSON`, `RFC`, `SQL`, `API`, `UUID`, `CSV`, `TLS`, `OAuth`, and the like) are fine as-is. For internal, team-specific, or domain-specific acronyms that a reader from a neighboring team would not recognize, write the full word instead. Don't add explanatory links, parenthetical expansions, or glossary asides — just use the plain English term. Examples: `// retry on TPS rejection` → `// retry on transaction-processing rejection`; `// gate on AA` → `// gate on adoption agreement`; `// regen SPD` → `// regenerate the summary plan description`. **The trap is familiarity:** an acronym that feels obvious to you after working in this code is exactly the one a neighboring-team reader won't know — expand it. **Acronyms also hide inside compound or hyphenated labels:** `defer-AA` reads like a feature name, but the embedded `AA` is still a niche acronym — expand it too. Use judgment on what counts as widely known; if in doubt, spell it out.

### Examples of comments that earn their place

```python
# Vendor returns 200 + empty body on rate-limit, not 429.
for attempt in range(MAX_RETRIES):
    ...
```

```javascript
// IE11: event.target is the inner <span>, not the <button>.
let el = event.target;
while (el && !el.dataset.action) el = el.parentElement;
```

```go
// Lock order: accounts before ledger. See INC-4421.
a.mu.Lock()
```

```python
timeout_s = 0.25   # upstream p99 budget is 300ms
```

Each is one line. Each says something the code cannot. If you can't get a _why_ comment to one line, the _why_ probably belongs in a linked ticket, not in the source.

## Self-Invocation After Writing Code

When this skill fires because _you_ (Claude) just wrote or edited code — not because a human handed you a file to audit — use the fast lane below instead of the full workflow. The goal is to scrub your own freshly added comments before declaring done.

1. **Scope to what you changed — with its context.** Run `git diff` (or inspect the Edit/Write tool inputs). Your scope is the code you added or changed **plus the comments that document it** — a comment directly above or inside a block you edited is in scope even if that exact line wasn't a `+`. Read the enclosing block or function so you judge each comment against what the code now does. Out of scope: comments attached to code you did not touch elsewhere in the file — leave them alone even if they fail the Survival Test. **A brand-new file you just wrote is entirely in scope** — every line is yours, so audit all of it; the "don't widen to the whole file" rule exists only to protect pre-existing code you didn't write, and a new file has none.
2. **Apply the Survival Test to each in-scope comment.** Default to DELETE. Also catch comments your change made **stale or lying** — if you altered the code a nearby comment describes, fix or delete that comment. If a comment passes, keep it; tighten to one line where possible. **Then scan each survivor for niche or domain-specific acronyms and expand them to plain words** (see "Use the full word instead of niche acronyms" under _What to Keep_). This word-choice pass is easy to skip once a comment already earns its place and fits one line — but the acronym that feels obvious to you after working in this code is exactly the one a neighboring-team reader won't know, so it needs the same scrutiny as the delete decision.
3. **Re-Edit the file** targeting only the in-scope lines. Do not leave AI-flavored narration, tutorial steppers, or changelog graffiti in code you just produced. Do not widen the edit into unrelated blocks.
4. **Then declare the task done / stage the commit / open the PR.** The cleanup runs _before_ you say "done," not after.

### Reporting (self-invocation only)

When this skill fires on your own freshly written code, keep the output to **one line**. The user is reading for your primary answer, not a cleanup report — verbose per-comment rationale buries the response they came for.

- Emit a single summary line: `Pruned N comments (2 narrators, 1 stale).` Nothing more.
- Do **not** print per-comment reasoning, before/after blocks, quoted deleted lines, or a bulleted breakdown.
- If nothing was pruned, say `No comment cleanup needed.` on one line — or fold it into your normal closing sentence.
- This limit applies only to the self-invocation fast lane. Audit Mode (user handed you a file) may explain its cuts as usual.

**Subagent / multi-step task exception:** If you are a spawned subagent with unfinished deliverables (more files to write, more steps to complete in your assigned task), do **not** stop mid-task to run comment cleanup. Finish all primary deliverables first. Apply cleanup only on your final edit, or skip it and let the orchestrating session handle it. Never return a cleanup summary as your result when the caller expected file paths, data, or other deliverables.

If nothing in scope contains comments, the skill is a no-op — say so and move on.

## Workflow (Audit Mode)

Use this longer workflow only when the user explicitly hands you an **existing** file to audit. Do not promote a self-invocation to Audit Mode based on diff size — a large diff, or a whole new file you just wrote, still uses the fast lane scoped to what you wrote. (Auditing every line of a new file is the fast lane doing its job, not Audit Mode — Audit Mode is what touches pre-existing comments you didn't write.)

1. **Read the whole file first.** You cannot judge a _why_ comment without understanding the code's purpose. Skim end-to-end before touching anything.
2. **Pass 1 — obvious deletes.** Remove narrators, translators, tutorial steppers, changelog graffiti, decorative noise, commented-out code, empty placeholders. These almost never need a judgment call.
3. **Pass 2 — apply the Survival Test.** For each remaining comment, ask the six questions. If all are _no_, delete. If yes, consider whether the comment can be sharpened (shorter, more specific, linked instead of paraphrased, and niche or domain-specific acronyms expanded to plain words).
4. **Pass 3 — check for lies.** Read each surviving comment against the code it sits next to. If they disagree, the comment is wrong; fix it or delete it.
5. **Pass 4 — docstrings.** For each public function/class/module, ensure the docstring documents _contract_ (inputs, outputs, errors, units, invariants) and isn't just paraphrasing the signature. Trim or rewrite as needed. Private/internal helpers usually don't need docstrings at all.
6. **Cleanup.** Remove resulting double blank lines, trailing whitespace, and any now-empty comment blocks (`/** */`, `"""\n"""`, etc.).
7. **Sanity check.** The file should now read faster and feel denser. If you deleted something a teammate would have needed, you cut too deep — restore it in tighter form.

## Calibration: How Aggressive?

By default, be aggressive. A typical LLM-generated file loses 60–90% of its comments under this skill and reads better for it. A typical hand-written file from a careful engineer loses far less — they already passed something like the Survival Test in their head.

If the user signals a softer touch ("light pass," "just the worst offenders"), stop at Pass 2 and skip rewriting docstrings. If they signal a harder one ("ruthless," "I want this to look like senior-engineer code"), also question whether each surviving docstring is really needed on a private helper.

When unsure about a specific comment, **delete it and move on** — the user can ask to restore anything they wanted kept. The cost of an over-deletion is one round-trip; the cost of leaving noise is that the doctrine fails.

## Before and After

**Before — typical LLM output:**

```python
# Import required libraries
import datetime
import json

# Configuration constants
MAX_RETRIES = 3  # Maximum number of retries
TIMEOUT = 30  # Timeout in seconds

# Function to fetch user data from the API
def fetch_user(user_id):
    """
    Fetches a user.

    Args:
        user_id: The user ID.
    Returns:
        The user.
    """
    # Step 1: Build the URL
    url = f"https://api.example.com/users/{user_id}"
    # Step 2: Make the request with retries
    for attempt in range(MAX_RETRIES):  # Loop MAX_RETRIES times
        try:
            # Try to make the request
            response = make_request(url, timeout=TIMEOUT)
            return response.json()  # Return parsed JSON
        except TimeoutError:
            # Handle timeout
            continue  # Try again
    # If we got here, all retries failed
    raise RuntimeError("Failed to fetch user")  # Raise an error
```

**After — every comment earns its place:**

```python
import datetime
import json

MAX_RETRIES = 3
TIMEOUT_S = 30

def fetch_user(user_id):
    url = f"https://api.example.com/users/{user_id}"
    for attempt in range(MAX_RETRIES):
        try:
            response = make_request(url, timeout=TIMEOUT_S)
            return response.json()
        except TimeoutError:
            continue
    raise RuntimeError("Failed to fetch user")
```

Notice what survived: nothing. The function is short, names are clear, the renamed `TIMEOUT_S` carries its unit, and the retry pattern is idiomatic. A comment here would have to _add_ something — a vendor quirk, an SLO budget, a deadlock note — and there isn't one to add.

Now contrast with a version where a _why_ comment genuinely earns its place:

```python
def fetch_user(user_id):
    url = f"https://api.example.com/users/{user_id}"
    # Vendor rate-limits with 200 + empty body, not 429. See INC-3320.
    for attempt in range(MAX_RETRIES):
        try:
            response = make_request(url, timeout=TIMEOUT_S)
            data = response.json()
            if data:
                return data
        except TimeoutError:
            pass
    raise RuntimeError("Failed to fetch user")
```

One line. Unguessable from the code. Linked to the ticket. That earns its place.

## Final Reminder

Default to delete. The bar is not "is this comment OK?" but "would removing this comment lose information the reader needs?" Most of the time, the answer is no.
