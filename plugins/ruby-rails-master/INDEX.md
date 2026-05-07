# ruby-rails-master — Index

## Skills
- [`idiomatic-ruby-and-rails`](skills/idiomatic-ruby-and-rails/SKILL.md) — language + framework idioms
  - [`lessons.md`](skills/idiomatic-ruby-and-rails/lessons.md) — long-form distillation
  - [`cheatsheet.md`](skills/idiomatic-ruby-and-rails/cheatsheet.md) — reach-for-it Rails reference
- [`sandi-metz-design`](skills/sandi-metz-design/SKILL.md) — OO design philosophy
  - [`lessons.md`](skills/sandi-metz-design/lessons.md) — POODR + 99 Bottles distilled
  - [`flocking-walkthrough.md`](skills/sandi-metz-design/flocking-walkthrough.md) — Flocking Rules worked example
- [`clean-code-and-refactoring`](skills/clean-code-and-refactoring/SKILL.md) — language-agnostic craft
  - [`lessons.md`](skills/clean-code-and-refactoring/lessons.md) — Clean Code + Code Complete
  - [`smells-catalog.md`](skills/clean-code-and-refactoring/smells-catalog.md) — graded smells with refactor moves
- [`algorithms-and-data-structures`](skills/algorithms-and-data-structures/SKILL.md) — complexity + structures
  - [`lessons.md`](skills/algorithms-and-data-structures/lessons.md) — CLRS / Sedgewick / Skiena / Knuth
  - [`complexity-cheatsheet.md`](skills/algorithms-and-data-structures/complexity-cheatsheet.md) — Big-O reference

## Agents
- [`rails-architect`](agents/rails-architect.md) — design new apps; audit structure
- [`oo-refactorer`](agents/oo-refactorer.md) — apply Sandi Metz / POODR moves mechanically
- [`rails-reviewer`](agents/rails-reviewer.md) — code review with Rails-aware idioms
- [`test-designer`](agents/test-designer.md) — design tests using Sandi's taxonomy
- [`perf-hunter`](agents/perf-hunter.md) — find N+1, missing indexes, slow rendering

## Slash commands
- [`/rails-review`](commands/rails-review.md) — review the diff
- [`/extract-service`](commands/extract-service.md) — extract a service object
- [`/refactor-flock`](commands/refactor-flock.md) — apply Flocking Rules
- [`/find-smells`](commands/find-smells.md) — graded smell scan
- [`/replace-conditional`](commands/replace-conditional.md) — case-on-type → polymorphism
- [`/test-strategy`](commands/test-strategy.md) — design test plan
- [`/n-plus-one`](commands/n-plus-one.md) — hunt N+1 queries
- [`/rails-bootstrap`](commands/rails-bootstrap.md) — opinionated new-app scaffold

## Templates
- [`service_object.rb`](templates/service_object.rb)
- [`form_object.rb`](templates/form_object.rb)
- [`query_object.rb`](templates/query_object.rb)
- [`value_object.rb`](templates/value_object.rb)
- [`minitest_template.rb`](templates/minitest_template.rb) — uses `def test_*` form
- [`rspec_template.rb`](templates/rspec_template.rb)
- [`migration_template.rb`](templates/migration_template.rb)
- [`shared_example.rb`](templates/shared_example.rb)
- [`rubocop.yml`](templates/rubocop.yml)
- [`pre-commit-config.yaml`](templates/pre-commit-config.yaml)

## Scripts
- [`scripts/find-fat-files.sh`](scripts/find-fat-files.sh) — Metz Rules violations
- [`scripts/find-callbacks.sh`](scripts/find-callbacks.sh) — callback hot spots
- [`scripts/rails-doctor.sh`](scripts/rails-doctor.sh) — codebase triage report
- [`scripts/n-plus-one-finder.rb`](scripts/n-plus-one-finder.rb) — heuristic N+1 scan

## Top-level
- [`plugin.json`](.claude-plugin/plugin.json) — plugin metadata
- [`README.md`](README.md) — what this is + how to install
- [`CLAUDE.md`](CLAUDE.md) — auto-loaded posture and conventions
- [`INDEX.md`](INDEX.md) — this file
