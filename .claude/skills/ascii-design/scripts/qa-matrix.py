#!/usr/bin/env python3
"""Exercise every shape.py surface and dump the results as one graded-review document.

    qa-matrix.py [--out FILE]

Each case records the exact command, the exit code, stdout, stderr, and whether the exit
matched what the case expected. Cases whose expectation is `1` are the negative fixtures.
"""

import argparse
import json
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SHAPE = HERE / "shape.py"

N = lambda i, **kw: {"id": i, **kw}  # noqa: E731


def spec(nodes, edges=()):
    return {"nodes": nodes, "edges": [dict(zip(("from", "to"), e[:2]),
                                           **({"label": e[2]} if len(e) > 2 else {}))
                                      for e in edges]}


CHAIN = spec([N("a", title="parse()"), N("b", title="validate()"), N("c", title="persist()")],
             [("a", "b", "ok"), ("b", "c", "clean")])
FAN = spec([N("g", title="current_minion.phase", lines=["* which finish line?"]),
            N("m", title="merged"), N("c", title="completed"),
            N("x", title="manually_completed", lines=["* a human closed it"], kind="store"),
            N("s", title="satisfied?", kind="external")],
           [("g", "m"), ("g", "c"), ("g", "x"), ("m", "s"), ("c", "s"), ("x", "s")])
DIAMOND = spec([N("t", title="dispatch"), N("l", title="left lane"),
                N("r", title="right lane"), N("j", title="join")],
               [("t", "l"), ("t", "r"), ("l", "j"), ("r", "j")])
KINDS = spec([N(k, title=k, kind=k, lines=[f"* the {k} shape"])
              for k in ("step", "actor", "external", "store", "note")])
SKIP = spec([N("a", title="A"), N("b", title="B"), N("c", title="C"), N("d", title="D")],
            [("a", "b"), ("b", "c"), ("c", "d"), ("a", "c", "skips one"), ("a", "d", "skips two")])
ISLANDS = spec([N("a", title="island one"), N("b", title="child"),
                N("c", title="island two"), N("d", title="lonely")], [("a", "b")])
SOLO = spec([N("only", title="a single node", lines=["* no edges at all"])])
WIDE = spec([N("a", title="a_very_long_method_name_that_forces_wrapping",
                lines=["* this narration is deliberately long enough to need wrapping twice over"]),
             N("b", title="short")], [("a", "b", "a label long enough to crowd the channel")])
CYCLE = spec([N("a"), N("b")], [("a", "b"), ("b", "a")])
SELF = spec([N("a")], [("a", "a")])
BADREF = spec([N("a")], [("a", "ghost")])
EMPTYNODES = {"nodes": []}
GATE = {"condition": "current_minion.phase is...", "branches": [
    {"answer": "nil", "result": "no"},
    {"answer": "\"opening_pr\"", "result": "only if pr_url is filled in",
     "notes": ["the phase flips before GitHub answers, so the name alone would lie"]},
    {"answer": "anything else, incl. failed/stopped", "result": "no"}]}
GATE1 = {"condition": "only one way out?", "branches": [{"answer": "yes", "result": "go"}]}
GATE0 = {"condition": "no branches", "branches": []}
DUP = spec([N("a", title="A"), N("b", title="B")],
           [("a", "b", "first"), ("a", "b", "second")])
DEEP = spec([N(c, title=c) for c in "ABCDE"],
            [("A", "B"), ("B", "C"), ("C", "D"), ("D", "E")])
TWOSKIP = spec([N(c, title=c) for c in "ABCD"],
               [("A", "B"), ("B", "C"), ("C", "D"), ("A", "C", "from A"), ("B", "D", "from B")])
BIGTITLE = spec([N("a", title="a title with real spaces in it that must wrap somewhere sensible"),
                 N("b", title="b")], [("a", "b")])
NOWRAPTITLE = spec([N("a", title="a_title_with_no_spaces_at_all_that_cannot_be_wrapped_by_any_means")])
BLANKNODE = spec([N("a", title="", lines=[]), N("b", title="B")], [("a", "b")])
ROWS = {"rows": [{"badge": "🟢", "label": "merged", "note": "41 of 48"},
                 {"badge": "🟡", "label": "open", "note": "12 of 48"},
                 {"badge": "🔴", "label": "failed", "note": "3 of 48"},
                 {"label": "no badge at all", "note": "row without a badge"},
                 {"badge": "🗄", "label": "db"}]}

