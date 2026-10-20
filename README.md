# dotfiles

## Claude Code plugins

This repo is a Claude Code plugin marketplace. To subscribe, add to your `settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "emmahyde-dotfiles": {
      "source": {
        "source": "github",
        "repo": "emmahyde/dotfiles"
      }
    }
  },
  "plugins": {
    "discuss-and-execute@emmahyde-dotfiles": true
  }
}
```

### Available plugins

- **discuss-and-execute** — Interactive workflow for discussing implementation decisions, gathering codebase context, planning parallelizable task waves, and executing with coordinated agents.
- **my-voice-bot** — Generate a writing voice/style prompt for any GitHub user by mining their PR review comments.
- **search-conversations** — Search past Claude Code conversations across all projects by description, returning resume commands.
- **wispr** — Voice interaction with Claude Code via Wispr Flow dictation and macOS TTS.
- **review-canvas** — PR-style transcript review canvas: drag-select line ranges in a JSONL transcript, attach comments, and stream them into the running session as channel events.
- **guardrails-kit** — Just-in-time instruction loader: CLAUDE.md as a dispatch table that routes observable events to guardrail docs (PLAN/CODE/DEBUG/VERIFY/...). Ships an idempotent installer that deploys the kit into `~/.claude` and splices the routing table into CLAUDE.md.

## Disk cleanup

`bin/groot-wt-gc` previews cleanup. It does not delete files unless you pass `--apply`.
The existing `~/.local/bin/groot-wt-gc` link points to this command.

```sh
groot-wt-gc                              # Preview worktrees and known caches
groot-wt-gc --apply                      # Remove eligible worktrees and inactive caches
groot-wt-gc --builds --colima             # Also preview build outputs and Colima pruning
groot-wt-gc --apply --builds --colima      # Apply all three cleanup categories
groot-wt-gc --no-caches --delete-branches --apply
groot-wt-gc --no-worktrees --json         # Cache report as JSON
```

Worktree cleanup requires more than seven days without source or Git activity.
The command fetches the default branch from `origin`. The worktree HEAD must be
an ancestor of that branch. Unproven squash merges remain untouched.
Dirty worktrees, untracked files, stashes, locks, unknown ignored files, open
files, and active working directories prevent removal. Git errors also prevent
removal. Primary checkouts stay in place. Branch deletion needs
`--delete-branches` and uses `git branch -d`, never force.

Discovery covers `~/worktrees`, `~/work`, `~/src`, `~/projects`, and `~/personal`,
through four directory levels. Use repeated `--root PATH` options for other locations.
Use `--days N` to change the inactivity threshold.

Cache cleanup covers `~/Library/Caches`, `~/.cache`, npm and Bun download caches,
OMP model/runtime caches, Hermes caches, Cargo archive caches, and Gradle caches.
Open files protect the cache containing them. Downloads and model caches may
need to be fetched again. `--cache-root PATH` replaces the default cache list.
`--no-caches` disables this category.

`--builds` clears Cargo `target` and JavaScript `node_modules` directories, even
in dirty checkouts. It retains directories with tracked files or nested Git
repositories. Do not store unique untracked work in generated directories.
Symlinks are not followed.

`--colima` prunes unused images and build cache in each Colima Docker context.
It does not delete containers, volumes, VM disks, or database files. Runtime
corruption returns an error; the command never resets a VM.

For daily automation, run the conservative command below from your scheduler.
It removes safe stale worktrees but does not force daily cache downloads:

```sh
groot-wt-gc --apply --no-caches --json
```

Schedule it outside active development hours. Keep its report so retained
worktrees and errors remain visible. A nonzero exit means some checks or
cleanup operations failed. Reports contain paths and reasons, not file contents.
Disk estimates use `du`; APFS shared extents can reduce the space actually freed.

Run the safety scenarios with:

```sh
python3 -B -m unittest discover -s tests -p test_worktree_gc.py -v
```
