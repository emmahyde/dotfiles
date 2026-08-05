# markdown-writing

Source-only authoring note for `~/.claude/guardrails/WRITING.md`. This file is not routed at runtime; it carries rationale, examples, and editing guidance so the runtime doc can stay lean.

## Runtime contract

`~/.claude/guardrails/WRITING.md` owns the live behavior. Keep its checklist short, observable, and greppable. Put rationale and examples here unless the runtime doc needs them to execute correctly.

Current runtime IDs:
- `W-ONEJOB` (-DENSITY/-STACK), `W-PROMOTE-LABELS`, `W-BULLETS` -> split dense prose into headers, bullets, and one-job blocks
- `W-PRESERVE` (-CLAIMS/-CUTS) -> preserve substance under `same content` / `trim` / `more digestible`
- `W-DOC-SHAPE` (-OPEN/-ORDER) -> order sections and avoid throat-clearing prose

Retired: `W-DIAGRAM-OPTIN` (v1.14). See `## Retired rules` below. Never reuse the ID.

## Trigger design

Prefer triggers the model can detect while drafting:
- inline labels like `Where:` or `Conflict:`
- paragraphs with `;` 2+ times
- mixed evidence + diagnosis + proposal in one block
- user requests like `reformat`, `same content`, `trim`, `more digestible`, `comparable token output`

Avoid vague style rules like "write clearly" or "use better structure". They do not fire reliably.

## Progressive disclosure policy

Keep `WRITING.md` runtime-light:
- checklist first
- only the minimum reference text needed to preserve behavior
- no long examples unless execution fails without them

Put here instead:
- examples
- rationale
- candidate future rules
- rejected rules and why they stayed out of runtime

If a future rule adds runtime cost, answer these first:
1. Is the trigger observable while drafting?
2. Does the rule change behavior often enough to justify routed load?
3. Can the same effect live in this source file instead?

## Example transformation

BAD:

```markdown
Current flow: The world sim advances by however long the frame took, scaled by compression; every downstream cadence inherits that variable delta.
```

GOOD:

```markdown
### Current flow
The world sim advances by however long the frame took, scaled by compression.

- Daily market pass inherits the variable delta.
- 6-hour supply eval inherits it too.
- Consequence delays inherit it too.
```

Why the GOOD version wins:
- same claim set
- same causal meaning
- easier scan path
- easy to trim further without losing evidence

## Retired rules

### W-DIAGRAM-OPTIN — retired v1.14, 2026-07-27

Was: "Before adding fenced `text`, `ascii`, or diagram blocks: the user asked for `ascii` / `diagram` / `illustration`, else omit them."

Retired by user directive — diagrams are wanted, not tolerated. Removed alongside two unnamed carriers of the same bias: `diagrams` in the `W-PRESERVE-CUTS` cut ordering, and the diagram half of the F13 BAD exemplar.

Why it looked reasonable and still failed: it was a well-formed trigger by the standards in `## Trigger design` above — observable while drafting, greppable, unambiguous. The defect was not the trigger, it was the predicate. The rule keyed on the *form* (a fenced block) when the real concern was the *function* (decoration padding a trim request). Form and function diverge constantly here: a state diagram in an architecture doc and an ASCII flourish in a status update are the same token to this rule and opposite things to a reader.

Generalizable lesson for future rules: when a rule's trigger is a format token but its rationale is about intent, the rule will suppress the good instances along with the bad. Prefer a rule that polices whether the content does a job — `W-ONEJOB` and `W-PRESERVE-CLAIMS` already cover the decoration case, which is why removing this one cost nothing.

## Editing notes

- Keep trigger phrases byte-stable between `CLAUDE.md` and `WRITING.md` when they are paired.
- If you add a new example here, do not mirror it into runtime unless the runtime doc demonstrably needs it.
- If `WRITING.md` grows past what feels instant to load, move more explanation here instead of compressing triggers into vagueness.
