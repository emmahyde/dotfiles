#!/usr/bin/env python3
"""Generate monospace-grid diagrams from a spec, so widths are computed and never typed.

Usage:
    shape.py box   "text" [--title T] [--kind K] [--border B] [--shadow] [--titlebar]
                          [--wrap N] [--tier a|b] [--cols N]
    shape.py graph SPEC.json | -      layered DAG; --gutter N sets the column between siblings
    shape.py gate  SPEC.json          a rule-5 gate row: condition, answers, results
    shape.py rows  SPEC.json          badge list rows; no box art, so badges are legal
    shape.py table SPEC.json          row-major grid; --header rules off the first row
    shape.py frame "text"             a block of text in a box; --numbers adds a gutter
    shape.py tree  "outline"          indented text to a tree
    shape.py seq   "A -> B: msg"      actors as columns, messages as arrows
    shape.py demo                     emit a sample graph spec

Kinds: step, actor, external, store, note. A kind is what a thing is; --border repaints it
without changing that, and "groups" in a graph spec wraps siblings in a titled container.
Output goes to stdout, the width report and any errors to stderr, so
`shape.py graph g.json 2>/dev/null` is safe to paste straight into a doc.

Sibling boxes in a layer share one width and one height. Ragged siblings read as different
kinds of thing, and a short sibling's bottom edge landing level with a taller one's inner rule
is unreadable. --ragged opts out of the shared width; the shared height is not optional.

Every run ends by grading its own output with ascii-lint's rules and exits 1 if any fire, so
this cannot emit a diagram the checker would reject. It also measures each line under both
width models (East-Asian Ambiguous as 1 cell in a Latin locale, 2 in a CJK-configured one).

Tier B box art is Ambiguous but the Latin text inside a box is not, so a Tier B box cannot be
rectangular under both models at once. The report states that shear rather than hiding it;
--tier a is the only output that holds everywhere.
"""

import argparse
import json
import re
import sys
import unicodedata

PADDING = 1  # cells of space between a box wall and its text, each side

BORDERS = {
    #           tl   tr   bl   br   h    v    lt   rt
    "single":  ("┌", "┐", "└", "┘", "─", "│", "├", "┤"),
    "bold":    ("┏", "┓", "┗", "┛", "━", "┃", "┣", "┫"),
    "double":  ("╔", "╗", "╚", "╝", "═", "║", "╠", "╣"),
    "rounded": ("╭", "╮", "╰", "╯", "─", "│", "├", "┤"),
    "dashed":  ("╭", "╮", "╰", "╯", "┈", "┊", "├", "┤"),
    "ascii":   ("+", "+", "+", "+", "-", "|", "+", "+"),
    "heavyad": ("#", "#", "#", "#", "=", "#", "+", "+"),
}
# A kind is what the thing *is*; a border is what it looks like. Every kind has a default
# border, and `border` on a node overrides it without changing the kind's meaning.
KIND_BORDER = {"step": "single", "actor": "bold", "external": "double",
               "store": "single", "note": "dashed"}
KINDS = tuple(KIND_BORDER)
SHELF_KINDS = {"store"}
# Tier A has one drawable border per kind, so an override that Tier A cannot express falls back
# rather than silently emitting Tier B glyphs into an ASCII-only diagram.
TIER_A_BORDER = {"actor": "heavyad"}
SHADES = {"b": "░", "a": ":"}  # Tier A has no shade block; `:` is the quietest ASCII stand-in


def width(ch, mode):
    if unicodedata.combining(ch):
        return 0
    eaw = unicodedata.east_asian_width(ch)
    if eaw in ("W", "F"):
        return 2
    if eaw == "A":
        return 2 if mode == "wide" else 1
    return 1


def disp(s, mode="narrow"):
    return sum(width(c, mode) for c in s)


def wrap(text, limit):
    """Greedy wrap on spaces, measured in narrow cells. Never splits a word.

    A narration line keeps a hanging indent so its `*` stays the only thing in that column.
    """
    out = []
    for para in text.split("\n"):
        indent = "  " if para.lstrip().startswith("* ") else ""
        line = ""
        for word in para.split():
            cand = word if not line else line + " " + word
            if disp(cand) > limit and line:
                out.append(line)
                line = indent + word
            else:
                line = cand
        out.append(line)
    return out


def border_of(kind, tier, override=None):
    if tier == "a":
        return BORDERS[TIER_A_BORDER.get(kind, "ascii")]
    name = override or KIND_BORDER[kind]
    if name not in BORDERS or name == "heavyad":
        raise SystemExit(f"error: unknown border {name!r}; pick one of "
                         + ", ".join(n for n in BORDERS if n != "heavyad"))
    return BORDERS[name]


