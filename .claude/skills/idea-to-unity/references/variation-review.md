# Rapid variation and review

## Choose the cheapest useful evidence

Name the uncertainty each artifact must resolve. Spend effort on the concept, not on the prototype's surrounding interface. Reuse the current viewer, preview page, scene, or lab. Prefer fixed presets, screenshots, short clips, static diagrams, and existing controls.

Do not build a standalone webapp, bespoke comparison dashboard, configuration panel, parameter editor, navigation system, or reusable prototyping framework unless the human asks for it. If interaction is necessary to test the concept, expose only the input that proves that interaction. Prefer editing a recipe or switching an existing preset over building sliders. Stop polishing when the human can judge the difference.

For HUD work, prototype only the requested HUD surface and its important states. Do not interpret a HUD request as permission to build a settings application or a control panel around the preview.

Keep the prototype close to its eventual integration path. At each round, check whether the mock or lab is duplicating real components, data contracts, or runtime behavior. If isolation is increasing cost or hiding the answer, propose a scoped move into Unity using the real implementation; obtain native prototype approval if not already granted. Follow [unity-handoff.md](unity-handoff.md) for integration checks and small scripts for repetitive setup, generation, import, and capture.

## Ground alternatives without a research detour

Inspect the project's current framework and relevant prior experiments. Find a small number of relevant successful alternatives from existing evidence or focused research. Link external sources. State the mechanism worth borrowing, evidence of its benefit, and where its context differs. Do not claim that an example is successful merely because it looks polished; label unverified recollections as inspiration.

Translate principles rather than copying surface styling. For example, borrow readable anticipation from a mechanical interaction, not an entire unrelated game's visual language. Include original alternatives enabled by the current framework, not only precedent-derived options.

Make suggestions throughout the workflow, not only in this research pass. Follow the main skill's research-and-ideation reference for local research locations, optional web inspiration, and dedicated contrasting agents. Reuse collected evidence and revisit it only when the decision changes.

## Present at least three options together

Keep confirmed constraints constant. Use open dimensions to make at least three meaningfully different variants available in the same review round, including refinement rounds. Do not drip-feed options one at a time. A retained favourite can be one of the three when comparing two refinements. Use stable variant IDs so feedback and later imports stay traceable.

Vary a few high-impact dimensions deliberately. Do not produce three recolours of one design unless colour is the actual question. Consider a low-cost direction, a balanced direction, and an exploratory direction when that yields genuine differences; do not force those labels onto every feature. Lore framing is a valid axis: three different world reasons for the same mechanic, with the mechanic held constant, when the open question is why the thing exists rather than how it works.

Provide a comparable visual or behavioral artifact for each option:

- For models, use design-kit views with matched camera, scale, and lighting where those are not the variable under study.
- For HUD or interaction, use small wireframes, state diagrams, or storyboards with the same scenario and data.
- For motion, use matching pose strips or timelines, followed by native clips when timing needs testing.
- For lighting, use value/composition studies, followed by native captures under controlled conditions.
- For gameplay, show the action-feedback-consequence sequence, then test it in a native lab after approval.

Do not substitute descriptions for visuals when the decision is visual. If a viewer or capture tool is unavailable, provide honest diagrams or sketches and label what remains untested. Do not claim that a static artifact proves timing, interaction feel, performance, or native rendering.

## Create contact sheets for visual review

Make a contact sheet the default first review artifact for visual or model variants. Show at least three variants together; include more when cheap to generate and still readable. Present broad exploration in labeled grids, then make a closer comparison sheet for shortlisted directions. Do not limit exploration to exactly three options.

1. Capture each variant from the existing viewer or native scene. Match camera angle, framing, background, exposure, and light unless that property is the variable being tested. Preserve a common scale or show an explicit scale reference when size is part of the decision.
2. Assemble the captures into a simple image grid with consistent cell dimensions, margins, and readable labels. Use stable variant IDs plus a short distinguishing label. Keep a direct mapping from each tile to its recipe or preset and full-resolution capture.
3. Use one consistent view per variant for the overview. If form needs several angles, use consistent columns for front/side/three-quarter views or a separate sheet; do not mix arbitrary angles that make comparison misleading.
4. For HUDs, align the same states and data. For motion, align key times in pose strips and retain clips for timing review; a contact sheet does not prove movement feel.
5. Open and inspect the assembled sheet before sharing it. Check labels, ordering, missing captures, clipping, scale, and whether the important differences survive thumbnail size. Split a crowded sheet rather than shrinking away the evidence.
6. Share the sheet directly with links to full-size images, a short tradeoff summary, and questions keyed to tile IDs. Do not build a gallery page to display it.

