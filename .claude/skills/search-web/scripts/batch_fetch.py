#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["trafilatura>=2.0", "httpx>=0.27"]
# ///
"""Batch-fetch web pages to markdown in one invocation.

Reads a list of URLs, fetches each page concurrently, extracts main-content
markdown with trafilatura, and falls back to the r.jina.ai reader when
trafilatura yields too little (JS-rendered SPAs, anti-extraction layouts).

Writes one markdown file per page plus a single corpus-summary.md index,
then prints the absolute path of that summary file as the only stdout line.

Usage:
    batch_fetch.py --urls urls.txt --out <dir> [--topic "..."]
    batch_fetch.py --url https://a --url https://b --out <dir>

`urls.txt` is newline-delimited; blank lines and `#` comments are ignored.
Each non-comment line may optionally carry a tab-separated note:
    https://example.com/post<TAB>why this URL was indexed
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import pathlib
import re
import sys
import textwrap
import urllib.parse
from typing import NotRequired, TypedDict

import httpx
import trafilatura

# trafilatura output shorter than this (chars) is treated as a failed
# extraction and retried through the r.jina.ai reader.
MIN_EXTRACT_CHARS = 600
# 30s absorbs slow origins and the r.jina.ai reader's own fetch without
# letting one stuck page stall the whole batch.
FETCH_TIMEOUT = 30.0
# 8 concurrent fetches: enough throughput for a 5-15 page corpus while
# staying polite to any single host and bounded on a laptop.
MAX_WORKERS = 8
UA = "Mozilla/5.0 (compatible; web-research-corpus/1.0)"


class PageResult(TypedDict):
    idx: int
    url: str
    note: str
    method: str
    error: str | None
    title: str
    markdown: str
    words: int
    file: NotRequired[pathlib.Path]  # assigned in main() once the output dir is known


def slugify(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    raw = f"{parsed.netloc}{parsed.path}".strip("/")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", raw).strip("-").lower()
    return (slug or "page")[:60]


def fetch_trafilatura(url: str) -> str | None:
    """Return extracted markdown, or None on failure/too-thin output."""
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        return None
    md = trafilatura.extract(
        downloaded,
        output_format="markdown",
        include_links=True,
        include_tables=True,
        with_metadata=True,
    )
    if md and len(md) >= MIN_EXTRACT_CHARS:
        return md
    return None


def fetch_jina(url: str) -> str | None:
    """Fallback: r.jina.ai reader returns clean markdown for JS-heavy pages."""
    try:
        resp = httpx.get(
            f"https://r.jina.ai/{url}",
            headers={"User-Agent": UA, "X-Return-Format": "markdown"},
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
        )
        resp.raise_for_status()
        text = resp.text.strip()
        return text or None
    except Exception as exc:
        print(f"  jina fallback failed for {url}: {type(exc).__name__}: {exc}", file=sys.stderr)
        return None


def fetch_one(idx: int, url: str, note: str) -> PageResult:
    """Fetch a single URL, recording which method succeeded."""
    method, markdown, error = "trafilatura", None, None
    try:
        markdown = fetch_trafilatura(url)
        if markdown is None:
            method = "jina-fallback"
            markdown = fetch_jina(url)
        if markdown is None:
            method, error = "failed", "no content extracted by either method"
    except Exception as exc:  # network, parse, etc. — record, never abort batch
        method, error = "failed", f"{type(exc).__name__}: {exc}"

    title = "(untitled)"
    if markdown:
        for line in markdown.splitlines():
            stripped = line.strip()
            if not stripped or stripped == "---":
                continue
            if stripped.lower().startswith("title:"):
                title = stripped[6:].strip()[:120]
                break
            heading = stripped.lstrip("# ").strip()
            if heading:
                title = heading[:120]
                break

    return {
        "idx": idx,
        "url": url,
        "note": note,
        "method": method,
        "error": error,
        "title": title,
        "markdown": markdown or "",
        "words": len((markdown or "").split()),
    }


def parse_urls(args: argparse.Namespace) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for u in args.url or []:
        pairs.append((u, ""))
    if args.urls:
        urls_path = pathlib.Path(args.urls)
        try:
            text = urls_path.read_text()
        except OSError as exc:
            print(f"ERROR: cannot read --urls file {urls_path}: {exc}", file=sys.stderr)
            raise SystemExit(2)
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            url, _, note = line.partition("\t")
            pairs.append((url.strip(), note.strip()))
    # de-duplicate, preserve order. First note wins on a duplicate URL; later
    # notes for the same URL are intentionally dropped.
    seen, out = set(), []
    for url, note in pairs:
        if url and url not in seen:
            seen.add(url)
            out.append((url, note))
    return out


def format_page(r: PageResult) -> str:
    """Render one corpus-summary entry. Fixed lines as a block; note/error
    appended only when present."""
    block = textwrap.dedent(f"""\
        ### {r['idx']:02d}. {r['title']}
        - Original URL: {r['url']}
        - Markdown file: `{r['file']}`
        - Method: {r['method']}  |  Words: {r['words']}
    """).rstrip()
    if r["note"]:
        block += f"\n- Indexing note: {r['note']}"
    if r["error"]:
        block += f"\n- Error: {r['error']}"
    return block


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--urls", help="path to newline-delimited URL file")
    ap.add_argument("--url", action="append", help="a URL (repeatable)")
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--topic", default="", help="research topic, for the summary header")
    ap.add_argument(
        "--topic-file",
        help="read the topic from this file instead of --topic; "
        "avoids all shell-quoting of the question. Takes precedence over --topic.",
    )
    args = ap.parse_args()

    topic = args.topic
    if args.topic_file:
        try:
            topic = pathlib.Path(args.topic_file).read_text().strip()
        except OSError as exc:
            print(f"ERROR: cannot read --topic-file {args.topic_file}: {exc}", file=sys.stderr)
            return 2

    pairs = parse_urls(args)
    if not pairs:
        print("ERROR: no URLs provided", file=sys.stderr)
        return 2

    out_dir = pathlib.Path(args.out).expanduser().resolve()
    pages_dir = out_dir / "pages"
    try:
        pages_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"ERROR: cannot create output directory {pages_dir}: {exc}", file=sys.stderr)
        return 1

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        results = list(
            pool.map(lambda p: fetch_one(p[0] + 1, p[1][0], p[1][1]), enumerate(pairs))
        )
    results.sort(key=lambda r: r["idx"])

    now = datetime.datetime.now().isoformat(timespec="seconds")
    for r in results:
        fname = f"{r['idx']:02d}-{slugify(r['url'])}.md"
        r["file"] = pages_dir / fname
        header = (
            f"<!-- source: {r['url']} -->\n"
            f"<!-- fetched: {now} | method: {r['method']} | words: {r['words']} -->\n\n"
        )
        body = r["markdown"] if r["method"] != "failed" else f"FETCH FAILED: {r['error']}\n"
        try:
            r["file"].write_text(header + body)
        except OSError as exc:
            print(f"ERROR: cannot write page file {r['file']}: {exc}", file=sys.stderr)
            return 1

    ok = [r for r in results if r["method"] != "failed"]
    failed = [r for r in results if r["method"] == "failed"]

    # Static header: a triple-quoted block. The conditional title is hoisted
    # out rather than nested as an inline f-string.
    title = f"Corpus Summary: {topic}" if topic else "Corpus Summary"
    header = textwrap.dedent(f"""\
        # {title}

        - Built: {now}
        - Pages indexed: {len(results)}  |  fetched OK: {len(ok)}  |  failed: {len(failed)}
        - Scrape directory: `{pages_dir}`

        ## Pages
    """)

    summary_path = out_dir / "corpus-summary.md"
    try:
        summary_path.write_text(header + "\n" + "\n\n".join(format_page(r) for r in results))
    except OSError as exc:
        print(f"ERROR: cannot write {summary_path}: {exc}", file=sys.stderr)
        return 1

    # Contract: the only stdout line is the summary path.
    print(summary_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
