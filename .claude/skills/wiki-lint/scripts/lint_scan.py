#!/usr/bin/env python3
"""Deterministic wiki-lint scan engine (mechanical checks only).

Implements: frontmatter gaps, wikilink extraction (fence+inline-code scrubbed),
dead-link resolution, orphan detection, empty-section detection, naming
violations, address-validation data collection, and stale-terminology grep.

Usage: python3 lint_scan.py <vault_root> [--exclude SUBPATH ...]
Prints a single JSON blob to stdout.
"""
import json, os, re, sys, hashlib
from datetime import date

ORPHAN_EXEMPT_NAMES = {
    "_index.md", "index.md", "log.md", "hot.md", "overview.md",
    "dashboard.md", "dashboard.base", "Wiki Map.md", "getting-started.md",
}
ORPHAN_EXEMPT_DIRS = ("wiki/_templates/", "wiki/meta/", "wiki/folds/")

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)
WIKILINK_RE = re.compile(r"\[\[([^\]|#]+?)(?:\\?\|[^\]]+)?(?:#[^\]]+)?\]\]")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


def scrub_code(body):
    lines = body.split("\n")
    out = []
    in_fence = False
    fence_marker = None
    for line in lines:
        stripped = line.strip()
        if not in_fence and re.match(r"^(```|~~~)", stripped):
            in_fence = True
            fence_marker = stripped[:3]
            out.append("")
            continue
        if in_fence:
            if stripped.startswith(fence_marker):
                in_fence = False
            out.append("")
            continue
        line = re.sub(r"`[^`]*`", "", line)
        out.append(line)
    return "\n".join(out)


def extract_wikilinks(body):
    scrubbed = scrub_code(body)
    targets = []
    for m in WIKILINK_RE.finditer(scrubbed):
        t = m.group(1).strip()
        if "," in t or "\n" in t:
            continue
        targets.append(t)
    return targets


def parse_frontmatter(text):
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    raw = m.group(1)
    fm = {}
    for line in raw.split("\n"):
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        k = k.strip()
        v = v.strip()
        fm[k] = v
    return fm, text[m.end():]


def is_orphan_exempt(relpath, fm):
    base = os.path.basename(relpath)
    if base in ORPHAN_EXEMPT_NAMES:
        return True
    for d in ORPHAN_EXEMPT_DIRS:
        if relpath.startswith(d):
            return True
    t = fm.get("type", "").strip('"').strip("'")
    if t in ("meta", "fold"):
        return True
    return False


def find_empty_sections(body):
    lines = body.split("\n")
    empties = []
    headings = []
    for i, line in enumerate(lines):
        m = HEADING_RE.match(line)
        if m:
            headings.append((i, len(m.group(1)), m.group(2).strip()))
    for idx, (i, level, title) in enumerate(headings):
        # section boundary = next heading at the SAME or SHALLOWER level.
        # A heading immediately followed by a *deeper* subheading is not
        # "empty" -- it delegates its content to child sections, which is
        # normal document structure (e.g. H1 title followed by H2 sections).
        end = len(lines)
        j = idx + 1
        while j < len(headings) and headings[j][1] > level:
            j += 1
        if j < len(headings):
            end = headings[j][0]
        content = lines[i + 1:end]
        has_content = any(l.strip() for l in content)
        if not has_content:
            empties.append(title)
    return empties


