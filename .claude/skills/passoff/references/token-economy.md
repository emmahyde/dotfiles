# Token Economy — Notation Choices for Passoff

Rationale behind the notation rules in SKILL.md. Read when authoring or defending a marker set, not on every emit.

## Tiebreaker: prefer English unless the symbol is strictly cheaper

Most short English words tokenize as **1 token** (`done`, `next`, `blocked`, `because`, `implies`, `high`, `low`). Symbols only beat them when they replace a *multi-word phrase*.

| English | Tokens | Symbol | Tokens | Use |
|---------|--------|--------|--------|-----|
| because | 1 | ∵ | 2 | **because** |
| therefore | 2 | ∴ | 2 | **therefore** (clearer at same cost) |
| implies | 2 | ⇒ | 3 | **implies** |
| leads to / causes | 2 | `>` | 1 | **`>`** (symbol wins) |
| at | 1 | `@` | 1 | **`@`** before paths (parses cleanly) |
| high/medium/low | 1 each | H/M/L | 1 each | **bare letters** in dense tag columns; bare words elsewhere |

Rule of thumb: reach for a symbol only when the English equivalent is two-or-more tokens. Otherwise English wins on readability for free.

## Use `>` not `→`

Both bare cost 1 token; `→` with surrounding spaces costs 2 — same as `>` with spaces. `>` wins because:

- ASCII — universal rendering, no font or locale risk.
- Programmer-familiar (`stdin > stdout`, comparison, JSX).
- No unicode glyph dependency for downstream consumers.

Caveat (repeated in SKILL.md because it bites at emit time): `>` at the **start of a line** is markdown blockquote and renders as one. Keep `>` inline only.

## Token-cheap candidates (≈1 token each in BPE)

Verified single-token in cl100k_base; Claude's tokenizer is comparable for ASCII.

- **English short words**: `done`, `next`, `todo`, `blocked`, `open`, `active`, `fixed`, `now`, `drop`, `kill`, `note`, `ref`, `wip` (2), `hold`, `skip`
- **ASCII symbols**: `>>>`, `<<<`, `-->`, `==>`, `!!!`, `???`, `$`, `#`, `@`, `!`, `?`
- **Single letters** (in context): `H`, `M`, `L`, `S`, `B`, `D`, `N`
- **Flow / relation (ASCII preferred)**: `>` (causes, leads to), `=>` (implies), `<-` (depends on)
- **Math** (only when English costs more): `∵` (because — English wins), `∴` (therefore — tie), `→` / `⇒` (avoid; `>` / `=>` cheaper and portable)

## Avoid

- Color emoji (🔗📍⚠️) — 2 tokens plus variation selectors.
- Geometric glyphs (▶✓⛔) — 2-3 tokens, rare in corpus.
- Nerd Font private-use area — 3+ tokens, no portability, no model semantics.
- Bracketed forms `[done]` — brackets cost 2 extra tokens; prefer bare `done`.

## Why English beat the alternatives

Token analysis across cl100k_base compared short ASCII English against CJK, emoji, Nerd Font glyphs, and geometric shapes. English won on combined readability and efficiency: CJK ties or loses on tokens while costing legibility for every reader and downstream tool, and glyph sets lose on both axes. That result is why the legend principle uses English defaults and treats symbols as the exception.
