# guardrails kit

Just-in-time instruction loader for Claude Code. `~/.claude/CLAUDE.md` is a dispatch table, not a style guide: it maps observable events to the doc that handles them, and the model Reads that doc at the moment of action rather than carrying all of it always-on.

The premise is in `_FORMAT.md`'s reference section and governs everything else: always-on compliance is roughly constant-sum, so every rule added over the budget silently taxes obedience to all the others. Budgets are the point. Adding a rule means demoting one.

## Docs

| file | fires when | IDs |
|---|---|---|
| `PLAN.md` | task needs >2 file edits, or >1 top-level directory, or nothing else matched | P1–P9 |
| `TASKS.md` | request has ANY ambiguity in scope, target files/symbols, or acceptance criteria | TQ1–TQ5 |
| `CODE.md` | about to create or modify a repo source file, first time this session | C1–C15, RS1–RS5 |
| `DEBUG.md` | a command exited non-zero, a test failed, output contradicted a prediction | D1–D10, L1–L5 |
| `VERIFY.md` | about to write "done/fixed/works/passing", or run `git commit` / `gh pr create` | V1–V12 |
| `WRITING.md` | about to write or heavily rewrite markdown deliverables or token-trim rewrites | W-ONEJOB, W-PROMOTE-LABELS, W-BULLETS, W-PRESERVE, W-DOC-SHAPE |
| `EFFICIENCY.md` | about to Read a 3rd file over 300 lines, or a search returned >50 hits | E1–E17 |
| `SESSION.md` | returned from compaction or /resume, user paused, or no `docs/STATE.md` | S1–S7 |
| `TRAPS.md` | touching dates, epochs, mutation, async, floats, sort, division, regex, closures, booleans | T-rows |
| `_FORMAT.md` | about to edit CLAUDE.md or any kit doc | F1–F15 |
| `TOOLING.md` | **not kit text** — user tool-stack playbook (tokensave, deleg8, browser), edit freely | §sections |

## Source files

| file | role |
|---|---|
| `~/.claude/rules/markdown-writing.md` | source-only rationale/examples for `WRITING.md`; not routed at runtime |

Checklist IDs are stable forever (F12): never renumbered, never reused after retirement.

## Versions

Each kit file carries `<!-- guardrails-kit: vN.N -->` on its first line. F15 requires bumping it on every edit and adding an entry below.

## Upgrade notes

### v1.14 — 2026-07-27 — W-DIAGRAM-OPTIN retired; diagrams are welcome

User directive, verbatim: "thats ridiculous, please remove. i LOVE diagrams!" **W-DIAGRAM-OPTIN is retired — never reuse the ID** (F12). This entry is its sole retirement registry.

The rule gated fenced `text`/`ascii`/diagram blocks behind an explicit user request. Removed in full. Two adjacent anti-diagram nudges went with it in the same pass, because retiring only the named ID would have left the bias operating unnamed:

- `W-PRESERVE-CUTS` listed `diagrams` in its cut-before-evidence ordering. Diagrams moved to the protected side: `-> never evidence or diagrams`.
- The F13 BAD exemplar used "added an unrequested `ascii` overview diagram" as half its cautionary case. Rewritten to keep the reflow lesson only (`reflow ... that bury the file refs`), since exemplars steer imitation more strongly than prohibitions and this one was teaching diagram-avoidance by demonstration.

Rationale for the original rule, now overridden: it existed to stop decorative ASCII padding a token-trim response. That concern is already covered by `W-ONEJOB` and `W-PRESERVE-CLAIMS`, which police whether content does a job — a diagram that carries structure does one. The opt-in gate could not tell a load-bearing diagram from decoration, so it suppressed both. Net effect: WRITING.md drops from 6 IDs to 5.

### v1.13 — 2026-07-27 — semantic ID tokens replace sequence numbers (WRITING.md first)

