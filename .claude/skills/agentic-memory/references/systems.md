# Memory System Profiles

## Mem0

**Approach:** Per-turn selective extraction. LLM identifies salient facts from the turn, deduplicates against existing store, indexes to vector DB with optional graph layer (Mem0g).

**Storage:** 19 vector backends (Qdrant, Pinecone, Chroma, etc.) + optional Neo4j graph layer.

**Retrieval:** Multi-signal fusion — semantic embedding + BM25 + entity match. Production adds metadata scoping + reranker.

**Benchmarks (2025):**
- LoCoMo: 91.6
- LongMemEval: 93.4
- p95 retrieval latency: 1.44s vs 17.12s full-context (91% reduction)
- Token cost: ~7k tokens/retrieval vs 25k+ full-context (~72% reduction)
- Accuracy tradeoff: ~6% loss vs full-context at those token savings
- BEAM-1M: 64.1 / BEAM-10M: 48.6

**Architecture note:** Mem0g (graph variant) adds ~1.5% accuracy on multi-hop reasoning but at higher latency. Base Mem0 with vector-only is the better default for most use cases.

**Best for:** Production API agents, multi-user systems, when you don't want to self-host a vector DB.

**Failure modes:**
- LLM extractor drops relevant facts during compression (~6% accuracy gap vs full-context)
- No native temporal fact invalidation — stale facts stay high-confidence
- Extraction quality depends on the model used; cheap models degrade it significantly