class Box:
    def __init__(self, bid, kind, title, lines, tier, wrap_at,
                 border=None, shadow=False, titlebar=False):
        self.id, self.kind, self.tier = bid, kind, tier
        self.chars = border_of(kind, tier, border)
        self.shelf = kind in SHELF_KINDS
        self.shadow, self.titlebar = shadow, titlebar
        if kind == "store" and not title:
            raise SystemExit(
                f"error: node {bid!r} is kind 'store', whose shelf sits under a title; without one "
                "it renders identically to 'step' and the shape stops meaning anything"
            )
        body = []
        for ln in lines:
            if not ln.strip():
                continue
            body.extend(wrap(ln, wrap_at) if disp(ln) > wrap_at else [ln])
        # A title on the border cannot wrap: it is one run of the top edge.
        if not title and not body:
            raise SystemExit(f"error: node {bid!r} has no title and no body; an unlabelled box "
                             "occupies space in the picture while naming nothing in the system")
        self.bar = title if (titlebar and title) else ""
        self.title = [] if self.bar else (wrap(title, wrap_at) if title else [])
        self.body = body
        content = self.title + body
        self.inner = max([disp(c) for c in content] + [1]) + 2 * PADDING
        if self.bar:
            self.inner = max(self.inner, disp(self.bar) + 4)
        self.pad_rows = self.title_gap = 0
        self.r = self.c = self.band_top = self.band_bot = 0

    @property
    def w(self):
        return self.inner + 2 + (1 if self.shadow else 0)

    @property
    def bh(self):
        """Rows of the box proper. Siblings align on this: a shadow is decoration, and equalizing
        total height instead lifts a shadowed box's bottom edge a row above its neighbours'."""
        return (2 + len(self.title) + len(self.body) + self.title_gap
                + (1 if self.shelf and self.title else 0) + self.pad_rows)

    @property
    def h(self):
        return self.bh + (1 if self.shadow else 0)

    @property
    def cx(self):
        """Centre column of the box proper. A shadow is decoration and must not shift a wire."""
        return self.c + (self.inner + 2) // 2

    def top_edge(self):
        tl, tr, h = self.chars[0], self.chars[1], self.chars[4]
        if not self.bar:
            return tl + h * self.inner + tr
        run = self.inner - disp(self.bar) - 3
        return f"{tl}{h} {self.bar} {h * run}{tr}"

    def render(self):
        tl, tr, bl, br, h, v, lt, rt = self.chars
        rows = [self.top_edge()]
        pad = " " * PADDING

        def row(text):
            fill = self.inner - PADDING - disp(text)
            return v + pad + text + " " * fill + v

        if self.title:
            rows.extend(row(t) for t in self.title)
            if self.shelf:
                rows.append(lt + h * self.inner + rt)
            rows.extend(row("") for _ in range(self.title_gap))
        rows.extend(row(t) for t in self.body)
        rows.extend(row("") for _ in range(self.pad_rows))
        rows.append(bl + h * self.inner + br)
        if self.shadow:
            sh = SHADES["a" if self.tier == "a" else "b"]
            rows = [rows[0]] + [r + sh for r in rows[1:]]
            rows.append(" " + sh * (self.inner + 2))
        return rows


UP, DOWN, LEFT, RIGHT = 1, 2, 4, 8
# connection bitmask -> glyph. Two routes meeting in one cell OR their bits together, so a
# fan-out and a fan-in resolve to real tees instead of the last writer's corner.
WIRE_B = {
    3: "│", 1: "│", 2: "│", 12: "─", 4: "─", 8: "─",
    6: "┐", 10: "┌", 5: "┘", 9: "└",
    14: "┬", 13: "┴", 11: "├", 7: "┤", 15: "┼",
}
WIRE_A = {b: ("|" if b in (1, 2, 3) else "-" if b in (4, 8, 12) else "+") for b in range(1, 16)}


class Canvas:
    def __init__(self, tier):
        self.solid = {}
        self.wires = {}
        self.pierceable = {}
        self.soft = set()
        self.tier = tier

    def put(self, r, c, ch):
        if ch != " ":
            self.solid[(r, c)] = ch
            if ch in SHADES.values():
                self.soft.add((r, c))

    def text(self, r, c, s):
        for i, ch in enumerate(s):
            self.put(r, c + i, ch)

    def wire(self, r, c, bits):
        # A container wall is the one solid an edge may cross: refusing would leave every wire
        # out of a grouped box swallowed by the wall, and the edge would vanish from the picture.
        # A shadow is decoration and always yields, or it breaks the wire crossing it in two.
        if (r, c) in self.solid and (r, c) in self.pierceable:
            self.wires[(r, c)] = self.pierceable.pop((r, c))
            del self.solid[(r, c)]
        elif (r, c) in self.soft and (r, c) in self.solid:
            del self.solid[(r, c)]
        if (r, c) not in self.solid:
            self.wires[(r, c)] = self.wires.get((r, c), 0) | bits

    def occupied(self, r, c):
        return (r, c) in self.solid or (r, c) in self.wires

    def blit(self, box):
        for dr, line in enumerate(box.render()):
            self.text(box.r + dr, box.c, line)

    def lines(self):
        table = WIRE_A if self.tier == "a" else WIRE_B
        cells = dict(self.solid)
        for pos, bits in self.wires.items():
            cells.setdefault(pos, table[bits])
        if not cells:
            return []
        out = []
        for r in range(max(rr for rr, _ in cells) + 1):
            row = {c: ch for (rr, c), ch in cells.items() if rr == r}
            out.append("".join(row.get(c, " ") for c in range(max(row) + 1)) if row else "")
        return [ln.rstrip() for ln in out]


