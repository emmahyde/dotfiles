# ruby-rails-master

A Claude Code plugin that turns Claude into an idiomatic Ruby on Rails master. Bundles four skills, five specialist agents, eight slash commands, and a toolkit of templates and scripts.

## What's inside

### Skills (auto-loaded by topic)

| Skill | When it triggers |
|---|---|
| `idiomatic-ruby-and-rails` | Writing or reviewing Ruby/Rails; choosing models vs services; ActiveRecord patterns |
| `sandi-metz-design` | OO design / refactoring; inheritance vs composition; the Metz Rules; testing seams |
| `clean-code-and-refactoring` | Naming, function design, smells, refactoring discipline (language-agnostic craft) |
| `algorithms-and-data-structures` | Choosing a data structure; analyzing complexity; designing an algorithm |

Each skill has `SKILL.md` (terse heuristics) plus `lessons.md` (long-form distillation) plus a topic-specific reference file (cheatsheet / catalog / walkthrough).

### Agents (specialist subagents)

| Agent | Role |
|---|---|
| `rails-architect` | Design new Rails apps: contexts, models, services, jobs, deploy story |
| `oo-refactorer` | Apply Sandi Metz / POODR refactoring mechanically; flock toward abstractions |
| `rails-reviewer` | Code review with Rails-aware idioms, security, N+1, testing |
| `test-designer` | Design tests using Sandi's outgoing/incoming/query/command taxonomy |
| `perf-hunter` | Find and fix N+1 queries, slow controllers, missing indexes, allocation hot spots |

### Slash commands

| Command | What it does |
|---|---|
| `/rails-review` | Review the current diff (or a file) with Rails idioms in mind |
| `/extract-service` | Extract a service object from a fat model or controller |
| `/refactor-flock` | Apply Sandi's Flocking Rules to two similar pieces of code |
| `/find-smells` | Scan a file or directory for design smells with severity ranking |
| `/replace-conditional` | Convert a `case`/`if` on type into polymorphism, step by step |
| `/test-strategy` | Design a test plan for a class using Sandi's message taxonomy |
| `/n-plus-one` | Hunt N+1 queries in a controller / view; suggest preloads |
| `/rails-bootstrap` | Generate an opinionated new-Rails-app starting point (services, query objects, conventions) |

### Templates (`templates/`)

Ruby/Rails skeletons ready to copy/paste:
- `service_object.rb` — command-shaped service with result objects
- `form_object.rb` — multi-model form with validation
- `query_object.rb` — composable AR query
- `value_object.rb` — immutable value type with `==`/`hash`/`<=>`
- `minitest_template.rb` and `rspec_template.rb` — idiomatic test scaffolds
- `migration_template.rb` — reversible migration with index pattern
- `shared_example.rb` — duck-type contract test
- `rubocop.yml` — opinionated Ruby style baseline
- `pre-commit-config.yaml` — hooks for rubocop, brakeman, rspec/minitest

### Scripts (`scripts/`)

POSIX shell + Ruby utilities for diagnosing a Rails codebase:
- `find-fat-files.sh` — list files violating the Metz Rules (≥100-line classes, ≥5-line methods)
- `find-callbacks.sh` — surface AR callback usage (a smell to review)
- `rails-doctor.sh` — print Ruby/Rails versions, gem audit, open issues
- `n-plus-one-finder.rb` — heuristic scan for missing eager loads

### Top-level documents

- `CLAUDE.md` — plugin-wide context that Claude loads automatically
- `INDEX.md` — quick map of skills, agents, commands, templates

## Installing

In a Claude Code session:

```
/plugin install <path-to-this-folder>
```

Or copy the folder under `~/.claude/plugins/` (manual install).

## Source

The skills are distilled from POODR, 99 Bottles of OOP, Clean Code, Code Complete 2e, the Rails Doctrine, the Rails Guides, the Ruby Style Guide, CLRS, Sedgewick & Wayne, Skiena, and Knuth Vol 3.
