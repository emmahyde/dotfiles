"""EnvAdapter for the generic ``skilldoc`` env — wires loader + rollout + the
real SkillOpt reflection/gating loop together. No env-specific Python is needed
per skill: behavior comes entirely from ``cases.jsonl`` + config.
"""

from __future__ import annotations

import os

from skillopt.datasets.base import BatchSpec
from skillopt.envs.base import EnvAdapter
from skillopt.envs.skilldoc.loader import SkillDocDataLoader
from skillopt.envs.skilldoc.rollout import run_batch
from skillopt.gradient.reflect import run_minibatch_reflect


class SkillDocAdapter(EnvAdapter):
    def __init__(
        self,
        split_dir: str = "",
        data_path: str = "",
        split_mode: str = "ratio",
        split_ratio: str = "2:1:7",
        split_seed: int = 42,
        split_output_dir: str = "",
        workers: int = 8,
        analyst_workers: int = 8,
        failure_only: bool = False,
        minibatch_size: int = 8,
        edit_budget: int = 4,
        seed: int = 42,
        limit: int = 0,
        exec_timeout: int = 120,
        max_completion_tokens: int = 16384,
        target_model: str = "",
    ) -> None:
        self.workers = workers
        self.analyst_workers = analyst_workers
        self.failure_only = failure_only
        self.minibatch_size = minibatch_size
        self.edit_budget = edit_budget
        self.exec_timeout = int(exec_timeout)
        self.max_completion_tokens = int(max_completion_tokens)
        self.target_model = target_model
        self.dataloader = SkillDocDataLoader(
            split_dir=split_dir,
            data_path=data_path,
            split_mode=split_mode,
            split_ratio=split_ratio,
            split_seed=split_seed,
            split_output_dir=split_output_dir,
            seed=seed,
            limit=limit,
        )

    def setup(self, cfg: dict) -> None:
        super().setup(cfg)
        self.dataloader.setup(cfg)
        # Fall back to the configured target model name if not passed explicitly.
        if not self.target_model:
            self.target_model = str(cfg.get("target") or cfg.get("target_model") or "")

    def get_dataloader(self):
        return self.dataloader

    def build_env_from_batch(self, batch: BatchSpec, **kwargs):
        return list(batch.payload or [])

    def build_train_env(self, batch_size: int, seed: int, **kwargs):
        batch = self.dataloader.build_train_batch(
            batch_size=batch_size, seed=seed, **kwargs
        )
        return self.build_env_from_batch(batch, **kwargs)

    def build_eval_env(self, env_num: int, split: str, seed: int, **kwargs):
        batch = self.dataloader.build_eval_batch(
            env_num=env_num, split=split, seed=seed, **kwargs
        )
        return self.build_env_from_batch(batch, **kwargs)

    def rollout(
        self, env_manager, skill_content: str, out_dir: str, **kwargs
    ) -> list[dict]:
        return run_batch(
            items=env_manager,
            skill_content=skill_content,
            out_root=out_dir,
            workers=self.workers,
            exec_timeout=self.exec_timeout,
            max_completion_tokens=self.max_completion_tokens,
            model=self.target_model,
        )

    def reflect(
        self, results: list[dict], skill_content: str, out_dir: str, **kwargs
    ) -> list[dict | None]:
        return run_minibatch_reflect(
            results=results,
            skill_content=skill_content,
            prediction_dir=kwargs.get(
                "prediction_dir", os.path.join(out_dir, "predictions")
            ),
            patches_dir=kwargs.get("patches_dir", os.path.join(out_dir, "patches")),
            workers=self.analyst_workers,
            failure_only=self.failure_only,
            minibatch_size=self.minibatch_size,
            edit_budget=self.edit_budget,
            random_seed=kwargs.get("random_seed"),
            error_system=self.get_error_minibatch_prompt(),
            success_system=self.get_success_minibatch_prompt(),
            step_buffer_context=kwargs.get("step_buffer_context", ""),
            update_mode=getattr(self, "_cfg", {}).get("skill_update_mode", "patch"),
        )

    def get_task_types(self) -> list[str]:
        pools = (
            getattr(self.dataloader, "train_items", []),
            getattr(self.dataloader, "val_items", []),
            getattr(self.dataloader, "test_items", []),
        )
        seen = list(
            dict.fromkeys(
                str(item.get("task_type") or "skilldoc")
                for pool in pools
                for item in pool
            )
        )
        return seen or ["skilldoc"]
