---
name: external-ai-agents
description: Use when stuck in loops, need fresh perspective, or want to simulate multiple viewpoints - invokes cursor agent or gemini CLI as external subagents for model diversity and outside opinions
---

# External AI Agents

Invoke Cursor or Gemini CLI tools as subagents for fresh perspectives, breaking loops, or multi-perspective simulation.

## When to Use

- **Stuck in a loop** - same approach failing repeatedly, need outside view
- **Multi-perspective review** - simulate architect vs implementer, security vs velocity
- **Model diversity** - different training = different blind spots
- **Sanity check** - "am I overcomplicating this?"

## Invocation Patterns

### Basic (small output expected)

```bash
cursor agent --prompt "Review this approach: ..."
gemini --prompt "What am I missing here: ..."
```

### File-based (large output, searchable)

```bash
cursor agent --prompt "..." > /tmp/cursor-review-$(date +%s).md
gemini --prompt "..." > /tmp/gemini-analysis-$(date +%s).md

# Then grep for key insights
grep -i "problem\|issue\|suggest\|instead" /tmp/cursor-review-*.md
```

### With context file

```bash
cursor agent --prompt "Review this code for issues: $(cat src/worker.rb)"
gemini --prompt "$(cat PLAN.md)" --prompt "What holes are in this plan?"
```

## Integration with Orchestration

### With subtask (parallel perspectives)

```bash
# Get two perspectives on same problem
subtask ask "Review the auth implementation in src/auth/ for security issues" &
cursor agent --prompt "Review src/auth/ for security issues" > /tmp/cursor-auth.md &
wait

# Compare findings
diff <(grep -i "issue\|vuln" /tmp/cursor-auth.md) \
     <(subtask show auth-review | grep -i "issue\|vuln")
```

### With Task tool (Claude orchestrates)

Dispatch external agent, then synthesize:

```bash
# In background
gemini --prompt "Analyze the performance bottleneck in $(cat profile.json)" > /tmp/gemini-perf.md

# Claude reads and synthesizes
# Use Read tool on /tmp/gemini-perf.md, combine with own analysis
```

## Multi-Perspective Simulation

### Architect vs Implementer

```bash
cursor agent --prompt "As a senior architect: Is this design over-engineered? $(cat DESIGN.md)" > /tmp/architect.md
gemini --prompt "As an implementer who has to build this: What's impractical? $(cat DESIGN.md)" > /tmp/implementer.md
```

### Red Team / Blue Team

```bash
gemini --prompt "Find security holes in: $(cat src/api/auth.rb)" > /tmp/red-team.md
cursor agent --prompt "How would you defend against: $(cat /tmp/red-team.md)" > /tmp/blue-team.md
```

### Devil's Advocate

```bash
# When you're convinced of an approach
gemini --prompt "Argue against this decision. Be harsh: We chose PostgreSQL over MongoDB because..."
```

## Breaking Loops Pattern

When stuck after 3+ similar attempts:

1. **Capture context**: What you've tried, what's failing
2. **Ask for reframe**: "What am I missing?" not "How do I fix X?"
3. **File output**: Large responses need grep filtering

```bash
cat << 'EOF' > /tmp/stuck-context.md
## What I'm trying to do
[goal]

## What I've tried
1. [approach 1] - failed because [reason]
2. [approach 2] - failed because [reason]

## Current error/blocker
[details]
EOF

gemini --prompt "$(cat /tmp/stuck-context.md)" --prompt "What assumption am I making that might be wrong?" > /tmp/fresh-perspective.md

# Extract actionable suggestions
grep -A2 -i "try\|suggest\|instead\|consider" /tmp/fresh-perspective.md
```

## Output Management

| Scenario | Approach |
|----------|----------|
| Quick sanity check | Direct stdout |
| Detailed review | File + grep |
| Comparison | Multiple files + diff |
| Synthesis needed | File, then Read tool |

## Common Mistakes

- **Too much context** - trim to essentials, models get lost in noise
- **Asking "how to fix"** - ask "what am I missing" for better reframes
- **Ignoring output** - file it, grep it, don't let insights vanish
- **Single perspective** - the value is in *multiple* viewpoints
