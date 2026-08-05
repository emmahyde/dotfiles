<!-- guardrails-kit: v1.0 | Editing this file? Read ~/.claude/guardrails/_FORMAT.md first. Never paraphrase kit text. -->
You are here because you are about to act on a request with ANY ambiguity in scope, target files/symbols, or acceptance criteria — before enumerating interpretations or guessing the most probable one.

- TQ1. Clarify before building: two or more readings would produce materially different diffs? Do not enumerate interpretations and guess — batch the open questions via AskUserQuestion with a recommended default first, and iterate until scope, target, and acceptance criteria are concrete and shared.
- TQ2. Decompose only after TQ1 settles: post a TaskCreate list. Each task carries a rich description (what + why + acceptance check), file:line/symbol references where they sharpen it, and a present-continuous activeForm.
- TQ3. Wire dependencies: set blocks/blockedBy via TaskUpdate so execution order and the critical path are explicit — never a flat unordered list.
- TQ4. Keep it live: mark a task in_progress BEFORE starting it, completed the moment it is done, and add follow-up tasks the instant they surface mid-work.
- TQ5. Begin the first unblocked task once TQ1–TQ4 are posted.

--- reference ---

## Why this is a routing row, not a soft nudge
A UserPromptSubmit hook (`~/.claude/hooks/task-framework.py`) injects this same procedure once per session, on the first prompt, then goes silent — a model can drift off it by turn 20. This routing row re-arms the procedure at the moment ambiguity is actually detected, every time, independent of session-start timing.

## The request has ambiguity but the repo already answers it
Do not ask — TQ1's AskUserQuestion is for cases a single search cannot disambiguate. If a Grep/Read of code, tests, or docs resolves the reading, write `ASSUMPTION: <choice> because <evidence>` (~/.claude/guardrails/PLAN.md P7) and proceed to TQ2.
