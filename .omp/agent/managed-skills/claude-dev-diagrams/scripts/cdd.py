#!/usr/bin/env python3
"""cdd — editorial SVG diagrams in the claude.dev blog style.

  cdd.py build  spec.json [-o out.svg]       spec -> clean SVG (prints lint report); a "narrow" block
                                             also writes out-mobile.svg and out.figure.html
  cdd.py lint   spec.json                    geometry/text/palette checks only
  cdd.py render file.svg [-o out.png] [--scale 2] [--scheme light|dark]   rasterise via headless Chrome
  cdd.py check  file.svg                     real-font text fit/overlap + box collisions via headless Chrome
  cdd.py palette [--theme site]              print tones and text styles

Themes: paper, sage (raster-era claude.dev look), site (inline-SVG claude.dev look: CSS variables).
Spec: JSON. Coordinates are viewBox units (default canvas 1200 wide). See SKILL.md.
Only dependency beyond stdlib: Pillow (optional, for accurate text measurement).
"""

import json
import math
import os
import re
import subprocess
import sys
import tempfile
import html

# --------------------------------------------------------------------------- palette
# Sampled from claude.dev diagrams (eval-hillclimb-loop, caching-compaction, cost-*).
INK, INK_STRONG, MUTED, FAINT, CAPTION = (
    "#3f3f3c",
    "#141413",
    "#73726c",
    "#8a8a8a",
    "#7c7b70",
)
LINE = "#6b6a65"
SAGE, ACCENT, RED = "#5a705a", "#d97757", "#8f2d28"

# tone: fill, stroke, text colour, stroke-width, dashed
TONES = {
    "neutral": ("#efece7", "#d9d5ce", INK, 1.5, False),
    "green": ("#eff6ee", "#cfedcf", INK, 1.5, False),
    "sage": ("#faf9f5", SAGE, INK_STRONG, 2.5, False),
    "dark": (SAGE, SAGE, "#ffffff", 1.5, False),
    "yellow": ("#fff8e2", "#ead794", "#7a6417", 1.5, False),
    "warn": ("#fff8e2", "#d4a045", "#8a6a12", 1.5, True),
    "teal": ("#eaf2ef", "#629987", INK, 2.5, False),
    "lavender": ("#f0eff8", "#827dbd", INK, 2.5, False),
    "blue": ("#eaf1f9", "#6a9bcc", INK, 2.5, False),
    "taupe": ("#e8e6dc", "#afaea6", INK, 2.5, False),
    "outline": ("#faf9f5", "#afaea6", INK, 2.5, False),
    "accent": ("#fbeee8", ACCENT, INK, 2.5, False),
    "ghost": ("#f3f2ee", "#cfcbc4", MUTED, 1.5, True),
    "frame": ("none", "#d9d5ce", INK, 2.0, False),
    "frame-sage": ("none", SAGE, INK, 2.0, False),
    "frame-dashed": ("none", SAGE, INK, 2.0, True),
    "sage-soft": ("#eff3ee", SAGE, INK, 1.5, False),
}
# named colours usable in shapes/text "color"/"stroke"/"fill"
NAMED = {
    "ink": INK,
    "ink-strong": INK_STRONG,
    "muted": MUTED,
    "faint": FAINT,
    "caption": CAPTION,
    "line": LINE,
    "sage": SAGE,
    "accent": ACCENT,
    "red": RED,
    "blue": "#6a9bcc",
    "teal": "#629987",
    "lavender": "#827dbd",
    "gold": "#d4a045",
    "gray": "#afaea6",
    "bar-gray": "#c2c2b6",
    "card": "#faf9f5",
    "paper": "#e8e6dc",
    "chip": "#f1efe8",
    "white": "#ffffff",
    "dark": "#2b2b29",
    "none": "none",
}
PALETTE = {c.lower() for t in TONES.values() for c in t[:3]} | {
    c.lower() for c in NAMED.values()
}

THEMES = {
    # taupe outer frame + rounded paper card; humanist sans; open chevrons (eval/cost posts)
    "paper": dict(
        bg="#e8e6dc",
        card="#faf9f5",
        card_radius=28,
        card_inset=34,
        radius=14,
        label_style="label",
        head="open",
        edge_color=LINE,
    ),
    # flat paper; spaced caps eyebrows; sage accents; solid arrowheads (tools/caching posts)
    "sage": dict(
        bg="#faf9f5",
        card=None,
        card_radius=0,
        card_inset=0,
        radius=6,
        label_style="eyebrow",
        head="solid",
        edge_color="#8f8e89",
    ),
}

SANS = "'Anthropic Sans','Styrene B',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif"
SERIF = "'Tiempos Text','Iowan Old Style',Georgia,serif"
MONO = "'JetBrains Mono','SF Mono',Menlo,monospace"
# style: family, size, weight, italic, colour, letter-spacing(em), uppercase
STYLES = {
    "title": ("sans", 22, 600, False, "#2b2b29", 0, False),
    "eyebrow": ("sans", 14, 700, False, FAINT, 0.12, True),
    "label": ("sans", 18, 400, False, MUTED, 0, False),
    "node": ("sans", 17, 600, False, None, 0, False),
    "body": ("sans", 14.5, 400, False, None, 0, False),
    "item": ("sans", 14.5, 400, False, None, 0, False),
    "foot": ("sans", 14.5, 600, False, None, 0, False),
    "note": ("serif", 15, 400, True, CAPTION, 0, False),
    "caption": ("serif", 15, 400, True, CAPTION, 0, False),
    "edge": ("sans", 14.5, 600, False, "#5f5e58", 0, False),
    "edge-sub": ("sans", 14.5, 400, False, MUTED, 0, False),
    "mono": ("mono", 13.5, 400, False, INK, 0, False),
    "stat": ("sans", 30, 500, False, INK_STRONG, 0, False),
    "small": ("sans", 12.5, 400, False, MUTED, 0, False),
}
LINE_H = 1.38
PAD_X, PAD_Y, GAP = 14, 12, 6

# --------------------------------------------------------------------------- site theme
# claude.dev inline-SVG diagrams (figure.art-diagram): every colour is a CSS variable set by the
# host page, so one file serves light and dark. Values (light, dark) from the claude.dev CSS;
# conventions measured across references/site-svg/raw.
SITE_VARS = {
    "bg": ("#faf9f5", "#141413"),
    "ink": ("#141413", "#faf9f5"),
    "ink-2": ("#4c4b45", "#b0aea5"),
    "viz-muted": ("#65645e", "#8f8e87"),
    "viz-m1": ("#3d3d3a", "#d1cfc5"),
    "viz-b9": ("#8e8c87", "#73716c"),
    "line": ("#14141338", "#faf9f529"),
    "line-soft": ("#1414131c", "#faf9f517"),
    "fig-focal": ("#c15f3c", "#d97757"),
}


def _v(name):
    return "var(--%s)" % name


