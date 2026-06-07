#!/usr/bin/env python3
"""One-command plug-and-play SkillOpt runner.

Given a seed skill.md and a cases.jsonl, this materializes a config, invokes the
*real* SkillOpt training loop (rollout → reflect → select → gate → update) via
the generic ``skilldoc`` env, and prints the path to ``best_skill.md`` plus its
held-out test score. No per-skill Python, no hand-written config.

    skilldoc_run.py --skill SKILL.md --cases cases.jsonl [--out DIR] [opts]

Run bootstrap.sh once first (installs SkillOpt + registers the skilldoc env).
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys


def _find_skillopt_root() -> str:
    """Locate the SkillOpt checkout (env override, then common locations)."""
    candidates = [
        os.environ.get("SKILLOPT_ROOT", ""),
        os.path.expanduser("~/.cache/skillopt/SkillOpt"),
        "/tmp/SkillOpt",
    ]
    for path in candidates:
        if path and os.path.isfile(os.path.join(path, "scripts", "train.py")):
            return path
    sys.exit(
        "ERROR: SkillOpt checkout not found. Run bootstrap.sh first, or set "
        "SKILLOPT_ROOT to your clone of github.com/microsoft/SkillOpt."
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--skill", required=True, help="seed skill.md to optimize")
    p.add_argument(
        "--cases",
        required=True,
        help="cases.jsonl (task + deterministic grader per line)",
    )
    p.add_argument("--out", default="outputs/skilldoc-run", help="output root")
    p.add_argument("--epochs", type=int, default=None, help="override num_epochs")
    p.add_argument(
        "--batch_size", type=int, default=None, help="override rollout batch size"
    )
    p.add_argument(
        "--target_backend", default=None, help="e.g. claude_code_exec | openai_chat"
    )
    p.add_argument("--target_model", default=None)
    p.add_argument(
        "--optimizer_backend", default=None, help="e.g. claude_chat | openai_chat"
    )
    p.add_argument("--optimizer_model", default=None)
    p.add_argument("--workers", type=int, default=None)
    p.add_argument(
        "--split_ratio",
        default=None,
        help="train:val:test, e.g. 5:5:5 for a thick selection gate on small suites (default 2:1:7)",
    )
    p.add_argument(
        "--dry-run", action="store_true", help="print the command without running"
    )
    return p.parse_args()


def _map_openai_env() -> None:
    """Make OPENAI_API_KEY 'just work'. SkillOpt's openai_chat backend reads the
    AZURE_OPENAI_* names (there is no OPENAI_API_KEY knob), so mirror them here
    when the user only exported OPENAI_API_KEY. Never clobbers values already set."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return
    os.environ.setdefault("AZURE_OPENAI_API_KEY", key)
    os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "https://api.openai.com/v1")
    os.environ.setdefault("AZURE_OPENAI_AUTH_MODE", "openai_compatible")


def _count_cases(cases_path: str) -> int:
    """Count cases in a .jsonl (or json list) without importing skillopt."""
    import json

    with open(cases_path, encoding="utf-8") as fh:
        text = fh.read().strip()
    if not text:
        return 0
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return len(data)
        if isinstance(data, dict) and isinstance(data.get("data"), list):
            return len(data["data"])
    except json.JSONDecodeError:
        pass
    return sum(1 for line in text.splitlines() if line.strip())


# Split policy: the paper's 2:1:7 assumes a large dataset; on small hand-authored
# suites it leaves a 1-2 item selection gate (noise → best==seed), so small
# suites default to equal thirds. A selection gate below MIN_GATE_CASES is noise.
SMALL_SUITE_MAX_CASES = 30
SMALL_SUITE_RATIO = "1:1:1"
DEFAULT_RATIO = "2:1:7"
MIN_GATE_CASES = 3


def _auto_split_ratio(n_cases: int, override: str | None) -> str:
    if override:
        return override
    return SMALL_SUITE_RATIO if n_cases < SMALL_SUITE_MAX_CASES else DEFAULT_RATIO