GROUPED = dict(spec([N("iphone", title="Your iPhone", kind="actor"),
                     N("robot", title="Your Robot", kind="actor"),
                     N("server", title="Company Servers", kind="external")],
                    [("iphone", "server", "data"), ("robot", "server", "telemetry")]),
               groups=[{"title": "Your Home WiFi", "nodes": ["iphone", "robot"],
                        "shadow": True, "border": "rounded"}])
TWOGROUP = dict(spec([N(c, title=c) for c in ("a", "b", "c", "d")]),
                groups=[{"title": "left", "nodes": ["a", "b"]},
                        {"title": "right", "nodes": ["c", "d"], "shadow": True}])
SPANGROUP = dict(spec([N("a"), N("b")], [("a", "b")]),
                 groups=[{"title": "spans", "nodes": ["a", "b"]}])
GHOSTGROUP = dict(spec([N("a")]), groups=[{"title": "ghosts", "nodes": ["a", "nope"]}])
STYLED = spec([N("a", title="rounded", border="rounded"),
               N("b", title="double", border="double", shadow=True),
               N("c", title="dashed", border="dashed"),
               N("d", title="on the edge", titlebar=True)])

ONEGROUP = dict(spec([N("a", title="alone"), N("b", title="downstream")], [("a", "b")]),
                groups=[{"title": "just the one", "nodes": ["a"]}])
NILGROUP = dict(spec([N("a")]), groups=[{"title": "empty", "nodes": []}])
BOTHGROUP = dict(spec([N("a"), N("b")]),
                 groups=[{"title": "one", "nodes": ["a"]}, {"title": "two", "nodes": ["a"]}])
DUPGROUP = dict(spec([N("a"), N("b")]), groups=[{"title": "twice", "nodes": ["a", "a"]}])
# Two arms of a fan-in meeting on the channel resolve to a tee; the run must not swallow it.
FANGROUP = dict(spec([N("a", title="a wide node title here"), N("b", title="x"),
                      N("c", title="sink")], [("a", "c"), ("b", "c")]),
                groups=[{"title": "both sources", "nodes": ["a", "b"], "shadow": True}])
SKIPGROUP = dict(spec([N(c, title=c) for c in "abcd"],
                      [("a", "c"), ("b", "c"), ("c", "d"), ("a", "d", "skips one")]),
                 groups=[{"title": "sources", "nodes": ["a", "b"]}])

TABLE = {"rows": [["Tool", "Purpose"], ["table", "aligned columns"],
                  ["seq", "actors over time"]]}
TABLER = {"rows": [["item", "count"], ["merged", "41"], ["open", "3"]],
          "header": True, "aligns": ["l", "r"]}
TABLERAG = {"rows": [["a", "b", "c"], ["only one"], ["two", "cells"]]}
TABLE1 = {"rows": [["solo"]]}
TABLEMT = {"rows": [["", "b"], ["c", ""]]}
TABLE0 = {"rows": []}
TREE_SRC = "Linux\n  Android\n  Debian\n    Ubuntu\n      Lubuntu\n      Kubuntu\n    Mint\n  Fedora"
SEQ_SRC = ("Renderer -> Browser: BeginNavigation()\nBrowser -> Network: URLRequest()\n"
           "Browser <- Network: URLResponse()\nRenderer <- Browser: CommitNavigation()")

