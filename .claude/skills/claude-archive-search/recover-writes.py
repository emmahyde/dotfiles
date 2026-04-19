#!/usr/bin/env python3
"""Recover Write-tool output from Claude Code transcripts.

Scans ~/.claude/projects/<slug>/ JSONL transcripts, extracts every `Write`
tool_use entry (file_path + content), and either prints a markdown report or
restores files to disk. Latest timestamp per path wins.

Usage: recover-writes.py [--project SLUG|--transcript FILE|--session ID]
                        [--path SUBSTR] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
                        [--include-subagents] [--all-projects]
                        [--restore] [--out DIR|FILE] [--list]
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


CLAUDE_ROOT: Path = Path.home() / ".claude"


@dataclass
class WriteEntry:
  timestamp: str
  session: str
  source: Path
  is_subagent: bool
  file_path: str
  content: str


def cwd_to_slug(cwd: Path) -> str:
  return "-" + str(cwd).lstrip("/").replace("/", "-")


def resolve_project_dir(arg: str | None) -> Path:
  root: Path = CLAUDE_ROOT / "projects"
  if arg:
    candidate: Path = root / arg
    if candidate.is_dir():
      return candidate
    raise SystemExit(f"project dir not found: {candidate}")
  slug: str = cwd_to_slug(Path.cwd())
  candidate = root / slug
  if not candidate.is_dir():
    raise SystemExit(f"no archive for cwd {Path.cwd()} (tried {candidate})")
  return candidate


def iter_transcripts(
    project_dir: Path | None,
    transcript: Path | None,
    session: str | None,
    include_subagents: bool,
    all_projects: bool,
) -> Iterable[tuple[Path, bool]]:
  if transcript:
    yield transcript, False
    return
  roots: list[Path]
  if all_projects:
    roots = [p for p in (CLAUDE_ROOT / "projects").iterdir() if p.is_dir()]
  else:
    assert project_dir is not None
    roots = [project_dir]
  for root in roots:
    for jsonl in sorted(root.glob("*.jsonl")):
      if session and session not in jsonl.name:
        continue
      yield jsonl, False
    if include_subagents:
      pattern: str = f"{session}/subagents/*.jsonl" if session else "*/subagents/*.jsonl"
      for jsonl in sorted(root.glob(pattern)):
        yield jsonl, True


def extract_writes(path: Path, is_subagent: bool) -> Iterable[WriteEntry]:
  try:
    handle = path.open("r", encoding="utf-8")
  except OSError:
    return
  with handle as fh:
    for line in fh:
      line = line.strip()
      if not line:
        continue
      try:
        obj: dict = json.loads(line)
      except json.JSONDecodeError:
        continue
      msg: dict = obj.get("message") or {}
      content: object = msg.get("content")
      if not isinstance(content, list):
        continue
      for item in content:
        if not isinstance(item, dict):
          continue
        if item.get("type") != "tool_use" or item.get("name") != "Write":
          continue
        inp: dict = item.get("input") or {}
        file_path: str = inp.get("file_path") or ""
        body: str = inp.get("content") or ""
        if not file_path:
          continue
        yield WriteEntry(
            timestamp=obj.get("timestamp", ""),
            session=obj.get("sessionId") or obj.get("agentId") or "",
            source=path,
            is_subagent=is_subagent,
            file_path=file_path,
            content=body,
        )


def filter_entries(
    entries: Iterable[WriteEntry],
    path_substr: str | None,
    since: str | None,
    until: str | None,
) -> list[WriteEntry]:
  out: list[WriteEntry] = []
  for e in entries:
    if path_substr and path_substr not in e.file_path:
      continue
    if since and e.timestamp and e.timestamp < since:
      continue
    if until and e.timestamp and e.timestamp > until:
      continue
    out.append(e)
  return out


def guess_lang(path: str) -> str:
  suffix: str = Path(path).suffix.lstrip(".").lower()
  return {
      "cs": "csharp",
      "ts": "typescript",
      "tsx": "tsx",
      "js": "javascript",
      "jsx": "jsx",
      "py": "python",
      "md": "markdown",
      "json": "json",
      "yml": "yaml",
      "yaml": "yaml",
      "sh": "bash",
      "fx": "hlsl",
      "hlsl": "hlsl",
      "tscn": "gdscript",
      "gd": "gdscript",
      "html": "html",
      "css": "css",
  }.get(suffix, suffix or "")


def pick_latest(entries: list[WriteEntry]) -> dict[str, WriteEntry]:
  by_path: dict[str, WriteEntry] = {}
  for e in entries:
    cur: WriteEntry | None = by_path.get(e.file_path)
    if cur is None or e.timestamp > cur.timestamp:
      by_path[e.file_path] = e
  return by_path


def render_markdown(entries: list[WriteEntry], latest_only: bool) -> str:
  if latest_only:
    chosen: list[WriteEntry] = sorted(pick_latest(entries).values(), key=lambda x: x.file_path)
  else:
    chosen = sorted(entries, key=lambda x: (x.file_path, x.timestamp))
  lines: list[str] = []
  lines.append(f"# Recovered Writes ({len(chosen)} entries across {len({e.file_path for e in chosen})} paths)")
  lines.append("")
  for e in chosen:
    tag: str = " [subagent]" if e.is_subagent else ""
    lines.append(f"## `{e.file_path}`{tag}")
    lines.append("")
    lines.append(f"- timestamp: `{e.timestamp}`")
    lines.append(f"- session: `{e.session}`")
    lines.append(f"- source: `{e.source}`")
    lines.append(f"- bytes: {len(e.content)}")
    lines.append("")
    lang: str = guess_lang(e.file_path)
    fence: str = "```" + lang
    lines.append(fence)
    lines.append(e.content.rstrip("\n"))
    lines.append("```")
    lines.append("")
  return "\n".join(lines)


def render_list(entries: list[WriteEntry]) -> str:
  rows: list[tuple[str, str, int, str]] = [
      (e.timestamp, e.file_path, len(e.content), e.source.name) for e in entries
  ]
  rows.sort()
  return "\n".join(f"{t or '-':24s}  {n:>8d}B  {p}  ({src})" for t, p, n, src in rows)


def restore_files(entries: list[WriteEntry], out_dir: Path) -> list[Path]:
  out_dir.mkdir(parents=True, exist_ok=True)
  written: list[Path] = []
  for path, entry in pick_latest(entries).items():
    rel: Path = Path(path.lstrip("/"))
    target: Path = out_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(entry.content, encoding="utf-8")
    written.append(target)
  return written


def main() -> int:
  parser: argparse.ArgumentParser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--project", help="project slug under ~/.claude/projects")
  parser.add_argument("--transcript", type=Path, help="single JSONL file")
  parser.add_argument("--session", help="session/UUID substring to filter filenames")
  parser.add_argument("--path", help="only include file_path containing this substring")
  parser.add_argument("--since", help="ISO timestamp lower bound (inclusive)")
  parser.add_argument("--until", help="ISO timestamp upper bound (inclusive)")
  parser.add_argument("--include-subagents", action="store_true")
  parser.add_argument("--all-projects", action="store_true")
  parser.add_argument("--all-versions", action="store_true", help="include every Write, not just latest per path")
  parser.add_argument("--restore", action="store_true", help="write files to --out DIR (default: ./recovered)")
  parser.add_argument("--out", help="output file (markdown) or dir (--restore)")
  parser.add_argument("--list", action="store_true", help="short listing instead of markdown")
  args: argparse.Namespace = parser.parse_args()

  project_dir: Path | None = None
  if not args.transcript and not args.all_projects:
    project_dir = resolve_project_dir(args.project)

  collected: list[WriteEntry] = []
  for jsonl, is_sub in iter_transcripts(
      project_dir, args.transcript, args.session, args.include_subagents, args.all_projects
  ):
    collected.extend(extract_writes(jsonl, is_sub))

  filtered: list[WriteEntry] = filter_entries(collected, args.path, args.since, args.until)
  if not filtered:
    print("no Write entries matched", file=sys.stderr)
    return 1

  if args.restore:
    out_dir: Path = Path(args.out) if args.out else Path("recovered")
    written: list[Path] = restore_files(filtered, out_dir)
    for p in written:
      print(p)
    return 0

  text: str = render_list(filtered) if args.list else render_markdown(filtered, not args.all_versions)
  if args.out:
    Path(args.out).write_text(text, encoding="utf-8")
    print(f"wrote {args.out} ({len(text)} bytes, {len(filtered)} entries)", file=sys.stderr)
  else:
    print(text)
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
