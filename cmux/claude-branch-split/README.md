# claude-branch-split

`/branch` slash command for Claude Code. Forks the current session into a
new cmux split so two divergent threads can run side-by-side.

## What it does

When invoked from inside a Claude Code session running in a cmux pane:

1. Locates the current session transcript under
   `~/.claude/projects/<cwd>/<uuid>.jsonl`.
2. Clones the transcript to a fresh UUID and rewrites the inner `sessionId`
   field on every line so Claude Code treats it as a distinct session.
3. Opens a new cmux pane below the current one
   (`cmux new-pane --direction down`).
4. Sends `claude --resume <new-uuid>` into the new pane so it boots the
   clone.

The current pane keeps running the original session. The new pane resumes
the clone. From the moment `/branch` runs, the two diverge.

## Install

Local clone:

```sh
./install.sh
```

Curl one-liner:

```sh
curl -sL https://raw.githubusercontent.com/emmahyde/dotfiles/master/cmux/claude-branch-split/install.sh | bash
```

Both paths symlink (or copy, when curled) the two files into:

- `~/.claude/commands/branch.md`
- `~/.claude/scripts/branch-session.sh`

Restart Claude Code afterward so the new slash command registers.

## Usage

Inside a Claude Code session running in cmux:

```
/branch
```

The script aborts cleanly if `CMUX_WORKSPACE_ID` is unset (i.e. you are not
inside a cmux terminal) or if `cmux` is missing from `PATH`.

## Files

| File | Purpose |
|------|---------|
| `branch.md` | Slash-command entrypoint that Claude reads when you type `/branch`. |
| `branch-session.sh` | Worker that clones the transcript and spawns the new pane. |
| `install.sh` | Symlinks/copies the two files into `~/.claude/`. |

## Caveats

- Picks the **most-recently modified** `.jsonl` in the project dir as "the
  current session." If multiple concurrent Claude Code sessions write to
  the same project dir, the heuristic can pick the wrong one. Claude Code
  does not expose the live session id as an env var in the model process,
  so this is the best available signal.
- The new pane's surface ref is parsed from `cmux new-pane` stdout. If the
  output format changes, the script falls back to sending to the focused
  surface (still correct because `--focus true` is set on the new pane).
