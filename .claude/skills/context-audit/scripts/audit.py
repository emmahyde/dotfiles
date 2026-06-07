#!/usr/bin/env python3
"""Context-waste audit for Claude Code session transcripts.

Reads a .jsonl transcript, scores token-waste patterns, prints a markdown report.
Optional --emit-rules adds hookify-style rule seeds for the top patterns.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import textwrap
from collections import defaultdict
from glob import glob
from pathlib import Path


# Approximate Anthropic tokens-per-byte for English/code. Conservative.
BYTES_PER_TOKEN = 4


def find_default_transcript() -> str | None:
    root = Path.home() / ".claude" / "projects"
    if not root.exists():
        return None
    candidates = []
    for p in root.rglob("*.jsonl"):
        try:
            candidates.append((p.stat().st_mtime, p))
        except OSError:
            continue
    if not candidates:
        return None
    candidates.sort(reverse=True)
    return str(candidates[0][1])


def extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                t = item.get("text") or item.get("content")
                if isinstance(t, str):
                    parts.append(t)
                elif isinstance(t, list):
                    parts.append(extract_text(t))
        return "".join(parts)
    return ""


def iter_records(path: str):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh):
            line = line.strip()
            if not line:
                continue
            try:
                yield i, json.loads(line)
            except json.JSONDecodeError:
                continue


def collect(path: str):
    """Return tool_use list, tool_result map, and basic stats."""
    tool_uses = []  # (turn_idx, name, input)
    results = {}  # tool_use_id -> (size_bytes, head)
    user_chars = 0
    assistant_chars = 0
    for turn_idx, rec in iter_records(path):
        rtype = rec.get("type")
        msg = rec.get("message") or {}
        content = msg.get("content")
        if rtype == "user" and isinstance(content, str):
            user_chars += len(content)
        if isinstance(content, list):
            for item in content:
                if not isinstance(item, dict):
                    continue
                itype = item.get("type")
                if itype == "text":
                    assistant_chars += len(item.get("text") or "")
                elif itype == "tool_use":
                    tool_uses.append(
                        (
                            turn_idx,
                            item.get("name", "?"),
                            item.get("input") or {},
                            item.get("id"),
                        )
                    )
                elif itype == "tool_result":
                    tuid = item.get("tool_use_id")
                    body = item.get("content")
                    text = extract_text(body)
                    results[tuid] = (len(text), text[:240])
    return tool_uses, results, user_chars, assistant_chars


# ---------- heuristics ----------

CAT_CMD = re.compile(r"\b(cat|head|tail|sed|awk)\s+[^|]*?(?:\.|/|\w)", re.I)
WC_CMD = re.compile(r"\bwc\s+-l\b", re.I)
GREP_RG_CMD = re.compile(r"\b(grep|rg|ripgrep)\b", re.I)
FIND_CMD = re.compile(r"\bfind\s+\S", re.I)


def heuristic_bloated_outputs(tool_uses, results, thresh_bytes):
    """tool_result above threshold — likely could've been narrowed via ctx_execute_file."""
    findings = []
    for idx, name, _inp, tid in tool_uses:
        size, _head = results.get(tid, (0, ""))
        if size >= thresh_bytes and name in {
            "Read",
            "Bash",
            "Grep",
            "Glob",
            "WebFetch",
        }:
            findings.append({"turn": idx, "tool": name, "bytes": size})
    return findings


def heuristic_cat_via_bash(tool_uses):
    findings = []
    for idx, name, inp, _tid in tool_uses:
        if name != "Bash":
            continue
        cmd = inp.get("command") or ""
        if CAT_CMD.search(cmd):
            findings.append({"turn": idx, "command": cmd[:160]})
    return findings


def heuristic_redundant_reads(tool_uses):
    """Same file Read more than once with no intervening Edit/Write to it."""
    findings = []
    last_read_idx = {}
    edited_since = defaultdict(bool)
    for idx, name, inp, _tid in tool_uses:
        if name == "Read":
            fp = inp.get("file_path")
            if not fp:
                continue
            if fp in last_read_idx and not edited_since[fp]:
                findings.append(
                    {"turn": idx, "file": fp, "previous_turn": last_read_idx[fp]}
                )
            last_read_idx[fp] = idx
            edited_since[fp] = False
        elif name in {"Edit", "Write"}:
            fp = inp.get("file_path")
            if fp:
                edited_since[fp] = True
    return findings


