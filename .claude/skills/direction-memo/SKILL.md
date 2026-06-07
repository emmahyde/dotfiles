---
name: direction-memo
description: Mid-task research injector. Given current task context, fans out to Hacker News, lobste.rs, and arXiv in parallel, applies trust filters, runs adversarial review, and returns a 5-bullet "direction memo" with each finding tagged supports / contradicts / redirects / orthogonal. Use when at a decision point and want trusted prior art before committing — not for standalone deep research (use feynman:research for that). Triggers on /direction-memo, "what does prior art say", "supplement with research", "any literature on this", "before I commit, check".
---

# direction-memo

You inject linked, audited findings into the current task — not a standalone
research brief. Output is a 5-bullet memo keyed to the user's *current
direction*, with each finding tagged for how it relates.

## When to invoke

- User at decision point: "should I do X or Y?"
- About to commit to architectural choice
- "Is this approach standard / novel / wrong?"
- Mid-implementation doubt — want trusted prior art

NOT for: standalone deep research (→ feynman:research), single-source
fact lookup (→ tavily-search), or codebase questions (→ Explore).

## Inputs

1. **Current task** — read from conversation context, not invented
2. **Direction under consideration** — explicit hypothesis or approach
3. **Optional --sources** — restrict to subset (default: all 3)

## Pipeline

### Step 1 — Frame the question

Echo back, one sentence each:

```
┌─ Direction memo ─────────────────────────────
│ Task      : <what user is doing>
│ Direction : <approach being considered>
│ Question  : <what would change the call>
│ Sources   : HN + lobste.rs + arXiv
└──────────────────────────────────────────────
```

If question can't be sharpened to one sentence, ask one clarifier and stop.

### Step 2 — Source-typed fan-out (parallel, single message, multiple Agent calls)

Dispatch three haiku agents — disjoint sources, same brief shape:

| Agent  | Source          | Tool                                      |
|--------|-----------------|-------------------------------------------|
| hn     | Hacker News     | hackernews-mcp / Algolia HN search        |
| lob    | lobste.rs       | curl https://lobste.rs/search.json?q=...  |
| arx    | arXiv           | arxiv-mcp-server / arxiv API              |

Each agent gets:
- Question (verbatim from Step 1)
- Source-specific search recipe
- Trust filter (see Step 3)
- Output spec: ≤5 candidate findings as `score|date|author|title|url|snippet`

Fall-back: if MCP not installed, agent uses WebFetch on source-specific URLs:
- HN: `https://hn.algolia.com/api/v1/search?query=…&tags=story`
- lobsters: `https://lobste.rs/search.json?q=…`
- arXiv: `http://export.arxiv.org/api/query?search_query=…`

### Step 3 — Trust filter (per source)

| Source     | Filter                                                        |
|------------|---------------------------------------------------------------|
| HN         | story score ≥ 50 OR commenter karma ≥ 1000 OR domain in       |
|            | `{anthropic.com, openai.com, github.blog, cloudflare.com,     |
|            |  citusdata.com, jepsen.io, danluu.com, lwn.net}`              |
| lobste.rs  | score ≥ 10 OR submitter karma ≥ 100 OR tag in `{ask,programming,distributed,security}` |
| arXiv      | citation count ≥ 5 OR last 30 days OR cs.* primary category   |

Drop everything else. Quantity is not the goal — 5 trusted > 50 noisy.

### Step 4 — Adversarial review (borrow feynman:reviewer pattern)

Spawn one **opus** review agent on the merged candidate list. Apply these
gates (subset of feynman:reviewer):

- **FATAL source**: paywalled, dead link, behind login, AI-generated farm
- **MAJOR**: single-source claim, no corroboration across the 3 sources
- **MINOR**: stale (>3yr) but still relevant

Reviewer also tags each survivor for **task relation** — this is the
key new gene:

- `SUPPORTS`   — direct evidence for current direction
- `CONTRADICTS`— direct evidence against
- `REDIRECTS`  — suggests a better path
- `ORTHOGONAL` — adjacent prior art, not load-bearing

### Step 5 — Render direction memo

Output exactly this shape — mid-task injection, not full brief:

```
┌─ ⚡ Direction memo ────────────────────────────────────────
│ Re: <one-line restatement of task + direction>
│
│ • [SUPPORTS]   <8-15 word claim>
│   <source>, <date>, <author>
│   "<inline quote ≤80 chars>"
│   <url>
│
│ • [CONTRADICTS] <claim>
│   <source>, <date>, <author>
│   "<quote>"
│   <url>
│
│ • [REDIRECTS]  <claim>
│   <source>, <date>, <author>
│   "<quote>"
│   <url>
│
│ … (5 bullets max, drop sections that have no qualifying findings)
│
│ Net read: <one sentence — keep / pivot / dig deeper>
└────────────────────────────────────────────────────────────
```

**Output discipline:**
- No bullet w/o url + quote
- "Net read" is mandatory and ≤25 words
- If reviewer flags 0 survivors, say so — don't pad

## Source recipes (no-MCP fallback)

Plain-curl recipes for when MCPs aren't installed:

```bash
# HN via Algolia
curl -sG 'https://hn.algolia.com/api/v1/search' \
  --data-urlencode "query=$Q" --data-urlencode 'tags=story' \
  --data-urlencode 'numericFilters=points>50' | jq '.hits[]'

# lobste.rs
curl -sG 'https://lobste.rs/search.json' \
  --data-urlencode "q=$Q" --data-urlencode 'what=stories' | jq '.[]'

# arXiv
curl -sG 'http://export.arxiv.org/api/query' \
  --data-urlencode "search_query=all:$Q" \
  --data-urlencode 'sortBy=relevance' --data-urlencode 'max_results=10'
```

## Output anti-patterns

- ✗ Full research brief (use feynman:research)
- ✗ Bullets without source tag
- ✗ "Net read: more research needed" — be specific or omit
- ✗ Quoting search snippets — fetch + quote actual passage
- ✗ Padding to 5 bullets w/ low-trust filler

## Why this skill exists

Existing options:
- `feynman:research` — too heavy mid-task, generic web sources
- `tavily-research` — quick but no source typing or audit
- `tavily-search` — single-source, no audit
- arXiv MCP / HN MCP alone — single-source, no synthesis

Gap = task-anchored, source-typed, audited. This fills it.
