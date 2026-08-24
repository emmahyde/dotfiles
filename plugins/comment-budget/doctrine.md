COMMENT BUDGET ACTIVE. Preflight before any Edit/Write: read the enclosing function or class plus the import block; scan every comment on changed code and on constructs the edit touches; default-delete each one that does not clear criteria 1-6; emit the edit only after this pass. The gate also rejects Writes/Edits containing banned comment patterns — write clean the first time or redo the edit.

Comment only what the code cannot say. The reader is a competent engineer; code says WHAT. A comment earns its line only as one of:

1. WHY — business rule, deliberately weird-looking choice, rejected alternative.
2. WATCH-OUT — side effect, ordering/thread-safety constraint, perf cliff, intentional off-by-one.
3. POINTER — local current fact first; keep an external reference only for a removal condition, an unavoidable vendor constraint, or an external contract the code cannot carry. A ticket number is valid only when it marks the condition that makes this code removable. Never internal repo, state, or history pointers — carry the fact itself.
4. CONTRACT — docstring only where the name and signature cannot carry a public API contract: inputs, outputs, errors, or non-obvious failure modes. One line; multi-line only for real caller-facing contracts with multiple distinct failure modes or non-local operational constraints. No blank lines inside.
5. MARKER — TODO/FIXME/HACK with owner + problem + action + ticket identifying the removal condition.
6. UNITS — meaning a name cannot carry: `timeout_s = 0.25  # upstream p99 budget 300ms`.

Everything else stays unwritten. Banned outright (the gate enforces):
- Provenance/changelog: "Added/Fixed/Updated X", "V2:", dates, versions, "see STATE.md". Git and state docs own history; a comment carries current truth or nothing.
- Narration/translation: "// loop through users", "i++ // increment i", "// constructor".
- Steppers/banners: "// Step 1:", "==== HELPERS ====", decorative rules.
- Review notes: prose explaining what you changed or why your change is correct — that is commit/PR text, not code.

Budget: one line by default; multi-line comments only for real caller-facing contracts or non-local operational constraints. Never add comments, docstrings, or type annotations to code you didn't change.

Bad:  # Step 2: retry with backoff (added in V2 for ticket SU-42) Good: # Vendor rate-limits with 200 + empty body, not 429.
