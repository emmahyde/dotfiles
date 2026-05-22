---
description: Spin a sub-topic off into a fresh Claude Code session in a new cmux split. Summarizes the topic into a self-contained handoff prompt and boots a new claude there.
argument-hint: [topic to spin off]
---

The user wants to spin a sub-topic off into a SEPARATE Claude Code session in
a new cmux split pane, so this session stays focused on everything else.

Topic to spin off: $ARGUMENTS

Unlike `/branch` (which clones this transcript so two threads diverge), this
starts a BRAND-NEW session that has none of this conversation's context — so
the handoff prompt must stand entirely on its own.

Steps:

1. Decide the spin-off topic.
   - If `$ARGUMENTS` is non-empty, use it.
   - If empty, infer the most reasonable sub-topic from the recent
     conversation, then state your choice in one line before proceeding.

2. Write a self-contained handoff prompt for the new session. It must include:
   - The specific task and its goal.
   - Relevant file paths, symbols, and current state.
   - Decisions already made here that constrain the work.
   - What is explicitly OUT of scope (stays in this session).
   - Any commands needed to build/test/verify.
   Write it as direct instructions to the new session, not a description of
   this conversation.

3. Save the task prompt to a temp file: `/tmp/claude-spinoff-<unix-ts>.md`
   (use the Write tool; pick the current unix timestamp for `<unix-ts>`).

4. Also generate a compact passoff context for the parent session state and
   save it to `/tmp/claude-passoff-<unix-ts>.md`.
   - Use the passoff skill format (legend + NOW/DONE/NEXT/RESUME minimum).
   - Keep it brief but concrete (paths, commands, blockers).

5. Launch the split with both files:

   ```
   bash ~/.claude/scripts/spinoff-session.sh /tmp/claude-spinoff-<unix-ts>.md sonnet /tmp/claude-passoff-<unix-ts>.md
   ```

6. Report the one-line topic that was spun off and confirm the new pane
   booted. This session continues with everything that was NOT spun off.

Aborts cleanly if not inside a cmux terminal (`CMUX_WORKSPACE_ID` unset) or if
`cmux` is missing from `PATH`.