def layer_nodes(nodes, edges):
    """Longest-path layering. Raises on a cycle."""
    incoming = {n: [] for n in nodes}
    for e in edges:
        incoming[e["to"]].append(e["from"])
    layer, pending = {}, list(nodes)
    while pending:
        progressed = False
        for n in list(pending):
            if all(p in layer for p in incoming[n]):
                layer[n] = max([layer[p] + 1 for p in incoming[n]], default=0)
                pending.remove(n)
                progressed = True
        if not progressed:
            raise SystemExit(f"error: dependency cycle among {sorted(pending)}")
    return layer


EDGE_GAP = 3  # rows between one layer's bottom and the next layer's top


def build_graph(spec, tier, gutter, wrap_at, ragged=False, snap=4):
    if not spec.get("nodes"):
        raise SystemExit("error: spec has no nodes")
    boxes = {}
    for n in spec["nodes"]:
        boxes[n["id"]] = Box(
            n["id"], n.get("kind", "step"), n.get("title", n["id"]),
            n.get("lines", []), tier, wrap_at,
            n.get("border"), n.get("shadow", False), n.get("titlebar", False),
        )
    edges = spec.get("edges", [])
    for e in edges:
        for end in ("from", "to"):
            if e[end] not in boxes:
                raise SystemExit(f"error: edge references unknown node {e[end]!r}")
    layer = layer_nodes(boxes, edges)

    rows = {}
    for nid, li in layer.items():
        rows.setdefault(li, []).append(nid)
    order = sorted(rows)

    # Siblings share a layer's width and height. Unequal ones read as a set of different things,
    # and a shorter sibling's bottom edge landing on a taller one's inner rule is unreadable.
    for li in order:
        sibs = [boxes[n] for n in rows[li]]
        # A shelf displaces its own body down a row. Without matching that on the siblings, the
        # rule lands level with their narration and reads as a rule through their text.
        if any(b.shelf and b.title for b in sibs):
            for b in sibs:
                if not (b.shelf and b.title) and b.title:
                    b.title_gap = 1
        tall = max(b.bh for b in sibs)
        wide = max(b.inner for b in sibs)
        for b in sibs:
            b.pad_rows += tall - b.bh
            if not ragged:
                b.inner = wide + (-wide % snap)

    # A group wraps a run of same-layer siblings in a titled container. Its members are laid out
    # as one item so the container's walls occupy real space rather than being drawn over a box.
    groups, claimed = [], {}
    for g in spec.get("groups", []):
        members = g["nodes"]
        name = g.get("title", "?")
        if not members:
            raise SystemExit(f"error: group {name!r} has no nodes; an empty container encloses "
                             "nothing and occupies space that reads as a missing box")
        for m in members:
            if m not in boxes:
                raise SystemExit(f"error: group {name!r} references unknown node {m!r}")
            if m in claimed:
                where = (f"listed twice in group {name!r}" if claimed[m] == name
                         else f"in group {claimed[m]!r} and again in {name!r}")
                raise SystemExit(
                    f"error: node {m!r} is {where}; a box occupies one place on the grid, so it "
                    "can sit inside one container exactly once"
                )
            claimed[m] = name
        lay = {layer[m] for m in members}
        if len(lay) > 1:
            by_layer = {}
            for m in members:
                by_layer.setdefault(layer[m], []).append(m)
            split = "; ".join(f"layer {li}: {', '.join(ms)}" for li, ms in sorted(by_layer.items()))
            raise SystemExit(
                f"error: group {g.get('title', '?')!r} spans layers {sorted(lay)}; a container "
                "wraps siblings that sit side by side, not a column of successive steps, so split "
                f"it into one group per layer or reshape the flow so its members line up ({split})"
            )
        groups.append({"title": g.get("title", ""), "nodes": members, "layer": lay.pop(),
                       "chars": border_of("step", tier, g.get("border", "single")),
                       "shadow": g.get("shadow", False), "tier": "a" if tier == "a" else "b"})
    in_group = {m: gr for gr in groups for m in gr["nodes"]}

    def items_of(li):
        """This layer's placement units: each group once, plus every ungrouped box."""
        out, done = [], set()
        for nid in rows[li]:
            gr = in_group.get(nid)
            if gr is None:
                out.append(("box", nid))
            elif id(gr) not in done:
                done.add(id(gr))
                out.append(("group", gr))
        return out

    GPAD = 2  # container wall plus one cell of breathing room, each side

    def item_w(it):
        if it[0] == "box":
            return boxes[it[1]].w
        gr = it[1]
        inner = sum(boxes[n].w for n in gr["nodes"]) + gutter * (len(gr["nodes"]) - 1)
        return max(inner, disp(gr["title"]) + 4) + 2 * GPAD + (1 if gr["shadow"] else 0)

    layout = {li: items_of(li) for li in order}
    widths = {li: sum(item_w(i) for i in layout[li]) + gutter * (len(layout[li]) - 1)
              for li in order}
    total = max(widths.values())

    # A side lane has to leave one gap and arrive in another without either elbow touching a box
    # or the neighbouring elbow, which three rows cannot do without reading as a ladder.
    seen, sidelined = set(), []
    for e in edges:
        pair = (e["from"], e["to"])
        if layer[e["to"]] - layer[e["from"]] > 1 or pair in seen:
            sidelined.append(e)
        seen.add(pair)
    gap = 5 if sidelined else 3

    y = 0
    for li in order:
        x = (total - widths[li]) // 2
        banded = any(it[0] == "group" for it in layout[li])
        top = y + (GPAD if banded else 0)
        for it in layout[li]:
            if it[0] == "box":
                b = boxes[it[1]]
                b.r, b.c, b.band_top = top, x, top
            else:
                gr = it[1]
                gr["r"], gr["c"], gr["w"] = y, x, item_w(it)
                inner_x = x + GPAD
                for nid in gr["nodes"]:
                    boxes[nid].r, boxes[nid].c, boxes[nid].band_top = top, inner_x, y
                    inner_x += boxes[nid].w + gutter
            x += item_w(it) + gutter
        tall = max(boxes[n].h for n in rows[li])
        shaded = any(it[0] == "group" and it[1]["shadow"] for it in layout[li])
        band_bot = y + tall + (2 * GPAD if banded else 0) + (1 if shaded else 0)
        for it in layout[li]:
            if it[0] == "group":
                it[1]["h"] = tall + 2 * GPAD
        for nid in rows[li]:
            boxes[nid].band_bot = band_bot
        y = band_bot + gap

    canvas = Canvas(tier)
    for gr in groups:
        draw_group(canvas, gr)
    for b in boxes.values():
        canvas.blit(b)

    # An edge spanning more than one layer cannot drop straight down: the box in between is
    # solid, so the wire would be swallowed and the edge would vanish from the picture. Each
    # one gets its own column clear of every box instead.
    # Two edges that would occupy the same wire are indistinguishable once drawn, so the second
    # one is sidestepped exactly like a layer-skipper rather than merged into the first.
    margin = max(b.c + b.w for b in boxes.values()) + 1
    pending = []
    for e in edges:
        if e not in sidelined:
            src = boxes[e["from"]]
            route(canvas, src, boxes[e["to"]])
            pending.append((e.get("label", ""), src.band_bot, src.cx + 2))

    # Each lane reserves the width of its own label to its right, so a label sits against the
    # lane it belongs to. Sharing one gutter stacks them and leaves nothing tying label to lane.
    lane, at = [], margin
    for e in sidelined:
        lane.append(at)
        at += 2 + disp(e.get("label", ""))
    for i, e in enumerate(sidelined):
        src, dst = boxes[e["from"]], boxes[e["to"]]
        route_around(canvas, src, dst, lane[i])
        turn = max(src.r + src.h + 1, src.band_bot)
        pending.append((e.get("label", ""), min(turn + 1, dst.band_top - 3), lane[i] + 1))

    # Every label waits for every wire. A label written into a cell a later route needs would
    # block that wire and silently break the edge open.
    for label, r, c in pending:
        if label:
            label_at(canvas, r, c, label)
    return canvas


