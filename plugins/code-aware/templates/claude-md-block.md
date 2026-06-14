- Use specific subagents, not bare Explore.
- Check logs first on issues.
- Never wait for confirmation; user stops if needed.
- Editing markdown w/ Edit tool: never start a body row with `---` (horizontal rule) — tool parses it as a deleted context row. Use `***` or blank separator.

## Codebase investigation — prefer the tools over grep/Read

**NEVER assume functionality without a source-verification check.** Names, signatures, and memory are not evidence — confirm behavior against the actual source: external libraries/packages via `ctx7` (`ctx7 library <name>` → `ctx7 docs <id> "<query>"`) plus reading the installed package source; internal code via the tools below plus reading the real definition.

Installed code-intelligence stack: **lumen** (semantic search), **sem** (impact/diff/blame/dependency chains), **grepai** (call-graph), **ast-grep** (structural patterns), **lizard** (complexity — not on PATH; run via `uvx lizard`), **ctx7** (up-to-date external library/package docs). Prioritize these over Grep/Glob/Read whenever *discovering, understanding, or tracing relationships* — they resolve meaning, structure, and dependency edges that text search cannot. Route via the `codebase-investigation` skill. Plain grep/Read is only for an exact literal string you already know, or a file you've already located.

- **Critique/audit identities (e.g. `/verify`, `/code-review`, `/security-review`): trace to source.** They demand an utterly clear-eyed view of the *entire functional surface area* — walk the full inheritance and dependency chains, and trace packages/symbols through to their real source code (and `ctx7` for external library APIs) rather than trusting names or signatures. A critique is only as good as how completely it maps what the code actually touches.
- **Scope before building (implementer / planner / orchestrator).** Before fixing the acceptance criteria of a task, automatically get a conservative "lay of the land": map the surrounding patterns and functionality first; mentally model the **state machine** (states, transitions, invariants) for the behavior you're scoping; and identify concerns beyond the immediate code area — above all, **what state the primary mechanisms will be in when your changed code actually executes**. The defect usually lives in assumed runtime state, not the edited lines.
