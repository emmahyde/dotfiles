#!/usr/bin/env python3
"""Deterministic self-check for a guardrail kit, per format-contract.md.

Usage:
    python3 lint_kit.py <CLAUDE.md path> <docs/guardrails dir> [--update-manifest]

Checks CLAUDE.md's kit zone (routing table, iron rules, hard stops) against the
budgets in format-contract.md, and every docs/guardrails/*.md file against the
per-doc shape (version comment, trigger restatement, ID uniqueness per prefix,
prohibition-replacement pairing, line/word caps). Exits 1 if any FAIL is found.

This exists because these checks are cheap to get wrong by eye and cheap to get
right with a script -- run it after every edit to a kit file, not just at the end.
"""
import argparse
import json
import re
import sys
from pathlib import Path

DEFAULT_IRON_BUDGET = 15
DEFAULT_CAPS_BUDGET = 5
DEFAULT_KIT_CORE_LINES = 60
DEFAULT_DOC_LINE_CAP = 120
DEFAULT_DOC_WORD_CAP = 1100

ID_RE = re.compile(r"^-\s*([A-Za-z]{1,3}\d+[a-z]?)\.\s", re.MULTILINE)
NEVER_RE = re.compile(r"\bNEVER\b", re.IGNORECASE)
REPLACEMENT_RE = re.compile(r"->|—")
BAD_LABEL_RE = re.compile(r"\bBAD\b")
BAD_CORRECT_RE = re.compile(r"^BAD \(never do this\):")
VERSION_COMMENT_RE = re.compile(r"^<!--.*v\d+(\.\d+)?.*-->")
ARCHIVE_EXEMPT = {"migration-log", "project-notes", "project"}


class Report:
    def __init__(self):
        self.fails = []
        self.warns = []

    def fail(self, msg):
        self.fails.append(msg)

    def warn(self, msg):
        self.warns.append(msg)

    def ok(self):
        return not self.fails


def section_lines(lines, start_heading_prefix, stop_headings):
    """Return (start_idx, end_idx, body_lines) for the section starting at the
    first line matching start_heading_prefix, ending before the next heading in
    stop_headings or any '## ' heading if stop_headings is empty."""
    start = None
    for i, line in enumerate(lines):
        if line.startswith(start_heading_prefix):
            start = i
            break
    if start is None:
        return None, None, []
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if lines[j].startswith("## "):
            end = j
            break
    return start, end, lines[start:end]


def lint_claude_md(path, report, iron_budget, caps_budget, kit_core_cap, guardrails_dir):
    text = path.read_text()
    lines = text.splitlines()

    r_start, r_end, routing_block = section_lines(lines, "## Routing", [])
    if r_start is None:
        report.warn(f"{path}: no '## Routing' heading found — skipping routing-table checks")
    else:
        doc_paths = re.findall(r"\|\s*[^|]+\|\s*([^\s|]+\.md)\s*\|", "\n".join(routing_block))
        seen_paths = set()
        for p in doc_paths:
            seen_paths.add(p)
            candidate = Path(p)
            resolved = candidate if candidate.is_absolute() else (path.parent / p)
            if not resolved.exists():
                resolved2 = guardrails_dir / Path(p).name
                if not resolved2.exists():
                    report.fail(f"{path}: routing table points at '{p}', which does not exist")
        if not doc_paths:
            report.warn(f"{path}: routing table found but no '.md' doc paths parsed out of it")

    i_start, i_end, iron_block = section_lines(lines, "## Iron rules", [])
    if i_start is None:
        report.warn(f"{path}: no '## Iron rules' heading found — skipping iron-rule checks")
    else:
        iron_bullets = [l for l in iron_block if l.startswith("- ")]
        if len(iron_bullets) > iron_budget:
            report.fail(
                f"{path}: {len(iron_bullets)} iron rules exceeds budget {iron_budget} "
                f"(F3) — demote one to a doc"
            )
        for b in iron_bullets:
            if "(" not in b or not b.rstrip().endswith(")"):
                report.warn(f"{path}: iron rule missing parenthesized reason (F6): {b[:70]}...")
            if len(b.split()) > 24:
                report.warn(f"{path}: iron rule looks long for a compressed line (F1): {b[:70]}...")

    h_start, h_end, hard_block = section_lines(lines, "## Hard stops", [])
    if h_start is None:
        report.warn(f"{path}: no '## Hard stops' heading found — skipping hard-stop checks")
    else:
        hard_bullets = [l for l in hard_block if l.startswith("- ")]
        if len(hard_bullets) > caps_budget:
            report.fail(
                f"{path}: {len(hard_bullets)} hard stops exceeds budget {caps_budget} (F4)"
            )
        for b in hard_bullets:
            if not REPLACEMENT_RE.search(b):
                report.fail(f"{path}: hard stop has no '->' or em-dash replacement (F5): {b[:70]}...")

    if i_start is not None and h_end is not None:
        headings_between = [l for l in lines[i_end:h_start] if l.startswith("## ")]
        if len(headings_between) > 1:
            report.warn(
                f"{path}: {len(headings_between)} headings between Iron rules and Hard "
                f"stops (F8 wants at most one project section there): {headings_between}"
            )
        kit_core = (i_end - i_start) + (h_end - h_start)
        if r_start is not None:
            kit_core += r_end - r_start
        if kit_core > kit_core_cap:
            report.warn(
                f"{path}: kit-zone line count ~{kit_core} exceeds default budget "
                f"{kit_core_cap} (F3) — this excludes any '## Project' content in between"
            )


