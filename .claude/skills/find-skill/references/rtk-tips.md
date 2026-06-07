# RTK Specializations for find-skill

`rtk` is a token-shaping wrapper. Prefer rtk-friendly invocations — output gets
filtered before reaching context.

## Always-use wrappers
- `rtk read <file>` — never `cat` (chunks, strips noise)
- `rtk grep <pat> <path>` — never `grep -r` (token-bounded)
- `rtk ls <dir>` — sized listing
- `rtk git log` / `rtk git status` — never plain `git log`

## Pipe scripts through rtk where useful
The scripts in `scripts/` already emit pipe-delimited compact rows.
Don't pipe them through `rtk read` — they're already shaped.
Do pipe through `rtk grep` if you want to filter (e.g. last-12-month rows).

## When fetching READMEs
- For one-off reads of a candidate README: `WebFetch` is cheaper than spawning
  a haiku agent to read it.
- For 5+ READMEs: spawn a single haiku agent with the URL list and ask for a
  one-line summary per repo. Do NOT WebFetch each then synthesize — that
  burns context.

## Telemetry
After a /find-skill run, optionally `rtk gain` to confirm the run was efficient.
If `rtk discover` flags missed wrapper opportunities, fold them into the next run.

## Cache discipline
Cache survey output in `$TMPDIR/find-skill/<topic-hash>.txt` for the session.
Re-runs against the same topic in the same session reuse it — no second API hit.

```bash
hash=$(echo "$topic|$scope" | shasum | cut -c1-8)
out="$TMPDIR/find-skill/$hash.txt"
[ -s "$out" ] || ./scripts/survey.sh "$topic" "$scope" > "$out"
rtk read "$out"
```
