# mcx token-economy benchmark

Proves the core mcx claim: a scenario that natively dumps a large MCP payload
into the model's context can instead run inside one `mcx run`, returning only a
distilled digest — so the context window keeps almost none of the raw payload.

## What it measures

For each scenario, symmetrically (the metric is **context, not money**):

- **emit** — tokens the model *sends*: native tool-call args, vs the `mcx run`
  command for a registered tool.
- **recv** — tokens the model *reads back*: the raw MCP payload, vs the digest.
- **context** = emit + recv — what actually accumulates in the window.
- **mcx % of native** = mcx context ÷ native context — how little of the original context remains.

Tokeniser: `tiktoken cl100k_base` (`count_tokens.py`) — a standard tokenizer, so
the numbers are reproducible.

## Run it

```sh
# Real payloads (authoritative): capture live, then benchmark them.
CLOUD_ID=<your-cloud-id> ruby bench/capture_live.rb
MCX_FIXTURES=bench/captures ruby bench/bench.rb

# No servers / offline: synthetic fixtures, auto-generated and seeded.
ruby bench/bench.rb
```

`capture_live.rb` fetches real Jira/Notion/Slack payloads via `mcx forward` into
`bench/captures/` (gitignored — real data never enters the repo). `gen_fixtures.rb`
builds **synthetic** stand-ins (lorem text, `PROJ-N` keys) sized to real responses
so the benchmark also runs with no network. Either way, each digest is produced by
running the chain through the **real mcx executor** (`mcx run <chain>`) — the exact
production path — with the network boundary mocked: `MCX_FORWARD_REPLAY` points the
baked `forward` at an ordered fixture queue instead of a live server. So the chains
carry no benchmark-only code; they are the same pure `forward`/`emit` scripts you
would `mcx register` and run live.

## Results

Real payloads, captured live from the RETIRE Jira project + Notion + Slack:

| Scenario | Native ctx | % 200k | mcx ctx | mcx % of native |
|---|---:|---:|---:|---:|
| batch-triage (14× editJiraIssue) | 22,050 | 11.0% | 223 | 1.0% |
| Sprint metrics → Sheet (40 issues) | 15,011 | 7.5% | 157 | 1.0% |
| Jira + Notion cross-ref | 16,123 | 8.1% | 233 | 1.4% |
| 5× getJiraIssue (fan-out) | 9,281 | 4.6% | 239 | 2.6% |
| editJiraIssue (bloated response) | 1,566 | 0.8% | 80 | 5.1% |
| Notion roadmap ↔ Jira reconcile | 26,337 | 13.2% | 1,922 | 7.3% |
| getJiraIssue | 1,559 | 0.8% | 172 | 11.0% |
| Slack thread → triaged bug | 1,613 | 0.8% | 180 | 11.2% |
| searchJiraIssues (10 results) | 2,985 | 1.5% | 408 | 13.7% |

Notes on reading these:

- **The kept fraction scales with payload size.** These single-issue rows used a
  lean ticket (TICKET-1234, ~1.5k tokens); a heavily-commented issue pushes
  native past 18k and drops mcx well under 2% of it. The fan-out and cross-ref
  rows are the clearest wins precisely because they multiply or join large payloads.
- **The cross-MCP reconcile keeps 7.3% of native** — the diff is computed
  in-sandbox, so neither raw payload lands in context.
- **batch-triage** is fourteen `editJiraIssue` calls, each echoing a full issue;
  its capture fixture is 14× a real `editJiraIssue` echo with distinct keys.
- **mcx digests stay lean** because a registered tool is not re-emitted per call
  (the model only sends the short `mcx run` command, not the projection script)
  and the Ruby digests use compact `JSON.generate`.
- Payloads are counted as compact JSON; a pretty-printing server makes the
  native side a lower bound and the real savings larger (kept fraction smaller).

## The pattern

Every scenario is the same move: **fan the MCP calls out inside one sandbox run,
compute the answer there, return only the answer.** The raw payload — the ADF
description, the 40 issue blocks, both sides of a cross-MCP join — never enters
the model's context. That is the whole economy.