User directive: rule IDs are never bare sequence numbers — each gets a semantic `<PREFIX>-<TOKEN>` name recognizable "like a branch name". F12 amended (F12a/F12b); other docs' numeric IDs persist until each is next deliberately edited. WRITING.md renamed in full — this entry is the sole retirement registry (never reuse any `W`+digit ID): W1→W-ONEJOB (W1a→W-ONEJOB-DENSITY, W1b→W-ONEJOB-STACK), W2→W-PROMOTE-LABELS, W4→W-BULLETS, W5→W-PRESERVE (W5a→W-PRESERVE-CLAIMS, W5b→W-PRESERVE-CUTS), W7→W-DIAGRAM-OPTIN, W8→W-DOC-SHAPE (W8a→W-DOC-SHAPE-OPEN, W8b→W-DOC-SHAPE-ORDER). Rationale: numeric citations ("W3 fired") carry zero meaning at point of use, invite gap-filling reuse mistakes, and force a lookup to interpret; semantic tokens make citations self-evident and greppable. Also generalized to a conversation-wide rule: new `## Project` line in `~/.claude/CLAUDE.md` — any minted identifier (rule IDs, task labels, agent/branch names) gets a semantic `PREFIX-TOKEN` name, never a sequence number.

### v1.12 — 2026-07-27 — WRITING.md consolidated to 6 IDs

User request ("improve for models like you"). Consolidated 10 rules to 6 by folding same-job rules into sub-lines: W3→W1 (one-job-per-paragraph), W10→W1b, W6→W5b, W9→W8a. This entry is the sole registry of those retirements (F12: never reuse W3/W6/W9/W10; next free ID is W11) — living docs list current IDs only, history stays here. Rationale: instruction-following compliance decays multiplicatively with rule count, so fewer top-level IDs buy obedience to the survivors; the tells stayed byte-identical, only the grouping changed. Added a one-line `Target:` statement before the checklist (states the end-state so stronger models generalize past the literal tripwires) and the previously-missing F13 GOOD/BAD pair below the divider — a 6-line mini-transcript replacing the near-empty "same content" reference stub, whose content now lives in W5a/W5b. Tension flagged: v1.9 deliberately thinned runtime examples into `rules/markdown-writing.md`; the new pair is kept because exemplars steer imitation better than prohibitions and it is within F13 budget. Revert the pair first if runtime load becomes a concern.

### v1.11 — 2026-07-25 — web/SaaS analogies added

User preference. Added a Project-layer rule to use web or SaaS architecture analogies when they clarify unfamiliar concepts, especially in game and systems architecture discussions.

### v1.10 — 2026-07-25 — TASKS.md added

User request: task-framework.py (UserPromptSubmit hook, fires once per session) was too easy to drift off mid-session. Added a `TASKS.md` routing row so the clarify-then-decompose procedure re-arms every time genuine ambiguity is detected, not just at session start. Removed two hooks in the same pass: `verification-narration-guard.py` (Stop, unwanted) and `write-over-existing-guard.sh` (PreToolUse Write, user judged the ask-prompt unnecessary).

### v1.9 — 2026-07-25 — WRITING source file added, runtime doc thinned

User request. Added `~/.claude/rules/markdown-writing.md` as the authoring source for rationale, examples, and future-rule notes, then cut `~/.claude/guardrails/WRITING.md` down to checklist + two short reference lines.

Progressive disclosure improvement: runtime loads the compact execution contract; humans editing the system get the richer guidance in `rules/`. This keeps the behavior while shrinking the routed prompt surface.

### v1.8 — 2026-07-25 — markdown shaping routed into WRITING.md

User request. Added `~/.claude/guardrails/WRITING.md` plus one routing row in `~/.claude/CLAUDE.md`, then deleted the six always-on Project-layer markdown-shaping lines added in v1.7.

Net effect: the behavior stays, but the cost moves from every session to only the turns that are actually writing `docs/STATE.md`, status/worklog/context docs, reports, audits, specs, or token-trim rewrites.

### v1.7 — 2026-07-25 — status/worklog shaping added to Project layer

User request. Added six Project-layer behavioral lines to `~/.claude/CLAUDE.md` for `status`, `worklog`, `context`, `docs/STATE.md`, `report`, and `audit` writing: observable draft triggers (`;` twice, inline `Where:` / `Conflict:` labels), explicit preservation constraints (`same content`, `comparable token output`, `trim`, `more digestible`), and an opt-in rule for fenced `text` diagrams.

