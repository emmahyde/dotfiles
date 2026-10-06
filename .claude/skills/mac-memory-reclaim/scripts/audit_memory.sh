#!/usr/bin/env bash
# Read-only. Prints nothing that mutates state; safe to run at any time.
set -uo pipefail

echo "=== pressure ==="
memory_pressure 2>/dev/null | grep -i 'percentage' || true

vm_stat | awk '
  /page size/       {ps=$8}
  /Pages free/      {f=$3}
  /Pages active/    {a=$3}
  /Pages inactive/  {i=$3}
  /Pages wired/     {w=$4}
  /occupied by compressor/ {c=$5}
  END {printf "free=%.1fG active=%.1fG inactive=%.1fG wired=%.1fG compressed=%.1fG\n",
       f*ps/1073741824, a*ps/1073741824, i*ps/1073741824, w*ps/1073741824, c*ps/1073741824}'
sysctl -n vm.swapusage

echo
echo "=== this session's own process chain (NEVER kill these) ==="
p=$$
while [ "$p" -gt 1 ]; do
  ps -p "$p" -o pid,command 2>/dev/null | tail -1 | cut -c1-100
  p=$(ps -p "$p" -o ppid= 2>/dev/null | tr -d ' ')
  [ -z "$p" ] && break
done

echo
echo "=== top consumers (MEM includes compressed/swapped; RSS does not) ==="
top -l 1 -n 20 -o mem -stats pid,mem,cpu,command 2>/dev/null | tail -21

echo
echo "=== idle VM check ==="
if command -v colima >/dev/null 2>&1; then
  colima status 2>&1 | grep -q 'is running' && {
    echo "colima: RUNNING"
    # An empty container list means the VM is holding gigabytes for nothing.
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q . \
      && echo "  containers: $(docker ps -q 2>/dev/null | wc -l | tr -d ' ')" \
      || echo "  containers: 0  <-- reclaim with: colima stop"
  } || echo "colima: stopped"
fi
pgrep -lf 'Docker Desktop|OrbStack' 2>/dev/null | head -3

echo
echo "=== orphaned helpers and duplicate servers ==="
ps -Ao pid,etime,command 2>/dev/null \
  | grep -E 'omp --mode rpc-ui|src/server\.ts|uvicorn|mcp' \
  | grep -v grep | cut -c1-120
