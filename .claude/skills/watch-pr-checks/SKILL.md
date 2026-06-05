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
   - `persistent`: `true`
   - `timeout_ms`: `3600000`
4. Tell the user monitoring has started, then **continue with other work** — do not block.

## Handling notifications

The polling script only emits when something changes. Event prefixes:

- **"ALL GREEN"** → All CI checks passed. Briefly inform the user.
- **"CHECKS FAILED"** → Some checks failed. Report which checks failed. Do NOT panic — check if they are expected failures (e.g., workflow file changes cause OAuth validation errors).
- **"CHECKS:"** → Progress update (state changed since last poll). Acknowledge briefly only if the user seems idle.
- **"MERGE CONFLICT"** → Branch conflicts with base. Alert the user immediately.
- **"MERGED"** or **"CLOSED"** → PR resolved. Monitor will exit on its own.
- **"COMMENT"** → New review comment from someone other than the PR author. Address it per the comment-reply rules below.
- **"UNRESOLVED"** → There are review comments with no reply from the PR author. Address them.
- **"ERROR"** → Transient issue; mention only if it repeats.

## Comment-reply rules (MANDATORY)

When you see a COMMENT or UNRESOLVED notification, you must act:

1. Read the full comment body (the notification includes it).
2. If it's actionable: fix the code, commit, push, then reply with the commit SHA:
   ```
   gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies -f body="Fixed in <commit SHA>: <one-line description>"
   ```
3. If it's not actionable (false positive, out of scope, intentional): reply explaining why:
   ```
   gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies -f body="<reasoning>"
   ```
4. Never silently ignore a review comment. Every comment gets a reply.

The polling script tracks which comments have replies from the PR author. Once you reply, the UNRESOLVED count drops on the next poll cycle.

## On re-invocation (e.g. after a new push)

The polling script tracks the latest commit's checks automatically via `gh pr checks` and
detects new comments since last check. A new Monitor is only needed if the previous one
already exited (PR merged/closed). If you're unsure, start a fresh Monitor — duplicate
notifications are preferable to missing a failed build.
