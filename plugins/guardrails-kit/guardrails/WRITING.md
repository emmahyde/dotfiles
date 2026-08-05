<!-- guardrails-kit: v1.14 | Editing this file? Read ~/.claude/guardrails/_FORMAT.md first. Never paraphrase kit text. -->
You are here because you are about to write or heavily rewrite `docs/STATE.md`, or any `.md` deliverable whose path or task says `status`, `worklog`, `context`, `guide`, `report`, `audit`, or `spec`, or the user says `reformat`, `same content`, `trim`, `more digestible`, or `comparable token output`.

Target: headers plus single-job bullets, every claim and file ref intact, zero decoration.
Checklist — cite fired IDs, one evidence line each; skip unfired items.

Structure:
- W-ONEJOB. Each paragraph does one job (evidence, diagnosis, proposal, or costs) -> split when a tell fires:
  - W-ONEJOB-DENSITY. 2+ `;`, 2+ parentheticals, or 3+ claims in one paragraph.
  - W-ONEJOB-STACK. 4+ sentence blocks under one heading -> split or compress.
- W-PROMOTE-LABELS. Inline `Where:` / `Current flow:` / `Conflict:` / `Simpler architecture:` / `Deletion test:` / `Cost honesty:` labels present -> promote them to `###` headers.
- W-BULLETS. File:line lists, enumerations, or comparisons with 3+ items -> use bullets, not prose chains.

Preservation:
- W-PRESERVE. User says `same content`, `trim`, `more digestible`, or `comparable token output` -> both sub-rules apply:
  - W-PRESERVE-CLAIMS. Preserve every claim, file ref, section ref, caveat, and ordering dependency.
  - W-PRESERVE-CUTS. Cut in this order: filler, restatements, transition phrases, decorative spacing -> never evidence or diagrams.

Formatting:
- W-DOC-SHAPE. Path or task says `status`, `worklog`, `context`, `docs/STATE.md`, `report`, or `audit` -> both sub-rules apply:
  - W-DOC-SHAPE-OPEN. Open with a header or bullets -> no throat-clearing paragraph.
  - W-DOC-SHAPE-ORDER. Order sections as facts/evidence, interpretation, costs/risks, next steps.

--- reference ---

## You are splitting a dense status paragraph
GOOD (mini-transcript):
1. Draft paragraph has 3 claims, 2 parentheticals, 2 file:line refs — W-ONEJOB-DENSITY fires.
2. Split into `### Root cause` (claim + `export.mjs:61`), `### Fix` (claim + `preamble.tex:12`), `### Risk` (claim).
3. The refs plus one enumeration make 3+ items — W-BULLETS fires; convert to bullets.
4. Send, citing: "W-ONEJOB-DENSITY: split 3-claim paragraph. W-BULLETS: bulleted file refs."

BAD (never do this): reflow the section into fewer, longer paragraphs that bury the file refs.

## Your draft still feels dense after the Structure checks
Split by job: facts, interpretation, costs, next steps — one section each; compress within sections only.
