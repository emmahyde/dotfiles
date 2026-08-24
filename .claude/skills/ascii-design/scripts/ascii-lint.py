#!/usr/bin/env python3
"""Lint monospace-grid ASCII diagrams against the ascii-design tier contract.

Usage:
    ascii-lint.py FILE [FILE...] [--tier a|b|c] [--raw] [--cols N] [--no-continuity]

By default reads fenced code blocks out of Markdown; --raw lints the whole file.
Exits 1 if any error fires. Warnings alone still exit 0.
"""

import argparse
import re
import sys
import unicodedata

ASCII_ART = set(r"""+-|/\<>^v()[]{}.'*=:#~!?,;_"&@%$`""") | set(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "
)
BOX = {chr(c) for c in range(0x2500, 0x25A0)}  # box drawing plus the block elements used for bars
BADGES = set("🟢🔴🟡🔵⚪🗄🌐⚠🆕") | {"️"}

VERTICALS = set("│┃║┊╎╏┆┇┋╽╿|")
CORNERS_OPEN = "┌┏╔╭"
CORNERS_CLOSE = "┐┓╗╮"
FEET_OPEN = "└┗╚╰"
FEET_CLOSE = "┘┛╝╯"
# any glyph that legitimately continues a vertical rule through a line
# horizontals count: a rule dropped from a box edge legitimately meets ─/━/═ rather than a tee
CONTINUES = VERTICALS | set(CORNERS_OPEN + CORNERS_CLOSE + FEET_OPEN + FEET_CLOSE) | set(
    "├┤┬┴┼╞╡╠╣╦╩╬┝┥┰┸╀╂+─━═╌┈╍v^<>"
)

TIERS = {"a": ASCII_ART, "b": ASCII_ART | BOX, "c": ASCII_ART | BOX | BADGES}


def width(ch):
    """Display cells: 2 for Wide/Fullwidth, 0 for combining, else 1."""
    if unicodedata.combining(ch):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def disp_len(s):
    return sum(width(c) for c in s)


class Finding:
    def __init__(self, kind, path, line, col, msg):
        self.kind, self.path, self.line, self.col, self.msg = kind, path, line, col, msg

    def __str__(self):
        loc = f"{self.path}:{self.line}" + (f":{self.col}" if self.col else "")
        return f"{loc}: {self.kind}: {self.msg}"


def blocks_from(text, raw):
    """Yield (start_line, [lines]). Fenced blocks unless raw."""
    lines = text.split("\n")
    if raw:
        yield 1, lines
        return
    fence, start, buf = None, 0, []
    for i, ln in enumerate(lines, 1):
        m = re.match(r"^\s*(```+|~~~+)", ln)
        if fence is None and m:
            fence, start, buf = m.group(1)[0] * 3, i + 1, []
        elif fence is not None and m and m.group(1)[0] * 3 == fence:
            if buf:
                yield start, buf
            fence = None
        elif fence is not None:
            buf.append(ln)
    if fence is not None and buf:
        yield start, buf


