---
name: abstraction-integrity-review
description: Use when implementing a feature, extending an existing flow, or refactoring touched code in a Godot project and you need to prevent abstractions from decaying through flag creep, boundary leakage, compatibility creep, or responsibility drift.
---

# Abstraction Integrity Review

Use this skill when a Godot 4.6 + .NET/C# project is in the middle of implementation, flow extension, or refactoring and the real question is **whether the touched abstractions are staying healthy or quietly decaying**.

This skill is for reviewing the change pressure around an abstraction while work is still active. Its job is not to deliver a generic clean-code lecture or to re-architect the whole project from orbit. Its job is to inspect whether the current implementation direction is accumulating **flag creep, boundary leakage, compatibility creep, or responsibility drift** that will make the next change harder.

Prefer this skill when the code technically "works" but the touched seams are starting to feel less honest, more conditional, or more burdened than before.

## Purpose

This skill is used to:

- review whether a feature extension or refactor is preserving the intended abstraction seam
- detect when flags, modes, or option branching are becoming a substitute for clearer structure
- identify leakage across scene, UI, gameplay, tool, service, resource, or configuration boundaries
- evaluate whether compatibility support is contained or quietly contaminating the main abstraction
- catch responsibility drift before a touched class, scene, script, or service becomes the new dumping ground
- return a structured review with decay risks, containment options, and the smallest stabilizing next step

## Use this skill when

Invoke this skill for tasks such as:

- extending an existing flow that now needs one more mode, switch, or conditional branch
- refactoring touched code where responsibilities are moving but not yet clearly landing
- adding compatibility support, transitional adapters, or old-path handling during a change
- reviewing whether an implementation is stretching a scene, script, service, or abstraction past its original job
- checking whether a "small" change is introducing more hidden architectural debt than feature value

### Trigger examples

- "This flow extension added a lot of flags—does the abstraction look unhealthy now?"
- "Help me check whether this refactor is causing responsibility drift"
- "Is this compatibility layer starting to contaminate the main abstraction?"
- "After adding this feature, are the boundaries starting to leak?"
- "I want to avoid abstraction decay—can you review the current approach?"

## Do not use this skill when

Do not use this skill when:

- the main problem is a runtime failure or build break whose first failing layer is still unclear
- the work has not started and the user mainly needs a fresh architecture or planning proposal
- the task is a narrow style cleanup with no abstraction or ownership pressure
- the request is primarily UX review, test planning, or migration staging rather than abstraction health
- the user already knows the preferred containment move and only wants implementation help

## Pattern

- Primary pattern: **Reviewer**
- Secondary pattern: **Tool Wrapper**, **Generator**

Why this fit is better than the alternatives:

- the core job is to evaluate whether an in-flight change is degrading an abstraction under explicit review criteria
- the skill also packages reusable Godot/.NET heuristics for flags, boundaries, compatibility shims, and ownership drift
- the output should be a repeatable structured review report rather than loose commentary
- a full Pipeline would add ceremony without enough value, because the review already has a stable ordered flow

## Review dimensions that must be covered

Every review must explicitly assess the following areas, even if some are healthy:

1. **change intent and abstraction seam clarity**
2. **flag creep and mode-surface growth**
3. **boundary leakage across layers or scenes**
4. **compatibility creep and legacy-path pressure**
5. **responsibility drift in touched owners**
6. **extension seam quality and future change cost**
7. **verification and containment confidence**

If a dimension is not currently problematic, say so briefly instead of silently skipping it.

## Inputs

Collect or infer these inputs when available:

- the feature, flow extension, or refactor summary
- the main abstraction, seam, scene, script, class, service, or coordinator being stretched
- the new requirements or cases being added
- any flags, enum modes, optional parameters, branching paths, adapters, shims, or compatibility switches introduced
- which boundaries are involved: scene, UI, gameplay, tool, service, resource, config, serialization, or editor-facing setup
- what the abstraction used to own versus what it is starting to own now
- any existing public contract, exported properties, signal surface, method surface, or caller expectations that may be growing awkwardly
- what verification or evidence currently supports the changed design direction

If some inputs are missing, do not block on perfect context. Infer the likely abstraction pressure from the touched seam and call out the assumptions that affect the review.

## Workflow

Follow this sequence every time.

### 1. State the change intent and the seam under pressure

Summarize:

- what new behavior or refactor pressure is being introduced
- which abstraction is absorbing that pressure
- what that abstraction appears to be responsible for today

Examples:

- a scene controller that used to handle one gameplay flow now also coordinates replay and preview modes
- a service that used to expose one stable path now carries compatibility branches for old and new callers
- a HUD or tool panel that used to render state now also owns branching decision logic for new flows

Do not start from smells in the abstract. Anchor the review in the exact seam being stressed.

### 2. Map the touched boundary and caller surface

Identify what is directly touched and what is now depending on it.

Examples:

- scenes and attached scripts
- callers, signals, exported properties, and configuration points
- service APIs, coordinators, adapters, and compatibility shims
- resource assumptions, save/load implications, or inspector-driven branches

Call out whether the change is stretching an internal seam, a public seam, or both.

### 3. Inspect flag creep and mode-surface growth

Review whether the abstraction is growing by piling on switches instead of preserving a clear model.

Check for:

- new booleans, modes, or optional parameters that encode different responsibilities
- branching that multiplies combinations faster than the abstraction can stay understandable
- a "just one more case" pattern that is making flow reasoning expensive
- mode handling that should have become a separate strategy, scene, adapter, or coordinator

Not every flag is bad. The question is whether the flag surface is still serving one coherent responsibility.

### 4. Inspect boundary leakage and responsibility drift

Review whether the touched owner is starting to know or do too much.

Check for:

- UI code learning gameplay rules it should only present
- gameplay or tool services learning view or scene concerns they should not own
- a scene root, manager, or coordinator becoming the place where unrelated concerns now meet
- local changes that force distant callers to understand internal branching details
- temporary implementation shortcuts that cross a seam and are likely to stick around

The goal is not zero coupling. The goal is to keep the coupling honest, bounded, and explainable.

### 5. Inspect compatibility creep and old-path drag

Review whether compatibility support is appropriately contained.

Check for:

- old behavior preserved through scattered branches instead of bounded adapters
- transitional paths becoming part of the main abstraction contract
- new callers paying complexity cost for old caller support
- compatibility work that should live at the edge but is contaminating the center
- legacy path handling that now changes method shape, signal semantics, or scene assumptions broadly

Compatibility is often necessary. The review should judge whether it is **contained** or **infectious**.

### 6. Recommend containment options

Every review must provide **at least two plausible containment directions** when meaningful risk exists.

Good examples:

- keep the seam but extract one strategy or policy object for the new mode
- push compatibility handling to an adapter at the edge instead of the core abstraction
- split one coordinator responsibility without exploding the whole flow into many tiny pieces
- keep the current owner but narrow the public surface and relocate one branch-heavy responsibility

Do not default to "rewrite everything" or "just add another abstraction layer." Each option should explain why it reduces decay pressure.

### 7. Explain verification and next-step confidence

For the current direction and for the main containment options, comment on:

- how hard the abstraction will be to reason about after one more change
- what seam is most likely to regress next
- which focused verification would prove the abstraction is still behaving coherently
- whether one narrow follow-up refactor would materially improve future change cost

A review is incomplete if it spots decay pressure but says nothing about how to prove the safer direction is actually better.

### 8. Return the review report

Return the result using `assets/review-report.md`.

The review must:

- identify the change pressure and stressed abstraction clearly
- describe decay risks without exaggerating them
- separate flag creep, boundary leakage, compatibility creep, and responsibility drift instead of blending them together
- provide containment options and a practical recommendation
- explain the verification and future-change implications

## Output contract

Return the result using `assets/review-report.md` in this section order:

- `Change context`
- `Touched seam`
- `Decay risks`
- `Compatibility posture`
- `Containment options`
- `Verification impact`
- `Integrity verdict`
- `Recommended next step`

Output rules:

- tie findings to scenes, scripts, APIs, flags, modes, signals, adapters, config, or caller surfaces when possible
- distinguish healthy pressure from actual abstraction decay
- mention both strengths and weaknesses when possible
- provide at least two containment directions when meaningful risk exists
- keep the review grounded in Godot/.NET change surfaces rather than generic OOP language
- prefer a small stabilizing move over an aspirational rewrite

## Godot/.NET abstraction heuristics

- A scene, service, or coordinator can grow a little; the warning sign is when the next case only fits by adding more flags or hidden branching.
- Compatibility support is safest at the edge. When the center of an abstraction starts speaking old and new dialects at once, future changes get expensive fast.
- Exported fields, signals, and inspector-driven configuration are part of the abstraction surface, not implementation trivia.
- Boundary leakage often appears first as "convenient" cross-layer knowledge: UI knows domain branches, services know scene timing, scenes know compatibility detail.
- Responsibility drift is often gradual: the abstraction still sounds like the same thing, but change after change it becomes the place where every exception lands.
- The right response to decay pressure is usually one bounded containment move, not immediate architecture maximalism.

## Companion files

- `references/review-checklist.md` — reusable review criteria for flag creep, boundary leakage, compatibility creep, responsibility drift, and containment decisions
- `assets/review-report.md` — reusable template for the final abstraction integrity review output

## Validation

A good review should satisfy all of the following:

- the change intent and stressed abstraction are stated clearly
- the touched seam and caller surface are identified
- flag creep, boundary leakage, compatibility creep, and responsibility drift are assessed explicitly
- the review distinguishes contained complexity from unhealthy decay
- at least two plausible containment directions are provided when risk exists
- verification impact and future change cost are discussed
- the result does not collapse into generic clean-code advice
- recommended next steps are bounded and actionable

## Common pitfalls

- treating every flag as bad instead of judging whether the abstraction still owns one coherent concern
- recommending new abstraction layers with no explanation of what decay they actually stop
- ignoring compatibility branches because the feature still works today
- reviewing only one class while the real decay is happening at the scene or caller boundary
- mistaking temporary convenience leakage for harmless implementation detail
- proposing a full rewrite when one edge adapter or seam split would do

## Completion rule

This skill is complete when the agent has:

- explained the change pressure and the abstraction under stress
- mapped the touched seam and its caller or boundary surface
- reviewed flag creep, boundary leakage, compatibility creep, and responsibility drift explicitly
- described the main decay risks without exaggeration
- proposed at least two realistic containment directions when needed
- explained verification impact and issued a clear integrity verdict with a next step