**Source:** [arxiv 2504.19413](https://arxiv.org/abs/2504.19413), [mem0.ai/research](https://mem0.ai/research)

---

## Zep / Graphiti

**Approach:** Temporal knowledge graph. Every fact carries a validity window. When new information contradicts an existing fact, the old fact is invalidated (not deleted) — preserving historical queryability.

**Storage:** Neo4j-backed knowledge graph with entity nodes, relationship edges, and temporal validity metadata. No LLM summarization required for indexing.

**Retrieval:** BM25 + semantic embeddings + graph traversal. Entity resolution links facts to named entities.

**Benchmarks (2025):**
- DMR (Deep Memory Retrieval): 94.8% vs MemGPT 93.4%
- LongMemEval: 90% latency reduction vs baseline
- No published token cost breakdown

**Best for:** Facts that change over time (user preferences, project state), entity-rich domains, systems where you need to query "what was true about X at time T".

**Failure modes:**
- Entity resolution errors create duplicate nodes (e.g., "Emma" vs "Emma Hyde" as separate entities)
- Graph construction adds latency on write
- Significant operational complexity vs SQL/vector approach
- Overkill for simple session recall

**Source:** [arxiv 2501.13956](https://arxiv.org/abs/2501.13956)

---

## Letta (MemGPT)

**Approach:** OS-inspired memory paging. Agent has in-context "core memory" (RAM) and out-of-context "archival/recall memory" (disk). The agent itself decides via tool calls when to page memory in or out.

**Storage:** Filesystem + structured archival. Agent issues grep/search calls to retrieve.

**Retrieval:** Agent-driven tool calls — the model decides what to search for and when.

**Benchmarks (2025):**
- Internal LoCoMo: 74.0% (filesystem+grep agent — beat Mem0g at 68.5%)
- The benchmark result from Letta's own study; not independently replicated

**Key finding:** A simple filesystem+grep approach outperformed Mem0g on LoCoMo. Letta's conclusion: the bottleneck is agent reasoning quality, not storage architecture. The implication is to not over-invest in storage complexity.

**Best for:** Maximum transparency and debuggability, research, agents that need to reason explicitly about their own memory.

**Failure modes:**
- Agent decides what to offload — poor decisions cause context thrashing
- High token cost on complex multi-hop recall (agent issues many tool calls)
- Heartbeat mechanism (old MemGPT) was fragile; v1 rearchitecture dropped it

**Source:** [letta.com benchmark blog](https://www.letta.com/blog/benchmarking-ai-agent-memory)

---

## OpenAI ChatGPT Memory

**Approach:** Flat key-value list of saved facts + recent conversation summaries, both injected verbatim to system prompt. No semantic retrieval — everything gets injected regardless of query relevance. Since April 2025: also references past conversations directly.

**Storage:** Flat key-value store. No vector DB, no graph.

**Retrieval:** None — all saved memories go into context on every turn.

**Benchmarks:** No published numbers; internal system.

**Best for:** Simple personal assistants with small total memory footprint (<50 facts). Prototypes. Systems where you want zero retrieval complexity.

**Failure modes:**
- Scales poorly — context bloats as memories accumulate; no staleness detection
- No relevance filtering — irrelevant memories consume context budget
- No public API; can't integrate into non-ChatGPT products

---

## claude-mem

**Approach:** 5-hook lifecycle (SessionStart, UserPromptSubmit, PostToolUse, Summary/Stop, SessionEnd). PostToolUse fires on every tool call → async worker queues and compresses via Claude Agent SDK. Stop hook generates per-turn summary from last assistant message.

**Storage:** SQLite (FTS5 for structured/temporal) + ChromaDB (semantic search). Session cursor tracking via `memorySessionId`.

**Retrieval:** 3-layer: FTS5 keyword → vector similarity → hydrate from SQLite. MCP tool (`mem-search`) exposes search to the agent.

**Benchmarks (internal, from docs):**
- Smart Explore MCP (separate feature): 17.8x fewer tokens vs Glob+Grep+Read on discovery; 19.4x on targeted reads
- 3-layer search workflow: ~10x token savings vs full injection
- File-read gate: 75-97% token savings vs reading full files
- Progressive disclosure: 100% signal (vs 6% for upfront RAG injection)
- v11 tier routing: ~52% cost reduction on SDK agent usage

**Known issues (from CHANGELOG):**
- PostToolUse fires 100+ times/session → creates observation log, not memory
- Worker backlog under high load; observations lost if worker crashes
- Chroma runaway bug (v10): 641 Python processes in 5 min, 64GB virtual memory
- Circuit breaker: 3 SDK failures → 60s cooldown
- Dedup: SHA256 hash, 30s window — catches exact but not semantic duplicates

**Best for:** Claude Code specifically. Deep integration with Claude Code hook lifecycle.

**Not recommended for:** Non-Claude Code platforms. The per-tool-call architecture is fundamentally log-like.

---

## A-MEM

**Approach:** Zettelkasten-inspired dynamic note linking. Each memory generates structured attributes (description, keywords, tags). On each new memory insertion, the entire network is re-evaluated for new connections — evolving link weights.

**Storage:** Network of linked notes with keyword/tag index.

**Benchmarks:** NeurIPS 2025 accepted; no head-to-head comparison with Mem0/Zep on LoCoMo or LongMemEval published as of writing.

**Best for:** Long-horizon agents where memory relationships matter more than individual facts. Research settings.

**Failure modes:**
- Re-linking entire network on each write is expensive at scale
- No published latency data
- No production deployment story

**Source:** [arxiv 2502.12110](https://arxiv.org/abs/2502.12110)

---

## Benchmark Summary

| System | LoCoMo | LongMemEval | DMR | Token Cost vs Full-Context | Latency |
|--------|--------|-------------|-----|---------------------------|---------|
| Mem0 | 91.6 | 93.4 | — | ~72% reduction | p95 1.44s |
| Zep/Graphiti | — | — | 94.8% | — | 90% reduction |
| Letta (fs+grep) | 74.0 | — | — | — | — |
| Mem0g | 68.5 | — | — | — | — |
| MemGPT | — | — | 93.4% | — | — |

**Caveat:** These benchmarks use different evaluation setups and are partially self-reported. Letta's result (fs+grep > Mem0g) directly contradicts what you'd expect from the architecture complexity, which is why it matters — it suggests agent reasoning quality is the actual bottleneck.
