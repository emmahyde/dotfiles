# Claude-family profiles

Source: bundled `claude-api` skill (Anthropic first-party API). Dispatch for these models is the native **Agent tool** with a `model` override, not deleg8 — see `dispatch.md`.

Effort is `output_config: {effort: low|medium|high|xhigh|max}`, default `high`. It controls how much thinking the model spends, **not** how long the visible answer is. Prose length is a prompting lever, never an effort lever.

---

## Claude Fable 5 — `claude-fable-5`

| Axis | Value |
| --- | --- |
| Cost | $10 in / $50 out per 1M |
| Context | 1M (default *and* max) |
| Max output | 128K |
| Thinking | **Always on.** Omit the `thinking` param entirely |
| Effort ladder | `low` … `max` |
| Modality | text + image |
| Agent override | `model: "fable"` |

**API hard edges**
- Both `thinking: {type:"disabled"}` and `{type:"enabled", budget_tokens:N}` return **400**.
- Raw chain of thought is never returned. `display` defaults to `"omitted"`; `"summarized"` yields a summary only.
- No assistant prefill.
- Requires 30-day retention — zero-data-retention orgs get a 400 on every request.
- Check `stop_reason: "refusal"` and `stop_details` *before* reading `content`.
- Single requests can run many minutes. Stream, and leave server-side fallbacks opted in.

**Prompt shaping — this is the model the naive approach hurts most**
- **Do not enumerate steps.** Prompts written for earlier models are usually too prescriptive and measurably *reduce* Fable's output quality. State the goal and the constraints; let it choose the path.
- **Give the reason behind the request.** Fable performs better when it knows why the work matters — the constraint that motivated it, the audience, what failure would look like.
- **Give it a memory surface.** Even a plain `.md` scratch file to write into raises quality on long tasks. Name the path in the prompt.
- **Say what "big" means.** It will take an ambitious frame if you grant one explicitly (invariants to invent, orthodoxies it may discard, the ceiling of the design space).
- Ask for *parallel asynchronous* exploration when the task decomposes — it is unusually strong at fanning out independent lines of work.
- Watch for: degraded readability in long agentic sessions, rare early stopping, and "context anxiety" — counter both by stating that the budget is ample and that finishing thoroughly beats finishing fast.
- Sweep `low`/`medium` before assuming `max`; on open-ended design work the extra depth is often indistinguishable.

**Never add to a Fable prompt:** "think step by step", numbered procedures for reasoning, "first… then… finally…" scaffolding, self-verification checklists.

---

## Claude Mythos 5 — `claude-mythos-5`

Identical capabilities, pricing, limits, and API behavior to Fable 5. Project Glasswing only. Apply the Fable 5 shaping rules verbatim.

---

## Claude Opus 5 — `claude-opus-5`

| Axis | Value |
| --- | --- |
| Cost | $5 in / $25 out per 1M (fast mode $10/$50, Claude API only) |
| Context | 1M |
| Max output | 128K |
| Thinking | On by default; `{type:"disabled"}` allowed **only** at effort ≤ `high` (400 at `xhigh`/`max`) |
| Effort ladder | full `low` … `max` |
| Agent override | `model: "opus"` |

- Prompt cache minimum is 512 tokens.
- Fast mode: `speed: "fast"` plus beta header `fast-mode-2026-02-01`.

**Prompt shaping**
- **Delete verification instructions.** Opus 5 self-verifies; telling it to check its work produces redundant narration, not more correctness.
- It writes longer visible responses and narrates more. If you want terse output, say so in the prompt — do not reach for a lower effort.
- It expands scope on its own. State the boundary explicitly when the boundary matters.
- It delegates to subagents readily. If you don't want a fleet, give an explicit cap ("do this yourself; no subagents").
- It over-narrates self-corrections; "don't recap corrections, just apply them" pays for itself.

---

## Claude Sonnet 5 — `claude-sonnet-5`

| Axis | Value |
| --- | --- |
| Cost | $3 in / $15 out per 1M ($2/$10 intro through 2026-08-31) |
| Context | 1M |
| Max output | 128K |
| Thinking | Adaptive, on by default |
| Effort ladder | full, including `xhigh` |
| Agent override | `model: "sonnet"` |

- New tokenizer: roughly **30% more tokens** than Sonnet 4.6 for the same text. Budget accordingly when the prompt is large.
- High-resolution vision up to 2576px.
- The default pick when the task is well-specified and the win is throughput, not ambition.

---

## Claude Haiku 4.5 — `claude-haiku-4-5`

| Axis | Value |
| --- | --- |
| Cost | $1 in / $5 out per 1M |
| Context | 200K |
| Max output | 64K |
| Agent override | `model: "haiku"` |

- The one Claude in this set where context is genuinely scarce — do not paste a large corpus.
- Give it fully specified, bounded work. It is not the model for "think big picture".

---

## Reaching Claude models through deleg8 instead

`openrouter` and `zenmux` both expose `anthropic/claude-fable-5`, `anthropic/claude-opus-5`, `anthropic/claude-sonnet-5`, `anthropic/claude-haiku-4.5`, plus `-fast` variants; `zenmux` additionally has `anthropic/claude-fable-5-free`. Prefer the native Agent tool for Claude models — the proxies can lag on API behavior (thinking params, effort field) and the shaping rules above assume first-party semantics.
