#!/usr/bin/env python3
"""Open PRs dock panel — author=me, with checks + unresolved comment readout."""
from __future__ import annotations
import json, os, re, select, subprocess, sys, termios, time
from collections import Counter
from pathlib import Path
from rich.console import Console, Group
from rich.live import Live
from rich.padding import Padding
from rich.panel import Panel
from rich.segment import Segment
from rich.table import Table
from rich.text import Text

CACHE = Path.home() / ".claude" / "state" / "dock-prs.json"
CACHE.parent.mkdir(parents=True, exist_ok=True)
TTL_S = int(os.environ.get("DOCK_PRS_TTL", "300"))
MAX_PRS = int(os.environ.get("DOCK_PRS_LIMIT", "10"))
REQUIRED_APPROVALS = int(os.environ.get("DOCK_PRS_REQUIRED_APPROVALS", "2"))
REFRESH = 2.0

URL_RE = re.compile(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)")

def gh(*args: str) -> str | None:
    try:
        out = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=20)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    return out.stdout if out.returncode == 0 else None

_PR_FRAGMENT = ("headRefName reviewDecision mergeable mergeStateStatus "
                "statusCheckRollup{contexts(first:100){nodes{"
                "...on CheckRun{name conclusion status detailsUrl} "
                "...on StatusContext{context state targetUrl}}}} "
                "latestReviews(first:50){nodes{author{login} state}} "
                "reviewRequests(first:20){nodes{requestedReviewer{"
                "__typename ...on Team{name slug combinedSlug} "
                "...on User{login}}}} "
                "reviewThreads(first:50){nodes{isResolved isOutdated "
                "comments(last:1){nodes{author{login} body url}}}}")

_FAIL_STATES = {"FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"}
_PENDING_STATES = {"PENDING", "IN_PROGRESS", "QUEUED", "WAITING"}
_OK_STATES = {"SUCCESS", "NEUTRAL", "SKIPPED"}



def load_cache() -> tuple[list[dict], float]:
    try:
        obj = json.loads(CACHE.read_text())
        return obj.get("prs", []), float(obj.get("updated", 0))
    except (OSError, json.JSONDecodeError, ValueError):
        return [], 0.0

def save_cache(prs: list[dict]) -> None:
    CACHE.write_text(json.dumps({"prs": prs, "updated": time.time()}))

def _enrich_cache(prs: list[dict]) -> None:
    """Re-enrich PRs and write cache only if enrichment returns real data."""
    enrichable = [p for p in prs if p.get("_owner") and p.get("_repo")]
    if not enrichable:
        return
    parts = []
    for i, p in enumerate(enrichable):
        parts.append('pr%d: repository(owner:"%s",name:"%s"){pullRequest(number:%d){%s}}'
                     % (i, p["_owner"], p["_repo"], p["number"], _PR_FRAGMENT))
    raw = gh("api", "graphql", "-f", f"query={{{' '.join(parts)}}}")
    if not raw:
        return
    try:
        gql_data = json.loads(raw).get("data") or {}
    except json.JSONDecodeError:
        return
    got_data = False
    for i, p in enumerate(enrichable):
        pull = (gql_data.get(f"pr{i}") or {}).get("pullRequest") or {}
        if not pull:
            continue
        got_data = True
        p["headRefName"] = pull.get("headRefName") or ""
        p["reviewDecision"] = pull.get("reviewDecision")
        p["mergeable"] = pull.get("mergeable")
        p["mergeStateStatus"] = pull.get("mergeStateStatus")
        p["statusCheckRollup"] = ((pull.get("statusCheckRollup") or {})
                                  .get("contexts", {}).get("nodes") or [])
        threads = (pull.get("reviewThreads") or {}).get("nodes") or []
        p["_threads"] = [n for n in threads if not n.get("isResolved")]
        reviews = (pull.get("latestReviews") or {}).get("nodes") or []
        approvers = {(r.get("author") or {}).get("login")
                     for r in reviews if r.get("state") == "APPROVED"}
        approvers.discard(None)
        p["_approvals"] = sorted(approvers)
        req_nodes = (pull.get("reviewRequests") or {}).get("nodes") or []
        pending_teams, pending_users = [], []
        for n in req_nodes:
            rr = n.get("requestedReviewer") or {}
            if rr.get("__typename") == "Team":
                pending_teams.append(rr.get("slug") or rr.get("name") or "")
            elif rr.get("__typename") == "User":
                pending_users.append(rr.get("login") or "")
        p["_pending_teams"] = [t for t in pending_teams if t]
        p["_pending_users"] = [u for u in pending_users if u]
    if got_data:
        save_cache(prs)

