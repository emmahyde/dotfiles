# Stacking without `gh stack`

Read this when the repo or the user does not use GitHub's native stacked PRs. The parent skill assumes `gh stack`, and every command in it stops applying here.

The honest state of this file: the bare-git layer is well sourced and safe to act on. The third-party tools are summarized from vendor documentation and comparison pages, not from their own command references, so **treat every command shape below as unverified and run `--help` before using it.** Gaps are marked.

## Decide which layer you are on

| Situation | Use |
|-----------|-----|
| Repo uses GitHub native stacks | The parent skill, `gh stack` |
| No tooling, you own the whole chain | [Bare git](#bare-git) |
| Repo standardizes on Graphite, Aviator, Sapling, `spr`, or `ghstack` | That tool — then consider [linking into GitHub](#linking-a-foreign-stack-into-github) |
| Tool-managed branches, but you want GitHub's stack UI | [`gh stack link`](#linking-a-foreign-stack-into-github) |

## Bare git

*well sourced*

Stacking needs no tool. It needs one primitive and one push flag.

### `git rebase --update-refs`

Requires **git 2.38** or newer, released 2022-10-15. On older git the flag is unrecognized and errors loudly, so there is no silent-wrong-behavior risk.

Rebase the tip of the stack and git replays the commits, moving every intermediate branch pointer that sat on a rebased commit forward onto its rewritten commit. One command replaces one rebase per layer.

```bash
git checkout <top-of-stack>
git rebase --update-refs origin/main
```

Make it the default for every rebase with `git config --global rebase.updateRefs true`, and opt out per invocation with `--no-update-refs`.

Two boundaries worth knowing:

- It updates **local** refs only. Each shifted branch still needs its own push.
- It never moves a branch checked out in **another worktree**. That is a documented safety rule, so a partial-looking restack in a worktree-heavy setup is usually this, not a bug.

For surgical control over which range moves, `git rebase <base> --onto <newbase>` retargets an explicit commit range without cascading through every intermediate ref by name.

### Pushing a restacked chain safely

```bash
git config --global push.useForceIfIncludes true
git push --force-with-lease origin <branch>
```

`--force-with-lease` alone is not enough. It compares against your remote-tracking ref, and a background fetch — an IDE auto-fetch, or any `git fetch` you never read — advances that ref, so the lease check passes and a teammate's commit is overwritten. `--force-if-includes` checks your reflog to confirm the remote's last-known tip is reachable from your history first. It is a documented no-op unless paired with `--force-with-lease`, which the config setting handles for you.

There is no atomic multi-branch equivalent of `gh stack sync` here. Push layer by layer, bottom up, and re-check each PR's base afterwards.

### Retargeting PR bases

`gh pr edit --base <branch>` retargets a PR after the chain is restructured. The flag name is consistent with `gh` conventions but was **not independently confirmed** in the research pass, so check `gh pr edit --help` first.

When a PR merges, GitHub retargets any PR whose base was the merged branch onto that branch's own base. This automatic retarget is what makes hand-rolled stacking survivable. It is also the mechanism behind the base-deleted closure bug described in `failure-modes.md`.

## Third-party tools

*vendor-sourced, command surfaces unverified*

| Tool | Model | Notes | Verification gap |
|------|-------|-------|------------------|
| **Graphite** (`gt`) | Branch per PR, CLI plus its own web review UI | Closed-source CLI. Stack-aware merge queue. Supports squash, merge, and rebase | No tool docs or command reference fetched. No independent failure mode found. Reported as acquired by Cursor in December 2025, not re-verified |
| **Aviator** (`av`) | Branch per PR, open source (MIT), works against vanilla GitHub PRs | No custom review UI required. Monorepo-scale queue with dynamic parallel queues, cross-repo change sets, fast-forward merge for linear history | Only Aviator's own comparison page fetched. Command surface and failure modes unverified |
| **Sapling** (`sl`) | Replacement VCS, one commit per PR | Restacks automatically. Ships `sl undo`. Its own commit-cloud model rather than git branches | No pages fetched. Details unverified |
| **`spr` / stack-pr** | One commit, one PR | Commit message becomes the PR title | Search snippets only, no pages fetched |
| **`ghstack`** | One commit, one PR, Meta-originated | Creates no new branches you manage by hand | Search snippets only, no pages fetched |
| **`git-town`**, **`jj`** | — | — | **No source at all.** Not covered by any fetched page. Do not describe their behavior from memory |

### Choosing between the two models

The split that matters is not vendor but unit of review.

- **Branch per PR** — Graphite, Aviator, `gh stack`, bare git. Each layer is a branch with its own history. Fits teams already reviewing branches, and interoperates with GitHub's own stack object.
- **Commit per PR** — `spr`, `ghstack`, Sapling. Each commit is a PR, and amending a commit updates its PR. Cleaner for the author, but it rewrites commits constantly, so it fights signed commits and any workflow that treats a commit SHA as stable.

## Merge queue vendors

*documented for Mergify*

Mergify is not a PR-authoring tool. It lands stacks, in two modes:

- It recognizes GitHub-native stacks and lands members bottom up. This requires Mergify to be an `exempt` bypass actor on the base branch's rulesets, which is an integration prerequisite, not a preference.
- Its own `mergify stack push` model treats the chain as one queue unit with strict base-branch chaining.

Its cascade behavior is worth contrasting with the native bugs: when a PR fails, the PRs already merged below it stay merged and the rest stop cleanly. That is documented intended behavior, not an ejection bug.

## Linking a foreign stack into GitHub

You can drive branches with any tool and still get GitHub's stack UI and atomic merge:

```bash
gh stack link <bottom> <middle> <top>
```

It takes branch names, PR numbers, or PR URLs bottom to top, needs no local `gh stack` tracking, pushes the branches, and creates missing PRs with the correct base chain. GitHub's own documentation names `jj`, Sapling, `ghstack`, and `git-town` users as the audience.

This is the cheapest bridge when the team's tooling is settled but the review experience is not.

## Hard limits that apply regardless of tool

- **Cross-fork stacks are unsupported.** Every branch must live in one repo. No tool works around this.
- **Squash merge plus a merge queue** reproducibly ejects child PRs. See `failure-modes.md`. This is a GitHub-side interaction, so switching CLI does not fix it.
- **Bottom-up landing is universal.** Every source that discusses landing agrees, across native stacks and every vendor.

## If you need better answers on a specific tool

The research pass that produced this file deliberately spent a small search budget and left these gaps open. To close one, fetch the tool's own command reference directly rather than a comparison page: Graphite's CLI docs, Aviator's CLI docs, or the `ghstack` and `spr` repository READMEs. A vendor's comparison of a competitor is the least reliable source in the corpus.
