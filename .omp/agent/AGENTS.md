# OMP-only instructions

This file loads only inside oh-my-pi. Anything here depends on the OMP chat renderer and must not
be copied to `~/.claude/CLAUDE.md`, where the same markup would print as raw LaTeX.

## Colour in chat replies

The OMP chat renderer accepts LaTeX colour macros inside `$…$`. Use them by default for status and
for the token alphabet in every reply; never for decoration.

### Syntax

```text
$\textcolor{#4ade80}{\texttt{42 blocks, 0 errors}}$              text colour only
$\colorbox{#a3e635}{\textcolor{#1a2e05}{\textbf{ DONE }}}$        filled chip
$\fcolorbox{#facc15}{#1c1917}{\textcolor{#facc15}{\textbf{ ~ }}}$  outlined chip: border, fill, text
```

Chip label: `\textbf`, UPPERCASE, one space of padding each side, two words at most. Counts,
paths, and linter messages: `\texttt`.

### Contrast rule

The terminal is dark. Every chip is one of two things:

- **dark fill + near-white bold text**, or
- **bright fill + near-black bold text**.

Never mid-tone on mid-tone. Never a pastel fill (`#dcfce7`, `#fee2e2`, `#dbeafe`) on a dark ground;
those are light-mode colours and the text inside them vanishes. If the user switches to a light
theme they will say so; do not guess.

### Palette

Status chips:

| Chip | Fill | Text | Means |
|---|---|---|---|
| DONE, REWRITTEN, PASS | `#a3e635` | `#1a2e05` | finished and verified |
| ERROR, FAIL | `#991b1b` | `#fef2f2` | broken, or a linter error |
| WARN | `#facc15` | `#1c1917` | a warning, a soft risk |
| NEW | `#1e40af` | `#eff6ff` | did not exist before |
| SKIPPED, N/A | `#374151` | `#f9fafb` | deliberately not done |

Token chips (same alphabet as the ascii-design skill, rule 10):

| Token | Fill | Text | Means |
|---|---|---|---|
| `+` | `#a3e635` | `#1a2e05` | yes, present |
| `-` | `#374151` | `#f9fafb` | no, absent |
| `!` | `#991b1b` | `#fef2f2` | trap |
| `~` | `#facc15` | `#1c1917` | unbounded, keeps running |
| `$` | `#93c5fd` | `#0c1a3a` | costs something |
| `?` | `#fdba74` | `#1c1917` | unverified, an inference |
| `x` | `#991b1b` | `#fef2f2` | failed, refused |
| `n` | `#1e40af` | `#eff6ff` | new in this change |

Inline text colour when no chip is wanted, bright end of each hue so it reads on black:
green `#4ade80`, red `#f87171`, yellow `#fbbf24`, blue `#60a5fa`, grey `#9ca3af`.

### Placement

- A chip stands alone in its table cell. A `\colorbox` in a cell that also holds prose bleeds its
  fill across the whole cell. Status column for the chip, next column for the prose.
- Never inside a code fence; the renderer prints the macro verbatim there.
- Five hues, nine tokens, no more. A sixth hue means the reply is carrying two stories.
- Colour restates, never carries. The word or token is always present under the colour, so a
  paste that strips markup loses nothing.

## Display math in chat replies

`$$…$$` runs a 2-D layout engine: stacked fractions, stretchy brackets, limits above and below big
operators, matrices, `cases`, `align` columns, drawn radicals, labelled braces. Inline `$…$` stays
on one line and only maps symbols to Unicode.

Use display math for two things. Everything else is a code span or an ascii-design figure.

### Labelled decomposition: `\underbrace`

When a sentence would say "X is made of A (in file 1) plus B (in file 2)", draw it once:

```text
$$\underbrace{\text{persist}}_{\text{settings.ts}}
  + \underbrace{\text{register} \cdot \text{run}}_{\text{index.ts}}
  = \text{tweak}$$
```

- Labels are file names, layer names, or owners; never a second sentence.
- Three braces at most. Four means it is a table.
- `\text{…}` around every word, or the engine italicises letters as variables.

### Piecewise behaviour: `cases`

When behaviour depends on a condition and each branch fits in three words:

```text
$$\text{cadence}(n) = \begin{cases}
  5\text{ s}   & \text{first run} \\
  \text{grows} & \text{silent}    \\
  5\text{ s}   & \text{output}
\end{cases}$$
```

- Left column: the value or action. Right column: the condition. `&` separates, `\\` breaks.
- Name the function after the thing being decided (`cadence(n)`, `retry(k)`), not `f`.
- Five branches at most; past that it is a decision table in the ascii-design skill.

### Limits

- Colour macros work inside `$$` (verified 2026-09-28): a `\colorbox` chip can sit under an
  `\underbrace`, and `\textcolor` can tint a `cases` branch. Same palette and contrast rule as
  chips; colour the value column, never the condition column.
- Not inside a table cell; the block breaks the row.
- One display block per reply section. Two adjacent blocks read as an equation sheet.
- Math fonts (`\mathbb`, `\mathcal`) and Greek only when the code uses them. A byte count is not
  $\beta$.
- Same paste rule as colour: the words are all present in the source, so a stripped copy still
  reads.
