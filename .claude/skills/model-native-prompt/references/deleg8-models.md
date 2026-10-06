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
| Context | 1,048,576 (`k3-256k` variant: 262,144) |
| Max output | 131,072 |
| Modality | text + image |
| Cost | 0 (local/subscription route) |
| Thinking | mode `effort`, format `kimi`, efforts `low` / `high` / `max`, **effort required**, default `high` |
| Compat | `reasoning_content` field; `supportsDeveloperRole: false` |

**Shaping**
- 131K output ceiling on a 1M window. A single large artifact fits; only DeepSeek's 384K is bigger. `k3-256k` is the small-window variant, not a bigger one.
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
| Thinking | mode `effort`; inventory lists `low` / `high` / `max`, but a live omp session on `-flash` (2026-08-24) reported `high` / `xhigh` only and rejected `low`. Treat `high` as the floor until a live session shows otherwise. |
| Compat | `supportsDeveloperRole: false`, `supportsToolChoice: false`, `supportsReasoningEffort: true`, `maxTokensField: max_tokens`, `reasoning_content` field, `requiresReasoningContentForToolCalls: true`, `requiresAssistantContentForToolCalls: true`, `extraBody.thinking: {type: enabled}` |

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

## zai GLM family — `{provider: "zai", modelId: "glm-5.3"}` / `"glm-5.3-flash"` / `"glm-5.2"`

Shared envelope: API **anthropic-messages**, reasoning-native, context 1,000,000, max output 131,072, thinking mode `anthropic-budget-effort`.

| Variant | Cost (in/out, cache read) | Modality | Efforts |
| --- | --- | --- | --- |
| `glm-5.3` | 1.4 / 4.4, 0.26 | text only | `low` / `high` / `max`, **effort required**, default `max` |
| `glm-5.3-flash` | 0.15 / 0.5, 0.03 | text + image | `low` / `high` / `max`, **effort required**, default `max` |
| `glm-5.2` | 1.4 / 4.4, 0.26 | text only | `high` / `max` |

User's first choice for deleg8 work ("best for best price", 2026-09-03): dispatch `glm-5.3-flash` for breadth and `glm-5.3` for depth, **effort `high`** on both. `max` only when the user asks for it; `low` only for trivial fan-out. `glm-5.2` is legacy.

**Shaping**
- Speaks the Anthropic Messages API, so Claude-shaped prompts transfer with the least friction of any model here — system prompt, XML-ish sectioning, and tool blocks all land. When porting a Claude prompt to a non-Claude model, this is the cheapest port.
- `anthropic-budget-effort` thinking: effort maps onto a token budget, so a bigger ask really does buy more thinking. 5.3 adds a `low` rung and defaults to `max`; always pass `high` explicitly, or every call silently runs at `max`. 5.2 has no cheap gear.
- Reasoning-native: no CoT.
- `glm-5.3-flash` is the only GLM that accepts images; the others are text only.
- INFERRED: strong at structured/agentic output and code; good default when the deliverable is a rigorous artifact rather than a wide-open exploration. Pick `-flash` for breadth at a tenth of the price; pick `glm-5.3` when one answer must be right.

---

## gpt-5.6 family — two routes, different windows

Three variants exist under **both** providers. The context window differs by route:

| Route | provider | api | Context |
| --- | --- | --- | --- |
| Direct API | `openai` | openai-responses | **1,050,000** |
| Codex | `openai-codex` | openai-codex-responses | **1,000,000** |

Max output is 128,000 on both routes. Pick `openai` when the prompt carries a large corpus; pick `openai-codex` when the work is coding inside a repo. deleg8 usage on this machine is the Codex route with `luna`.

| Variant | Cost (in/out, cache read) | Above 272K input | Modality | Thinking |
| --- | --- | --- | --- | --- |
| `gpt-5.6-luna` | 0.2 / 1.2, 0.02 | 0.4 / 1.8 | text + image | reasoning-native; mode `effort`, full ladder `low` `medium` `high` `xhigh` `max` |
| `gpt-5.6-terra` | 2 / 12, 0.2 | 4 / 18 | text + image | same ladder |
| `gpt-5.6-sol` | 4 / 20, 0.4 | 10 / 45 | text + image | same ladder |

Every variant has a `longContext` tier: once input passes 272,000 tokens, input and output prices roughly double (sol: 2.5×). Dispatch pairs: `{provider: "openai-codex", modelId: "gpt-5.6-luna"}` (swap `terra`/`sol`, or `openai` for the direct route).

