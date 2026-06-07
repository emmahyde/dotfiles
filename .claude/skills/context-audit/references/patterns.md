---
title: Context-Audit Pattern Catalog
---

# Pattern Catalog

Detailed rationale per pattern detected by `scripts/audit.py`. Load this when triaging an audit report or tuning thresholds.

## 1. Bloated tool outputs

**Detector.** `Read | Bash | Grep | Glob | WebFetch` returns ≥ `--threshold-bytes` (default 4000).

**Why it wastes.** Every byte of `tool_result` enters the conversation and is re-tokenized on every subsequent turn (until compaction). A single 50KB Read costs ~12k tokens forever.

**Suggested swap.** Move processing into a sandbox.
- `mcp__plugin_context-mode_context-mode__ctx_execute_file(path, language, code)` — analyze a file; only `console.log` output enters context.
- `mcp__plugin_context-mode_context-mode__ctx_batch_execute(commands, queries)` — multi-shell-command research with co-located FTS5 search.

**False positives.** A large Read may be unavoidable when the next step is `Edit` (Edit needs the bytes to match against). Don't flag automatically — flag as *candidates*.

## 2. cat/head/tail via Bash

**Detector.** Bash `command` matches `\b(cat|head|tail|sed|awk)\b`.

**Why it wastes.** Bash returns the full stdout into conversation. `Read` gives line numbers + paging; `ctx_execute` keeps bytes in sandbox.

**Suggested swap.**
- Just want to see the file? Use `Read`.
- Want to process/extract/count? Use `ctx_execute` with shell or python.

**False positives.** `head -1` to print a single line (e.g., a port number) is fine. Threshold by command position (pipeline tail vs. standalone) if precision matters.

## 3. Redundant Reads

**Detector.** Same `file_path` Read more than once with no intervening `Edit` or `Write` to that path.

**Why it wastes.** Content already in conversation. Re-Read doubles the bytes.

**Suggested swap.** Trust the prior Read. If the read window was insufficient, prefer a larger `--limit` or use `ctx_execute_file` to grep the part you actually need.

**False positives.**
- Conversation was compacted between Reads — second Read is necessary.
- Different `offset`/`limit` windows of a huge file genuinely need separate Reads.

## 4. Read after Edit

**Detector.** `Read` of a file that was the target of `Edit` or `Write` earlier in the session.

**Why it wastes.** Harness tracks file state after Edit — you don't need to Read to verify.

**Suggested swap.** Skip the verifying Read entirely. If Edit succeeded, the file matches `new_string`.

**False positives.**
- User asked you to verify the file looks correct.
- Auto-formatter is known to rewrite files post-Edit (sector repo has this — content matches but layout differs).

## 5. Repeated Grep/Glob

**Detector.** Identical `(tool, pattern, path)` signature within a 20-call window. Also catches `Bash grep` / `Bash rg`.

**Why it wastes.** Each search re-emits result bytes. Common cause: refining a search by trying minor variations of the same pattern.

**Suggested swap.**
- Batch related patterns into one Grep call with a broader regex (`pattern: "(foo|bar|baz)"`).
- For multi-file exploration, use `ctx_batch_execute` with multiple labeled commands.

## 6. Raw WebFetch

**Detector.** `WebFetch` returns ≥ 2000 bytes.

**Why it wastes.** Web pages are large. Even after WebFetch's internal summarization, bytes enter conversation.

**Suggested swap.** `ctx_fetch_and_index` — fetches the page, indexes into FTS5, returns only that the index now contains it. Follow up with `ctx_search` to extract relevant snippets.

## 7. Verbose Agent dispatch

**Detector.** `Agent` / `Task` tool with `prompt` field ≥ 4000 chars.

**Why it wastes.** Long prompts to subagents are billed twice — once in your conversation (the dispatch), once in the subagent's conversation.

**Suggested swap.** Move long context to bundled files. Pass file paths in the prompt and let the subagent Read them. The dispatch prompt should *brief* the agent, not *re-summarize* the situation.

## 8. Long Bash output

**Detector.** Any Bash `command` whose `tool_result` is ≥ 4000 bytes.

**Why it wastes.** Same as #1 but specifically for shell. Common with `git log`, `find`, `ls -R`, test runners.

**Suggested swap.** `ctx_execute(language='shell', code='...')` — runs the same shell in a sandbox; only what you `echo` or `console.log` enters conversation.

## Token estimation method

Rough: `tokens ≈ bytes / 4`. This is conservative for English/code (real ratio is ~3.3 for English prose, ~3.8 for code). Treat reported numbers as a lower bound when triaging.

## Tuning thresholds

If the report is too noisy, raise `--threshold-bytes`. The 4000-byte default catches outputs >1k tokens.

If you want to audit a project's habits over time, run the script on multiple sessions and aggregate. The findings shape (pattern + count + tokens) is the same; sum across runs to identify habits that compound.
