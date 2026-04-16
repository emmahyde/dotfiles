---
name: watch-pr-checks
description: Monitor GitHub CI checks for the current branch's PR. Auto-triggered by hook after git push or gh pr create. Can also be invoked manually.
---

## Instructions

1. Get the PR number for the current branch:
   ```
   gh pr view --json number -q .number
   ```
2. If no PR exists, tell the user and stop.
3. Call the **Monitor** tool with:
   - `command`: `bash ~/.claude/skills/watch-pr-checks/scripts/poll-checks.sh <PR_NUMBER>`
   - `description`: `PR #<N> CI checks`
   - `persistent`: `false`
   - `timeout_ms`: `3600000`
4. Tell the user monitoring has started, then **continue with other work** — do not block.

## Handling notifications

- **"ALL GREEN"** → All CI checks passed. Briefly inform the user.
- **"FAILED"** → Some checks failed. Report which checks failed.
- **Progress update** → Status changed; acknowledge briefly only if the user seems idle.
- **"ERROR"** → Transient issue; mention only if it repeats.

## On re-invocation (e.g. after a new push)

If a PR checks monitor is already running, the polling script tracks the latest commit's
checks automatically via `gh pr checks`. A new Monitor is only needed if the previous one
already exited (checks resolved). If you're unsure, start a fresh Monitor — duplicate
notifications are preferable to missing a failed build.
