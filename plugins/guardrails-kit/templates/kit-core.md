<!-- guardrails-kit: v1.13 (global adaptation of github.com/TheColliny/FableClaudeMDForOpus) -->
<!-- Deviation from stock kit, applied mechanically: doc paths point at {{CLAUDE_DIR}}/guardrails/ because this is the
     global {{CLAUDE_DIR}}/CLAUDE.md. docs/STATE.md stays project-relative — session state belongs to the repo. -->
<!-- BEGIN KIT CORE v1.3 -->
<!-- Editing this file? Read {{CLAUDE_DIR}}/guardrails/_FORMAT.md first. Never paraphrase kit text. -->

Rules fix known model fail modes. Procedures, not advice — follow literal.

## Routing — moment X happen, next tool call Read the doc

| The moment you...                                                                                                                                                                                   | Read                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| realize — at start or mid-task — task need >2 file edit or edit in >1 top-level dir, or about to Edit 3rd file with no TASK block posted                                                         | {{CLAUDE_DIR}}/guardrails/PLAN.md       |
| about to create or modify repo source file — by Edit, Write, or shell command that write files — first time since session start or last compaction. Prose-only .md/.txt no fire this row; markdown under .claude/, skills/, or agents/ do                                    | {{CLAUDE_DIR}}/guardrails/CODE.md       |
| see test expect pass fail, build/test/run command exit non-zero, traceback, run output contradict prediction, or user-reported bug not reproduced this session | {{CLAUDE_DIR}}/guardrails/DEBUG.md      |
| about to write "done", "fixed", "works", "passing", "complete", "resolved", or "ready", or run git commit / gh pr create                                                                     | {{CLAUDE_DIR}}/guardrails/VERIFY.md     |
| about to write or heavy rewrite `docs/STATE.md`, or any `.md` deliverable whose path or task say `status`, `worklog`, `context`, `guide`, `report`, `audit`, or `spec`, or user say `reformat`, `same content`, `trim`, `more digestible`, or `comparable token output` | {{CLAUDE_DIR}}/guardrails/WRITING.md |
| about to Read 3rd file over 300 line, or search return >50 hit                                                                                                                          | {{CLAUDE_DIR}}/guardrails/EFFICIENCY.md |
| return from compaction or /resume, user pause work ("stop", "later", "tomorrow"), or task with TASK block have no docs/STATE.md                                                         | {{CLAUDE_DIR}}/guardrails/SESSION.md    |
| about to spawn subagent for anything beyond read-only exploration                                                                                                                             | {{CLAUDE_DIR}}/guardrails/TOOLING.md §deleg8 |
| about to open, script, or read web page in browser                                                                                                                                          | {{CLAUDE_DIR}}/guardrails/TOOLING.md §browser |
| no row match but work feel risky                                                                                                                                                       | {{CLAUDE_DIR}}/guardrails/PLAN.md       |
| about to act on request with ANY ambiguity in scope, target files/symbols, or acceptance criteria — before list interpretation or guess most probable one                    | {{CLAUDE_DIR}}/guardrails/TASKS.md      |

Row match: write `TRIGGER: <event> -> <doc>`; next tool call Read that doc, same message, no acting tool call beside it (other trigger Read can batch with it). 2+ row match same time? Write one TRIGGER line per row, Read each match doc, table order, before any other tool call. Already Read doc since last compaction? Read again anyway — doc short, recall version drift. TRIGGER line whose next tool call not that Read — itself violation.

## Iron rules

- Before first Edit of file: Read enclosing function/class plus import block — Grep snippet not a Read; under 250 line, Read all (guess edit patch wrong code).
- Modify existing file with Edit, never Write — only exception: rewrite procedure in {{CLAUDE_DIR}}/guardrails/CODE.md; Edit fail twice → re-Read region, retry Edit (memory rewrite delete real code).
- After change any signature, symbol name, return shape, config key, route, CLI flag, env var, or enum member: run REFERENCE SWEEP per {{CLAUDE_DIR}}/guardrails/CODE.md (miss caller break silent).
- Before call unfamiliar or third-party API with 2+ arg: paste real signature per {{CLAUDE_DIR}}/guardrails/CODE.md C5 (plausible not real).
- Claim done/fixed/works/passing/complete/resolved/ready only beside fresh command output same turn; else report `EDITED-UNVERIFIED: <file>` (unrun code unknown code).
- Never write "should work", "should fix", "likely resolves", or "ought to now" — only two legal form in {{CLAUDE_DIR}}/guardrails/VERIFY.md: `Verified: <command> -> <result line>` / `UNVERIFIED — to confirm, run: <command>` (hedge hide skip run).
- Treat user stated bug location or cause as hypothesis; trace evidence to file:line before edit there (wrong premise waste fix).
- Change only line task require; log other finding as `NOTED (not done): <thing> <file:line>` (drive-by edit unreviewed bug).
- Never truthiness-check value that can be 0, "", or false — compare to null/undefined/None explicit; JS default use ?? (zero is data).
- About to write "probably / presumably / likely / I assume / should be" about this repo code: run Grep or Read that answer it instead (guess cost 10x lookup).
- Turn user state "don't / only / keep / stop": append verbatim to docs/STATE.md `## Constraints` — file missing? Create per {{CLAUDE_DIR}}/guardrails/SESSION.md S2 (unwrite constraint decay within 50 turn).
- Batch independent tool call into one message; between call write at most one line, finding and decision only — detail: {{CLAUDE_DIR}}/guardrails/EFFICIENCY.md E5/E6 (narration bury finding).
- Load deferred tool: ONE ToolSearch call list every tool task need — never one call per tool (each cost round-trip).
- Tool absent from deferred-tool list is absent, not slow: re-check with ToolSearch once, then proceed without it (wait on dead MCP server stall task).
<!-- END KIT CORE -->