CASES = [
    ("box / default step", ["box", "one line of body"], 0),
    ("box / titled", ["box", "* narration", "--title", "pr_opened?"], 0),
    ("box / every kind", None, 0),  # expanded below
    ("box / no body, title only", ["box", "", "--title", "just a title"], 0),
    ("box / empty everything rejected", ["box", ""], 1),
    ("box / wrapping at --wrap 20", ["box",
        "a sentence long enough that it must wrap across several lines", "--wrap", "20"], 0),
    ("box / narration hanging indent", ["box",
        "* a narration line long enough to wrap so the hanging indent shows", "--wrap", "28"], 0),
    ("box / unbreakable long word", ["box", "Supercalifragilistic_method_name_no_spaces",
        "--wrap", "10"], 0),
    ("box / multi-paragraph via newline", ["box", "first line\nsecond line\n* narration"], 0),
    ("box / tier a", ["box", "* narration", "--title", "store me", "--kind", "store",
        "--tier", "a"], 0),
    ("box / cols breach is caught", ["box", "x" * 60, "--cols", "20"], 1),
    ("graph / chain with labels", ["graph", "@CHAIN"], 0),
    ("graph / fan-out and fan-in", ["graph", "@FAN"], 0),
    ("graph / diamond", ["graph", "@DIAMOND"], 0),
    ("graph / all five kinds, one layer", ["graph", "@KINDS", "--cols", "200"], 0),
    ("graph / skip-layer edge", ["graph", "@SKIP"], 0),
    ("graph / disconnected islands", ["graph", "@ISLANDS"], 0),
    ("graph / single node no edges", ["graph", "@SOLO"], 0),
    ("graph / long titles and labels", ["graph", "@WIDE"], 0),
    ("graph / tier a", ["graph", "@FAN", "--tier", "a"], 0),
    ("graph / gutter 1", ["graph", "@FAN", "--gutter", "1"], 0),
    ("graph / gutter 12", ["graph", "@FAN", "--gutter", "12", "--cols", "200"], 0),
    ("graph / ragged siblings", ["graph", "@FAN", "--ragged"], 0),
    ("graph / cols breach is caught", ["graph", "@FAN", "--cols", "40"], 1),
    ("graph / cycle rejected", ["graph", "@CYCLE"], 1),
    ("graph / self-edge rejected", ["graph", "@SELF"], 1),
    ("graph / unknown node rejected", ["graph", "@BADREF"], 1),
    ("graph / empty node list", ["graph", "@EMPTYNODES"], 1),
    ("graph / spec from stdin", ["graph", "-"], 0),
    ("rows / badges, gap, missing note", ["rows", "@ROWS"], 0),
    ("rows / forced to tier b rejects badges", ["rows", "@ROWS", "--tier", "b"], 1),
    ("gate / rule-5 row with a note", ["gate", "@GATE", "--wrap", "58"], 0),
    ("gate / tier a", ["gate", "@GATE", "--wrap", "58", "--tier", "a"], 0),
    ("gate / single branch", ["gate", "@GATE1"], 0),
    ("gate / no branches rejected", ["gate", "@GATE0"], 1),
    ("box / store without a title rejected", ["box", "body", "--kind", "store"], 1),
    ("box / store with a title keeps its shelf", ["box", "body", "--kind", "store",
        "--title", "table"], 0),
    ("graph / duplicate parallel edges both drawn", ["graph", "@DUP"], 0),
    ("graph / five layers deep", ["graph", "@DEEP"], 0),
    ("graph / skip lanes from two different sources", ["graph", "@TWOSKIP"], 0),
    ("graph / long title wraps on spaces", ["graph", "@BIGTITLE"], 0),
    ("graph / unwrappable title breaches cols", ["graph", "@NOWRAPTITLE", "--cols", "40"], 1),
    ("graph / node with no title and no body rejected", ["graph", "@BLANKNODE"], 1),
    ("graph / snap disabled", ["graph", "@FAN", "--snap", "1"], 0),
    ("graph / gutter 0 rejected", ["graph", "@FAN", "--gutter", "0"], 1),
    ("rows / tier a rejects badges", ["rows", "@ROWS", "--tier", "a"], 1),
    ("rows / cols breach is caught", ["rows", "@ROWS", "--cols", "8"], 1),
    ("demo / emits a valid spec", ["demo"], 0),
    ("box / tier a, every kind", None, 0),  # expanded below
    ("graph / store beside non-shelf siblings aligns content rows",
        ["graph", "@KINDS", "--cols", "200"], 0),
    ("box / every border style", None, 0),  # expanded below
    ("box / shadow", ["box", "* cast a shade", "--title", "shadowed", "--shadow"], 0),
    ("box / shadow degrades in tier a", ["box", "body", "--shadow", "--tier", "a"], 0),
    ("box / title set into the top edge", ["box", "* body", "--title", "Cloud Platform",
        "--titlebar"], 0),
    ("box / titlebar with no title", ["box", "* body", "--titlebar"], 0),
    ("box / titlebar longer than the body", ["box", "hi", "--title",
        "a title far wider than the body it sits over", "--titlebar"], 0),
    ("box / unknown border rejected", ["box", "hi", "--border", "groovy"], 2),
    ("graph / container with shadow", ["graph", "@GROUPED", "--cols", "120"], 0),
    ("graph / two containers in one layer", ["graph", "@TWOGROUP", "--cols", "160"], 0),
    ("graph / container in tier a", ["graph", "@GROUPED", "--tier", "a", "--cols", "120"], 0),
    ("graph / container spanning layers rejected", ["graph", "@SPANGROUP"], 1),
    ("graph / container with unknown member rejected", ["graph", "@GHOSTGROUP"], 1),
    ("graph / per-node border override", ["graph", "@STYLED", "--cols", "120"], 0),
    ("graph / single-member container", ["graph", "@ONEGROUP", "--cols", "120"], 0),
    ("graph / empty container rejected", ["graph", "@NILGROUP"], 1),
    ("graph / node in two containers rejected", ["graph", "@BOTHGROUP"], 1),
    ("graph / node listed twice in one container rejected", ["graph", "@DUPGROUP"], 1),
    ("graph / fan-in from inside a container", ["graph", "@FANGROUP", "--cols", "160"], 0),
    ("graph / skip-layer edge alongside a container", ["graph", "@SKIPGROUP", "--cols", "160"], 0),

    ("table / header rule", ["table", "@TABLE", "--header"], 0),
    ("table / no header", ["table", "@TABLE"], 0),
    ("table / right-aligned column", ["table", "@TABLER"], 0),
    ("table / ragged rows are padded", ["table", "@TABLERAG"], 0),
    ("table / one cell", ["table", "@TABLE1"], 0),
    ("table / empty cells", ["table", "@TABLEMT"], 0),
    ("table / no rows rejected", ["table", "@TABLE0"], 1),
    ("table / tier a", ["table", "@TABLE", "--header", "--tier", "a"], 0),
    ("table / cols breach is caught", ["table", "@TABLE", "--cols", "12"], 1),

    ("frame / plain", ["frame", "int main()\n{\n    return 0;\n}"], 0),
    ("frame / line numbers", ["frame", "one\ntwo\nthree", "--numbers"], 0),
    ("frame / ten lines widens the gutter", ["frame", "\n".join("l%d" % i for i in range(12)),
        "--numbers"], 0),
    ("frame / single line", ["frame", "just one"], 0),
    ("frame / empty text", ["frame", ""], 0),
    ("frame / tier a", ["frame", "a\nb", "--numbers", "--tier", "a"], 0),

    ("tree / nested outline", ["tree", TREE_SRC], 0),
    ("tree / single root no children", ["tree", "alone"], 0),
    ("tree / two roots", ["tree", "one\n  a\ntwo\n  b"], 0),
    ("tree / blank lines ignored", ["tree", "root\n\n  child\n\n"], 0),
    ("tree / deep nesting", ["tree", "a\n  b\n    c\n      d\n        e"], 0),
    ("tree / dedent to a shallower level", ["tree", "a\n  b\n    c\n  d\ne"], 0),
    ("tree / empty outline rejected", ["tree", "   \n\n"], 1),
    ("tree / tier a", ["tree", TREE_SRC, "--tier", "a"], 0),
    ("tree / right style, centred parents", ["tree", TREE_SRC, "--style", "right"], 0),
    ("tree / right style, tier a", ["tree", TREE_SRC, "--style", "right", "--tier", "a"], 0),
    ("tree / right style, single-child chain", ["tree", "a\n  b\n    c", "--style", "right"], 0),
    ("tree / right style, lone leaf", ["tree", "solo", "--style", "right"], 0),
    ("tree / right style, two roots", ["tree", "one\n  a\ntwo\n  b", "--style", "right"], 0),
    ("tree / right style, even child count centres between", ["tree",
        "root\n  a\n  b\n  c\n  d", "--style", "right"], 0),
    ("tree / right style, deep nesting", ["tree", "a\n  b\n    c\n      d\n        e\n          f",
        "--style", "right"], 0),
    ("tree / right style, cols breach is caught", ["tree", TREE_SRC, "--style", "right",
        "--cols", "20"], 1),

    ("seq / four messages both directions", ["seq", SEQ_SRC, "--cols", "140"], 0),
    ("seq / two actors one message", ["seq", "A -> B: go"], 0),
    ("seq / label longer than the actors", ["seq",
        "A -> B: a message far wider than either actor box", "--cols", "140"], 0),
    ("seq / non-adjacent actors", ["seq", "A -> C: skips B\nB -> C: adjacent", "--cols", "140"], 0),
    ("seq / comments and blank lines ignored", ["seq", "# a note\n\nA -> B: go"], 0),
    ("seq / self-message rejected", ["seq", "A -> A: loop"], 1),
    ("seq / unparseable line rejected", ["seq", "A talks to B"], 1),
    ("seq / no messages rejected", ["seq", "\n\n"], 1),
    ("tree right / deep subtree beside a shallow one",
     ["tree", "--style", "right", "root\n  a\n    a1\n    a2\n  b\n  c\n    c1\n      c1x\n"
      "      c1y\n    c2", "--cols", "140"], 0),
    ("seq / --actors reorders the columns", ["seq", "A -> B: hi\nB -> C: on",
                                             "--actors", "C,B", "--cols", "140"], 0),
    ("seq / actors: line reorders the columns", ["seq", "actors: C, A\nA -> B: hi\nB -> C: on",
                                                 "--cols", "140"], 0),
    ("seq / --actors names a silent actor", ["seq", "A -> B: hi", "--actors", "Z"], 1),
    ("seq / actors: line names a silent actor", ["seq", "actors: Z\nA -> B: hi"], 1),
    ("seq / --actors partial order, rest follow first-seen",
     ["seq", "A -> B: hi\nB -> C: on", "--actors", "C", "--cols", "140"], 0),
    ("seq / tier a", ["seq", SEQ_SRC, "--tier", "a", "--cols", "140"], 0),
]

