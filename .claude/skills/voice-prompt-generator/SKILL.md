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

## Bot Name

Each generated prompt gets a bot name: the user's **first name** (from their GitHub profile) + `BOT`, rendered in Mathematical Monospace Unicode so it looks like `𝙺𝙰𝚂𝙴𝚈𝙱𝙾𝚃`.

Generate it with:

```python
def to_monospace(s):
    return ''.join(chr(0x1D670 + ord(c) - ord('A')) if 'A' <= c <= 'Z' else c for c in s.upper())

# e.g. first_name = "Kassem" -> to_monospace("KASEYBOT") -> 𝙺𝙰𝚂𝙴𝚈𝙱𝙾𝚃
# e.g. first_name = "Emma"   -> to_monospace("EMMABOT")  -> 𝙴𝙼𝙼𝙰𝙱𝙾𝚃
```

Fetch the user's display name via `gh api /users/<USERNAME> --jq '.name'`, take the first word, append `BOT`, run through `to_monospace`. Store as `BOTNAME` for use in the ENSURE block.

## Pipeline

Execute these four steps in order. Each step produces an artifact. Show progress to the user between steps.

---

### Step 1: Fetch Comments Corpus

**Critical:** Fetch only PRs updated **before November 2025** to avoid AI-assisted comments contaminating the voice analysis. LLM-assisted responses have distinctive tells (em-dashes, "Valid catch", "Confirmed —", "Done —" + code block + SHA, "Acknowledged", numbered explanatory lists) that do not reflect the person's actual voice. Pre-Nov 2025 data is reliably human-written.

Use the REST search API with a date filter:

```bash
# Fetch PR numbers — note the updated:<2025-11-01 filter
gh api "/search/issues?q=commenter:<USERNAME>+org:<ORG>+is:pr+updated:<2025-11-01&per_page=50&sort=updated&page=1" \
  | jq -r '.items[].number'
```

Fetch pages of PR numbers until you have at least 200 non-trivial comments. Start with 3 pages (150 PRs); if the comment count after filtering is under 200, fetch additional pages (up to 6 total / 300 PRs) until the threshold is met. Report the final count to the user before proceeding. Then pull inline review comments with delimiters:

```bash
while read pr; do
  result=$(gh api "/repos/<ORG>/<REPO>/pulls/$pr/comments" 2>/dev/null \
    | jq -r ".[] | select(.user.login==\"<USERNAME>\") | \"---COMMENT---\n\" + .body" 2>/dev/null)
  [ -n "$result" ] && echo "$result"
done < pr_numbers.txt > raw_comments.txt
```

Target: ~200 non-trivial inline review comments. Filter out:
- Bot-generated comments (CI output, auto-generated changelogs)
- Empty or whitespace-only comments
- Comments that are just emoji reactions
- Any comment matching AI tell patterns: starts with "Valid catch", "Acknowledged", "Confirmed —", "Done —", "Good catch", "Good question"; contains em-dashes (`—`); uses "for defense-in-depth", "for parity with"

**Output format** for the corpus file (`./<username>-comments-corpus.md`):

```markdown
# <Name> - GitHub Comments Corpus

## Inline PR Review Comments

### <category label based on content>

- "exact comment text"
- "exact comment text"

### <next category>

- ...
```

Categorize by behavior pattern. Use whatever categories emerge naturally. Preserve exact text including formatting, links, code blocks, emoji, and casing.

Tell the user how many comments were fetched and from how many PRs.

---

### Step 2: Analyze Voice Patterns

Read the corpus. Write a structured analysis to `./<username>-voice-analysis.md`.

#### 2a. Tone Spectrum

Rate with evidence:
- Formal vs. Casual — register, contractions, abbreviations, casing
- Verbose vs. Terse — default length, what triggers longer responses
- Diplomatic vs. Direct — hedging patterns, how problems are stated
- Serious vs. Playful — humor frequency, style, targets

#### 2b. Structural Patterns

Document with examples:
- Code block usage (evidence? alternatives? decoration?)
- Link/reference formatting
- Sentence structure (fragments? complete? compound?)
- Subject pronoun dropping
- Parenthetical/aside usage
- Punctuation signatures (ellipsis, question marks on assertions, emoji, capitalization)

#### 2c. Vocabulary & Phrases (required — do not skip)

Build a table of recurring phrases mapped to their contexts. This is one of the highest-signal sections:

| Phrase | Context |
|--------|---------|
| ... | ... |

Include: contractions used, abbreviations, gut-feel negatives ("gives me the ick", "smells", "kinda weird"), indecision markers ("waffle"), hedges, distinctive openers, humor catchphrases.

#### 2d. Review Behavior

- How blocking issues are flagged (prefix? tone shift?)
- How non-blocking suggestions are framed
- Acknowledgment/resolution style
- How alternatives are proposed
- Escalation patterns (tagging colleagues, live resolutions)

#### 2e. Personality Markers (required — do not skip)

- Humor style, frequency, targets — be specific, quote examples
- Self-deprecation patterns
- How AI/tooling is referenced
- Collaborative vs. authoritative posture
- Self-correction behavior (does the wrong turn stay visible?)

---

### Step 3: Draft Voice Prompt

Read the analysis. Write a draft to `./<username>-voice-prompt-draft.md`.

Structure:
1. ENSURE block (see format below)
2. Identity (1-2 sentences)
3. Rules — inline format, one line each (see format below)
4. Vocabulary table — copy from analysis verbatim
5. Examples — 3-5 per category using code blocks
6. DO NOT — anti-patterns only an LLM would get wrong without the rule
7. COMMENTS CORPUS — trimmed to ~300 lines (see Step 4)

---

### Step 4: Refine into Final Prompt

Read the draft. Write the final to the output path.

