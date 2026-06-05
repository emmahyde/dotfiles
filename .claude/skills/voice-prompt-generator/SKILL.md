---
name: voice-prompt-generator
description: "Generate a writing voice/style prompt for any GitHub user by analyzing their PR comments. Pipeline: fetch comments corpus -> analyze voice patterns -> draft prompt -> refine into final prompt. Uses gh CLI."
user_invocable: true
---

# Voice Prompt Generator

Generate a writing-style prompt from a GitHub user's PR review comments. The output is a system prompt that reproduces the user's voice for AI-generated comments.

## Arguments

- `$ARGUMENTS` — parsed as: `<gh-username> [--comments N] [--org ORG] [--output PATH]`
  - `gh-username` (required): GitHub username to analyze
  - `--comments N`: number of comments to fetch (default: 200)
  - `--org ORG`: scope search to a GitHub org (optional, recommended for speed)
  - `--output PATH`: where to write the final prompt (default: `./<username>-voice-prompt.md`)

If `$ARGUMENTS` is empty, ask the user for at least the GitHub username.

## Pipeline

Execute these four steps in order. Each step produces an artifact. Show progress to the user between steps.

---

### Step 1: Fetch Comments Corpus

Use `gh` CLI to fetch the user's PR review comments and issue comments. Write results to `./<username>-comments-corpus.md`.

```bash
# PR review comments (inline code review) — most valuable for voice analysis
gh api graphql --paginate -f query='
query($cursor: String) {
  search(query: "commenter:<USERNAME> org:<ORG> is:pr", type: ISSUE, first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        title
        reviews(author: <USERNAME>, first: 10) {
          nodes {
            body
            comments(first: 20) {
              nodes { body }
            }
          }
        }
      }
    }
  }
}'
```

If the GraphQL approach is too slow or hits rate limits, fall back to REST:

```bash
# Search for PRs the user commented on, then fetch review comments
gh api "/search/issues?q=commenter:<USERNAME>+org:<ORG>+is:pr&per_page=50&sort=updated" | \
  jq -r '.items[].number' | \
  while read pr; do
    gh api "/repos/<ORG>/<REPO>/pulls/$pr/comments" --jq ".[] | select(.user.login==\"<USERNAME>\") | .body"
  done

# Also fetch issue comments
gh api "/search/issues?q=commenter:<USERNAME>+org:<ORG>&per_page=50&sort=updated" | \
  jq -r '.items[] | "\(.repository_url | split("/") | .[-1]) \(.number)"' | \
  while read repo pr; do
    gh api "/repos/<ORG>/$repo/issues/$pr/comments" --jq ".[] | select(.user.login==\"<USERNAME>\") | .body"
  done
```

Adapt the queries as needed based on `--org` and `--comments` flags. The goal is to collect the requested number of non-trivial comments. Filter out:
- Bot-generated comments (CI output, auto-generated changelogs)
- Empty or whitespace-only comments
- Comments that are just emoji reactions

**Output format** for the corpus file:

```markdown
# <Name> - GitHub Comments Corpus

## Inline PR Review Comments

### <category label based on content>

- "exact comment text"
- "exact comment text"

### <next category>

- ...

## PR-level / Issue Comments

- "exact comment text"
- ...
```

Categorize comments by behavior pattern (e.g., "technical review", "blocking/questioning", "providing evidence", "suggestions with code", "terse acknowledgments", "casual/personality", "investigation deep dives", "decision making", "self-correction"). Use whatever categories emerge naturally from the data. Preserve the exact text including formatting, links, code blocks, emoji, and casing.

Tell the user how many comments were fetched and from how many PRs/issues.

---

### Step 2: Analyze Voice Patterns

Read the corpus from Step 1. Write a structured analysis to `./<username>-voice-analysis.md`.

Analyze across these dimensions:

#### 2a. Tone Spectrum

Rate and provide evidence for each axis:
- **Formal vs. Casual** — register, contractions, abbreviations, casing
- **Verbose vs. Terse** — default comment length, what triggers longer responses
- **Diplomatic vs. Direct** — how problems are stated, hedging patterns
- **Serious vs. Playful** — humor frequency, style, targets

#### 2b. Structural Patterns

Document with examples:
- How code blocks are used (evidence? alternatives? decoration?)
- How links/references are formatted and contextualized
- Sentence structure defaults (fragments? compound? subordinate clauses?)
- Subject pronoun dropping patterns
- Parenthetical/aside usage
- Punctuation signatures (ellipsis, question marks on assertions, exclamation frequency, emoji usage, capitalization habits)

#### 2c. Vocabulary & Phrases

Build a table of recurring phrases mapped to their contexts:
| Phrase | Context |
|--------|---------|
| ... | ... |

Note: contractions, abbreviations, technical vocabulary level, register consistency.

#### 2d. Review Behavior

Document patterns for:
- How blocking issues are flagged (label? tone shift? both?)
- How non-blocking suggestions are framed
- Acknowledgment/resolution style
- How alternatives are proposed (problem → current state → proposal?)
- Escalation patterns (pinging colleagues, noting live resolutions)

#### 2e. Personality Markers

Capture distinctive traits:
- Humor style and targets
- How AI/tooling is referenced
- Collaborative vs. authoritative posture
- Self-correction behavior

---

### Step 3: Draft Voice Prompt

Read the analysis from Step 2. Write a draft prompt to `./<username>-voice-prompt-draft.md`.

Structure the draft as a system prompt with:

1. **Opening line** — "You are writing [comment type] in the voice of [name]..." with a one-line identity summary
2. **Core Voice Rules** — numbered rules derived from the analysis. Each rule should be:
   - A clear imperative ("Default to terse", "Be casual", "Hedge when uncertain")
   - Followed by concrete sub-bullets with examples drawn from actual comments
   - Covering: length/verbosity defaults, register/formality, certainty calibration, severity labeling, code block usage, link formatting, punctuation habits, humor guidelines, collaboration style, self-correction behavior
3. **Anti-Patterns (DO NOT)** — explicit list of things that would break voice fidelity, derived from what the user does NOT do in the corpus

Use actual quotes from the corpus as examples throughout. The draft should be usable as-is but may be verbose.

---

### Step 4: Refine into Final Prompt

Read the draft from Step 3. Write the final prompt to the output path (default: `./<username>-voice-prompt.md`).

Refinement goals:
- **Compress** — remove redundant rules, merge overlapping guidance
- **Add real examples section** — group actual comments by behavior type (terse acknowledgments, casual one-liners, blocking issues, uncertain flags, hedging with evidence, proposing refactors, investigation dumps, deferring work, humor, collaboration, self-correction)
- **Tighten anti-patterns** — keep only the ones that an LLM would actually get wrong
- **Test mentally** — for each rule, ask: "Would an LLM without this rule produce noticeably wrong output?" If no, cut it.

**Output structure:**

```markdown
# Voice: <Name> — <Comment Type>

You are writing [type] as [name]. Match [their] voice exactly.

## Identity

[1-2 sentences: role, register, default behavior]

## Rules

1. **[Rule name].** [Imperative description with sub-bullets and examples]
2. ...

## Examples (real comments)

### <behavior category>

\`\`\`
actual comment text
\`\`\`

### <next category>
...

## DO NOT

- [Anti-pattern with brief explanation]
- ...
```

---

## After Completion

Tell the user:
1. Files created (corpus, analysis, draft, final prompt)
2. How to use the prompt (paste as system prompt or include via file reference)
3. Suggest they review the examples section and remove any comments that don't represent their desired voice
