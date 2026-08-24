# Fill-in templates

Copy these skeletons literally, then replace the bracketed placeholders. Don't
freehand a kit file from a blank page — every deviation from this shape is a
deviation from `format-contract.md`, and the two are meant to be checked against
each other.

## The CLAUDE.md kit zone

Paste this as one contiguous block. Nothing else about the kit belongs in
CLAUDE.md — see F8 for why this block stays contiguous and first.

```markdown
## Routing — the moment X happens, your next tool call is Read on the doc
| The moment you... | Read |
|---|---|
| [observable trigger 1] | docs/guardrails/[DOC1].md |
| [observable trigger 2] | docs/guardrails/[DOC2].md |
| no row above matches but the work feels risky | docs/guardrails/[CATCHALL].md |

Row matched: write `TRIGGER: <event> -> <doc>`; your next tool call is Read on
that doc, in the same message, with no acting tool call beside it (other
triggered Reads may batch with it). 2+ rows match at once? Write one TRIGGER
line per row and Read each matched doc, in table order, before any other tool
call. Already Read the doc since the last compaction? Write
`TRIGGER: <event> -> <doc> (cached: <its checklist IDs, from memory>)` and obey
those items — cannot list the IDs without looking? It is not cached: Read the doc.
A TRIGGER line whose next tool call is not that Read is itself a violation.

## Iron rules
- [Compressed rule 1, <=20 words, imperative or trigger clause] (<=8-word reason).
- [Compressed rule 2] (<=8-word reason).
[... up to your stated budget, default 15]

## Project
[whatever this project already documents — untouched by the kit]

## Hard stops
- NEVER [irreversible action] -> instead: [safe alternative] ([why, terse]).
[... up to your stated budget, default 5]

After compaction or resume: routing row [N] has fired — write its TRIGGER line
and Read docs/guardrails/[SESSION-EQUIVALENT].md. Docs read before compaction no
longer count as read: `(cached)` is invalid until you Read the doc again.
```

## One topic doc: `docs/guardrails/[NAME].md`

```markdown
<!-- kit: v1.0 | Editing this file? Read docs/guardrails/_FORMAT.md first. -->
[Restate the routing-table trigger for this doc, verbatim, as a "You are here
because..." sentence.]

[One line describing the echo protocol for this doc's checklist — usually:
`<ID>: PASS — <command> -> <output line>` / `FAIL` / `N/A — <reason>`, with a
fabrication rule: a quoted line with no matching tool result above it is FAIL.]

- [PREFIX]1. [Rule, one line, <=20 words, imperative/trigger-phrased].
- [PREFIX]2. [Rule...]
[... grouped by sub-theme if useful; numbering need not stay sequential]

## [NAMED PROCEDURE, if any rule above invokes one by name]
- [PREFIX]a. [Step]
- [PREFIX]b. [Step]

--- reference ---

## [Second-person situation heading, e.g. "Your fix didn't change the error"]
[What to do in this situation. This section is read situationally, not as part
of the always-applicable checklist above the divider.]

## GOOD/BAD example for [rule ID]
GOOD (5-10 line transcript of the correct tool sequence):
[...]

BAD (never do this):
[<=3 lines]
```

## Naming checklist prefixes

Pick prefixes that read naturally when spoken as "see C7" or "check V3" — usually
the first letter of the doc's theme. If two docs would want the same letter,
pick a two-letter prefix for one of them (`RS` for a named "REFERENCE SWEEP"
procedure, in the worked example, rather than colliding with an `R`-prefixed doc).
Write the full prefix list somewhere durable (the top of `_FORMAT.md`'s
project-specific notes, or a short table in the migration log) so a future editor
doesn't accidentally reuse one.
