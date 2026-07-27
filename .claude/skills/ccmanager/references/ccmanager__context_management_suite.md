# ccmanager (Observer) — Context Management Suite

## What it is

Local-first JS dashboard that unifies RTK + Headroom + Memesis (and, by extension, mex-style scaffold tooling) into one surface. Reads each tool's on-disk artefacts via read-only adapters, persists its own traces in `apps/data/observer.db`, and serves a Vite SPA + Hono backend.

- **Repo**: `$HOME/projects/ccmanager/`
- **Stack**: pnpm monorepo — `apps/web` (Vite + React 18 + React Router v7 + TanStack Query + Radix Themes + Tailwind + cmdk + Zustand + Cytoscape + react-force-graph) + `apps/proxy` (Hono + better-sqlite3 + sqlite-vec) + `packages/shared`
- **Lang**: JavaScript (no TypeScript — explicit decision)
- **Listens**: `localhost:5173` (web) + `localhost:3001` (proxy)
- **Persists**: `apps/data/observer.db` (sqlite via better-sqlite3)
- **Style enforced via ESLint**: const-arrow only (no `function` declarations), no `class` declarations, 2-space indent, no semicolons, single quotes, kebab-case files

## Top-level layout

```
ccmanager/
├── apps/
│   ├── web/                Vite SPA — 8 surfaces (Wave 3)
│   │   └── src/routes/{dashboard,memory,traces,proxy,knowledge,evals,settings,schedules}/
│   ├── proxy/              Hono backend
│   │   └── src/
│   │       ├── server.js               app + interceptor pipeline + /v1/messages route
│   │       ├── index.js                @hono/node-server entry, port 3001
│   │       ├── routes/                 8 route modules mounted under /api/<surface>
│   │       │   └── proxy-api.js        broadcastProxyEvent + SSE + cache/stats + interceptors
│   │       ├── lib/
│   │       │   ├── sse.js              createSseStream + createSseController factories
│   │       │   ├── interceptor-pipeline.js
│   │       │   ├── interceptor-stats.js   in-memory rolling counters
│   │       │   ├── litellm-client.js
│   │       │   ├── memesis-bridge.js   read-only memesis sqlite bridge
│   │       │   ├── headroom-tail.js    PERF/STAGE_TIMINGS log tail → traces
│   │       │   ├── migrations.js
│   │       │   └── external-feeds/
│   │       │       ├── headroom-adapter.js
│   │       │       ├── rtk-adapter.js
│   │       │       └── index.js
│   │       └── middleware/
│   │           ├── proxy-forward.js    LiteLLM bridge
│   │           ├── hot-reload.js       createHotReloader factory
│   │           └── interceptors/
│   │               ├── pii-redact.js
│   │               ├── cache-check.js
│   │               ├── inject-ctx.js
│   │               ├── bias-check.js
│   │               ├── log.js
│   │               └── shape-oai-compat.js
│   └── data/observer.db    sqlite — traces, settings, api_keys
├── packages/shared/        @observer/shared — schema, db helpers, proxy-events
├── references/design/      source design bundle (read-only)
└── .context/               CONTEXT + PLAN + DISCUSSION_LOG + SEED docs
```

## Position in the suite

```
                                                LLM
                                                 ▲
                                                 │   ┌─────────┐
                                                 ├──►│Headroom │ (Python, FastAPI, port 8787)
                                                 │   │ proxy   │  → ~/.headroom/proxy_savings.json
                                                 │   └─────────┘  → ~/.headroom/logs/proxy.log
                                                 │
   shell                       Claude Code       │
     │                              │            │
     ▼                              ▼            │
   ┌─────┐                     ┌──────────┐     │
   │ RTK │ filters tool        │ memesis  │ injects memories at session start
   │     │ output              │ plugin   │     │
   └──┬──┘                     └────┬─────┘     │
      │                             │           │
      ▼                             ▼           │
   ~/Library/Application Support/   ~/.claude/  │
   rtk/history.db                   memory/     │
                                    index.db    │
                                          ╲    ╱
                                           ╲  ╱
                                            ▼▼
                       ┌────────────────────────────────────┐
                       │  ccmanager (Observer) — port 3001  │
                       │  - reads RTK history.db            │
                       │  - reads ~/.headroom/* via tail    │
                       │  - reads memesis index.db          │
                       │  - writes apps/data/observer.db    │
                       └────────────────────────────────────┘
                                       │
                                       ▼
                            web (Vite, port 5173)
```

ccmanager is **orthogonal** — sits beside the chain, observes, doesn't intercept. It does run its own optional `/v1/messages` interceptor pipeline (Wave 4), but that's separate from the read-only feeds.

## Adapter shapes (read-only, graceful-empty)

| Adapter | Source of truth | Returns null on |
|---|---|---|
| `lib/external-feeds/rtk-adapter.js` | `~/Library/Application Support/rtk/history.db` | db missing, schema mismatch |
| `lib/external-feeds/headroom-adapter.js` | `~/.headroom/proxy_savings.json` + `~/.headroom/logs/proxy.log` | files missing |
| `lib/memesis-bridge.js` | `~/.claude/memory/index.db` (or per-project) | db missing |
| (future) mex feed | `<project>/.mex/*.md` (drift JSON) | scaffold absent |

All four follow the same factory pattern:

```js
const createXAdapter = ({ /* config */ } = {}) => {
  let _db = null
  let _tried = false
  const getDb = () => { if (_tried) return _db; _tried = true; _db = openDb(...); return _db }
  const safeQuery = (fn, fallback) => { try { return fn(getDb()) ?? fallback } catch { return fallback } }
  return { method1, method2, paths: { ... } }
}
```

