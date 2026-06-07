# Headroom — Python LLM-Input Proxy

## What it is

Long-running FastAPI proxy that sits between an LLM client (Claude Code, Cursor, etc.) and the upstream provider (Anthropic, OpenAI, LiteLLM). On each request it classifies message content, picks compressors, applies cache-aware transforms, and forwards a smaller prompt — saving input tokens while preserving provider prefix-cache hits.

- **Source**: `headroom-ai` (uv tool — `~/.local/bin/headroom`)
- **Lang**: Python 3.12
- **Listens**: `localhost:8787` (FastAPI + Starlette via uvicorn)
- **Persists**: `~/.headroom/proxy_savings.json`, `~/.headroom/logs/proxy.log`, `~/.headroom/toin.json`
- **Footprint**: ~125K LOC in `site-packages/headroom/`
- **Position in suite**: pre-LLM-input. Acts on the full prompt about to leave the agent for the upstream API.

## Top-level package layout

```
headroom/
├── __init__.py             11 KB
├── _version.py
├── cli.py                  thin shim → cli/ package
├── client.py               36 KB    HTTP client (httpx)
├── shared_context.py       6.5 KB
│
├── cli/                    CLI subcommands
├── proxy/                  ── HTTP server (the daemon)
│   ├── server.py           2906 LOC    FastAPI app + lifespan + create_app()
│   ├── handlers/
│   │   ├── anthropic.py
│   │   └── openai.py       2551 LOC
│   ├── stage_timer.py      dual-base sync+async context manager
│   ├── savings_tracker.py  atomic JSON writer
│   └── ...
│
├── transforms/             ── COMPRESSION PIPELINE (the heart)
│   ├── pipeline.py         orchestrator
│   ├── content_router.py   2130 LOC    Magika-based per-msg classifier
│   ├── code_compressor.py  2013 LOC
│   ├── log_compressor.py
│   ├── smart_crusher.py    3669 LOC    biggest single module
│   ├── progressive_summarizer.py
│   ├── rolling_window.py
│   ├── cache_aligner.py    preserve provider prefix-cache
│   └── ...
│
├── compression/            ── content-aware primitives
│   ├── detector.py         Magika integration
│   ├── universal.py        UniversalCompressor
│   ├── masks.py            structure masks
│   └── handlers/
│
├── cache/
│   ├── compression_cache.py
│   ├── compression_feedback.py
│   ├── compression_store.py
│   ├── prefix_tracker.py
│   ├── semantic.py
│   ├── anthropic.py
│   ├── openai.py
│   ├── google.py
│   └── backends/
│
├── prediction/             ── ML feature extraction
│   ├── feature_extractor.py 2529 LOC   gzip + entropy + structural features
│   └── __init__.py
│
├── backends/               ── upstream adapters
├── ccr/                    ── canonical content retrieval (headroom_retrieve)
├── config.py
├── dashboard/              ── HTML dashboard
├── evals/
├── graph/
├── hooks.py
├── image/
├── observability/
└── compress.py
```

## Async/sync posture

| Counter | Value |
|---|---|
| `async def` | 18 |
| `def` (sync) | 806 |
| Async ratio | ~2% |

Async only at the FastAPI request boundary (request reading, upstream HTTP via `httpx`, streaming). Compression pipeline below is **sync**. Right call — the work is dominated by upstream LLM RTT (>1 s typical), so freeing the event loop matters at the I/O edge but not below it. Internal compressors are CPU-bound in single-thread contexts; making them async would only add overhead.

## Hot-path architecture (AST graph)

