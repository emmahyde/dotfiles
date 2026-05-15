# {{TOPIC_TITLE}}: Engineering Questions & Decisions

Context: {{ONE_PARAGRAPH_CONTEXT — what work this is scoping, what PR(s) or ticket(s) it concerns.}}

Related work:

- PR: [{{PR_TITLE}}](https://github.com/{{ORG}}/{{REPO}}/pull/{{PR_NUM}})
- {{Sibling PR if applicable: [title](https://github.com/.../pull/...)}}
- Ticket: {{JIRA-ID — short description}}
- Related migration: [`{{migration_filename}}`](https://github.com/{{ORG}}/{{REPO}}/blob/{{COMMIT_SHA}}/{{path/to/migration}}.rb)

Status: {{Draft / Awaiting product / Locked-in pending review.}}

---

## Decisions

Each row is a decision with a stated default. Reviewers can override individual rows without re-deriving the whole matrix.

| ID | Decision | Default | Tradeoff | Status |
|----|----------|---------|----------|--------|
| D1 | {{One-line decision statement.}} | {{Stated default — code or value.}} | {{One-line tradeoff naming what's gained and given up.}} | {{Open / Confirmed / Overridden}} |
| D2 | {{Decision.}} | {{Default.}} | {{Tradeoff.}} | {{Status.}} |
| D3 | {{...}} | {{...}} | {{...}} | {{...}} |

---

## Decision details

### D1 — {{Title}}

**Code paths affected**

- [`{{path/to/file.rb:line-range}}`](https://github.com/{{ORG}}/{{REPO}}/blob/{{COMMIT_SHA}}/{{path/to/file.rb}}#L{{START}}-L{{END}}) — {{what this code does, why it's affected.}}
- [`{{path/to/another_file.rb}}`](https://github.com/{{ORG}}/{{REPO}}/blob/{{COMMIT_SHA}}/{{path/to/another_file.rb}}#L{{LINE}}) — {{relation to decision.}}

**Options considered**

- **(a) {{Option name.}}** — {{One-paragraph description.}}
- **(b) {{Option name.}}** — {{Description.}}
- **(c) {{Option name.}}** — {{Description.}}

**Default: (b).** {{One-sentence justification — why this option survived steelmanning.}}

**Failure modes if default is wrong**

- {{Concrete scenario where default produces wrong behavior.}}
- {{Another scenario.}}

**Reverse-out cost.** {{If we ship default and need to flip later, how expensive — column drop, data migration, callsite churn.}}

---

### D2 — {{Title}}

{{Same structure as D1.}}

---

## Cross-cutting concerns

### Test coverage required

- [ ] {{Test description.}} — {{file path where it should live.}}
- [ ] {{Test description.}}

### Migrations / schema changes

- {{Migration description, target table, expected row count, lock implications.}}
- {{Whether destructive — column drop, data migration.}}

### Feature flags

- `{{Feature::FLAG_CONSTANT}}` — {{state when shipping (off/canary/on), rollout plan.}}
- {{Other flags affected.}}

### Observability

- {{Logs / metrics / dashboards to add or update.}}

---

## Routing

- **Block on:** {{Which product question (Q-1, Q-2, Q-3) must be answered before any decision can lock.}}
- **Once unblocked:** {{Which decisions auto-resolve from product answer, which still need engineering input.}}
- **Owner:** {{Who drives this — engineer, lead, team.}}
- **Reviewers:** {{Specific names if known.}}

---

## Filling out this template

Conventions:

- Every code reference must be a **GitHub permalink** with a fixed commit SHA, not a branch name. Branch-relative links rot when branches merge or rebase. Use `git rev-parse HEAD` for the current SHA.
- Format: `https://github.com/{{ORG}}/{{REPO}}/blob/{{SHA}}/{{path}}#L{{N}}` for a single line, `#L{{N}}-L{{M}}` for a range.
- For PR links use `https://github.com/{{ORG}}/{{REPO}}/pull/{{PR_NUM}}`. Avoid `/files` or `/files#diff-...` suffixes — they lock to a specific patch chunk that may move.
- Each decision must have a **stated default**. "It depends" is not a default; pick the option you'd ship if no further information arrived, and document the tradeoff.
- The **failure modes** section is mandatory for any decision that touches data layer, schema, or cross-team contracts. Skip only for purely local style decisions.
- The **reverse-out cost** is the most important field for risk assessment. A wrong-but-cheap-to-flip default is acceptable; a wrong-and-irreversible default is not. If reverse-out is expensive, raise the bar on the default's confidence.
- The **routing** block is what makes the document actionable. Without it, the matrix is just an audit trail.

Output filename convention: `{{ticket-or-topic-slug}}-engineering-decisions.md` written to repo root or a designated docs path. Pair with the matching `-product-questions.md` document.

### Permalink helpers

To get a current commit SHA:

```bash
git rev-parse HEAD
```

To construct a permalink for a file as it exists at HEAD:

```bash
SHA=$(git rev-parse HEAD)
ORG="{{your-org}}"
REPO="{{your-repo}}"
echo "https://github.com/$ORG/$REPO/blob/$SHA/path/to/file.rb#L42"
```

When citing code that exists on a PR branch but not on main, use the PR head SHA (visible at top of `gh pr view {{PR_NUM}}`) so the permalink survives branch rebases and post-merge cleanup.
