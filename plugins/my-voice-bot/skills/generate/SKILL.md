---
description: "Generate a writing voice/style prompt for any GitHub user by analyzing their PR comments. Pipeline: fetch comments corpus -> analyze voice patterns -> draft prompt -> refine into final prompt. Uses gh CLI."
argument-hint: "<gh-username> <name> <org>"
user_invocable: true
---

# Voice Prompt Generator

Generate a writing-style prompt from a GitHub user's PR review comments. The output is a system prompt that reproduces the user's voice for AI-generated comments.

## Arguments

`$ARGUMENTS` — parsed as three positional args: `<gh-username> <name> <org>`

| Position | Required | Description                   |
| -------- | -------- | ----------------------------- |
| 1        | yes      | GitHub username to analyze    |
| 2        | yes      | First name (used for BOTNAME) |
| 3        | yes      | GitHub org to scope PR search |

If any argument is missing, ask the user for it before proceeding.

## Bot Name

Each generated prompt gets a bot name: the provided `<name>` + `BOT`, rendered in Mathematical Monospace Unicode so it looks like `𝙴𝙼𝙼𝙰𝙱𝙾𝚃`.

Generate it with:

```python
def to_monospace(s):
    return ''.join(chr(0x1D670 + ord(c) - ord('A')) if 'A' <= c <= 'Z' else c for c in s.upper())

# e.g. name = "Emma" -> to_monospace("EMMABOT") -> 𝙴𝙼𝙼𝙰𝙱𝙾𝚃
```

Take the `<name>` argument, append `BOT`, run through `to_monospace`. Store as `BOTNAME` for use in the ENSURE block.

## Pipeline

Execute these four steps in order. Each step produces an artifact. Show progress to the user between steps.

---

### Step 1: Fetch Comments Corpus

**Critical:** Fetch only PRs updated **before November 2025** to avoid AI-assisted comments contaminating the voice analysis. LLM-assisted responses have distinctive tells (em-dashes, "Valid catch", "Confirmed —", "Done —" + code block + SHA, "Acknowledged", numbered explanatory lists) that do not reflect the person's actual voice. Pre-Nov 2025 data is reliably human-written.

Use the batch-fetch script (`$SKILL_DIR/../../scripts/fetch-comments.sh`) which uses GraphQL to pull comments in ~3-6 API calls instead of hundreds of per-PR REST calls:

```bash
bash "$SKILL_DIR/../../scripts/fetch-comments.sh" <USERNAME> <ORG> \
  --cutoff 2025-11-01 \
  --min-comments 200 \
  --output ./<username>-comments.ndjson
```

This produces newline-delimited JSON with fields: `body`, `path`, `created_at`, `pr_url`, `repo`, `pr_number`, `type`, `url`.

Report the final count to the user before proceeding. Then filter and categorize the raw NDJSON into the corpus. Filter out:

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
| ------ | ------- |
| ...    | ...     |

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

**Examples section:** As many behavior categories as fit within the 600-line cap, each with 3-5 real comments in fenced code blocks. Categories emerge from the analysis — use whatever patterns are distinctive for this person. More categories = better voice coverage, so maximize the number of headers before the cap forces trimming.

**DO NOT:** Only rules an LLM would actually break without them. Cut anything obvious.

**Corpus:** The final prompt file must not exceed 600 lines total. The corpus fills whatever space remains after the ENSURE, Identity, Rules, Vocabulary, Examples, and DO NOT sections. Trim by value, not by count — apply these criteria:

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
<ENSURE>
When you have completed this review process, the final action of the workflow is to gather the collection of comments for the PR and then post each comment individually on the correct subset of changed lines in the diff on the PR. Double-check that each comment is linked to the correct range of lines for context. At the end of each comment, linebreak twice and then suffix the message with "— <BOTNAME>".

<EXAMPLE url="<pick a real PR URL from the corpus fetch if available, otherwise omit the url attribute>">
```

<pick a real comment from the corpus that shows the person's voice well — a question: or consider: with their characteristic style>

— <BOTNAME>

```
</EXAMPLE>
</ENSURE>
```

Place the ENSURE block at the **top** of the file (before Identity) and **bottom** (after the corpus). Both copies identical.

**Output files:** Use the templates in `$SKILL_DIR/templates/` as the base structure. Read the appropriate template, replace all `{{PLACEHOLDER}}` tokens with generated content, and write the result.

| Output file                              | Template                                |
| ---------------------------------------- | --------------------------------------- |
| `<username>-voice-prompt.md`             | `templates/voice-prompt.md`             |
| `<username>-voice-prompt-review-only.md` | `templates/voice-prompt-review-only.md` |

The corpus (`<username>-comments-corpus.md`) and analysis (`<username>-voice-analysis.md`) are freeform — let structure emerge from the data. No templates for those.

**Placeholder reference (final prompt templates):**

| Placeholder            | What to fill in                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `{{BOTNAME}}`          | Monospace bot name (e.g. `𝙴𝙼𝙼𝙰𝙱𝙾𝚃`)                                                                     |
| `{{NAME}}`             | Display name from `<name>` argument                                                                     |
| `{{EXAMPLE_URL}}`      | A real PR URL from the corpus fetch, or omit the attribute if none available                            |
| `{{EXAMPLE_COMMENT}}`  | A real corpus comment showing their voice (prefer `question:` or `consider:` with characteristic style) |
| `{{IDENTITY}}`         | 1-2 sentence identity summary                                                                           |
| `{{RULES}}`            | Inline numbered rules, one sentence each                                                                |
| `{{VOCABULARY_TABLE}}` | Phrase table copied verbatim from analysis                                                              |
| `{{EXAMPLES}}`         | Categorized fenced code block examples                                                                  |
| `{{DO_NOT}}`           | Anti-pattern bullet list                                                                                |
| `{{CORPUS}}`           | Intelligently trimmed corpus                                                                            |

The review-only variant uses the same placeholders but `{{EXAMPLES}}` and `{{CORPUS}}` contain only pure reviewing comments — no responses to review on own PRs.

---

## After Completion

Tell the user:

1. Files created and their line counts
2. The generated BOTNAME
3. How to use: paste as system prompt, or reference via file
4. Suggest reviewing the corpus section and removing any comments that don't represent the desired voice