```
client (e.g. Claude Code)
   │  HTTP POST /v1/messages or /v1/chat/completions
   ▼
proxy/server.py FastAPI route
   │
   ├─ proxy/handlers/{anthropic,openai}.py
   │    parse provider-specific request shape into uniform structure
   │
   ├─ transforms/pipeline.py (orchestrator)
   │    │
   │    ├─ FOR EACH message:
   │    │    └─ transforms/content_router.py
   │    │         compression/detector.py — Magika classify
   │    │         pick compressor by content type
   │    │
   │    ├─ stages (each timed via proxy/stage_timer.py):
   │    │    ├─ deep_copy
   │    │    ├─ compression_first_stage
   │    │    │    ├─ transforms/code_compressor.py
   │    │    │    ├─ transforms/log_compressor.py
   │    │    │    ├─ transforms/smart_crusher.py
   │    │    │    └─ transforms/progressive_summarizer.py
   │    │    ├─ memory_context (optional headroom_retrieve injection)
   │    │    ├─ rolling_window prune
   │    │    └─ cache_aligner (preserve provider prefix-cache boundary)
   │    │
   │    └─ produce optimized request body
   │
   ├─ backends/{anthropic,litellm}.py
   │    httpx call to upstream provider
   │    streaming response → handler → client
   │
   ├─ proxy/savings_tracker.py
   │    INPUT: tok_before, tok_after, tok_saved, cost_in, cost_saved
   │    atomic write to ~/.headroom/proxy_savings.json
   │
   └─ structured log emission
        ├─ STAGE_TIMINGS line: JSON sibling, full per-stage breakdown
        └─ PERF line: kv summary (model, msgs, tok_*, cache_*, opt_ms, transforms)
        both share request_id (e.g. hr_<unix>_<seq>) for pairing
```

## On-disk artefacts

### `~/.headroom/proxy_savings.json`

```json
{
  "schema_version": 2,
  "lifetime": {
    "requests": 1461,
    "tokens_saved": 12635268,
    "compression_savings_usd": 52.180112,
    "total_input_tokens": 105369726,
    "total_input_cost_usd": 87.204756
  },
  "display_session": {
    "requests": 112,
    "tokens_saved": 61012,
    "compression_savings_usd": 0.30368,
    "savings_percent": 1.98,
    "started_at": "2026-04-26T08:04:02Z",
    "last_activity_at": "2026-04-26T08:27:20Z"
  },
  "history": [
    { "timestamp": "...", "total_tokens_saved": ..., "compression_savings_usd": ... },
    ...
  ]
}
```

Owned by `savings_tracker.py`. Atomic-rename writes (`tempfile.mkstemp` + `shutil.move`). Do not write from outside.

### `~/.headroom/logs/proxy.log` — paired-line format

```
2026-04-26 04:27:16,862 - headroom.proxy - INFO - [hr_1777192036_000109] STAGE_TIMINGS {"event": "stage_timings", "path": "anthropic_messages", "request_id": "...", "session_id": "...", "stages": {"pre_upstream_wait": 0.002, "read_request_json": 0.76, "deep_copy": 0.05, "compression_first_stage": 30.10, "memory_context": null, "upstream_connect": null, "upstream_first_byte": null, "total_pre_upstream": 31.62}}
2026-04-26 04:27:20,066 - headroom.proxy - INFO - [hr_1777192036_000109] PERF model=claude-opus-4-7 msgs=4 tok_before=18561 tok_after=18254 tok_saved=307 cache_read=54170 cache_write=353 cache_hit_pct=99 opt_ms=31 transforms=router:noop
```

The two lines pair via the bracketed `request_id`. Tail with both regexes; pair by request_id; emit one combined event. ccmanager does this in `apps/proxy/src/lib/external-feeds/headroom-adapter.js`:

```js
const PERF_RE = /\[(?<reqId>[^\]]+)\] PERF (?<kv>.+)$/
const STAGE_RE = /\[(?<reqId>[^\]]+)\] STAGE_TIMINGS (?<json>\{.*\})$/
```

### `~/.headroom/toin.json`

Token-input statistics. Less stable schema than `proxy_savings.json`; treat as advisory.

## Notable patterns worth stealing

### 1. Dual-base sync+async context manager (`proxy/stage_timer.py`)

```python
class StageMeasurement(
    AbstractContextManager["StageMeasurement"],
    AbstractAsyncContextManager["StageMeasurement"],
):
    """Both `with timer.measure(...):` and `async with timer.measure(...):` work."""
```

One instrumentation API serves sync compressors and async I/O code paths. Avoids the duplicated-API trap. Steal anywhere instrumentation needs to span both worlds.

### 2. Paired log lines (PERF + STAGE_TIMINGS)

