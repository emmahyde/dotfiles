# claude-topic-spinoff

`/spinoff` slash command for Claude Code. Hands a sub-topic off to a **fresh**
Claude Code session in a new cmux split, so the current session stays focused.

Companion to [`claude-branch-split`](../claude-branch-split) — same cmux
plumbing, opposite intent:

| | `/branch` (claude-branch-split) | `/spinoff` (claude-topic-spinoff) |
|---|---|---|
| New session | Clone of current transcript | Brand-new, empty |
| Shared context | Full history up to the fork | None — only the handoff prompt |
| Use it to | Explore a divergent thread | Delegate a self-contained sub-task |

## What it does

When invoked from inside a Claude Code session running in a cmux pane:

1. Claude summarizes the topic to spin off into a **self-contained handoff
   prompt** — task, relevant file paths and state, decisions already made, and
   what is out of scope. The new session has none of this conversation's
   context, so the prompt must stand alone.
2. The prompt is written to `/tmp/claude-spinoff-<unix-ts>.md`.
3. `spinoff-session.sh` opens a new cmux split below the current pane
   (`cmux new-pane --direction down`).
4. It launches `claude "$(cat <prompt-file>)"` in the new pane — a fresh
   session seeded with the handoff prompt.

The current pane keeps running unchanged.

## Install

Local clone:

```sh
./install.sh
```

Curl one-liner:

```sh
curl -sL https://raw.githubusercontent.com/emmahyde/dotfiles/main/cmux/claude-topic-spinoff/install.sh | bash
```

Both paths symlink (or copy, when curled) the two files into:

- `~/.claude/commands/spinoff.md`
- `~/.claude/scripts/spinoff-session.sh`

Restart Claude Code afterward so the new slash command registers.

## Usage

Inside a Claude Code session running in cmux:

```
/spinoff add integration tests for the new mouse-injection path
```

Or with no argument — Claude infers the most reasonable sub-topic from the
recent conversation and states its choice before proceeding:

```
/spinoff
```

The script aborts cleanly if `CMUX_WORKSPACE_ID` is unset (i.e. you are not
inside a cmux terminal) or if `cmux` is missing from `PATH`.

## Files

| File | Purpose |
|------|---------|
| `spinoff.md` | Slash-command entrypoint Claude reads when you type `/spinoff`. |
| `spinoff-session.sh` | Worker that opens the split and boots the new session. |
| `install.sh` | Symlinks/copies the two files into `~/.claude/`. |

## Caveats

- The handoff prompt is only as good as the summary Claude writes. Review the
  new pane's first message; if context is missing, paste it in before the new
  session gets far.
- The new pane's surface ref is parsed from `cmux new-pane` stdout. If that
  output format changes, the script falls back to the focused surface (still
  correct — `--focus true` is set on the new pane).
- The prompt file is left in `/tmp` so the new pane's shell can read it; it is
  not cleaned up automatically.
