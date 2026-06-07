"""Data loader for the generic ``skilldoc`` env.

Reads cases from a single ``cases.jsonl`` (ratio mode → auto-split 2:1:7) or
from a pre-split ``train/ val/ test`` tree (split_dir mode). Each case line::

    {"id": "basic-1",
     "task": "natural, user-voiced task text (no grader hints)",
     "grader": {"type": "contains_all", "expect": ["..."]},
     "task_type": "basic",          # optional, for stratified sampling
     "reference_text": "..."}        # optional, hidden context for reflection

Only ``id``, ``task``, and ``grader`` are required.
"""

from __future__ import annotations

from pathlib import Path

from skillopt.datasets.base import SplitDataLoader, _load_json_or_jsonl


def _normalize(raw: dict, index: int) -> dict:
    if "task" not in raw and "question" in raw:
        raw["task"] = raw["question"]
    if "task" not in raw or "grader" not in raw:
        raise ValueError(
            f"case #{index} must have 'task' and 'grader' keys; got {sorted(raw)}"
        )
    return {
        "id": str(raw.get("id", f"case-{index}")),
        "task": str(raw["task"]),
        "grader": raw["grader"],
        "task_type": str(raw.get("task_type", "skilldoc")),
        "reference_text": str(raw.get("reference_text", "")),
    }


class SkillDocDataLoader(SplitDataLoader):
    """Load skilldoc cases from JSON/JSONL files."""

    def load_raw_items(self, data_path: str) -> list[dict]:
        """Ratio mode: read every case from one file for deterministic splitting."""
        raw = _load_json_or_jsonl(data_path)
        return [_normalize(item, i) for i, item in enumerate(raw)]

    def load_split_items(self, split_path: str) -> list[dict]:
        """split_dir mode: read the first JSON/JSONL file in the split directory."""
        files = sorted(Path(split_path).glob("*.json*"))
        if not files:
            raise FileNotFoundError(f"no .json/.jsonl file in {split_path}")
        raw = _load_json_or_jsonl(str(files[0]))
        return [_normalize(item, i) for i, item in enumerate(raw)]
