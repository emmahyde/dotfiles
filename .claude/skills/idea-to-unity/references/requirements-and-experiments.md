# Requirements depth and question-driven experiments

## Choose depth by risk

Use the smallest interview that resolves the decisions needed for the next experiment. Do not turn every visual sketch into a technical specification. Deepen the interview for ambiguous behavior, several system dependencies, persistence, multiplayer, demanding performance, or costly integration. Reuse answers and verified project facts; do not restart the conversation.

Borrow the five lenses below as needed during normal idea exploration. When the human explicitly requests a full requirements interview, work through all five in order, summarize each phase, and obtain confirmation or corrections before advancing. Keep that mode code-free until the brief and scope are confirmed. Record non-applicable concerns with a reason instead of inventing requirements.

## Specification interview: resolve one decision at a time

1. During specification, ask one decision question at a time and wait for feedback. Include a recommended answer, a short reason, and the main trade-off; make clear that a recommendation is not an approved requirement. This overrides the creative questionnaire's 2–4-question batches.
2. Walk the consequential branches of the design tree in dependency order: resolve the rule or boundary that downstream choices depend on first. Maintain a compact list of resolved, open, and dependent decisions. Do not ask the human questions that current code or documentation can answer.
3. Inspect relevant domain documentation alongside code. If a root `CONTEXT-MAP.md` exists, follow it to the relevant context's glossary and decisions. Otherwise use the relevant `CONTEXT.md` and `docs/adr/` if present. Do not assume these files exist or create a documentation hierarchy merely to conduct an interview.
4. Challenge fuzzy or overloaded terms by proposing a precise domain term. Surface conflicts with the existing glossary immediately, quoting the definitions involved. Check claims about current behavior against the implementing code. Distinguish intended changes from misunderstandings; ask which meaning or behavior is intended rather than automatically privileging either.
5. Stress-test rules and relationships with concrete scenarios: interruption halfway through, two actors competing, empty resources, or a reload after commitment. Explain which boundary the scenario tests. Adapt to the feature; do not mechanically enumerate irrelevant failures.
6. Capture each resolved domain term immediately in the relevant glossary when documentation updates are authorized. Keep `CONTEXT.md` a domain glossary only: context title, short domain description, a `Language` section, and entries with a canonical term, a one- or two-sentence definition, and `_Avoid_` synonyms when useful. Exclude implementation choices, generic programming terms, and the feature spec. Create a missing glossary only when there is a real term to record and creation is in scope; otherwise keep the resolution in the conversation.
7. Offer an ADR only when the choice is hard to reverse, surprising without its context, and the result of a genuine trade-off. If accepted, use the existing context's convention; otherwise use the next `docs/adr/NNNN-slug.md` with a short title and one to three sentences stating the decision and why. Create the directory only when needed. Do not turn ordinary parameter tuning into an ADR.
8. Summarize the resolved branch before moving downstream. Keep genuinely undecided creative dimensions viable for variation; if they block the spec, propose a small discriminating experiment rather than forcing a choice. Finish when consequential branches have shared answers, explicit exclusions, or named open decisions with a resolution path—not when every imaginable detail has been discussed. Remain code-free while the specification is being agreed.


## 1. Scope and boundaries

Establish what the feature does, what it explicitly does not do, who uses it, what triggers it, and what observable output it produces. Distinguish the player-facing feature from designer tooling and developer-only preview controls. State exclusions such as “no new configuration panel” rather than letting scaffolding become implicit scope.

Summarize the boundary and invite correction before expensive exploration. Preserve the experience questions from the main questionnaire: visual discovery, encounter, introduction, surfacing, interaction, world impact, challenge, and feel remain essential.

## 2. Verified technical context

Use available project instructions and current source before asking technical questions. For Unity, verify the version from `ProjectSettings/ProjectVersion.txt`, available packages from `Packages/manifest.json`, relevant render/platform settings, and nearby assembly definitions. Inspect the relevant subsystem rather than scanning the whole project by default.

Ask only about unresolved choices that affect the feature: expected load, target hardware, performance budget, persistence, physics, UI, animation, audio, asset loading, or networking. For anything that ticks, ask which clock it runs on: fixed step, variable frame, or hybrid; time compression makes this a real choice, not a default. Do not ask mobile, WebGL, multiplayer, or draw-call questions mechanically when they do not apply. Distinguish installed packages from systems actually used by this feature.

Treat unsupported capabilities as technical unknowns. Treat undecided creative choices as viable for variation. Do not invent FPS, memory ceilings, save formats, or network authority. Propose a concrete measurement scenario when a budget needs agreement; label it proposed until confirmed. Seed technical unknowns from the "breaks when" line of the relevant principle: far/near clip ratio for anything that spans scales, perspective versus orthographic for anything map-like, depth precision for coplanar surfaces.

Vocabulary from general game-architecture references (fixed timestep, state machines, batching, culling, LOD, instancing) is welcome; their code and their subsystem choices are not. Entity-component frameworks, multiplayer, pathfinding, and other engine-agnostic patterns are not applicable unless the project manifest shows them in use. The project's own pipeline and architecture documents outrank any general reference.

## 3. Relevant edge cases

For each consequential component, consider missing assets or invalid data, empty/minimum/maximum values, interruption, repeated actions, scene transitions, async completion after destruction, platform/build differences, and reset or reload. For interruption, list the feature's states and the allowed transitions between them, then ask what happens when each state is interrupted; the state list is the artifact, not a state-machine library. Consider expected and stress loads where they could change the design; do not automatically build for an arbitrary 100x load.

