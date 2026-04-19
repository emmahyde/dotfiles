---
name: scene-architecture-review
description: Use when a Godot scene, UI flow, gameplay system, or scene-heavy feature needs an architecture review that evaluates scene composition, node responsibility, script ownership, signals, autoload usage, and reuse boundaries, then returns concrete refactor options without collapsing into a generic clean-code review.
---

# Scene Architecture Review

Use this skill when a Godot project needs an architectural review of **scene composition, node hierarchy, script ownership, signal flow, autoload boundaries, and UI/gameplay separation**.

This skill is for reviewing how a Godot system is **assembled and owned**, not for giving a generic OOP or style lecture. Its job is to identify whether a scene or scene-based system has healthy boundaries, where coupling is accumulating, and which refactor directions would reduce future change cost.

## Purpose

This skill is used to:

- evaluate whether scene split and composition boundaries are reasonable
- identify overloaded node hierarchies or god-object style orchestration
- assess whether script ownership is clear and appropriately placed
- review whether signals, direct references, and autoloads are being used in healthy proportions
- detect excessive coupling between UI and gameplay logic
- judge whether reusable scene boundaries are clear enough to support iteration and testing
- produce a structured architecture review with concrete refactor options and verification impact

## Use this skill when

Invoke this skill for requests such as:

- reviewing a messy or fragile scene structure
- deciding whether a feature should stay in one scene or be split
- checking whether a controller, root node, or manager script owns too much
- assessing whether UI and gameplay responsibilities are too tightly wired together
- auditing signal usage, direct node references, or autoload growth
- evaluating maintainability before a refactor or feature extension

### Trigger examples

- "This scene structure feels messy"
- "Am I overusing autoloads?"
- "Is this Godot UI too tightly coupled to gameplay?"
- "Should this feature be split into its own scene?"

## Do not use this skill when

Do not use this skill when:

- the task is only a formatting, naming, or general code-style review
- the user already knows the exact architectural change and only wants implementation
- the problem is primarily a runtime bug, crash, or build failure with no structure-review goal
- the request is mainly about UX polish, content quality, or visual design rather than ownership and coupling
- the review would talk only about classes while ignoring scene, node, and signal composition

## Pattern

- Primary pattern: **Reviewer**
- Secondary pattern: **Tool Wrapper**, **Generator**

Why this fit is better than the alternatives:

- the job is primarily to evaluate an existing scene-based architecture against explicit criteria
- the skill also packages Godot-specific review heuristics around scene composition, signals, autoloads, and ownership
- the output should be a repeatable, structured review report rather than free-form commentary
- a full Pipeline would add unnecessary ceremony, because the required order can live directly in the workflow

## Review dimensions that must be covered

Every review must explicitly assess the following areas, even if some are judged healthy:

1. **scene split reasonableness**
2. **node hierarchy responsibility load**
3. **script ownership clarity**
4. **signal health and communication style**
5. **autoload / singleton fit vs overuse**
6. **UI and gameplay coupling depth**
7. **scene reusable boundary clarity**

If a dimension is not a current problem, say so briefly instead of silently skipping it.

## Inputs

Collect or infer these inputs when available:

- the target scene, subsystem, or gameplay/UI flow being reviewed
- the goal of the scene or system in plain language
- relevant `.tscn` structure, important nodes, and attached scripts
- main signals, direct references, exported dependencies, and autoloads involved
- where orchestration currently lives: root node, child node, manager, service, autoload, UI controller, etc.
- signs of pain: hard-to-change flows, duplicate wiring, fragile tests, cross-scene dependencies, frequent regressions
- whether the user wants a broad review or a focused decision such as splitting a scene or reducing singleton use

If some details are missing, do not block on perfect context. Infer a first-cut architectural reading and call out the assumptions that materially affect the review.

## Workflow

Follow this sequence every time.

### 1. Understand the scene or system goal

State what the scene or system is supposed to do.

Examples:

- battle HUD scene that displays gameplay state and routes player input
- inventory scene that combines list presentation, selection state, and item actions
- world scene that composes player, camera, enemies, and mission flow

Do not start by critiquing structure in the abstract. Anchor the review in the intended role of the scene or system.

### 2. Identify the primary responsibility boundaries

Map the major boundaries first.

Examples of boundaries to identify:

- scene composition boundary
- gameplay state ownership boundary
- UI presentation boundary
- orchestration or coordination boundary
- persistent/global state boundary
- reusable child-scene boundary

Call out which node or script appears to own each responsibility.

### 3. Evaluate scene and script ownership

Review whether ownership is placed in the right level of the tree.

