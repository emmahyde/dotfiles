#!/usr/bin/env python3
"""design2uss.py — Sector design-doc HTML -> Unity UI Toolkit draft assets.

The Sector Design System docs are absolutely-positioned HTML canvases with a
shared <style> block of small utility classes (.f frame, .hd header, .bd body,
.row k/v, .pill, .seg, .tabs, .tank, .belt, .lane, ...). This script converts
the MECHANICAL parts of a port so the agent only hand-writes variant layout
and data binding:

  manifest  list variant panels found in the HTML (label, width, classes)
  uss       emit a draft .uss from the <style> block (design-doc palette literals)
  scaffold  emit a C# VisualElement panel skeleton (frame + header + rows boilerplate)
  lab       emit a MonoBehaviour demo harness with the deferred-build pattern

Usage:
  design2uss.py manifest FILE.html
  design2uss.py uss FILE.html [--prefix variant] [--keep-furniture]
  design2uss.py scaffold PanelName --width 440 [--ns SectorProto.HudComponents]
  design2uss.py lab PanelName [--ns SectorProto.Hud] [--uss SheetName]

Output is a DRAFT: inline style="" on panel divs, BEM naming, gap/dashed/
gradient fallbacks, and Set*() APIs are finished by hand per the skill.
"""

import argparse
import re

# ── Design-doc CSS vars -> literals. These ARE FlightColors verbatim ─────────
VARS = {
    "--accent": "rgb(244,182,66)",
    "--accent-hot": "rgb(255,207,106)",
    "--accent-soft": "rgba(244,182,66,0.12)",
    "--accent-line": "rgba(244,182,66,0.38)",
    "--accent-dim": "rgba(244,182,66,0.2)",
    "--info": "rgb(108,199,224)",
    "--info-soft": "rgba(108,199,224,0.12)",
    "--ok": "rgb(125,211,164)",
    "--ok-soft": "rgba(125,211,164,0.12)",
    "--danger": "rgb(255,107,107)",
    "--danger-soft": "rgba(255,107,107,0.12)",
    "--warn": "rgb(244,182,66)",
    "--ink": "rgb(214,212,194)",
    "--ink-2": "rgb(181,180,160)",
    "--ink-dim": "rgb(106,112,100)",
    "--ink-mute": "rgb(63,74,63)",
    "--line": "rgb(30,36,31)",
    "--line-2": "rgb(46,58,46)",
    "--line-3": "rgb(70,82,70)",
}

# FlightColors field for each var — for the C# side / REFERENCE table.
FLIGHT_MAP = {
    "--accent": "FlightColors.Accent",
    "--accent-hot": "FlightColors.AccentHot",
    "--accent-soft": "FlightColors.AccentSoft",
    "--accent-line": "FlightColors.AccentLine",
    "--info": "FlightColors.Info",
    "--ok": "FlightColors.Ok",
    "--danger": "FlightColors.Danger",
    "--ink": "FlightColors.Ink",
    "--ink-2": "FlightColors.Ink2",
    "--ink-dim": "FlightColors.InkDim",
    "--ink-mute": "FlightColors.InkMute",
    "--line": "FlightColors.Line",
    "--line-2": "FlightColors.Line2",
    "--line-3": "FlightColors.Line3",
}

# Doc-canvas furniture, not widget classes — skipped unless --keep-furniture.
FURNITURE = {
    "html",
    "body",
    "a",
    ".sec",
    ".note",
    ".cap",
    ".rule",
    ".mass",
    ".brk",
    ".atag",
    ".led",
}

RENAMES = {"f": "frame", "tk": "corner-tick"}

SIDES = ("top", "right", "bottom", "left")


def resolve_colors(value, notes):
    def sub(m):
        name = m.group(1).strip()
        if name in VARS:
            return VARS[name]
        notes.append("unresolved var %s" % name)
        return "red"

    return re.sub(r"var\((--[\w-]+)\)", sub, value)


def expand_box(prop, value):
    vals = value.split()
    px = [v for v in vals if re.match(r"^-?\d", v)]
    if len(px) == 1:
        t = r = b = left = px[0]
    elif len(px) == 2:
        t, b = px[0], px[0]
        r = left = px[1]
    elif len(px) == 3:
        t, r, b = px
        left = r
    elif len(px) == 4:
        t, r, b, left = px
    else:
        return []
    return ["%s-%s: %s" % (prop, s, v) for s, v in zip(SIDES, (t, r, b, left))]