def draw_group(canvas, gr):
    """Draw a container's walls only. Its members are blitted afterwards into the hollow."""
    tl, tr, bl, br, h, v = gr["chars"][:6]
    sh = SHADES[gr["tier"]]
    w = gr["w"] - (1 if gr["shadow"] else 0)
    inner = w - 2
    if gr["title"]:
        run = inner - disp(gr["title"]) - 3
        top = f"{tl}{h} {gr['title']} {h * run}{tr}"
    else:
        top = tl + h * inner + tr
    canvas.text(gr["r"], gr["c"], top)
    for dr in range(1, gr["h"] - 1):
        canvas.put(gr["r"] + dr, gr["c"], v)
        canvas.put(gr["r"] + dr, gr["c"] + w - 1, v)
        if gr["shadow"]:
            canvas.put(gr["r"] + dr, gr["c"] + w, sh)
    canvas.text(gr["r"] + gr["h"] - 1, gr["c"], bl + h * inner + br)
    for dc in range(1, w - 1):
        for pos in ((gr["r"], gr["c"] + dc), (gr["r"] + gr["h"] - 1, gr["c"] + dc)):
            if canvas.solid.get(pos) == h:  # never pierce a letter of the container's title
                canvas.pierceable[pos] = LEFT | RIGHT
    if gr["shadow"]:
        canvas.put(gr["r"] + gr["h"] - 1, gr["c"] + w, sh)
        canvas.text(gr["r"] + gr["h"], gr["c"] + 1, sh * w)


