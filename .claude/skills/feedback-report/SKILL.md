---
name: feedback-report
description: "Turn a pile of product feedback into a strategic action plan. Finds root causes through multi-lens cross-tabulation, brainstorms solutions that address multiple problems at once, and recommends independently deployable slices. Two modes: quick mode prints analysis directly in chat (small batches, no artifact); full mode renders a dark-themed HTML report with diagrams. Use whenever the user has a collection of feedback and wants synthesis over triage. Triggers: 'analyze this feedback', 'find patterns', 'root cause analysis', 'what are the real problems', 'synthesize these items', 'feedback report', 'strategic review', 'cross-tab analysis', 'feedback strategy', 'quick feedback analysis'. Also trigger when the user says 'triage' or 'prioritize' but has 10+ items and seems to want grouping and solutions rather than a ranked list."
---

# Feedback Report

A structured process for turning a pile of product feedback into a strategic action plan.

This is not item-by-item triage. The process finds root causes underneath stated complaints, then proposes solutions that make those complaints obsolete. The analysis is the work. The rendered report is a final step.

## Why this process exists

Users often cannot name the actual issue. A complaint about "the button is confusing" may mean the interaction model is wrong. Three unrelated-looking bug reports may share a single architectural root cause.

The feedback tells you where pain exists. Cross-tabulation reveals what causes it. The more items a single solution addresses, the deeper the root cause it targets.

Core heuristic: kill more birds with fewer stones.

## Input

Accept feedback from whatever the user provides:

- An HTML tracker file — read it and extract the embedded data structures
- A JSON, CSV, or spreadsheet file
- Inline items in the conversation
- A URL or file path the user points you to

Parse every item. Extract: the complaint or request, who raised it, when, any category or type labels, and the current status.

## Modes

### Quick mode

Use when: the batch is small (under ~15 items), the user says "quick", "just analyze", "in chat", or the context makes a full HTML artifact unnecessary.

Print the analysis directly into the conversation. No artifact file. No diagrams. Write in simple English with clean ASCII separation between sections.

Section format:

```
══ SECTION NAME ══════════════════════════════════════════

[content]
```

Run the same three phases but lighter:

1. **Inventory** — a compact table (ID, type, one-line summary). Skip date/source/reporter unless they matter.
2. **Cross-tab** — name the groupings and list which items belong to each. Skip the full matrix. Call out the dense clusters.
3. **Root patterns** — name each, list its items, one sentence on why.
4. **Solutions** — for each root pattern, 2-3 ideas in a bullet list. Mark which patterns each spans. No coverage matrix — the bullets carry the signal.
5. **Evaluation** — one line per solution: size (S/M/L/XL), items resolved, verdict (recommend / consider / pass).
6. **Recommendations** — the top picks, each in 2-3 sentences: what, why, what it resolves.

The traceability chain still applies: every item traces to a grouping, a root pattern, and a recommendation (or an explicit out-of-scope note).

### Full mode

Use when: the batch is large (15+ items), the user asks for a report artifact, or they request diagrams, HTML, or a shareable document. This is the default when the user does not specify.

## The process

Three phases, seven steps. Each step produces a distinct artifact that feeds the next. Record your reasoning throughout — the report presents all of it.

### Phase 1: Analyze

*Understand what you have and what it means.*

#### Step 1: Inventory

Read every feedback item. Build a flat table: ID, date, source, reporter, type, status, one-line summary. Count totals by type and status. This is your working dataset.

Note positive signals and items too vague to classify — they still count as data. Mark them and carry them forward.

#### Step 2: Cross-tabulate

The critical step. Classify every item through multiple independent lenses.

Start with these four lenses as a framework, then discover additional lenses from the data itself:

**Functional** — what capability or system component does this touch? Items that affect the same subsystem belong together even when their surface complaints differ.

**Contextual** — where in their workflow does the user encounter this? Items in the same user journey may share a cause even when they touch different subsystems.

**Contract-level** — what expectation is violated? Look past the literal complaint. These categories are a starting point, not a closed set:
- **Visibility** — users cannot see what they need
- **Predictability** — behavior surprises them
- **Control** — they cannot intervene or correct
- **Trust** — they doubt the system did the right thing
- **Completeness** — a workflow requires steps outside the system

**Temporal** — do items cluster around a time period, a release, or a recurring pattern?

If the data reveals a grouping axis not listed here — an organizational boundary, a persona split, a failure mode family — add it. The four lenses above are seeds. The data sets the real shape.

Map every item to at least two lenses. Items that appear across multiple groupings in multiple lenses carry the highest signal — they point toward root causes.

Record the cross-tab as a matrix. Rows are groupings within each lens. Columns are feedback items. Mark membership. A dense block in the matrix is a root cause candidate.