def heuristic_read_after_edit(tool_uses):
    """Read of a file in the same turn or directly after Edit/Write to it."""
    findings = []
    last_edit_turn = {}
    for idx, name, inp, _tid in tool_uses:
        fp = inp.get("file_path") if isinstance(inp, dict) else None
        if name in {"Edit", "Write"} and fp:
            last_edit_turn[fp] = idx
        elif name == "Read" and fp and fp in last_edit_turn:
            findings.append({"turn": idx, "file": fp, "edit_turn": last_edit_turn[fp]})
            del last_edit_turn[fp]
    return findings


def heuristic_repeated_greps(tool_uses, window=20):
    """Multiple Grep/Glob/Bash-grep calls with overlapping pattern within a window."""
    findings = []
    recent = []
    for idx, name, inp, _tid in tool_uses:
        sig = None
        if name == "Grep":
            sig = ("grep", str(inp.get("pattern", "")), str(inp.get("path", "")))
        elif name == "Glob":
            sig = ("glob", str(inp.get("pattern", "")))
        elif name == "Bash":
            cmd = inp.get("command") or ""
            m = GREP_RG_CMD.search(cmd)
            if m:
                sig = ("bash-grep", cmd[:120])
        if sig:
            for prev_idx, prev_sig in recent[-window:]:
                if sig[0] == prev_sig[0] and sig[1] == prev_sig[1]:
                    findings.append(
                        {"turn": idx, "previous_turn": prev_idx, "signature": sig}
                    )
                    break
            recent.append((idx, sig))
    return findings


def heuristic_raw_webfetch(tool_uses, results, min_bytes=2000):
    findings = []
    for idx, name, inp, tid in tool_uses:
        if name != "WebFetch":
            continue
        size, _ = results.get(tid, (0, ""))
        if size >= min_bytes:
            findings.append({"turn": idx, "url": inp.get("url"), "bytes": size})
    return findings


def heuristic_verbose_agent_dispatch(tool_uses, min_prompt_chars=4000):
    findings = []
    for idx, name, inp, _tid in tool_uses:
        if name != "Agent" and name != "Task":
            continue
        prompt = inp.get("prompt") or ""
        if len(prompt) >= min_prompt_chars:
            findings.append(
                {
                    "turn": idx,
                    "subagent": inp.get("subagent_type"),
                    "prompt_bytes": len(prompt),
                }
            )
    return findings


def heuristic_long_bash(tool_uses, results, min_bytes=4000):
    findings = []
    for idx, name, inp, tid in tool_uses:
        if name != "Bash":
            continue
        size, head = results.get(tid, (0, ""))
        if size >= min_bytes:
            findings.append(
                {
                    "turn": idx,
                    "command": (inp.get("command") or "")[:160],
                    "bytes": size,
                }
            )
    return findings


# ---------- reporting ----------


def fmt_tokens(bytes_):
    return bytes_ // BYTES_PER_TOKEN


def summarize_findings(buckets):
    rows = []
    for key, info in buckets.items():
        items = info["items"]
        total_bytes = info["total_bytes"]
        rows.append(
            {
                "pattern": key,
                "count": len(items),
                "est_tokens": fmt_tokens(total_bytes),
                "exemplar": info["exemplar"],
                "swap": info["swap"],
            }
        )
    rows.sort(key=lambda r: r["est_tokens"], reverse=True)
    return rows


