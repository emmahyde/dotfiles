# Discussion Log: mcx two-registry Claude Code plugin

**Date:** 2026-07-13
**Mode:** Panel discussion (--auto), lightweight (design pre-converged; codebase authored this session)
**Stakeholders:**

- Dmitri, Go systems engineer (owns the mcx binary) — bias: minimal binary surface, native-Go correctness, build/PATH hygiene
- Lena, Claude Code plugin & hooks specialist — bias: reliable non-intrusive steering, correct hook contracts
- Marcus, token-economy & agent-DX advocate — bias: measurable savings, defaults that never hide signal

Note: gather-context's 5-opus mapping fleet was intentionally skipped — the repo was authored this
session and is fully in context; a minimal 3-file map (STACK/ARCHITECTURE/CONVENTIONS) cleared the
prerequisite. Panel focused on HOW, not WHETHER (architecture pre-approved).

---

## Wave 1: Initial Positions

Full responses:
- `.context/research/panel-mcx-plugin-wave-1-dmitri.md`
- `.context/research/panel-mcx-plugin-wave-1-lena.md`
- `.context/research/panel-mcx-plugin-wave-1-marcus.md`

**Dmitri:** `mcx trim` reads PostToolUse payload on stdin, unwraps `content[0].text`, applies
keep/drop/rename/truncate over dotted paths, re-wraps, emits `hookSpecificOutput.updatedToolOutput`.
New `internal/modifiers/` package (config/transform/envelope) + one `cmdTrim` case. Top risk:
relocated binary breaks chain `IO.popen(["mcx",...])` under stripped safeEnv → fix by prepending
`os.Executable()` dir to outgoing PATH. Reuse resolve.go loader skeleton (not its first-match-wins).

**Lena:** PostToolUse matcher `mcp__.*`; UserPromptSubmit has no matcher (filter inside fast `mcx
nudge`). Verified vs go-sdk@v1.6.1 `CallToolResult` (HIGH): `updatedToolOutput` must be
`{"content":[...],"isError":...,"structuredContent":...}` verbatim; mismatch = silent failure.
Fail-open = exit 0 + empty stdout. No native hook cooldown → nudge needs `${CLAUDE_PLUGIN_DATA}`
state file, factual phrasing, sub-1s runtime (30s timeout discards additionalContext). `/mcx`
description must stay narrow so it doesn't shadow `mcx-author` auto-trigger.

**Marcus:** Ship Jira-only drop-only defaults grounded in the real capture (`expand`, `self`,
`avatarUrls`, `iconUrl`, reporter `timeZone`/`accountType`/`active`). Drop-only, fail-open, explicit
paths (no wildcards), `MCX_TRIM=off` escape hatch. Trim needs its own bench row (recv-only). Top
risk: a field that's cruft in one shape but signal in another; mitigate by requiring every shipped
modifier cite a real checked-in capture file:path.

---

## Consensus

Positions were complementary, not conflicting. Synthesized into CONTEXT-mcx-plugin.md decisions
D1–D8. Key agreements: stdin-JSON in / envelope-preserving `updatedToolOutput` out; fail-open =
exit-0-empty-stdout; `internal/modifiers/` engine; drop-only shipped defaults; two distinct PATH
contexts (hook uses `${CLAUDE_PLUGIN_ROOT}`, chains use safeEnv `os.Executable()` prepend);
golden-file test as the primary guard against silent hook no-op.

## Unresolved Disagreements

**Capture-citation vs gitignored captures** — Marcus wanted shipped modifiers to cite a checked-in
capture, but `bench/captures/` is gitignored real data. **Resolved by user decision:** check in
**sanitized** capture fixtures under `testdata/captures/`; shipped modifier entries cite them; a Go
test asserts defaults only drop keys present in the fixture and never touch signal. (CONTEXT D3.)

None remaining.