def ensure_cache() -> tuple[list[dict], float, bool]:
    prs, updated = load_cache()
    now = time.time()
    if now - updated < TTL_S and prs:
        return prs, updated, False
    # Fetch fresh PR list first (fast).
    raw = gh("search", "prs", "--author", "@me", "--state", "open",
             "--limit", str(MAX_PRS),
             "--json", "number,title,url,isDraft,updatedAt,repository")
    if not raw:
        return prs, updated, False
    try:
        new_prs = json.loads(raw)
    except json.JSONDecodeError:
        return prs, updated, False
    for p in new_prs:
        m = URL_RE.search(p.get("url") or "")
        if m:
            p["_owner"], p["_repo"], _ = m.groups()
        else:
            repo = p.get("repository") or {}
            p["_owner"] = repo.get("owner", {}).get("login") or ""
            p["_repo"] = repo.get("name") or ""
        # Carry over enrichment from old cache so we never show blank while re-enriching.
        old = next((c for c in prs if c.get("number") == p["number"]
                    and c.get("_repo") == p.get("_repo")), {})
        p.setdefault("headRefName", old.get("headRefName", ""))
        p.setdefault("reviewDecision", old.get("reviewDecision"))
        p.setdefault("statusCheckRollup", old.get("statusCheckRollup", []))
        p.setdefault("_threads", old.get("_threads", []))
        p.setdefault("_approvals", old.get("_approvals", []))
        p.setdefault("_pending_teams", old.get("_pending_teams", []))
        p.setdefault("_pending_users", old.get("_pending_users", []))
        p.setdefault("mergeable", old.get("mergeable"))
        p.setdefault("mergeStateStatus", old.get("mergeStateStatus"))
    # Write immediately with carried-over enrichment so UI updates fast.
    save_cache(new_prs)
    # Re-enrich in the background (updates cache again when done).
    import threading
    threading.Thread(target=_enrich_cache, args=(new_prs,), daemon=True).start()
    return new_prs, now, True

def check_summary(rollup: list[dict]) -> tuple[Text, str]:
    """Returns (badge Text, status identifier) where identifier is one of
    'green' / 'yellow' / 'red' / 'dim'. Identifier is used by the 'ready' gate."""
    if not rollup:
        return Text("—", style="dim"), "dim"
    fail = pending = ok = 0
    for c in rollup:
        s = (c.get("conclusion") or c.get("state") or "").upper()
        if s in _FAIL_STATES: fail += 1
        elif s in _PENDING_STATES: pending += 1
        elif s in _OK_STATES: ok += 1
    parts: list = []
    if ok:
        parts.append((f" ✓ {ok} ", "bold black on bright_green"))
    if pending:
        if parts: parts.append((" ", ""))
        parts.append((f" ⟳ {pending} ", "bold black on yellow"))
    if fail:
        if parts: parts.append((" ", ""))
        parts.append((f" ✗ {fail} ", "bold white on red"))
    if parts:
        last_text, last_style = parts[-1]
        parts[-1] = (last_text + " ", last_style)
    badge = Text.assemble(*parts) if parts else Text("—", style="dim")
    if fail: return badge, "red"
    if pending: return badge, "yellow"
    if ok: return badge, "green"
    return badge, "dim"

def failing_checks(rollup: list[dict]) -> list[dict]:
    """Extract (name, url) for checks in a failure state. Used for the [fail] row."""
    out = []
    for c in rollup or []:
        s = (c.get("conclusion") or c.get("state") or "").upper()
        if s in _FAIL_STATES:
            name = c.get("name") or c.get("context") or "check"
            url = c.get("detailsUrl") or c.get("targetUrl") or ""
            out.append({"name": name, "url": url})
    return out

def review_glyph(decision: str | None, draft: bool) -> tuple[str, str]:
    if draft:
        return "○", "dim"
    if decision == "APPROVED":
        return "✓", "green"
    if decision == "CHANGES_REQUESTED":
        return "✗", "red"
    return "·", "yellow"