SITE_NAMED = {
    "ink": _v("ink"),
    "ink-2": _v("ink-2"),
    "muted": _v("viz-muted"),
    "m1": _v("viz-m1"),
    "b9": _v("viz-b9"),
    "line": _v("line"),
    "line-soft": _v("line-soft"),
    "accent": _v("fig-focal"),
    "focal": _v("fig-focal"),
    "bg": _v("bg"),
    "none": "none",
}
SITE_TONES = {  # fill, stroke, text colour, stroke-width, dashed — square 1px boxes, no fills
    "neutral": ("none", _v("line"), _v("ink"), 1, False),
    "soft": ("none", _v("line-soft"), _v("ink"), 1, False),
    "focal": ("none", _v("fig-focal"), _v("ink"), 1, False),
    "ghost": ("none", _v("viz-muted"), _v("ink-2"), 1, True),
    "band": (_v("line-soft"), "none", _v("ink"), 0, False),
    "dark": (_v("ink"), "none", _v("bg"), 0, False),
    "frame": ("none", _v("line-soft"), _v("ink"), 1, False),
    "frame-dashed": ("none", _v("viz-muted"), _v("ink-2"), 1, True),
}
SITE_SANS = (
    "'Anthropic Sans','Anthropic Sans Fallback',system-ui,-apple-system,sans-serif"
)
SITE_MONO = (
    "'Anthropic Mono','Anthropic Mono Fallback',ui-monospace,'SF Mono',Menlo,monospace"
)
SITE_STYLES = {
    "title": ("sans", 15, 500, False, _v("ink"), 0, False),
    "head": (
        "sans",
        13,
        600,
        False,
        _v("ink"),
        0,
        False,
    ),  # step titles in free-text flows
    "eyebrow": ("mono", 11, 500, False, _v("ink-2"), 0.08, True),
    "label": ("sans", 12, 400, False, _v("ink-2"), 0, False),
    "node": ("sans", 14, 500, False, None, 0, False),
    "body": ("sans", 12, 400, False, _v("ink-2"), 0, False),
    "item": ("sans", 12, 400, False, None, 0, False),
    "foot": ("sans", 12, 500, False, None, 0, False),
    "note": ("sans", 12, 400, False, _v("viz-muted"), 0, False),
    "caption": ("sans", 12, 400, False, _v("viz-muted"), 0, False),
    "edge": ("sans", 12, 500, False, _v("ink-2"), 0, False),
    "edge-sub": ("sans", 12, 400, False, _v("viz-muted"), 0, False),
    "mono": ("mono", 12, 400, False, _v("ink"), 0, False),
    "stat": ("sans", 26, 500, False, _v("ink"), 0, False),
    "small": ("sans", 11, 400, False, _v("viz-muted"), 0, False),
}
THEMES["site"] = dict(
    bg=None,
    card=None,
    card_radius=0,
    card_inset=0,
    radius=0,
    label_style="eyebrow",
    head="chev",
    edge_color=_v("viz-muted"),
    edge_width=1,
    node_dash="4 4",
    edge_dash="4 3",
    dot_r=4.5,
    vars=True,
    halo=True,
    crop=True,
)

# --------------------------------------------------------------------------- measurement
# Primary: exact per-word widths from headless Chrome (the renderer), one batched call per build.
# Fallbacks: Pillow + system font, then a calibrated per-character estimate.
_WORDS = {}  # (style, word) -> px
_SPACE = {}  # style -> px

_BASE = dict(
    tones=dict(TONES), named=dict(NAMED), styles=dict(STYLES), sans=SANS, mono=MONO
)
ACTIVE = {"theme": "paper"}


def use_theme(name):
    """Swap palette, tones and typography for one build. The CLI builds one spec per process."""
    global SANS, MONO, PALETTE
    if name not in THEMES:
        raise SystemExit("unknown theme %r (have: %s)" % (name, ", ".join(THEMES)))
    site = bool(THEMES[name].get("vars"))
    for d, base, alt in (
        (TONES, _BASE["tones"], SITE_TONES),
        (NAMED, _BASE["named"], SITE_NAMED),
        (STYLES, _BASE["styles"], SITE_STYLES),
    ):
        d.clear()
        d.update(alt if site else base)
    SANS, MONO = (SITE_SANS, SITE_MONO) if site else (_BASE["sans"], _BASE["mono"])
    PALETTE = {c.lower() for t in TONES.values() for c in t[:3]} | {
        c.lower() for c in NAMED.values()
    }
    if ACTIVE["theme"] != name:
        _WORDS.clear()
        _SPACE.clear()
    ACTIVE["theme"] = name
    return THEMES[name]


def _site():
    return bool(THEMES[ACTIVE["theme"]].get("vars"))


def _spec_strings(o, out):
    if isinstance(o, str):
        out.add(o)
    elif isinstance(o, dict):
        [_spec_strings(v, out) for v in o.values()]
    elif isinstance(o, list):
        [_spec_strings(v, out) for v in o]
    return out


