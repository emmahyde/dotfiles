#!/usr/bin/env python3
"""Remove hard line wraps from Markdown prose.

A "hard wrap" is a line break inserted mid-paragraph only to satisfy a maximum
line length. This joins those wrapped lines back into one logical line per
paragraph (and per list item / blockquote line), letting the reader's viewer
soft-wrap instead.

Preserved verbatim: fenced and indented code, tables, ATX/setext headings,
horizontal rules, HTML blocks, link reference definitions, YAML front matter,
blank lines, and intentional hard breaks (a line ending in two spaces or a
backslash).
"""

import argparse
import re
import sys
from pathlib import Path

MD_EXTS = {".md", ".markdown", ".mdown", ".mkd", ".mdx", ".mdc"}

FENCE = re.compile(r"^(\s{0,3})(`{3,}|~{3,})(.*)$")
HEADING = re.compile(r"^\s{0,3}#{1,6}(\s|$)")
HR = re.compile(r"^\s{0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$")
LIST = re.compile(r"^(\s*)([-*+]|\d{1,9}[.)])([ \t]+)")
BLOCKQUOTE = re.compile(r"^\s{0,3}>")
TABLE_ROW = re.compile(r"^\s{0,3}\|")
TABLE_SEP = re.compile(r"^\s{0,3}\|?[ \t]*:?-{1,}:?[ \t]*(?:\|[ \t]*:?-*:?[ \t]*)*\|?[ \t]*$")
INDENT_CODE = re.compile(r"^(?: {4,}|\t)")
HTML = re.compile(r"^\s{0,3}<")
SETEXT = re.compile(r"^\s{0,3}(=+|-+)\s*$")
REFDEF = re.compile(r"^\s{0,3}\[[^\]]+\]:\s")


def _piece(raw, keep_indent):
    """Return (text, is_hard_break) for one source line.

    text keeps a trailing two-space hard break so join preserves it; a trailing
    backslash is already part of the stripped text.
    """
    body = raw.rstrip() if keep_indent else raw.strip()
    hard_two_space = raw.rstrip("\n").endswith("  ") and body != ""
    hard = hard_two_space or body.endswith("\\")
    if hard_two_space and not body.endswith("\\"):
        body += "  "
    return body, hard


def _join(pieces):
    """Join (text, hard_break) pieces, breaking output where hard_break is set."""
    out, cur = [], []
    for text, hard in pieces:
        cur.append(text)
        if hard:
            out.append(" ".join(cur))
            cur = []
    if cur:
        out.append(" ".join(cur))
    return out


def reflow_paragraph(block):
    return _join([_piece(ln, keep_indent=False) for ln in block])


def reflow_list(block):
    out, items = [], None

    def flush():
        nonlocal items
        if items:
            out.extend(_join(items))
            items = None

    for ln in block:
        raw = ln.rstrip("\n")
        if LIST.match(raw):
            flush()
            items = [_piece(raw, keep_indent=True)]
        elif items is not None and raw.strip() != "":
            items.append(_piece(raw, keep_indent=False))
        else:
            flush()
            out.append(ln)
    flush()
    return out


def reflow_quote(block):
    inner = []
    for ln in block:
        m = re.match(r"^(\s{0,3}>)( ?)(.*)$", ln.rstrip("\n"))
        if not m:
            return block
        inner.append(m.group(3))
    for line in inner:
        if line.strip() == "" or line.startswith(">") or FENCE.match(line) \
                or LIST.match(line) or HEADING.match(line) or TABLE_ROW.match(line):
            return block  # nested structure: preserve verbatim
    return ["> " + r if r.strip() != "" else ">" for r in reflow_paragraph(inner)]


def reflow_block(block):
    first = block[0].rstrip("\n")
    is_table = any(TABLE_SEP.match(l) for l in block) and \
        any(TABLE_ROW.match(l) or "|" in l for l in block)
    if is_table or TABLE_ROW.match(first):
        return block
    if HEADING.match(first) or HR.match(first) or HTML.match(first) \
            or INDENT_CODE.match(first) or REFDEF.match(first):
        return block
    if len(block) == 2 and SETEXT.match(block[1].rstrip("\n")):
        return block
    if LIST.match(first):
        return reflow_list(block)
    if BLOCKQUOTE.match(first):
        return reflow_quote(block)
    return reflow_paragraph(block)


def process_region(lines):
    out, block = [], []
    for ln in lines:
        if ln.strip() == "":
            if block:
                out.extend(reflow_block(block))
                block = []
            out.append(ln)
        else:
            block.append(ln)
    if block:
        out.extend(reflow_block(block))
    return out


def unwrap(text):
    had_nl = text.endswith("\n")
    lines = text.split("\n")
    if had_nl:
        lines = lines[:-1]

    out, i, n = [], 0, len(lines)

    if n > 0 and lines[0].strip() == "---":
        j = 1
        while j < n and lines[j].strip() not in ("---", "..."):
            j += 1
        if j < n:  # closing delimiter found -> real front matter
            out.extend(lines[: j + 1])
            i = j + 1

    region = []
    in_fence = False
    fence_ch = ""
    fence_len = 0

    def flush_region():
        nonlocal region
        if region:
            out.extend(process_region(region))
            region = []

    while i < n:
        ln = lines[i]
        m = FENCE.match(ln)
        if in_fence:
            out.append(ln)
            if m and m.group(2)[0] == fence_ch and len(m.group(2)) >= fence_len \
                    and m.group(3).strip() == "":
                in_fence = False
            i += 1
            continue
        if m:
            flush_region()
            out.append(ln)
            in_fence = True
            fence_ch = m.group(2)[0]
            fence_len = len(m.group(2))
            i += 1
            continue
        region.append(ln)
        i += 1
    flush_region()

    res = "\n".join(out)
    return res + "\n" if had_nl else res


def gather(paths):
    files, seen = [], set()
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            for f in sorted(pp.rglob("*")):
                if f.is_file() and f.suffix.lower() in MD_EXTS and f not in seen:
                    files.append(f)
                    seen.add(f)
        elif pp.is_file():
            if pp not in seen:
                files.append(pp)
                seen.add(pp)
        else:
            print(f"skip (not found): {p}", file=sys.stderr)
    return files


def main(argv=None):
    ap = argparse.ArgumentParser(description="Remove hard line wraps from Markdown files.")
    ap.add_argument("paths", nargs="+", help="Files and/or directories (dirs recurse over Markdown files).")
    ap.add_argument("-n", "--dry-run", action="store_true", help="Report which files would change; write nothing.")
    ap.add_argument("--stdout", action="store_true", help="Print result to stdout instead of editing in place.")
    args = ap.parse_args(argv)

    files = gather(args.paths)
    if not files:
        print("No Markdown files found.", file=sys.stderr)
        return 1

    changed = 0
    for f in files:
        original = f.read_text(encoding="utf-8")
        result = unwrap(original)
        if args.stdout:
            sys.stdout.write(result)
            continue
        if result != original:
            changed += 1
            if args.dry_run:
                print(f"would unwrap: {f}")
            else:
                f.write_text(result, encoding="utf-8")
                print(f"unwrapped: {f}")

    if not args.stdout:
        verb = "would change" if args.dry_run else "changed"
        print(f"{changed} of {len(files)} file(s) {verb}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