def label_at(canvas, row, col, label):
    """Drop a label on the first row at or below `row` whose run is clear."""
    while any(canvas.occupied(row, col + i) for i in range(len(label) + 1)):
        row += 1
    canvas.text(row, col, label)


def route_around(canvas, src, dst, col):
    """Sidestep an edge that skips a layer out to its own margin column and back."""
    sc, dc = src.cx, dst.cx
    top, bot = src.r + src.h, dst.r - 1
    mid = dst.band_top - 2
    # An elbow touching the box fuses with its bottom edge, and one turning inside a container
    # runs along the wall and breaks on the corner, which no cell may cross.
    turn = max(top + 1, src.band_bot)

    for r in range(top, turn):
        canvas.wire(r, sc, UP | DOWN)
    canvas.wire(turn, sc, UP | RIGHT)
    for c in range(sc + 1, col):
        canvas.wire(turn, c, LEFT | RIGHT)
    canvas.wire(turn, col, LEFT | DOWN)
    for r in range(turn + 1, mid):
        canvas.wire(r, col, UP | DOWN)
    canvas.wire(mid, col, UP | LEFT)
    for c in range(dc + 1, col):
        canvas.wire(mid, c, LEFT | RIGHT)
    canvas.wire(mid, dc, RIGHT | DOWN)
    for r in range(mid + 1, bot):
        canvas.wire(r, dc, UP | DOWN)
    canvas.put(bot, dc, "v")


def route(canvas, src, dst):
    """Orthogonal route: down from src, along a channel shared by everything entering dst's
    layer, then down into dst. One channel per layer is what makes a fan-in read as one bus."""
    sc, dc = src.cx, dst.cx
    top, bot = src.r + src.h, dst.r - 1
    mid = dst.band_top - 2

    for r in range(top, mid):
        canvas.wire(r, sc, UP | DOWN)
    if sc == dc:
        canvas.wire(mid, sc, UP | DOWN)
    else:
        canvas.wire(mid, sc, UP | (RIGHT if dc > sc else LEFT))
        canvas.wire(mid, dc, DOWN | (LEFT if dc > sc else RIGHT))
        for c in range(min(sc, dc) + 1, max(sc, dc)):
            canvas.wire(mid, c, LEFT | RIGHT)
    for r in range(mid + 1, bot):
        canvas.wire(r, dc, UP | DOWN)
    canvas.put(bot, dc, "v")


def render_rows(spec):
    """Badge list rows. No box art on the line, so a badge's advance width cannot shear a grid."""
    rows = spec["rows"]
    labelw = max(disp(r["label"]) for r in rows)
    badgew = max((disp(r.get("badge", "")) for r in rows), default=0)
    out = []
    for r in rows:
        badge = r.get("badge", "")
        gap = " " * (badgew - disp(badge))
        pad = " " * (labelw - disp(r["label"]))
        out.append(f" {badge}{gap} {r['label']}{pad}  {r.get('note', '')}".rstrip())
    return out


def render_gate(spec, tier, wrap_at):
    """A rule-5 gate row: the condition, then one branch per answer, every arrowhead on one
    column so the answers read as a set rather than a ragged list."""
    branches = spec["branches"]
    if not branches:
        raise SystemExit("error: gate has no branches")
    tee, foot, dash = ("+", "+", "-") if tier == "a" else ("├", "└", "─")
    stem = "|" if tier == "a" else "│"
    lead = "    "
    head = f"{lead}{tee}{dash * 2} "

    arrow = max(disp(head) + disp(b["answer"]) + 3 for b in branches)
    out = [f" <> {spec['condition']}", f"{lead}{stem}"]
    for i, b in enumerate(branches):
        last = i == len(branches) - 1
        prefix = f"{lead}{foot if last else tee}{dash * 2} "
        fill = dash * (arrow - disp(prefix) - disp(b["answer"]) - 2)
        out.append(f"{prefix}{b['answer']} {fill}> {b['result']}")
        gutter = f"{lead}{' ' if last else stem}       "
        for note in b.get("notes", []):
            for j, ln in enumerate(wrap(note, wrap_at)):
                out.append(f"{gutter}{'* ' if j == 0 else '  '}{ln}")
        if not last:
            out.append(f"{lead}{stem}")
    return [ln.rstrip() for ln in out]


