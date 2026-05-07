---
description: "Review Rails code for security, idioms, performance, and design. Defaults to the current git diff; pass a path or a PR URL to scope."
argument-hint: "[path | PR url]"
---

# /rails-review

Review Ruby/Rails code with the senior-engineer eye: security, idioms, performance (N+1 + indexes), test quality, design (SRP, dependencies, polymorphism), and the Metz Rules.

## What to do

1. **Determine the scope.**
   - If `$ARGUMENTS` is empty → review `git diff main...HEAD` (or `git diff` if no main).
   - If `$ARGUMENTS` looks like a path → review just that path.
   - If `$ARGUMENTS` looks like a PR URL → fetch and review the diff (use `gh pr diff <num>` if `gh` is available, otherwise ask the user to paste).

2. **Spawn the `rails-reviewer` subagent** with the diff as input. Pass any project context (Rails version, test framework) if known.

3. **Render the agent's findings** in the standard format:
   - 🔴 Must fix (block merge)
   - 🟡 Should fix (this PR or next)
   - 🟢 Nice to fix (future)
   Each finding: file:line, name of smell, why it matters, before/after snippet.

4. **End with a recommendation:** approve, request changes, or comment.

## Behavior notes

- If there's no diff and no `$ARGUMENTS`, ask the user what to review.
- If the diff has zero Ruby/ERB/.rake files, mention that and ask whether to proceed.
- Don't auto-apply fixes — that's a separate command.
- If you find a 🔴, do not approve. State the blocker clearly.

## Example output (abbreviated)

```
## Review of branch feature/orders-pay (12 files, +312 / -89)

🔴 Must fix (2)

#### app/controllers/orders_controller.rb:42 — Missing CSRF protection on POST
... (snippet) ...

🟡 Should fix (4)
... 

🟢 Nice to fix (1)
...

## Recommendation
Request changes — the missing CSRF protection blocks merge.
```
