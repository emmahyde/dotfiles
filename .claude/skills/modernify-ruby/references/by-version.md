# Ruby by version (3.0 → 4.0)

Per-release highlights. Code samples are quoted verbatim from the source changelog. Each release ships Dec 25 of the named year. Source: rubyreferences.github.io/rubychanges.

---

## Ruby 3.0 — Dec 2020

A major language release. Highlights:

- **Full keyword/positional argument separation.** Keyword args are no longer auto-converted to/from a trailing hash. This is the big breaking change of 3.0.
- **Pattern matching is stable** (was experimental in 2.7), plus two one-line forms and the find pattern:

```ruby
# case/in (multi-line)
case config
in version: 'legacy', username:    # binds username
  puts "legacy user '#{username}'"
in db: {user:}
  puts "db user '#{user}'"
in String => username
  puts username
end

# rightward assignment (deconstruct; raises on no match)
{a: 1, b: 2} => {a:}              # a == 1
long.chain.of.computations => result

# boolean check (returns true/false; also deconstructs)
if {a: 1, b: 2} in {a:}
  # ...
end
```

- **Find pattern** — `in [*, target, *]` matches an element anywhere in an array.
- **Endless method definition:** `def square(x) = x * x` (body must be a single expression; bare command-call form like `def m = puts "x"` needs 3.1).
- **Ractor** — actor-model object enabling true parallelism by lifting the GVL (experimental).
- **Non-blocking Fiber + Fiber scheduler** for async IO.
- **RBS** type declarations (in separate `.rbs` files) and `TypeProf`.
- **GC auto-compaction** via `GC.auto_compact=`.
- `SortedSet` removed from the `set` stdlib.

---

## Ruby 3.1 — Dec 2021

Stabilization release; notable new syntax:

- **Hash literal & keyword value omission** — `x:` is shorthand for `x: x`, pulling the value from the surrounding scope:

```ruby
x, y = 100, 200
{x:, y:}        # => {x: 100, y: 200}
p(x:, y:)       # method call form

# any in-scope name works (locals, constants, methods); dynamic/quoted symbols do NOT
{z:}            # => NameError if z undefined
{"#{name}":}    # SyntaxError
```

- **Anonymous block forwarding** — accept and pass a block with bare `&`:

```ruby
def my_each(&) = some_collection.each(&)
```

- **Pattern matching: pin expressions** — `in ^(expr)` and pinning of non-local variables.
- **Endless methods allow command syntax** (omit parens in the body): `def log(msg) = puts "#{Time.now}: #{msg}"` (was a SyntaxError in 3.0).
- `Struct.keyword_init?`; warning when passing keywords to a non-`keyword_init` Struct.
- `Time.new` gains an `in:` parameter for timezone construction; low-level `IO::Buffer`.

---

## Ruby 3.2 — Dec 2022

- **`Data` — immutable value object class.** Stricter and leaner than `Struct`; prefer it for value types:

```ruby
Point = Data.define(:x, :y)

p1 = Point.new(1, 0)        # positional
p2 = Point.new(x: 0, y: 1)  # or keyword
Point.new(1)                # ArgumentError — all args mandatory
p1.x = 5                    # NoMethodError — no setters
p1.with(y: 100)             # => new Point(x: 1, y: 100); p1 unchanged
```

- **Anonymous `*` / `**` forwarding** — pass anonymous positional/keyword args onward:

```ruby
def only_keywords(**) = p(**)
def only_positional(*) = p(*)
def both(*, **) = p(*, **)      # equivalent to ...
def get(url, **) = send_request(:get, url, **)
```

- **`Set` is a built-in class** — no more `require 'set'`.
- **`Struct.new` accepts positional and keyword args by default** (unless `keyword_init:` is set explicitly).
- Pattern matching support in `Time` and `MatchData`; per-`Fiber` storage; more inspectable refinements.

---

## Ruby 3.3 — Dec 2023

A smaller release. Note: features here are *additions*; the `it` change only *warns* (it lands in 3.4).

- **`it` deprecation warning** — using standalone `it` inside a block as a bare call now warns that it will become the anonymous block parameter in 3.4. (Not yet the parameter in 3.3.)
- **`Range#overlap?`** — `(1..5).overlap?(4..8)` → `true`.
- **`Module#set_temporary_name`** — name an otherwise-anonymous module/class for nicer inspection.
- **`ObjectSpace::WeakKeyMap`**; **`Fiber#kill`**.
- New `Warning` category `:performance`.

---

## Ruby 3.4 — Dec 2024

- **`it` as the anonymous block parameter** (this is where it lands, not 3.3):

```ruby
[1, 2, 3].map { it ** 2 }   # => [1, 4, 9]
[1, 2, 3].map { _1 ** 2 }   # numbered params still work
[1, 2, 3].map { _1 + it }   # SyntaxError — can't mix it with _1
```

`it` is a soft keyword: a local variable or method named `it` in scope takes precedence over the anonymous parameter; unlike `_1`, `it` is allowed in nested blocks.

- **`**nil` unpacks into empty keyword arguments** — enables conditional keyword passing without an empty-hash allocation:

```ruby
def handle_options(**kwargs) = p kwargs
handle_options(**nil)                              # 3.4: prints {}  (3.3: TypeError)
handle_options(**(extra_options if some_condition?))  # clean conditional kwargs
```

- **`Range#step` iterates any type via `+`** (not just numerics).
- **Frozen string literals: a warning, not the default.** 3.4 adds a warning to prepare for string literals becoming frozen in **Ruby 3.5** — they are *not* frozen by default in 3.4.
- Backtrace formatting improvements; `Warning.categories`; Ractor improvements.

---

## Ruby 4.0 — Dec 2025

Version chosen by Matz to mark Ruby's 30th birthday — not a SemVer-style break.

- **Leading logical operators continue the previous line** — `&&`/`||`/`and`/`or` (and comments) at the start of a line are parsed as continuation:

```ruby
legible?
  # inline comments work here too
  || trial?
  || admin?

some.very.long.calculation
  or return            # very visible early-return guard
```

(These were `SyntaxError` in 3.4.)

- **`Pathname` is a core class** — no `require 'pathname'` needed.
- **`Set` reimplemented** more efficiently (now backed by a dedicated C implementation).
- **`Ruby::Box`** — experimental concept for loading libraries into isolated namespaces. Requires `RUBY_BOX=1`:

```ruby
box = Ruby::Box.new
box.require('cgi')
box.eval('CGI.escape("test me")')   # => "test+me"
CGI                                  # NameError — only loaded inside the box
```

- **`Ractor::Port`** — new class for Ractor message passing. The old primitives (`Ractor.yield`, `Ractor#take`, `Ractor#close_incoming`, `Ractor#close_outgoing`) are **removed** (Feature #21262); `Ractor.shareable_proc` added. Breaking for any Ractor code — see `migrating-to-4.0.md`.
- **`*nil` no longer calls `nil.to_a`** — interpreted as "no arguments" with no intermediate array (the positional-arg analogue of 3.4's `**nil`).
- ZJIT (a new experimental JIT compiler) and RubyGems/Bundler 4 ship with this release (implementation-level, see the NEWS file).
