---
name: claude-dev-diagrams
description: "Make clean editorial SVG diagrams in the claude.dev blog style: the inline-SVG look (CSS-variable colours for light/dark, 1px square boxes, wide + narrow layouts) or the raster-era look (warm paper, pastel tone boxes, serif-italic captions). Flows, before/after panels, stacks, loops, simple charts. Also checks any SVG or HTML page for box collisions and text overflow. Use when asked for a diagram \"like the claude.dev / Anthropic blog\" or for clean explanatory SVGs."
---

# claude.dev-style SVG diagrams

Toolkit dir: `~/.omp/agent/managed-skills/claude-dev-diagrams/`

- `scripts/cdd.py`: JSON spec → clean SVG, lint, browser check, PNG render. It needs only Python 3 and Google Chrome. Pillow is an optional fallback.
- `examples/*.json`: faithful recreations of real claude.dev diagrams. `site-thread-loop.json` (site theme, wide + narrow) recreates `perf-loop`; the other three use the raster-era themes. Copy the closest one as a starting point.
- `references/*.png`: 13 original claude.dev diagrams, extracted from saved blog PDFs. Look at the closest one before you design.
- `references/site-svg/raw/*.svg`: 18 real inline SVGs from claude.dev posts (9 diagrams, each in a wide and a `-mobile` narrow variant), verbatim: colours are `var(--…)` only. Copy and edit these. `cdd.py render`/`check` supply the variables automatically.
- `references/site-svg/*.svg`: the same 18 with a light-theme `<style>` block added, for direct viewing only. That block overrides a host page's dark theme, so do not ship them. `INDEX.md` maps each file to its post.
- `references/html-effectiveness/*.svg`: 3 hand-written SVGs from Anthropic's `anthropics/html-effectiveness` example repo (`10-svg-illustrations.html`).

## Provenance

claude.dev uses two formats:

- **Raster posts** (for example "Seeing like an agent"): PNG files at `/media/<sha256>.png`, with no generator metadata. The `paper` and `sage` themes below recreate the PNG references.
- **Inline-SVG posts** (for example "How we made claude.ai faster" and "Automating eval design"): inline `<svg>` in `<figure class="art-diagram">`. The text is selectable. Each figure has two separately laid-out SVGs: `art-diagram-wide` and `art-diagram-narrow` (id suffix `-mobile`). The `site` theme reproduces this style.

Conventions of the inline site SVGs, measured across all 18:

- No hex colours. Every colour is `style="fill|stroke:var(--…)"`: `--ink`, `--ink-2`, `--viz-muted`, `--viz-m1`, `--viz-b9`, `--line`, `--line-soft`, `--bg`, `--fig-focal` (= accent). The same SVG therefore works in light and dark themes.
- 1px strokes (391 of 444). There are no `rx` corners: boxes are square. Arrowheads are separate open-chevron `<path>`s, not markers. Dashes are `3 4` or `4 4`.
- Text is 12–13px (sometimes 14–15px), weight 500/600, in the Anthropic Sans font stack. A per-id `<style>` sets the font.
- The viewBox is cropped tight to the content with fractional origin and size (for example `34 87 651 242.5`), and coordinates sit on half pixels. This suggests a generator that exports a computed bounding box, not hand-typed numbers [inference].
- `aria-hidden="true"` on the SVG. The surrounding figure carries the title and caption.

The `html-effectiveness` examples are a different, hand-written style: hex palette (ivory `#FAF9F5`, slate `#141413`, clay `#D97757`, oat `#E3DACC`, olive `#788C5D`, gray 150/300/500/700 `#F0EEE6 #D1CFC5 #87867F #3D3D3A`), 720×320 canvas, `rx="10"`, 1.5px strokes (2px for emphasis), 11px mono inside boxes, 12px sans outside, a `<style>` inside each SVG, and comments per element. All coordinates are hand-typed, and the hand placement causes collisions. In `13-flowchart-diagram.html`, `status` overlaps `test` by 30px and `rollback` overlaps `smoke` by 18×18px. In `10-svg-illustrations.html` (retry figure), the axis label "t = 0" runs into "try 1". Always run `check` on hand-placed layouts.

## Three themes. Pick one per diagram.

| theme | look | use for |
|---|---|---|
| `site` | no background (the host page paints `--bg`), square 1px boxes in `--line`, `--fig-focal` for the one emphasised element, 12–13px sans, mono caps eyebrows, small open chevrons, halo behind edge labels, tight-cropped viewBox, colours as CSS variables | new diagrams for a page that supports light and dark; anything matching current claude.dev posts |
| `paper` | taupe `#e8e6dc` surround, rounded `#faf9f5` card, 2.5px pastel-tone boxes (teal, lavender, blue, taupe), muted sans labels above boxes, serif-italic notes, open chevron arrows | matching the raster eval/cost diagrams |
| `sage` | flat `#faf9f5` page, bold letter-spaced CAPS eyebrows, pale green/yellow/neutral boxes, sage `#5a705a` emphasis frame or dark fill, dashed ghost boxes, solid arrowheads | matching the raster tools/caching diagrams |