def preload(spec):
    words = set()
    for s in _spec_strings(spec, set()):
        words.update(w for w in re.split(r"[ \n]+", s) if w)
    words = sorted(w for w in words if all((st, w) not in _WORDS for st in STYLES))
    if not words:
        return
    try:
        exe = chrome()
    except SystemExit:
        return
    items = [(st, w) for st in STYLES for w in words] + [
        (st, p) for st in STYLES for p in ("x x", "xx")
    ]
    body = "".join(
        '<text class="t-%s" x="0" y="20">%s</text>' % (st, html.escape(w, quote=False))
        for st, w in items
    )
    page = (
        '<!doctype html><html><body><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">'
        '<style>%s</style>%s</svg><script>document.body.setAttribute("data-r",JSON.stringify('
        '[...document.querySelectorAll("text")].map(t=>t.getComputedTextLength())))</script></body></html>'
    ) % (style_css(), body)
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "m.html")
        open(p, "w").write(page)
        try:
            r = subprocess.run(
                [
                    exe,
                    "--headless=new",
                    "--disable-gpu",
                    "--no-first-run",
                    "--dump-dom",
                    "file://" + p,
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            vals = json.loads(
                html.unescape(re.search(r'data-r="([^"]*)"', r.stdout).group(1))
            )
        except Exception:
            return
    got = dict(zip(items, vals))
    for (st, w), v in got.items():
        _WORDS[(st, w)] = v
    for st in STYLES:
        _SPACE[st] = got[(st, "x x")] - got[(st, "xx")]


_FONTS = {}


def _font(family, size, weight):
    try:
        from PIL import ImageFont
    except ImportError:
        return None
    key = (family, round(size * 4), weight >= 600)
    if key not in _FONTS:
        cands = {
            "sans": [
                ("/System/Library/Fonts/HelveticaNeue.ttc", 1 if weight >= 600 else 0),
                (
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"
                    % ("-Bold" if weight >= 600 else ""),
                    0,
                ),
            ],
            "serif": [
                ("/System/Library/Fonts/Supplemental/Georgia Italic.ttf", 0),
                ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf", 0),
            ],
            "mono": [
                ("/System/Library/Fonts/Menlo.ttc", 0),
                ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 0),
            ],
        }[family]
        _FONTS[key] = None
        for path, idx in cands:
            if os.path.exists(path):
                try:
                    _FONTS[key] = ImageFont.truetype(
                        path, max(1, round(size * 4)), index=idx
                    )
                    break
                except OSError:
                    pass
    return _FONTS[key]


def _fallback_width(s, style):
    fam, size, weight, italic, _, ls, upper = STYLES[style]
    if upper:
        s = s.upper()
    f = _font(fam, size, weight)
    w = (
        f.getlength(s) / 4.0
        if f
        else len(s) * size * (0.6 if fam == "mono" else 0.52 if weight < 600 else 0.56)
    )
    return w * 1.05 + ls * size * len(s)


def text_width(s, style):
    parts = [w for w in re.split(r" +", s) if w]
    if style in _SPACE and all((style, w) in _WORDS for w in parts):
        return sum(_WORDS[(style, w)] for w in parts) + _SPACE[style] * max(
            0, len(parts) - 1
        )
    return _fallback_width(s, style)


def wrap(s, style, width):
    out = []
    for para in str(s).split("\n"):
        words, cur = para.split(" "), ""
        for w in words:
            t = (cur + " " + w).strip()
            if cur and text_width(t, style) > width:
                out.append(cur)
                cur = w
            else:
                cur = t
        out.append(cur)
    return out


def line_h(style):
    return STYLES[style][1] * LINE_H


# --------------------------------------------------------------------------- svg helpers
def n(v):
    v = round(float(v), 1)
    return str(int(v)) if v == int(v) else str(v)


def color(c, default=None):
    if c is None:
        return default
    return NAMED.get(c, c)


class SVG:
    def __init__(self):
        self.body, self.markers, self.used_styles, self.issues = [], {}, set(), []

    def text(
        self,
        x,
        y,
        s,
        style,
        anchor="start",
        fill=None,
        fit=None,
        cls_extra="",
        rotate=None,
    ):
        self.used_styles.add(style)
        st = STYLES[style]
        attrs = [
            'x="%s"' % n(x),
            'y="%s"' % n(y),
            'class="t-%s%s"' % (style, cls_extra),
        ]
        if anchor != "start":
            attrs.append('text-anchor="%s"' % anchor)
        if fill and fill != st[4]:
            attrs.append(
                'style="fill:%s"' % fill
            )  # inline style: class CSS would beat a fill attribute
        if rotate:
            attrs.append('transform="rotate(%s %s %s)"' % (n(rotate), n(x), n(y)))
        if fit:
            attrs.append('data-fit="%s"' % " ".join(n(v) for v in fit))
        self.body.append(
            "<text %s>%s</text>" % (" ".join(attrs), html.escape(str(s), quote=False))
        )

    def marker(self, kind, col, size=1.0):
        """Arrowhead marker; size scales with heavy strokes. orient=auto-start-reverse serves both ends."""
        size = round(max(1.0, size), 2)
        mid = "%sarrow-%s-%s%s" % (
            getattr(self, "prefix", ""),
            kind,
            re.sub(r"[^\w-]", "", col),
            "" if size == 1 else "-%s" % str(size).replace(".", "_"),
        )
        if mid not in self.markers:
            if kind == "chev":  # site: small open chevron, 1px, tip on the line end
                self.markers[mid] = (
                    '<marker id="%s" viewBox="0 0 5 8" refX="4.5" refY="4" markerWidth="%s" markerHeight="%s" '
                    'markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0.5 0.5 L4.5 4 L0.5 7.5" '
                    'fill="none" stroke="%s" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></marker>'
                ) % (mid, n(5 * size), n(8 * size), col)
                return mid
            open_ = kind == "open"
            dim = n((12 if open_ else 11) * size)
            path = (
                (
                    '<path d="M2 1.5 L10 6 L2 10.5" fill="none" stroke="%s" stroke-width="1.8" stroke-linecap="round" '
                    'stroke-linejoin="round"/>' % col
                )
                if open_
                else '<path d="M0 0.5 L12 6 L0 11.5 Z" fill="%s"/>' % col
            )
            self.markers[mid] = (
                '<marker id="%s" viewBox="0 0 12 12" refX="%s" refY="6" markerWidth="%s" markerHeight="%s" '
                'markerUnits="userSpaceOnUse" orient="auto-start-reverse">%s</marker>'
            ) % (mid, 10 if open_ else 11, dim, dim, path)
        return mid


def style_css(scope=""):
    fam = {"sans": SANS, "serif": SERIF, "mono": MONO}
    rules = []
    for k, (f, size, w, it, c, ls, up) in STYLES.items():
        r = [
            "font-family:%s" % fam[f],
            "font-size:%spx" % n(size),
            "font-weight:%d" % w,
        ]
        if it:
            r.append("font-style:italic")
        if c:
            r.append("fill:%s" % c)
        if ls:
            r.append("letter-spacing:%sem" % ls)
        if up:
            r.append("text-transform:uppercase")
        rules.append("%s.t-%s{%s}" % (scope, k, ";".join(r)))
    if THEMES[ACTIVE["theme"]].get(
        "halo"
    ):  # labels sitting on lines get a background-coloured halo
        rules.append(
            "%s.t-edge,%s.t-edge-sub{paint-order:stroke;stroke:%s;stroke-width:3px;stroke-linejoin:round}"
            % (scope, scope, NAMED["bg"])
        )
    return "\n".join(rules)


# --------------------------------------------------------------------------- layout
def tone_of(spec_item, default="neutral"):
    t = spec_item.get("tone", default)
    if t not in TONES:
        raise SystemExit("unknown tone %r (have: %s)" % (t, ", ".join(TONES)))
    return TONES[t]


def node_lines(nd, inner_w):
    """Return list of (style, text, extra) rows for the node content."""
    rows = []
    if nd.get("title"):
        for ln in wrap(nd["title"], "node", inner_w):
            rows.append(("node", ln, None))
    body = nd.get("body")
    if body:
        if rows:
            rows.append(("gap", "", None))
        for para in body if isinstance(body, list) else [body]:
            for ln in wrap(para, "body", inner_w):
                rows.append(("body", ln, None))
    if nd.get("mono"):
        if rows:
            rows.append(("gap", "", None))
        for ln in nd["mono"] if isinstance(nd["mono"], list) else [nd["mono"]]:
            rows.append(("mono", ln, None))
    if nd.get("items"):
        if rows:
            rows.append(("gap", "", None))
        for it in nd["items"]:
            it = it if isinstance(it, dict) else {"text": it}
            mark = it.get("mark")
            ind = 22 if mark else 0
            for i, ln in enumerate(wrap(it["text"], "item", inner_w - ind)):
                rows.append(
                    ("item", ln, {"mark": mark if i == 0 else None, "indent": ind})
                )
    if nd.get("note"):
        if rows:
            rows.append(("gap2", "", None))
        for ln in wrap(nd["note"], "note", inner_w):
            rows.append(("note", ln, None))
    if nd.get("foot"):
        if rows:
            rows.append(("gap2", "", None))
        for ln in wrap(nd["foot"], "foot", inner_w):
            rows.append(("foot", ln, None))
    return rows


def rows_height(rows):
    h = 0
    for st, _, _ in rows:
        h += GAP if st == "gap" else GAP * 2.5 if st == "gap2" else line_h(st)
    return h


def resolve_nodes(spec):
    nodes = {}
    for kind in ("groups", "nodes"):
        for nd in spec.get(kind, []):
            nd = dict(nd)
            nd["_kind"] = kind[:-1]
            nd.setdefault("w", 240)
            if kind == "nodes":
                inner = nd["w"] - 2 * nd.get("pad", PAD_X)
                nd["_rows"] = node_lines(nd, inner)
                need = rows_height(nd["_rows"]) + 2 * nd.get("pad_y", PAD_Y)
                if "h" not in nd:
                    nd["h"] = max(need, 48)
                nd["_need"] = need
            if nd["id"] in nodes:
                raise SystemExit("duplicate id %r" % nd["id"])
            nodes[nd["id"]] = nd
    return nodes


def rect(nd):
    return nd["x"], nd["y"], nd["x"] + nd["w"], nd["y"] + nd["h"]


def port(nd, side, frac=0.5, gap=0):
    x0, y0, x1, y1 = rect(nd)
    if side == "right":
        return (x1 + gap, y0 + (y1 - y0) * frac)
    if side == "left":
        return (x0 - gap, y0 + (y1 - y0) * frac)
    if side == "top":
        return (x0 + (x1 - x0) * frac, y0 - gap)
    if side == "bottom":
        return (x0 + (x1 - x0) * frac, y1 + gap)
    raise SystemExit("bad side %r" % side)


def parse_end(ref, nodes):
    # "id", "id:side", "id:side@0.3", or [x, y]
    if isinstance(ref, list):
        return None, None, None, tuple(ref)
    m = re.match(r"^([^:@]+)(?::(left|right|top|bottom))?(?:@([0-9.]+))?$", ref)
    if not m or m.group(1) not in nodes:
        raise SystemExit("bad edge endpoint %r" % ref)
    return (
        nodes[m.group(1)],
        m.group(2),
        float(m.group(3)) if m.group(3) else None,
        None,
    )


def route(edge, nodes):
    a, sa, fa, pa = parse_end(edge["from"], nodes)
    b, sb, fb, pb = parse_end(edge["to"], nodes)
    g0, g1 = edge.get("gap", 10), edge.get("gap_end", 8)
    via = [tuple(p) for p in edge.get("via", [])]
    if a and b and not sa and not sb and not via:
        ax0, ay0, ax1, ay1 = rect(a)
        bx0, by0, bx1, by1 = rect(b)
        oy0, oy1 = max(ay0, by0), min(ay1, by1)
        ox0, ox1 = max(ax0, bx0), min(ax1, bx1)
        if oy1 - oy0 > 12:  # side by side -> straight horizontal
            y = (oy0 + oy1) / 2
            if bx0 >= ax1:
                return [(ax1 + g0, y), (bx0 - g1, y)]
            return [(ax0 - g0, y), (bx1 + g1, y)]
        if ox1 - ox0 > 12:  # stacked -> straight vertical
            x = (ox0 + ox1) / 2
            if by0 >= ay1:
                return [(x, ay1 + g0), (x, by0 - g1)]
            return [(x, ay0 - g0), (x, by1 + g1)]
        sa = (
            "right" if bx0 >= ax1 else "left"
        )  # otherwise elbow: leave sideways, enter top/bottom
        sb = "top" if by0 >= ay1 else "bottom"
    if pa is None:
        if not sa:
            tgt = (
                via[0]
                if via
                else (
                    pb or ((rect(b)[0] + rect(b)[2]) / 2, (rect(b)[1] + rect(b)[3]) / 2)
                )
            )
            sa = _facing(a, tgt)
        pa = port(a, sa, fa if fa is not None else 0.5, g0)
    if pb is None:
        if not sb:
            src = via[-1] if via else pa
            sb = _facing(b, src)
        pb = port(b, sb, fb if fb is not None else 0.5, g1)
    pts = [pa] + via + [pb]
    if not via and edge.get("ortho", True) and pa[0] != pb[0] and pa[1] != pb[1]:
        h0 = sa in ("left", "right") if sa else True
        h1 = sb in ("left", "right") if sb else True
        if h0 and not h1:
            pts = [pa, (pb[0], pa[1]), pb]
        elif h1 and not h0:
            pts = [pa, (pa[0], pb[1]), pb]
        elif h0 and h1:
            mx = (pa[0] + pb[0]) / 2
            pts = [pa, (mx, pa[1]), (mx, pb[1]), pb]
        else:
            my = (pa[1] + pb[1]) / 2
            pts = [pa, (pa[0], my), (pb[0], my), pb]
    return pts


def _facing(nd, pt):
    x0, y0, x1, y1 = rect(nd)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = (pt[0] - cx) / max(1, (x1 - x0)), (pt[1] - cy) / max(1, (y1 - y0))
    if abs(dx) >= abs(dy):
        return "right" if dx > 0 else "left"
    return "bottom" if dy > 0 else "top"


# --------------------------------------------------------------------------- build
def build(spec):
    th = use_theme(spec.get("theme", "paper"))
    sid = re.sub(r"[^\w-]", "-", spec.get("id", "cdd"))
    W, H = spec.get("size", [1200, 640])
    preload(spec)
    nodes = resolve_nodes(spec)
    s = SVG()
    s.prefix = sid + "-"
    B = s.body

    # background + card (site: none, the host page paints var(--bg))
    if th["bg"]:
        B.append('<rect width="%s" height="%s" fill="%s"/>' % (n(W), n(H), th["bg"]))
    if th["card"] and spec.get("card", True):
        ci = th["card_inset"]
        B.append(
            '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
            % (
                n(ci),
                n(ci),
                n(W - 2 * ci),
                n(H - 2 * ci),
                n(th["card_radius"]),
                th["card"],
            )
        )
    for c in spec.get("cards", []):  # extra cards (e.g. two side-by-side panels)
        B.append(
            '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
            % (
                n(c["x"]),
                n(c["y"]),
                n(c["w"]),
                n(c["h"]),
                n(c.get("r", th["card_radius"])),
                color(c.get("fill"), th["card"] or NAMED.get("bg", "#faf9f5")),
            )
        )

    if spec.get("title"):
        t = spec["title"]
        t = t if isinstance(t, dict) else {"text": t}
        B.append("<!-- title -->")
        s.text(
            t.get("x", W / 2),
            t.get("y", 52),
            t["text"],
            t.get("style", "eyebrow" if th["label_style"] == "eyebrow" else "title"),
            "middle",
        )

    # groups, then nodes (painter's order)
    for kind in ("group", "node"):
        for nd in [v for v in nodes.values() if v["_kind"] == kind]:
            B.append("<!-- %s %s -->" % (kind, nd["id"]))
            fill, stroke, tcol, sw, dashed = tone_of(
                nd, "frame" if kind == "group" else "neutral"
            )
            if nd.get("fill"):
                fill = color(nd["fill"])
            r = nd.get(
                "r", th["radius"] + (4 if kind == "group" and th["radius"] else 0)
            )
            dash = (
                ' stroke-dasharray="%s"' % th.get("node_dash", "7 5")
                if nd.get("dashed", dashed)
                else ""
            )
            sw = nd.get("stroke_width", sw)
            x0, y0, x1, y1 = rect(nd)
            B.append(
                '<rect data-k="%s" x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>'
                % (
                    nd["id"],
                    n(x0 + sw / 2),
                    n(y0 + sw / 2),
                    n(nd["w"] - sw),
                    n(nd["h"] - sw),
                    n(r),
                    fill,
                    stroke,
                    n(sw),
                    dash,
                )
            )
            if nd.get("label"):
                ls = nd.get("label_style", th["label_style"])
                anchor = nd.get("label_align", "middle")
                lx = {"middle": (x0 + x1) / 2, "start": x0 + 4, "end": x1 - 4}[anchor]
                s.text(lx, y0 - 14, nd["label"], ls, anchor)
            if kind == "node":
                _node_text(
                    s,
                    nd,
                    tcol,
                    color(nd.get("foot_color"), stroke if stroke != "none" else tcol),
                )

    # edges
    for e in spec.get("edges", []):
        pts = route(e, nodes)
        col = color(e.get("color"), th["edge_color"])
        head = e.get("head", th["head"])
        sw = e.get("width", th.get("edge_width") or (1.6 if head == "open" else 1.5))
        d = "M" + " L".join("%s %s" % (n(x), n(y)) for x, y in pts)
        attrs = 'fill="none" stroke="%s" stroke-width="%s" stroke-linejoin="round"' % (
            col,
            n(sw),
        )
        if e.get("dashed"):
            attrs += ' stroke-dasharray="%s"' % th.get("edge_dash", "6 5")
        msize = sw / 1.6
        if head != "none":
            attrs += ' marker-end="url(#%s)"' % s.marker(head, col, msize)
        if e.get("both"):
            attrs += ' marker-start="url(#%s)"' % s.marker(head, col, msize)
        B.append('<path d="%s" %s/>' % (d, attrs))
        e["_pts"] = pts
        if e.get("label") or e.get("sub"):
            _edge_label(s, e, pts)

    # free shapes (charts, curves, dots, bars)
    for sh in spec.get("shapes", []):
        B.append(_shape(sh))
    for d in spec.get("dots", []):
        col = color(d.get("color"), NAMED["accent"])
        r = d.get("r", th.get("dot_r", 7))
        if d.get("hollow"):
            hole = NAMED["bg"] if th.get("vars") else THEMES["paper"]["card"]
            B.append(
                '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                % (
                    n(d["x"]),
                    n(d["y"]),
                    n(r - 1),
                    hole,
                    col,
                    1 if th.get("vars") else 2,
                )
            )
        elif th.get(
            "vars"
        ):  # site dots carry a background ring (1px; 2px on flow-step dots) so they read on lines
            B.append(
                '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
                % (n(d["x"]), n(d["y"]), n(r), col, NAMED["bg"], n(d.get("ring", 1)))
            )
        else:
            B.append(
                '<circle cx="%s" cy="%s" r="%s" fill="%s"/>'
                % (n(d["x"]), n(d["y"]), n(r), col)
            )
    for t in spec.get("texts", []):
        lines = t["text"] if isinstance(t["text"], list) else [t["text"]]
        st = t.get("style", "caption")
        for i, ln in enumerate(lines):
            s.text(
                t["x"],
                t["y"] + i * line_h(st),
                ln,
                st,
                t.get("anchor", "start"),
                color(t.get("color")),
                rotate=t.get("rotate"),
            )

    defs = "<defs>\n<style>\n%s\n</style>\n%s\n</defs>" % (
        style_css("#%s " % sid),
        "\n".join(s.markers.values()),
    )
    title = spec.get("alt") or (
        spec.get("title") if isinstance(spec.get("title"), str) else "diagram"
    )
    cls = (
        ' class="art-diagram-%s"' % spec.get("_variant", "wide")
        if th.get("vars")
        else ""
    )
    out = (
        [
            '<svg xmlns="http://www.w3.org/2000/svg" id="%s"%s viewBox="0 0 %s %s" width="%s" height="%s" role="img" aria-labelledby="%s-title">'
            % (sid, cls, n(W), n(H), n(W), n(H), sid),
            '<title id="%s-title">%s</title>' % (sid, html.escape(title)),
            defs,
        ]
        + B
        + ["</svg>"]
    )
    svg = "\n".join(out) + "\n"
    if th.get("vars"):
        svg = varify(svg, spec.get("fallback", True))
    if spec.get("crop", th.get("crop")):
        svg = crop(svg, spec.get("crop_pad", 2))
    return svg, nodes


