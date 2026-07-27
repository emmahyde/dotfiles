---
name: adversarial-review
description: Run an adversarial design review against a plan, spec, or architecture document. Challenges assumptions, design choices, tradeoffs, and failure modes. Model-agnostic — use any capable LLM. Use when user says "adversarial review", "challenge this design", "poke holes in this plan", "red-team this spec", "pressure-test the architecture", or asks another model to critique work. Ingest results into ~/llmwiki/reviews/.
---

# Adversarial Review

## What it is

An adversarial review is a critique-only pass over a design document, plan, or spec. The reviewer's sole job is to find weaknesses — it MUST NOT suggest fixes, offer praise, or soften its findings. The output is raw critique, verbatim.

## Prompt template

```
ADVERSARIAL DESIGN REVIEW of [document description]. Challenge every assumption, design choice, and tradeoff. Question whether [key architectural claim] is the right approach. Scrutinize [comma-separated concern domains]. Output ONLY the critique — no suggestions, no fixes, no praise.
```

**Customize the brackets:**
- `[document description]` — what is being reviewed (e.g. "the ECS graph + maintenance implementation plan")
- `[key architectural claim]` — the central thesis to challenge (e.g. "ECS-authoritative news lineage", "the projection pattern", "the wave decomposition strategy")
- `[concern domains]` — specific areas to scrutinize (e.g. "mirror parity for drift risk, session lifecycle for failure modes, hidden coupling across waves, coverage and gating quality")

**Common concern domains:** ECS authority, projection patterns, wave decomposition, mirror parity, session lifecycle, serialization contracts, UI architecture, performance model, test coverage, error handling, concurrency, data flow direction, immutability contracts, compilation boundaries, dependency direction.

**Constraint clauses to add as needed:**
- `Output ONLY the critique — no suggestions, no fixes, no praise.`
- `Rank findings by severity.`
- `Cite specific file:line or plan section for each finding.`
- `Group findings by category.`

## Workflow

1. **Identify the document** — plan, spec, architecture doc, or working tree. If a file, read it to confirm scope.
2. **Customize the prompt** — fill the template's brackets for the specific review.
3. **Route to a capable model** — any LLM with strong reasoning. Prefer:
   - `codex exec "…" < document.md` (gpt-5.3-codex-spark, requires git repo)
   - `agent(prompt, agent="oracle")` in eval (Opus)
   - `completion(prompt, model="slow")` in eval (best available)
   - Direct paste into another chat interface
4. **Run in background** unless the document is tiny (under ~50 lines).
5. **Return output verbatim** — never paraphrase, summarize, or add commentary.
6. **Ingest into wiki** — write to `~/llmwiki/reviews/adversarial-review-[slug]-[date].md`:
   - Date, model used, source document path
   - The exact prompt sent
   - All findings verbatim
   - Tags: `#adversarial-review` plus domain tags

## File naming

```
~/llmwiki/reviews/adversarial-review-[descriptive-slug]-[YYYY-MM-DD].md
```

Example: `adversarial-review-ecs-graph-maintenance-plan-2026-07-26.md`