#### Step 3: Root patterns

From the cross-tab matrix, identify root patterns. A root pattern is one underlying cause that explains multiple surface complaints across multiple groupings.

For each root pattern:
- Name it in plain language (e.g., "execution state is invisible during and after a run")
- List which feedback items it explains
- List which cross-tab groupings it spans
- Explain why the surface complaints are symptoms of this deeper issue

A pattern that explains 8 items across 3 lenses is a better target than one that explains 2 items in 1 lens. Rank by coverage.

### Phase 2: Ideate

*Generate and evaluate possible solutions.*

#### Step 4: Brainstorm

For each root pattern, brainstorm at least three solutions. This is divergent thinking — no filtering, no ranking, no "but that's too expensive" yet. Premature convergence narrows the solution space before you have explored it.

Each solution should:
- Address the root pattern, not the surface symptoms
- Ideally address multiple root patterns at once
- Range from conservative to ambitious

Record every idea in a table: solution name, which root patterns it addresses, which original items it resolves, one-line approach description.

Then build a **coverage matrix**: solutions as rows, root patterns as columns. Mark which patterns each solution addresses. Solutions that span multiple root patterns are the most valuable — they signal you found a deeper cause. A solution that resolves items from three root patterns simultaneously is solving at the deepest level.

#### Step 5: Steelman and evaluate

For each brainstormed solution, argue its strongest case. Then evaluate:

**Cost** — estimate relative to other solutions in this analysis, not in absolute time. Use scope-anchored sizes:
- **S** — touches one component, ships in a day
- **M** — touches 2-3 components, ships in a sprint
- **L** — touches multiple systems, ships in 2-4 weeks
- **XL** — architectural change, ships in 1-2 months

For each solution, also name: dependencies (what must exist first), risk (what could go wrong), and opportunity cost (what does not get built while this ships).

**Benefit:**
- Feedback items resolved (count and list)
- Root patterns addressed (count and list)
- Future prevention — does it stop new feedback in this area?
- Product improvement beyond what was asked

Record the evaluation for every solution, including those you will not recommend. The user needs to see why you chose what you chose.

### Phase 3: Recommend

*Choose the best solutions and present the analysis.*

#### Step 6: Recommend

From the evaluated solutions, choose the best. Optimize for:

1. **Coverage** — the fewest solutions that resolve the most items
2. **Independence** — each recommendation deploys on its own
3. **Impact** — best cost:benefit ratio wins ties

Present recommendations as independently deployable vertical slices. Each gets:
- A clear name and one-line summary
- Which root patterns it addresses
- Which original feedback items it resolves
- The implementation approach
- The cost and benefit evaluation
- A diagram showing the solution architecture or workflow

Then build a cross-comparison table: rows are recommendations, columns are metrics (items resolved, patterns addressed, cost size, benefit, dependencies).

#### Step 7: Render the report

Generate the report artifact. The analytical structure from steps 1-6 is the real output. This step gives it a form.

**Default format: standalone HTML.** Read `references/html-spec.md` for the design system, component library, and diagram configuration.

If the user requests a different format (markdown, Google Doc, structured JSON), adapt the structure to that format. The section ordering and content remain the same regardless of rendering.

Report sections in order:

1. **Header** — analysis title, date range, item count
2. **Executive summary** — the 3 most important findings in 3 sentences
3. **Stats** — tile counts for items, root patterns, solutions evaluated, recommendations
4. **Inventory** — all feedback items
5. **Cross-tab analysis** — grouped by lens, with item counts and density indicators
6. **Root patterns** — each pattern with its evidence trail
7. **Ideas table** — all brainstormed solutions with coverage matrix
8. **Evaluation panels** — steelman + cost/benefit for every solution, collapsible
9. **Recommendations** — each with full detail and a diagram
10. **Comparison table** — all recommendations side by side
11. **Alternatives** — solutions not chosen, with reasoning

Each recommendation and each alternative gets a collapsible detail panel. Each recommendation gets a diagram.

## Quality checks

Before presenting the report, verify the traceability chain:

- **Items → cross-tab**: every original feedback item appears in at least one grouping
- **Cross-tab → root patterns**: every dense cluster in the matrix maps to a named root pattern
- **Root patterns → solutions**: every root pattern has at least one solution that addresses it
- **Solutions → recommendations**: the recommended set covers all root patterns (or notes gaps with reasoning)
- **Recommendations → items**: every original item is addressed by at least one recommendation, or noted as out-of-scope with reasoning

Also verify:
- No recommendation requires another recommendation to be useful
- Cost evaluations use the scope-anchored sizes, not vague adjectives
- The report is self-contained and renders correctly
- If a recommendation addresses items without going through a root pattern, either a root pattern is missing from step 3 or the recommendation targets symptoms — fix whichever applies
