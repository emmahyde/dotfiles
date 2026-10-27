# Research-backed suggestions and contrasting creative angles

## Suggest throughout the conversation

Use research to improve the next decision, not to deliver a detached literature review. Offer concise, relevant suggestions during discovery, variant generation, specification, and native review. Explain the source's useful mechanism, how it applies here, and its main trade-off. Distinguish a researched observation from the assistant's extrapolation.

- During discovery, use a relevant precedent to make an abstract question concrete without steering every answer toward that precedent.
- During variations, contrast mechanisms and structures, not just visual styling. Include original options enabled by the project's framework.
- During specification, support recommendations with evidence and test competing interpretations against actual project behavior.
- After native review, use observed results to revise the recommendation; do not defend an earlier research-derived suggestion when the experiment contradicts it.

Do not add a source citation to every sentence or interrupt every answer with new research. Reuse the best evidence already collected. Re-search when a new question or evidence gap would materially change the next experiment.

## Search local knowledge first

Check these locations when present, scoped to the current feature and decision:

| Location | Use |
|---|---|
| `~/.claude/research` | Existing cross-project research corpora and summaries |
| `<repo>/.claude/research` | Project-local research and fetched source corpora |
| `~/llmwiki` | Relevant synthesized knowledge, prior research, and decision history |
| `<repo>/wiki` | Project concepts and prior investigations, if available |
| `<repo>/docs` | Current constraints, plans, accepted decisions, and integration documentation |
| `<repo>/docs/LORE-*.md`, `PORT-LORE.md`, `WORLD-ENGINEERING.md` | Canon factions, timeline, port rules, and world physics; the source for a variant's lore anchor |

Treat `@~/.claude/research` in a user message as a reference to `~/.claude/research`, not a literal directory beginning with `@`. Resolve `~` for the active user's home and project-relative locations from the current repository root. Do not create missing knowledge directories just to satisfy this search list.

Use focused search and read relevant summaries/indexes before source pages. Do not recursively dump whole research trees or load every document. Inspect dates, project scope, source links, and whether a note is an accepted decision, proposal, or abandoned experiment. Current implementation and explicit project decisions establish actual capability; a research note is not permission to override them.

Cite the local file and useful section, and retain the original source URL where available. Say when a recommendation relies on old, unverified, or cross-domain evidence. Do not call an alternative successful without evidence of the outcome that matters here.

## Use web search for missing inspiration or current evidence

When local material cannot answer the design question or fresh inspiration is useful, invoke `/skill:search-web` and read its current instructions. Give it a narrow question, the confirmed constraints, the missing comparison axis, and a bounded research scope. Follow its dispatched-research workflow; read its returned corpus summary and relevant sources before making recommendations.

Do not search merely to decorate a direction already chosen. Prefer primary demonstrations, technical explanations, and relevant case studies over unattributed mood boards. Link sources and distinguish an appealing example from verified usability or performance. If the skill is unavailable, disclose that and use an available bounded web-research tool rather than pretending the skill ran. Do not send private notes, code, or unpublished project details to external search.

## Select contrasting creative agents

Use the dedicated definitions installed in `~/.claude/agents/` when multiple independent angles would reveal meaningfully different options. Verify the agents are available in the current host; a definition file is not proof of runtime registration. If unavailable, use supported delegation with the same role brief, or perform the perspectives directly. Do not launch new infrastructure merely to activate a role.

| Agent | Primary angle | Useful contrast |
|---|---|---|
| `idea-form` | Silhouette, proportions, spatial structure, composition, material/value hierarchy | Different spatial or visual organizations, not recolours |
| `idea-feel` | Affordances, action-feedback-consequence, rhythm, motion, attention, camera/HUD experience | Different ways the player perceives and performs the same task |
| `idea-system` | World consequences, resources, risk/reward, challenge, ownership, integration | Different systemic mechanisms and meaningful consequences |
| `idea-wildcard` | A credible counterfactual or cross-domain mechanism | Challenge one open assumption while retaining confirmed requirements |

Select only useful roles; do not summon all four automatically or force a systemic redesign into a pure silhouette study. For a modeling task, assign separate agents structural axes such as silhouette, construction logic, and negative space. For an interaction task, vary control model, feedback timing, or consequence structure. One agent can explore several axes when delegation would cost more than it saves.

Give each selected agent the same compact brief and fixed comparison scenario, plus a different assigned axis. Include confirmed constraints, viable variations, relevant research pointers, current framework limits, approval status, desired output count, and an exclusive artifact path if writing is authorized. Resolve prerequisite questions before dispatching downstream work.

Default to one strong direction per agent. Aggregate at least three distinct options in the parent review; do not multiply every agent into three full prototypes. Run independent perspectives together only when the environment supports it. Keep one integration owner and do not let agents edit the same scene, model recipe, or Unity Editor state concurrently. Default to proposals; artifact construction requires an explicit delegated scope and native work requires approval.

## Require compact, comparable returns

Ask each agent for:

- Stable variant ID, one-line concept, and the open dimension being tested.
- A sketch, diagram, or authorized capture; if unavailable, an honest artifact plan, not a claim that a visual exists.
- Player experience and world consequence, main benefit, drawback, framework fit, cost, and risk.
- The precedent or source behind the idea, clearly separated from original invention or unverified inspiration.
- The cheapest next test and any unresolved dependency.

Ask agents to be structurally different while keeping the same evaluation scenario. Share brief sibling summaries only when needed to remove duplication; do not encourage all agents to converge prematurely. Reject superficial novelty, duplicate directions, and unapproved scope expansion. Have the wildcard role label a proposed change to a fixed requirement as a question for the human, not silently make that change.

Synthesize the returns into one contact sheet or comparable review board. Retain variant IDs and provenance, recommend with reasons, and invite combinations or unexplored details. Do not create four separate apps, dashboards, or isolated lab frameworks. Treat suggestions as alternatives to review, not votes that settle the design without the human.
