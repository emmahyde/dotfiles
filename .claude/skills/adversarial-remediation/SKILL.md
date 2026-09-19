---
name: adversarial-remediation
description: Two-stage review. Stage 1 runs a critique-only adversarial pass over a diff, PR, plan, or spec. Stage 2 collapses the resulting findings into root-cause groups, each with an idiomatic fix backed by precedent that already exists in this codebase, then one recommended sequencing split into pre-merge and follow-up. Use this whenever a review has produced more findings than anyone wants to fix one at a time — a bot review, an adversarial pass, a long PR-comment thread, a security audit, a list of P1s, a red-team report. Trigger on "adversarial review", "red-team this", "poke holes in this", "pressure-test this", and equally on "how do we address these", "what is the elegant way to fix these", "theorize about these findings", "collapse these findings", "group these by root cause", "is there one change that fixes several of these", "what is the idiomatic fix", or any moment a findings list has to become a plan. Prefer this over the adversarial-review skill whenever the user wants the fix path and not only the critique — adversarial-review stops at the critique by design. Stage 2 runs alone against a findings list the user already has, so invoke this skill even when no critique pass is needed.
---

# Adversarial Remediation

Two stages with a hard boundary between them.

- **Stage 1** attacks the work and produces findings. It suggests nothing.
- **Stage 2** converts findings into a fix path. It proposes nothing it has not grounded in the repo.

Run stage 1 alone when the user wants critique. Run stage 2 alone when findings already exist. Run both when the user wants a review and a plan.

## Why the boundary matters

A reviewer that offers fixes stops finding problems. The moment a critic imagines a repair, it starts grading the repair instead of hunting the next weakness, and the critique gets shallower. So stage 1 forbids suggestions.

The reverse failure is worse. A remediation pass that inherits the review's own ordering — by severity, by file, by comment thread — produces a task list, not a design. The findings list is a symptom list. Symptoms are not the unit of work.

## Stage 1 — the critique pass

### Prompt template

```
ADVERSARIAL DESIGN REVIEW of [document or diff description]. Challenge every
assumption, design choice, and tradeoff. Question whether [key architectural
claim] is the right approach. Scrutinize [comma-separated concern domains].
Output ONLY the critique — no suggestions, no fixes, no praise. Rank findings
by severity. Group findings by category. Cite specific file:line for each
finding.
```

Fill the brackets:

- `[document or diff description]` — what is under review.
- `[key architectural claim]` — the central thesis to attack.
- `[concern domains]` — the areas to scrutinize.

Common concern domains: execution and lifecycle, ownership boundaries, authorization and confidentiality, serialization contracts, data flow direction, concurrency, error handling, schema and index coverage, page decomposition, regression coverage, rollout safety.

### Choosing the target

For a pull request, review the whole diff against the merge base, not only the most recent commits. A review scoped to the last two commits misses everything the branch introduced earlier. Get the base with `git merge-base origin/main HEAD`, then diff against it.

### Running it

1. Route to a capable model. `codex exec "<prompt>" < document.md` works inside a git repository. A subagent on the strongest available model also works.
2. Run it in the background when the target is over 50 lines.
3. Return the output verbatim. Never paraphrase or summarize a finding.
4. Write the result to `~/llmwiki/reviews/adversarial-review-<slug>-<YYYY-MM-DD>.md` with the date, the model, the source path, the exact prompt, and every finding. Tag it `#adversarial-review`.

### Two things that go wrong

- **Duplicated output.** Streamed critique sometimes repeats itself. Check the line count against the finding count before you save.
- **Invented citations.** A model reviewing a large diff cites paths that do not exist. Treat every `file:line` as a lead, not an address. Confirm the path before you build on the finding.

## Stage 2 — collapse findings into causes

The deliverable is a design discussion, not an implementation. Do not edit code during stage 2. The user is deciding what to build, and premature edits foreclose that decision.

### Step 1 — reject the finding count as the unit of work

Say so plainly in the first sentence. "39 findings is the wrong unit of work" is the opening move, because it reframes the task from triage to diagnosis. Thirty findings usually carry five or six causes. One cause fixed at the right layer removes several findings at once.

### Step 2 — read the repo before you propose anything

The point of this skill is a fix that is idiomatic **here**, not idiomatic in the abstract. That distinction only survives if you read the code. Run the investigation in batches, and search for four things:

