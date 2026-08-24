# Worked example: 6 raw rules -> one kit slice

## The raw corpus

Pretend this is what the user pasted — six things they keep having to tell an
agent, in no particular order:

1. "Don't ever force-push to main."
2. "When you're about to add a new npm dependency, check if we already have
   something that does this first."
3. "Before merging, make sure the PR actually has a description."
4. "Stop writing try/catch blocks that just log and swallow the error — I want
   to see the real stack trace."
5. "If a test was passing before your change and fails after, don't just delete
   it or loosen the assertion — figure out why."
6. "Always run the linter before telling me you're done."

## Classification (Step 2)

| # | Bucket | Why |
|---|---|---|
| 1 | CAPS hard-stop | Force-pushing shared history is the textbook irreversible-damage case (F4). |
| 2 | Doc checklist item | Fires at a specific moment (about to add a dependency) — not universal enough to be an iron rule, not irreversible enough to be a hard-stop. |
| 3 | Doc checklist item | Fires at a specific moment (about to merge). |
| 4 | Iron rule | Applies to nearly every task that touches error handling, short enough to compress to one line, and letting it live only in a rarely-triggered doc would mean it gets silently ignored on the other 90% of edits where it also applies. |
| 5 | Doc checklist item, plus a reference procedure | The one-line version fires on a specific event (a previously-green test goes red); the "figure out why" part is multi-step, so it becomes a named procedure the checklist item points to. |
| 6 | Iron rule (compressed) + doc rule (expanded) | Sanctioned pair per F7: short enough to compress ("run the linter before saying done"), but "before you write done/fixed/works" is also exactly the kind of moment a VERIFY-style doc already owns, so the full form (with the fabrication rule, evidence citation, etc.) lives there and CLAUDE.md carries only the compressed pointer. |

## Clustering (Step 3)

Rules 2 and 3 both fire "before you commit to a piece of work being ready to ship
or merge" — but they're different moments (adding a dependency happens mid-task;
checking the PR description happens at the very end), so they land in different
docs: rule 2 joins a `PLAN.md`-style doc (decisions made before writing code),
rule 3 and rule 6's expanded form join a `VERIFY.md`-style doc (checks made before
declaring done). Rule 5 gets its own line in a `DEBUG.md`-style doc, since "a test
that used to pass now fails" is a debugging trigger, not a verify-at-the-end one.

## Output

**CLAUDE.md kit zone (excerpt):**

```markdown
## Routing — the moment X happens, your next tool call is Read on the doc
| The moment you... | Read |
|---|---|
| are about to add a new dependency the task didn't already require | docs/guardrails/PLAN.md |
| are about to say the task is done, or run a merge | docs/guardrails/VERIFY.md |
| see a previously-passing test fail after your change | docs/guardrails/DEBUG.md |

## Iron rules
- Never write a catch block that only logs and swallows the error (hides the real failure from whoever debugs it next).
- Before writing "done" or merging: run the linter — full form in VERIFY.md V1 (silent lint failures ship broken code).

## Hard stops
- NEVER force-push to a shared branch -> instead: open a PR from a new branch and ask (force-push overwrites history others may depend on).
```

**`docs/guardrails/PLAN.md` (excerpt):**

```markdown
<!-- kit: v1.0 | Editing this file? Read docs/guardrails/_FORMAT.md first. -->
You are here because you are about to add a new dependency the task didn't
already require.

Echo protocol: `P<n>: PASS — <what you checked> -> <what you found>` / `FAIL` /
`N/A — <reason>`.

- P1. Grep the codebase and check installed packages for existing coverage of
  this need before adding anything new (a redundant dependency is dead weight
  the moment it lands).
```

**`docs/guardrails/VERIFY.md` (excerpt):**

```markdown
<!-- kit: v1.0 | Editing this file? Read docs/guardrails/_FORMAT.md first. -->
You are here because you are about to say the task is done, or run a merge.

Echo protocol: `V<n>: PASS — <command> -> <quoted output line>` / `FAIL` /
`N/A — <reason>`. A PASS with no quoted output is a FAIL.

- V1. Run the linter; quote its exit status and summary line before saying done
  (an unrun lint step is not a passed one).
- V2. Merging a PR? Confirm it has a non-empty description before merging (an
  empty description is a FAIL, not a thing to fix later).
```

**`docs/guardrails/DEBUG.md` (excerpt):**

```markdown
<!-- kit: v1.0 | Editing this file? Read docs/guardrails/_FORMAT.md first. -->
You are here because a previously-passing test fails after your change.

- D1. Run REGRESSION TRACE (below) before touching the test file itself.

## REGRESSION TRACE (named procedure — invoked by D1)
- D1a. Diff what your change actually altered against what the failing test
  exercises; find the line that connects them.
- D1b. State the mechanism in one sentence before editing anything.

--- reference ---

## You are tempted to loosen the assertion or delete the test
Don't. A previously-green test going red after your change means either your
change broke real behavior, or the test encoded an assumption your change
correctly invalidates — both require understanding which, not silencing the
signal. See REGRESSION TRACE above.
```

Notice what didn't happen: nobody wrote a paragraph. Every line is one rule, one
trigger, one piece of evidence to cite. That's the whole mechanism.