SPECS = {k: v for k, v in globals().items() if isinstance(v, dict) and
         ({"nodes", "rows", "branches"} & set(v))}


V, T, C, X, HV, DV = "│", "┬", "┼", "─", "┃", "║"
# shape.py cannot emit a drifted junction or a broken edge, so the two rules that catch them can
# only be exercised by feeding the linter directly. Both rules were loosened to clear a false
# positive; each drift here is paired with the near-miss it must not be confused with.
LINT_CASES = [
    ("drift / tee one column off, wire continues below",
     f"    {V}\n    {V}\n    {V}\n     {T}\n     {V}\n", 1),
    ("drift / tee one column off, wire arrives from above",
     f"     {V}\n     {T}\n    {V}\n    {V}\n    {V}\n", 1),
    ("drift / cross one column off between two runs of the same wall",
     f"    {V}\n    {V}\n    {V}\n     {C}\n     {V}\n    {V}\n", 1),
    ("drift / off a heavy wall", f"{HV}\n{HV}\n{HV}\n {T}\n {HV}\n", 1),
    ("drift / off a double wall", f"{DV}\n{DV}\n{DV}\n {T}\n {DV}\n", 1),
    ("drift / on the first line of the block", f" {T}\n{V}\n{V}\n{V}\n", 1),
    ("drift / on the last line of the block", f"{V}\n{V}\n{V}\n {T}\n", 1),
    ("drift / between two parallel walls", f"{V} {V}\n{V} {V}\n{V} {V}\n {T}\n", 1),
    ("drift / junction on the wall is correct",
     f"    {V}\n    {V}\n    {V}\n    {T}\n    {V}\n", 0),
    ("drift / junction beside a wall that runs straight past it",
     f"    {V} {V}\n    {V} {C}{X}{X}\n    {V} {V}\n    {V} {V}\n", 0),
    ("drift / junction on its wall with another wall alongside",
     f"{V}{V}\n{V}{V}\n{V}{V}\n{V}{T}\n{V}{V}\n", 0),
]
# The second loosened rule: a horizontal run must still be required to reach a real terminator.
EDGE_CASES = [
    ("edge / run dies in prose", "└──── and then some prose", 1),
    ("edge / run dies at end of line", "┌──────", 1),
    ("edge / run dies in whitespace", "└───   ", 1),
    ("edge / dashed run dies in prose", "╰┈┈┈┈ dangling", 1),
    ("edge / elbow into a left tee", "└────┤", 0),
    ("edge / elbow into a right tee", "└────├", 0),
    ("edge / plain closed box edge", "┌────┐", 0),
    ("edge / run through a tee to a corner", "└──┬──┘", 0),
    ("edge / run into an arrowhead", "└────v", 0),
    ("edge / run into a vertical", "└────│", 0),
]