- **Machinery already present and unused.** A declared state machine whose bang methods nobody calls. Columns a gem would fill automatically if the code stopped hand-writing them. A base class with one subclass. This is the highest-value discovery available, because it makes several findings much cheaper than the review implied. Search the schema and the model declarations against each other.
- **Sibling implementations of the same shape.** Another reconciler, another single-table-inheritance column, another snapshot column, another service object with the same result struct.
- **The comment that already explains the decision.** Code that looks wrong is sometimes documented as deliberate. Read the comment before you call it a defect.
- **What the review got wrong.** A finding's diagnosis can be right while its proposed direction is wrong. Say which.

### Step 3 — group by cause, and name the cause as a sentence

Each group's heading states the shared mistake, not the subsystem. "Liveness is inferred, never asserted" is a cause. "Workers" is a directory.

Rules that keep the grouping honest:

- Every finding lands in exactly one group, or appears in an explicit list of findings you are not addressing, with a reason. A collapse that silently drops findings is worse than the original list.
- No group is called "misc". If findings do not share a cause, they are separate findings, and you say so.
- Record the count each group swallows. It is the evidence that the grouping earns its keep.

### Step 4 — attach an in-repo precedent to every group

This is the load-bearing step. For each group, give three things:

1. **The findings it swallows** — with counts, and the specific high-severity ones by name.
2. **The idiomatic move** — one paragraph. What changes, and what stops existing.
3. **The precedent that makes it idiomatic here** — a real file in this repo that already does the thing.

A proposal with no in-repo precedent is a rewrite wearing a convention costume. If a group genuinely has no precedent, say that plainly and mark it as a new convention with the cost that carries. Honest beats invented.

Two heuristics for whether the layer is right:

- **The dissolution test.** If the fix makes a finding stop existing rather than get patched, the layer is right. Name that when it happens — it is the strongest signal available that the grouping found the real cause.
- **Deletion counts as a fix.** Some groups resolve by removing code: a broad rescue that opts out of the queue's retry, a guard that duplicates a validation, a hand-maintained column that shadows a generated one. Say "the fix is deletion, not addition" out loud, because the default pull is to add.

### Step 5 — recommend one sequencing, and split it

Give one order, with reasons. Do not survey alternatives you will not pursue.

Split it explicitly:

- **Pre-merge** — usually the small, mostly-deletion groups, and anything closing a confidentiality or data-loss finding.
- **Follow-up** — schema changes, model redesigns, anything that would make an already-large diff unreviewable.

Say why each item sits where it does. "Three schema changes on a surface with no production users yet, which is the cheapest this will ever be" is a reason. "Nice to have" is not.

### Step 6 — mark verified against proposal, and name the disagreement

- State which claims you confirmed against source and which are proposal. The reader is about to spend a week on this.
- Correct your own earlier reasoning when the code contradicts it. A wrong premise carried into a plan costs more than the correction.
- Raise the concern the plan itself creates, then keep the plan. If the branch should merge before any of this happens, say so.
- Close by naming the one or two groups where a reasonable engineer would disagree with you. That is where the real conversation starts, and pretending to consensus wastes the user's turn.

## Output template

Prose, not a table. Findings lists are already tables, and the value added here is the reasoning.

```markdown
[One paragraph: the finding count is the wrong unit, and the count of causes.]

[One paragraph, if it applies: the machinery already present that reframes
several findings as cheaper than stated. This goes near the top because it
changes how the reader reads everything below.]

## A. [The cause, as a sentence]

*Swallows ~N findings, including [the named severe ones]*

[What the shared mistake is, across the specific call sites.]

[The idiomatic move. What changes, what stops existing.]

[The in-repo precedent, by path.]

[Optional: the dissolution test firing, or "the fix is deletion".]

## B. ... (repeat per cause)

---

**What I would actually do.** [One sequencing. Pre-merge set with reasons.
Follow-up set with reasons and order.]

[The pushback the plan deserves.]

[Where reasonable people would disagree.]
```

## Failure modes

- **Grouping by severity or by file.** That reproduces the review's ordering and adds nothing.
- **Proposing a pattern with no precedent in the repo.** Idiomatic in the abstract is not the deliverable.
- **Inflating scope.** A review-fix branch does not become a data-model redesign without the user choosing that. Offer the redesign as sequenced follow-up work and let them scale it down.
- **Losing findings in the collapse.** Coverage is checkable. Check it.
- **Starting to implement.** Stage 2 ends with a recommendation. The user decides.
- **Surveying options.** One recommendation with its reason, then the named disagreement.

## Reference

`references/worked-example.md` holds a complete stage-2 output for a real case: 41 findings on a Rails pull request collapsed to six causes, each with its in-repo precedent, and a pre-merge versus follow-up split. Read it when you want to see the register and the level of grounding, especially the "machinery already present" opening and the dissolution test firing in group C.
