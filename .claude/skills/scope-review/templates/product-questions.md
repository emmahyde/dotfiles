# {{TOPIC_TITLE}}: Product Questions

Context: {{ONE_PARAGRAPH_CONTEXT — what work this is scoping, which PR or ticket if applicable, what blocks on these answers.}}

Recipients: {{e.g. product, compliance, legal, plan operations.}} {{If urgent, name the blocker — "Q-1 blocks PR #{{PR_NUM}} merge."}}

---

## Q-1: {{SHORT_TITLE — one-line label, e.g. "Plan amendment, rule unchanged"}}

**Scenario.** {{Set the scene with named entity: "Acme Co's 401(k) plan…", "Beta Bank's loan portfolio…". State the configuration in concrete numbers.}}

{{Then introduce a named participant ("Alice", "Bob") with concrete dates and quantities. Walk through what happens to them. End with the moment of decision — the date or event where the answer determines the outcome.}}

**Question: {{Direct, one-sentence question stated from the entity's perspective.}}**

- **(A) {{Option label — one short clause stating the choice.}}** {{One sentence describing what happens under this choice in the scenario above. Reference the named participant.}} *Engineering: {{cost / scoping consequence under this answer.}}*

- **(B) {{Option label.}}** {{Description, named participant.}} *Engineering: {{cost / scoping consequence.}}*

- **(C) {{Option label, if applicable.}}** {{Description.}} *Engineering: {{cost.}}*

- **(D) {{Option label, if applicable. Use when there's a "compliance-flavored" or hybrid option that genuinely differs from A-C.}}** {{Description.}} *Engineering: {{cost.}}*

**Engineering implication summary.** {{2-3 sentence rollup describing how the answers map to design choices. Name which is cheapest, which is most flexible, which is most aligned with current architecture if any.}}

---

## Q-2: {{SHORT_TITLE}}

{{Same structure as Q-1.}}

---

## Q-3: {{SHORT_TITLE}}

{{Same structure. Three questions is typical; extend if the topic genuinely splits more ways.}}

---

## Notes

- {{Which question blocks current work.}}
- {{Which can land later.}}
- {{Default for any question that has a safe-to-ship default.}}
- {{Any constraint on response timing — incident review, compliance deadline, sprint cutoff.}}

---

## Filling out this template

Conventions:

- Each question is a **forwardable artifact**. The recipient should be able to answer without asking follow-ups. If they would need follow-ups, the scenario isn't concrete enough.
- Use **named participants and dates**. Generic "the user" or "the customer" produces generic answers. Specific names ("Alice", "Bob", "Carol") produce specific answers.
- Numbers must be **realistic for the domain** but don't have to be production-real. The point is to make the consequences vivid, not to be auditable.
- Each option must be **distinguishable from the others by behavior**, not by phrasing. If A and B produce the same outcome for the named participant, collapse them.
- The **engineering implication** for each option is required, not optional. It's the recipient's bridge between "what does the product want" and "what does it cost." Without it, you'll get answers that ignore feasibility.
- The **summary** at the bottom helps a reviewer who reads only one question. They should be able to skip to it and understand the shape of the decision.
- Three to five questions is typical. Fewer than three usually means the scoping wasn't deep enough; more than five usually means questions are subdividable into bundles that should be sequenced rather than asked simultaneously.

Output filename convention: `{{ticket-or-topic-slug}}-product-questions.md` written to repo root or a designated docs path.