def comment_readout(threads: list[dict]) -> tuple[Text, Text]:
    if not threads:
        return Text("no unresolved comments", style="dim"), Text("")
    first = threads[0]
    nodes = (first.get("comments") or {}).get("nodes") or []
    if not nodes:
        return Text("no comment body", style="dim"), Text("")
    head = nodes[0]
    author = (head.get("author") or {}).get("login") or "unknown"
    body = re.sub(r"<!--.*?-->", "", (head.get("body") or ""), flags=re.DOTALL).strip().replace("\n", " ")
    if len(body) > 140:
        body = body[:139] + "…"
    url = head.get("url") or ""
    body_text = Text(body, style="grey50")
    if url:
        body_text.stylize(f"link {url}")
    headline = _label_grid(f"@{author}: ", "hot_pink", body_text)

    others: Counter[str] = Counter()
    for t in threads[1:]:
        ns = (t.get("comments") or {}).get("nodes") or []
        if ns:
            a = (ns[0].get("author") or {}).get("login") or "unknown"
            others[a] += 1
    if not others:
        return headline, Text("")
    rolled = ", ".join(f"@{a} ({n})" for a, n in others.most_common())
    return headline, Text(f"+{sum(others.values())} others from {rolled}", style="dim")

def fmt_age(updated_iso: str) -> str:
    try:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(updated_iso.replace("Z", "+00:00"))
        s = int((datetime.now(timezone.utc) - dt).total_seconds())
    except Exception:
        return ""
    if s < 60: return f"{s}s"
    if s < 3600: return f"{s // 60}m"
    if s < 86400: return f"{s // 3600}h"
    return f"{s // 86400}d"

def _label_grid(label: str, label_style: str, content: Text) -> Table:
    """Inline 2-col grid so wrapped content hangs under the first char after `label`."""
    g = Table.grid(padding=(0, 0), expand=True)
    g.add_column(no_wrap=True)
    g.add_column(ratio=1, overflow="fold")
    g.add_row(Text(label, style=label_style), content)
    return g

def _tree_row(prefix: str, content) -> Table:
    """One tree row whose prefix column is sized to *this* row's prefix only.
    Per-row grids avoid the outer Table.grid auto-padding all prefixes to the widest."""
    g = Table.grid(padding=(0, 0), expand=True)
    g.add_column(no_wrap=True)
    g.add_column(ratio=1, overflow="fold")
    g.add_row(Text(prefix, style="grey50"), content)
    return g

