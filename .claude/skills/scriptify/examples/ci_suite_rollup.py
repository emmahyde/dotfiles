"""ci_suite_rollup.py — Sum test durations by suite from CI log output.

Engine: parse lines matching '[suite=NAME] test_id <N>s', aggregate seconds
per suite, sort descending, flag suites whose total exceeds --threshold.

Usage:
    python ci_suite_rollup.py ci.log
    python ci_suite_rollup.py ci.log --threshold 300
    python ci_suite_rollup.py ci.log --json

Input format (one test per line):
    [suite=auth] test_login 12.3s

Output (human):
    billing   415.7s  *** SLOW (>300s)
    api        75.5s
    auth       16.4s

Output (--json):
    [{"suite": "billing", "total_seconds": 415.7, "flagged": true}, ...]
"""

import argparse
import json
import re
import sys
from collections import defaultdict

LINE_RE = re.compile(r'\[suite=(\w+)\]\s+\S+\s+([\d.]+)s')


def parse_log(lines):
    totals = defaultdict(float)
    for line in lines:
        m = LINE_RE.search(line)
        if m:
            totals[m.group(1)] += float(m.group(2))
    return totals


def rollup(totals, threshold):
    rows = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    return [{"suite": s, "total_seconds": round(t, 1), "flagged": t > threshold}
            for s, t in rows]


def main():
    ap = argparse.ArgumentParser(description="Sum CI test durations by suite.")
    ap.add_argument("logfile", help="Path to CI log file (- for stdin)")
    ap.add_argument("--threshold", type=float, default=300.0,
                    help="Flag suites exceeding this many seconds (default 300)")
    ap.add_argument("--json", action="store_true", dest="as_json",
                    help="Emit JSON array instead of human-readable table")
    args = ap.parse_args()

    src = sys.stdin if args.logfile == "-" else open(args.logfile)
    with src:
        totals = parse_log(src)

    results = rollup(totals, args.threshold)

    if args.as_json:
        print(json.dumps(results, indent=2))
    else:
        if not results:
            print("No suite lines found.")
            return
        width = max(len(r["suite"]) for r in results)
        for r in results:
            flag = f"  *** SLOW (>{int(args.threshold)}s)" if r["flagged"] else ""
            print(f"{r['suite']:<{width}}  {r['total_seconds']:>8.1f}s{flag}")


# --- smoke test (known-good) ---
def _smoke():
    sample = [
        "[suite=auth] test_login 12.3s",
        "[suite=auth] test_logout 4.1s",
        "[suite=billing] test_invoice 120.5s",
        "[suite=billing] test_proration 200.2s",
        "[suite=api] test_get 30.0s",
        "[suite=billing] test_refund 95.0s",
        "[suite=api] test_post 45.5s",
    ]
    totals = parse_log(sample)
    results = rollup(totals, 300)
    assert results[0]["suite"] == "billing", f"Expected billing first, got {results[0]}"
    assert abs(results[0]["total_seconds"] - 415.7) < 0.01, results[0]
    assert results[0]["flagged"] is True
    assert results[1]["suite"] == "api"
    assert abs(results[1]["total_seconds"] - 75.5) < 0.01
    assert results[1]["flagged"] is False
    assert results[2]["suite"] == "auth"
    assert abs(results[2]["total_seconds"] - 16.4) < 0.01
    print("smoke: PASS")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--smoke":
        _smoke()
    else:
        main()
