# Worked example: a Rails model as a plain-text doc

The source is `app/models/medusa/work_unit.rb` in groot — a model whose behavior is mostly encoded
in long comments, which is exactly the case where a diagram earns its keep. Everything below is
Tier B, capped at 100 columns, with the badge gutter in bracketed-tag form so it survives a paste
into a code comment.

## What a work unit is

*legend* — `┏ actor ┓` a model object, `┌ step ┐` a method you can call, `( event )` something the
system observes, `* ` a line of narration that is mine, not the code's.

These are ORM models, so they could be drawn either as objects or as tables. This doc is about
objects calling each other, so heavy boxes carry them throughout and the shelf shape never appears.

```
      ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
      ┃ Medusa::Batch              ┃
      ┃  * one job you kicked off  ┃
      ┗━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┛
                   ┃ has many
                   v
      ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
      ┃ Medusa::WorkUnit           ┃
      ┃  * one item on the list    ┃
      ┗━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┛
                   ┃ has many, newest first
                   v
      ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
      ┃ Minion                     ┃
      ┃  * one attempt at it       ┃
      ┃  * current_minion is the   ┃
      ┃    newest attempt only     ┃
      ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

In plain terms: a **batch** is the whole job, a **work unit** is one item of work in it, and a
**minion** is one attempt at that item. Retry an item and you get a second minion; the work unit
always speaks for its newest one and ignores the rest.

A unit needs a repository to work in. It can carry its own, and if it does not, it falls back to the
batch's — `effective_repo_id()`. A unit with neither is rejected before it is ever saved, by
`repo_resolvable`.

## The two questions a work unit answers

Every method on the model is one of these two questions, so read them as a pair.

```
 [q1]  ┌────────────────────────────┐        [q2]  ┌────────────────────────────┐
       │ where is this up to?       │              │ may it start yet?          │
       │  * status()                │              │  * dependencies_satisfied? │
       │  * medusa_phase()          │              │  * eligible?               │
       └────────────────────────────┘              └────────────────────────────┘
```

## Where is this up to

`status()` is a three-rung ladder, checked top to bottom, first hit wins.

```
 [wt]  ┌────────────────────────────┐
       │ "blocked"                  │
       │  * something it depends on │
       │    is not done yet         │
       └─────────────┬──────────────┘
                     │ deps clear
                     v
 [na]  ┌────────────────────────────┐
       │ "pending"                  │
       │  * allowed to start, but   │
       │    nobody has started it   │
       └─────────────┬──────────────┘
                     │ a minion exists
                     v
 [rn]  ┌────────────────────────────┐
       │ the minion's own phase     │
       │  * planning, coding,       │
       │    watching_pr, merged...  │
       └────────────────────────────┘
```

`medusa_phase()` is the same answer rounded off for the board — it hands the minion's fine-grained
phase to `Medusa::Phase.category_for` and gets back a coarse bucket, and it says `"queued"` where
`status()` says `"pending"`.

### Three finish lines, one meaning

```
 [ok]   merged  ─┐
 [ok]  completed ─┼──> satisfied?  *  as far as dependents care, this unit is done
 [ok]  manually_ ─┘
       completed
```

`merged` is the real one. `completed` is a unit that finished without a merge. `manually_completed`
is a human closing it out by hand. Nothing downstream distinguishes them: `satisfied?` is the only
question anything else asks.

## Does a pull request exist for it

*legend* — `<>` a gate: the condition, then its answers on the branches.

```
 <> current_minion.phase is...
    │
    ├── nil ──────────────────────────────────> no
    │
    ├── "opening_pr" ─────────────────────────> only if pr_url is filled in
    │       * the phase flips before GitHub answers, so the phase
    │         name alone would lie for a few seconds
    │
    ├── watching_pr, merged, completed,
    │   manually_completed ───────────────────> yes  (PR_OPEN_PHASES)
    │
    └── anything else, incl. failed/stopped ──> no
