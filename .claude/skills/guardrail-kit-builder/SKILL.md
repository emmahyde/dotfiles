---
name: guardrail-kit-builder
description: Converts a messy pile of rules — a bloated CLAUDE.md, a backlog of corrections you keep repeating, a team style guide, a Slack thread of "please stop doing X" — into a self-paging guardrail kit that models actually follow. Use this whenever the user wants to (a) shrink or reorganize a CLAUDE.md / AGENTS.md that has grown too long to be reliably obeyed, (b) stop giving the same correction over and over and instead encode it durably, (c) build a checklist/playbook system with per-trigger docs instead of one giant instructions file, or (d) explicitly asks for a "guardrails kit", "routing table + docs", "enforcement doc", or references this pattern by name. Also trigger if the user describes wanting instructions that models will actually comply with rather than skim past, or wants to audit/upgrade an existing kit of this shape.
---

# Guardrail Kit Builder

## What this produces

Not a longer CLAUDE.md. A **small permanent index** (a routing table + a handful of
compressed "iron rules") plus a set of **topic docs** (`docs/guardrails/*.md`) that
only enter context when their trigger actually fires. The index stays small enough
to be read every turn; the docs carry the weight, but only when relevant.

This works because of a few load-bearing mechanisms, not just "split the file up."
Read `references/format-contract.md` before drafting anything — it's the full
line-level contract (word counts, trigger phrasing, ID stability, budgets) that makes
the difference between "a doc the model reads" and "a doc the model complies with."
The short version, so you know what you're building toward:

- **Triggers are observable events**, not topics. "The moment you write a condition
  with `!` and `&&`" fires because the model can pattern-match it mid-generation.
  "When handling booleans" doesn't — nothing observable happens at that moment.
