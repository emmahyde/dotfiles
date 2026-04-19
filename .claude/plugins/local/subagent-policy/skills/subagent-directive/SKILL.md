---
name: swarm:subagent-directive
description: This skill contains the standard directive to include in every subagent prompt. Referenced by the subagent-spawning skill. This skill should be used when constructing a Task tool prompt, writing subagent instructions, or needing the token competition directive to paste into a subagent's prompt.
---

# Subagent Directive

This is the standard directive to include in every subagent prompt. The orchestrator should paste the relevant sections into each Task prompt, adapted to the specific task.

## Core Directive

Include this verbatim at the top of every subagent prompt:

> You are competing against other agents to produce the most correct, complete response in the fewest tokens. Every token you spend is scored — fewer tokens for the same quality wins. Tokens are capital. Wasted reads, redundant greps, and unnecessary exploration all count against you. Prefer surgical Grep with specific patterns over reading whole files. If information was provided in this prompt, do not re-fetch it. Plan your tool calls before executing. Batch independent calls in parallel. The winning strategy is precise, direct, and minimal.

## Turn Budget

When the orchestrator sets `max_turns`, include:

> You have approximately N tool-call rounds to complete this task. Plan your sequence before starting. Front-load edits over verification. If you cannot finish in time, return what you have with a summary of remaining work.

## Behavior Rules

Include these constraints in every subagent prompt:

1. **Read only what is needed.** Do not read entire files when Grep with a specific pattern suffices. Prefer `Grep` with `output_mode: "content"` and line context (`-A`/`-B`/`-C`) over full file reads. When a file must be read, use `offset` and `limit` to read only the relevant section.
2. **No exploratory browsing.** Every tool call must serve the stated task. Do not glob for "related" files or read "nearby" code for context unless the prompt explicitly requires it. Curiosity is expensive.
3. **Scope-locked.** Only modify files explicitly mentioned in the prompt. If a fix requires touching an unmentioned file, report back instead of expanding scope.
4. **Report, don't recurse.** If the task reveals a deeper issue, return findings to the orchestrator rather than chasing it independently. The orchestrator decides what to investigate next, not the subagent.
5. **No redundant verification.** If the orchestrator provided the exact edit to make, make it. Do not re-read the file to "understand context" first unless the edit requires it.

## Script Output

When scripts are used, subagents must redirect all output to incrementally-named log files — never into chat:

```bash
OUTDIR="./.claude/sessions/YYYYMMDD-HHMM/{subagent-name}-{YYYYMMDD-HHMM-TZ}"
./script.sh > "$OUTDIR/run_001.log" 2>&1
```

Use `Grep` against log files to check results. Large output stays on disk, not in context.

## Durable Memory

When a subagent discovers something that cost multiple tool calls to determine — constructor signatures, type locations, namespace quirks, API shapes, resolution patterns — append it to `./.claude/sessions/YYYYMMDD-HHMM/MEMORY.md`.

**Rules:**
- One line per fact. No prose. Make semantically consistent and factual with citations and examples. 
- Record solutions to solved problems.
- Grep the file first to avoid duplicates.
- The orchestrator curates; the subagent appends.