Prioritize cases that could invalidate the concept, damage real state, or force integration changes. Present the case and expected behavior together. Ask what is missing and what should be explicitly excluded. Mark low-value cases deferred rather than implementing speculative robustness in a sketch.

## 4. Integration and ownership

Map the actual systems read from, written to, or subscribed to. Identify the owner of each state, who may mutate it, event direction, lifecycle, and intended assembly placement. Use actual message names only when verified; do not assume MessagePipe or add a messaging package because an interview template mentions it.

Use a small text diagram when several systems interact, with named read/write/event directions. Distinguish the intended production path from temporary harness inputs. List genuinely new packages, assets, or services with their benefit and cost; prefer existing capabilities. Verify existing assembly and test conventions before assigning scripts to them.

## 5. Acceptance and a proportional feature brief

Write independently testable, numbered criteria with concrete conditions and expected results. Include at least one negative criterion. For a systemic or gameplay feature, two criteria are mandatory: no acceptance surface is a debug tab or inspector (the player reads the consequence in play), and the consequence survives save and load. Include a performance criterion when relevant, with agreed load, hardware/context, and measurement method; the project's performance experiment card is that method when one exists. Do not replace unknown budgets with invented numbers. Resolve build-blocking unknowns before the affected work; let unrelated visual exploration continue.

Ask the human to confirm or adjust material criteria. Example negative criterion: “Cancel before commitment leaves the resource quantity unchanged.” For feel, pair the human's judgment with a repeatable scenario rather than claiming a number proves enjoyment. When the human asks "is this a game yet", offer the 2am test as the definition of done: the sim produces, names, and persists one story the player could retell, with the player's part credited.

For a large feature or full interview, use this brief structure. For a small experiment, compress it to the facts needed for that decision. Keep it in the conversation or an existing project record unless a file is requested.

- **Scope:** does, does not, audience, trigger, output.
- **Experience:** visual anchors, interaction, world consequence, challenge, intended feel.
- **Technical requirements:** verified Unity version, pipeline, targets, subsystems, budgets, persistence/networking if applicable.
- **Edge cases:** case and agreed behavior, including exclusions.
- **Integration:** system, direction, state owner, verified messages/events; include the small flow diagram when useful.
- **Placement:** actual runtime and test assemblies, or explicitly not applicable for an artifact-only study.
- **Acceptance criteria:** numbered checklist, including negative and relevant performance checks.
- **Open dimensions:** confirmed choices, viable variations, assumptions, technical unknowns.
- **Complexity and next approach:** simple/moderate/complex with a reason; smallest next experiment and approval scope. Name specialist assistance only when useful, not as mandatory overhead.

## Give every prototype a question and an exit

Before creating an artifact, state one primary question and what evidence will let the human answer it. Separate appearance, logic/state, and native feel/integration questions. For mixed requests, run the smallest linked experiments rather than building a complete application to answer all questions at once.

Use this compact experiment card in the conversation:

- **Question:** what uncertainty is being tested?
- **Evidence:** what will be seen or exercised, under which scenario?
- **Medium and real context:** why this viewer, scene, diagram, or harness; which existing component or contract does it use?
- **Run/reset:** one existing command or direct preview link, plus a simple reset when interactive.
- **Stop condition:** what observation or human decision ends this experiment?

Do not create a new README, runtime, task runner, route, or dashboard merely to hold the card or launch the experiment. Prefer the existing project command. Script repeated multi-step setup only when the time and token savings justify it.

## Apply the prototype branches selectively

For logic/state questions, first show the transition diagram or action sequence. If manual exploration is needed, drive the real reusable logic through the smallest existing command or native harness. Keep input/output scaffolding separate from domain behavior. A tiny terminal driver is appropriate only when it answers the question more cheaply than the existing Unity path; do not duplicate C# game rules in another language.

For appearance questions, make structurally distinct variants in the existing viewer or real host context and compare contact sheets. Preserve surrounding density, camera scale, materials, and representative data. Do not mandate web routes, URL parameters, or a floating switcher. Reuse a switcher only if one already exists and helps; add preview controls only when requested or strictly necessary to exercise the feature. Do not cap cheap visual exploration at five if a readable contact sheet can usefully show more.

For timing, lighting, interaction feel, or integration questions, use approved native iteration rather than a terminal or browser simulation. Keep the approval and shared-production safeguards from the main workflow.

## Keep scaffolding disposable, decisions reusable

Mark temporary harnesses and experiments clearly, locate them near the relevant feature using project conventions, and keep them out of production paths. Treat the harness as disposable, not the real components, source-linked assets, or validated domain logic. Avoid a blanket rewrite at integration time.

Default experimental mutable state to memory with a reset. Do not add persistence or touch real saves/accounts. If persistence is the question, use an explicitly identified scratch store. Existing read-only representative data, saved design recipes, and capture outputs are not a reason to build a persistence subsystem.

After an action or variant switch, expose all state relevant to the question: before/after values, current mode, selected variant, and important consequences. Use existing logs, runner results, inspector fields, or captures rather than a diagnostic dashboard. Do not dump irrelevant or sensitive state.

Skip polish, speculative abstractions, and broad test suites for disposable scaffolding. Still run it, inspect its output, and preserve necessary safety/error handling. Changes to shared or production code still require the repository's normal verification; “prototype” is not an exemption from proving that the affected path works.

When the question is answered, record the decision and evidence in the conversation or existing durable project record. If human review is pending, mark the verdict pending rather than choosing for them. Remove only the temporary scaffolding created for the experiment when safe and authorized; retain useful evidence and source recipes. Absorb approved reusable work through the normal integration gate, not by shipping the preview shell. Do not delete user-owned or still-needed variants without permission.
