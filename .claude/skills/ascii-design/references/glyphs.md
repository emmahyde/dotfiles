# Character inventory

Width class per character, and the Tier A degradation of every Tier B form.

- `N` — one cell everywhere. Shorthand here for Unicode's `Na` (Narrow) and `N` (Neutral), which
  behave identically for our purposes; `unicodedata.east_asian_width()` returns them separately.
- `A` — East-Asian Ambiguous: one cell in a Latin locale, two in a CJK-configured one.
- `W` — Wide, two cells everywhere.

## Tier A
*Safe in any font, any locale, any terminal, and inside source code.*

All of these are `N`.

| Job | Characters |
|---|---|
| box edges | `-` `\|` |
| box corners and tees | `+` |
| arrowheads | `>` `<` `^` `v` |
| diagonals | `/` `\` |
| event capsule | `(` `)` |
| store / index | `[` `]` |
| set or group | `{` `}` |
| dashed fill | `.` `'` |
| emphasis rule | `=` `#` |
| gate marker | `<>` |
| narration lead | `*` |

## Tier B
*Adds U+2500–U+259F: box drawing, then the block elements. Safe wherever UTF-8 renders in a real
monospace font.*

Every character in this range is `A`, not `N`. That is the width assumption Tier B makes, and it is
a real one: a box whose walls are `A` and whose text is `N` does **not** scale as a unit. Under a CJK
locale a `┌─────┐` top edge measures 14 cells while the `│ abc │` under it measures 9, so the box
shears open. Only a picture built from box-drawing and nothing else — no labels — survives the
doubling intact, and no useful diagram is that.

Tier B is therefore a bet, not a guarantee: it assumes every reader is in a Latin locale, which for a
repo's own docs and PR bodies is usually true and is worth the legibility. Tier A is the only tier
with no width assumption at all. When you do not know the audience's locale, that is the answer, and
`shape.py --tier a` will render the same diagram there. `shape.py` reports the exact shear in cells
for whatever it emits, so the bet is always stated rather than assumed.

| Job | Light | Heavy | Double | Rounded | Dashed | Tier A |
|---|---|---|---|---|---|---|
| horizontal | `─` | `━` | `═` | `─` | `╌` `┈` | `-` |
| vertical | `│` | `┃` | `║` | `│` | `╎` `┊` | `\|` |
| top left | `┌` | `┏` | `╔` | `╭` | | `+` |
| top right | `┐` | `┓` | `╗` | `╮` | | `+` |
| bottom left | `└` | `┗` | `╚` | `╰` | | `+` |
| bottom right | `┘` | `┛` | `╝` | `╯` | | `+` |
| tee down | `┬` | `┳` | `╦` | | | `+` |
| tee up | `┴` | `┻` | `╩` | | | `+` |
| tee right | `├` | `┣` | `╠` | | | `+` |
| tee left | `┤` | `┫` | `╣` | | | `+` |
| cross | `┼` | `╋` | `╬` | | | `+` |
| shadow | `░` | | | | | `:` |

Meaning assignments, fixed by SKILL.md rule 4: light = a step or call, heavy = an actor or class,
double = an external boundary, rounded + dashed = narration with no symbol, light with a `├──┤` shelf
under the top edge = a datastore.

`░` is the one exception to the rule that a diagram's characters carry meaning: as a shadow under a
box's right and bottom edges it says nothing, and is there to lift a container off the page. It is
`N`, so unlike the box art it draws it does not widen in a CJK locale — which means a shadowed box
shears by exactly as much as an unshadowed one, no more.

## Ambiguous
*Never use outside a Tier C gutter. Each renders one cell for you and two for a colleague with a
CJK locale, which shears the line silently.*

`→` `←` `↑` `↓` `▶` `◀` `▲` `▼` `●` `○` `◆` `◇` `■` `□` `▪` `·` `…` `±` `×` `÷` `§` `¶`

No exceptions, including `·` (U+00B7). It is the obvious choice for a narration lead and it is
wrong: a narration line usually sits inside a box, so a width shift moves the closing wall and the
box shears. The narration lead is ASCII `*` in every tier for exactly this reason.

## Tier C badges
*Nominally `W` (two cells), but the real advance width inside a GitHub or Slack code fence varies by
platform. List rows only, never on a line that also carries box art.*

`🟢` `🔴` `🟡` `🔵` `⚪` `🗄` `🌐` `⚠️` `🆕`

`⚠️` is a base character plus a U+FE0F variation selector: two code points, one glyph, and some
terminals render it one cell wide despite the selector. The linter counts it as two, so it is the
one badge whose measured width and rendered width can disagree. Prefer `[!!]` anywhere alignment
matters.

## Blocks and shading
*The upper half of the Tier B range, and `A` like the rest of it. The shades `░ ▒ ▓` are the only
`N` characters here, which is not a reason to prefer them; a bar mixing shades and eighths would put
two width classes in one run.*

`█` `▉` `▊` `▋` `▌` `▍` `▎` `▏` (eighths, right to left) and `░` `▒` `▓` (25 / 50 / 75 percent).

A bar built from eighths gives eight times the resolution of one built from `#`, at the same Tier B
width assumption as the box art around it:

```
 [ok] merged  ████████████████████▌   41 of 48
 [wt] open    ██████▏                 12 of 48
 [er] failed  █▌                       3 of 48
```

## What never appears in a diagram

- Tabs. They expand differently per viewer; a tab inside a box guarantees shear.
- Trailing whitespace. Invisible, and it makes every future diff of the diagram noisy.
- Combining marks and zero-width joiners. Width zero, so a column scan cannot see them, and they
  break `cut`, `awk`, and every naive text tool downstream.
- Non-breaking space (U+00A0). Looks exactly like a space and breaks word-splitting silently.