def varify(svg, fallback=True):
    """Site theme: var() does not resolve in presentation attributes, so move var() paints into style.
    With fallback, var(--ink) becomes var(--ink,#141413): standalone files render light, host pages still theme them."""

    def tag(m):
        t = m.group(0)
        moved = re.findall(r'\s(fill|stroke)="(var\(--[\w-]+\))"', t)
        if not moved:
            return t
        t = re.sub(r'\s(?:fill|stroke)="var\(--[\w-]+\)"', "", t)
        decl = ";".join("%s:%s" % kv for kv in moved)
        if ' style="' in t:
            return t.replace(' style="', ' style="%s;' % decl, 1)
        return re.sub(r"\s*(/?>)$", lambda e: ' style="%s"%s' % (decl, e.group(1)), t)

    svg = re.sub(r"<[a-zA-Z]+\b[^<>]*>", tag, svg)
    if fallback:
        svg = re.sub(
            r"var\(--([\w-]+)\)",
            lambda m: (
                "var(--%s,%s)" % (m.group(1), SITE_VARS[m.group(1)][0])
                if m.group(1) in SITE_VARS
                else m.group(0)
            ),
            svg,
        )
    return svg


def _chrome_dom(page, attr="data-r"):
    """Load an HTML page in headless Chrome; return the JSON its script stored in body[attr]."""
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "x.html")
        open(p, "w").write(page)
        r = subprocess.run(
            [
                chrome(),
                "--headless=new",
                "--disable-gpu",
                "--no-first-run",
                "--dump-dom",
                "file://" + p,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
    m = re.search(r'%s="([^"]*)"' % attr, r.stdout)
    return json.loads(html.unescape(m.group(1))) if m else None


def crop(svg, pad=2):
    """Tight viewBox around the drawn content, as on claude.dev (e.g. viewBox="34 87 651 242.5")."""
    b = _chrome_dom(
        '<!doctype html><html><body>%s<script>const b=document.querySelector("svg").getBBox();'
        'document.body.setAttribute("data-r",JSON.stringify([b.x,b.y,b.width,b.height]))</script></body></html>'
        % svg
    )
    if not b:
        return svg
    x, y = math.floor((b[0] - pad) * 2) / 2, math.floor((b[1] - pad) * 2) / 2
    w, h = (
        math.ceil((b[0] + b[2] + pad - x) * 2) / 2,
        math.ceil((b[1] + b[3] + pad - y) * 2) / 2,
    )
    return re.sub(
        r'viewBox="[^"]*" width="[^"]*" height="[^"]*"',
        'viewBox="%s %s %s %s" width="%s" height="%s"'
        % (n(x), n(y), n(w), n(h), n(w), n(h)),
        svg,
        count=1,
    )


def _node_text(s, nd, tcol, foot_col=None):
    rows = nd["_rows"]
    if not rows:
        return
    x0, y0, x1, y1 = rect(nd)
    align = nd.get("align", "center")
    px = nd.get("pad", PAD_X)
    total = rows_height(rows)
    valign = nd.get("valign", "middle")
    py = nd.get("pad_y", PAD_Y)
    cy = {"top": y0 + py, "bottom": y1 - py - total}.get(
        valign, y0 + (nd["h"] - total) / 2
    )
    fit = (x0 + px * 0.5, x1 - px * 0.5, y0 + 1, y1 - 1)
    for st, txt, ex in rows:
        if st in ("gap", "gap2"):
            cy += GAP if st == "gap" else GAP * 2.5
            continue
        lh = line_h(st)
        base = cy + lh * 0.5 + STYLES[st][1] * 0.35
        fill = (foot_col if st == "foot" else tcol) if STYLES[st][4] is None else None
        if st == "body" and STYLES[st][4] is None and tcol in (INK, INK_STRONG):
            fill = "#55544f" if nd.get("title") else tcol
        if align == "center" and st != "item":
            s.text((x0 + x1) / 2, base, txt, st, "middle", fill, fit)
        else:
            ind = ex["indent"] if ex else 0
            tx = x0 + px + ind
            if ex and ex.get("mark"):
                _mark(s, ex["mark"], x0 + px + 6, base - STYLES[st][1] * 0.35, tcol)
            s.text(tx, base, txt, st, "start", fill, fit)
        cy += lh


def _mark(s, mark, cx, cy, tcol):
    B = s.body
    if mark in ("dot", "dot-red", "dot-gray", "dot-accent", "dot-sage"):
        c = {
            "dot": NAMED["ink"],
            "dot-red": NAMED.get("red", NAMED["accent"]),
            "dot-gray": NAMED.get("b9", "#cfcbc4"),
            "dot-accent": NAMED["accent"],
            "dot-sage": NAMED.get("sage", NAMED["ink"]),
        }[mark]
        B.append('<circle cx="%s" cy="%s" r="5" fill="%s"/>' % (n(cx), n(cy), c))
    elif mark in ("box", "check"):
        B.append(
            '<rect x="%s" y="%s" width="11" height="11" rx="1.5" fill="none" stroke="%s" stroke-width="1.3"/>'
            % (n(cx - 5.5), n(cy - 5.5), tcol)
        )
        if mark == "check":
            B.append(
                '<path d="M%s %s l2.6 2.8 l5 -6" fill="none" stroke="%s" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
                % (n(cx - 3.4), n(cy - 0.2), tcol)
            )
    elif mark == "bullet":
        B.append('<circle cx="%s" cy="%s" r="3" fill="%s"/>' % (n(cx), n(cy), tcol))


def _edge_label(s, e, pts):
    segs = list(zip(pts, pts[1:]))
    (ax, ay), (bx, by) = max(
        segs, key=lambda p: math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1])
    )
    if "label_at" in e:
        lx, ly = e["label_at"]
        anchor = e.get("label_anchor", "start")
    elif abs(ay - by) < 1:  # horizontal: centred above
        lx, ly, anchor = (
            (ax + bx) / 2,
            ay - 12 - (line_h("edge-sub") if e.get("sub") and e.get("label") else 0),
            "middle",
        )
        if e.get("label_below"):
            ly = ay + 22
    else:  # vertical: to the right, mid-height
        lx, ly, anchor = ax + 16, (ay + by) / 2, "start"
        if e.get("label_left"):
            lx, anchor = ax - 16, "end"
    if e.get("label"):
        s.text(lx, ly, e["label"], "edge", anchor, color(e.get("label_color")))
        ly += line_h("edge")
    if e.get("sub"):
        for ln in e["sub"] if isinstance(e["sub"], list) else [e["sub"]]:
            s.text(lx, ly, ln, "edge-sub", anchor)
            ly += line_h("edge-sub")


