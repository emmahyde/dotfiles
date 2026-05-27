#!/usr/bin/env python3
"""Active Claude Sessions dock panel — dock-prs style: rich per-session blocks."""
from __future__ import annotations
import json, os, select, shlex, subprocess, sys, termios, time, tty
from pathlib import Path
from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.segment import Segment
from rich.table import Table
from rich.text import Text

PROJECTS_DIR = Path.home() / ".claude" / "projects"
REG_DIR = Path.home() / ".claude" / "state" / "dock-sessions"
TASKS_DIR = Path.home() / ".claude" / "tasks"
ACTIVE_MIN = int(os.environ.get("ACTIVE_MIN", "10"))
REFRESH = 2.0

def fmt_age(s: float) -> str:
    s = int(s)
    if s < 60: return f"{s}s"
    if s < 3600: return f"{s // 60}m"
    if s < 86400: return f"{s // 3600}h"
    return f"{s // 86400}d"

def home_short(path: str) -> str:
    home = str(Path.home())
    return path.replace(home, "~", 1) if path.startswith(home) else path

_workspace_cache: tuple[float, dict[str, dict]] = (0.0, {})
WS_CACHE_FILE = REG_DIR / "_workspace_cache.json"
WS_CACHE_TTL_DISK = 60.0
WS_CACHE_TTL_MEM = 30.0

def _hydrate_workspace_cache_from_disk() -> None:
    """Load workspace map from disk if process just started and cache is fresh."""
    global _workspace_cache
    cached_at, _ = _workspace_cache
    if cached_at > 0.0:
        return
    try:
        obj = json.loads(WS_CACHE_FILE.read_text())
        at = float(obj.get("at", 0))
        data = obj.get("data") or {}
        if time.time() - at < WS_CACHE_TTL_DISK and isinstance(data, dict):
            _workspace_cache = (at, data)
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        pass

def workspace_map() -> dict[str, dict]:
    """Return {workspace_uuid: {ref, title}} from cmux list-workspaces. Cached in
    memory (30s) and on disk (60s) so dock restarts paint immediately."""
    global _workspace_cache
    _hydrate_workspace_cache_from_disk()
    cached_at, data = _workspace_cache
    if time.time() - cached_at < WS_CACHE_TTL_MEM:
        return data
    out = {}
    try:
        res = subprocess.run(["cmux", "list-workspaces", "--id-format", "both"],
                             capture_output=True, text=True, timeout=3)
        for line in res.stdout.splitlines():
            line = line.lstrip("* ").rstrip()
            if not line:
                continue
            parts = line.split(None, 2)
            if len(parts) < 2 or not parts[0].startswith("workspace:"):
                continue
            ref, uuid, *rest = parts
            title = rest[0].rstrip(" [selected]").strip() if rest else ""
            out[uuid] = {"ref": ref, "title": title}
    except (FileNotFoundError, subprocess.TimeoutExpired, subprocess.SubprocessError):
        # cmux unavailable — keep returning the stale cached map rather than emptying.
        return data
    _workspace_cache = (time.time(), out)
    try:
        REG_DIR.mkdir(parents=True, exist_ok=True)
        WS_CACHE_FILE.write_text(json.dumps({"at": time.time(), "data": out}))
    except OSError:
        pass
    return out

def last_assistant_text(path: Path) -> str:
    try:
        with path.open("rb") as f:
            f.seek(0, 2); size = f.tell()
            f.seek(max(0, size - 64 * 1024))
            tail = f.read().decode("utf-8", errors="ignore").splitlines()[-150:]
    except OSError:
        return ""
    for line in reversed(tail):
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if obj.get("type") != "assistant":
            continue
        content = obj.get("message", {}).get("content", [])
        if isinstance(content, list):
            for block in reversed(content):
                if block.get("type") == "text" and block.get("text"):
                    return block["text"].strip().replace("\n", " ")
        elif isinstance(content, str) and content.strip():
            return content.strip().replace("\n", " ")
    return ""

TASK_STATUS_ORDER = {"in_progress": 0, "pending": 1, "completed": 2}
TASK_GLYPH = {"in_progress": ("⟳", "yellow"), "pending": ("○", "dim white"), "completed": ("✓", "green")}

def load_tasks(session_id: str) -> list[dict]:
    """Load tasks from native ~/.claude/tasks/<session_id>/ store."""
    sid_dir = TASKS_DIR / session_id
    if not sid_dir.is_dir():
        return []
    tasks = []
    for f in sid_dir.glob("*.json"):
        try:
            t = json.loads(f.read_text())
            if (t.get("status") or "").lower() != "deleted":
                tasks.append(t)
        except (OSError, json.JSONDecodeError):
            continue
    tasks.sort(key=lambda t: (TASK_STATUS_ORDER.get((t.get("status") or "pending").lower(), 9),
                               int(t.get("id") or 0)))
    return tasks

