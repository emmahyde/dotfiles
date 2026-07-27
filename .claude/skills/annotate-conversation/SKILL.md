---
name: annotate-conversation
description: Open a local review surface where the human annotates an agent conversation transcript (select text → note → approve/request changes); annotations return to the agent as hard-scoped feedback. Use when the user wants to review or annotate a Claude Code conversation.
---

# Annotate an agent conversation

A plannotator-style review seam (agent-surface-design-system Laws 1, 2, 3, 6, 10, 31, 33), self-hosted with zero dependencies: `review-server.mjs` parses a session transcript, serves a local annotation UI, blocks until the human decides, then prints one JSON line to stdout.

## Steps

1. **Resolve the target session.** Default is the session the user means — usually the current one (its id is in your context). The server accepts a session-id prefix, a `.jsonl` path, or nothing (= latest transcript for cwd).

2. **Start the review gate in the background** (`run_in_background: true` — review time is unbounded; do not poll, wait for the completion notification):

   ```bash
   node ~/.claude/skills/annotate-conversation/review-server.mjs <session-id-or-path>
   ```

   It prints the URL to stderr and auto-opens the browser (pass `--no-open` to suppress, `--thinking` to include thinking blocks, `--port N` for a fixed port when remote-forwarding). The human selects text in any turn (or hits ＋ on a turn header), types a note, then clicks **Approve** or **Request changes**.

3. **Parse the final stdout line** when the process exits:

   ```json
   {"decision":"approve|request_changes","sessionId":"…","annotations":[{"turn":7,"role":"assistant","uuid":"…","quote":"…","note":"…"}]}
   ```

   `turn`/`uuid` anchor each note to an exact transcript turn (Law 31). Approve with zero annotations means proceed as-is (Law 3).

4. **Act on the feedback, hard-scoped** (Law 33). Restate the annotations like:

   ```
   <attached-conversation-annotations>
   Hard scope: act ONLY on the turns annotated below.

   ### Annotation 1 — T7 (assistant)
   - Quoted: "<quote>"
   - Note: <note>
   </attached-conversation-annotations>
   ```

   A note on an assistant turn is feedback on your output — fix or redo exactly that. A note on a user turn is a clarified requirement. Ambiguous note → quote it and ask, don't guess.

5. **Report** one line per annotation: what it asked, what you changed (Law 12 — the human verifies every note was addressed).

## Notes

- Non-zero exit or no JSON line: report the exact output; never fabricate annotations. The review may have been dismissed (browser closed ≠ submitted; the gate keeps blocking — kill the task if the user abandons it).
- `render-transcript.mjs` (same folder) renders the same transcript to plain annotatable markdown — use it when the user wants a file artifact instead of the live surface.
- Local-first (Law 6): binds 127.0.0.1 only, nothing leaves the machine.