def _shape(sh):
    t = sh["type"]
    a = {k: v for k, v in sh.items() if k not in ("type",)}
    for k in ("fill", "stroke"):
        if k in a:
            a[k] = color(a[k])
    a.setdefault("fill", "none")
    if t == "bar":  # rounded pill bar: x, y, w, h(=thickness)
        h = a.pop("h", 12)
        return (
            '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s"/>'
            % (  # site bars are square
                n(a["x"]),
                n(a["y"]),
                n(a["w"]),
                n(h),
                0 if _site() else n(h / 2),
                a["fill"] if a["fill"] != "none" else NAMED["ink"],
            )
        )
    if t == "wave":  # smooth sine: x0, x1, y, amp, periods, phase
        pts = []
        steps = 120
        for i in range(steps + 1):
            u = i / steps
            x = a["x0"] + (a["x1"] - a["x0"]) * u
            y = a["y"] - a["amp"] * math.sin(
                2 * math.pi * a.get("periods", 1) * u + a.get("phase", 0)
            )
            pts.append((x, y))
        d = "M" + " L".join("%s %s" % (n(x), n(y)) for x, y in pts)
        return (
            '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round"/>'
            % (d, a.get("stroke", NAMED["ink"]), n(a.get("stroke-width", 3)))
        )
    if t == "arrow":  # axis arrow: x1 y1 x2 y2
        return '<path d="M%s %s L%s %s" fill="none" stroke="%s" stroke-width="%s"/>' % (
            n(a["x1"]),
            n(a["y1"]),
            n(a["x2"]),
            n(a["y2"]),
            a.get("stroke", NAMED["ink"]),
            n(a.get("stroke-width", 2)),
        ) + _chev(a)
    attrs = " ".join(
        '%s="%s"' % (k, n(v) if isinstance(v, (int, float)) else html.escape(str(v)))
        for k, v in a.items()
    )
    return "<%s %s/>" % (t, attrs)