### Site theme details

- **Output:** `build` writes `out.svg`. With a `"narrow"` block it also writes `out-mobile.svg` and `out.figure.html`: a paste-ready `<figure class="art-diagram">` that shows the wide SVG above 640px and the narrow one below.
- **Colours:** `style="fill:var(--ink,#141413)"`. The fallback after the comma makes the file render light on its own, and a host page that sets `--ink` etc. re-themes it. Set `"fallback": false` for exact site parity (no fallbacks). Lint warns on any hard-coded hex, because hex ignores dark mode.
- **Standalone files (markdown image, `<img>`, README):** the host page's CSS variables do not reach an SVG loaded as an image. Every colour falls back to light-theme ink and there is no background, so on a dark viewer (GitHub dark, a dark editor preview) the figure is nearly invisible. Put `{"type": "rect", "x": 0, "y": 0, "width": W, "height": H, "fill": "bg"}` first in `shapes` (W, H = `size`), rebuild, and widen `size` if text at the right edge is now clipped by the canvas. `render --scheme dark` does not test this, because it supplies the variables itself. To test, screenshot an HTML page with `<body style="background:#0d1117">` and `<img src="out.svg">` in headless Chrome (`--headless=new --screenshot=… --window-size=…`).
- **Tones:** neutral (`--line` border), soft (`--line-soft`), focal (`--fig-focal` border), ghost (dashed), band (`--line-soft` fill, no border), dark (`--ink` fill), frame, frame-dashed.
- **Named colours:** ink, ink-2, muted (`--viz-muted`), m1, b9, line, line-soft, accent / focal (`--fig-focal`), bg.
- **Text styles:** title, head (13/600, step titles in free-text flows), eyebrow (mono caps), label, node, body, item, foot, note, caption, edge, edge-sub, mono, stat, small.
- **Flows without boxes** (like `perf-loop`): use `texts` with `head` + `note`, `dots` with `"r": 5.5, "ring": 2`, and point-to-point `edges` (`"from": [x,y]`, `"via"`).
- **Narrow layout:** design it separately. Do not scale the wide one. In the `"narrow"` block, `nodes`/`groups` merge by `id` (`"drop": true` removes one), `edges`/`dots`/`texts`/`shapes`/`cards` replace the wide lists, and other keys (`size`, `title`, …) override.
- **Ids:** set `"id"`. Each SVG scopes its CSS (`#id .t-node`), marker ids and title id to it, so several diagrams can share one page.

## Workflow

```bash
D=~/.omp/agent/managed-skills/claude-dev-diagrams/scripts/cdd.py
python3 $D build spec.json -o out.svg            # writes SVG(s) + lint (exit 1 on errors)
python3 $D check out.svg                         # real-font checks in headless Chrome (see Lint coverage)
python3 $D check page.html                       # same checks on every diagram in an HTML page, with its CSS
python3 $D render out.svg -o out.png             # 2x PNG for visual review
python3 $D render out.svg -o dark.png --scheme dark   # site theme: preview with the dark variables
python3 $D palette [--theme site]                # list tones, named colours, text styles
```

1. Pick the theme and the closest example. Sketch the layout on a grid: 1200 units wide for paper/sage, about 720 for site wide, about 360 for site narrow.
2. Write the spec. Use explicit `x/y/w`. Omit `h` to get auto-height from the content.
3. Run `build`. Fix every ERROR. The build measures word widths in Chrome, so wrap and fit numbers are exact.
4. Run `check`, then `render`, and read the PNG. For the site theme, render light and dark. Lint cannot judge balance, so look at the image yourself.
5. Deliver the `.svg` (or the `.figure.html` for site wide + narrow). It is self-contained: one scoped `<style>` block, classes, markers, `<title>` for alt text, and 1-decimal coordinates. If the SVG ships as a standalone file, add the background rect first (see Site theme details).

## Spec reference

