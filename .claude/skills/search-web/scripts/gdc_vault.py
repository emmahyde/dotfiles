#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx>=0.27"]
# ///
"""Search GDC Vault directly and emit indexed session URLs.

GDC Vault's own search box is client-side JavaScript; the server exposes no
keyword endpoint. The per-event listing pages (`/browse/gdc-24/` etc.) are
server-rendered, so this script crawls them once, caches the parsed index,
matches your terms against title + speakers + company + track, then fetches
only the matching session pages for the abstract and access status.

Usage:
    gdc_vault.py --query minigame --query "card game" [--all] [--track Design]
                 [--years 2008-2026] [--max 25] [--out urls.txt] [--json]

Output: a table on stdout (year | access | speaker (company) | title | url).
With --out, appends one `url<TAB>note` line per match in the format
batch_fetch.py reads, so the matches drop straight into the corpus.

Cache: ~/.cache/search-web/gdc-vault/<event>.json, refreshed after 30 days.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import pathlib
import os
import re
import sys
import time

import httpx

BASE = "https://gdcvault.com"
UA = "Mozilla/5.0 (compatible; web-research-corpus/1.0)"
CACHE_DIR = pathlib.Path.home() / ".cache" / "search-web" / "gdc-vault"
CACHE_TTL = 30 * 24 * 3600
FETCH_TIMEOUT = 30.0
MAX_WORKERS = 6

# Event slugs as listed on https://gdcvault.com/browse. Main GDC first; the
# regional/online events follow. Sponsored and VR/XR tracks are omitted.
MAIN_EVENTS = [f"gdc-{y % 100:02d}" for y in range(1996, 2027)]
OTHER_EVENTS = [
    "cgdc-96",
    "gdc-summer-20",
    "gdc-showcase-21",
    "gdc-showcase-23",
    "gdc-showcase-24",
    "gdc-austin-07",
    "gdc-austin-08",
    "gdc-austin-09",
    "gdc-online-10",
    "gdc-austin-11",
    "gdc-online-12",
    *[f"gdc-europe-{y:02d}" for y in range(9, 17)],
    "gdc-china-09",
    "gdc-china-10",
    "gdc-china-11",
    "gdc-china-12",
    "gdc-china-14",
    "gdc-china-15",
    "gdc-next-13",
    "gdc-next-14",
    "gdc-canada-09",
    "gdc-canada-10",
    "adc-13",
]

ENTRY_RE = re.compile(
    r'<a class="session_item[^"]*"\s*href="(?P<path>/play/(?P<id>\d+)/[^"]*)">'
    r".*?media_type_image (?P<media>[a-z]+)"
    r'.*?conference_name">\s*(?P<conf>[^<]*?)\s*</span>'
    r".*?<strong>(?P<title>.*?)</strong>"
    r"(?:.*?<em>by</em>\s*(?P<speaker>[^<]*?)\s*(?:<strong>\((?P<company>[^)]*)\)</strong>)?\s*</span>)?"
    r'(?:.*?track_name">(?P<track>[^<]*)</span>)?',
    re.S,
)
YEAR_RE = re.compile(r"(19|20)\d{2}")


def event_year(slug: str) -> int:
    yy = int(re.search(r"(\d{2})$", slug).group(1))
    return 1900 + yy if yy >= 90 else 2000 + yy


def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", html.unescape(s or "")).strip()


def fetch(client: httpx.Client, path: str) -> str:
    r = client.get(BASE + path, timeout=FETCH_TIMEOUT, follow_redirects=True)
    r.raise_for_status()
    return r.text


def parse_listing(slug: str, page: str) -> list[dict]:
    compact = re.sub(r">\s+<", "><", page.replace("\n", ""))
    out, seen = [], set()
    for li in compact.split('<li class="featured')[1:]:
        m = ENTRY_RE.search(li)
        if not m or m["id"] in seen:
            continue
        seen.add(m["id"])
        conf = clean(m["conf"])
        y = YEAR_RE.search(conf)
        out.append(
            {
                "id": m["id"],
                "url": BASE + m["path"],
                "event": slug,
                "conference": conf,
                "year": int(y.group(0)) if y else event_year(slug),
                "title": clean(m["title"]),
                "speaker": clean(m["speaker"]),
                "company": clean(m["company"]),
                "track": clean(m["track"]),
                "media": m["media"],
            }
        )
    return out


def load_index(client: httpx.Client, events: list[str], refresh: bool) -> list[dict]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    index: list[dict] = []
    todo: list[str] = []
    for slug in events:
        f = CACHE_DIR / f"{slug}.json"
        if not refresh and f.exists() and time.time() - f.stat().st_mtime < CACHE_TTL:
            index.extend(json.loads(f.read_text()))
        else:
            todo.append(slug)

    def one(slug: str) -> tuple[str, list[dict] | None]:
        try:
            return slug, parse_listing(slug, fetch(client, f"/browse/{slug}/"))
        except Exception as exc:  # one bad event must not sink the index
            print(f"warn: {slug}: {type(exc).__name__}: {exc}", file=sys.stderr)
            return slug, None

    if todo:
        print(f"indexing {len(todo)} event listing(s) from GDC Vault…", file=sys.stderr)
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            for slug, entries in pool.map(one, todo):
                if entries is None:
                    continue
                (CACHE_DIR / f"{slug}.json").write_text(json.dumps(entries))
                index.extend(entries)
    return index


def truncated(e: dict) -> bool:
    return e["title"].endswith(("...", "…")) and not e.get("resolved")


def session_details(client: httpx.Client, e: dict) -> dict:
    """Fetch one session page: full title, abstract, speakers, access."""
    page = fetch(client, e["url"][len(BASE) :])
    text = clean(re.sub(r"<[^>]+>", " ", page))
    name = re.search(r"Session Name:\s*(.*?)\s*Overview:", text)
    ov = re.search(
        r"Overview:\s*(.*?)\s*(?:Session Name:|Speaker\(s\):|Did you know)", text
    )
    sp = re.search(
        r"Speaker\(s\):\s*(.*?)\s*Company Name\(s\):\s*(.*?)\s*Track / Format:", text
    )
    tags = re.search(r'<ul id="tags">(.*?)</ul>', page, re.S)
    return {
        **e,
        "title": name.group(1) if name else e["title"],
        "overview": ov.group(1)[:600] if ov else "",
        "speaker": sp.group(1) if sp else e["speaker"],
        "company": sp.group(2) if sp else e["company"],
        "access": "free" if tags and "free content" in tags.group(1) else "members",
        "resolved": True,
    }


def resolve_titles(client: httpx.Client, index: list[dict]) -> int:
    """Replace truncated listing titles with full ones; persist to the cache."""
    todo = [e for e in index if truncated(e)]
    if not todo:
        return 0
    print(
        f"resolving {len(todo)} truncated title(s) from session pages…", file=sys.stderr
    )

    def one(e: dict) -> dict:
        try:
            return session_details(client, e)
        except Exception as exc:
            print(f"warn: {e['url']}: {type(exc).__name__}: {exc}", file=sys.stderr)
            return e

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        updated = {r["id"]: r for r in pool.map(one, todo)}
    for i, e in enumerate(index):
        if e["id"] in updated:
            index[i] = updated[e["id"]]
    by_event: dict[str, list[dict]] = {}
    for e in index:
        by_event.setdefault(e["event"], []).append(e)
    for slug, entries in by_event.items():
        f = CACHE_DIR / f"{slug}.json"
        if f.exists():  # keep the listing mtime so the TTL still governs refresh
            mtime = f.stat().st_mtime
            f.write_text(json.dumps(entries))
            os.utime(f, (mtime, mtime))
    return sum(1 for r in updated.values() if r.get("resolved"))


def matches(e: dict, terms: list[str], require_all: bool) -> bool:
    # Listing titles are cut at ~70 chars with "…"; the URL slug carries the
    # full title hyphenated, so include it de-hyphenated as a second haystack.
    slug = e["url"].rsplit("/", 1)[-1].replace("-", " ")
    hay = " ".join([e["title"], slug, e["speaker"], e["company"], e["track"]]).lower()
    hits = [t in hay for t in terms]
    return all(hits) if require_all else any(hits)


def enrich(client: httpx.Client, e: dict) -> dict:
    """Session-page details for a match; skip the fetch when already cached."""
    if e.get("resolved"):
        return e
    try:
        return session_details(client, e)
    except Exception as exc:
        return {
            **e,
            "overview": "",
            "access": "unknown",
            "error": f"{type(exc).__name__}: {exc}",
        }


def note_for(e: dict) -> str:
    who = e["speaker"] + (f" ({e['company']})" if e["company"] else "")
    bits = [f"gdc-talk {e['year']}", who, e["track"] or e["media"], e["access"]]
    note = f"[{' | '.join(b for b in bits if b)}] {e['title']}"
    if e.get("overview"):
        note += f" — {e['overview'][:240]}"
    return note


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--query",
        action="append",
        required=True,
        help="search term (repeatable; OR unless --all)",
    )
    ap.add_argument(
        "--all", action="store_true", help="require every --query term to match"
    )
    ap.add_argument("--track", help="restrict to a track name substring, e.g. Design")
    ap.add_argument(
        "--years", default="1996-2026", help="inclusive year range, e.g. 2010-2026"
    )
    ap.add_argument(
        "--main-only", action="store_true", help="skip regional/online GDC events"
    )
    ap.add_argument(
        "--max", type=int, default=25, help="cap on matches to enrich and emit"
    )
    ap.add_argument(
        "--out", help="append url<TAB>note lines here (batch_fetch.py format)"
    )
    ap.add_argument(
        "--json", action="store_true", help="print matches as JSON instead of a table"
    )
    ap.add_argument("--refresh", action="store_true", help="ignore the listing cache")
    ap.add_argument(
        "--resolve-titles",
        action="store_true",
        help="fetch full titles for truncated listings in range (one request per "
        "session; persists to the cache, so later runs are complete)",
    )
    args = ap.parse_args()

    lo, _, hi = args.years.partition("-")
    lo_y, hi_y = int(lo), int(hi or lo)
    events = [
        s
        for s in MAIN_EVENTS + ([] if args.main_only else OTHER_EVENTS)
        if lo_y <= event_year(s) <= hi_y
    ]
    terms = [t.lower() for t in args.query]

    with httpx.Client(headers={"User-Agent": UA}) as client:
        index = load_index(client, events, args.refresh)
        if args.resolve_titles:
            resolve_titles(client, index)
        unresolved = sum(1 for e in index if truncated(e))
        found = [
            e
            for e in index
            if matches(e, terms, args.all)
            and (not args.track or args.track.lower() in e["track"].lower())
        ]
        found.sort(key=lambda e: (-e["year"], e["title"]))
        dropped = max(0, len(found) - args.max)
        found = found[: args.max]
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            found = list(pool.map(lambda e: enrich(client, e), found))

    print(
        f"{len(index)} sessions indexed across {len(events)} events; "
        f"{len(found)} match" + (f" (+{dropped} beyond --max)" if dropped else ""),
        file=sys.stderr,
    )
    if unresolved:
        print(
            f"note: {unresolved} listing title(s) in range are truncated at 70 chars and may "
            f"hide a match; rerun with --resolve-titles to fetch them (cached afterwards).",
            file=sys.stderr,
        )

    if args.json:
        print(json.dumps(found, indent=2))
    else:
        for e in found:
            who = e["speaker"] + (f" ({e['company']})" if e["company"] else "")
            print(
                f"{e['year']} | {e['access']:7} | {who} | {e['title']}\n    {e['url']}"
            )
            if e.get("overview"):
                print(f"    {e['overview'][:200]}")

    if args.out and found:
        with open(args.out, "a") as fh:
            for e in found:
                fh.write(f"{e['url']}\t{note_for(e)}\n")
        print(f"appended {len(found)} line(s) to {args.out}", file=sys.stderr)
    return 0 if found else 1


if __name__ == "__main__":
    raise SystemExit(main())