def _chev(a):
    ang = math.atan2(a["y2"] - a["y1"], a["x2"] - a["x1"])
    L = 11
    p1 = (a["x2"] - L * math.cos(ang - 0.5), a["y2"] - L * math.sin(ang - 0.5))
    p2 = (a["x2"] - L * math.cos(ang + 0.5), a["y2"] - L * math.sin(ang + 0.5))
    return (
        '<path d="M%s %s L%s %s L%s %s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round"/>'
        % (
            n(p1[0]),
            n(p1[1]),
            n(a["x2"]),
            n(a["y2"]),
            n(p2[0]),
            n(p2[1]),
            a.get("stroke", NAMED["ink"]),
            n(a.get("stroke-width", 2)),
        )
    )


# --------------------------------------------------------------------------- lint
def _inside(a, b, pad=0):
    return (
        a[0] >= b[0] - pad
        and a[1] >= b[1] - pad
        and a[2] <= b[2] + pad
        and a[3] <= b[3] + pad
    )


def _overlap(a, b, gap=0):
    return (
        a[0] < b[2] + gap
        and b[0] < a[2] + gap
        and a[1] < b[3] + gap
        and b[1] < a[3] + gap
    )


def _seg_hits(p, q, r, shrink=2):
    x0, y0, x1, y1 = r[0] + shrink, r[1] + shrink, r[2] - shrink, r[3] - shrink
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pp, qq in (
        (-dx, p[0] - x0),
        (dx, x1 - p[0]),
        (-dy, p[1] - y0),
        (dy, y1 - p[1]),
    ):
        if pp == 0:
            if qq < 0:
                return False
        else:
            t = qq / pp
            if pp < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
    return t0 < t1


def _along_border(p, q, r, tol=3, min_run=8):
    """True when an axis-aligned segment p-q lies on (within tol of) a side of rect r for min_run px."""
    x0, y0, x1, y1 = r
    if abs(p[1] - q[1]) < 0.5:  # horizontal
        lo, hi = sorted((p[0], q[0]))
        run = min(hi, x1) - max(lo, x0)
        return run >= min_run and min(abs(p[1] - y0), abs(p[1] - y1)) <= tol
    if abs(p[0] - q[0]) < 0.5:  # vertical
        lo, hi = sorted((p[1], q[1]))
        run = min(hi, y1) - max(lo, y0)
        return run >= min_run and min(abs(p[0] - x0), abs(p[0] - x1)) <= tol
    return False