def main():
    vault_root = sys.argv[1]
    excludes = []
    if "--exclude" in sys.argv:
        idx = sys.argv.index("--exclude")
        excludes = sys.argv[idx + 1:]

    wiki_root = os.path.join(vault_root, "wiki")
    raw_root_candidates = [os.path.join(vault_root, ".raw"), os.path.join(wiki_root, ".raw")]

    def excluded(relpath):
        for ex in excludes:
            if relpath.startswith(ex):
                return True
        return False

    md_files = {}   # relpath -> (text, fm, body)
    canvas_basenames = set()
    other_link_targets = set()  # bare filenames (with ext) resolvable as wikilink targets: .canvas, .base, images

    for dirpath, dirnames, filenames in os.walk(wiki_root):
        relroot = os.path.relpath(dirpath, vault_root)
        if excluded(relroot + "/"):
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if not excluded(os.path.join(relroot, d) + "/")]
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, vault_root)
            if excluded(rel):
                continue
            if os.path.islink(full):
                continue
            if fn.endswith(".md"):
                try:
                    with open(full, "r", encoding="utf-8", errors="replace") as f:
                        text = f.read()
                except Exception as e:
                    text = ""
                fm, body = parse_frontmatter(text)
                md_files[rel] = {"text": text, "fm": fm, "body": body}
            elif fn.endswith(".canvas"):
                canvas_basenames.add(fn[:-7])
                other_link_targets.add(fn)
            elif fn.endswith((".base", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".pdf")):
                other_link_targets.add(fn)

    # raw tree basenames for cross-zone resolution
    raw_basenames = {}  # basename(no ext) -> relpath under vault
    raw_fullpaths = set()
    for raw_root in raw_root_candidates:
        if not os.path.isdir(raw_root):
            continue
        for dirpath, dirnames, filenames in os.walk(raw_root):
            for fn in filenames:
                if fn.endswith(".md"):
                    full = os.path.join(dirpath, fn)
                    rel = os.path.relpath(full, vault_root)
                    raw_fullpaths.add(rel)
                    raw_basenames.setdefault(fn[:-3], []).append(rel)

    for attach_dir in (os.path.join(vault_root, "_attachments"), os.path.join(wiki_root, "_attachments")):
        if os.path.isdir(attach_dir):
            for dirpath, _, filenames in os.walk(attach_dir):
                for fn in filenames:
                    other_link_targets.add(fn)

    md_basenames = {}  # basename(no ext) -> [relpaths]
    for rel in md_files:
        base = os.path.basename(rel)[:-3]
        md_basenames.setdefault(base, []).append(rel)

    # ---- frontmatter gaps ----
    required = ["type", "status", "created", "updated", "tags"]
    frontmatter_gaps = {}
    for rel, data in md_files.items():
        fm = data["fm"]
        missing = [f for f in required if f not in fm]
        if missing:
            frontmatter_gaps[rel] = missing

    # ---- wikilinks / dead links / inbound graph ----
    outbound = {}
    inbound = {}
    dead_links = {}
    for rel, data in md_files.items():
        targets = extract_wikilinks(data["body"])
        outbound[rel] = targets
        for t in targets:
            resolved = None
            if "/" in t:
                cand = os.path.join("wiki", t + ".md") if not t.startswith("wiki/") else t + ".md"
                if cand in md_files:
                    resolved = cand
                else:
                    cand2 = os.path.join(".raw", re.sub(r"^(notion|skills|jira|slack|articles|github)/", "", t) + ".md")
                    if cand2 in raw_fullpaths:
                        resolved = cand2
            if resolved is None:
                base = os.path.basename(t)
                if base in md_basenames:
                    resolved = md_basenames[base][0]
                elif base in canvas_basenames or base + ".canvas" in other_link_targets:
                    resolved = "<canvas>" + base
                elif base in other_link_targets:
                    resolved = "<attachment>" + base
                elif base in raw_basenames:
                    resolved = raw_basenames[base][0]
            if resolved:
                inbound.setdefault(resolved, set()).add(rel)
            else:
                dead_links.setdefault(t, set()).add(rel)

    dead_links_out = {k: sorted(v) for k, v in dead_links.items()}

    # ---- orphans ----
    orphans = []
    for rel, data in md_files.items():
        if is_orphan_exempt(rel, data["fm"]):
            continue
        if rel not in inbound or not inbound[rel]:
            orphans.append(rel)

    # ---- empty sections ----
    empty_sections = {}
    for rel, data in md_files.items():
        empties = find_empty_sections(data["body"])
        if empties:
            empty_sections[rel] = empties

    # ---- naming violations ----
    naming_violations = []
    for rel in md_files:
        base = os.path.basename(rel)[:-3]
        if base in ("_index", "index", "log", "hot", "overview", "dashboard", "getting-started", "_TEMPLATE"):
            continue
        # Title Case with spaces convention (allow hyphens for slugs used deliberately, flag lowercase-with-dashes files that aren't slugs)
        if re.match(r"^[a-z0-9][a-z0-9\-]*$", base) and "-" in base:
            naming_violations.append({"path": rel, "issue": "lowercase-dash filename (expected Title Case with spaces)"})

    # duplicate basenames (case-sensitive per skill, but flag case-insensitive collisions as a sub-note)
    dup_basenames = {b: paths for b, paths in md_basenames.items() if len(paths) > 1}

    # ---- stale terminology grep (exhaustive, code-scrubbed) ----
    stale_terms = ["steering verbs", "orchestrator chat"]
    stale_hits = {}
    for rel, data in md_files.items():
        scrubbed = scrub_code(data["body"]).lower()
        title_lower = rel.lower()
        hits = []
        for term in stale_terms:
            if term in scrubbed or term in title_lower:
                hits.append(term)
        if hits:
            stale_hits[rel] = hits

    # ---- address validation data ----
    addressed = {}
    for rel, data in md_files.items():
        addr = data["fm"].get("address")
        if addr:
            addr = addr.strip('"').strip("'")
            addressed[rel] = {"address": addr, "created": data["fm"].get("created", "").strip('"').strip("'"),
                               "type": data["fm"].get("type", "").strip('"').strip("'")}

    result = {
        "vault_root": vault_root,
        "pages_scanned": len(md_files),
        "frontmatter_gaps": frontmatter_gaps,
        "dead_links": dead_links_out,
        "orphans": sorted(orphans),
        "empty_sections": empty_sections,
        "naming_violations": naming_violations,
        "dup_basenames": dup_basenames,
        "stale_terminology": stale_hits,
        "addressed_pages": addressed,
        "all_pages": sorted(md_files.keys()),
    }
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
