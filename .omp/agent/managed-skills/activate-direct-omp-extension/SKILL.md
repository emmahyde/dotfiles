---
name: activate-direct-omp-extension
description: Install dependencies and verify a direct OMP extension under ~/.omp/agent/extensions.
---

# Activate a direct OMP extension

1. Ensure the extension directory has a package.json with:
   - `type: "module"`
   - `omp.extensions: ["./index.ts"]`
   - exact runtime dependencies.
2. Run `bun install` from that extension directory. The native OMP loader imports extensions but does not install package dependencies.
3. Verify with:
   - `bun pm ls --all`
   - `bun -e 'const m=await import("./index.ts"); if(typeof m.default!=="function") throw new Error("invalid extension factory")'`
4. Smoke-test registration with a minimal fake API capturing `registerCommand`, `registerMessageRenderer`, and `on` calls.
5. Restart OMP; native discovery uses `~/.omp/agent/extensions/<name>/package.json` and its `omp.extensions` entry.