```jsonc
{
  "theme": "site" | "paper" | "sage",
  "id": "diagram-id",           // scopes CSS/marker ids; narrow variant gets "-mobile"
  "crop": true,                 // site default: tight viewBox around the content ("crop_pad": 2)
  "fallback": true,             // site: var(--x,#light) fallbacks
  "caption": "figcaption text", // site: used in out.figure.html
  "narrow": { ... },            // site: narrow-layout overrides, see above
  "size": [1200, 640],
  "card": true,                 // paper only; false = no big card (use "cards")
  "cards": [{"x","y","w","h","r","fill"}],   // extra panels, legend chips (fill "chip")
  "title": "Text" | {"text","x","y","style"},   // sage: eyebrow caps; paper: title
  "alt": "screen-reader description",
  "groups": [{"id","x","y","w","h","tone":"frame|frame-sage|frame-dashed|outline","label"}],
  "nodes": [{
    "id","x","y","w","h?","tone",
    "label": "text above the box",       // label_style, label_align
    "title": "bold line", "body": "str|[paras]", "mono": "str|[lines]",
    "items": [{"text","mark":"check|box|dot|dot-red|dot-gray|dot-accent|dot-sage|bullet"}],
    "note": "serif italic", "foot": "bold line in tone colour",
    "align": "center|left", "valign": "middle|top|bottom", "pad", "pad_y", "r", "fill", "dashed"
  }],
  "edges": [{
    "from": "id | id:side | id:side@0.3 | [x,y]", "to": "...",
    "via": [[x,y]], "ortho": true, "head": "open|solid|none", "both": false,
    "color", "width", "dashed",
    "label", "sub", "label_at": [x,y], "label_anchor", "label_left", "label_below", "label_color"
  }],
  "shapes": [{"type":"rect|circle|line|path|polyline|bar|wave|arrow", ...svg attrs; colours by name}],
  "dots":  [{"x","y","r","color","hollow","ring"}],   // ring: site background-ring width
  "texts": [{"x","y","text":"str|[lines]","style","anchor","color","rotate"}]
}
```

- **Tones (paper/sage):** neutral, green, sage, sage-soft, dark, yellow, warn (dashed), teal, lavender, blue, taupe, outline, accent, ghost (dashed).
- **Named colours (paper/sage):** ink, ink-strong, muted, faint, caption, line, sage, accent `#d97757`, red, blue, teal, lavender, gold, gray, bar-gray, card, paper, chip, dark.
- **Text styles (paper/sage):** title, eyebrow, label, node, body, item, foot, note, caption, edge, edge-sub, mono, stat, small.
- **Edge routing:** with no sides given, aligned boxes get a straight line. Other pairs get an elbow. Give sides for loops, for example `"analyzer:left"` → `"surface:bottom"`. Use `ortho:false` for diagonal fan-in lines.

## Design rules (from the references)

- Use one accent family per diagram. Use 3 strong tones at most. Neutral and green do most of the work. Lint warns above 4. In the site theme, `--fig-focal` marks the single thing in focus; everything else is ink, grey and 1px lines.
- Put labels above boxes, not inside a header strip. Put the explanation in serif-italic captions (paper/sage) or muted 12px notes (site) below or beside boxes.
- Keep strokes even: paper/sage use 1.5 on soft boxes, 2.5 on emphasis boxes and about 1.6 on arrows; site uses 1px everywhere. Use no shadows, no gradients, and no icons.
- Keep text short. One bold title and one muted line per box is the norm. Prefer more boxes to longer text.
- Use dashed outlines only for "not yet / temporary / forked" state.
- Leave generous whitespace. Keep at least 40px between columns and arrows longer than 30px. Lint warns below 22px.
- For charts, build from `wave`, `bar`, `arrow`, `line`, and `dots`. Compute the points in a short script and write them into the spec. `examples/sampled-vs-judged.json` shows how.

## Lint coverage

- **`build` (geometry):** content fits its box (wrapped width and needed height), safe area, box overlaps and near-touches, edges crossing unrelated boxes, labels colliding with boxes, short edges, off-palette hex, tone overload, and (site) hard-coded hex. Groups are frames: an edge may cross a group border, but an edge that runs along a border (within 3px, for 8px or more) is an error.
- **`check` (in Chrome, real fonts; any SVG or HTML page, not only cdd output):** node text inside its box on both axes, text-on-text overlap, text off the canvas, **box overlap** (rects, polygons and closed paths that partly overlap; full containment is fine), and **text crossing a box edge**. It skips icon-sized SVGs and full-canvas backgrounds. Off-canvas allows 30% of the font size on the line-height axis, because published claude.dev axis titles sit 2–3px into that padding.
- An SVG cut out of a page loses the page CSS (font sizes, fills), so its text checks are wrong. Check the `.html` page instead.
- Fonts fall back to the system sans (SF on macOS) when Anthropic Sans/Tiempos are absent. Check and render use the same fonts, so measurements stay consistent.
- Each command launches headless Chrome (a build launches it twice when cropping). Under heavy system load a launch can take a minute or more.
