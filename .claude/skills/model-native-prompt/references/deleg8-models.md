# Non-Claude profiles (dispatched via deleg8)

Capability rows are verbatim from the local inventory `~/.omp/agent/models.db` (table `model_cache`) and `~/.omp/agent/models.yml`. Costs are USD per 1M tokens as recorded there.

**Never read credentials out of `models.yml` into a prompt, a file, or your reply.** That file holds a plaintext API key. Capability fields only.

Dispatch pair = the `model: {provider, modelId}` object for `mcp__deleg8__spawn`. See `dispatch.md`.

**Provenance for every profile on this page: capability rows measured from the local inventory; behavioral notes inferred from those capabilities, not from a published model card.** Envelope facts (window, ceiling, modality, thinking mode, cost, compat) are quotable as fact. Personality and strength claims in the **Shaping** sections are inference — mark them `INFERRED:` if a rationale bullet rests on one. Replace an inferred note with a sourced one whenever a real model card is available.

---

## kimi/k3 — `{provider: "kimi-code", modelId: "k3"}`

| Axis | Value |
| --- | --- |
| API | openai-completions |
| Reasoning-native | yes |
| Context | 262,144 |
| Max output | 32,000 |
| Modality | text + image |
| Cost | 0 (local/subscription route) |
| Thinking | mode `kimi`, efforts `low` / `high` / `max`, **effort required**, default `high` |
| Compat | `reasoning_content` field; `supportsDeveloperRole: false` |

**Shaping**
- The tightest output ceiling in this set — **32K**. Never ask for one giant artifact. Ask for a dense spec, an outline plus one worked section, or explicitly staged parts.
- No developer role: everything goes in the user turn. Do not write a prompt that assumes a separate system/developer channel.
- Reasoning-native: no CoT scaffolding.
- Effort is mandatory in the request, so state the intended depth in the prompt preamble too (it keeps the two aligned when a human re-runs it).
- Strong on long-context synthesis relative to its size; it will use the full 262K window if you give it source material.
- Accepts images — usable when the topic involves a screenshot, diagram, or layout reference.

---

## deepseek/deepseek-v4-pro — `{provider: "deepseek", modelId: "deepseek-v4-pro"}`

| Axis | Value |
| --- | --- |
| API | openai-completions |
| Reasoning-native | yes |
| Context | 1,000,000 |
| Max output | 384,000 |
| Modality | text only |
| Cost | 0.435 in / 0.87 out; cache read 0.003625 |
| Thinking | mode `effort`, efforts `high` / `max` (min level is `high` — there is no low gear) |
| Compat | `supportsDeveloperRole: false`, `supportsToolChoice: false`, `maxTokensField: max_tokens`, `reasoningEffortMap {high→high, xhigh→max}`, `requiresReasoningContentForToolCalls: true`, `requiresAssistantContentForToolCalls: true`, `extraBody.thinking: {type: enabled}` |

**Shaping**
- **384K max output on a 1M window, at under a dollar per million in.** This is the model for prompts that legitimately ask for an enormous single artifact: a whole spec, an exhaustive enumeration, a full implementation. Say the size you want out loud — it will honor it.
- Cache read is ~120× cheaper than input. If the prompt has a large fixed preamble that will be re-run, structure it preamble-first so the cache does the work.
- Reasoning-native with **no low gear** — every call is deep. Do not add CoT, and do not apologize for a "hard" question; hardness is the operating point.
- Text only: never reference an image, screenshot, or attached diagram.
- No `tool_choice` and no developer role: write the prompt so tool use is optional and framed in prose, not forced.

---

## deepseek/deepseek-v4-flash — `{provider: "deepseek", modelId: "deepseek-v4-flash"}`

Same window (1M), same max output (384K), same compat block and thinking gears as `-pro`. Cost **0.14 in / 0.28 out**, cache read 0.0028.

**Shaping** — identical rules to `-pro`. Pick flash for breadth (many parallel passes, wide sweeps, first drafts at volume) and pro when a single answer has to be right the first time. When the user asks for "a lot of output cheaply", this is the model.

---

