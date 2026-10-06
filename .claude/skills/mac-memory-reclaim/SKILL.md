---
name: mac-memory-reclaim
description: Audit macOS memory pressure, find what is actually holding RAM and swap, reclaim it safely, and cold-restart the Unity editor. Use when the Mac is swapping, feels slow, a local model will not fit, Unity domain reloads have gotten slow, or the user asks to kill processes, clear things out, free up memory, or start Unity over. Identifies idle VMs, orphaned agent helpers, and duplicate MCP servers, and shuts each down by its own service manager rather than by signal where one exists.
---

# macOS memory reclaim

Two phases, always in order: audit read-only, then act on explicit PIDs the user confirmed. There is no "kill everything" step, by design.

## Never kill these

Killing by image name takes down the harness running this session. `pkill claude`, `pkill node`, `killall python` are all forbidden — a `claude` process is very likely the agent executing the command.

Resolve the session's own ancestry before touching anything:

```bash
p=$$; while [ "$p" -gt 1 ]; do ps -p $p -o pid,command | tail -1; p=$(ps -p $p -o ppid= | tr -d ' '); done
```

Everything in that chain is off limits, plus `WindowServer`, `launchd`, `kernel_task`, `loginwindow`, and the terminal app hosting the session. Any other `claude` process belongs to a different session — leave it alone too.

## Audit

```bash
bash scripts/audit_memory.sh
```

Reports pressure, swap, compressor, and the top consumers with full command lines. Read `top`'s `MEM` column, not `ps` `RSS` — RSS excludes compressed and swapped pages, so an idle 4 GB process can report 11 MB of RSS and look harmless.

## Usual suspects

Ranked by how much they typically hold versus how little they are usually doing:

| Suspect | Check it is idle | Graceful stop |
|---|---|---|
| Colima / Lima VM | `docker ps` empty | `colima stop` |
| Docker Desktop / OrbStack | `docker ps` empty | Quit the app |
| voicemode TTS (kokoro, whisper) | no active voice session | `voicemode service kokoro stop` |
| Orphaned agent helpers (`omp --mode rpc-ui`) | its session dir is finished | `kill <pid>` |
| Duplicate MCP servers | same script path twice | `kill` the older PID |
| Browser helpers | tab count | Close tabs, or quit the app |

A container VM with zero containers is almost always the single biggest win. Check that first.

## Acting

Always print the table with PID, memory, uptime, and what the thing is, then get confirmation before stopping anything. Prefer, in order: the tool's own stop verb (`colima stop`), then app quit via `osascript`, then `kill <pid>` (SIGTERM), then `kill -9` only if SIGTERM was ignored for 10+ seconds.

## Clearing Unity out entirely

When the ask is "kill all Unity and all Unity MCP", use:

```bash
bash scripts/nuke_unity.sh          # refuses on unsaved scenes
bash scripts/nuke_unity.sh --force  # skips the check
```

Kills every editor, import worker, and Unity MCP bridge (`mcpforunityserver`, `mcp-for-unity`, `gamedev-mcp-server`, `UnityMCP`) by resolved PID. Prints the target table first.

Unity MCP bridges are safe to kill even when they belong to a live agent session — they are stateless and respawn on next use. The editor is not: it holds unsaved scene state, so the dirty check is the one guard worth keeping.

Duplicate Unity MCP servers are worth clearing on their own merit, separate from memory. Several instances competing for one editor bridge is a known cause of a tool registry coming back empty.

## Restarting Unity

Restart Unity only when the editor itself is the problem — leaked import workers, a wedged domain reload, or a dropped CLI bridge. It reclaims little and costs a full reimport, so it is rarely the right first move.

```bash
bash scripts/restart_unity.sh
```

The script refuses to run with unsaved scene changes. It quits gracefully via AppleScript, waits for exit, relaunches, and polls `unity status` until the bridge reports `ready`.

## Reference

Interpreting the memory numbers, and why RSS lies: [REFERENCE.md](REFERENCE.md)