Kept in `## Project`, not kit core: this is user-preference output shaping, not a universal routing or safety rule. The lines key off tokens the model can detect while drafting (`Where:`, `Conflict:`, `same content`, fenced `text`) rather than vague style labels, matching `_FORMAT.md` F2/F9.

### v1.1 — 2026-07-24 — Opus 5 recalibration

Source: `~/.claude/PROPOSAL-opus5.md` (findings D1–D7, R1–R4). Net effect ≈ −85 always-on lines against a measured Σ 517, concentrated in text that was unsatisfiable or dead.

- **D1 — `~/.claude/rules/lean-ctx.md` deleted (−48 lines).** It mandated a `ctx_*` tool namespace with zero occurrences in `settings.json`, closing on an unsatisfiable `NEVER use native Read/Grep/Shell`. It also duplicated — and disagreed with — `TOOLING.md §contextmode`, which names the real `mcp__plugin_contextmode-v2_contextmode__*` tools correctly. An unsatisfiable mandate teaches that mandates are advisory; the cost was the credibility of every other rule, not the lines.
- **D6 — this file created.** F15 instructed every kit edit to write here, and it did not exist.
- **D2 — tokensave block moved to `TOOLING.md`, replaced by one iron rule.** ~30 lines at maximum force ("No exceptions. No rationalizing.") for a capability indexed in only 2 of N projects. Measured: 93 calls / 2.0M tokens saved in `~/projects/sector` over 30d, 0 / 0 in `~/projects/sector-unity-proto`. The tool earns its keep where it is indexed; the unconditional framing did not. Note the provenance — `tokensave install` writes prompt rules, so third-party installers spend the obedience budget and `_FORMAT.md` does not govern them.
- **D5 — F3/F8 restored in CLAUDE.md.** Two routing tables merged into one. Tool-specific blocks moved to `TOOLING.md`. The post-compaction re-arm line returned to last position; it had been buried under ~40 lines of conditional tool text, losing the recency it exists for.
- **D7 — subagent-model rule dropped.** `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-5` in `settings.json` contradicted the prompt's "default `model: haiku`" and won silently at spawn time. The enforced source kept, the asking source deleted.
- **D4 — non-git evidence path added to SESSION S1.** `git status` / `git diff --stat HEAD` / `git diff -- <file>` are load-bearing in S1, S2, V8, C11, P5 and DEBUG's stash-and-rerun. `~/projects/sector-unity-proto` is not a repo, and neither is `~/.claude`. Those steps were resolving to `N/A`, which is worse than no rule: it trains the habit that emitting `N/A` satisfies a checklist. Replaced by `shasum` + `ls -lT` before/after.
- **R2 — CODE.md trigger narrowed to source files.** The routing row read "create or modify a repo file" and fired 40 lines of C1–C15 code discipline for writing a markdown document. Now "source file", with markdown under `.claude/`, `skills/`, `agents/` named as still counting.
- **R4 — two iron rules added for deferred tools.** `ENABLE_TOOL_SEARCH=1` defers MCP tools, and servers churn mid-session. Batch the `ToolSearch` loads; treat an absent tool as absent rather than waiting on it. Two of the three free slots used; one left as headroom, since headroom is protective under a constant-sum thesis.
- **D3 (in progress) — mechanically-checkable rules migrating to `PreToolUse` hooks.** A hook blocks regardless of obedience; a CAPS line only asks. Where both exist the prompt text is redundant and is spending a rationed budget. Prompt text is deleted only after the corresponding hook is observed firing, never before.
- **R1 (deferred) — conditional tool-block injection via a `SessionStart` hook.** Strictly better than static text, but it adds dynamic prompt assembly to a system that has none, and a bug in it fails silently. Scheduled after the static cleanup proves out.
- **R3 (deferred, low confidence) — thinning the ceremonial verb-echoes.** Audit-trail echoes (`Verified:`, `EDITED-UNVERIFIED:`, `ATTEMPT:`, `DECISION:`, `NOTED (not done):`) record facts not otherwise recoverable and stay. `ANCHOR:`, `(cached: <IDs>)`, and per-file `CONSTRAINT CHECK:` mostly restate intent the following tool calls already show. Held back deliberately: these are load-bearing exactly at the moments of degradation, and their absence fails silently — drift surfaces 60 turns later, not immediately.

