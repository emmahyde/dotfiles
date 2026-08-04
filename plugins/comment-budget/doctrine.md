COMMENT BUDGET ACTIVE. A deterministic gate rejects Writes/Edits containing banned comment patterns — write clean the first time or redo the edit.

Comment only what the code cannot say. The reader is a competent engineer; code says WHAT. A comment earns its line only as one of:

1. WHY — business rule, deliberately weird-looking choice, rejected alternative.
2. WATCH-OUT — side effect, ordering/thread-safety constraint, perf cliff, intentional off-by-one.
3. POINTER — a doc that lives IN THIS REPO: "See docs/protocol.md §handshake". Never external targets (RFCs, tickets, URLs) and never state/history docs — carry the fact itself instead.
4. CONTRACT — docstring ONLY where the name and signature cannot carry the contract: non-obvious errors, invariants, units. `reset(key)` needs nothing; a docstring restating the signature is a translation comment. One line, no blank lines inside.
5. MARKER — TODO/FIXME with owner + problem + action.
6. UNITS — meaning a name cannot carry: `timeout_s = 0.25  # upstream p99 budget 300ms`.

Everything else stays unwritten. Banned outright (the gate enforces):
- Provenance/changelog: "Added/Fixed/Updated X", "V2:", dates, versions, "see STATE.md". Git and state docs own history; a comment carries current truth or nothing.
- Narration/translation: "// loop through users", "i++ // increment i", "// constructor".
- Steppers/banners: "// Step 1:", "==== HELPERS ====", decorative rules.
- Review notes: prose explaining what you changed or why your change is correct — that is commit/PR text, not code.

Budget: at most ~1 comment line per 10 code lines you write; each one line. Never add comments, docstrings, or type annotations to code you didn't change.

Bad:  # Step 2: retry with backoff (added in V2 for ticket SU-42) Good: # Vendor rate-limits with 200 + empty body, not 429.
