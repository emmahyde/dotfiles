#!/usr/bin/env bash
# detect-env.sh — probe the current machine and emit an "Environment" block for
# CLAUDE.md, using ACTUAL tool resolution (command -v / --version) rather than
# whatever a version manager claims. Pure stdout; no side effects.
set -uo pipefail

ver() { local probe="$1"; shift; command -v "$probe" >/dev/null 2>&1 && "$@" 2>/dev/null | head -1 || echo "(not found)"; }
loc() { command -v "$1" 2>/dev/null || echo "(not on PATH)"; }

SHELL_NAME="$(basename "${SHELL:-unknown}")"
BREW_PREFIX="$(command -v brew >/dev/null 2>&1 && brew --prefix 2>/dev/null || echo '(no brew)')"
NODE_V="$(ver node node --version)";       NODE_P="$(loc node)"
DOTNET_V="$(ver dotnet dotnet --version)";  DOTNET_P="$(loc dotnet)"
RUBY_V="$(ver ruby ruby --version)";        RUBY_P="$(loc ruby)"
PY_P="$(loc python3)"
UV_P="$(loc uv)"
MISE_MANAGED="$(command -v mise >/dev/null 2>&1 && (mise ls 2>/dev/null | awk '{print $1}' | paste -sd, - ) || echo '(no mise)')"

cat <<EOF
## Environment (auto-detected $(date +%Y-%m-%d) — verify before relying on it)

- **Interactive shell: \`$SHELL_NAME\`.** The Bash tool may run a different shell (zsh/bash); PATH, env vars, and resolved tool *versions* can differ. Commands handed to the user must match their interactive shell's syntax. Env vars set in the Bash tool don't reach the interactive shell and vice-versa.
- **Homebrew prefix:** \`$BREW_PREFIX\` — \`brew install\` lands in its \`bin\`.
- **Version manager (\`mise\`):** currently manages: ${MISE_MANAGED}. Trust the *actual* resolution (\`command -v X\` / \`X --version\`), never \`mise current\`/\`mise ls\` — tools often resolve outside mise.
- **Node:** ${NODE_V} at \`${NODE_P}\`. Prefer \`npx\` over \`npm i -g\`.
- **.NET:** ${DOTNET_V} at \`${DOTNET_P}\`.
- **Ruby:** ${RUBY_V} at \`${RUBY_P}\`.
- **Python:** prefer \`uv\` (\`uv run\`/\`uvx\`/\`uv tool install\`); uv at \`${UV_P}\`, system python3 at \`${PY_P}\`.
- **\`~/.local/bin\`** = catch-all for user binaries, on PATH; preferred no-sudo install target.

### Code-intelligence stack (resolved locations)
- lumen:    $(loc lumen)
- sem:      $(loc sem)
- grepai:   $(loc grepai)
- ast-grep: $(loc ast-grep)
- lizard:   $(command -v lizard 2>/dev/null || echo 'not on PATH — run via "uvx lizard"')
- ctx7:     $(loc ctx7)
- ollama:   $(loc ollama)
EOF