### v1.2 — 2026-07-24 — rtk fully uninstalled

User request. Removed: Homebrew formula `rtk` 0.42.4 and the `rtk-ai/tap`; the `PreToolUse` Bash hook `rtk hook claude` in `settings.json`; `~/.claude/RTK.md` and its `@RTK.md` import from CLAUDE.md; `TOOLING.md §rtk`; `~/Library/Application Support/rtk/`; `~/.config/fish/functions/rtku.fish`; per-project `.rtk` caches; `~/.headroom/.rtk_poll_lock`; the `~/projects/external_references/rtk` checkout; the `pi-rtk-optimizer` omp extension and its bun cache entry.

Also removed three memory/skill files that had become D1-shaped — mandates for a tool that no longer exists: `memory/consolidated/native/rtk_is_mandatory.md` ("Always use rtk wrappers ... never raw commands"), `memory/consolidated/memesis/rtk-tooling.md`, `memory/consolidated/rtk-uv-toolchain.md`, and `skills/find-skill/references/rtk-tips.md`. Incidental mentions in `MEMORY.md`, the feedback-stack-invariants pair, `apsw-removal-and-uv.md`, and `find-skill/SKILL.md` were edited rather than deleted.

Worth noting as a pattern, not a one-off: uninstalling one tool left unsatisfiable mandates in four separate files across two subsystems. Tool-generated prompt rules (`tokensave install` writes them too) have no uninstall path that touches the prompt layer. Any future tool adoption should record its prompt-surface in this file so removal is a checklist rather than a grep.

**Known open question:** F3's "kit core + footer <=60 lines" does not say whether `## Project` counts against it. Left unresolved rather than silently picking a reading.

### v1.3 — 2026-07-24 — contextmode-v2, code-aware, codemode-mcp removed

User request. Removed: the `contextmode-v2` plugin (enabledPlugins entry, `plugins/installed_plugins.json` and `plugins/known_marketplaces.json` registrations, `plugins/cache/contextmode-v2/`); the orphaned `code-aware` plugin (`plugins/code-aware/`, `plugins/cache/emmahyde/code-aware/` — was cached but not registered in `installed_plugins.json` or `enabledPlugins`, so it was already dead weight); the `codemode-mcp` marketplace registration (`extraKnownMarketplaces` in `settings.json`, `plugins/known_marketplaces.json`, `plugins/marketplaces/codemode-mcp/`); leftover state files `~/.claude/.codemode-burst-state.json`, `.codemode-bloat-state.json`, and the `~/.claude/context-mode/` session-log directory.

CLAUDE.md's routing table lost the §contextmode row entirely (no replacement mechanism — Bash remains the fallback for large/chained output) and the tokensave row's fallback changed from `the investigate skill (not grep)` to `Grep/Glob directly`, since `investigate` shipped inside the now-deleted code-aware plugin. `TOOLING.md` lost the `§contextmode` section and one `contextmode` research mention under `§browser`.

The `mksglu/context-mode` marketplace entry (a different, never-installed plugin — note the missing hyphen) was left alone: not named by the user, not enabled, not a live dependency of anything removed here.

### v1.4 — 2026-07-24 — D3 hooks written and registered

Four `PreToolUse` hooks added to `~/.claude/hooks/` and registered in `settings.json`, all unit-tested against positive and negative payloads before registration (16/16 correct):

