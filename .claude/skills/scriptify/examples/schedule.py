"""
Critical-path multi-worker epic scheduler.

Engine: assign epics to N workers using list scheduling with critical-path priority.
Data:   supplied as JSON on stdin or --config <file>.

Input JSON schema:
  {
    "epics": {
      "<name>": {"size": <float>, "deps": [<name>, ...]}
    },
    "workers": [1, 2, 3]   // list of worker counts to evaluate
  }

Output: human-readable table of (scenario, workers) -> makespan.
        With --json: machine-readable dict.

Example:
  echo '{"epics": {"A": {"size": 4, "deps": []}}, "workers": [1, 2]}' | python schedule.py
  python schedule.py --config epics.json
"""

import json
import sys
import argparse
import heapq


def compute_critical_path(epics):
    """Return {epic: critical_path_length_from_start_of_epic} (longest path including self)."""
    successors = {e: [] for e in epics}
    for e, data in epics.items():
        for dep in data["deps"]:
            successors[dep].append(e)

    cache = {}

    def cp(e):
        if e in cache:
            return cache[e]
        tail = max((cp(s) for s in successors[e]), default=0)
        cache[e] = epics[e]["size"] + tail
        return cache[e]

    for e in epics:
        cp(e)
    return cache


def simulate(epics, num_workers):
    """
    List-schedule epics across num_workers workers.
    Priority: descending critical-path remaining (longest first).
    Returns (makespan, {epic: (start, finish)}).
    """
    priorities = compute_critical_path(epics)

    done = {}        # epic -> finish_time
    windows = {}     # epic -> (start, finish)
    # heap of (finish_time, epic_name) for in-progress work
    in_progress = []
    pending = set(epics.keys())
    time = 0.0

    while pending or in_progress:
        # Collect completions at current time
        while in_progress and in_progress[0][0] <= time:
            ft, name = heapq.heappop(in_progress)
            done[name] = ft

        # Find ready epics (all deps done)
        ready = sorted(
            [e for e in pending if all(d in done for d in epics[e]["deps"])],
            key=lambda e: -priorities[e],  # highest critical-path first
        )

        # Fill available worker slots
        available = num_workers - len(in_progress)
        for e in ready[:available]:
            start = time
            finish = time + epics[e]["size"]
            windows[e] = (start, finish)
            heapq.heappush(in_progress, (finish, e))
            pending.remove(e)

        if not in_progress:
            break

        # Advance clock to next completion
        next_ft = in_progress[0][0]
        if next_ft > time:
            time = next_ft

    makespan = max(windows[e][1] for e in windows) if windows else 0.0
    return makespan, windows


def run_scenarios(config):
    """
    config: dict with keys:
      scenarios: {name: {epics: {...}, workers: [...]}}
      OR top-level epics + workers (single scenario)
    Returns dict: {scenario_name: {workers: makespan}}
    """
    # Normalize: support both single-scenario and multi-scenario configs
    if "scenarios" in config:
        scenarios = config["scenarios"]
    else:
        scenarios = {"default": {"epics": config["epics"], "workers": config.get("workers", [1])}}

    results = {}
    for sname, sdata in scenarios.items():
        epics = sdata["epics"]
        workers_list = sdata.get("workers", [1])
        results[sname] = {}
        for w in workers_list:
            makespan, _ = simulate(epics, w)
            results[sname][w] = makespan
    return results


def format_table(results, worker_counts):
    """Render side-by-side table: rows=scenarios, cols=worker counts."""
    scenarios = list(results.keys())
    col_w = max(len(s) for s in scenarios)
    num_w = 10

    header = f"{'Scenario':<{col_w}}" + "".join(f"  {w} eng".rjust(num_w) for w in worker_counts)
    sep = "-" * len(header)
    lines = [sep, header, sep]
    for s in scenarios:
        row = f"{s:<{col_w}}"
        for w in worker_counts:
            val = results[s].get(w, "n/a")
            cell = f"{val:.1f}d" if isinstance(val, float) else str(val)
            row += f"  {cell:>{num_w - 2}}"
        lines.append(row)
    lines.append(sep)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Critical-path epic scheduler")
    parser.add_argument("--config", help="Path to JSON config file (default: stdin)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    if args.config:
        with open(args.config) as f:
            config = json.load(f)
    else:
        config = json.load(sys.stdin)

    results = run_scenarios(config)

    if args.json:
        print(json.dumps(results, indent=2))
        return

    # Gather all worker counts across scenarios
    all_workers = sorted({w for sdata in results.values() for w in sdata})
    print(format_table(results, all_workers))


# --- Smoke test (known-good fixture) ---
def _smoke_test():
    """
    Simple chain A->B->C with 1 worker = 1+2+3 = 6 days.
    With 2 workers same (serial chain): still 6.
    """
    epics = {
        "A": {"size": 1, "deps": []},
        "B": {"size": 2, "deps": ["A"]},
        "C": {"size": 3, "deps": ["B"]},
    }
    m1, _ = simulate(epics, 1)
    m2, _ = simulate(epics, 2)
    assert m1 == 6.0, f"Expected 6.0, got {m1}"
    assert m2 == 6.0, f"Expected 6.0 with 2 workers (serial chain), got {m2}"

    # Diamond: A->B, A->C, B->D, C->D
    # A=1, B=2, C=3, D=1
    # 1 worker: 1+2+3+1=7 or 1+3+2+1=7 (sequential best is 1+3+2+1=7? No: 1 worker goes A,C,B,D = 1+3+2+1=7)
    # 2 workers: A=1, then B+C parallel (B=2,C=3 -> C finishes at 4), D starts at 4, ends at 5
    diamond = {
        "A": {"size": 1, "deps": []},
        "B": {"size": 2, "deps": ["A"]},
        "C": {"size": 3, "deps": ["A"]},
        "D": {"size": 1, "deps": ["B", "C"]},
    }
    dm1, _ = simulate(diamond, 1)
    dm2, _ = simulate(diamond, 2)
    assert dm1 == 7.0, f"Diamond 1-worker: expected 7.0, got {dm1}"
    assert dm2 == 5.0, f"Diamond 2-worker: expected 5.0, got {dm2}"

    print("Smoke test PASSED")


if __name__ == "__main__":
    if "--smoke-test" in sys.argv:
        _smoke_test()
    else:
        main()