def lint_doc(path, report, line_cap, word_cap, all_prefixes):
    stem_lower = path.stem.lower()
    if stem_lower in ARCHIVE_EXEMPT or stem_lower.startswith("_"):
        return set()

    text = path.read_text()
    lines = text.splitlines()
    words = len(text.split())

    if len(lines) > line_cap:
        report.fail(f"{path}: {len(lines)} lines exceeds cap {line_cap} (F11) — split by trigger")
    if words > word_cap:
        report.fail(f"{path}: {words} words exceeds cap {word_cap} (F11) — split by trigger")

    if not lines or not VERSION_COMMENT_RE.match(lines[0]):
        report.fail(f"{path}: line 1 must be a version comment like '<!-- kit: v1.0 ... -->' (F15)")

    first_content = next((l for l in lines[1:] if l.strip()), "")
    if not first_content or first_content.startswith("-"):
        report.warn(
            f"{path}: expected a prose trigger-restatement sentence as the first "
            f"non-comment line (F11), found: {first_content[:70]!r}"
        )

    file_ids = ID_RE.findall(text)
    if not file_ids:
        report.warn(f"{path}: no checklist IDs found (pattern: '- XN. ...')")
    prefixes_here = set()
    for full_id in file_ids:
        m = re.match(r"([A-Za-z]{1,3})", full_id)
        if m:
            prefixes_here.add(m.group(1))
    for prefix in prefixes_here:
        if prefix in all_prefixes and all_prefixes[prefix] != path:
            report.fail(
                f"{path}: prefix '{prefix}' already used in {all_prefixes[prefix]} "
                f"(F12 wants a unique prefix per doc)"
            )
        else:
            all_prefixes[prefix] = path

    seen_ids = set()
    for full_id in file_ids:
        if full_id in seen_ids:
            report.fail(f"{path}: duplicate checklist ID '{full_id}' within the same file")
        seen_ids.add(full_id)

    for line in lines:
        if NEVER_RE.search(line) and line.startswith("-") and not REPLACEMENT_RE.search(line):
            # Soft: real kits sometimes phrase the replacement without a literal
            # "->"/em-dash (a colon-separated before/after pair, a table row).
            # Only CLAUDE.md's actual Hard stops block enforces this as a FAIL.
            report.warn(f"{path}: 'Never' rule with no '->' or em-dash replacement (F5): {line[:70]}...")

    for line in lines:
        if BAD_LABEL_RE.search(line) and not BAD_CORRECT_RE.match(line.strip()):
            report.warn(
                f"{path}: a 'BAD' example line should start exactly with "
                f"'BAD (never do this):' (F13): {line[:70]}..."
            )

    if "--- reference ---" not in text:
        report.warn(f"{path}: no '--- reference ---' divider found (F11) — fine for a very short doc")

    return set(file_ids)


def check_manifest(guardrails_dir, all_ids, update):
    manifest_path = guardrails_dir / ".ids-manifest.json"
    report = Report()
    previous = set()
    if manifest_path.exists():
        try:
            previous = set(json.loads(manifest_path.read_text()).get("ids", []))
        except json.JSONDecodeError:
            report.warn(f"{manifest_path}: not valid JSON, ignoring for this run")

    missing = previous - all_ids
    for mid in sorted(missing):
        report.warn(
            f"ID '{mid}' was in the manifest but is absent now (F12: confirm this "
            f"retirement was intentional, and never reuse '{mid}' for a new rule)"
        )

    if update:
        manifest_path.write_text(json.dumps({"ids": sorted(all_ids)}, indent=2) + "\n")
        print(f"Updated manifest: {manifest_path} ({len(all_ids)} IDs)")

    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("claude_md", type=Path)
    parser.add_argument("guardrails_dir", type=Path)
    parser.add_argument("--iron-budget", type=int, default=DEFAULT_IRON_BUDGET)
    parser.add_argument("--caps-budget", type=int, default=DEFAULT_CAPS_BUDGET)
    parser.add_argument("--kit-core-cap", type=int, default=DEFAULT_KIT_CORE_LINES)
    parser.add_argument("--doc-line-cap", type=int, default=DEFAULT_DOC_LINE_CAP)
    parser.add_argument("--doc-word-cap", type=int, default=DEFAULT_DOC_WORD_CAP)
    parser.add_argument("--update-manifest", action="store_true")
    args = parser.parse_args()

    if not args.claude_md.exists():
        print(f"FAIL: {args.claude_md} does not exist", file=sys.stderr)
        sys.exit(1)
    if not args.guardrails_dir.is_dir():
        print(f"FAIL: {args.guardrails_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    report = Report()
    lint_claude_md(
        args.claude_md, report, args.iron_budget, args.caps_budget,
        args.kit_core_cap, args.guardrails_dir,
    )

    all_prefixes = {}
    all_ids = set()
    for doc in sorted(args.guardrails_dir.glob("*.md")):
        all_ids |= lint_doc(doc, report, args.doc_line_cap, args.doc_word_cap, all_prefixes)

    manifest_report = check_manifest(args.guardrails_dir, all_ids, args.update_manifest)
    report.warns.extend(manifest_report.warns)
    report.fails.extend(manifest_report.fails)

    if report.warns:
        print(f"WARNINGS ({len(report.warns)}):")
        for w in report.warns:
            print(f"  - {w}")
    if report.fails:
        print(f"\nFAILURES ({len(report.fails)}):")
        for f in report.fails:
            print(f"  - {f}")
        print(f"\nlint_kit: FAIL ({len(report.fails)} failures, {len(report.warns)} warnings)")
        sys.exit(1)

    print(f"\nlint_kit: PASS ({len(report.warns)} warnings, 0 failures)")
    sys.exit(0)


if __name__ == "__main__":
    main()