Check for:

- root scenes that coordinate too much and also own detailed business logic
- child nodes whose scripts reach upward or sideways for unrelated responsibilities
- scene-local responsibilities being pulled into autoloads without clear need
- scripts that mix view logic, domain logic, and lifecycle orchestration in one file
- scenes that are split too coarsely or too finely for their actual reuse and maintenance needs

The goal is not maximum decomposition. The goal is a clear, defensible ownership model.

### 4. Inspect coupling, over-centralization, and communication health

Look for structural smells such as:

- god objects or god scenes
- one manager script coordinating unrelated concerns
- dense direct references across sibling or distant nodes
- signal spam with unclear ownership or lifecycle
- autoloads becoming a default shortcut for cross-system access
- UI nodes directly mutating gameplay state that should be mediated elsewhere

Distinguish between **pragmatic coordination** and **harmful coupling**. Not every central node is automatically wrong.

### 5. Propose at least two refactor directions

Every review must provide **at least two plausible improvement directions**.

Good examples:

- keep the current scene boundary but extract orchestration into a focused coordinator script
- split one reusable child scene while leaving the rest intact
- replace broad autoload access with explicit dependency injection or signal-based handoff at one seam
- move gameplay rules below the scene layer while keeping runtime wiring in scene scripts

Do not recommend "split everything more" by default. Each option should explain the trade-off, not just the shape.

### 6. Explain testability and maintainability implications

For the current structure and for each main refactor option, comment on:

- testability impact
- local reasoning cost
- change cost when adding features
- likelihood of regression from scene rewiring
- whether responsibilities become easier or harder to verify in isolation

A review is incomplete if it spots structure issues but says nothing about verification or future change cost.

### 7. Return the review report

Return the result using `assets/review-report.md`.

The review should:

- identify the context and current structure
- list responsibility issues explicitly
- describe coupling risks without exaggerating them
- give at least two refactor options
- explain verification impact and recommended next step

## Output contract

Return the result using `assets/review-report.md` in this section order:

- `Context`
- `Current structure`
- `Responsibility issues`
- `Coupling risks`
- `Refactor options`
- `Verification impact`
- `Recommended next step`

Output rules:

- tie findings to scene, node, script, signal, or autoload evidence
- do not collapse into generic clean-code advice
- mention both strengths and weaknesses when possible
- provide at least two improvement directions when issues are found
- discuss testability and change cost explicitly
- avoid treating pure UX quality problems as architecture problems unless they stem from ownership or coupling
- keep findings anchored to the report structure so another agent can compare current-state issues against each refactor option cleanly

## Godot-specific review heuristics

- Prefer reviewing **scene ownership** before line-level implementation details.
- A root node can coordinate, but it should not quietly become the owner of every unrelated responsibility.
- Signals are healthiest when they reduce tight references without hiding ownership or flow.
- Autoloads should represent truly global or persistent concerns, not scene-local convenience shortcuts.
- Reuse boundaries should be justified by repeated composition value, not by aesthetic preference alone.
- UI scripts may observe or request gameplay changes, but deep gameplay mutation from view nodes is a coupling warning unless carefully bounded.

## Companion files

- `references/godot-architecture-notes.md` — review criteria and decision rules for ownership, signals, autoloads, UI/gameplay separation, and reusable scene boundaries
- `assets/review-report.md` — reusable template for the final architecture review output

## Validation

A good review should satisfy all of the following:

- the target scene or system goal is stated clearly
- all seven review dimensions are considered explicitly
- responsibilities are mapped to scenes, nodes, scripts, signals, or autoloads
- coupling and over-centralization risks are identified without hand-wavy claims
- at least two refactor directions are provided
- testability and maintainability implications are discussed
- the result does not degrade into generic OOP clean-code feedback
- the result does not mistake pure UX concerns for architecture concerns

## Common pitfalls

- reviewing classes while ignoring scene composition and node ownership
- assuming every large scene must be split without checking actual boundaries
- recommending more signals or fewer signals with no ownership reasoning
- treating autoload use as bad by default instead of checking scope and persistence needs
- calling UI problems architectural when the real issue is interaction design or copy
- suggesting global rewrites instead of one or two focused refactor seams

## Completion rule

This skill is complete when the agent has:

- explained what the target scene or system is for
- identified the main responsibility boundaries
- reviewed scene split, node load, script ownership, signal health, autoload fit, UI/gameplay coupling, and reuse boundaries
- described the main coupling or over-centralization risks
- proposed at least two realistic improvement directions
- explained the verification and change-cost implications of those directions
- returned a structured review report rather than generic advice