def pr_row(pr: dict) -> Group:
    num = pr.get("number")
    title = pr.get("title") or "(no title)"
    url = pr.get("url") or ""
    rollup = pr.get("statusCheckRollup") or []
    chk_badge, chk_style = check_summary(rollup)
    fails = failing_checks(rollup)
    age = fmt_age(pr.get("updatedAt", ""))

    approvals = pr.get("_approvals") or []
    n_appr = len(approvals)
    appr_ok = n_appr >= REQUIRED_APPROVALS
    appr_style = "green" if appr_ok else "yellow"
    appr_text = f"{n_appr}/{REQUIRED_APPROVALS} thumbs"
    if approvals:
        appr_text += " (" + ", ".join(f"@{a}" for a in approvals) + ")"

    pending_teams = pr.get("_pending_teams") or []
    pending_users = pr.get("_pending_users") or []
    req_line = None
    if pending_teams or pending_users:
        reqs = [f"@{t}" for t in pending_teams] + [f"@{u}" for u in pending_users]
        req_line = _label_grid("[required] ", "grey50",
                               Text(", ".join(reqs), style="hot_pink"))

    ready = (appr_ok
             and pr.get("mergeable") != "CONFLICTING"
             and pr.get("mergeStateStatus") not in ("BEHIND", "DIRTY", "BLOCKED")
             and chk_style == "green"
             and not pending_teams and not pending_users)

    if ready:
        meta = Text.assemble(
            ("✓ ready to merge.", "bold bright_green"),
            (f", {age} ago" if age else "", "dim"),
        )
    else:
        meta_parts = [Text(appr_text, style=appr_style)]
        if age:
            meta_parts.append(Text(", ", style="dim"))
            meta_parts.append(Text(f"{age} ago", style="dim"))
        if pr.get("mergeable") == "CONFLICTING":
            meta_parts.append(Text(", ", style="dim"))
            meta_parts.append(Text("⚠ merge conflict", style="bold red"))
        elif pr.get("mergeStateStatus") == "BEHIND":
            meta_parts.append(Text(", ", style="dim"))
            meta_parts.append(Text("behind base", style="yellow"))
        meta = Text.assemble(*meta_parts)

    headline, others_line = comment_readout(pr.get("_threads") or [])
    has_comment = (pr.get("_threads") or [])

    # Title row: drop review glyph; align checks to the right.
    title_grid = Table.grid(padding=(0, 1), expand=True)
    title_grid.add_column(no_wrap=True)
    title_grid.add_column(ratio=1)
    title_grid.add_column(justify="right", no_wrap=True)
    title_grid.add_column(no_wrap=True, width=1)  # explicit right-edge spacer so the pill never sits flush against the panel border
    title_grid.add_row(
        Text(f"#{num}", style="bold cyan"),
        Text(title, style=f"link {url}"),
        chk_badge,
        " ",
    )

    fail_line = None
    if fails:
        names = Text("", no_wrap=False)
        for i, f in enumerate(fails):
            if i > 0:
                names.append(", ", style="dim")
            seg = Text(f["name"], style="red")
            if f.get("url"):
                seg.stylize(f"link {f['url']}")
            names.append_text(seg)
        fail_line = _label_grid("[fail] ", "red", names)

    # [required] nests under thumbs (level-2). [fail] and the comment stay at level-1.
    nested_under_thumbs = []
    if req_line is not None:
        nested_under_thumbs.append(req_line)

    level1: list[tuple[str, object]] = [("thumbs", meta)]
    if fail_line is not None:
        level1.append(("fail", fail_line))
    if has_comment:
        level1.append(("spacer", Text("")))
        level1.append(("comment", headline))

    last_idx = max(i for i, (k, _) in enumerate(level1) if k != "spacer")

    tree_items: list[tuple[str, object]] = []
    for i, (kind, content) in enumerate(level1):
        if kind == "spacer":
            tree_items.append(("│", content))
            continue
        is_last = i == last_idx
        if kind == "comment":
            conn = "└─  " if is_last else "├─  "
        else:
            conn = "└─ " if is_last else "├─ "
        tree_items.append((conn, content))
        if kind == "thumbs" and nested_under_thumbs:
            base = "    " if is_last else "│   "
            for j, child in enumerate(nested_under_thumbs):
                c_is_last = j == len(nested_under_thumbs) - 1
                c_conn = "└─ " if c_is_last else "├─ "
                tree_items.append((base + c_conn, child))

    if has_comment and others_line.plain:
        tree_items.append(("    ", others_line))

    tree_rows = [_tree_row(" " + prefix, content) for prefix, content in tree_items]
    return Group(title_grid, *tree_rows)

def repo_block(repo: str, prs: list[dict]) -> Panel:
    """All PRs for one repo in a titled panel."""
    rows = []
    for i, pr in enumerate(prs):
        rows.append(pr_row(pr))
        if i < len(prs) - 1:
            rows.append(Text(""))
    return Panel(Group(*rows), title=f"[dim]{repo}[/]",
                 border_style="dim", padding=(0, 1))

_SCROLL_OFFSET = 0

def gather() -> tuple[list, float, int]:
    """Heavy path: fetch PR cache + build repo-grouped renderables."""
    prs, updated, _ = ensure_cache()
    # Group by repo, preserving order of first appearance.
    grouped: dict[str, list[dict]] = {}
    for p in prs:
        key = f"{p.get('_owner','')}/{p.get('_repo','')}".strip("/")
        grouped.setdefault(key, []).append(p)
    repo_list = list(grouped.items())
    blocks = []
    for i, (repo, repo_prs) in enumerate(repo_list):
        blocks.append(repo_block(repo, repo_prs))
        if i < len(repo_list) - 1:
            blocks.append(Text(""))
    return blocks, updated, len(prs)

class _Lines:
    """Renderable that emits a pre-sliced list of segment lines (one per terminal row)."""
    def __init__(self, lines):
        self._lines = lines
    def __rich_console__(self, console, options):
        for line in self._lines:
            yield from line
            yield Segment.line()

