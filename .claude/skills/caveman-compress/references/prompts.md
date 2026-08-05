# Canonical caveman compress / decompress prompts

Source technique: github.com/wilpel/caveman-compression

## Direction of trust

- **Compress** = drop *predictable* grammar. Safe and lossless-in-practice — facts are kept verbatim.
- **Decompress** = *synthesize* grammar + connectives. Lossy UPWARD: it invents relationships ("because/therefore/however"). NEVER treat decompressed instruction/memory text as source of truth. Use only to render compressed content for a human, on request. The compressed file stays canonical.

Agents consume compressed text directly — no decompress step needed; LLMs reconstruct dropped grammar while parsing.

## COMPRESS prompt

```
You are a caveman compression expert. Aggressively remove all stop words and grammatical scaffolding while preserving meaning.

CORE STRATEGY:
1. Remove articles, auxiliary verbs, and redundant words. Keep only content words that carry semantic meaning.
2. Use simple, common words. If there's a simpler word, use it. Think like a caveman.

ALWAYS REMOVE:
- Articles: a, an, the
- Auxiliary verbs: is, are, was, were, am, be, been, being, have, has, had, do, does, did
- Common prepositions when meaning stays clear: of, for, to, in, on, at
- Pronouns when context is clear: it, this, that, these, those
- Pure intensifiers: very, quite, rather, somewhat, really, extremely

ALWAYS KEEP:
- All nouns (people, places, things, concepts)
- All main verbs (actions, not auxiliaries)
- All adjectives that add meaning
- All numbers and quantifiers (at least, approximately, more than, 15, many)
- Uncertainty qualifiers (what sounded like, appears to be, seems, might)
- Critical prepositions that change meaning (from, with, without, stuck to)
- Time/frequency words (every Tuesday, weekly, daily, always, never)
- Names, titles (Dr., Mr., Senator)
- Technical terms and domain-specific language

BE SMART ABOUT:
- Keep prepositions when they define relationships: "made from wood" (keep from), "system for processing" (remove for)
- Keep "in/on/at" when they specify location/position, remove when just grammatical
- Remove "is/are/was/were" unless part of passive voice that matters
- Keep negations (not, no, never, without)

EXAMPLES:

"Caveman Compression is a semantic compression method for LLM contexts"
→ "Caveman Compression semantic compression method LLM contexts."

"It removes predictable grammar while preserving the unpredictable content"
→ "Removes predictable grammar preserving unpredictable content."

"The system was designed to process data efficiently"
→ "System designed process data efficiently."

"There were at least 20 people"
→ "At least 20 people."

"Made from wood and metal"
→ "Made from wood and metal."

Output ONLY the caveman compressed text, nothing else.

TEXT TO COMPRESS:
{text}
```

## DECOMPRESS prompt (human-facing render only — see Direction of trust)

```
You are a language expansion expert. Convert the following caveman-compressed text back into proper, fluent English while preserving ALL semantic information.

The caveman text uses:
- Very short sentences (2-5 words)
- No connectives
- Active voice
- Concrete language
- Minimal articles

Your task:
1. Expand sentences to natural English length
2. Add appropriate connectives (because, therefore, however, etc.)
3. Add articles (a, an, the) where natural
4. Ensure smooth flow between sentences
5. Maintain all facts, constraints, and logical steps
6. Use proper grammar and style

Output ONLY the expanded English text, nothing else.

CAVEMAN TEXT TO EXPAND:
{text}
```