**Rules format (emmabot-style — inline, no sub-bullets):**

```
## Rules

1. **Name.** One sentence imperative. No sub-bullets, no headers between rules.
2. **Name.** Same.
```

Examples and the corpus carry the illustrations — rules state principles only.

**Vocabulary section:** Copy the phrase table from the analysis verbatim. Keep it.

**Personality/humor rule:** Must be explicit. Include self-deprecation, performed reactions (visceral negatives, ALL CAPS moments), self-amused asides, and the key principle: humor is sparse, code-specific, never invented, never at a colleague.

**Examples section:** 3-5 per behavior category using fenced code blocks. Categories should include at minimum: terse/fragment, prefixed flags (blocking vs. question vs. consider/nit), code smell language, thinking aloud/self-correction, humor/personality.

**DO NOT:** Only rules an LLM would actually break without them. Cut anything obvious.

**Corpus:** Trim the full corpus to ~300 lines and append after DO NOT. Trim by value, not by count — apply these criteria:

Keep an example if it:
- Contains distinctive vocabulary not demonstrated elsewhere (gut-feel negatives, humor catchphrases, hedging phrases, indecision markers)
- Shows a code block used as evidence or alternative (not just prose)
- Demonstrates the bimodal length pattern — very short fragments OR long multi-paragraph architectural explanations both belong; cut medium-length generic ones
- Is the clearest instance of a behavior type (best `question:` showing uncertainty + reasoning, best `consider:` with embedded code, etc.)
- Contains self-correction with the wrong turn left visible
- Shows humor, personality, or surprise — keep all of these regardless of count

Cut an example if it:
- Makes the same voice point as another kept example with no additive signal
- Is a near-duplicate (same prefix, same length, same structure, different subject)
- Is a pure reactive with no distinctive phrasing ("yea" → keep one, cut the rest)
- Could have been written by anyone in that role — no signature vocabulary, no characteristic structure

The goal is maximum voice signal per line, not proportional representation. A category can end up with 1 example or 10 — follow the signal.

**ENSURE block format:**

```
<REQUIREMENTS>
<ENSURE>
When you have completed this review process, the final action of the workflow is to gather the collection of comments for the PR and then post each comment individually on the correct subset of changed lines in the diff on the PR. Double-check that each comment is linked to the correct range of lines for context. At the end of each comment, linebreak twice and then suffix the message with "— <BOTNAME>".

<EXAMPLE url="<pick a real PR URL from the corpus fetch if available, otherwise omit the url attribute>">
```
<pick a real comment from the corpus that shows the person's voice well — a question: or consider: with their characteristic style>

— <BOTNAME>
```
</EXAMPLE>
</ENSURE>

<ENSURE>
**No affirmative / no-action comments.** Every posted comment must carry an action item, a blocker, a question, or a non-obvious flag. Do NOT post agreements, validations, "looks right", "seems consistent", "LGTM", "makes sense", or any comment whose removal would not change what the author does next. If the only thing you have to say about a hunk is that it looks correct, post nothing on that hunk.
</ENSURE>

<ENSURE>
**Check existing PR comments before posting.** Before posting any new comment (review, inline, or issue), fetch and scan all existing comments on the PR (including prior bot comments and human comments). If your intended comment is effectively the same as an existing one, do NOT post a duplicate. Instead, in order of preference:

1. If your comment is a simple +1 / agreement on an existing comment, react with a thumbs-up emoji (👍) on that comment and post nothing.
2. If the existing comment is an inline or review comment AND you have further details to add, reply in the same inline thread with the added details rather than starting a new thread.
3. If no duplicate exists, you may post a new top-level inline comment.
4. New posted comments MUST be inline comments anchored to specific diff lines — never PR-level review summaries or issue comments.
</ENSURE>
</REQUIREMENTS>
```

Place the REQUIREMENTS block at the **top** of the file (before Identity) and **bottom** (after the corpus). Both copies identical.

**Output files:** Use the templates in `$SKILL_DIR/templates/` as the base structure. Read the appropriate template, replace all `{{PLACEHOLDER}}` tokens with generated content, and write the result.

| Output file | Template |
|---|---|
| `<username>-voice-prompt.md` | `templates/voice-prompt.md` |
| `<username>-voice-prompt-review-only.md` | `templates/voice-prompt-review-only.md` |

**Placeholder reference:**

| Placeholder | What to fill in |
|---|---|
| `{{BOTNAME}}` | Monospace bot name (e.g. `𝙺𝙰𝚂𝙴𝚈𝙱𝙾𝚃`) |
| `{{NAME}}` | Display name (e.g. `Kassem Sandarusi`) |
| `{{EXAMPLE_URL}}` | A real PR URL from the corpus fetch, or omit the attribute if none available |
| `{{EXAMPLE_COMMENT}}` | A real corpus comment showing their voice (prefer `question:` or `consider:` with characteristic style) |
| `{{IDENTITY}}` | 1-2 sentence identity summary |
| `{{RULES}}` | Inline numbered rules, one sentence each |
| `{{VOCABULARY_TABLE}}` | Phrase table copied verbatim from analysis |
| `{{EXAMPLES}}` | Categorized fenced code block examples |
| `{{DO_NOT}}` | Anti-pattern bullet list |
| `{{CORPUS}}` | Intelligently trimmed corpus (~300 lines) |

The review-only variant uses the same placeholders but `{{EXAMPLES}}` and `{{CORPUS}}` contain only pure reviewing comments — no responses to review on own PRs.

---

## After Completion

Tell the user:
1. Files created and their line counts
2. The generated BOTNAME
3. How to use: paste as system prompt, or reference via file
4. Suggest reviewing the corpus section and removing any comments that don't represent the desired voice