```

The awkward case is `opening_pr`, and it is worth understanding because it is the one thing a
reader would get wrong from the phase names alone. The minion enters `opening_pr` before GitHub has
actually created the pull request; `pr_url` is stamped one line before the phase moves on. So for a
brief window the phase says "opening" and no PR exists. `pr_opened?` therefore special-cases that
one phase and asks for the URL instead.

`failed` and `stopped` are never a yes. There may well be a pull request sitting on GitHub, but it
belongs to an abandoned branch, and the whole point of the question is "is there a branch worth
building on".

## May it start yet

This is the interesting half. A unit that depends on nothing starts immediately. A unit with
dependencies waits — but *how long* it waits depends on the batch's strategy.

*legend* — `┌ step ┐` a check, `<>` a gate, `╭┈ note ┈╮` a consequence I am asserting.

```
       ┌────────────────────────────┐
       │ dependencies_satisfied?    │
       └─────────────┬──────────────┘
                     │
 <> does it depend on anything at all?
    │
    ├── no ───────────────────────────────────> yes, start
    │
    └── yes
         │
         ├── are all of them satisfied? ──────> yes, start
         │
         └── no, and the batch strategy is...
              │
              ├── merge_before_start ─────────> wait
              │
              └── stacked_prs ────────────────> stack_on_blocker()
```

### The stacking rule

Under `stacked_prs`, a unit may start early by branching off a blocker that has not merged yet,
rather than waiting for the merge. Four conditions, all required, and each exists to prevent one
specific failure.

```
 <> stack_on_blocker()
    │
    ├── [1] exactly one blocker still outstanding?
    │        * you can only fork from one branch. Two open blockers means no single
    │          branch carries both their changes, so it waits like merge_before_start
    │
    ├── [2] that blocker has a PR open?          (pr_opened?)
    │        * no PR means no branch worth building on
    │
    ├── [3] same repository?                     (repo_id or the batch's)
    │        * the blocker's branch does not exist in another repo, so provisioning
    │          would hard-fail at `git checkout -b $BRANCH origin/$BASE`
    │
    └── [4] that blocker's minion has a branch name?
             * without one there is nothing to fork from, and starting anyway would
               silently build off the repo default, missing the blocker's code

    all four  ─> return the blocker, and the unit starts on its branch
    any fail  ─> return nothing, and the unit waits for the merge
```

The same method answers two questions that look different and are not: "may this unit start early?"
and "off which branch?". Splitting them is the bug this design avoids — a unit released early with
no base branch would build off the repo default without the blocker's code, which is precisely the
drift stacking exists to prevent.

```
 ╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈╮
 ┊ stacking changes when work starts, never when the batch is finished ┊
 ┊ both orchestrators still gate completion on satisfied?              ┊
 ╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈╯
```

## What happens when a minion finishes

*legend* — lanes name who executes the step; the flow re-entering an earlier lane is a round trip.

```
  Minion              │ WorkUnit                    │ Batch
 ─────────────────────┼─────────────────────────────┼──────────────────────
  reaches a           │                             │
  terminal phase      │                             │
        │             │                             │
        └────────────>│ on_minion_terminal()        │
                      │      │                      │
                      │      ├─> emit an event      │
                      │      │   * satisfied /      │
                      │      │     failed /         │
                      │      │     finalized        │
                      │      │                      │
                      │      └─────────────────────>│ evaluate()
                      │                             │  * re-checks every
                      │                             │    unit, releases
                      │                             │    whatever is now
                      │                             │    unblocked
```

Which event fires is decided by the minion's final phase: merged, completed, or manually_completed
emit `work_unit.satisfied`; failed or stopped emit `work_unit.failed`; anything else emits
`work_unit.finalized`.

There is a quieter path too. Any board-visible change calls `on_minion_board_change`, which just
touches the unit — and because the unit `touch`es its batch, the batch's cached view invalidates and
the UI refreshes.

## Notes

- The model holds no state of its own about progress. Every status question is delegated to
  `current_minion`, which is simply the newest minion by `created_at`. Older attempts are still on
  the record and are ignored by every reader.
- `dependencies_satisfied?` is memoized per strategy for the life of the object, not per call. Both
  orchestrators reload the batch inside their lock, and the memo is keyed on the strategy so that a
  reload cannot leave a stale answer behind. A caller that needs a fresh answer after a blocker
  changed re-selects the unit rather than calling again.
- Self-referencing and dangling dependency edges are dropped when blockers are collected, so neither
  can hold a unit back forever. Self-edges are also rejected at graph build time.
- `eligible?` is narrower than `dependencies_satisfied?`: it additionally requires that the unit has
  **no minions at all**. It answers "should this be dispatched for the first time", not "may this
  run".
- Deliberately not drawn: the phase-level machinery inside a minion. Post-PR triage, fix, and
  conflict cycles all run as phase rows while the minion's own phase stays at `watching_pr` — from a
  work unit's point of view that is one state, and drawing it here would imply the unit can see
  inside.
