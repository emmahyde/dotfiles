---
name: swarm:orchestrator-directive
description: This skill should be used when spawning subagents via the Task tool, dispatching parallel agents, delegating work to sub-agents, or deciding which model to use for a task. Applies to ANY use of the Task tool including "use an agent", "spawn agent", "run in parallel", "delegate", "use haiku/sonnet/opus".
---

# Subagent Spawning Policy — Orchestrator Guide

## Token Budget Mindset

Tokens are capital. Every agent — orchestrator and subagent alike — is competing to produce the most correct, complete outcome in the fewest total tokens. The orchestrator's score includes every token its subagents spend. A sloppy prompt that causes a subagent to waste 20 tool calls is the orchestrator's loss.

The orchestrator that manages capital most effectively wins: tight prompts, right-sized models, surgical reads, no redundant discovery. The same discipline applies to the orchestrator's own tool calls — read only what is needed, grep before reading, don't explore when the answer is already known.

## Subagent Directive

The Task tool has no `system_prompt` parameter. The only way to set subagent behavior is through the `prompt` field. Therefore, **every subagent prompt MUST inline the directive** from the `swarm:subagent-directive` skill.

**Before constructing any Task prompt**, invoke the `swarm:subagent-directive` skill to load its current content. Then prepend the full directive block — Core Directive, Turn Budget (with actual N), and Behavior Rules — to the task-specific instructions in the `prompt` field.

**Prompt structure for every Task call:**

```
[1. Core Directive — verbatim from swarm:subagent-directive]
[2. Turn Budget — with actual max_turns value substituted for N]
[3. Behavior Rules — all 5 constraints from swarm:subagent-directive]
[4. Session context — MEMORY.md findings, script paths if applicable]
[5. Task-specific instructions — the actual work to do]
```

**Scale the directive to the model.** For haiku tasks, the Core Directive + Turn Budget (2 lines) is sufficient — skip Behavior Rules since haiku prompts should be terse. For sonnet/opus tasks, include the full directive block.

## Model Selection

Every Task call MUST include an explicit `model` parameter. Select the cheapest model sufficient for the job.

| Model | Cost | Use When |
|-------|------|----------|
| **haiku** | Lowest | Grep/search tasks, single-file reads, straightforward edits, formatting, simple code generation, file lookups |
| **sonnet** | Medium | Multi-file analysis, moderate debugging, code review, refactoring across 3+ files, test writing |
| **opus** | Highest | Orchestration of other agents, architectural planning, complex multi-step investigation, ambiguous requirements needing deep reasoning |

**Default to haiku.** Upgrade only when the task genuinely requires deeper reasoning. A subagent that mostly runs Grep/Read/Edit calls does not need sonnet.

## Turn Budgeting

Every Task call MUST include `max_turns`. The orchestrator estimates the minimum turns needed and sets a tight cap. This is a competitive decision — every turn a subagent takes is scored against the orchestrator's total budget.

**Estimating turns:** Count the expected tool calls, add ~50% headroom for reads and verification.

| Task Complexity | Expected Calls | `max_turns` |
|----------------|---------------|-------------|
| Single grep + edit | 2-3 | 6 |
| Multi-file fix (3-5 files) | 5-8 | 12 |
| Investigation + fix | 8-15 | 20 |
| Broad analysis | 15-25 | 30 |

**Tell the subagent its budget** in the prompt — it cannot read `max_turns` from tool params.

## Prompt Size Proportionality

The prompt itself costs tokens. Match verbosity to the model and task:

- **Haiku tasks:** Terse. File paths, line numbers, exact edits. No background explanation. 3-8 lines.
- **Sonnet tasks:** Moderate context. Describe the problem, list files, state constraints. 10-20 lines.
- **Opus tasks:** Rich context acceptable. Architecture background, tradeoffs, open-ended investigation. No limit, but stay relevant.

A 1500-word prompt to a haiku agent for a 3-line edit defeats the purpose.

## Prompt Construction for Token Efficiency

Subagents start with zero context. Every token they spend discovering what the orchestrator already knows is waste. Construct prompts that eliminate discovery overhead.

### Pass Specific File Paths

Never tell a subagent "find the file that handles X." Locate the file first and pass the path.

```
BAD:  "Find the Ship class and fix the namespace conflict"
GOOD: "In /Users/emmahyde/projects/sector/Assets/Engine/Ship/Ship.cs,
       the class `Ship` on line 18 conflicts with the `Sector.Ship` namespace.
       Add a using alias `using Ship = Sector.Ship.Ship;` to resolve it."
```

### Specify Line Ranges and Patterns

