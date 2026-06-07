"""Generic SkillOpt environment: optimize any skill.md against any deterministic graders.

This is the plug-and-play env that lets SkillOpt train an arbitrary skill
document without writing a bespoke benchmark. Drop a ``cases.jsonl`` (natural
task + deterministic grader per line) and a seed ``skill.md``; this env handles
the rollout (chat or Claude-Code/Codex exec) and scoring for you.

See ``adapter.SkillDocAdapter`` for the entry point.
"""

from skillopt.envs.skilldoc.adapter import SkillDocAdapter

__all__ = ["SkillDocAdapter"]
