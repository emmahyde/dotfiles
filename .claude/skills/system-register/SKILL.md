---
name: system-register
description: Rewrite any skill, agent definition, or standing prompt into the register and structure of Claude's own system prompting — rules carrying their rationale, plain precision over flourish, behavioral contract over lore, subtraction over enumeration. Use when the user says "systemize this skill", "convert to system register", "rewrite this like your system prompt", "de-flourish", or when a skill reads as documentation rather than instruction.
---

# System register

Convert a prompt-like document into the form Claude's system prompts actually take. The target document keeps its knowledge; what changes is how that knowledge is carried. Done means a reader could not tell the converted skill from a paragraph of the harness prompt by register alone.

## Why this register

A system prompt is read on every request, forever. That changes what good writing means. Style that delights on the first read is noise by the fiftieth. A rule stated without its mechanism reads as a preference, and preferences get deprioritized under pressure — the reader keeps rules whose consequences they can picture. Current-generation models generalize from the explanation, so one well-reasoned paragraph replaces an enumerated behavior list — the register shift is less text per concern, never more.

## The six moves

**Attach the mechanism to every rule.** The unit of instruction is a 2–6 sentence paragraph ordered target behavior, then boundary or exception, then reason: "Never truthiness-check a value that can be 0 — zero is data." A rule with a visible failure mechanism survives; a bare imperative decays into a suggestion. If you cannot name the mechanism, question whether the rule belongs at all.

**Spend style on precision, not flourish.** Delete metaphor that names nothing operational. The test: does the phrase change what the reader *does*? "Prescribing a corpse" fails the test; "a plan that reintroduces impostors is reintroducing the bug they were removed for" passes, because it says what to check. Keep a vivid phrase only when it *is* the compressed rule ("zero is data").

**Prose paragraphs, one topic each.** Lists only for genuinely enumerable items (flags, file paths, a palette). No XML sectioning, no banners, no rule IDs unless another document must cite them. Headers mark topics, not steps. A paragraph can hold a rule, its mechanism, and its exception; a bullet fragments them.

**Behavioral contract over lore, about 80/20.** Most sentences should tell the reader how to act, decide, or stop — not describe the world. A domain fact earns its place only when it changes behavior, and then it appears fused to the behavior it changes: not "the far plane culls in clip space" but "a vanishing backdrop means check `farClipPlane` against radius + distance — no depth setting rescues clip-space culling." Pure lore moves to a reference file or dies.

**Subtract before you polish.** The documented audit for the Claude 5 family is deletion, not elaboration — Anthropic cut most of its own coding-product prompt with no measured regression. Delete verification instructions (the model self-verifies; asking produces narration), rules defending against failures never observed from this model generation, and examples that only taught tool mechanics. Examples are actively harmful outside narrow output-shape steering: they constrain the model to the space they describe. A stated principle generalizes; a shown example fences.

**Name failure concretely.** Not "be careful with claims of completion" but "a 'done' with no command output beside it is the failure this rule exists for." Abstract warnings pattern-match to nothing at the moment of violation; a concrete pictured failure fires when the reader is about to reproduce it.

## What to preserve untouched

The frontmatter `description` is harness-facing trigger text, not prose — leave its keyword density alone. Genuinely sequential tool mechanics (build steps, API call orders, exact commands) stay procedural: the no-steps rule targets *reasoning* scaffolds ("first analyze, then..."), never mechanical sequences whose order is the content. Exact values — thresholds, ports, paths, magic numbers — transfer verbatim.

## Converting

Read the whole target first; classify each block as contract, domain fact, mechanical procedure, example, or flourish before rewriting any of it — local rewrites without the full map produce a document that contradicts itself. Then rewrite top-down: contract sentences fused with their mechanisms, facts fused to the behavior they change, flourish deleted or compressed into rules, and every surviving sentence re-justified against the deletion audit — a rule that defends against a failure this model never exhibits is dead weight. Rewrite in place with Edit when the skill is yours; write a sibling `SKILL.converted.md` when it is not.

The order of sections follows cost: what failure looks like and the rules preventing it come early; environment facts and edge cases late. A reader who stops halfway should hold the contract, not the lore.
