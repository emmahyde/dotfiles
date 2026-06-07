"""Deterministic graders for the generic ``skilldoc`` env.

A grader maps a target response (plus the case spec) to a score in [0, 1].
``hard`` is the strict pass signal SkillOpt's validation gate optimizes;
``soft`` is a graded signal that keeps the selection score off the 0/1 rails so
edit deltas stay measurable (this is exactly the saturation problem flagged in
the eval-design notes — prefer composite graders so soft lives in (0, 1)).

Every grader is pure and deterministic except ``llm_judge`` (flagged, opt-in):
the gate's validity rests on a stable scorer, so reach for ``command`` /
``contains_*`` / ``regex_all`` first.

Grader spec (one JSON object, under the case's ``"grader"`` key)::

    {"type": "contains_all", "expect": ["foo", "bar"], "ignore_case": true}
    {"type": "contains_any", "expect": ["foo", "bar"]}
    {"type": "not_contains", "expect": ["DROP TABLE"]}      # safety / no-action control
    {"type": "exact",        "expect": "42"}
    {"type": "regex_all",    "patterns": ["^Answer:", "\\b\\d+\\b"]}
    {"type": "command",      "cmd": "python check.py {response_file}", "cwd": "."}
    {"type": "all",          "graders": [ {...}, {...} ]}   # soft = mean of sub-soft
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from dataclasses import dataclass


@dataclass(slots=True)
class GradeResult:
    hard: int  # 1 iff fully correct
    soft: float  # graded score in [0, 1]
    detail: str  # human-readable explanation for the analyst


def _norm(text: str, ignore_case: bool) -> str:
    text = (text or "").strip()
    return text.lower() if ignore_case else text


def _expect_and_hay(response: str, spec: dict) -> tuple[list[str], str, bool]:
    """Shared setup for the substring graders: expected list, normalized
    response ('haystack'), and the ignore_case flag."""
    ignore_case = bool(spec.get("ignore_case", True))
    expect = [str(e) for e in spec.get("expect", [])]
    return expect, _norm(response, ignore_case), ignore_case


def _grade_contains_all(response: str, spec: dict) -> GradeResult:
    expect, hay, ignore_case = _expect_and_hay(response, spec)
    missing = [e for e in expect if _norm(e, ignore_case) not in hay]
    soft = (len(expect) - len(missing)) / len(expect) if expect else 0.0
    detail = "all expected substrings present" if not missing else f"missing: {missing}"
    return GradeResult(hard=int(soft == 1.0), soft=soft, detail=detail)


def _grade_contains_any(response: str, spec: dict) -> GradeResult:
    expect, hay, ignore_case = _expect_and_hay(response, spec)
    hit = any(_norm(e, ignore_case) in hay for e in expect)
    detail = "found an expected substring" if hit else f"none of {expect} present"
    return GradeResult(hard=int(hit), soft=1.0 if hit else 0.0, detail=detail)


def _grade_not_contains(response: str, spec: dict) -> GradeResult:
    expect, hay, ignore_case = _expect_and_hay(response, spec)
    bad = [e for e in expect if _norm(e, ignore_case) in hay]
    ok = not bad
    detail = "clean — no forbidden content" if ok else f"contained forbidden: {bad}"
    return GradeResult(hard=int(ok), soft=1.0 if ok else 0.0, detail=detail)


def _grade_exact(response: str, spec: dict) -> GradeResult:
    ignore_case = bool(spec.get("ignore_case", True))
    ok = _norm(response, ignore_case) == _norm(str(spec.get("expect", "")), ignore_case)
    detail = "exact match" if ok else "did not match expected value exactly"
    return GradeResult(hard=int(ok), soft=1.0 if ok else 0.0, detail=detail)


def _grade_regex_all(response: str, spec: dict) -> GradeResult:
    patterns = [str(p) for p in spec.get("patterns", [])]
    flags = re.IGNORECASE if bool(spec.get("ignore_case", False)) else 0
    hits = [p for p in patterns if re.search(p, response or "", flags)]
    soft = len(hits) / len(patterns) if patterns else 0.0
    missing = [p for p in patterns if p not in hits]
    detail = "all patterns matched" if not missing else f"unmatched patterns: {missing}"
    return GradeResult(hard=int(soft == 1.0), soft=soft, detail=detail)


def _grade_command(response: str, spec: dict) -> GradeResult:
    """Run a shell command; exit 0 = pass. ``{response_file}`` is substituted
    with a temp file holding the response. The most general grader — use it for
    native benchmark scorers, file checks, compile/run gates, etc.

    GRADIENT CONTRACT: the last 400 chars of the command's stdout+stderr become
    ``detail`` (which the optimizer reads as ``Failure reason:`` — see reflect.py).
    So your check script MUST print an *actionable* reason on failure, not just
    exit non-zero — that text is the only signal the optimizer has to learn what
    edit the skill needs. A silent check ⇒ no gradient ⇒ ``best == seed``."""
    cmd = str(spec.get("cmd", "")).strip()
    if not cmd:
        return GradeResult(hard=0, soft=0.0, detail="command grader missing 'cmd'")
    cwd = spec.get("cwd") or None
    timeout = int(spec.get("timeout", 60))
    with tempfile.NamedTemporaryFile(
        "w", suffix=".txt", delete=False, encoding="utf-8"
    ) as fh:
        fh.write(response or "")
        response_file = fh.name
    try:
        rendered = cmd.replace("{response_file}", response_file)
        proc = subprocess.run(
            rendered,
            shell=True,
            cwd=cwd,
            timeout=timeout,
            capture_output=True,
            text=True,
        )
        ok = proc.returncode == 0
        tail = (proc.stdout + proc.stderr).strip()[-400:]
        detail = f"exit={proc.returncode}" + (f" :: {tail}" if tail else "")
        return GradeResult(hard=int(ok), soft=1.0 if ok else 0.0, detail=detail)
    except subprocess.TimeoutExpired:
        return GradeResult(
            hard=0, soft=0.0, detail=f"command timed out after {timeout}s"
        )
    finally:
        try:
            os.unlink(response_file)
        except OSError:
            pass


def _grade_all(response: str, spec: dict) -> GradeResult:
    subs = spec.get("graders", [])
    if not subs:
        return GradeResult(
            hard=0, soft=0.0, detail="composite grader has no sub-graders"
        )
    results = [grade(response, s) for s in subs]
    soft = sum(r.soft for r in results) / len(results)
    hard = int(all(r.hard for r in results))
    detail = " | ".join(f"[{r.soft:.2f}] {r.detail}" for r in results)
    return GradeResult(hard=hard, soft=soft, detail=detail)


_DISPATCH = {
    "contains_all": _grade_contains_all,
    "contains_any": _grade_contains_any,
    "not_contains": _grade_not_contains,
    "exact": _grade_exact,
    "regex_all": _grade_regex_all,
    "command": _grade_command,
    "all": _grade_all,
}


def grade(response: str, spec: dict) -> GradeResult:
    """Score ``response`` against a grader ``spec``. Unknown types fail closed."""
    grader_type = str(spec.get("type", "")).strip()
    fn = _DISPATCH.get(grader_type)
    if fn is None:
        return GradeResult(
            hard=0,
            soft=0.0,
            detail=f"unknown grader type {grader_type!r}; valid: {sorted(_DISPATCH)}",
        )
    return fn(response, spec)