This pattern is the suite's contract for external-data integration. Copy when adding a new feed.

## Route map (current — post Wave 5)

| Path | Handler | Source |
|---|---|---|
| `/api/dashboard/*` | `routes/dashboard.js` | composed |
| `/api/memory/*` | `routes/memory.js` | memesis-bridge |
| `/api/traces/*` | `routes/traces.js` | apps/data/observer.db |
| `/api/proxy/cache/stats` | `routes/proxy-api.js` | headroom + RTK + own counters |
| `/api/proxy/interceptors` | `routes/proxy-api.js` | interceptor-stats + headroom transforms rollup |
| `/api/proxy/routes` | `routes/proxy-api.js` | settings.proxy_routes |
| `/api/proxy/live/sse` | `routes/proxy-api.js` | SSE — proxy_event stream |
| `/api/knowledge/*` | `routes/knowledge.js` | repomix + ast-grep ingest |
| `/api/evals/*` | `routes/evals.js` | (Wave 7+ memesis eval wiring) |
| `/api/settings/*` | `routes/settings.js` | apps/data/observer.db settings table + onHotReload |
| `/api/schedules/*` | `routes/schedules.js` | (Wave 8+) |
| `POST /v1/messages` | `server.js` | own interceptor pipeline → LiteLLM forward |

## Event stream contract

`broadcastProxyEvent(event)` from `routes/proxy-api.js` is the central event bus. Event shapes (defined in `packages/shared/src/proxy-events.js`):

```
'interceptor_run'    — { type, name, phase, ts, latencyMs, route, traceId }
'cache_hit'          — { type, name, phase, ts, latencyMs, cacheKey }
'hot_reload'         — { type, ts }
'hot_reload_applied' — { type, ts }
'trace_persisted'    — { type, ts, traceId, route, latencyMs, source? }
'upstream_error'     — { type, ts, message, route }
```

Subscribers:
- `interceptor-stats.onEvent` — updates rolling counters
- SSE clients of `/api/proxy/live/sse` — receive each event as `proxy_event`
- (future) Wave 6 memesis sidecar bridge can subscribe for cross-tool correlation

## Style — non-negotiable

ESLint flat config enforces:

```js
rules: {
  'func-style': ['error', 'expression', { allowArrowFunctions: true }],
  'prefer-arrow-callback': 'error',
  'no-restricted-syntax': [
    'error',
    { selector: 'ClassDeclaration',  message: 'no classes — use const factory' },
    { selector: 'ClassExpression',   message: 'no classes — use const factory' },
    { selector: 'FunctionDeclaration', message: 'use const arrow fn' }
  ],
  'unicorn/filename-case': ['error', { case: 'kebabCase' }],
  semi: ['error', 'never'],
  indent: ['error', 2]
}
```

`new Database()`, `new Hono()` library calls are OK — only declarations are restricted. CI fails on violation.

## Wave history (commits)

| Wave | Commit | What shipped |
|---|---|---|
| 1 | `95e5af6` | monorepo scaffolding, lint, Vite app, Hono proxy, shared package |
| 2 | `ef46eae` | app chrome, state, backend foundation, primitives, CLI wrappers |
| 3 | `2a26407` | 8 surfaces (dashboard, memory, traces, proxy, knowledge, evals, settings, schedules) |
| 4 | `f268ed5` + `d375997` | interceptor pipeline end-to-end + acceptance verification report |
| 5 | latest | RTK + Headroom feed adapters; memesis bridge schema/path fix; phantom interceptor cleanup |

## Wave plan (ahead — from `.context/SEED-w6-w7-memesis-viz.md`)

- **Wave 6 — memesis-side**: schema additions (`observations`, extended `consolidation_log`, `retrieval_candidates`, `affect_log`) + `scripts/observer_api.py` Flask sidecar at port 4101 + SSE consolidation/retrieval push
- **Wave 7 — Observer Memory · Memesis rebuild**: replace 3-tab placeholder with Consolidation Studio + Retrieval Inspector + Duplicates Queue + Eval Runner. Reuse Traces & Bias waterfall component for retrieval score breakdown. Wire `memesis/eval/` pytest into Observer A·B subtab.
- **Wave 8+ candidates**: mex `.mex/` scaffold drift surface; per-tool TOML filter pattern for knowledge ingest; WebFetch / external-fetch interceptor (proxy responses through Headroom-style compressor before they hit agent context)

## Output style for Observer-related answers

When the user asks something about ccmanager:

1. **Lead with which tool owns the data** (RTK / Headroom / Memesis / own observer.db). The most-frequent confusion is "where does X come from."
2. **Cite the exact adapter file** — `apps/proxy/src/lib/external-feeds/rtk-adapter.js` is more useful than "the RTK adapter."
3. **Refer to commit boundaries** for "when did X land" — wave history table above.
4. **Defer to per-tool reference docs** for internals; this doc is the suite-level integration map only.

## Why JS (no TS) for ccmanager

Explicit decision per `CLAUDE.md`:

- npm ecosystem (Vite, React, Hono, better-sqlite3, sqlite-vec) is JS-native; TS adds tooling friction without protecting against the integration bugs that actually matter (sqlite schema drift, on-disk artefact format changes — TS doesn't catch those)
- ESLint flat config enforces the discipline (no classes, no function declarations) more strictly than TS would
- Cross-process boundaries (memesis sqlite, headroom log lines, RTK sqlite) are typed at the **adapter** boundary via JSDoc + runtime parsing, not via TS types that would get out of sync with the canonical Python/Rust schemas

If JS turns out wrong long-term: swap is mechanical — TS supports JSDoc interop. But not a Wave 5/6/7 priority.