def translate_rule(selector, decls, prefix):
    """One CSS rule -> (uss_selector, uss_lines, notes, gap_request)."""
    notes = []
    out = []
    gap = None
    font_px = 10.0
    props = dict(decls)

    if "font-size" in props:
        m = re.match(r"([\d.]+)px", props["font-size"])
        if m:
            font_px = float(m.group(1))

    has_flex = props.get("display") == "flex"
    direction = props.get("flex-direction")

    for prop, value in props.items():
        v = value.strip()
        if prop in ("display",):
            continue
        if prop == "flex-direction":
            out.append("%s: %s" % (prop, v))
        elif prop in (
            "flex-wrap",
            "align-items",
            "align-self",
            "justify-content",
            "width",
            "height",
            "min-width",
            "min-height",
            "max-width",
            "max-height",
            "overflow",
            "white-space",
            "position",
            "top",
            "left",
            "right",
            "bottom",
            "flex-grow",
            "flex-shrink",
            "flex-basis",
        ):
            out.append("%s: %s" % (prop, v))
        elif prop in ("padding", "margin"):
            out.extend(expand_box(prop, v))
        elif prop == "gap":
            m = re.match(r"([\d.]+)px", v)
            if m:
                gap = (
                    float(m.group(1)),
                    direction or ("row" if has_flex and not direction else "column"),
                )
        elif re.match(r"border-(top|right|bottom|left)$", prop) and re.match(r"^0$", v):
            out.append("border-%s-width: 0" % prop.split("-")[1])
        elif prop == "border":
            m = re.match(r"([\d.]+)px\s+(\w+)\s+(.+)", v)
            if m:
                out.append("border-width: %spx" % m.group(1))
                out.append("border-color: %s" % resolve_colors(m.group(3), notes))
                if m.group(2) == "dashed":
                    notes.append("dashed border -> solid (USS has no dash)")
            else:
                notes.append("unparsed border: %s" % v)
        elif re.match(r"border-(top|right|bottom|left)$", prop):
            m = re.match(r"([\d.]+)px\s+(\w+)\s+(.+)", v)
            if m:
                side = prop.split("-")[1]
                out.append("border-%s-width: %spx" % (side, m.group(1)))
                out.append(
                    "border-%s-color: %s" % (side, resolve_colors(m.group(3), notes))
                )
                if m.group(2) == "dashed":
                    notes.append("dashed border -> solid")
        elif prop.startswith("border-"):
            out.append("%s: %s" % (prop, resolve_colors(v, notes)))
        elif prop == "font-size":
            out.append("font-size: %s" % v)
        elif prop == "letter-spacing":
            m = re.match(r"([\d.]+)em", v)
            out.append(
                "letter-spacing: %spx"
                % (round(float(m.group(1)) * font_px, 2) if m else v)
            )
        elif prop == "color":
            out.append("color: %s" % resolve_colors(v, notes))
        elif prop in ("background", "background-color"):
            if "gradient" in v or "url(" in v:
                flat = (
                    resolve_colors(re.search(r"var\((--[\w-]+)\)", v).group(1), notes)
                    if re.search(r"var\((--[\w-]+)\)", v)
                    else "rgba(0,0,0,0)"
                )
                out.append("background-color: %s" % flat)
                notes.append("gradient flattened")
            else:
                out.append("background-color: %s" % resolve_colors(v, notes))
        elif prop == "text-align":
            mapping = {
                "left": "middle-left",
                "right": "middle-right",
                "center": "middle-center",
            }
            if v in mapping:
                out.append("-unity-text-align: %s" % mapping[v])
        elif prop == "text-transform":
            if v == "uppercase":
                notes.append("text-transform: uppercase -> author uppercase strings")
        elif prop in (
            "box-shadow",
            "text-shadow",
            "animation",
            "clip-path",
            "cursor",
            "line-height",
            "font-variant-numeric",
            "font-family",
            "font-weight",
            "text-decoration",
            "z-index",
            "content",
            "inset",
            "transform",
        ):
            if prop in ("box-shadow", "text-shadow"):
                notes.append(
                    "%s dropped (glow approximated by bright fill color)" % prop
                )
            # remaining props intentionally dropped, no note noise
        else:
            notes.append("unhandled property %s: %s" % (prop, v))

    if has_flex and not direction:
        out.insert(0, "flex-direction: row")

    uss_sel = translate_selector(selector, prefix)
    return uss_sel, out, notes, gap