## zai/glm-5.2 — `{provider: "zai", modelId: "glm-5.2"}`

| Axis | Value |
| --- | --- |
| API | **anthropic-messages** |
| Reasoning-native | yes |
| Context | 1,000,000 |
| Max output | 131,072 |
| Modality | text only |
| Cost | 1.4 in / 4.4 out; cache read 0.26 |
| Thinking | mode `anthropic-budget-effort`, efforts `high` / `max` |

**Shaping**
- Speaks the Anthropic Messages API, so Claude-shaped prompts transfer with the least friction of any model here — system prompt, XML-ish sectioning, and tool blocks all land. When porting a Claude prompt to a non-Claude model, this is the cheapest port.
- `anthropic-budget-effort` thinking: effort maps onto a token budget, so a bigger ask really does buy more thinking. Only `high` and `max` exist — no cheap gear.
- Reasoning-native: no CoT.
- Text only.
- Strong at structured/agentic output and code; good default when the deliverable is a rigorous artifact rather than a wide-open exploration.

---

## gpt-5.6 family — two routes, different windows

Three variants exist under **both** providers. The context window differs by route:

| Route | provider | api | Context |
| --- | --- | --- | --- |
| Direct API | `openai` | openai-responses | **1,050,000** |
| Codex | `openai-codex` | openai-codex-responses | **272,000** |

Max output is 128,000 on both routes. Pick `openai` when the prompt carries a large corpus; pick `openai-codex` when the work is coding inside a repo.

| Variant | Cost (in/out) | Modality | Thinking |
| --- | --- | --- | --- |
| `gpt-5.6-luna` | 1 / 6 | text + image | reasoning-native; mode `effort`, full ladder `low` `medium` `high` `xhigh` `max` |
| `gpt-5.6-terra` | 2.5 / 15 | text + image | same family, mid tier |
| `gpt-5.6-sol` | 5 / 30 | text + image | same family, top tier |

Dispatch pairs: `{provider: "openai", modelId: "gpt-5.6-luna"}` (swap `terra`/`sol`, or `openai-codex` for the Codex route).

**Shaping**
- **luna** is the only one in this family with the full five-rung effort ladder recorded, including `low` and `medium` — it is the model to sweep effort on when you want to find the cheapest rung that still solves the problem.
- **terra** is the balanced default; **sol** at 5/30 is priced like a frontier model and should be reserved for the single hardest pass (final architecture judgment, adversarial review of a design luna produced).
- All are reasoning-native: no CoT, no "think step by step", no forced scaffolding.
- The Responses API rewards a clear objective plus explicit output contract over role-play framing. State the artifact and its acceptance criteria; skip "you are a world-class…" preambles.
- Accept images on both routes.
- These models follow instructions literally. If a constraint is soft, mark it soft — an unmarked preference gets treated as a hard requirement.

---

## Cross-cutting rules for every model on this page

1. **All five families are reasoning-native.** Chain-of-Thought scaffolding degrades output. Never add it. Ask for the *conclusion* and the *artifact*; the reasoning happens internally.
2. **Only Claude Fable/Opus/Sonnet and gpt-5.6 have a genuine low gear.** DeepSeek and GLM start at `high`; k3 has `low` but requires an explicit effort. Do not write "keep it quick" prompts for a model with no cheap rung — write a narrower task instead.
3. **Modality gate:** k3 and gpt-5.6 take images. DeepSeek and GLM are text-only. Never reference visual input in a text-only prompt.
4. **Output ceiling gate:** k3 32K, GLM 131K, gpt-5.6 128K, DeepSeek 384K. Size the requested artifact against the actual ceiling before writing the prompt.
5. **No developer role** on k3 or DeepSeek — write self-contained user-turn prompts, not system+user pairs.

## Refreshing this page

The inventory is local and cached. To confirm a row or add a model:

```
sqlite3 ~/.omp/agent/models.db "select value from model_cache limit 1"
```

The single table is `model_cache`; each row holds a JSON blob of provider→model capability objects. `~/.omp/agent/models.yml` holds locally declared providers and compat overrides — read capability fields only, never credentials.
