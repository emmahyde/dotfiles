---
name: claude-md-improver
description: Use when asked to check, audit, update, improve, or fix CLAUDE.md files, or for "CLAUDE.md maintenance" / "project memory optimization". Scans all CLAUDE.md files, scores them against a rubric, outputs a quality report, then makes targeted updates after approval. Condensed from the claude-md-management plugin.
---

# CLAUDE.md Improver

Audit, score, and improve CLAUDE.md files so Claude Code has optimal project context. This skill can write to CLAUDE.md files — only after a quality report and user approval.

## Workflow

### 1. Discovery

```bash
find . -name "CLAUDE.md" -o -name ".claude.md" -o -name ".claude.local.md" 2>/dev/null | head -50
```

| Type | Location | Purpose |
|------|----------|---------|
| Project root | `./CLAUDE.md` | Primary project context, checked into git |
| Local overrides | `./.claude.local.md` | Personal/local settings, gitignored |
| Global defaults | `~/.claude/CLAUDE.md` | User-wide defaults across all projects |
| Package-specific | `./packages/*/CLAUDE.md` | Module-level context in monorepos |
| Subdirectory | Any nested location | Feature/domain-specific context |

Claude auto-discovers CLAUDE.md files in parent directories — monorepo setups work automatically.

### 2. Quality assessment

Score each file against the rubric (100 points):

| Criterion | Weight | Check |
|-----------|--------|-------|
| Commands/workflows | 20 | Build/test/deploy commands present? |
| Architecture clarity | 20 | Can Claude understand the structure? |
| Non-obvious patterns | 15 | Gotchas and quirks documented? |
| Conciseness | 15 | No verbose or obvious info? |
| Currency | 15 | Reflects current codebase state? |
| Actionability | 15 | Instructions executable, not vague? |

Grades: **A** 90-100 · **B** 70-89 · **C** 50-69 · **D** 30-49 · **F** 0-29.

### 3. Quality report — ALWAYS output BEFORE any update

```
## CLAUDE.md Quality Report

### Summary
- Files found: X
- Average score: X/100
- Files needing update: X

### File-by-File Assessment

#### 1. ./CLAUDE.md (Project Root) — Score: XX/100 (Grade: X)
| Criterion | Score | Notes |
|-----------|-------|-------|
| ... |

**Issues:** [specific problems]
**Recommended additions:** [what should be added]
```

### 4. Targeted updates — after approval

Propose targeted additions only: commands/workflows discovered during analysis, gotchas, package relationships, working test approaches, config quirks.

Keep minimal — avoid restating what's obvious from code, generic best practices, one-off fixes, verbose explanations.

Show a diff per change: which file, the specific addition, brief why-it-helps. Apply with Edit after approval; preserve existing structure.

## Common issues to flag

Stale build commands · missing required tools · outdated architecture · missing env setup · broken test commands · undocumented gotchas.

## What makes a great CLAUDE.md

Concise, human-readable, copy-paste-ready commands, project-specific patterns (not generic advice), non-obvious gotchas.

Recommended sections (use only what's relevant): Commands · Architecture · Key Files · Code Style · Environment · Testing · Gotchas · Workflow.

## Tips to share

- `#` key during a session auto-incorporates learnings into CLAUDE.md.
- `.claude.local.md` for personal preferences (gitignore it); `~/.claude/CLAUDE.md` for user-wide defaults.
- Dense beats verbose.
