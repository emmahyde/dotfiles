---
description: "Paper-focused literature review using bioRxiv, Clinical Trials, and academic search"
argument-hint: "<topic>"
allowed-tools: ["Bash(mkdir *)", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"]
---

# Literature Review: "$ARGUMENTS"

Run a structured literature review focused on academic papers and primary research sources.

## Phase 1: Scope

1. **Define the review question** — What specific knowledge gap does this address?
2. **Set boundaries:**
   - Time period (default: last 5 years unless historical context needed)
   - Source types: papers, preprints, clinical trials, systematic reviews
   - Inclusion/exclusion criteria for relevance
3. **Generate slug** and create `outputs/.plans/<slug>.md` with scope, key questions, and search strategy
4. `mkdir -p outputs/.plans`

Show the scope briefly, then proceed.

## Phase 2: Gather

Spawn 2-3 `feynman:researcher` agents in parallel, each focused on a different evidence source:

**Agent 1 — Preprint & Paper Search:**
```
Search for papers on [TOPIC] using bioRxiv MCP (search_preprints, get_preprint) and WebSearch for arXiv, PubMed, Google Scholar.
Focus on: [specific sub-questions]
Time period: [from scope]
Write to outputs/<slug>-research-papers.md
```

**Agent 2 — Clinical / Trial Evidence (if applicable):**
```
Search for clinical trials on [TOPIC] using Clinical Trials MCP (search_trials, get_trial_details).
Focus on: trial design, endpoints, enrollment, results
Write to outputs/<slug>-research-trials.md
```

**Agent 3 — Reviews & Context:**
```
Search for systematic reviews, meta-analyses, and authoritative commentary on [TOPIC].
Use WebSearch for review articles, guidelines, and expert commentary.
Write to outputs/<slug>-research-context.md
```

Adapt agents to the topic — not every review needs a clinical trials agent. Replace with domain-appropriate focus.

## Phase 3: Synthesize

Read all research files and write the review directly.

**Write to `outputs/<slug>-draft.md`:**

```markdown
# Literature Review: [Title]

## Background
Context and motivation. Why this question matters.

## Methods Landscape
How researchers approach this problem. Key methodologies, models, and paradigms.

## Key Findings
Organized by theme. What the literature shows.
Every claim cited [1], [2].

## Consensus & Disagreements
Where the field agrees. Where it doesn't. Why.

## Gaps in the Literature
What hasn't been studied. What's underpowered. What's contradictory.

## Future Directions
What research is needed next. Open questions.

## Sources
[1] Author et al. (Year) — "Title" — URL
```

**Rules:**
- Organize by theme, not chronologically
- Note level of evidence (RCT > observational > case report > expert opinion)
- Distinguish established consensus from emerging findings
- Flag preprints as not yet peer-reviewed

## Phase 4: Verify

Spawn a `feynman:verifier` agent:
```
Verify the literature review at outputs/<slug>-draft.md.
Research files at outputs/<slug>-research-*.md.
Save to outputs/<slug>-verified.md.
```

## Phase 5: Review

Spawn a `feynman:reviewer` agent:
```
Review the literature review at outputs/<slug>-verified.md.
Save review to outputs/<slug>-review.md.
Focus on: completeness of literature coverage, level-of-evidence claims, missing key papers, and whether consensus/disagreement characterization is fair.
```

Fix FATAL/MAJOR issues, then deliver.

## Phase 6: Deliver

1. Save final review to `outputs/<slug>.md`
2. Create `outputs/<slug>.provenance.md` with date, scope, agent assignments, source counts, review verdict
3. Present findings to the user
4. Offer Second Brain capture if available
