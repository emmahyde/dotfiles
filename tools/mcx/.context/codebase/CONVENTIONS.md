# CONVENTIONS

## Go style (established this repo)
- Package-per-subsystem under `internal/`; `cmd/mcx/main.go` is dispatch-only (a `switch` over
  subcommand → `cmdX(args []string) error`). New subcommands follow the same shape.
- **Go `flag` stops at the first positional arg.** Any subcommand taking a positional NAME must
  pull it off with `splitName(args)` **before** `flag.Parse` (see `cmdRegister`/`cmdRun`/`cmdRemove`).
- Errors: return wrapped `fmt.Errorf("context: %w", err)`; `main` prints and sets exit code.
- Build tags for platform code: `keychain_darwin.go` (`//go:build darwin`) + `keychain_other.go`
  (`//go:build !darwin`) stub. Every change must still `GOOS=linux go build ./...`.
- **Never truthiness-check** a value that can be `0`/`""`/`false`; compare explicitly (esp. `expiresAt`).

## Testing
- Tests must **never** touch the real keychain: `creds.go` exposes swappable
  `readKeychain`/`writeKeychain` vars for a fake backend. Registry tests set `XDG_CONFIG_HOME`
  to a temp dir. HTTP refresh is tested against an `httptest` server, never a real IdP.
- Table-driven where it fits; compare compacted JSON (not byte-exact) for payload assertions.
- Existing test files: `*_test.go` beside each package; `cmd/mcx/main_test.go` covers dispatch.

## Comments
- WHY not WHAT; one line max; no task/ticket refs; no class/module prose blocks. The repo already
  follows this — match it.

## Security invariants (do not weaken)
- `safeEnv` allow-list only — no secrets into sandboxed scripts; pass data via stdin.
- `validName` blocks `/` and `..` in tool/script names.
- Keychain write-back preserves every other top-level key and every other `mcpOAuth` entry.
- Modifiers ship **drop-only** cruft defaults (can't hide signal); fail-open when no entry matches.

## New-work conventions (this plan)
- Modifiers are **native Go, declarative** — never run in a sandbox runtime.
- `mcx trim` must emit a value matching the MCP tool's output shape (content envelope), trimming
  only the inner JSON — a bare-JSON return would violate the PostToolUse `updatedToolOutput` contract.
- Config resolution reuses the existing discovery-precedence pattern from `resolve.go`.
