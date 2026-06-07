---
title: Audit Pattern → Hookify Rule Template
---

# Hookify Rule Templates

Mapping from each audit pattern to a hookify-compatible rule shape. Use when the user takes a `context-audit --emit-rules` report and wants to wire the seeds into an actual hookify rule via `/hookify:hookify` or `/hookify:writing-rules`.

The seeds emitted by `audit.py` are intentionally minimal — they carry the pattern id, trigger phase, a natural-language match clause, observed count, estimated tokens saved, and guidance. They are *not* directly executable. The user (or hookify) translates the natural-language `match` into hookify's actual DSL.

## Template skeleton

```yaml
- id: <kebab-case-id>
  trigger: PreToolUse        # or PostToolUse, UserPromptSubmit, Stop, etc.
  match: <hookify-DSL-expression>
  action: deny | warn | inject
  message: |
    <text the agent sees>
  metadata:
    source: context-audit
    observed_count: <int>
    est_tokens_saved: <int>
```

## Pattern → rule mappings

### Bloated tool outputs

```yaml
- id: no-bloated-tool-output
  trigger: PreToolUse
  match: tool in ["Read", "Bash", "Grep", "Glob", "WebFetch"]
  action: inject
  message: |
    If you intend to PROCESS this output (filter, count, parse, aggregate), route through
    ctx_execute_file or ctx_batch_execute — raw bytes stay in the sandbox.
    Bash/Read stay correct when you intend to OBSERVE a short fixed output or use Edit next.
```

Note: this is *advisory*. Denying every Read would break the agent. Recommend `action: inject` to surface the reminder without blocking.

### cat/head/tail via Bash

```yaml
- id: no-cat-via-bash
  trigger: PreToolUse
  match: tool == "Bash" and command matches /\b(cat|head|tail|sed|awk)\s+[^|]/
  action: warn
  message: |
    Use Read for one-shot file view, or ctx_execute for processing — not cat/head/tail in Bash.
```

### Redundant Reads

```yaml
- id: no-redundant-read
  trigger: PreToolUse
  match: tool == "Read" and session_state.has_read(file_path) and not session_state.edited_since(file_path)
  action: warn
  message: |
    File contents already in conversation from a previous Read with no intervening Edit. Skip.
```

Requires hookify to expose `session_state.has_read` / `session_state.edited_since` predicates. If not supported, downgrade to a per-tool-call heuristic with a sliding window kept in `metadata`.

### Read after Edit

```yaml
- id: no-read-after-edit
  trigger: PreToolUse
  match: tool == "Read" and session_state.last_edit_turn(file_path) >= session_state.current_turn - 3
  action: warn
  message: |
    Harness tracks file state after Edit — re-Reading wastes tokens. Trust the prior Edit.
```

### Repeated Grep/Glob

```yaml
- id: batch-searches
  trigger: PreToolUse
  match: tool in ["Grep", "Glob"] and session_state.recent_signatures(20).contains((tool, input.pattern, input.path))
  action: warn
  message: |
    Identical search seen in last 20 calls. Batch related patterns into one Grep/Glob, or
    use ctx_batch_execute with multiple labeled commands.
```

### Raw WebFetch

```yaml
- id: use-ctx-fetch-and-index
  trigger: PreToolUse
  match: tool == "WebFetch"
  action: inject
  message: |
    Prefer ctx_fetch_and_index — raw page bytes never enter conversation; follow up with ctx_search.
```

### Verbose Agent dispatch

```yaml
- id: lean-agent-prompts
  trigger: PreToolUse
  match: tool in ["Agent", "Task"] and len(input.prompt) > 4000
  action: warn
  message: |
    Agent prompt is large. Move long context to bundled files passed by path; brief, don't re-summarize.
```

### Long Bash output

PreToolUse can't know output size in advance. Use PostToolUse to flag, not deny:

```yaml
- id: long-bash-via-ctx
  trigger: PostToolUse
  match: tool == "Bash" and len(tool_result.content) > 4000
  action: inject
  message: |
    Bash output was {len} bytes. Next time, route through ctx_execute(language='shell', ...) so
    raw output stays in sandbox and only what you echo enters context.
```

## Workflow for wiring

1. Run `audit.py ... --emit-rules` → get YAML seeds.
2. For each seed, look up its hookify template in this file.
3. Translate the natural-language match into hookify's DSL.
4. Decide action level: `inject` (passive reminder) vs. `warn` (visible reminder) vs. `deny` (blocks call). Default to `inject` for token-waste rules — they are heuristics, not invariants.
5. Feed the translated rule to `/hookify:hookify` for installation.

Never auto-install. The user reviews the translated rule before any settings change.