def load_registry() -> dict[str, dict]:
    out = {}
    if not REG_DIR.exists(): return out
    for f in REG_DIR.glob("*.json"):
        try:
            obj = json.loads(f.read_text())
            sid = obj.get("session_id")
            if sid: out[sid] = obj
        except (OSError, json.JSONDecodeError):
            continue
    return out

def scan_sessions() -> list[tuple[float, Path, str]]:
    """Return (mtime, jsonl_path, session_uuid) for active sessions, ordered by start time.
    Stable start-time ordering prevents sessions from rearranging as activity changes."""
    if not PROJECTS_DIR.exists(): return []
    cutoff = time.time() - ACTIVE_MIN * 60
    rows = []
    for jsonl in PROJECTS_DIR.glob("*/*.jsonl"):
        try:
            mt = jsonl.stat().st_mtime
        except OSError:
            continue
        if mt < cutoff: continue
        rows.append((mt, jsonl, jsonl.stem))
    # Sort by session start time (registry started_at > file ctime > fallback mtime).
    # This keeps the list stable; sessions don't jump around as new messages arrive.
    registry = load_registry()
    def start_key(r: tuple) -> float:
        _, jsonl, sid = r
        reg = registry.get(sid, {})
        if reg.get("started_at"):
            return float(reg["started_at"])
        try:
            return jsonl.stat().st_ctime
        except OSError:
            return r[0]
    rows.sort(key=start_key)
    return rows

def session_block(mtime: float, jsonl: Path, sid: str,
                  registry: dict[str, dict], wsmap: dict[str, dict],
                  hotkey: str | None = None) -> Group:
    reg = registry.get(sid, {})
    cwd = reg.get("cwd") or ""
    ws_uuid = reg.get("cmux_workspace_id") or ""
    ws = wsmap.get(ws_uuid, {}) if ws_uuid else {}
    ws_ref = ws.get("ref", "")
    ws_title = ws.get("title", "")

    project_label = Path(cwd).name if cwd else jsonl.parent.name.lstrip("-").split("-")[-1]
    age = fmt_age(time.time() - mtime)
    tasks = load_tasks(sid)
    ip = sum(1 for t in tasks if (t.get("status") or "").lower() == "in_progress")
    pe = sum(1 for t in tasks if (t.get("status") or "pending").lower() == "pending")
    co = sum(1 for t in tasks if (t.get("status") or "").lower() == "completed")
    snippet = last_assistant_text(jsonl) or "(no assistant text yet)"
    if len(snippet) > 90: snippet = snippet[:89] + "…"

    # Header row: hotkey, project, workspace badge, age.
    header = Table.grid(padding=(0, 1), expand=True)
    header.add_column(no_wrap=True)
    header.add_column(ratio=1, no_wrap=True)
    header.add_column(justify="right", no_wrap=True)
    title_text = Text.assemble(
        (f"#{project_label}", "bold cyan"),
        ("  ", ""),
        (ws_ref, "magenta") if ws_ref else ("(no workspace)", "dim"),
        ("  ", ""),
        (f'"{ws_title}"' if ws_title else "", "italic dim"),
    )
    hot = Text(f"[{hotkey}]", style="bold green") if hotkey else Text("   ", style="dim")
    header.add_row(hot, title_text, Text(age, style="dim"))

    snippet_text = Text.assemble((" └─ ", "grey50"), (snippet, "italic white"))

    lines: list = [header, snippet_text]

    # Inline task list: show open tasks, cap completed at 1 summary line.
    if tasks:
        open_tasks = [t for t in tasks if (t.get("status") or "pending").lower() != "completed"]
        done_count = co
        if open_tasks:
            lines.append(Text(""))
        for t in open_tasks:
            st = (t.get("status") or "pending").lower()
            tid = t.get("id")
            subject = (t.get("subject") or t.get("content") or
                       (t.get("description") or "").split("\n")[0])[:70]
            prefix = f"[#{tid}] " if tid else ""
            if st == "in_progress":
                lines.append(Text.assemble(
                    ("  ○ ", "dim white"),
                    (prefix, "green"),
                    ("⟳ ", "green"),
                    (subject, "green"),
                ))
            else:
                lines.append(Text.assemble(
                    ("  ○ ", "dim white"),
                    (prefix + subject, "dim white"),
                ))
        if done_count:
            lines.append(Text(f"  … +{done_count} completed", style="dim"))

    lines.append(Text(""))
    return Group(*lines)

HOTKEYS = "123456789"  # 1-9 selects the corresponding row (absolute index)
_SCROLL_OFFSET = 0

