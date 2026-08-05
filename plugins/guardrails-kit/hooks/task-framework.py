#!/usr/bin/env python3
"""UserPromptSubmit hook: fire ONCE per session (on first prompt) to install a
task-management framework directive. Gates on a per-session marker file so it
does not re-inject on every prompt."""

import sys
import json
import os

FRAMEWORK = """\
TASK FRAMEWORK (active this session — applies to every non-trivial request):

1. CLARIFY BEFORE BUILDING. If the request has ANY ambiguity — scope, target
   files/symbols, acceptance criteria, or competing approaches — do NOT burn
   cycles enumerating interpretations and guessing the most probable. Run a
   tight interactive Q&A (modeled on /discuss-and-execute:discuss): batch the
   open questions via AskUserQuestion with a recommended default first, and
   iterate until the understanding is concrete and shared. Prefer one more
   question over one more speculative paragraph.

2. THEN DECOMPOSE into a task list (TaskCreate) — only after understanding is
   settled. Each task: rich description (what + why + acceptance check), brief
   AST/file references where they sharpen it (path:line, symbol, type name),
   and a present-continuous activeForm.

3. WIRE DEPENDENCIES. Set blocks/blockedBy via TaskUpdate so execution order is
   explicit and the critical path is visible — never a flat unordered list.

4. KEEP IT LIVE. Mark a task in_progress BEFORE starting it; mark completed the
   moment it is done; add follow-up tasks as they are discovered mid-work.

5. BEGIN the first unblocked task.
"""


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    sid = data.get("session_id") or "nosession"
    cache_dir = os.path.expanduser("~/.claude/.cache/task-framework")
    try:
        os.makedirs(cache_dir, exist_ok=True)
        marker = os.path.join(cache_dir, sid)
        if os.path.exists(marker):
            return  # already fired this session
        open(marker, "w").close()
    except Exception:
        pass  # on FS error, fail open (inject anyway) rather than block

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": FRAMEWORK,
                }
            }
        )
    )


if __name__ == "__main__":
    main()