def grid(rows, tier, header=False, aligns=None):
    """Render a row-major table. Column widths come from the content, never from the caller."""
    if not rows:
        raise SystemExit("error: table has no rows")
    ncol = max(len(r) for r in rows)
    rows = [[str(c) for c in r] + [""] * (ncol - len(r)) for r in rows]
    aligns = (aligns or ["l"] * ncol) + ["l"] * ncol
    wide = [max(disp(r[i]) for r in rows) for i in range(ncol)]
    tl, tr, bl, br, h, v, lt, rt = BORDERS["ascii" if tier == "a" else "single"]
    td, tu, cross = ("+", "+", "+") if tier == "a" else ("┬", "┴", "┼")

    def rule(left, mid, right):
        return left + mid.join(h * (w + 2) for w in wide) + right

    def line(cells):
        out = []
        for i, c in enumerate(cells):
            room = wide[i] - disp(c)
            out.append(" " + (" " * room + c if aligns[i] == "r" else c + " " * room) + " ")
        return v + v.join(out) + v

    body = [rule(tl, td, tr), line(rows[0])]
    if header:
        body.append(rule(lt, cross, rt))
    for r in rows[1:]:
        body.append(line(r))
    body.append(rule(bl, tu, br))
    return body


def render_frame(text, tier, numbers):
    """A block of source in a box, with an optional line-number gutter."""
    lines = text.rstrip("\n").split("\n")
    if numbers:
        gutter = [str(i) for i in range(1, len(lines) + 1)]
        return grid([[g, l] for g, l in zip(gutter, lines)], tier, aligns=["r", "l"])
    return grid([[l] for l in lines], tier)


def parse_outline(text):
    """Indented text to a nesting. Indent is measured in cells, so any consistent unit works."""
    roots, stack = [], []
    for raw in text.rstrip("\n").split("\n"):
        if not raw.strip():
            continue
        depth = disp(raw) - disp(raw.lstrip())
        node = {"label": raw.strip(), "children": []}
        while stack and stack[-1][0] >= depth:
            stack.pop()
        (stack[-1][1]["children"] if stack else roots).append(node)
        stack.append((depth, node))
    if not roots:
        raise SystemExit("error: outline is empty")
    return roots


def render_tree(roots, tier):
    tee, last, vert, dash = ("+", "+", "|", "-") if tier == "a" else ("├", "└", "│", "─")
    out = []

    def walk(nodes, prefix):
        for i, n in enumerate(nodes):
            final = i == len(nodes) - 1
            out.append(f"{prefix}{last if final else tee}{dash * 2} {n['label']}")
            walk(n["children"], prefix + ("    " if final else f"{vert}   "))

    for r in roots:
        out.append(r["label"])
        walk(r["children"], "")
    return out


def render_tree_right(roots, tier):
    """Root on the left, one row per leaf, every parent centred on the span of its children.

    Glyphs come from the same connection bitmask the graph router uses, so a parent's incoming
    line and its fan merge into one junction instead of overwriting each other.
    """
    canvas = Canvas(tier)
    LEAD = 2
    nextrow = [0]

    def place(n, x):
        n["x"] = x
        kids = n["children"]
        if not kids:
            n["row"] = nextrow[0]
            nextrow[0] += 1
            return
        for k in kids:
            place(k, x + disp(n["label"]) + 3)  # label, fan column, dash, then the child
        n["row"] = (kids[0]["row"] + kids[-1]["row"]) // 2

    def draw(n):
        canvas.text(n["row"], n["x"], n["label"])
        kids = n["children"]
        if not kids:
            return
        fx = n["x"] + disp(n["label"]) + 1
        canvas.wire(n["row"], fx - 1, LEFT | RIGHT)
        canvas.wire(n["row"], fx, LEFT)
        for r in range(kids[0]["row"] + 1, kids[-1]["row"]):
            canvas.wire(r, fx, UP | DOWN)
        for i, k in enumerate(kids):
            bits = RIGHT | (DOWN if i < len(kids) - 1 else 0) | (UP if i else 0)
            canvas.wire(k["row"], fx, bits)
            canvas.wire(k["row"], fx + 1, LEFT | RIGHT)
            draw(k)

    for r in roots:
        place(r, LEAD if r["children"] else 0)
        if r["children"]:
            canvas.wire(r["row"], 0, LEFT | RIGHT)
            canvas.wire(r["row"], 1, LEFT | RIGHT)
        draw(r)
    return canvas.lines()