def gather() -> tuple[list, list[tuple[str, str]], int]:
    """Heavy path: scan sessions and build all block renderables. Run on refresh tick."""
    rows = scan_sessions()
    registry = load_registry()
    wsmap = workspace_map()
    if not rows:
        return [], [], 0
    keymap: list[tuple[str, str]] = []
    blocks = []
    for mt, j, sid in rows:
        reg = registry.get(sid, {})
        ws_uuid = reg.get("cmux_workspace_id") or ""
        panel_uuid = reg.get("cmux_panel_id") or ""
        hotkey: str | None = None
        if ws_uuid and panel_uuid and len(keymap) < len(HOTKEYS):
            hotkey = HOTKEYS[len(keymap)]
            keymap.append((ws_uuid, panel_uuid))
        blocks.append(session_block(mt, j, sid, registry, wsmap, hotkey))
    return blocks, keymap, len(rows)

class _Lines:
    """Renderable that emits a pre-sliced list of segment lines (one per terminal row)."""
    def __init__(self, lines):
        self._lines = lines
    def __rich_console__(self, console, options):
        for line in self._lines:
            yield from line
            yield Segment.line()

def build_panel(blocks: list, n_items: int, console: Console) -> tuple[Panel, int]:
    """Cheap path: render blocks to terminal rows, slice by scroll offset, wrap in Panel.
    Returns (Panel, total_rows) so the caller can clamp scroll bounds."""
    global _SCROLL_OFFSET
    if not blocks:
        return Panel(Text("(no active sessions)", style="dim italic"),
                     title="[bold]Active Claude Sessions[/]",
                     subtitle=f"[dim]last {ACTIVE_MIN}m[/]",
                     border_style="cyan"), 0
    inner_width = max(10, console.width - 4)
    opts = console.options.update_width(inner_width)
    lines = console.render_lines(Group(*blocks), opts, pad=False)
    total = len(lines)
    max_offset = max(0, total - max(1, console.height - 4))
    _SCROLL_OFFSET = max(0, min(_SCROLL_OFFSET, max_offset))
    body = _Lines(lines[_SCROLL_OFFSET:])
    indicator = f" · row {_SCROLL_OFFSET + 1}/{total}" if _SCROLL_OFFSET > 0 else ""
    return Panel(body,
                 title="[bold]Active Claude Sessions[/]",
                 subtitle=f"[dim]last {ACTIVE_MIN}m · {n_items} active · [1-9] jump · ↑↓ scroll{indicator}[/]",
                 border_style="cyan", padding=(0, 1)), total, max_offset

def _silence_tty() -> tuple[int | None, list | None]:
    """Disable echo + canonical input so scroll-arrow escapes don't paint over the TUI,
    and so we can read single keypresses for navigation."""
    if not sys.stdin.isatty():
        return None, None
    fd = sys.stdin.fileno()
    old = termios.tcgetattr(fd)
    new = termios.tcgetattr(fd)
    new[3] &= ~(termios.ECHO | termios.ICANON)
    termios.tcsetattr(fd, termios.TCSANOW, new)
    return fd, old

def _jump_to(ws_uuid: str, panel_uuid: str) -> None:
    cmd = (
        f"cmux select-workspace --workspace {shlex.quote(ws_uuid)} && "
        f"cmux focus-panel --panel {shlex.quote(panel_uuid)} "
        f"--workspace {shlex.quote(ws_uuid)}"
    )
    subprocess.Popen(["sh", "-c", cmd],
                     stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL,
                     stdin=subprocess.DEVNULL)

_CSI_TILDE = {"\x1b[5~": "pgup", "\x1b[6~": "pgdn",
              "\x1b[1~": "home", "\x1b[4~": "end"}
_CSI_LETTER = {"\x1b[A": "up", "\x1b[B": "down",
               "\x1b[C": "right", "\x1b[D": "left",
               "\x1b[H": "home", "\x1b[F": "end"}

def _parse_keys(data: bytes) -> list[str]:
    s = data.decode("latin-1", errors="replace")
    keys: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "\x1b" and i + 1 < len(s) and s[i+1] == "[":
            four = s[i:i+4]; three = s[i:i+3]
            if four in _CSI_TILDE:
                keys.append(_CSI_TILDE[four]); i += 4; continue
            if three in _CSI_LETTER:
                keys.append(_CSI_LETTER[three]); i += 3; continue
            i += 1
            continue
        keys.append(s[i]); i += 1
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
        blocks, keymap, n_items = gather()
        last_refresh = time.time()
        panel, total_rows, max_offset = build_panel(blocks, n_items, console)
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
                        if k in HOTKEYS:
                            idx = int(k) - 1
                            if idx < len(keymap):
                                _jump_to(*keymap[idx])
                        else:
                            _scroll(k, max_offset, page)
                            dirty = True
                if time.time() - last_refresh >= REFRESH:
                    blocks, keymap, n_items = gather()
                    last_refresh = time.time()
                    dirty = True
                if dirty:
                    panel, total_rows, max_offset = build_panel(blocks, n_items, console)
                    live.update(panel)
    finally:
        if old is not None:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
