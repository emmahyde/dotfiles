# Migrating from Ruby 3.x to 4.0

Practical upgrade guide: what breaks, what moved out of core, and the phased path. Ruby 4.0.0 shipped Dec 25, 2025; 4.0.1 followed Jan 13, 2026 — it is released, not pre-release.

Sources: [RubyLearning Ruby 4.0 Adoption Guide](https://rubylearning.com/blog/2026/03/09/ruby-4-adoption-guide/), reconciled against the primary [Ruby 4.0.0 release announcement](https://www.ruby-lang.org/en/news/2025/12/25/ruby-4-0-0-released/) and [4.0.1 announcement](https://www.ruby-lang.org/en/news/2026/01/13/ruby-4-0-1-released/). Items below are confirmed against the official 4.0.0 announcement unless tagged _(adoption guide; unverified against primary)_.

## Phased upgrade path

1. **Get to Ruby 3.4 first.** If on 3.2/3.3, upgrade to 3.4 before attempting 4.0. Ruby 3.4 added deprecation warnings for APIs removed in 4.0 — run the suite on 3.4 with `RUBYOPT="-W:deprecated"` to surface most issues before they become hard errors on 4.0.
2. **Audit breaking changes** (list below).
3. **Upgrade Ruby and Rails separately.** Do the Ruby 4.0 jump on your current Rails version, stabilize, *then* upgrade Rails. Combining them makes failures hard to attribute.

## Breaking changes most likely to bite

- **Ractor communication overhaul.** The old primitives `Ractor.yield`, `Ractor#take`, `Ractor#close_incoming`, `Ractor#close_outgoing` are **removed** (Feature #21262), replaced by the new `Ractor::Port` class for message passing; `Ractor.shareable_proc` was added to share `Proc`s between Ractors. Any Ractor code needs updating. (The adoption guide also lists `Ractor#join`/`Ractor#value` — plausible per the Port revamp but not named in the official 4.0.0 highlights; verify against full NEWS before relying on them.)
- **`*nil` no longer calls `nil.to_a`** — code relying on that implicit conversion breaks.
- **`--rjit` removed** — switch deployment scripts to `--yjit`.
- **Pipe-based `Kernel#open` / `IO` process creation removed** — use `IO.popen` explicitly.
- **`Net::HTTP`** no longer auto-adds `Content-Type: application/x-www-form-urlencoded` for requests with a body — set it explicitly if your clients depend on it.
- **`SortedSet` removed** — install the `sorted_set` gem if needed.
- **`CGI` reduced** — only `cgi/escape` remains; add the `cgi` gem for anything else.
- **`Set#inspect` format changed** to `Set[1, 2, 3]` (was `#<Set: {1, 2, 3}>`); `Proc#parameters` output also changed; passing args to `to_set` deprecated. Code/tests parsing these formats will break. _(adoption guide; not in the official 4.0.0 highlights — verify against full NEWS)_
- **Backtraces changed** (confirmed): `ArgumentError` "wrong number of arguments" now names the receiver (`Foo#bar`), and backtraces no longer show `internal` C frames. Verify log-parsing/alerting rules in Sentry/Honeybadger/Rollbar still match.

## Standard library promotions (Gemfile impact)

Now **bundled gems** — if you `require` them without listing them in your Gemfile, you get warnings/errors: `ostruct`, `logger`, `irb`, `rdoc`, `benchmark`, `pstore`.

Promoted **to core** (no `require` needed, existing `require` still works): `Set`, `Pathname`.

Ships with **Bundler 4.0.3**, **RubyGems 4.0.3**, **OpenSSL 4.0.0**.

## JIT: ZJIT vs YJIT

- **YJIT** remains the recommended production JIT.
- **ZJIT** is new in 4.0 (`--zjit` flag): faster than the interpreter but not yet at YJIT's level. The Ruby team recommends against production ZJIT until **4.1**. Building ZJIT support requires **Rust 1.85.0+** (affects Docker images, CI runners, build servers; YJIT does not need Rust).

## Gem compatibility checks

```bash
# 1. Set .ruby-version to 4.0.1 and bundle
bundle install
# 2. If gems fail, try conservative updates
bundle update --conservative
# 3. Find gems pinning a ruby version
grep -r "required_ruby_version" vendor/bundle/ | grep -v "4.0"
# 4. Recompile C-extension gems
bundle pristine
# 5. Run the suite surfacing deprecations
RUBYOPT="-W:deprecated" bundle exec rspec
```

Commonly need attention:

- **ostruct / logger / irb / benchmark** — add to Gemfile if required directly.
- **Gems using `Ractor.yield` / `Ractor#take`** — need versions updated to `Ractor::Port`.
- **Nokogiri, pg, mysql2** (C extensions) — `bundle pristine` after the Ruby upgrade.
- **Puma** — need 6+ for Ruby 4.0.
- **RSpec** — the `it` block parameter (Ruby 3.4) still conflicts with RSpec's `it`; recent RSpec handles it, but custom matchers may warn.
- **OpenSSL** — gems pinning older openssl may need updates.
- **Gems parsing `Set#inspect` or `Proc#parameters`** — both formats changed.

## CI / production implications

- **Build toolchain** — ZJIT support needs Rust 1.85.0+; YJIT does not.
- **Backtraces** now include receiver class/module names (e.g. `Foo#bar`) and drop internal C frames — verify Sentry/Honeybadger/Rollbar log-parsing and alert rules still match.
- **Memory profile** — new "fields" objects for instance variables and variable-width allocation for larger integers change memory layout; re-baseline memory monitoring.
- **CI matrix** — add Ruby 4.0 alongside 3.4; drop 3.2 and earlier (EOL). Run 4.0 with `RUBYOPT="-W:deprecated"`.
- **Bundler cache** — clear cached `vendor/bundle` after upgrading to avoid stale native extensions.
