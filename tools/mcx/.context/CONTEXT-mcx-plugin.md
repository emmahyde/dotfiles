# CONTEXT: mcx two-registry Claude Code plugin

**Slug:** mcx-plugin
**Date:** 2026-07-13
**Mode:** panel (--auto), Wave 1 + user decision on the one open tension

## Scope

Wrap the existing `mcx` binary in a Claude Code plugin that steers the agent toward two
context-saving registries:

- **Registry 1 — Modifiers (passive):** declarative JSON reshaping applied to *every* call of a
  configured MCP tool. Native Go, new `mcx trim` subcommand, auto-applied by a PostToolUse hook.
- **Registry 2 — Chains (active):** the existing register/list/run/remove sandbox script store.
  Model-invoked via `mcx run`, returns a digest. Steered by a UserPromptSubmit nudge.

Out of scope: browser PKCE re-auth, MCP-server mode, new chain runtimes, rewriting forward/keychain.

## Locked decisions

### D1 — `mcx trim` I/O contract
- Reads the PostToolUse hook payload as **JSON on stdin**.
- Unwraps the MCP result envelope, applies the transform to the inner payload, **re-wraps**, and
  emits `{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":<result>}}`.
- `updatedToolOutput` MUST match the go-sdk v1.6.1 `CallToolResult` shape verbatim:
  `{"content":[{"type":"text","text":"<json>"}],"isError":...,"structuredContent":...}`.
  A bare-JSON return is a silent contract violation (Lena, HIGH confidence).
- **Fail-open = exit 0 with EMPTY stdout** on no-match, parse failure, or any error. Never emit an
  empty/partial `updatedToolOutput` (that would blank the tool result).
- Escape hatch: `MCX_TRIM=off` (env) bypasses all trimming.

### D2 — Transform engine (native Go, `internal/modifiers/`)
- Vocabulary: **keep** (allowlist), **drop** (denylist), **rename**, **truncate** — over **dotted
  paths** for nested traversal (`fields.comment`, `fields.description`). **No wildcards.**
- Package split: `config.go` (load + merge-by-key precedence), `transform.go` (engine),
  `envelope.go` (unwrap/rewrap the CallToolResult). One `cmdTrim` case in `cmd/mcx/main.go`.
- Modifiers are declarative data only — **never** executed in a sandbox runtime.

### D3 — Shipped `modifiers.json` defaults are drop-only + capture-backed
- Shipped defaults use **drop only** (no rename/truncate) so they cannot hide signal.
- **DECISION (user):** check in **sanitized** capture fixtures under `testdata/captures/`. Every
  shipped modifier entry cites one, and a Go test asserts the shipped defaults (a) only drop keys
  that exist in the cited fixture and (b) never touch an allowlisted signal key. This resolves the
  Wave-1 tension (Marcus wanted checked-in proof; `bench/captures/` is gitignored real data — so we
  ship a *sanitized* copy instead of the raw one).
- Initial defaults: Jira `getJiraIssue` — drop `expand`, `self`, `fields.*.avatarUrls`,
  `fields.*.iconUrl`, reporter/assignee `timeZone`/`accountType`/`active`. Slack/Notion entries
  are added only once a sanitized capture for them is checked in.

### D4 — Two distinct PATH-resolution contexts (both required)
- **Hook → `mcx trim`:** hook command invokes `${CLAUDE_PLUGIN_ROOT}/scripts/mcx` (absolute; no PATH
  dependency).
- **Chain ruby `forward()` → `IO.popen(["mcx",...])`:** runs under stripped `safeEnv`. Patch
  `safeEnv()` in `internal/executor/runtimes.go` to prepend `os.Executable()`'s directory onto the
  outgoing `PATH` so the relocated binary is resolvable. Both are needed; they don't interact.

### D5 — Hooks (`hooks/hooks.json`)
- **PostToolUse**, matcher `mcp__.*`, command → `${CLAUDE_PLUGIN_ROOT}/scripts/mcx trim`.
- **UserPromptSubmit**, no matcher, command → a fast (<1s) `mcx nudge` that decides whether to inject
  `additionalContext` naming a concrete `mcx run` chain. 30s timeout silently discards output, so it
  must be fast. No native cooldown → hand-roll a per-session rate-limit state file under
  `${CLAUDE_PLUGIN_DATA}`. Phrasing is factual, not imperative, gated on a fan-out/oversized-response
  heuristic to avoid nudge-fatigue.

### D6 — Skills
- `skills/mcx/SKILL.md` — user-invoked `/mcx` quickstart + cheatsheet. Description kept **narrow** so
  it does not shadow `mcx-author`'s auto-trigger.
- `skills/mcx-author/SKILL.md` — auto-triggers when the user wants to capture a reusable chain;
  teaches writing + `mcx register`.

### D7 — Config precedence (both registries)
- plugin defaults → project `.mcx/` → user `~/.config/mcx/`; merge by key (tool name / script name),
  most-specific source wins. Reuse the loader-skeleton pattern from `internal/mcpclient/resolve.go`
  (but note resolve.go is first-match-wins; modifiers are merge-by-key — different semantics).

### D8 — Plugin layout
```
mcx-plugin/
  .claude-plugin/plugin.json
  hooks/hooks.json
  scripts/mcx                 # binary relocates here
  skills/mcx/SKILL.md
  skills/mcx-author/SKILL.md
  modifiers.json              # Registry 1 defaults
  chains/*.rb                 # Registry 2 examples
```

## Conventions to enforce
- `cmd/mcx/main.go` stays dispatch-only; `cmdTrim`/`cmdNudge` follow the `cmdX(args) error` shape.
- Positional-NAME subcommands use `splitName` before `flag.Parse`.
- Explicit nil/empty comparisons (never truthiness) — esp. around trim's presence checks.
- `GOOS=linux go build ./...` must still pass (modifiers are pure Go; safeEnv patch is portable).
- Tests never touch the real keychain / real captures; `XDG_CONFIG_HOME` → temp dir.
- Comments: WHY-only, one line, no ticket refs.

## Concerns to watch
- **Silent hook no-op** from a wrong field name or wrong envelope shape (highest risk). Guard with a
  golden-file test that runs `mcx trim` on a fixture payload and asserts the exact emitted JSON.
- **Field cruft-vs-signal ambiguity** — a dropped key that is load-bearing in another response shape.
  Mitigated by drop-only defaults + capture-backed test (D3).
- **Nudge fatigue / nudge ignored** — gate + rate-limit + factual phrasing (D5).
- **Relocated-binary PATH breakage** for chains (D4).

## Reusable assets
- `internal/mcpclient/resolve.go` — loader/precedence skeleton.
- `internal/executor` — sandbox + `safeEnv` (to be patched).
- `cmd/mcx/main.go` dispatch switch + `splitName`.
- `bench/` harness — add a trim bench row (recv-only ratio; do not blend with chains' metric).
- Wave-1 stakeholder notes: `.context/research/panel-mcx-plugin-wave-1-{dmitri,lena,marcus}.md`.

## Unresolved
None — the capture-citation tension is resolved by D3 (user decision).
