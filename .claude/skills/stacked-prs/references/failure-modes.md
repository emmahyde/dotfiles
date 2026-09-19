# Stack failure modes

Symptom first. Every row assumes you already ran the probe, because the repair depends on state you cannot infer from the error text alone.

Confidence is marked per entry. `verified` means reproduced on this machine. `documented` means GitHub's stacked-PR docs state it. `reported` means a bug report with reproduction steps exists but was not reproduced here.

## Quick index

| Symptom | Section |
|---------|---------|
| A stack command printed `✗` but succeeded per its exit code | [Silent failure](#silent-failure) |
| `✗ ... already used by worktree` | [Branch held by another worktree](#branch-held-by-another-worktree) |
| Restack stopped, files conflicted | [Mid-stack conflict](#mid-stack-conflict) |
| A child PR's diff contains its parent's changes | [Descendant carries the parent diff](#descendant-carries-the-parent-diff) |
| Merge queue ejected a child with `invalid_merge_commit` | [Squash plus queue ejection](#squash-plus-queue-ejection) |
| A stacked PR closed itself and will not reopen | [Base deleted at a merge-group boundary](#base-deleted-at-a-merge-group-boundary) |
| A stacked PR will not merge, no failing check | [Non-linear history blocks the merge](#non-linear-history-blocks-the-merge) |
| Probe says no stack, but the PR clearly has a feature-branch base | [Untracked chain](#untracked-chain) |
| A teammate's commit vanished after your push | [Force-push clobber](#force-push-clobber) |
| Everything above a closed PR is stuck | [Closed PR mid-stack](#closed-pr-mid-stack) |

## Silent failure

*verified*

`gh stack rebase` and `gh stack sync` v0.1.0 return 0 after printing `✗ checking out <branch>: failed to run git`. The exit code carries no information about whether the restack happened.

**Repair:** never branch on the exit code. Capture stdout, grep it for `✗`, and re-probe to compare state. Treat "state did not change" as failure regardless of what the shell reports.

## Branch held by another worktree

*verified*

A stack branch checked out in a second worktree makes `sync` and `rebase` fail, because the restack has to check out each layer in turn. Git refuses with `fatal: '<branch>' is already used by worktree at <path>`.

**Repair:** free the branch in the other worktree, either `git worktree remove <path>` or checking out something else there. Then re-probe and rerun. Bare `git rebase --update-refs` has the same boundary by design — it silently declines to move a branch another worktree holds — so switching to plain git does not route around this.

**Related:** stack metadata is per worktree, at `$GIT_DIR/gh-stack`. A stack created in one worktree is invisible from another, where the probe returns exit 2. Re-adopt with `gh stack checkout <pr-number>`.

## Mid-stack conflict

*documented*

`gh stack rebase` stops and lists the conflicted files. The probe then reports `CONFLICT` with the branch in `conflictBranch`.

**Repair:** resolve, `git add` the files, then `gh stack rebase --continue`. To back out, `gh stack rebase --abort` restores every branch to its pre-rebase state.

Resolve conflicts at the layer that owns the code. A conflict resolved at the wrong layer moves the change up the stack and makes the lower PR's diff incomplete.

In `--auto` mode, refuse. A conflict needs a decision about intent, which an agent cannot infer from the hunks.

## Descendant carries the parent diff

*documented, mechanism verified*

The classic stack break. Under squash merge, the parent's squash commit is in no child's history, so the child's diff against the new base includes the parent's changes as if the child had written them.

The probe reports `MERGED_MIDSTACK` when a layer is merged and active layers remain.

**Repair:** `gh stack sync --prune`. This restacks the survivors onto the updated trunk, pushes atomically, and deletes local branches for merged PRs while keeping the metadata the remaining layers need.

Then tell the reviewers of the surviving layers their diffs moved. A restack sends no notification.

## Squash plus queue ejection

*reported (github/gh-stack discussions#223)*

Squashing the bottom PR of a queued stack succeeds, then the queue ejects the next PR with `invalid_merge_commit`. The queue validates the child's speculative merge commit against a base that does not yet contain the parent's squashed result.

The probe flags this repo shape ahead of time as `SQUASH_QUEUE_RISK`.

**Repair and avoidance:** land serially. Enqueue the bottom PR alone, let it merge, let GitHub retarget the child, restack, then enqueue the child alone. The batched "enqueue stack" path is the broken one.

Merge-commit and rebase-merge strategies are not shown failing this way, so a repo that allows either has an escape hatch.

## Base deleted at a merge-group boundary

*reported (github/gh-stack issues#444)*

A stack too large for one merge group splits across consecutive groups. At the boundary the PR's base branch is deleted by the merge, GitHub retargets it one link up, and that base was deleted by the same merge. The PR closes and neither the UI nor the API will reopen it.

**Repair:** force-push the deleted refs back to restore the base, then reopen. This is recovery from a bug, not a workflow, so capture the branch SHAs before landing a deep stack — `git reflog` and the PR timeline both still hold them.

**Avoidance:** keep stacks shallow enough to fit one merge group. The queue will exceed its configured group size by up to 50 percent to hold a stack together, so the practical ceiling is higher than the configured number but not unlimited.

## Non-linear history blocks the merge

*documented*

A stacked PR merges only when it and every PR below it meet all requirements **and** the stack has linear history. A moved trunk, or any push to a lower layer, breaks linearity. The merge box blocks with no failing check to point at, which reads as a mystery.

**Repair:** `gh stack rebase` then `gh stack push`, or `gh stack sync` to do both atomically. The web "Rebase stack" button does the same server side, but it produces **unsigned commits** — a repo requiring signed commits has to use the CLI.

## Untracked chain

*verified (probe exit 4)*

The PR's base is a feature branch, set by hand with `gh pr edit --base`, so GitHub has no stack object and `gh stack view` reports nothing.

**Repair:** `gh stack checkout <pr-number>` if the PRs already form a stack on GitHub. Otherwise `gh stack link <bottom> <middle> <top>`, which accepts branch names, PR numbers, or PR URLs bottom to top, pushes branches, and creates missing PRs with the right base chain.

Do not restack an untracked chain with whole-stack commands first. Adopt it, re-probe, then act.

## Force-push clobber

*documented*

`--force-with-lease` compares against your remote-tracking ref, not the actual remote. A background fetch — an IDE's auto-fetch, or any `git fetch` you did not read — advances that ref, so the lease check passes and the teammate's commit is overwritten.

**Repair:** recover the lost commit from the remote's reflog if the host exposes it, or from the collaborator's local clone. Prevention is the real answer.

**Prevention:** set `push.useForceIfIncludes=true`. `--force-if-includes` checks your reflog to confirm the remote's last-known tip is reachable from your history before allowing the push. It is a documented no-op unless paired with `--force-with-lease`, which the config pairing handles.

One owner per stack is the other mitigation. Concurrent edits to a stack are treated as an explicit divergence state requiring interactive resolution, which is a sign the tooling does not expect shared ownership.

## Closed PR mid-stack

*documented*

A closed PR in the middle blocks every PR above it. The stack relationship survives the close, so reopening alone does not restore a mergeable chain.

**Repair:** `gh stack unstack` to dissolve, then rebuild with `gh stack link` or `gh stack submit`. Note that unstack leaves merged and queued PRs stacked — GitHub decides what can dissolve — and when some stay stacked, the stack and its local tracking are left as they were.

## When the state does not match any row

Re-probe with `--json` and read the raw fields. The extension is in public preview and its output changes between builds, so a verdict the script cannot classify is more likely a schema change than an exotic failure. Compare against `gh stack view --json` directly, and check `gh stack <cmd> --help` before trusting any command shape.
