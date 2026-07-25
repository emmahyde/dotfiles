# Templates

Copy a block into the target path and adapt it. Keep placeholders (`<…>`) until you have real,
cited content — an empty section is honest; a fabricated one is not.

---

## `docs/README.md` — project charter

```markdown
# <Project>

*<one-line description / pitch>*

## What this is
<2–4 sentences: what the project is and the single defining property.>

## Locked decisions
*The frame we're building to. See `adr/` for the reasoned records.*

- **<decision area>** — <the call> → ADR-XXXX
- …

## Must-haves
1. <hard requirement>
2. …

## Documents
- [PRD.md](PRD.md) — what / why / for-whom
- [adr/](adr/) — architecture decision records
- [SPEC.md](SPEC.md) — how
- `architecture-map.md` — evidence base

## Methodology note
<optional: anything non-obvious about how this project is being built.>
```

---

## `docs/PRD.md`

```markdown
# <Project> — Product Requirements Document

*Status: DRAFT v0 · Audience: <who> · Last updated: <date>*

## 1. Summary
## 2. Problem & context
## 3. Goals
## 4. Non-goals
## 5. Target user & use-cases
## 6. Functional requirements
<group by subsystem; tag any unclear sub-section ⚠️ GRILL with a pointer to the ADR that will resolve it.>
## 7. Non-functional requirements
## 8. Scope & roadmap (phased)
<P0…PN, with the definition of "done">
## 9. Assumptions
## 10. Dependencies & constraints
## 11. Risks
## 12. Open questions
```

---

## `docs/SPEC.md`

```markdown
# <Project> — Technical Specification

*Status: SCAFFOLD · depends on architecture-map.md*

## 1. Overview
## 2. Background — how the system is built (from architecture-map.md)
## 3. Goals / Non-goals (technical)
## 4. Architecture
## 5. Subsystem designs
<one sub-section per subsystem; tag ⚠️ GRILL or "needs <map>" where unresolved>
## 6. Data model
## 7. Alternatives considered (mirrors the ADRs)
## 8. Security & privacy
## 9. Testing & verification
## 10. Build & rollout
## 11. Open questions
```

---

## `docs/architecture-map.md` — evidence base

```markdown
# <Project> — Architecture Map (evidence base)

*Distilled from source investigation of <repo> (<date>). Cited by ADR Technical-context /
References and the SPEC. Paths relative to repo root; line numbers approximate — re-verify on edit.*

## 1. What the system is
## 2. <Subsystem> — <one-line>  → ADR-XXXX / SPEC §N
<for each mapped area: where it lives, the seam, what's coupled, what breaks if changed; cite file:line>
...
## N. Map → ADR / Spec crosswalk
| Finding | Feeds |
|---|---|
| <finding> | ADR-XXXX, SPEC §N |
```

---

## `docs/adr/0000-template.md` — ADR template

```markdown
# ADR-NNNN: <short decision title>

- **Status:** Proposed | Accepted | Needs-grill | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Deciders:** <who>

## Context
<The forces, constraints, and problem. What is true that makes this decision necessary.>

## Technical context
<Concrete codebase facts that ground the decision: crates/modules, seams, file:line evidence,
constraints discovered in the source. Cite architecture-map.md. The proof layer — distinct from
Context's "forces.">

## Decision drivers
- <driver / requirement>

## Considered options
1. **<option A>** — <one line>
2. **<option B>** — <one line>

## Decision
<The option chosen, in active voice: "We will …", then the rationale tying back to the drivers.>

## Consequences
- **Positive:** <…>
- **Negative / cost:** <…>
- **Neutral / follow-ups:** <…>

## References
- <architecture-map.md section / source file:line>
- <external spec, doc, or prior art>
- <related ADRs>
```

---

## `docs/adr/README.md` — ADR index

```markdown
# Architecture Decision Records

Format: Nygard + MADR, extended with **Technical context** and **References** (see 0000-template.md).
Status: **Proposed** · **Accepted** · **Needs-grill** · **Superseded**.

| # | Title | Status |
|---|-------|--------|
| [0001](0001-<slug>.md) | <title> | Accepted |
| 0002 | <title> | Needs-grill |
```