def build_report(path, tool_uses, results, user_chars, assistant_chars, args):
    buckets = {}

    def add(name, items, total_bytes, swap, exemplar_fmt):
        if not items:
            return
        buckets[name] = {
            "items": items,
            "total_bytes": total_bytes,
            "swap": swap,
            "exemplar": exemplar_fmt(items[0]) if items else "",
        }

    bloated = heuristic_bloated_outputs(tool_uses, results, args.threshold_bytes)
    add(
        "Bloated tool outputs",
        bloated,
        sum(f["bytes"] for f in bloated),
        "Use ctx_execute_file / ctx_batch_execute to filter in sandbox; surface only the answer.",
        lambda f: f"turn {f['turn']} {f['tool']} returned {f['bytes']} bytes",
    )

    cats = heuristic_cat_via_bash(tool_uses)
    add(
        "cat/head/tail via Bash",
        cats,
        sum(120 for _ in cats),  # rough fixed overhead per offending call
        "Use Read for one-shot file view, or ctx_execute for processed output.",
        lambda f: f"turn {f['turn']} `{f['command']}`",
    )

    redundant = heuristic_redundant_reads(tool_uses)
    add(
        "Redundant Reads (same file)",
        redundant,
        sum(2000 for _ in redundant),  # estimate per re-read
        "Cache file content in a local variable / scratch note; only re-Read after an Edit invalidates it.",
        lambda f: (
            f"turn {f['turn']} re-Read {f['file']} (first at turn {f['previous_turn']})"
        ),
    )

    rae = heuristic_read_after_edit(tool_uses)
    add(
        "Read after Edit",
        rae,
        sum(1500 for _ in rae),
        "Harness tracks file state after Edit — skip the verifying Read.",
        lambda f: (
            f"turn {f['turn']} Read {f['file']} after Edit at turn {f['edit_turn']}"
        ),
    )

    repeated = heuristic_repeated_greps(tool_uses)
    add(
        "Repeated Grep/Glob",
        repeated,
        sum(500 for _ in repeated),
        "Batch related searches into one Grep/Glob with broader pattern, or use ctx_batch_execute.",
        lambda f: (
            f"turn {f['turn']} repeat of turn {f['previous_turn']}: {f['signature']}"
        ),
    )

    webs = heuristic_raw_webfetch(tool_uses, results)
    add(
        "Raw WebFetch",
        webs,
        sum(f["bytes"] for f in webs),
        "Use ctx_fetch_and_index — page indexed in sandbox; only matches enter context.",
        lambda f: f"turn {f['turn']} {f['url']} ({f['bytes']} bytes)",
    )

    agents = heuristic_verbose_agent_dispatch(tool_uses)
    add(
        "Verbose Agent dispatch",
        agents,
        sum(f["prompt_bytes"] for f in agents),
        "Move long context to bundled files and pass paths; prompt should brief, not re-summarize.",
        lambda f: (
            f"turn {f['turn']} subagent={f['subagent']} prompt={f['prompt_bytes']} bytes"
        ),
    )

    longb = heuristic_long_bash(tool_uses, results)
    add(
        "Long Bash output",
        longb,
        sum(f["bytes"] for f in longb),
        "Pipe through ctx_execute(language='shell', ...) — only console output enters context.",
        lambda f: f"turn {f['turn']} `{f['command']}` -> {f['bytes']} bytes",
    )

    rows = summarize_findings(buckets)
    total_waste = sum(r["est_tokens"] for r in rows)

    # ----- assemble markdown -----
    title = f"Context audit — `{Path(path).name}`"
    overview = textwrap.dedent(
        f"""
        # {title}

        - **Transcript:** `{path}`
        - **Tool calls:** {len(tool_uses)}
        - **User chars:** {user_chars}
        - **Assistant chars:** {assistant_chars}
        - **Estimated waste:** ~{total_waste} tokens across {len(rows)} pattern(s)
        """
    ).strip()

    if not rows:
        return overview + "\n\nNo waste patterns detected above thresholds.\n"

    lines = [
        overview,
        "",
        "## Findings",
        "",
        "| Pattern | Count | Est tokens | Suggested swap |",
        "|---|---|---|---|",
    ]
    for r in rows[: args.top]:
        lines.append(
            f"| {r['pattern']} | {r['count']} | {r['est_tokens']} | {r['swap']} |"
        )
    lines.append("")
    lines.append("## Exemplars")
    lines.append("")
    for r in rows[: args.top]:
        lines.append(f"- **{r['pattern']}** — {r['exemplar']}")

    if args.emit_rules:
        lines.append("")
        lines.append("## Hookify rule seeds")
        lines.append("")
        lines.append("```yaml")
        lines.append(emit_rule_seeds(buckets, top=args.top))
        lines.append("```")

    return "\n".join(lines) + "\n"