def lint(spec, nodes, svg=None):
    th = THEMES[spec.get("theme", "paper")]
    W, H = spec.get("size", [1200, 640])
    issues = []
    safe = (
        (
            th["card_inset"] + 16,
            th["card_inset"] + 16,
            W - th["card_inset"] - 16,
            H - th["card_inset"] - 16,
        )
        if th["card"] and spec.get("card", True)
        else (12, 12, W - 12, H - 12)
    )
    for nd in nodes.values():
        r = rect(nd)
        if not _inside(r, safe):
            issues.append(
                (
                    "error",
                    "%s %s leaves the safe area %s"
                    % (nd["_kind"], nd["id"], tuple(round(v) for v in safe)),
                )
            )
        if nd["_kind"] == "node" and nd["_need"] > nd["h"] + 0.5:
            issues.append(
                (
                    "error",
                    "node %s content needs h>=%d (has %d)"
                    % (nd["id"], math.ceil(nd["_need"]), nd["h"]),
                )
            )
        if nd["_kind"] == "node":
            inner = nd["w"] - 2 * nd.get("pad", PAD_X)
            for st, txt, ex in nd["_rows"]:
                if st in ("gap", "gap2"):
                    continue
                w = text_width(txt, st) + (ex["indent"] if ex else 0)
                if w > inner + 0.5:
                    issues.append(
                        (
                            "error",
                            "node %s: %r is %dpx wide, box interior is %dpx"
                            % (nd["id"], txt, w, inner),
                        )
                    )
        if nd.get("label"):
            ls = nd.get("label_style", th["label_style"])
            lw = text_width(nd["label"], ls)
            if lw > nd["w"] + 40:
                issues.append(
                    (
                        "warn",
                        "%s label %r (%dpx) much wider than box"
                        % (nd["id"], nd["label"], lw),
                    )
                )
    lst = list(nodes.values())
    for i, a in enumerate(lst):
        for b in lst[i + 1 :]:
            ra, rb = rect(a), rect(b)
            if _inside(ra, rb) or _inside(rb, ra):
                continue
            if _overlap(ra, rb):
                issues.append(("error", "%s and %s overlap" % (a["id"], b["id"])))
            elif a["_kind"] == b["_kind"] == "node" and _overlap(ra, rb, 10):
                issues.append(
                    ("warn", "%s and %s are closer than 10px" % (a["id"], b["id"]))
                )
    # labels above boxes colliding with other boxes
    for nd in lst:
        if nd.get("label"):
            ls = nd.get("label_style", th["label_style"])
            lw = text_width(nd["label"], ls)
            x0, y0, x1, _ = rect(nd)
            lr = (
                (x0 + x1 - lw) / 2,
                y0 - 14 - STYLES[ls][1],
                (x0 + x1 + lw) / 2,
                y0 - 10,
            )
            for o in lst:
                if o is nd or _inside(rect(nd), rect(o)):
                    continue
                if _overlap(lr, rect(o)):
                    issues.append(
                        ("error", "label of %s collides with %s" % (nd["id"], o["id"]))
                    )
    for e in spec.get("edges", []):
        pts = route(e, nodes)
        ends = set()
        for ref in (e["from"], e["to"]):
            if isinstance(ref, str):
                ends.add(ref.split(":")[0].split("@")[0])
        for p, q in zip(pts, pts[1:]):
            for nd in lst:
                if nd["id"] in ends:
                    continue
                r = rect(nd)
                # a group is a frame: edges may cross its border (into/out of the region);
                # only an edge running along the border line is ambiguous
                if nd["_kind"] == "group":
                    if _along_border(p, q, r):
                        issues.append(
                            (
                                "error",
                                "edge %s->%s runs along the border of %s"
                                % (e["from"], e["to"], nd["id"]),
                            )
                        )
                    continue
                if _seg_hits(p, q, r):
                    issues.append(
                        (
                            "error",
                            "edge %s->%s crosses %s" % (e["from"], e["to"], nd["id"]),
                        )
                    )
        if len(pts) >= 2:
            L = sum(math.hypot(q[0] - p[0], q[1] - p[1]) for p, q in zip(pts, pts[1:]))
            if L < 22:
                issues.append(
                    (
                        "warn",
                        "edge %s->%s is only %dpx long; widen the gap"
                        % (e["from"], e["to"], L),
                    )
                )
    # restraint: count strong tones in use
    strong = {
        nd.get("tone")
        for nd in lst
        if nd.get("tone")
        in ("teal", "lavender", "blue", "accent", "yellow", "warn", "dark", "sage")
    }
    if len(strong) > 4:
        issues.append(
            (
                "warn",
                "uses %d accent tones (%s); the reference style uses <=3-4"
                % (len(strong), ", ".join(sorted(strong))),
            )
        )
    raw = json.dumps(spec)
    for c in set(re.findall(r"#[0-9a-fA-F]{6}\b", raw)):
        if c.lower() not in PALETTE:
            issues.append(
                (
                    "warn",
                    "off-palette colour %s%s"
                    % (
                        c,
                        " (site theme: use a named colour so dark mode works)"
                        if th.get("vars")
                        else "",
                    ),
                )
            )
    if svg and th.get("vars"):
        # hex outside a var(--x,#fallback) will not follow the host page's light/dark scheme
        fixed = sorted(
            set(re.findall(r"(?<![,\w])#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b", svg))
        )
        if fixed:
            issues.append(
                (
                    "warn",
                    "site theme: hard-coded colour(s) %s ignore dark mode"
                    % ", ".join(fixed),
                )
            )
    return issues


# --------------------------------------------------------------------------- chrome
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
    "chromium-browser",
]


def chrome():
    for c in CHROME_CANDIDATES:
        if (
            os.path.exists(c)
            or subprocess.run(["which", c], capture_output=True).returncode == 0
        ):
            return c
    raise SystemExit("Chrome/Chromium not found")


def svg_size(svg):
    m = re.search(
        r'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"', svg
    )
    if not m:
        raise SystemExit("svg has no viewBox")
    return float(m.group(1)), float(m.group(2))


def scheme_css(scheme):
    """:root definitions of the claude.dev CSS variables, as the host page would set them."""
    i = {"light": 0, "dark": 1}[scheme]
    return ":root{%s}body{background:var(--bg)}" % ";".join(
        "--%s:%s" % (k, v[i]) for k, v in SITE_VARS.items()
    )


def render(svg_path, png_path, scale=2, scheme=None):
    svg = open(svg_path).read()
    W, H = svg_size(svg)
    if scheme is None and "var(--" in svg:
        scheme = "light"  # var-only files (e.g. references/site-svg/raw) need the host variables
    css = scheme_css(scheme) if scheme else ""
    with tempfile.TemporaryDirectory() as td:
        page = os.path.join(td, "p.html")
        open(page, "w").write(
            "<!doctype html><html><head><style>body{margin:0;background:transparent}%s</style></head>"
            "<body>%s</body></html>" % (css, svg)
        )
        subprocess.run(
            [
                chrome(),
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-first-run",
                "--force-device-scale-factor=%s" % scale,
                "--window-size=%d,%d" % (math.ceil(W), math.ceil(H)),
                "--default-background-color=00000000",
                "--screenshot=%s" % os.path.abspath(png_path),
                "file://" + page,
            ],
            capture_output=True,
            timeout=60,
        )
    if not os.path.exists(png_path):
        raise SystemExit("render failed")
    return png_path