def parse_sequence(text, order=None):
    """`A -> B: message` per line. `<-` points the other way.

    Actors stand in first-seen order unless `actors:` or --actors seeds it; a seeded name that
    never sends or receives is an error rather than an empty column, since a column standing for
    nothing is the kind of thing a reader tries to account for.
    """
    msgs, actors = [], list(order or [])
    declared = set(actors)
    for raw in text.rstrip("\n").split("\n"):
        ln = raw.strip()
        if not ln or ln.startswith("#"):
            continue
        if ln.lower().startswith("actors:"):
            for a in ln.split(":", 1)[1].split(","):
                if a.strip() and a.strip() not in actors:
                    actors.append(a.strip())
                    declared.add(a.strip())
            continue
        m = re.match(r"^(.+?)\s*(->|<-)\s*(.+?)\s*:\s*(.*)$", ln)
        if not m:
            raise SystemExit(f"error: cannot read sequence line {raw!r}; "
                             "expected `Actor -> Actor: message`")
        left, arrow, right, label = m.group(1), m.group(2), m.group(3), m.group(4)
        for a in (left, right):
            if a not in actors:
                actors.append(a)
        src, dst = (left, right) if arrow == "->" else (right, left)
        msgs.append((src, dst, label))
    if not msgs:
        raise SystemExit("error: sequence has no messages")
    used = {a for s, d, _ in msgs for a in (s, d)}
    for a in declared:
        if a not in used:
            raise SystemExit(f"error: actor {a!r} is declared but sends and receives nothing; "
                             "an empty lifeline is a column the reader tries to account for")
    return actors, msgs


