# Worked scenarios — one per axis

Each shows the *naive* move (grep/Read) and the tool that does it properly.

## 1. Semantic — "where is X implemented / how does Y work"
**Ask:** "Where do procedurally-generated models get cached?"
- Naive: `rg -i "cache"` → hundreds of unrelated hits.
- Do: lumen `semantic_search("where procedural part models are cached")` → ranks `ShipPartModelCache` by *meaning*, not keyword. Use first for any "where/how" question.

## 2. Impact / diff / blame / context — "what breaks if I change this"
**Ask:** "Is it safe to rename/modify `CrewStartGenerator`?"
- Naive: `rg CrewStartGenerator` → text hits, no transitive effect, no test awareness.
- Do: `sem impact CrewStartGenerator` → direct dependents + transitive cone + **affected tests**. For "who last touched this entity / how did it evolve": `sem blame` / `sem log <Entity>`. For a semantic diff of your changes: `sem diff`.

## 3. Call-graph — "who calls this function"
**Ask:** "Who calls `AuthenticateUser`?"
- Naive: `rg AuthenticateUser` → also matches strings, comments, definitions.
- Do: `grepai trace callers AuthenticateUser` (and `trace callees` for the reverse). Live-fresh if `grepai watch` is running.

## 4. AST patterns — "find/lint/rewrite a code shape"
**Ask:** "Find every empty catch block" / "replace `new SqlConnection(...)` with the factory."
- Naive: grep can't match nested/structured code reliably.
- Do: `ast-grep run --lang <lang> --pattern 'try { $$$ } catch ($_) { }'` to find; add `--rewrite` or a YAML rule to codemod. The only tool here that matches *shape* and edits it.

## 5. Metrics — "which code is risky to touch"
**Ask:** "Which functions are too complex to safely edit?"
- Naive: scroll and guess.
- Do: `lizard -w <path>` → functions over the complexity threshold (CCN/NLOC/params), worst first. Pair with `sem log` (churn) to find *complex AND frequently-changed* = highest-risk hotspots.

## 6. Runtime-trace → code — "what actually runs in prod, and how hot" (opt-in)
**Ask:** "Of these candidates, which run at scale — is this PR touching a hot path?"
- Naive: unknowable from source alone.
- Do: instrument with OpenTelemetry, then ingest traces into a runtime-aware index (jcodemunch — re-add `uvx jcodemunch-mcp` when needed) and query hot paths by symbol with p50/p95. **Not in the default stack**; add it only once OTel is wired. See `languages/<lang>.md` for the trace format per language.

## 7. Session memory — "did we decide this already"
**Ask:** "Have we discussed how to handle X before?"
- Naive: re-derive from scratch, repeat past mistakes.
- Do: agentmemory `memory_recall("X decision")` before starting; `memory_save(...)` when you reach a decision worth keeping.

---

**Composite move:** most real investigations chain these — e.g. lumen to *locate* a subsystem → `sem impact` to scope a change → `ast-grep` to apply it structurally → `lizard` to check you didn't add complexity → `memory_save` the decision.