def build_panel(blocks: list, updated: float, n_items: int, console: Console) -> tuple[Panel, int]:
    """Cheap path: render blocks to terminal rows, slice by scroll offset, wrap in Panel.
    Returns (Panel, total_rows) so the caller can clamp scroll bounds."""
    global _SCROLL_OFFSET
    if not blocks:
        body = Text("(no open PRs — or gh not authenticated)", style="dim italic")
        return Panel(body, title="[bold]Open PRs[/]",
                     subtitle="[dim]gh pr list --author @me[/]",
                     border_style="blue"), 0
    age = int(time.time() - updated) if updated else 0
    inner_width = max(10, console.width - 4)
    opts = console.options.update_width(inner_width)
    lines = console.render_lines(Group(*blocks), opts, pad=False)
    total = len(lines)
    max_offset = max(0, total - max(1, console.height - 4))
    _SCROLL_OFFSET = max(0, min(_SCROLL_OFFSET, max_offset))
    body = _Lines(lines[_SCROLL_OFFSET:])
    indicator = f" · row {_SCROLL_OFFSET + 1}/{total}" if _SCROLL_OFFSET > 0 else ""
    return Panel(body,
                 title="[bold]Open PRs[/]",
                 subtitle=f"[dim]{n_items} open · cached {age}s ago · ttl {TTL_S}s{indicator}[/]",
                 border_style="blue", padding=(0, 1)), total, max_offset

def _silence_tty() -> tuple[int | None, list | None]:
    """Disable echo + canonical input so scroll-arrow escapes don't paint over the TUI."""
    if not sys.stdin.isatty():
        return None, None
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    new = termios.tcgetattr(fd)
    new[3] &= ~(termios.ECHO | termios.ICANON)
    termios.tcsetattr(fd, termios.TCSANOW, new)
    return fd, old

_CSI_TILDE = {"\x1b[5~": "pgup", "\x1b[6~": "pgdn",
              "\x1b[1~": "home", "\x1b[4~": "end"}
_CSI_LETTER = {"\x1b[A": "up", "\x1b[B": "down",
               "\x1b[C": "right", "\x1b[D": "left",
               "\x1b[H": "home", "\x1b[F": "end"}

def _parse_keys(data: bytes) -> list[str]:
    """Tokenize a stdin byte buffer into named keys ('up','down','pgup',...) and raw chars."""
    s = data.decode("latin-1", errors="replace")
    keys: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "\x1b" and i + 1 < len(s) and s[i+1] == "[":
            four = s[i:i+4]
            three = s[i:i+3]
            if four in _CSI_TILDE:
                keys.append(_CSI_TILDE[four]); i += 4; continue
            if three in _CSI_LETTER:
                keys.append(_CSI_LETTER[three]); i += 3; continue
            i += 1  # unknown escape — skip ESC and continue
            continue
        keys.append(s[i])
        i += 1
    return keys

def _scroll(key: str, max_offset: int, page: int) -> None:
    """Scroll offset is measured in terminal rows. max_offset = total_rows - visible_height."""
    global _SCROLL_OFFSET
    if key in ("down", "j"):  _SCROLL_OFFSET += 1
    elif key in ("up", "k"):  _SCROLL_OFFSET -= 1
    elif key in ("pgdn", " "):_SCROLL_OFFSET += page
    elif key == "pgup":       _SCROLL_OFFSET -= page
    elif key in ("home", "g"):_SCROLL_OFFSET = 0
    elif key in ("end", "G"): _SCROLL_OFFSET = max_offset
    _SCROLL_OFFSET = max(0, min(_SCROLL_OFFSET, max_offset))

def main() -> None:
    console = Console()
    fd, old = _silence_tty()
    try:
        blocks, updated, n_items = gather()
        last_refresh = time.time()
        panel, total_rows, max_offset = build_panel(blocks, updated, n_items, console)
        with Live(panel, console=console, refresh_per_second=20,
                  screen=True, vertical_overflow="ellipsis") as live:
            while True:
                page = max(1, console.height - 4)
                now = time.time()
                timeout = max(0.02, REFRESH - (now - last_refresh))
                ready = select.select([sys.stdin], [], [], timeout)[0] if fd is not None else []
                dirty = False
                if ready:
                    try:
                        data = os.read(fd, 1024)
                    except OSError:
                        data = b""
                    for k in _parse_keys(data):
                        _scroll(k, max_offset, page)
                        dirty = True
                if time.time() - last_refresh >= REFRESH:
                    blocks, updated, n_items = gather()
                    last_refresh = time.time()
                    dirty = True
                if dirty:
                    panel, total_rows, max_offset = build_panel(blocks, updated, n_items, console)
                    live.update(panel)
    finally:
        if old is not None:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
