"""Rollout for the generic ``skilldoc`` env.

Runs the frozen target under the *current* skill on each case, then scores the
response with the case's deterministic grader. Supports two deployment surfaces
so the training rollout matches where the skill actually ships:

- **exec backends** (``claude_code_exec`` / ``codex_exec``): the candidate skill
  is written to ``.agents/skills/skillopt-target/SKILL.md`` and the agentic loop
  is told to read it directly — the faithful Claude-Code / Codex path.
- **chat backends** (``openai_chat`` / ``claude_chat`` / ...): the skill is the
  system prompt for a single call.

Either way the grader sees only the final response, so the same ``cases.jsonl``
trains both surfaces.
"""

from __future__ import annotations

import json
import os
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

from skillopt.model import chat_target, is_target_exec_backend
from skillopt.model.codex_harness import (
    prepare_workspace,
    render_skill_md,
    run_target_exec,
)
from skillopt.envs.skilldoc.graders import grade


def _exec_rollout(
    item: dict, skill_content: str, pred_dir: str, *, model: str, timeout: int
) -> str:
    """Run one case through the Claude-Code / Codex agentic loop with the skill injected."""
    skill_md = render_skill_md(
        skill_content,
        description="Candidate skill under optimization for the current task.",
        preamble=(
            "Apply this skill to the task in `task.md`. "
            "Read `task.md`, do the task, and put your final answer last."
        ),
    )
    work_dir = os.path.join(pred_dir, "exec")
    prepare_workspace(work_dir=work_dir, skill_md=skill_md, task_text=item["task"])
    prompt = (
        "Read `.agents/skills/skillopt-target/SKILL.md` directly (do not call a Skill tool), "
        "then read `task.md` and complete the task. End with your final answer."
    )
    final_message, raw = run_target_exec(
        work_dir=work_dir,
        prompt=prompt,
        model=model,
        timeout=timeout,
    )
    return final_message or raw


def _chat_rollout(
    item: dict, skill_content: str, *, max_completion_tokens: int, timeout: int
) -> str:
    system = skill_content.strip() or "You are a helpful assistant."
    user = item["task"]
    if item.get("reference_text"):
        user = f"{user}\n\n## Reference\n{item['reference_text']}"
    response, _usage = chat_target(
        system=system,
        user=user,
        max_completion_tokens=max_completion_tokens,
        stage="rollout",
        timeout=timeout,
    )
    return response


def process_one(
    item: dict,
    out_root: str,
    skill_content: str,
    *,
    exec_timeout: int,
    max_completion_tokens: int,
    model: str,
) -> dict:
    item_id = str(item["id"])
    pred_dir = os.path.join(out_root, "predictions", item_id)
    os.makedirs(pred_dir, exist_ok=True)
    result = {
        "id": item_id,
        "task_description": item.get("task", ""),
        "task_type": item.get("task_type", "skilldoc"),
        "hard": 0,
        "soft": 0.0,
        "response": "",
        "fail_reason": "",
        "predicted_answer": "",
        "grade_detail": "",
    }
    try:
        if is_target_exec_backend():
            response = _exec_rollout(
                item,
                skill_content,
                pred_dir,
                model=model,
                timeout=exec_timeout,
            )
        else:
            response = _chat_rollout(
                item,
                skill_content,
                max_completion_tokens=max_completion_tokens,
                timeout=exec_timeout,
            )
        graded = grade(response, item["grader"])
        result.update(
            response=response,
            predicted_answer=response.strip()[:500],
            hard=graded.hard,
            soft=graded.soft,
            grade_detail=graded.detail,
        )
        if not graded.hard:
            result["fail_reason"] = (
                f"grade failed (soft={graded.soft:.2f}): {graded.detail}"
            )
        with open(os.path.join(pred_dir, "result.json"), "w", encoding="utf-8") as fh:
            json.dump(result, fh, ensure_ascii=False, indent=2)
    except Exception as exc:  # noqa: BLE001
        result["fail_reason"] = f"error: {type(exc).__name__}: {exc}"
        result["grade_detail"] = traceback.format_exc()[-600:]
    return result


def run_batch(
    *,
    items: list[dict],
    skill_content: str,
    out_root: str,
    workers: int = 8,
    exec_timeout: int = 120,
    max_completion_tokens: int = 16384,
    model: str = "",
    task_timeout: int = 600,
    **_ignored,
) -> list[dict]:
    """Score a batch of cases concurrently. Resume-aware via results.jsonl."""
    os.makedirs(out_root, exist_ok=True)
    results_path = os.path.join(out_root, "results.jsonl")

    done_ids: set[str] = set()
    existing: list[dict] = []
    if os.path.exists(results_path):
        with open(results_path, encoding="utf-8") as fh:
            for line in fh:
                try:
                    row = json.loads(line)
                    done_ids.add(str(row["id"]))
                    existing.append(row)
                except (json.JSONDecodeError, KeyError):
                    pass

    pending = [it for it in items if str(it["id"]) not in done_ids]
    if not pending:
        return existing

    results = list(existing)
    total = len(items)
    hard_total = sum(r.get("hard", 0) for r in existing)
    with open(results_path, "a", encoding="utf-8") as outf:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {
                pool.submit(
                    process_one,
                    it,
                    out_root,
                    skill_content,
                    exec_timeout=exec_timeout,
                    max_completion_tokens=max_completion_tokens,
                    model=model,
                ): it
                for it in pending
            }
            for fut in as_completed(futs, timeout=task_timeout * len(pending) + 60):
                res = fut.result()
                results.append(res)
                hard_total += res.get("hard", 0)
                outf.write(json.dumps(res, ensure_ascii=False) + "\n")
                outf.flush()
                acc = hard_total / len(results)
                print(
                    f"    [rollout] {len(results)}/{total} acc={acc:.3f} "
                    f"id={res['id']} hard={res.get('hard')}",
                    flush=True,
                )
    return results
