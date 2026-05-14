---
description: Fork this Claude Code session into a new cmux vertical split. Current pane keeps running; new pane resumes a clone of the transcript.
---

Run the branch-session helper. Must be invoked from inside a cmux terminal
(the script checks `CMUX_WORKSPACE_ID`).

```
bash ~/.claude/scripts/branch-session.sh
```

What happens:
- Locates the current session transcript under `~/.claude/projects/<cwd>/`.
- Clones it to a fresh UUID and rewrites the inner `sessionId` field.
- Opens a new cmux split to the right of the current pane.
- Sends `claude --resume <new-uuid>` into the new split so it boots the clone.

After the script returns, report the original and forked session IDs.
