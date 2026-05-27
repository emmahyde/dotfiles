# Passoff — codemode ↔ sector bridge (NEXT-PLAN Phase B)

Hand this to a fresh codemode-capable agent. Self-contained.

## Goal

Let an agent script a whole HUD interaction loop (click → assert → click) in
**one** codemode sandbox call against the running Sector game, instead of N
separate `sector_input` MCP round-trips.

## Current blocker (resolve first)

`forward.invoke("sector", ...)` fails: `Unknown MCP server 'sector'. Configured
servers: []`. codemode is not discovering this repo's `.mcp.json`.

- The repo `.mcp.json` *does* contain a `sector` entry
  (`bun /Users/emmahyde/projects/sector/Tools/sector-mcp/index.ts`).
- codemode resolves `.mcp.json` relative to **its own process cwd / launch
  config**, not the sector repo. Find where codemode looks and point it there.
- codemode exposes only fixed namespaces: `files` / `forward` / `http` / `kv`.
  There is **no** custom-namespace registration API. `forward.invoke(server,
  tool, args)` is the only bridge to a third-party MCP server.
- `http.fetch` is GET-only — cannot POST `/input` to the debug bridge. So
  `forward.invoke` to the `sector` MCP server is the required path.

## Build (after discovery is fixed)

A codemode script that:
1. Reads debug port from `~/.sector/debug-port`.
2. Loops: `forward.invoke("sector", "sector_input", {...})` → assert via
   `forward.invoke("sector", "sector_hud", {...})` → next action.
3. Logs **only assertion results**, never raw frames.

## TOKEN DISCIPLINE — hard requirement

codemode output is currently far too verbose. The whole point of the bridge is
fewer tokens, not more. Inside sandbox code:

- Log **compact JSON of assertions only** — `{"step":3,"clicked":"ok","overlay":"open"}`.
- **Never** log full `/hud` dumps, `/gum` trees, or screenshot bytes.
- Screenshots: return the **file path**, not image data.
- `sector_hud` calls: pass a filter; log the matched element count + the one
  field under test, not the element list.
- Final sandbox return: one line per step, plus a pass/fail tally.

## Verify

Run click → `hud()` assert → click. Compare token cost + round-trips vs the
equivalent N `sector_input` calls. Note both in the checkpoint report.