def run(args, stdin=None):
    p = subprocess.run([sys.executable, str(SHAPE), *args], capture_output=True,
                       text=True, input=stdin or "")
    return p.returncode, p.stdout, p.stderr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="-")
    a = ap.parse_args()

    tmp = pathlib.Path(tempfile.mkdtemp())
    paths = {}
    for name, obj in SPECS.items():
        p = tmp / f"{name}.json"
        p.write_text(json.dumps(obj), encoding="utf-8")
        paths[name] = str(p)

    cases = []
    for label, args, want in CASES:
        if label == "box / every kind":
            for k in ("step", "actor", "external", "store", "note"):
                cases.append((f"box / kind={k}",
                              ["box", f"* the {k} shape", "--title", k, "--kind", k], 0))
            continue
        if label == "box / tier a, every kind":
            for k in ("step", "actor", "external", "store", "note"):
                cases.append((f"box / tier a, kind={k}",
                              ["box", f"* the {k} shape", "--title", k, "--kind", k,
                               "--tier", "a"], 0))
            continue
        if label == "box / every border style":
            for bd in ("single", "double", "bold", "rounded", "dashed", "ascii"):
                cases.append((f"box / border={bd}",
                              ["box", "* styled", "--title", bd, "--border", bd], 0))
            continue
        cases.append((label, args, want))

    out, failures = [], 0
    for label, args, want in cases:
        stdin = None
        real = []
        for tok in args:
            if tok.startswith("@"):
                key = tok[1:]
                if args[0] == "graph" and tok == "-":
                    pass
                real.append(paths[key])
            else:
                real.append(tok)
        if real[-1] == "-" and real[0] == "graph":
            stdin = json.dumps(CHAIN)
        code, so, se = run(real, stdin)
        shown = " ".join(t if not t.startswith("/") else pathlib.Path(t).name for t in real)
        verdict = "n/a" if want is None else ("PASS" if code == want else "FAIL")
        if verdict == "FAIL":
            failures += 1
        out.append(f"### {label}\n\n"
                   f"`shape.py {shown}` -> exit {code}"
                   + (f" (expected {want}: {verdict})" if want is not None else " (no expectation)")
                   + "\n\n```\n" + (so.rstrip() or "(no stdout)") + "\n```\n"
                   + (f"\nstderr:\n```\n{se.rstrip()}\n```\n" if se.strip() else ""))

    # Exit codes cannot see where a label landed, and a shared gutter stacks two labels with
    # nothing tying either to its lane, so this one is asserted against the glyphs.
    code, so, _ = run(["graph", paths["TWOSKIP"], "--cols", "160", "--quiet"], None)
    rows = so.split("\n")
    placed = {}
    for ln in rows:
        for name in ("from A", "from B"):
            at = ln.find(name)
            if at > 0 and ln[at - 1] in "│┃":
                placed[name] = at
    ok = len(placed) == 2 and placed["from A"] != placed["from B"]
    if not ok:
        failures += 1
    out.append("### graph / each skip label sits against its own lane\n\n"
               f"labels found hard against a lane wall: {placed} "
               f"({'PASS' if ok else 'FAIL'})\n\n```\n{so.rstrip()}\n```\n")
    cases.append(("graph / each skip label sits against its own lane", None, 0))

    lint = HERE / "ascii-lint.py"
    for group, needle in ((LINT_CASES, "junction is one column off"),
                          (EDGE_CASES, "never closes")):
        for label, art, want in group:
            p = tmp / (label.replace("/", "-").replace(" ", "_") + ".txt")
            p.write_text(art if art.endswith("\n") else art + "\n", encoding="utf-8")
            r = subprocess.run([sys.executable, str(lint), str(p), "--raw", "--tier", "c",
                                "--no-continuity"], capture_output=True, text=True)
            hits = min((r.stdout + r.stderr).count(needle), 1)
            verdict = "PASS" if hits == want else "FAIL"
            if verdict == "FAIL":
                failures += 1
            cases.append((label, None, want))
            out.append(f"### {label}\n\n`ascii-lint.py` -> {hits} finding(s) "
                       f"(expected {want}: {verdict})\n\n```\n{art.rstrip()}\n```\n")

    body = (f"# shape.py QA matrix\n\n{len(cases)} cases, {failures} mismatch(es).\n\n"
            + "\n".join(out))
    if a.out == "-":
        print(body)
    else:
        pathlib.Path(a.out).write_text(body, encoding="utf-8")
        print(f"{len(cases)} cases, {failures} exit-code mismatch(es) -> {a.out}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
