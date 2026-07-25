# mcx trim: implementation approach
*(Dmitri — Go/CLI/build-tag panel note, wave 1)*

**Confidence:** HIGH (all claims grounded in files read this session: STACK.md, ARCHITECTURE.md, CONVENTIONS.md, cmd/mcx/main.go, internal/executor/runtimes.go, internal/mcpclient/resolve.go)

## 1. Recommended implementation

**Input:** `mcx trim` reads the PostToolUse hook payload as JSON on **stdin** — no flags, no positional NAME. That payload (per the Claude Code hooks contract) carries `tool_name` and `tool_response`; `mcx trim` never touches `--args`-style CLI parsing, so it sits outside the `splitName` positional-arg gotcha entirely (CONVENTIONS.md line 6-7 doesn't apply here — no positional NAME to lose to `flag.Parse`).

**Output:** stdout gets a JSON object shaped as the PostToolUse decision-control contract expects — `hookSpecificOutput.updatedToolOutput` (never `updatedMCPToolOutput`, which is MCP-only per the panel's landmine #1). The value under `updatedToolOutput` must be the **whole envelope**, not the reshaped inner JSON alone: unwrap `content[0].text`, parse it, apply keep/drop/rename/truncate, re-serialize, put it back at `content[0].text`, and emit the full `{content: [{type:"text", text: "..."}], ...}` object. A bare reshaped-JSON return is the silent contract violation flagged as landmine #1 — treat it as a hard bug class, not a style nit.

**Fail-open:** on any of {no modifiers.json entry for `tool_name`, malformed tool_response, parse error} — write nothing / pass the original payload through unmodified. This mirrors the existing `injectAuth` pattern in `cmd/mcx/main.go` (skip silently on `ErrNoCredential`, lines 132-136) — same "absence is not an error" posture, and matches CONVENTIONS.md line 28's fail-open requirement.

**Package placement:** new `internal/modifiers/` package, mirroring the existing per-subsystem layout (CONVENTIONS.md line 4):
- `config.go` — load + merge `modifiers.json` across plugin-defaults → project `.mcx/` → user `~/.config/mcx/`, keyed by tool name, most-specific wins per key (NOT first-match-wins — see task 1 below, this is a real divergence from `resolve.go`'s semantics, only the *layered-lookup shape* is reused).
- `transform.go` — the keep/drop/rename/truncate engine over dotted paths (`fields.comment`). Pure, no I/O, easily table-tested per CONVENTIONS.md line 17.
- `envelope.go` — unwrap/rewrap the MCP `content:[{type:"text",text:...}]` shape; isolates landmine #1 in one small, obviously-testable file.
`cmd/mcx/main.go` gets one new case (`"trim": err = cmdTrim(args)`) and one new `cmdTrim(args []string) error` that reads stdin, calls `modifiers.Apply(...)`, writes the hook JSON to stdout — same dispatch shape every other subcommand already follows (CONVENTIONS.md line 4-5).

## 2. Task decomposition (binary side)

1. `internal/modifiers/config.go` — config loader with 3-source merge-by-key precedence (plugin defaults → `.mcx/modifiers.json` → `~/.config/mcx/modifiers.json`). **Not** a literal reuse of `ResolveServer`'s first-match-wins loop (`internal/mcpclient/resolve.go` lines 61-116) — that function returns on first hit and stops. Modifiers need per-key merge across all three sources. Reuse only the *pattern*: ordered list of loader funcs, skip missing/unparseable files silently (`resolve.go` lines 27-37 `loadSimple`/`loadClaudeJSON` are direct templates for "missing file returns nil, not error").
2. `internal/modifiers/transform.go` — dotted-path keep/drop/rename/truncate ops over `map[string]any`/`[]any`. Ship the drop-only cruft defaults per CONVENTIONS.md line 28.
3. `internal/modifiers/envelope.go` — unwrap/apply/rewrap the `content[0].text` MCP envelope; this is where landmine #1 lives, keep it isolated and directly tested against a fixture PostToolUse payload.
4. `cmd/mcx/main.go` — add `trim` to the dispatch switch + `cmdTrim`; stdin-JSON in, hook-JSON out; wire fail-open.
5. PATH fix for the relocated binary (own item, see risk below) — likely a one-line change in `internal/executor/runtimes.go`'s `safeEnv()` or in the `rubyPreamble`, not a new subsystem.
6. Tests: table-driven transform tests (task 2), a fixture-based envelope round-trip test (task 3), a config-merge precedence test using `XDG_CONFIG_HOME`-style temp dirs (task 1, following the existing registry test pattern per CONVENTIONS.md line 15-16).
7. `GOOS=linux go build ./...` check after all of the above — `mcx trim` is pure Go/no build tags, but a regression here would be silent until someone builds off-macOS (CONVENTIONS.md line 10).

## 3. Top risk

**PATH breakage for chain `forward()` when the binary relocates into plugin `scripts/`.** `rubyPreamble` (`internal/executor/runtimes.go` lines 98-112) shells to bare `"mcx"` via `IO.popen(["mcx", "forward", ...])`, and the subprocess env is `safeEnv()` — PATH/HOME/locale only (lines 145-160). `safeEnv()` currently forwards the **host** PATH value verbatim (`os.Environ()` filtered by key, not rewritten) — it does not know where the running `mcx` binary itself lives. Once `mcx` moves to `.../scripts/mcx` inside a plugin directory that is *not* on the user's normal PATH, every registered ruby chain's `forward()` call breaks with "command not found," and it will not surface until a chain actually runs — CI won't catch it if tests use a fake/injected PATH. Fix belongs in `safeEnv()`: resolve `os.Executable()` once, prepend its directory to the outgoing PATH so `mcx` always resolves to itself regardless of install location. This must ship in the same change as the relocation, not as a follow-up — it's a correctness landmine, already called out per the panel's landmine #2, not new information.

## 4. Convention that MUST be followed

CONVENTIONS.md lines 32-33 (New-work conventions):
> `mcx trim` must emit a value matching the MCP tool's output shape (content envelope), trimming only the inner JSON — a bare-JSON return would violate the PostToolUse `updatedToolOutput` contract.

This is the direct codification of landmine #1 and is the single highest-value thing to get right in the transform engine's output path — get the envelope wrong and every hook invocation silently corrupts tool output for the whole session, not just the trimmed tool.

Also load-bearing: CONVENTIONS.md line 28 — "Modifiers ship drop-only cruft defaults (can't hide signal); fail-open when no entry matches" — this bounds `mcx trim`'s blast radius: an unconfigured tool must pass through byte-identical, never get mangled by a missing-entry code path that defaults to drop-everything.

## 5. Existing code to reuse

- **Dispatch shape** — `cmd/mcx/main.go`'s `switch cmd` (lines 30-48) and the `cmdX(args []string) error` signature convention; `cmdTrim` slots in identically.
- **Silent-absence pattern** — `injectAuth`'s `errors.Is(err, keychain.ErrNoCredential)` skip (lines 132-137) is the template for modifiers' fail-open-on-no-match behavior.
- **Config-loader skeleton** — `resolve.go`'s `loadSimple`/`loadClaudeJSON` (lines 27-49): read-file-or-return-nil, unmarshal-or-return-nil, never fatal on a missing/bad config file. Reuse this *shape* for `modifiers/config.go`'s three loaders; do not reuse `ResolveServer`'s first-match-wins traversal itself since merge semantics differ.
- **Registry test pattern** — `XDG_CONFIG_HOME` temp-dir tests (CONVENTIONS.md line 15-16) as the template for testing modifiers' config precedence without touching the real user config.
- **`safeEnv()`** (`internal/executor/runtimes.go` lines 145-160) — the exact function to modify for the PATH fix; do not add a second env-construction path elsewhere.

## Gaps

- Did not read `internal/mcpclient/call.go`, so the exact Go struct field names/shape of `CallToolResult` (used by `cmdForward`, main.go lines 109-118) are unconfirmed — before writing `envelope.go`, confirm the real envelope shape against `call.go` and a live `mcx forward` JSON sample, don't assume `content[0].text` field names from the go-sdk are stable without checking v1.6.1 specifically (STACK.md line 6: pinned, API drifts).
- Have not read the Claude Code hooks doc directly in this session (relying on the panel's stated landmines as ground truth) — the exact PostToolUse stdin payload field names (`tool_name` vs `toolName`, etc.) should be confirmed against that doc before implementation, not guessed from memory.
- `hooks/hooks.json` invocation path for the relocated binary (how the hook itself finds `mcx` to invoke `mcx trim`) is a plugin-layout concern, likely `${CLAUDE_PLUGIN_ROOT}/scripts/mcx` — flagged but not verified against actual plugin manifest schema.