# Runs inside the page. Client rects include transforms (rotated labels) and any CSS scaling;
# `sc` converts 1 user unit to client px so tolerances stay in diagram units.
CHECK_JS = r"""
<script>
(()=>{
const out=new Set();let count=0;
const R=e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}};
const ix=(a,c)=>Math.min(a.x+a.w,c.x+c.w)-Math.max(a.x,c.x), iy=(a,c)=>Math.min(a.y+a.h,c.y+c.h)-Math.max(a.y,c.y);
const inside=(a,c,p)=>a.x>=c.x-p&&a.y>=c.y-p&&a.x+a.w<=c.x+c.w+p&&a.y+a.h<=c.y+c.h+p;
const q=t=>'"'+t.textContent.trim().slice(0,40)+'"';
const svgs=[...document.querySelectorAll('svg')].filter(s=>!s.parentElement.closest('svg'));
for(const svg of svgs){
  const S=R(svg); if(S.w<60||S.h<40) continue;          // icons
  const tag=svgs.length>1?'['+(svg.id||'svg '+svgs.indexOf(svg))+'] ':'';
  const vb=svg.viewBox&&svg.viewBox.baseVal; const sc=vb&&vb.width?S.w/vb.width:1;
  const tb=[...svg.querySelectorAll('text')].filter(t=>t.textContent.trim()&&!t.closest('defs')).map(t=>({t,b:R(t)}));
  count+=tb.length;
  for(const {t} of tb){const f=t.getAttribute('data-fit'); if(!f)continue;
    const [l,r,top,bot]=f.split(' ').map(Number); const b=t.getBBox();
    if(b.x<l-0.5||b.x+b.width>r+0.5)out.add(tag+'overflow: '+q(t)+' spans x '+b.x.toFixed(1)+'..'+(b.x+b.width).toFixed(1)+' allowed '+l+'..'+r);
    if(!isNaN(top)&&(b.y<top-0.5||b.y+b.height>bot+0.5))out.add(tag+'overflow: '+q(t)+' spans y '+b.y.toFixed(1)+'..'+(b.y+b.height).toFixed(1)+' allowed '+top+'..'+bot);}
  // off-canvas: allow the line box's ascent/descent padding (30% of font size) on the line-height axis
  // only; rotated axis titles turn that axis horizontal. Overflow along the text's length is ink.
  for(const {t,b} of tb){if(!b.w)continue; const m=t.getCTM(); const rot=m&&Math.abs(m.b)>Math.abs(m.a);
    const pad=0.3*parseFloat(getComputedStyle(t).fontSize)*sc, px=rot?pad:0.5, py=rot?0.5:pad;
    if(b.x<S.x-px||b.y<S.y-py||b.x+b.w>S.x+S.w+px||b.y+b.h>S.y+S.h+py)out.add(tag+'off-canvas: '+q(t));}
  for(let i=0;i<tb.length;i++)for(let j=i+1;j<tb.length;j++){const a=tb[i].b,c=tb[j].b;
    if(ix(a,c)>sc&&iy(a,c)>3*sc)out.add(tag+'text overlap: '+q(tb[i].t)+' / '+q(tb[j].t));}
  // boxes: rects, polygons, closed paths (diamonds); skip markers/defs and full-canvas backgrounds
  const nm=(e,b)=>e.getAttribute('data-k')||e.id||(e.closest('[data-k]')&&e.closest('[data-k]').getAttribute('data-k'))
                  ||e.tagName+'@'+Math.round((b.x-S.x)/sc)+','+Math.round((b.y-S.y)/sc);
  const sh=[...svg.querySelectorAll('rect,polygon,path')]
    .filter(e=>!e.closest('defs,marker,clipPath,mask,pattern')&&(e.tagName!=='path'||/[Zz]\s*$/.test(e.getAttribute('d')||'')))
    .map(e=>{const b=R(e);return {e,b,n:nm(e,b)}}).filter(({b})=>b.w>3*sc&&b.h>3*sc&&!(b.w>=S.w*0.9&&b.h>=S.h*0.9));
  for(let i=0;i<sh.length;i++)for(let j=i+1;j<sh.length;j++){const a=sh[i].b,c=sh[j].b;
    if(ix(a,c)>sc&&iy(a,c)>sc&&!inside(a,c,sc)&&!inside(c,a,sc))out.add(tag+'box overlap: '+sh[i].n+' / '+sh[j].n);}
  for(const {t,b} of tb)for(const s of sh){
    if(ix(b,s.b)>sc&&iy(b,s.b)>2*sc&&!inside(b,s.b,sc)&&!inside(s.b,b,0))out.add(tag+'text crosses box edge: '+q(t)+' / '+s.n);}
}
document.body.setAttribute('data-result',JSON.stringify({issues:[...out],count}));
})();
</script>"""


def check(path, scheme=None):
    """Check an .svg file, or every diagram-sized <svg> in an .html page (with that page's own CSS)."""
    src = open(path).read()
    if path.lower().endswith((".html", ".htm")):
        base = '<base href="file://%s/">' % os.path.dirname(os.path.abspath(path))
        page = re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + base, src, count=1)
        page = (
            page.replace("</body>", CHECK_JS + "</body>")
            if "</body>" in page
            else page + CHECK_JS
        )
    else:
        css = scheme_css(scheme or "light") if "var(--" in src else ""
        page = (
            "<!doctype html><html><head><style>body{margin:0}%s</style></head><body>%s%s</body></html>"
            % (css, src, CHECK_JS)
        )
    res = _chrome_dom(page, "data-result")
    if res is None:
        raise SystemExit("check failed: no result from Chrome")
    return res


# --------------------------------------------------------------------------- wide/narrow variants
def narrow_spec(spec):
    """The spec's "narrow" block laid over the wide spec (claude.dev ships a separate -mobile layout).
    nodes/groups merge by id ("drop": true removes one); edges/shapes/dots/texts/cards replace wholesale;
    other keys (size, title, ...) override."""
    o = spec.get("narrow")
    if not o:
        return None
    v = {k: val for k, val in spec.items() if k != "narrow"}
    for k, val in o.items():
        if k in ("nodes", "groups"):
            base = [dict(x) for x in spec.get(k, [])]
            byid = {x["id"]: x for x in base}
            for patch in val:
                if patch["id"] in byid:
                    byid[patch["id"]].update(patch)
                else:
                    base.append(dict(patch))
                    byid[patch["id"]] = base[-1]
            v[k] = [x for x in base if not x.get("drop")]
        else:
            v[k] = val
    v["id"] = spec.get("id", "cdd") + "-mobile"
    v["_variant"] = "narrow"
    return v


def figure_html(spec, svgs, breakpoint=640):
    """Paste-ready <figure>: wide SVG above the breakpoint, narrow below; text stays selectable."""
    cap = spec.get("caption") or spec.get("alt") or ""
    css = (
        ".art-diagram svg{display:block;max-width:100%%;height:auto}.art-diagram .art-diagram-narrow{display:none}"
        "@media (max-width:%dpx){.art-diagram .art-diagram-wide{display:none}.art-diagram .art-diagram-narrow{display:block}}"
        % breakpoint
    )
    return '<figure class="art-diagram">\n<style>%s</style>\n%s%s</figure>\n' % (
        css,
        "".join(svgs),
        "<figcaption>%s</figcaption>\n" % html.escape(cap) if cap else "",
    )


# --------------------------------------------------------------------------- cli
def report(issues):
    errs = [m for k, m in issues if k == "error"]
    for k, m in issues:
        print("%-5s %s" % (k.upper(), m))
    print("lint: %d error(s), %d warning(s)" % (len(errs), len(issues) - len(errs)))
    return 1 if errs else 0


def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd = argv[1]

    def opt(name, default=None):
        return argv[argv.index(name) + 1] if name in argv else default

    if cmd == "palette":
        use_theme(opt("--theme", "paper"))
        for k, v in TONES.items():
            print(
                "tone  %-12s fill=%s stroke=%s text=%s width=%s dashed=%s" % ((k,) + v)
            )
        for k, v in NAMED.items():
            print("color %-12s %s" % (k, v))
        for k, v in STYLES.items():
            print(
                "style %-8s %s %spx w%d%s"
                % (k, v[0], v[1], v[2], " italic" if v[3] else "")
            )
        return 0
    path = argv[2]
    if cmd in ("build", "lint"):
        spec = json.load(open(path))
        out = opt("-o", os.path.splitext(path)[0] + ".svg")
        stem = os.path.splitext(out)[0]
        variants = [("", dict(spec, _variant="wide"))]
        nar = narrow_spec(spec)
        if nar:
            variants.append(("-mobile", nar))
        rc, svgs = 0, []
        for suffix, sp in variants:
            svg, nodes = build(sp)
            if len(variants) > 1:
                print("== %s" % (sp["_variant"]))
            rc |= report(lint(sp, nodes, svg))
            svgs.append(svg)
            if cmd == "build":
                open(stem + suffix + ".svg", "w").write(svg)
                print("wrote %s (%d bytes)" % (stem + suffix + ".svg", len(svg)))
        if cmd == "build" and nar:
            open(stem + ".figure.html", "w").write(figure_html(spec, svgs))
            print("wrote %s" % (stem + ".figure.html"))
        return rc
    if cmd == "render":
        out = opt("-o", os.path.splitext(path)[0] + ".png")
        render(path, out, float(opt("--scale", 2)), opt("--scheme"))
        print("wrote %s" % out)
        return 0
    if cmd == "check":
        res = check(path, opt("--scheme"))
        for m in res["issues"]:
            print("ERROR", m)
        print(
            "browser check: %d text element(s), %d issue(s)"
            % (res["count"], len(res["issues"]))
        )
        return 1 if res["issues"] else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
