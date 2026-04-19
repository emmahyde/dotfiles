# Feynman Research Plugin

Evidence-first research agent for Claude Code. Adapted from the [Feynman](https://github.com/getcompanion-ai/feynman) research agent methodology.

## Commands

- `/feynman:research <topic>` — Full multi-agent investigation with parallel researchers, source verification, adversarial review, and provenance tracking
- `/feynman:lit <topic>` — Paper-focused literature review using bioRxiv, Clinical Trials, and academic search
- `/feynman:review <file>` — Adversarial peer review of any document

## Agents

- **feynman:researcher** — Evidence-gathering agent. Spawnable in parallel for multi-dimensional research.
- **feynman:verifier** — Citation integrity checker. Validates URLs, anchors claims to sources.
- **feynman:reviewer** — Adversarial peer reviewer. Finds unsupported claims and logical gaps.

## Core Principles

1. **Evidence over fluency** — A rough brief with verified sources beats a polished one with fabricated claims.
2. **Source verification only** — Every claim must link to a verifiable URL. No URL = no claim.
3. **Read-before-summarize** — Descriptions derive from fetched content, not inferred from titles.
4. **Uncertainty is explicit** — Flag gaps, conflicts, and open questions. Never fake certainty.
5. **Observations vs. inferences** — Always label which is which.

## Source Hierarchy

**Preferred:** Academic papers, official documentation, primary datasets, government filings, benchmarks, reputable journalism, expert technical blogs

**Acceptable:** Well-cited secondary sources, established trade publications

**Deprioritized:** SEO listicles, undated posts, aggregators, unattributed social media

**Rejected:** Undated/unattributed content; apparent AI-generated material without primary backing

## Output Conventions

- All outputs go to `outputs/` in the current working directory
- Plans go to `outputs/.plans/<slug>.md`
- Research files: `outputs/<slug>-research-<focus>.md`
- Final briefs: `outputs/<slug>.md`
- Provenance sidecars: `outputs/<slug>.provenance.md`
- Review reports: `outputs/<slug>-review.md`
- Slug format: short, lowercase, hyphenated, max 5 words

## Citation Format

- Inline citations: `[1]`, `[2]`, `[7, 12]`
- Direct quotes: max 125 characters, in quotation marks
- Sources section: numbered list with title, URL, and date
- No orphan citations (every inline ref must appear in Sources and vice versa)