- **Compliance is cited, not asserted.** Every checklist item gets echoed back with
  the evidence line that proves it happened (a command's actual output), not a
  restated intention. A claim with no matching evidence is a fabrication, and the
  contract says so explicitly.
- **IDs are permanent.** Once a rule is `C7`, it's `C7` forever, even after later
  edits — so "cited by ID" stays meaningful across the kit's whole lifetime.
- **Budgets force triage.** CLAUDE.md caps how many iron rules and CAPS hard-stops
  can live at the top level. Adding a 16th iron rule means demoting one to a doc —
  this is what keeps the always-loaded index small instead of regrowing into the
  mess you started with.

## Workflow

### Step 0 — New kit or existing one?

Check for `docs/guardrails/_FORMAT.md` (or wherever the project keeps its contract
doc) in the target project. If it exists, you're upgrading — read it in full before
touching anything, and preserve every stable ID already in use (never renumber,
never reuse a retired ID — see the contract's ID-stability rule). If it doesn't
exist, you're authoring from scratch.

### Step 1 — Ingest the rule corpus

Ask the user for, or read directly:
- an existing CLAUDE.md / AGENTS.md, however messy
- a list of corrections they keep repeating ("stop doing X", "always do Y first")
- style guides, runbooks, postmortems — anything with implicit "when this happens,
  do that" content
- CI/lint config that encodes rules nobody wrote down in prose

Don't ask the user to pre-sort this. Take it as-is and do the sorting yourself in
Step 2 — that's the actual value of this skill.

### Step 2 — Classify every atomic rule

Split the corpus into single, atomic statements (one behavior each — a sentence
doing three things becomes three candidate rules). For each one, decide which of
four buckets it belongs to. This decision is the core judgment call of the whole
skill; get it right and everything downstream is mechanical.

| Bucket | Goes where | Test |
|---|---|---|
| **Iron rule** | CLAUDE.md, compressed to one line + reason | Fires on nearly every task, is short enough to state in ~20 words, and the project cannot afford to page it in only sometimes. Budget: 15 max, total, across the whole kit. |
| **CAPS hard-stop** | CLAUDE.md, ALL-CAPS block | Governs irreversible damage only — data loss, killed shared processes, force-pushed history, leaked secrets. Budget: 5 max. If a rule doesn't protect against something unrecoverable, it is not a hard-stop, no matter how important it feels. |
| **Doc checklist item** | `docs/guardrails/<TOPIC>.md`, ID'd line | Applies only when a specific observable event happens (a test fails, a file is about to be edited, a commit is about to run). This is where most rules belong — the whole point of the kit is that most content lives here, unloaded, until needed. |
| **Reference procedure** | Same doc, below the `--- reference ---` divider, invoked by name from a checklist item | A multi-step subroutine a checklist item points to ("run REFERENCE SWEEP now") rather than a single-line rule itself. Use this for anything that needs more than one line to state correctly. |

A rule that seems to deserve both an iron rule AND a full procedure is usually two
rules: a one-line compressed trigger in CLAUDE.md, and its expansion in a doc — see
`references/format-contract.md`'s note on sanctioned iron-rule/doc pairs.

### Step 3 — Cluster doc-bound rules into topic docs

Group by **shared trigger moment**, not by subject-matter vocabulary. "Before the
first edit of a file" and "before an unfamiliar API call" might both feel like
"coding," but if their evidence and timing differ, they can still share one doc
(most real kits converge on 5-9 topic docs — one per *phase* of work: planning,
implementing, debugging, verifying, wrapping up, plus a couple of cross-cutting ones
like a session/state doc and a project-specific trap list). Don't force-fit the
corpus to those names, though — derive doc names from what's actually in front of
you. `references/worked-example.md` shows the clustering step on a small corpus.

Each cluster becomes one `docs/guardrails/<NAME>.md` file and one row in the
routing table.

### Step 4 — Draft the CLAUDE.md block

Use `references/doc-template.md` for the exact skeleton (routing table, the
"row matched" protocol paragraph, iron rules, CAPS block, and the post-compaction
re-arm line). Keep this block runnable as a literal copy-paste unit — it is
CLAUDE.md's entire "kit zone"; nothing else about the kit belongs there. If the
project already has a `## Project` section with its own conventions, the kit block
sits *around* it per the layout order in `format-contract.md`, never interleaved.

### Step 5 — Draft each doc

Follow `references/doc-template.md`'s per-doc skeleton exactly: version comment,
verbatim-restated trigger as the first line, ID'd checklist, named procedures (if
any), the `--- reference ---` divider, then situational call-outs and at most one
GOOD/BAD example per core rule. Re-check every line against
`references/format-contract.md` as you write it — the contract's F-numbered rules
are exactly the checklist for authoring this kit's own docs, so treat drafting a
doc as its own trigger for reading that reference again.

### Step 6 — Lint before presenting anything

Run:

```
python3 scripts/lint_kit.py <path-to-CLAUDE.md> <path-to-docs/guardrails-dir>
```

This is a deterministic check — line/word budgets, ID uniqueness and prefix
consistency, missing `->`-replacement on prohibitions, dangling routing-table
references to docs that don't exist, and CAPS/iron-rule counts over budget. Fix
every finding before showing the user anything; don't eyeball these by hand; that's
exactly the kind of check that's cheap to get wrong by inspection and cheap to get
right with a script. Re-run after every fix.

### Step 7 — Present and install

Show the user the diff to their CLAUDE.md plus the new/changed files under
`docs/guardrails/`. Call out explicitly which rules you filed as iron vs.
CAPS vs. doc-item vs. procedure, and why — this is the one step where your
classification judgment should be checkable, not just trusted. If this is an
upgrade to an existing kit, bump the version comment on every file you touched and
add one line to that project's migration log (create one if the contract calls for
it and none exists yet).

## When the user wants to iterate afterward

This is a normal skill-creation loop underneath — if the user wants to test the new
kit against real tasks, run a mini before/after (a subagent following the old
CLAUDE.md vs. one following the new kit, on the same prompt) and compare adherence
qualitatively. You don't need the full eval/benchmark machinery for this unless the
user asks for it explicitly; a couple of side-by-side runs is usually enough to show
whether the new kit actually changes behavior.

## Reference files

- `references/format-contract.md` — the full line-level authoring contract (read
  before drafting or editing any kit file; this is the thing that makes the kit
  self-consistent instead of just organized).
- `references/doc-template.md` — literal fill-in-the-blank skeletons for the
  CLAUDE.md block and for one topic doc.
- `references/worked-example.md` — a small GOOD/BAD walkthrough: a raw corpus of
  6 rules classified, clustered, and turned into a CLAUDE.md block + one doc.
- `scripts/lint_kit.py` — deterministic self-check; run it every time, not just at
  the end.