def render_sequence(text, tier, order=None):
    """Actors as columns, messages as arrows between their lifelines. Gaps are widened until
    every label fits its own span, so a long message never overruns the next lifeline."""
    actors, msgs = parse_sequence(text, order)
    idx = {a: i for i, a in enumerate(actors)}
    heads = [Box(a, "step", None, [a], tier, 200) for a in actors]
    GAP = 4
    gaps = [GAP] * (len(actors) - 1)

    for src, dst, label in msgs:
        i, j = sorted((idx[src], idx[dst]))
        if i == j:
            raise SystemExit(f"error: {src!r} sends to itself; a self-message has no span to "
                             "draw an arrow across")
        span = sum(heads[k].w for k in range(i + 1, j)) + sum(gaps[i:j])
        need = disp(label) + 4 - span
        if need > 0:
            for k in range(i, j):
                gaps[k] += -(-need // (j - i))

    x, col = 0, []
    for k, hb in enumerate(heads):
        hb.c = x
        col.append(x + hb.w // 2)
        x += hb.w + (gaps[k] if k < len(gaps) else 0)

    canvas = Canvas(tier)
    for hb in heads:
        hb.r = 0
        canvas.blit(hb)
    row = heads[0].h
    arrow_h, stem = ("-", "|") if tier == "a" else ("─", "│")
    tail_r, tail_l = ("+", "+") if tier == "a" else ("├", "┤")
    for src, dst, label in msgs:
        a, b = col[idx[src]], col[idx[dst]]
        lo, hi = min(a, b), max(a, b)
        for c in col:
            canvas.put(row, c, stem)
            canvas.put(row + 1, c, stem)
        canvas.text(row, lo + 1, label.center(hi - lo - 1)[: hi - lo - 1])
        for c in range(lo, hi + 1):
            canvas.put(row + 1, c, arrow_h)
        canvas.put(row + 1, b, ">" if b > a else "<")
        canvas.put(row + 1, a, tail_r if b > a else tail_l)
        row += 2
    for hb in heads:
        canvas.put(row, col[idx[hb.id]], stem)
        hb.r = row + 1
        canvas.blit(hb)
    return canvas.lines()


def check(lines, tier, cols):
    """Grade the output with ascii-lint's own rules, so the generator cannot emit a diagram the
    checker would reject. Returns (problems, cells this would shear in a CJK locale)."""
    import importlib.util
    import pathlib

    spec = importlib.util.spec_from_file_location(
        "ascii_lint", pathlib.Path(__file__).with_name("ascii-lint.py")
    )
    lint = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(lint)
    problems = [str(f) for f in lint.lint_block("<generated>", 1, lines, tier, cols, True)]

    narrow = {disp(l, "narrow") for l in lines if l.strip()}
    wide = {disp(l, "wide") for l in lines if l.strip()}
    return problems, (max(wide) - max(narrow) if wide else 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--tier", choices=("a", "b", "c"), default="b")
    common.add_argument("--cols", type=int, default=100)
    common.add_argument("--wrap", type=int, default=34, help="max text cells inside a box")
    common.add_argument("--quiet", action="store_true", help="suppress the width report")

    b = sub.add_parser("box", parents=[common])
    b.add_argument("text", nargs="?", default=None, help="body text; omit to read stdin")
    b.add_argument("--title")
    b.add_argument("--kind", choices=KINDS, default="step")
    b.add_argument("--border", choices=tuple(n for n in BORDERS if n != "heavyad"),
                   help="override the kind's default border style")
    b.add_argument("--shadow", action="store_true", help="drop a shade on the right and bottom")
    b.add_argument("--titlebar", action="store_true", help="set the title into the top edge")

    g = sub.add_parser("graph", parents=[common])
    g.add_argument("spec", help="JSON file, or - for stdin")
    g.add_argument("--gutter", type=int, default=4)
    g.add_argument("--snap", type=int, default=4,
                   help="round box widths up to a multiple of N so columns reuse "
                        "a small set of widths (rule 11); 1 disables")
    g.add_argument("--ragged", action="store_true",
                   help="let siblings keep their natural widths instead of sharing one")

    gt = sub.add_parser("gate", parents=[common])
    gt.add_argument("spec")

    r = sub.add_parser("rows", parents=[common])
    r.add_argument("spec")
    r.set_defaults(tier="c")  # badge rows carry no box art, so Tier C is legal here

    t = sub.add_parser("table", parents=[common])
    t.add_argument("spec", help="JSON {\"rows\": [[cell, ...], ...]}, or - for stdin")
    t.add_argument("--header", action="store_true", help="rule off the first row")

    fr = sub.add_parser("frame", parents=[common])
    fr.add_argument("text", nargs="?", default=None, help="omit to read stdin")
    fr.add_argument("--numbers", action="store_true", help="add a line-number gutter")

    tr = sub.add_parser("tree", parents=[common])
    tr.add_argument("text", nargs="?", default=None, help="indented outline; omit to read stdin")
    tr.add_argument("--style", choices=("indent", "right"), default="indent",
                    help="indent: `├── child` down the page. right: root on the left, every "
                         "parent centred on the span of its children")

    sq = sub.add_parser("seq", parents=[common])
    sq.add_argument("text", nargs="?", default=None,
                    help="`Actor -> Actor: message` per line; omit to read stdin")
    sq.add_argument("--actors", default=None,
                    help="comma-separated column order; unlisted actors follow in first-seen order")

    sub.add_parser("demo")
    a = ap.parse_args()

    if getattr(a, "gutter", 1) < 1:
        raise SystemExit("error: --gutter must be at least 1")
    if a.cmd == "demo":
        print(json.dumps(DEMO, indent=2))
        return 0

    def load(path):
        try:
            if path == "-":
                return json.load(sys.stdin)
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        except OSError as e:
            raise SystemExit(f"error: cannot read spec {path!r}: {e.strerror}")
        except json.JSONDecodeError as e:
            raise SystemExit(f"error: spec {path!r} is not valid JSON: {e}")

    if a.cmd == "box":
        text = sys.stdin.read() if a.text is None else a.text
        lines = Box("x", a.kind, a.title, text.split("\n"), a.tier, a.wrap,
                    a.border, a.shadow, a.titlebar).render()
    elif a.cmd == "gate":
        lines = render_gate(load(a.spec), a.tier, a.wrap)
    elif a.cmd == "table":
        s = load(a.spec)
        lines = grid(s["rows"], a.tier, a.header or s.get("header", False), s.get("aligns"))
    elif a.cmd == "frame":
        lines = render_frame(sys.stdin.read() if a.text is None else a.text, a.tier, a.numbers)
    elif a.cmd == "tree":
        src = sys.stdin.read() if a.text is None else a.text
        roots = parse_outline(src)
        lines = (render_tree_right(roots, a.tier) if a.style == "right"
                 else render_tree(roots, a.tier))
    elif a.cmd == "seq":
        order = [s.strip() for s in a.actors.split(",") if s.strip()] if a.actors else None
        lines = render_sequence(sys.stdin.read() if a.text is None else a.text, a.tier, order)
    elif a.cmd == "graph":
        lines = build_graph(load(a.spec), a.tier, a.gutter, a.wrap, a.ragged, a.snap).lines()
    else:
        lines = render_rows(load(a.spec))

    print("\n".join(lines))

    problems, shear = check(lines, a.tier, a.cols)
    if not a.quiet:
        note = "holds under both width models" if shear == 0 else (
            f"holds in a Latin locale; shears by {shear} cells in a CJK locale "
            "(Tier B box art is East-Asian Ambiguous, the text inside it is not) "
            "— use --tier a for output that holds everywhere"
        )
        print(f"\n{len(lines)} line(s), {max((disp(l) for l in lines), default=0)} columns: {note}",
              file=sys.stderr)
    for p in problems:
        print(p, file=sys.stderr)
    return 1 if problems else 0


DEMO = {
    "nodes": [
        {"id": "batch", "kind": "actor", "title": "Medusa::Batch",
         "lines": ["* one job you kicked off"]},
        {"id": "unit", "kind": "actor", "title": "Medusa::WorkUnit",
         "lines": ["* one item on the list"]},
        {"id": "minion", "kind": "actor", "title": "Minion",
         "lines": ["* one attempt at it", "* current_minion is the newest attempt only"]},
        {"id": "github", "kind": "external", "title": "GitHub", "lines": ["* holds the pull request"]},
    ],
    "edges": [
        {"from": "batch", "to": "unit", "label": "has many"},
        {"from": "unit", "to": "minion", "label": "has many, newest first"},
        {"from": "minion", "to": "github", "label": "opens a PR on"},
    ],
}

if __name__ == "__main__":
    sys.exit(main())