def _preflight_gate(n_cases: int, split_ratio: str) -> None:
    """Warn before spending if the selection (val) split will be too thin to
    give the validation gate signal. A 1-item gate is noise — see the example
    run (train=1/val=1/test=4) that produced best==seed."""
    try:
        tr, va, te = (int(p) for p in split_ratio.split(":"))
    except ValueError:
        tr, va, te = 2, 1, 7
    sel = max(0, round(n_cases * va / (tr + va + te)))
    if sel < MIN_GATE_CASES:
        print(
            f"⚠️  PRE-FLIGHT: {n_cases} cases with split {split_ratio} → ~{sel}-item "
            f"selection gate. A gate under {MIN_GATE_CASES} items gives the optimizer "
            "almost no signal (best likely == seed). Add cases (aim for ≥9), or pass a "
            "thicker --split_ratio. Continuing anyway.",
            flush=True,
        )
    else:
        print(
            f"  pre-flight: {n_cases} cases, split {split_ratio} → ~{sel}-item selection gate (ok)",
            flush=True,
        )


def main() -> int:
    args = parse_args()
    _map_openai_env()
    root = _find_skillopt_root()
    skill = os.path.abspath(args.skill)
    cases = os.path.abspath(args.cases)
    out = os.path.abspath(args.out)
    for path, label in [(skill, "--skill"), (cases, "--cases")]:
        if not os.path.isfile(path):
            sys.exit(f"ERROR: {label} not found: {path}")
    n_cases = _count_cases(cases)
    split_ratio = _auto_split_ratio(n_cases, args.split_ratio)
    if not args.split_ratio and split_ratio != DEFAULT_RATIO:
        print(
            f"  auto split: small suite → using {split_ratio} (override with --split_ratio)",
            flush=True,
        )
    _preflight_gate(n_cases, split_ratio)
    os.makedirs(out, exist_ok=True)

    cfg = os.path.join(root, "configs", "skilldoc", "default.yaml")
    if not os.path.isfile(cfg):
        sys.exit(
            f"ERROR: {cfg} missing — re-run bootstrap.sh (it installs the skilldoc env)."
        )

    # cfg-options override the YAML inline so we never mutate the shared config.
    cfg_options = [
        f"env.skill_init={skill}",
        f"env.data_path={cases}",
        f"env.out_root={out}",
        f"env.split_output_dir={os.path.join(out, 'split')}",
        f"env.split_ratio={split_ratio}",
    ]
    optional = {
        "train.num_epochs": args.epochs,
        "train.batch_size": args.batch_size,
        "env.workers": args.workers,
    }
    cfg_options += [f"{k}={v}" for k, v in optional.items() if v is not None]

    cmd = [
        sys.executable,
        os.path.join(root, "scripts", "train.py"),
        "--config",
        cfg,
        "--env",
        "skilldoc",
        "--out_root",
        out,
    ]
    role_flags = {
        "--target_backend": args.target_backend,
        "--target_model": args.target_model,
        "--optimizer_backend": args.optimizer_backend,
        "--optimizer_model": args.optimizer_model,
    }
    for flag, value in role_flags.items():
        if value:
            cmd += [flag, value]
    cmd += ["--cfg-options", *cfg_options]

    print("SkillOpt root :", root)
    print("Seed skill    :", skill)
    print("Cases         :", cases)
    print("Output        :", out)
    print("Command       :", " ".join(cmd))
    if args.dry_run:
        return 0

    proc = subprocess.run(cmd, cwd=root)
    best = os.path.join(out, "best_skill.md")
    print("\n" + "=" * 60)
    if proc.returncode == 0 and os.path.isfile(best):
        print(f"✅ Done. Optimized skill: {best}")
        print(f"   Test scores + run artifacts under: {out}")
        print("   Next: run the Phase 2 budgeted Opus audit before deploying.")
    else:
        print(f"⚠️  train.py exited {proc.returncode}. Check logs under {out}.")
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
