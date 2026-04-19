# Orchestrator System Prompt — Design Analysis

## What Actually Changes Claude's Behavior in a System Prompt

### Identity Placement
- Identity statements at the very top have disproportionate impact
- "You are X" before anything else sets the frame for the entire session
- Generic identity ("You are a helpful assistant") does nothing — specific identity with clear boundaries works

### Format Hierarchy
- Short, punchy rules stick better than long explanations
- "Delegate first, implement last" beats a paragraph about why delegation matters
- Decision trees (when X → do Y) change behavior more than principles — principles are interpretive, decision trees are mechanical
- Anti-patterns called out explicitly help because they name the thing Claude is about to do wrong

### Attention Curve
- The first 200 words matter most — attention degrades with document length
- Front-load identity and the most critical behavioral shifts
- Operational reference tables can go later — they're looked up, not internalized

### XML vs Markdown
- Claude was trained on XML-delimited structures (confirmed by Anthropic docs)
- XML tags provide parsing boundaries that reduce misinterpretation
- No canonical "best" tag names — semantic, descriptive names work best
- Nesting provides hierarchy; consistency in tag names throughout is critical
- Combining XML structure with emphasis patterns (`<IMPORTANT>`) proven effective in existing plugins

## Claude's Actual Failure Modes as Orchestrator

These are the specific behaviors the system prompt must override:

1. **Defaults to doing work itself** — When user says "fix X," instinct is grep → read → edit, not "who should do this?" Delegation feels like overhead.
2. **Thinks linearly** — Does tasks sequentially when 3-4 could dispatch in parallel.
3. **Doesn't create infrastructure** — Never proactively creates session directory, MEMORY.md, or thinks about persistence. Just starts working.
4. **Verbose with user** — Explains reasoning, narrates approach, pads responses. Orchestrator should give status updates and results.
5. **Re-spawns instead of resuming** — When agent returns incomplete, spawns fresh one instead of resuming with preserved context.
6. **Doesn't track state** — No MEMORY.md discipline. Each task is ad-hoc. Subagents rediscover what previous ones already found.
7. **Doesn't specify models** — Defaults to not setting `model` param (inherits sonnet). Should actively choose haiku for most work.
8. **Over-specifies obvious, under-specifies critical** — Prompts are either too vague ("fix the errors") or unnecessarily verbose for simple edits. Sweet spot: exact paths, lines, exit criteria, minimal prose.

## What the System Prompt Must Achieve

1. Make delegation feel like the PRIMARY action, not an optimization
2. Create a ritual (session setup) that establishes the orchestrator workflow
3. Address failure modes by name — not "be efficient" but "you will want to read this file yourself; stop, dispatch"
4. Inline the subagent directive so no Skill tool call is needed at runtime
5. Keep total length under ~400 lines — dense, scannable, actionable
6. Use XML structure for reliable parsing of distinct sections

## Loading Mechanism Decision

| Mechanism | Identity? | Always present? | Recommendation |
|---|---|---|---|
| `--system-prompt` | Yes (replaces default) | Yes | Risky — loses base tool instructions |
| `--append-system-prompt` | Yes (adds to default) | Yes | **Best option** — preserves base + adds identity |
| Skill (Skill tool) | Awkward mid-conversation | On-demand only | Keep as reference for non-orchestrator sessions |
| CLAUDE.md | Instructions framing | Yes | Not identity-level |

**Winner: `--append-system-prompt`** with an alias like `alias orchestrate='claude --append-system-prompt="$(cat path/to/ORCHESTRATOR.md)"'`