def lint_block(path, start, lines, tier, cols, continuity):
    out = []
    allowed = TIERS[tier]

    def add(kind, li, col, msg):
        out.append(Finding(kind, path, start + li, col, msg))

    for li, ln in enumerate(lines):
        if "\t" in ln:
            add("error", li, ln.index("\t") + 1, "tab character; diagrams are space-aligned")
        if ln != ln.rstrip():
            add("error", li, len(ln.rstrip()) + 1, "trailing whitespace")
        w = disp_len(ln)
        if w > cols:
            add("error", li, cols + 1, f"line is {w} display columns, cap is {cols}")
        # A badge's advance width is unreliable inside a fence, so it may not share a line with
        # anything that has to hold a column. Box art anywhere on the line disqualifies the whole
        # line, wherever the badge sits.
        has_art = any(c in BOX or c in "+|" for c in ln)
        for ci, ch in enumerate(ln):
            if ch in ("\t",):
                continue
            if ch not in allowed:
                add(
                    "error",
                    li,
                    ci + 1,
                    f"U+{ord(ch):04X} {unicodedata.name(ch, '?')!r} is outside tier {tier}",
                )
            elif width(ch) == 2 and has_art:
                add("error", li, ci + 1, f"U+{ord(ch):04X} is a badge sharing a line with box art")
            elif unicodedata.east_asian_width(ch) == "A" and ch not in ASCII_ART | BOX:
                add(
                    "warn",
                    li,
                    ci + 1,
                    f"U+{ord(ch):04X} is East-Asian Ambiguous; width varies by locale",
                )

    # `└───┐` is an orthogonal elbow, not a broken `└───┘`, so demanding the matching partner
    # rejects correct routing; only a run dying in whitespace or prose is always wrong.
    # `├` and `┤` close a horizontal run rather than continuing it, so they belong in ENDS and
    # not in the run class; matching them here lets a run swallow its own terminator and report
    # a correctly closed edge as unclosed.
    edge = re.compile(r"[" + CORNERS_OPEN + FEET_OPEN + r"][─━═╌┈╍┬┴┼┳┻╋╦╩╬-]{3,}")
    ENDS = set(CORNERS_OPEN + CORNERS_CLOSE + FEET_OPEN + FEET_CLOSE) | VERTICALS | set(
        "┬┴┼┳┻╋╦╩╬├┤╞╡╠╣><v^+"
    )
    for li, ln in enumerate(lines):
        for m in edge.finditer(ln):
            if ln[m.end() : m.end() + 1] in ENDS:
                continue
            add("error", li, m.end() + 1, f"box edge opened with {m.group(0)[0]!r} never closes")

    # Off-by-one lane walls: a rule's ┼ landing beside the │ column it should sit on reads as a
    # rendering artefact and is invisible to a reader who is not counting columns.
    JUNCT = set("┼┴┬├┤╋╬┿╀╁")
    census = {}
    for ln in lines:
        for ci, ch in enumerate(ln):
            if ch in VERTICALS:
                census[ci] = census.get(ci, 0) + 1
    walls = {c for c, n in census.items() if n >= 3}
    # Drift is a wall's run stopping dead at the junction's row: the junction stands where that
    # wall should have continued. A wall running straight through the row is an unrelated box
    # passing nearby, and a junction beside it is not off anything.
    def vert(li, ci):
        return 0 <= li < len(lines) and ci < len(lines[li]) and lines[li][ci] in VERTICALS

    for li, ln in enumerate(lines):
        for ci, ch in enumerate(ln):
            if ch not in JUNCT or ci in walls:
                continue
            for near in (ci - 1, ci + 1):
                if near not in walls or vert(li, near):
                    continue
                if vert(li - 1, near) or vert(li + 1, near):
                    add("error", li, ci + 1,
                        f"junction is one column off the wall at column {near + 1}")
                    break

    # Gate-row branches fan to a common result column; one leaf landing short reads as a different
    # kind of branch rather than a ragged edge, which is the misreading the alignment prevents.
    branch = re.compile(r"^\s*[├└][─━]{2} .*[─━]>")
    heads = [(ln.index(">"), li) for li, ln in enumerate(lines) if branch.match(ln)]
    if len(heads) > 1:
        cols = [c for c, _ in heads]
        common = max(set(cols), key=cols.count)
        for col, li in heads:
            if col != common:
                add("error", li, col + 1, f"branch arrowhead off the block's column {common + 1}")

    if continuity:
        for li, ln in enumerate(lines):
            above = lines[li - 1] if li else ""
            below = lines[li + 1] if li + 1 < len(lines) else ""
            for ci, ch in enumerate(ln):
                if ch not in VERTICALS or ch == "|":
                    continue
                up = above[ci] if ci < len(above) else " "
                dn = below[ci] if ci < len(below) else " "
                if up not in CONTINUES and dn not in CONTINUES:
                    add("warn", li, ci + 1, "vertical rule connects to nothing above or below")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--tier", choices=("a", "b", "c"), default="b")
    ap.add_argument("--raw", action="store_true", help="lint the whole file, not fenced blocks")
    ap.add_argument("--cols", type=int, default=100)
    ap.add_argument("--no-continuity", action="store_true")
    a = ap.parse_args()

    findings, blocks = [], 0
    for path in a.files:
        try:
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
        except (OSError, UnicodeDecodeError) as e:
            findings.append(Finding("error", path, 0, 0, f"cannot read: {e}"))
            continue
        if "\r" in text:
            findings.append(Finding("error", path, 0, 0, "CRLF line endings; diagrams need LF"))
        for start, lines in blocks_from(text, a.raw):
            blocks += 1
            findings += lint_block(path, start, lines, a.tier, a.cols, not a.no_continuity)

    # Nothing inspected is not a pass. Without this a doc whose diagrams were never fenced, or a
    # path typo, reports the same clean line as a doc that was checked and is correct.
    if not blocks:
        findings.append(
            Finding("error", ", ".join(a.files), 0, 0, "no diagram blocks found; nothing was checked")
        )

    errs = [f for f in findings if f.kind == "error"]
    for f in findings:
        print(f, file=sys.stderr if f.kind == "error" else sys.stdout)
    print(f"{blocks} block(s) checked: {len(errs)} error(s), {len(findings) - len(errs)} warning(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
