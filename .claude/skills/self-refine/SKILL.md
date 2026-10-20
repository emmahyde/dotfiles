---
name: self-refine
description: Injects a grounded Criteria → Generate → Critique → Improve → Final loop into a response. Use when the user wants higher-quality, self-checked answers, or includes phrases like "think carefully", "be thorough", "check your work", or explicitly requests critique-and-improve cycles. Not for output you can verify with tools — run the compiler, test, or grep instead of critiquing prose-first.
---

# Self-Refine

Ungrounded self-critique confabulates: it invents plausible gaps, hedges correct answers, and misses real omissions (evidence: ~/.claude/skills/session-retro/REFERENCE.md — freeform reflection +0.0pp vs +16.2pp curated; forced grounded templates took correct-cause identification 0%→86%). Every step below is therefore anchored to artifacts, not introspection.

Append this pattern to any prompt where output quality matters:

```
0. Criteria: BEFORE generating, list every requirement stated in the request
   and the conversation so far. This checklist is what Critique diffs against —
   recall-after-drafting is the failure mode, retrieval-before-drafting the fix.

Generate your best answer, then:

1. Critique: one line per checklist item and per load-bearing claim:
   GAP: <claim or missing item> | CHECK: <artifact — command run, file read,
   requirement line> | RESULT: <finding>
   A gap without a CHECK is discarded, not softened.

2. Improve: fix exactly the GAPs. Content no GAP touched is preserved verbatim.

3. Final: present the improved answer. Non-trivial deliverable? Include one
   runnable or checkable acceptance artifact (a test, a command, a ticked
   checklist), not just prose.

One cycle. Run a second only if step 1 produced artifact-backed GAPs;
never loop on style.
```

## When to apply it

- User asks for something where correctness is high-stakes (code, plans, analysis)
- User says "double-check", "be thorough", "think step by step", or similar
- The task has known failure modes (edge cases, missing context, false assumptions)

## When NOT to apply it

- The output is tool-verifiable: run the compiler, test suite, or grep — an executed check beats any prose critique of the same code.
- The answer is trivial — a refine pass on a one-liner adds hedging, not quality.
- You are mid-task: critique compounds in-progress misdiagnosis; refine at deliverable boundaries.

## How to use

Add the block verbatim to your prompt — before or after the main request. It works as a suffix in most cases:

> Explain the tradeoffs between B-trees and LSM trees for a write-heavy workload.
>
> 0. Criteria: list what a complete answer must cover (from my request). Generate your best answer, then:
> 1. Critique: GAP | CHECK | RESULT per criteria item and load-bearing claim.
> 2. Improve: fix exactly the GAPs; untouched content stays verbatim.
> 3. Final: present the improved answer.

## Format rules

- Keep all four steps labeled exactly: **Criteria**, **Critique**, **Improve**, **Final**
- Criteria is written before generation, from the request and conversation — never reconstructed afterward
- Every Critique line carries a CHECK naming its artifact; a gap with no CHECK is discarded, not softened
- Improve changes only what a GAP names — content no critique line touched is preserved verbatim
- Final is the clean, standalone answer the user actually reads
- One critique-improve cycle by default; a second only for artifact-backed GAPs, never for style