def translate_selector(sel, prefix):
    out = []
    parts = re.split(r"(\s*>\s*|\s+)", sel.strip())
    for p in parts:
        if p is None or p == "":
            continue
        if p.strip() == ">":
            out.append(" > ")
            continue
        if p.isspace():
            out.append(" ")
            continue
        m = re.match(r"^([a-z][a-z0-9-]*)((?:\.[\w-]+)*)$", p)
        tag, classes = (m.group(1), m.group(2)) if m else ("", p)
        class_list = [c for c in classes.split(".") if c]
        if tag and not class_list:
            out.append(
                "*" if tag in ("span", "button", "i", "u", "s", "b", "div") else tag
            )
            continue
        if class_list:
            base = prefix + RENAMES.get(class_list[0], class_list[0])
            name = base + "".join("--" + c for c in class_list[1:])
            out.append(("*" if tag else "") + "." + name)
        else:
            out.append(p)
    return "".join(out).strip()


def parse_style_block(html):
    m = re.search(r"<style>(.*?)</style>", html, re.S)
    if not m:
        return []
    css = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
    rules = []
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        decls = []
        for prop, val in re.findall(r"([-a-z]+)\s*:\s*([^;]+);?", body):
            decls.append((prop.strip(), val.strip()))
        if decls:
            rules.append((sel.strip(), decls))
    return rules


def cmd_manifest(args):
    html = open(args.html, encoding="utf-8").read()
    print("variants in %s:" % args.html)
    for m in re.finditer(r"<!--\s*-*\s*Variant\s+([^:]+):\s*(.*?)\s*-{2,}\s*-->", html):
        label, desc = m.group(1).strip(), m.group(2).strip()
        chunk = html[m.end() : m.end() + 4000]
        w = re.search(r'class="f"[^>]*width:(\d+)px', chunk)
        cap = re.search(r'<div class="cap[^"]*"[^>]*><b>(.*?)</b>', chunk)
        classes = sorted(
            {
                c
                for cl in re.findall(r'class="([\w-]+(?: [\w-]+)*)"', chunk)
                for c in cl.split()
            }
        )
        widget = [c for c in classes if c not in FURNITURE]
        print(
            "  %-22s w=%s  cap=%s"
            % (label, w.group(1) + "px" if w else "?", cap.group(1) if cap else "?")
        )
        print("      classes: %s" % " ".join(widget[:18]))
        print("      desc: %s" % desc)


def cmd_uss(args):
    html = open(args.html, encoding="utf-8").read()
    rules = parse_style_block(html)
    print("/* Generated by design2uss.py from %s" % args.html)
    print(
        "   Design-doc palette literals (== FlightColors). Draft — finish naming/gaps by hand. */"
    )
    print()
    all_notes = []
    for sel, decls in rules:
        if "::" in sel or ":" in sel:
            all_notes.append("%s: pseudo selector skipped" % sel)
            continue
        m = re.match(r"\.([\w-]+)", sel)
        first = m.group(1) if m else re.split(r"[.:\s>]+", sel)[0]
        if not args.keep_furniture and (
            ("." + first) in FURNITURE or first in FURNITURE
        ):
            continue
        uss_sel, lines, notes, gap = translate_rule(sel, decls, args.prefix)
        if not lines:
            continue
        print("%s {" % uss_sel)
        for line in lines:
            print("    %s;" % line)
        if gap:
            axis = "margin-right" if gap[1] == "row" else "margin-bottom"
            print("}")
            print("%s > * {" % uss_sel)
            print(
                "    %s: %spx;"
                % (axis, int(gap[0]) if gap[0] == int(gap[0]) else gap[0])
            )
        print("}")
        for n in notes:
            all_notes.append("%s: %s" % (uss_sel, n))
        print()
    if all_notes:
        print("/* ── Review notes ──")
        for n in all_notes:
            print("   %s" % n)
        print("*/")


