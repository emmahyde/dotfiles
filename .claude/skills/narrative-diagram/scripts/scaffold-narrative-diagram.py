#!/usr/bin/env python3
"""Generate a narrative-diagram HTML document.

Example:
  scaffold-narrative-diagram.py out.html --title 'System map' \
    --section 'Loop|How it runs|flowchart|loop.mmd' --json

The section format is TITLE|LEDE|KIND|DIAGRAM_FILE. The command writes the
HTML file and reports insertion metadata, including the first diagram line.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

PALETTES = {
    "garden": "#2e7d32",
    "indigo": "#3949ab",
    "ocean": "#1565c0",
    "amber": "#ef6c00",
}


def parse_section(value: str) -> dict[str, str]:
    parts = value.split("|", 3)
    if len(parts) != 4:
        raise argparse.ArgumentTypeError(
            "section must be TITLE|LEDE|KIND|DIAGRAM_FILE"
        )
    title, lede, kind, source = parts
    if kind not in {"flowchart", "classDiagram"}:
        raise argparse.ArgumentTypeError("section kind must be flowchart or classDiagram")
    return {"title": title, "lede": lede, "kind": kind, "source": source}


def section_html(section: dict[str, str], index: int) -> str:
    title = section["title"]
    lede = section["lede"]
    kind = section["kind"]
    source = Path(section["source"]).read_text(encoding="utf-8")
    export_name = f"diagram-{index}"
    chips = (
        '<span class="chip l-core">flowchart</span>'
        if kind == "flowchart"
        else '<span class="chip l-new">classDiagram</span>'
    )
    return "\n".join(
        [
            "<section>",
            '  <div class="sec-head">',
            f"    <h2>{title}</h2>",
            f'    <button class="export-svg" data-export-name="{export_name}">Export SVG</button>',
            "  </div>",
            f'  <p class="lede">{lede}</p>',
            f'  <div class="legend">{chips}</div>',
            '  <div class="mermaid">',
            source.rstrip(),
            "  </div>",
            "</section>",
        ]
    )


def load_config(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("config must be a JSON object")
    return value


def render(args: argparse.Namespace) -> tuple[str, dict[str, Any]]:
    template = Path(args.template).read_text(encoding="utf-8")
    config = load_config(Path(args.config)) if args.config else {}
    title = args.title or config.get("title") or "Narrative diagram"
    subtitle = args.subtitle or config.get("subtitle") or "A walk through the system"
    palette = args.palette or config.get("palette") or "garden"
    if palette not in PALETTES:
        raise ValueError(f"unknown palette {palette!r}; choose from {', '.join(PALETTES)}")

    sections = list(config.get("sections", []))
    sections.extend(args.section or [])
    if sections and isinstance(sections[0], str):
        sections = [parse_section(section) for section in sections]

    rendered = template.replace("Doc title — one-line subject", title)
    rendered = rendered.replace("Doc title &mdash; one-line subject", title)
    rendered = rendered.replace(
        "flowchart + classDiagram &middot; <span class=\"tag-plan\">dashed indigo</span> = upstream/planned &middot; <span class=\"tag-new\">green</span> = new &middot; solid hues = existing today",
        subtitle,
    )
    rendered = rendered.replace("--accent: #2e7d32", f"--accent: {PALETTES[palette]}")

    marker = "<section>\n    <h2>Notes</h2>"
    if sections and marker not in rendered:
        raise ValueError("template is missing the Notes section insertion marker")
    insertion = "\n".join(section_html(section, i + 1) for i, section in enumerate(sections))
    rendered = rendered.replace(marker, f"{insertion}\n\n{marker}", 1)
    lines = rendered.splitlines()
    first_diagram = next(
        (number for number, line in enumerate(lines, 1) if '<div class="mermaid">' in line),
        None,
    )
    metadata = {
        "output": str(Path(args.output).resolve()),
        "palette": palette,
        "sections": len(sections),
        "first_diagram_line": first_diagram,
    }
    return rendered, metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--template", type=Path, default=Path(__file__).parent.parent / "references/template.html")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--title")
    parser.add_argument("--subtitle")
    parser.add_argument("--palette", choices=sorted(PALETTES))
    parser.add_argument("--section", action="append", type=parse_section, default=[])
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()
    rendered, metadata = render(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered, encoding="utf-8")
    print(json.dumps(metadata) if args.as_json else f"Wrote {metadata['output']}\nFirst diagram insertion: line {metadata['first_diagram_line']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