**Shaping**
- All three carry the full five-rung ladder, so any of them can be swept for the cheapest rung that still solves the problem; **luna** at 0.2/1.2 is the one to sweep on.
- **terra** is the balanced default; **sol** at 4/20 (10/45 past 272K) is priced like a frontier model and should be reserved for the single hardest pass (final architecture judgment, adversarial review of a design luna produced).
- Keep the prompt under 272K input unless the corpus needs it; crossing the threshold doubles the bill for the whole call, not just the excess.
- All are reasoning-native: no CoT, no "think step by step", no forced scaffolding.
- The Responses API rewards a clear objective plus explicit output contract over role-play framing. State the artifact and its acceptance criteria; skip "you are a world-class…" preambles.
- Accept images on both routes.
- These models follow instructions literally. If a constraint is soft, mark it soft — an unmarked preference gets treated as a hard requirement.

---

## google Gemini Flash — `{provider: "google-antigravity", modelId: "gemini-3.7-flash"}`

The most-dispatched deleg8 model on this machine by an order of magnitude, and omp's default subagent model.

| Axis | Value |
| --- | --- |
| API | google-gemini-cli (antigravity route) / google-generative-ai (`google` route) |
| Reasoning-native | yes |
| Context | 1,048,576 |
| Max output | 65,536 |
| Modality | text + image |
| Cost | antigravity route 0 (subscription); `google` route 0.75 in / 3.75 out, cache read 0.075 |
| Thinking | mode `google-level`, efforts `minimal` / `low` / `medium` / `high`, **effort required**; each rung routes to its own backend id (`gemini-3.7-flash-low` / `-medium` / `-high`) |

Successor `gemini-3.8-flash` is in the inventory on both routes with the same envelope; antigravity exposes it as `gemini-3.8-flash-low` / `-medium` / `-high` / `-tiered` instead of routing by effort.

**Shaping**
- Four-rung ladder down to `minimal`, at zero marginal cost on the antigravity route: the model for sweeps, fan-out, and first passes at volume. Say the effort; it is required, and `minimal` is a different endpoint, not a parameter.
- **64K output ceiling, the lowest on this page.** Stage anything larger; do not ask for a whole spec in one call.
- Reasoning-native: no CoT.
- Accepts images on both routes.
- The `google` route is metered and has hit its AI Studio monthly cap (HTTP 429, agents finish in seconds with 0 tokens). Dispatch via `google-antigravity`; check the deleg8 log for `errorMessage` before trusting an empty result.
- INFERRED: instruction-following is literal and terse by default; ask for the artifact and its format explicitly, and mark soft preferences as soft.

---

## Cross-cutting rules for every model on this page

1. **All six families are reasoning-native.** Chain-of-Thought scaffolding degrades output. Never add it. Ask for the *conclusion* and the *artifact*; the reasoning happens internally.
2. **Genuine low gear:** gpt-5.6 (`low`/`medium`), Gemini Flash (`minimal`/`low`), GLM 5.3 (`low`), and k3 (`low`, effort required). DeepSeek's floor is `high` in practice (live session), and GLM 5.2 starts at `high`. Do not write "keep it quick" prompts for a model with no cheap rung — write a narrower task instead.
3. **Effort is mandatory** on k3, GLM 5.3, and Gemini Flash. Name it in the dispatch and in the prompt preamble. GLM 5.3 defaults to `max` if you forget.
4. **Modality gate:** k3, gpt-5.6, Gemini Flash, and `glm-5.3-flash` take images. DeepSeek, `glm-5.3`, and `glm-5.2` are text-only. Never reference visual input in a text-only prompt.
5. **Output ceiling gate:** Gemini Flash 64K, gpt-5.6 128K, k3 131K, GLM 131K, DeepSeek 384K. Size the requested artifact against the actual ceiling before writing the prompt.
6. **No developer role** on k3 or DeepSeek — write self-contained user-turn prompts, not system+user pairs.

## Refreshing this page

The inventory is local and cached. Rows are keyed by `provider_id`; the `models` column is a JSON array of capability objects. To print one model:

```
python3 -c "import sqlite3,json;db=sqlite3.connect('$HOME/.omp/agent/models.db');ms=json.loads(db.execute(\"select models from model_cache where provider_id=?\",('zai',)).fetchone()[0]);print(json.dumps(next(m for m in ms if m['id']=='glm-5.3'),indent=1))"
```

Which models deleg8 actually dispatches, ranked: `rg -o --no-filename '"model":"[^"]+"' ~/.claude/deleg8 --glob '*/*/omp/*.jsonl' | sort | uniq -c | sort -rn`. Profile whatever appears there and is missing here.

`~/.omp/agent/models.yml` holds locally declared providers and compat overrides — read capability fields only, never credentials. The inventory's effort list is not authoritative over a live session's `session.model.thinking.efforts`; when they disagree, record both, as the DeepSeek row does.
