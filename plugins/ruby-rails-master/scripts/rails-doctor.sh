#!/usr/bin/env bash
# Triage report for an existing Rails project. Prints versions, structural
# stats, gem audit, schema/state observations.
#
# Usage:
#   scripts/rails-doctor.sh
#
# Run from project root.

set -euo pipefail

print_h() { printf '\n=== %s ===\n' "$1"; }

if [ ! -f "Gemfile" ]; then
  printf 'error: no Gemfile here. Run from the project root.\n' >&2
  exit 1
fi

print_h "Versions"
ruby -v 2>/dev/null || printf 'ruby: not in PATH\n'
if command -v bundle >/dev/null 2>&1; then
  bundle --version
fi
if [ -f "Gemfile.lock" ]; then
  printf 'rails: '
  awk '/^    rails \(/{print $2; exit}' Gemfile.lock | tr -d '()'
  printf '\n'
fi

print_h "App size"
[ -d app ] && find app -name '*.rb' | wc -l | xargs printf '  Ruby files in app/: %s\n'
[ -d app/models ] && find app/models -name '*.rb' | wc -l | xargs printf '  Models: %s\n'
[ -d app/controllers ] && find app/controllers -name '*.rb' | wc -l | xargs printf '  Controllers: %s\n'
[ -d app/services ] && find app/services -name '*.rb' | wc -l | xargs printf '  Services: %s\n' || printf '  Services: 0 (no app/services/ — consider creating)\n'
[ -d test ] && find test -name '*_test.rb' | wc -l | xargs printf '  Minitest files: %s\n' || true
[ -d spec ] && find spec -name '*_spec.rb' | wc -l | xargs printf '  RSpec files: %s\n' || true

print_h "DB / migrations"
[ -d db/migrate ] && find db/migrate -name '*.rb' | wc -l | xargs printf '  Migrations: %s\n' || true
if [ -f db/schema.rb ]; then
  printf '  schema.rb size: %s lines\n' "$(wc -l < db/schema.rb)"
elif [ -f db/structure.sql ]; then
  printf '  structure.sql size: %s lines\n' "$(wc -l < db/structure.sql)"
fi

print_h "Test framework"
if grep -q 'rspec-rails' Gemfile.lock 2>/dev/null; then
  printf '  RSpec\n'
elif [ -f test/test_helper.rb ]; then
  printf '  Minitest (default)\n'
else
  printf '  unclear — neither RSpec nor a test_helper.rb found\n'
fi

print_h "Linting / security tooling"
for gem in rubocop rubocop-rails rubocop-performance brakeman bundler-audit bullet strong_migrations; do
  if grep -q "^    $gem " Gemfile.lock 2>/dev/null; then
    printf '  ✓ %s\n' "$gem"
  else
    printf '  ✗ %s (consider adding)\n' "$gem"
  fi
done

print_h "Git status"
if command -v git >/dev/null 2>&1; then
  if git rev-parse --git-dir >/dev/null 2>&1; then
    branch="$(git rev-parse --abbrev-ref HEAD)"
    ahead="$(git rev-list --count "${branch}@{u}..${branch}" 2>/dev/null || echo "?")"
    printf '  Branch: %s\n' "$branch"
    printf '  Commits ahead of upstream: %s\n' "$ahead"
    printf '  Uncommitted files: %s\n' "$(git status --porcelain | wc -l | tr -d ' ')"
  else
    printf '  not a git repo\n'
  fi
fi

print_h "CVE / security audit"
if command -v bundle >/dev/null 2>&1; then
  if bundle exec bundler-audit --version >/dev/null 2>&1; then
    bundle exec bundler-audit check --update 2>&1 | tail -20 || true
  else
    printf '  bundler-audit not installed; install via `gem install bundler-audit`\n'
  fi
fi

print_h "Tests last passing?"
if [ -d log ] && [ -f log/test.log ]; then
  printf '  log/test.log present (size: %s lines). Use `bin/rails test` or `bundle exec rspec` to refresh.\n' "$(wc -l < log/test.log)"
else
  printf '  no log/test.log — tests may not have been run recently\n'
fi

print_h "Suggested next steps"
printf '  - Run `scripts/find-fat-files.sh` to surface size violations.\n'
printf '  - Run `scripts/find-callbacks.sh` to find callback hot spots.\n'
printf '  - Use `/rails-review` to audit recent changes.\n'
printf '  - Use `/find-smells` for a graded smell report.\n'