def emit_rule_seeds(buckets, top=20):
    """Emit hookify-style YAML stubs for the heaviest patterns."""
    catalog = {
        "Bloated tool outputs": {
            "id": "no-bloated-tool-output",
            "trigger": "PreToolUse",
            "match": "tool in [Read, Bash, Grep, Glob, WebFetch]",
            "guidance": "If the next step is to PROCESS the output, route through ctx_execute_file or ctx_batch_execute instead.",
        },
        "cat/head/tail via Bash": {
            "id": "no-cat-via-bash",
            "trigger": "PreToolUse",
            "match": "tool == Bash and command matches /\\b(cat|head|tail|sed|awk)\\b/",
            "guidance": "Use Read for file viewing or ctx_execute for processing — not cat/head/tail in Bash.",
        },
        "Redundant Reads (same file)": {
            "id": "no-redundant-read",
            "trigger": "PreToolUse",
            "match": "tool == Read and file_path was Read this session and not Edited since",
            "guidance": "File contents already in conversation — skip the re-Read.",
        },
        "Read after Edit": {
            "id": "no-read-after-edit",
            "trigger": "PreToolUse",
            "match": "tool == Read and file_path was Edited/Written in last 3 turns",
            "guidance": "Harness tracks file state after Edit — re-Reading wastes tokens.",
        },
        "Repeated Grep/Glob": {
            "id": "batch-searches",
            "trigger": "PreToolUse",
            "match": "tool in [Grep, Glob] and recent identical signature within 20 turns",
            "guidance": "Batch related searches into one call with broader pattern.",
        },
        "Raw WebFetch": {
            "id": "use-ctx-fetch-and-index",
            "trigger": "PreToolUse",
            "match": "tool == WebFetch",
            "guidance": "Prefer ctx_fetch_and_index — raw page never enters conversation context.",
        },
        "Verbose Agent dispatch": {
            "id": "lean-agent-prompts",
            "trigger": "PreToolUse",
            "match": "tool == Agent and prompt length > 4000 chars",
            "guidance": "Move long context to bundled files passed by path; brief, don't re-summarize.",
        },
        "Long Bash output": {
            "id": "long-bash-via-ctx",
            "trigger": "PreToolUse",
            "match": "tool == Bash and predicted output > 4000 bytes",
            "guidance": "Route through ctx_execute(language='shell', ...) so raw output stays in sandbox.",
        },
    }
    out = []
    rows = summarize_findings(buckets)
    for r in rows[:top]:
        seed = catalog.get(r["pattern"])
        if not seed:
            continue
        out.append(
            textwrap.dedent(
                f"""\
                - id: {seed["id"]}
                  trigger: {seed["trigger"]}
                  match: "{seed["match"]}"
                  observed_count: {r["count"]}
                  est_tokens_saved: {r["est_tokens"]}
                  guidance: |
                    {seed["guidance"]}
                """
            ).rstrip()
        )
    return "\n".join(out) if out else "# no rule seeds (no findings above threshold)"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--file", help="Path to a session .jsonl file")
    ap.add_argument("--session", help="Session id (looks under ~/.claude/projects/**)")
    ap.add_argument(
        "--threshold-bytes",
        type=int,
        default=4000,
        help="Min bytes for 'bloated' tool output",
    )
    ap.add_argument("--top", type=int, default=20, help="Max findings rows")
    ap.add_argument(
        "--emit-rules", action="store_true", help="Append hookify-style rule seeds"
    )
    args = ap.parse_args()

    path = args.file
    if not path and args.session:
        matches = glob(
            str(Path.home() / ".claude" / "projects" / "**" / f"{args.session}*.jsonl"),
            recursive=True,
        )
        if matches:
            path = matches[0]
    if not path:
        path = find_default_transcript()
    if not path or not os.path.exists(path):
        print("error: could not resolve transcript path", file=sys.stderr)
        return 2

    tool_uses, results, uc, ac = collect(path)
    report = build_report(path, tool_uses, results, uc, ac, args)
    sys.stdout.write(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
