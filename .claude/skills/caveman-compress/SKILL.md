---
name: caveman-compress
description: >
  Caveman-compress instruction & memory files (strip grammar, keep facts) to cut
  context tokens, stamping <!--last compressed @ DATE-->. Use when user says
  "caveman-compress", "compress memory", "compact the memory/CLAUDE.md files",
  or invokes /caveman-compress.
---

Compress durable context files (memory + CLAUDE.md) caveman-style: strip grammar, keep facts, save tokens. LLMs reconstruct dropped grammar; facts can't be guessed, so facts stay verbatim. Technique: github.com/wilpel/caveman-compression.

## Targets (default scope)

1. Global `~/.claude/CLAUDE.md`.
2. Active project's memory dir — every `*.md` incl. `MEMORY.md` index. Resolve via `bash ~/.claude/skills/self-improve/scripts/targets.sh` (reads "memory dir").

**Project CLAUDE.md is OFF by default** — it's team-shared (checked into git). Only include it when user explicitly opts in (e.g. "incl. project CLAUDE.md").

## Compress rules

Drop (predictable): articles (a/an/the), connectives (therefore/however/because/in order to), filler (very/quite/just/really/basically/essentially), pleasantries, hedging, passive voice → active. Reduce to 2-5 words per atomic thought. Arrows for causality (X → Y).

Keep VERBATIM (unpredictable / unrecoverable):
- Numbers, names, dates, versions.
- Paths, commands, env vars, code blocks, exact quoted errors/strings.
- Technical terms, constraints, flags.
- Memory `[[wikilinks]]` and `[Title](file.md)` index links.
- The `**Why:**` / `**How to apply:**` structure in feedback/project memories.

## Hard safety rules

- NEVER touch YAML frontmatter (the `---` … `---` fence at file top). Byte-intact. Recall parses it.
- NEVER alter meaning of a behavioral rule. CLAUDE.md rules are mostly constraints (the "facts" you keep) → expect small gains there; when unsure, leave a clause uncompressed rather than risk changing behavior.
- Don't compress inside code fences.

## Marker + staleness

Each file carries `<!--last compressed @ YYYY-MM-DD-->` as its LAST line.

- SKIP a file whose marker date is < 30 days old (already compressed; re-running yields little and risks drift). Report it as skipped.
- After compressing, add the marker, or update the existing date in place.
- Get today's date from session context (currentDate / env), not a guess. Marker date must not start a line with `---`; HTML comment form avoids that.

## Reading (no decompress step)

Agents consume compressed text directly — LLMs reconstruct dropped grammar while parsing, so NO expansion pass on read (it would re-spend the saved tokens). Decompression is human-facing only and runs on request; it *synthesizes* connectives → can invent relationships, so never trust decompressed instruction/memory text as source — compressed file stays canonical. Canonical compress/decompress prompts: [references/prompts.md](references/prompts.md).

## Run

1. Resolve targets (targets.sh) + today's date.
2. For each target: read; if fresh marker, skip; else compress body per rules, preserve frontmatter, stamp/update marker.
3. Print terse report, one row per file:
   `file | before→after chars | -NN%  (or: skipped, fresh)`

Don't ask permission per file; do the batch, then report. To force re-compress a fresh file, user passes "--force".