- `git-push-guard.sh` (Bash matcher) — any `git push`, including flag forms like `git -C <dir> push`, returns `permissionDecision: "ask"` rather than deny: the hard stop's exception ("unless the user asked in this conversation") is conversation state a hook cannot see, so it pauses for approval instead of blocking.
- `kill-by-name-guard.sh` (Bash matcher) — `pkill`/`killall`/`taskkill /IM` are hard-denied with the `lsof -ti :PORT` remedy in the deny message. `kill <PID>` and `kill $(lsof -ti :PORT)` pass.
- `write-over-existing-guard.sh` (Write matcher) — Write targeting an existing file returns `"ask"`, naming iron rule 2 and the CODE.md rewrite exception. Ask, not deny, because the sanctioned rewrite procedure is legitimate and hook-invisible.
- `generated-file-read-guard.sh` (Read matcher, appended to the existing Read group) — lockfiles, `node_modules/`, `dist/`, `.min.*`, `.map` are hard-denied with the query-surgically-via-Bash remedy (EFFICIENCY E12).

Checked `verification-narration-guard.py` first per the task prerequisite: it is a Stop hook, warn-only, covering only the self-congratulation tic — it enforces nothing from VERIFY's checklist, so no VERIFY text was deleted on its account.

**No prompt text deleted yet.** Hooks are snapshotted at session start, so none of these can fire in the session that wrote them. Per the D3 sequencing rule (delete only after a hook is observed firing), the corresponding CLAUDE.md lines — hard stops 2 and 3, iron rule 2 — stay until a later session observes each hook fire. When that happens: delete the line, bump the kit version, add the entry here. Note the prompt lines carry the *reason* ("publication is irreversible") that the hook message now duplicates — the deny/ask messages were written to preserve that teaching so the deletion loses nothing.

### v1.5 — 2026-07-24 — R1 SessionStart capability detection

`session-capabilities.sh` added as a `SessionStart` hook: detects per-project facts at session start and injects them as `additionalContext`, so static kit text never has to carry per-project conditionality. Currently detects two things: whether `.tokensave/` exists in the cwd (points at `TOOLING.md §tokensave` when present, says "do not reference tokensave" when absent) and whether the cwd is a git repository (when not, pre-arms the SESSION.md S1 `shasum`/`ls -lT` substitute so the non-git path is loaded before the first `N/A` temptation). Fail-safe by construction: any error — bad payload, missing cwd, jq failure — exits 0 with no output, so a broken detector can never block session start. Unit-tested against four scenarios (non-git+no-index, git+index, bogus cwd, empty stdin) before registration.

The CLAUDE.md routing rows stay: the tokensave row is already conditional inline (`.tokensave/ exists → …`), and the hook complements rather than duplicates it — the row governs the moment of discovery, the hook pre-loads the fact at session start. No prompt deletion is gated on this hook.

Found while registering: `context-mode-cache-heal.mjs` is still a registered `SessionStart` hook but heals the cache of the contextmode plugin removed in v1.3 — it now no-ops every session. Left in place pending user approval to delete.

### v1.6 — 2026-07-24 — R3 verb-echo thinning

Three ceremony reductions, all keeping the echo at the degradation moment it protects and cutting only the routine repetitions:

- **`(cached: <IDs>)` deleted entirely** (CLAUDE.md routing preamble and the footer re-arm line). The shortcut asked the model to prove recall by listing checklist IDs from memory — but listing IDs proves recall of the IDs, not the items, so it was ceremony with a loophole. Replaced by the stricter, simpler rule: a matched row always Reads the doc, even if read earlier this session. Docs are ~120 lines; the re-read is cheaper than one obeyed-from-stale-memory violation.
- **`ANCHOR:` (SESSION S4) narrowed** from every-TodoWrite-item to: after any RETURNING line, and at the first plan step after a compaction or /resume. Those are exactly the moments goal-drift happens; the per-step repetitions in a healthy run restated intent the next tool call already showed.
- **`CONSTRAINT CHECK:` (CODE C4 / SESSION S7) rate-limited**: per-file only while `## Constraints` is non-empty; an empty or missing list gets one check per task. A per-file "none apply" against an empty list was pure ceremony; a non-empty list still gets the per-file check because that is the case the mechanism exists for.

Audit-trail echoes untouched, as planned: `Verified:`, `EDITED-UNVERIFIED:`, `ATTEMPT:`, `DECISION:`, `NOTED (not done):` record facts not otherwise recoverable from the transcript. This was the lowest-confidence change in the proposal — if constraint violations or goal drift increase over the next few weeks, revert S4/S7 first.