Reuse an existing contact-sheet tool or image compositor. When repeated capture and assembly becomes token-heavy, script that small sequence with explicit variant inputs and a deterministic output order. Do not add configurable UI. If capture is blocked, state the blocker and show provisional diagrams; do not claim a rendered sheet exists.

Use the main skill's visual-evidence reference to choose Scene, Game, isolated, or named-camera captures, avoid capture side effects, and run `scripts/contact_sheet.py` for aspect-preserving downsampled sheets. Keep originals for pixel-level review and preserve the source mapping. For Sector visual or motion grievances, compare the actual complaint capture rather than substituting an isolated beauty render.

Before diagnosing a capture, match the complaint to its 3D principle and check that first:

| The human says | Check first |
|---|---|
| "It grows as I approach" / "wrong size up close" | Perspective divide: apparent size is size over distance; give the number at the real distance |
| "Right numbers, wrong place" | Origin and parent transform: which space the values are in |
| "I can see through it" / "the dark side is lit" | Normal direction and the dot product with the light or view vector |
| "It vanished" | Near or far clip plane |
| "It flickers" / "stripes on a surface" | Depth precision: far/near ratio, or two surfaces at the same depth |


## Use a compact review board

Keep each entry brief enough to compare in one sitting. Lead visual reviews with the contact sheet, then use a short table plus linked artifacts rather than building a review application.

| Field | A | B | C |
|---|---|---|---|
| Variant ID and idea | | | |
| Sketch, view, clip, or diagram | | | |
| Distinctive choice and open dimension tested | | | |
| Encounter and player action | | | |
| World consequence and intended feel | | | |
| Rubric for gameplay or system variants: stakes, information, tradeoff, ownership; each `present`, `inert`, or `dominated` | | | |
| Benefit and main drawback | | | |
| Framework fit, implementation cost, and runtime risk; fill runtime risk from the project's cost delta checklist, not an adjective | | | |
| Evidence or precedent; untested assumption | | | |

Estimate cost relatively, with a reason: for example, “Low: existing mesh and material path” or “Higher: needs native state transitions and interrupt handling.” Separate authoring effort, integration risk, runtime cost, and maintenance when relevant. Do not invent precise schedules or benchmark numbers.

Recommend an option with a short rationale, but keep all three available. Explicitly distinguish verified support from a proposed implementation. When the deciding reason is a 3D or game-design principle, build the idea first and give one picture for it; use the web or SaaS analogy the project's instructions already ask for, and do not stack a second physical analogy on top.

## Ask for generative feedback

Ask which direction to keep, combine, or reject. Also ask one or two targeted questions about unexplored details, such as:

- “Keep B's silhouette, A's approach path, or neither? What would make the arrival feel more precarious?”
- “We have not explored interruption yet. Should releasing the control stop immediately, coast, or finish the current step?”
- “Which world consequence is missing from these options?”

Offer “continue exploring” and “ready to build” as different next steps. Treat a preference, praise, or silence as feedback—not build approval.

Update the decision ledger after each round. Preserve rejected variants as references without continuing to implement them. Keep unresolved taste choices viable for variation. Refine the highest-value unknown next, and again present at least three comparable options rather than rebuilding everything.

## Hand off only approved scope

When the human is satisfied and explicitly asks to build, record:

- Approved variant IDs, including any agreed hybrid; do not assume only one winner.
- Whether approval is for a native comparison lab or production integration.
- Fixed choices, remaining tunables, and the destination scene or prefab.
- The shortest playable scenario and visual/behavioral checks that demonstrate success.

If the human says only “build B”, default to the reversible native prototype scope; do not also replace production content. If they already specify the scope clearly, proceed without a redundant confirmation. Keep unapproved alternatives outside the production scene.