SCAFFOLD = r"""// __NAME__ — ported from a Sector Design System variant (see design doc HTML).
// Frame + header + key/value row boilerplate generated by design2uss.py;
// variant body content and Set*() data APIs are hand-finished.

using UnityEngine;
using UnityEngine.UIElements;

namespace __NS__
{
    public sealed class __NAME__ : VisualElement
    {
        private readonly Label _headerTitle;
        private readonly Label _headerMeta;

        // Change-cached row: only touch the tree when a value actually differs.
        private sealed class KeyValuePairRow : VisualElement
        {
            public readonly Label Key;
            public readonly Label Value;
            public KeyValuePairRow()
            {
                AddToClassList("variant-row");
                Key = new Label();
                Key.AddToClassList("variant-row__k");
                Add(Key);
                Value = new Label();
                Value.AddToClassList("variant-row__v");
                Add(Value);
            }

            public void Set(string k, string v, string modifier = null)
            {
                if (Key.text != k) Key.text = k;
                Value.ClearClassList();
                Value.AddToClassList("variant-row__v");
                if (!string.IsNullOrEmpty(modifier)) Value.AddToClassList("variant-row__v--" + modifier);
                if (Value.text != v) Value.text = v;
            }
        }

        public __NAME__()
        {
            AddToClassList("variant-frame");
            style.width = __WIDTH__f;

            Add(CreateCornerTick("tl"));
            Add(CreateCornerTick("br"));

            var hd = new VisualElement();
            hd.AddToClassList("variant-hd");
            _headerTitle = new Label("__TITLE__");
            _headerTitle.AddToClassList("variant-hd__title");
            hd.Add(_headerTitle);
            _headerMeta = new Label("");
            _headerMeta.AddToClassList("variant-hd__meta");
            hd.Add(_headerMeta);
            Add(hd);

            var bd = new VisualElement();
            bd.AddToClassList("variant-bd");
            // Variant body content goes here: rows, pills, segments, lanes.
            Add(bd);
        }

        private static VisualElement CreateCornerTick(string corner)
        {
            var tick = new VisualElement();
            tick.AddToClassList("variant-corner-tick");
            tick.AddToClassList("variant-corner-tick--" + corner);
            return tick;
        }
    }
}
"""

LAB = r"""// __NAME__ demo harness — play-mode verification surface for a ported panel.
// OnEnable can run before the UIDocument attaches its panel root, so the tree
// builds on the first Update frame where rootVisualElement exists.

using UnityEngine;
using UnityEngine.UIElements;
using __PANELNS__;

namespace __NS__
{
    public sealed class __NAME__ : MonoBehaviour
    {
        private UIDocument _doc;
        private bool _built;
        private VisualElement _panel;

        private void OnEnable()
        {
            _doc = GetComponent<UIDocument>();
            if (_doc == null) _doc = gameObject.AddComponent<UIDocument>();
            _doc.panelSettings = Resources.Load<PanelSettings>("SectorHudPanel");
            _doc.sortingOrder = 15f;
            _built = false;
        }

        private void BuildUi()
        {
            var root = _doc.rootVisualElement;
            if (root == null) return;
            _built = true;

            var tokens = Resources.Load<StyleSheet>("SectorDesignTokens");
            if (tokens != null) root.styleSheets.Add(tokens);
            var sheet = Resources.Load<StyleSheet>("__USS__");
            if (sheet != null) root.styleSheets.Add(sheet);

            var container = new VisualElement();
            container.style.position = Position.Absolute;
            container.style.top = 40f;
            container.style.left = 40f;
            _panel = new __PANEL__();
            container.Add(_panel);
            root.Add(container);
        }

        private void Update()
        {
            if (!_built) BuildUi();
            if (!_built) return;
            // Drive the panel's Set*() APIs with demo or live data here.
        }
    }
}
"""


def cmd_scaffold(args):
    title = args.title or (args.name.lower().replace("panel", " panel").strip())
    out = (
        SCAFFOLD.replace("__NAME__", args.name)
        .replace("__NS__", args.ns)
        .replace("__WIDTH__", str(args.width))
        .replace("__TITLE__", title)
    )
    print(out)


def cmd_lab(args):
    out = (
        LAB.replace("__NAME__", args.name + "Lab")
        .replace("__NS__", args.ns)
        .replace("__PANEL__", args.panel)
        .replace("__PANELNS__", args.panel_ns)
        .replace("__USS__", args.uss)
    )
    print(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("manifest")
    m.add_argument("html")

    u = sub.add_parser("uss")
    u.add_argument("html")
    u.add_argument("--prefix", default="variant-")
    u.add_argument("--keep-furniture", action="store_true")

    s = sub.add_parser("scaffold")
    s.add_argument("name")
    s.add_argument("--width", type=float, default=440)
    s.add_argument("--ns", default="SectorProto.HudComponents")
    s.add_argument("--title", default=None)

    lab = sub.add_parser("lab")
    lab.add_argument("name")
    lab.add_argument("--panel", default="PanelName")
    lab.add_argument("--panel-ns", dest="panel_ns", default="SectorProto.HudComponents")
    lab.add_argument("--ns", default="SectorProto.Hud")
    lab.add_argument("--uss", default="TargetAndHopperVariants")

    args = ap.parse_args()
    {
        "manifest": cmd_manifest,
        "uss": cmd_uss,
        "scaffold": cmd_scaffold,
        "lab": cmd_lab,
    }[args.cmd](args)


if __name__ == "__main__":
    main()
