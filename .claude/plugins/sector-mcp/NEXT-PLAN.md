# sector-mcp — next work plan

**Status:** A done (outline cache). B passed off — see `CODEMODE-PASSOFF.md`
(blocker: codemode not discovering `.mcp.json`; no sector-mcp code needed).
C done — `sector_ast --refs`, in-memory compilation, ~1.3s cross-file, semantic
via Roslyn `SymbolFinder`. D done — D0 gate passed (`/gum` bounds are native px,
verified by a computed-centre click landing on the dossier); `sector_interact`
now drives off the real `/gum` tree (`gumToHudNodes`), `buildHudTree` removed.
Live picker test pending an MCP-server restart.

Four features, sequenced. Each phase is independently shippable and ends with a
checkpoint. Constraints carried from prior work: Bun only, terse tool
descriptions, capped output, direct dll invocation (no `dotnet run`), AST-based
parsing, `bun test` coverage per feature.

---

## Phase A — Outline cache  (idea #3, effort S)

Goal: `sector_ast` stops shelling the dll on unchanged files.

- A1. Add an mtime-keyed cache in `index.ts`: `Map<string, {mtimeKey, parsed}>`.
      Single file → key `abs + statSync.mtimeMs`. Directory → key `abs +`
      sorted hash of member-file mtimes.
- A2. On `sector_ast` call (non-`lines` path): compute key, return cached
      `parsed` on hit, else shell the dll and store.
- A3. Extract the cache logic into a testable helper (`astcache.ts` —
      `cacheKey(path)`, pure mtime-hash). Cover with `bun test`.
- A4. Verify: repeat `sector_ast` call on same file is dll-free; edit file →
      cache miss → fresh parse.

**Checkpoint A.** `bun test` green, `bun build` clean.

---

## Phase B — codemode ↔ sector bridge  (idea #1, effort M)

Goal: expose the sector debug bridge as a codemode namespace so an agent
scripts a whole HUD interaction loop in one sandbox call.

- B1. Decide wiring: register a `sector` tool-namespace with the codemode
      server (codemode config / `.mcp.json`). Confirm codemode's namespace
      registration mechanism first — `files/forward/http/kv` are built in;
      need to learn how a custom namespace is added.
- B2. Implement namespace methods over `http://localhost:<debug-port>`:
      `click(x,y,button?)`, `key(k)`, `hud(filter?)`, `eval(code)`,
      `screenshot()` (returns path, not bytes — keep images out of context).
- B3. Port discovery inside the sandbox: read `~/.sector/debug-port`. For
      Docker sandbox mode, document the `host.docker.internal` caveat.
- B4. Verify: a codemode script does click → `hud()` assert → click, logging
      only assertions. Compare round-trip/token cost vs N `sector_input` calls.

**Checkpoint B.** Working script demo + token-cost note. Game must be running.

> Open question for B1 — resolve before coding: does codemode support
> third-party namespaces, or only the built-in four? If only built-in, fall
> back to `tools.http.*` against the bridge directly (still one sandbox call).

---

## Phase C — `sector_ast` refs mode  (idea #2, effort L)

Goal: find-references / find-callers for a C# symbol.

- C1. `Sector.Cli/AstCommand.cs`: new `--refs <symbol>` path. Needs a
      compilation, not a syntax tree — load via `MSBuildWorkspace` on
      `Sector.sln` (or a single project to bound load cost).
- C2. Use Roslyn `SymbolFinder.FindReferencesAsync`. Emit the same
      `{file,kind,name,signature,startLine,endLine}` shape as outline so the
      existing `outputSchema` carries it.
- C3. `index.ts`: `sector_ast` gains a `refs` param; route to `--refs`.
      Cap results (reuse `capSymbols`).
- C4. Mitigate the MSBuildWorkspace load cost (seconds — violates the
      "fast dll" lesson): cache the loaded workspace process-side, or scope
      refs to the project containing the symbol.
- C5. `bun test`: integration test shelling the dll `--refs` against a
      fixture project (skip when unbuilt, like the existing AST test).

**Checkpoint C.** Refs resolve correctly; load cost measured + acceptable.

---

## Phase D — `sector_interact` true tree  (idea #4, effort S–M)

Goal: drive the picker off the real `/gum` child hierarchy instead of the
`/hud` containment-derived tree.

- D0. **GATE — do first.** Verify `/gum` node bounds are native
      render-target px, not Gum-layout space. Click one known `/gum` node
      centre, confirm it lands. If bounds are Gum-space → Phase D is blocked;
      stop and report (needs a coord transform or a bridge-side fix).
- D1. `index.ts`: `listHudElements` → `/gum`; reuse existing `buildGumTree`
      (already present) for the depth-tagged tree.
- D2. Drop `buildHudTree` containment derivation from the `sector_interact`
      path (keep it if `sector_hud` still uses it; else remove).
- D3. `bun test`: cover the `/gum`-tree adaptation.
- D4. Verify live: elicitation picker shows real hierarchy; clicks land.

**Checkpoint D.** Live picker works, or D0 gate reported as blocker.

---

## Sequence & dependencies

A → B → C → D. A is quick and unblocks fast iteration on C. D's coord-space
gate (D0) can be checked any time the game is running — do it early to know if
D is viable. Phase B and Phase C/D both need a running game for their
verification steps.