Direct subagents to the exact region of interest. Provide grep patterns or line numbers.

```
BAD:  "Read ServicesTabPanel.cs and fix the errors"
GOOD: "In /path/to/ServicesTabPanel.cs:
       - Line 64: `private Ship _playerShip;` errors because Ship is a namespace.
       - Line 370: `private Ship GetPlayerShip()` same issue.
       Fix: replace `Ship` with `Sector.Ship.Ship` on those lines.
       Use Grep to verify no other bare `Ship` type references remain."
```

### Define Exit Criteria

Tell the subagent exactly what "done" looks like. This prevents open-ended exploration.

```
BAD:  "Fix the compilation errors in the presentation layer"
GOOD: "Fix these 3 errors in TutorialUIOverlay.cs:
       1. Line 126: replace `beat.InstructionText` with `string.Join(\"\\n\", beat.instructionLines)`
       2. Line 133: replace `beat.ArrowDirection.HasValue` with `beat.arrowDirection != ArrowDirection.None`
       3. Line 150: replace `beat.AutoAdvanceDelay` with `beat.durationSeconds`
       Read the file, make the edits, verify with Grep that no other references to the old properties remain."
```

## Resume Over Re-spawn

When a subagent returns incomplete or nearly-complete results, **resume it** using the `resume` parameter with the agent's ID rather than spawning a fresh agent. The resumed agent retains its full prior context — re-spawning forces it to rediscover everything from scratch.

**When to resume vs re-spawn:**
- Subagent finished 80%+ → resume with "continue, also handle X"
- Subagent hit `max_turns` cap → resume with a tighter scope for remaining work
- Subagent went off-track or failed fundamentally → re-spawn with an adjusted prompt
  - Write lessons back to this skill for future


## Failure Protocol

When a subagent fails or returns incomplete results:

1. **Do not re-spawn with the same prompt.** That's the definition of wasting tokens.
2. **Check MEMORY.md** for any findings the failed agent recorded.
3. **Diagnose from the summary** — was the task too broad? Wrong file paths? Missing context?
4. **Adjust and retry** — narrow the scope, add missing information, or resume the agent.
5. **Escalate the model** only if the failure was a reasoning problem, not a context problem.

## Reusable Scripts Over Inline Repetition

When the same series of steps must execute repeatedly, write them as a script instead of inlining in each prompt.

**Write scripts to:** `./.claude/sessions/YYYYMMDD-HHMM/{subagent-name}-{YYYYMMDD-HHMM-TZ}/`

On first subagent spawn in a session, create the session directory using the current timestamp (e.g. `20260206-0358`). Each subagent gets its own timestamped subdirectory.

**Script output goes to files, never to chat.** Scripts must redirect all output to incrementally-named log files in the same directory. Use `Grep` against log files to check results.

## Durable Memory

**Before spawning a subagent**, check `./.claude/sessions/YYYYMMDD-HHMM/MEMORY.md` for relevant prior findings and include them in the prompt.

**Instruct subagents to append findings** when they discover something that cost multiple tool calls — constructor signatures, type locations, namespace quirks, API shapes. One line per fact, no prose.

The orchestrator owns this file. Subagents append; the orchestrator curates.

## When NOT to Spawn Subagents

Do the work directly when:
- The task requires fewer than 3 tool calls
- A single Grep + Edit sequence would suffice
- The task requires conversational context the subagent would lack
- The files to examine aren't yet known (do discovery first, then delegate)

## Parallel Dispatch Pattern

When spawning multiple subagents in parallel:

1. **Verify independence** - agents must not edit the same files
2. **One concern per agent** - each gets a single, focused objective
3. **All prompts self-contained** - no agent should depend on another's output
4. **Review before integrating** - read each agent's summary, check for conflicts, then proceed

## How to Win

- [x] Before planning implementation of a feature, check if it already exists. `mermaid-ascii` subgraph support is fully implemented and passing 18 test fixtures on master — an agent wasted a full exploration cycle discovering this.
- [x] **NEVER use `run_in_background: true` + `TaskOutput`.** `TaskOutput` dumps the full agent transcript into orchestrator context, defeating the purpose of delegation. Use foreground Task calls — they return only the agent's summary. If parallelism is needed, launch multiple foreground Tasks in a single message block (they run concurrently).
- [x] **NEVER use `TaskOutput` at all.** It loads entire transcripts. If you must check a background agent, use `tail -1` on the output file and parse the last JSON line for status.

## Other Lessons

- [x] When a branch name suggests a feature is in-progress (e.g. `emmahyde/add-subgraphs`), verify with `git log master..HEAD` first. Zero commits ahead means the branch is stale or the work was already merged.
