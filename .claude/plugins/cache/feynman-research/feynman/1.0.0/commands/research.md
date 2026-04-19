---
description: "Full multi-agent investigation with parallel researchers, source verification, adversarial review, and provenance tracking"
argument-hint: "<topic>"
allowed-tools: ["Bash(mkdir *)", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"]
---

# Deep Research: "$ARGUMENTS"

Run a thorough, source-heavy investigation that produces a cited research brief with provenance tracking.

## Phase 1: Plan

1. **Parse the topic** — What's being asked? What type of evidence answers it?
2. **Determine scale:**
   - Narrow factual question → 2 researcher agents
   - Broad survey or literature review → 3-4 researchers with disjoint focus areas
   - Cross-domain → 3-4 researchers split by domain
3. **Identify source strategy:**
   - Academic / biomedical → bioRxiv MCP, WebSearch for arXiv/PubMed/Scholar
   - Clinical / medical → Clinical Trials MCP, CMS Coverage MCP, ICD-10 MCP
   - Market / financial → WebSearch for SEC filings, analyst reports, financial sources
   - Technical → WebSearch, GitHub repos, official docs
   - General / current → WebSearch + WebFetch
4. **Generate slug** — Short, lowercase, hyphenated, max 5 words
5. **Create output directory** — `mkdir -p outputs/.plans`
6. **Write plan** to `outputs/.plans/<slug>.md`:
   - Key sub-questions to answer
   - Agent assignments (who researches what, with which tools)
   - Acceptance criteria

Show the plan briefly, then proceed.

## Phase 2: Research

**Launch all researcher agents simultaneously in a single message.** Use `subagent_type: "feynman:researcher"` for each.

Each agent gets a distinct focus dimension and writes to its own file:

- Agent 1: `outputs/<slug>-research-<focus1>.md`
- Agent 2: `outputs/<slug>-research-<focus2>.md`
- Agent 3: `outputs/<slug>-research-<focus3>.md`
- (Agent 4 if needed)

**Example researcher prompt:**
```
Investigate [TOPIC] with focus on [DIMENSION].

Write your findings to `outputs/<slug>-research-<focus>.md`.

Prioritize [SOURCE TYPES]. Use [SPECIFIC MCP TOOLS] for [DOMAIN].

Key questions to answer:
1. [sub-question from plan]
2. [sub-question from plan]
```

Include the key sub-questions from the plan relevant to each agent's dimension. Give each agent enough context to work independently.

## Phase 3: Evaluate & Loop

After all researchers return:

1. Read all research files
2. **Gap analysis:**
   - Any key sub-questions unanswered?
   - Critical claims with only one source?
   - Contradictions needing resolution?
   - Researchers that hit dead ends on important dimensions?
3. **Decision:**
   - Coverage sufficient → Phase 4
   - Gaps exist → spawn 1-2 targeted follow-up `feynman:researcher` agents (max 1 extra round)

## Phase 4: Synthesize

Write the brief directly — do NOT delegate this. Synthesis requires seeing all evidence together.

**Write to `outputs/<slug>-draft.md`:**

```markdown
# [Descriptive Title]

## Executive Summary
2-3 paragraphs: key findings, confidence level, implications.
Bottom line up front.

## [Thematic Section 1]
Findings organized by THEME, not by source.
Every factual claim gets inline citations [1], [2].

## [Thematic Section 2]
...

## Conflicts & Open Questions
Where sources disagree. What remains uncertain.

## Implications
What this means. What actions or decisions follow.

## Sources
[1] Title — URL (date)
[2] Title — URL (date)
```

**Rules:** Organize by theme. Preserve conflicts. Label inferences. Every claim maps to a source.

## Phase 5: Verify

Spawn a `feynman:verifier` agent:

```
Verify the research brief at `outputs/<slug>-draft.md`.
Research files are at `outputs/<slug>-research-*.md`.
Save verified output to `outputs/<slug>-verified.md`.
```

## Phase 6: Review

Spawn a `feynman:reviewer` agent:

```
Review the research brief at `outputs/<slug>-verified.md`.
Save review to `outputs/<slug>-review.md`.
```

**After review returns:**
- FATAL issues → fix them in the brief
- MAJOR issues → fix or move to Open Questions
- ACCEPT with only MINOR → proceed

## Phase 7: Deliver

1. Save final brief to `outputs/<slug>.md`
2. Create `outputs/<slug>.provenance.md`:
   ```
   # Provenance: <slug>
   - Date: [today]
   - Topic: [original question]
   - Research rounds: [1 or 2]
   - Researcher agents: [count and focus areas]
   - Sources consulted: [total evidence entries]
   - Sources in final: [count in Sources section]
   - Review verdict: [ACCEPT/REVISE/REJECT]
   - Fatal issues: [count]
   - Plan: outputs/.plans/<slug>.md
   - Research files: [list]
   ```
3. Present findings to the user
4. Offer to capture into Second Brain if available (`garden_capture` / `source_ingest`)
