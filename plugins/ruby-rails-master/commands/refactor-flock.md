---
description: "Apply Sandi Metz's Flocking Rules to two or more similar pieces of code. Mechanically refactor toward a shared abstraction in small, test-passing steps."
argument-hint: "<file or paths to similar code>"
---

# /refactor-flock

Apply the Flocking Rules step-by-step on two or more similar chunks of code:

1. Find things that are most alike.
2. Find the smallest difference between them.
3. Make the smallest change that removes that difference.

Repeat until the abstraction emerges.

## What to do

1. **Identify the candidates.**
   - From `$ARGUMENTS`: the file or paths to look at.
   - If unclear, ask the user to point at the methods or scan for `case` statements / repeated branches.

2. **Confirm tests cover the affected behavior.** If not, write characterization tests first.

3. **Spawn the `oo-refactorer` subagent** with the goal: apply Flocking Rules.

4. The agent will:
   - List the candidate similar chunks side-by-side.
   - Identify the most-alike pair.
   - Make one small change to remove the smallest difference.
   - Run tests; confirm green.
   - Repeat.
   - Stop when the chunks are identical (and consolidated) or when the next step would be speculative.

5. **Render the trail.** Each step:
   - Step number and what changed.
   - A diff block.
   - "Tests pass."

6. **Summarize.** What abstraction emerged? What's the final code shape? Did a class want to come out (e.g. a `BottleNumber` from helpers that all take the same `n`)?

## See also

- The walkthrough in `skills/sandi-metz-design/flocking-walkthrough.md` shows the full procedure on the canonical 99 Bottles example.
- The smells catalog in `skills/clean-code-and-refactoring/smells-catalog.md` for spotting refactoring opportunities.

## When to refuse

- Only one chunk to refactor — there's nothing to flock against. Suggest waiting for the second use case.
- The chunks are identical already — extract a method, no flocking needed.
- The chunks share *no* structure — they're just unrelated; no abstraction to find.
