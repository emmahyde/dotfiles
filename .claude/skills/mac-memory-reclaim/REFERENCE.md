# Reading macOS memory numbers

## RSS lies; use top's MEM

`ps -o rss` reports only resident, uncompressed pages. macOS compresses inactive memory and swaps aggressively, so an idle process holding gigabytes can report single-digit megabytes of RSS.

A real case: an idle Colima VM reported `RSS 232 MB` while `top` showed `MEM 4634M`. Auditing with `ps` alone would have cleared it as harmless.

Use `top -l 1 -o mem -stats pid,mem,cpu,command`. Cross-check with `ps -o rss` only to spot the gap — a large `MEM` with tiny `RSS` means "mostly swapped out and idle", which is exactly the profile of a reclaim candidate.

## What the vm_stat buckets mean

| Bucket | Meaning | Reclaimable? |
|---|---|---|
| free | Unused | Already free |
| inactive | Recently used, evictable | Yes, automatically |
| active | In use | Only by stopping the owner |
| wired | Kernel-locked | No |
| compressor | RAM holding compressed pages | Indirectly — shrink by stopping owners |

A large compressor figure means the system is already fighting for headroom. Combined with multi-gigabyte `vm.swapusage`, that is real pressure regardless of what `memory_pressure` reports as a percentage — that percentage reflects the pressure *state*, not available headroom, and routinely reads comfortable while swap is thrashing.

Note that macOS resizes the swapfile dynamically, so `vm.swapusage` totals move between readings. Compare used-versus-total in a single sample rather than totals across samples.

## Per-session MCP servers are not a leak

Each agent session spawns its own stdio MCP servers, so several generations coexist normally. They are cheap: a typical spread of ~23 MCP processes totals well under 200 MB RSS. Do not kill them for memory.

They matter for a different reason. Multiple instances of a *stateful* server competing for one resource — an editor bridge, a fixed port, a lock file — can leave a tool registry empty or a connection wedged. When a tool that should exist reports missing, count instances:

```bash
for s in server-a server-b; do
  printf '%-24s %s\n' "$s" "$(ps -Ao command | grep -F "$s" | grep -vc grep)"
done
```

Stale instances from exited sessions are the ones to clear, by PID.

## Escalation order

1. The tool's own stop verb — `colima stop`, `voicemode service <name> stop`. Lets it flush state.
2. `osascript -e 'tell application "X" to quit'` for GUI apps, so unsaved-work prompts still fire.
3. `kill <pid>` (SIGTERM).
4. `kill -9 <pid>` only after SIGTERM was ignored for 10+ seconds.

Never `pkill`/`killall` by name. The agent running the command is itself a `node`/`claude` process, and a name match will terminate the session mid-operation.