Flat kv summary line (greppable, machine-parseable) + JSON detail line (full structure). Same request_id. Cheap log tail can read either; full tracer joins them. Mirror in any pipeline you instrument — including ccmanager's own interceptor pipeline (currently emits one event per interceptor; would benefit from a per-request summary line).

### 3. Atomic JSON counter via `tempfile.mkstemp` + `shutil.move`

Single-writer durable state without sqlite. `savings_tracker.py` writes the entire `proxy_savings.json` atomically each update. Cheap, durable, queryable by anything that reads JSON. Use anywhere you have one writer and JSON-readable consumers.

### 4. Magika content-type ML routing (`transforms/content_router.py`)

Google's Magika model classifies each message body (code vs log vs prose vs JSON vs ...). Compressor selected per-classification. Avoids the "one compressor, all content" trap. Worth borrowing whenever you have a per-content-type processing decision.

### 5. Provider prefix-cache alignment (`transforms/cache_aligner.py`)

Both Anthropic and OpenAI offer prefix caching keyed on the leading bytes of the prompt. Naive compression invalidates the prefix and tanks cache hit rate. Headroom's aligner only modifies content **after** the cached prefix boundary — so compression and cache savings stack instead of fighting. Critical pattern for any LLM-input transformation system.

### 6. Stage timing as a graph, not a stopwatch

`stage_timer.py` produces `dict[str, float]` of millisecond durations. Each stage is a key. Concurrent `measure(...)` calls each own their own entry. Lets observability tools render any waterfall they like. Mirror in interceptor pipelines.

## Why Python is the right choice for Headroom

| Constraint | Why Python wins |
|---|---|
| Magika + ML feature extraction | Python-native; Rust equivalents are immature |
| LiteLLM, Anthropic SDK, OpenAI SDK | Python-first ecosystem |
| Tokenization libs (tiktoken, transformers) | Python-mature |
| Long-running daemon | Startup amortized; GIL doesn't bite I/O-bound async edge |
| Net I/O bound (LLM RTT >> 1s) | async at boundary is sufficient; sync below is fine |
| Contributor base | LLM tool community lives in Python |

If Headroom were Rust, it would lose Magika, lose tiktoken, lose half its compressors, lose contributor flow. Wrong tool for this job.

## How ccmanager (Observer) integrates Headroom

Two adapters in `apps/proxy/src/lib/external-feeds/`:

```js
// headroom-adapter.js
createHeadroomAdapter()
  .readProxySavings()              // parse ~/.headroom/proxy_savings.json
  .tailProxyLog(onPerfLine)        // watch ~/.headroom/logs/proxy.log,
                                   // pair STAGE_TIMINGS + PERF lines via request_id

// headroom-tail.js
startHeadroomTail({ adapter, db, broadcast })
  // each parsed PERF row → INSERT INTO traces (route, request_json, ...)
  // emit broadcastProxyEvent({ type: 'trace_persisted', source: 'headroom', ... })
```

Feeds Observer's `/api/proxy/cache/stats` (lifetime + display_session), per-model rollup (from `model=` field), rolling cache-hit-rate samples (from `cache_hit_pct` field), and the live traces table. SSE pushes `trace_persisted` events to the dashboard.

Graceful empty: returns `null` if `proxy_savings.json` missing; tailer no-ops if log file absent.

## Pitfalls when integrating Headroom

- **Headroom may not be running**: it's a daemon. `proxy_savings.json` may exist but be stale; log may not be advancing. Treat absence as zero, not error.
- **Naive line splitting fails**: `STAGE_TIMINGS` JSON can be long; logger formatting can wrap or escape. Use the bracketed-request-id regex pattern, not "split on space."
- **`STAGE_TIMINGS` arrives before `PERF`**: hold STAGE_TIMINGS in a small map keyed by request_id; emit when PERF arrives. Headroom sometimes sets timings keys to `null` (e.g. `upstream_connect: null` when streaming) — preserve as-is.
- **Don't write `proxy_savings.json`**: atomic-rename writer assumes single owner. Outside writes get clobbered.
- **Schema version**: respect `schema_version` field; it's currently 2; future versions may add fields.
- **httpx is the upstream client** — Headroom does not pass through SSE byte-for-byte; it parses + re-emits. Latency contribution is non-zero. If you build a tracer, account for the proxy's own `opt_ms`.
