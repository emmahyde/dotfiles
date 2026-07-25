# STACK

## Primary
- **Go** — module `github.com/emmahyde/mcx`. Single static CLI binary, no CGO.
  Build: `go build -o bin/mcx ./cmd/mcx`. Test: `go test ./...`. Vet: `go vet ./...`.
- **MCP transport:** `github.com/modelcontextprotocol/go-sdk` **pinned v1.6.1** (API drifts; do not float).

## Secondary (sandbox runtimes, not compiled in)
- **Ruby / Python / JS / shell** — executed by `internal/executor` as sandboxed chain scripts,
  PATH-probed at runtime (`ruby`/`uv`/`python3`/`bun`/`node`/`/bin/sh`). Chains are authored in
  these languages; mcx itself never depends on them being present.
- **Python (bench only):** `tiktoken cl100k_base` token counting in `bench/count_tokens.py`.

## Platform coupling
- macOS-only keychain access via shelling to `/usr/bin/security` (build-tagged `darwin`;
  `keychain_other.go` is the `!darwin` stub returning `errUnsupported`).
- No external services, no network except: MCP forward calls and RFC 8414 OAuth refresh.

## Config / storage locations
- Scripts + `manifest.json`: `~/.config/mcx/scripts/` (honors `XDG_CONFIG_HOME`).
- OAuth creds: macOS keychain generic-password item `Claude Code-credentials`.
- Server discovery: `<cwd>/.mcp.json` → `~/.claude.json` → `~/.claude/*.json`.

## Planned additions (this work)
- Native-Go declarative JSON transform engine (`mcx trim`) reading a `modifiers.json` config.
- Claude Code **plugin** wrapper: `.claude-plugin/plugin.json`, `hooks/hooks.json`,
  `skills/`, `scripts/` (mcx binary relocates here), `modifiers.json`, `chains/`.
