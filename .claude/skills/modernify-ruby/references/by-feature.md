# Ruby by feature — cross-version evolution

Thematic map of how each feature evolved across versions, with per-step version tags. Drawn from the [Ruby Evolution](https://rubyreferences.github.io/rubychanges/evolution.html) "bird's-eye" page, which tracks changes back to 2.0 (2013). Use this when a feature exists across many versions and you need to know exactly which step landed in which release.

Version tags are exact. Bold = the step most people mean when they name the feature.

## Pattern matching

- **2.7** — introduced, experimental (`case`/`in`).
- **3.0** — **stable**; one-line forms added: `=>` (rightward assignment, raises on mismatch) and `in` (boolean check); **find pattern** `in [*, x, *]`.
- **3.1** — parentheses can be omitted in one-line matching (`[0, 1] => _, x`); pin operator accepts expressions and non-local variables (`in ^(a + b)`).
- **3.2** — `deconstruct`/`deconstruct_keys` support added to `Time` and `MatchData`.

## Blocks, procs, anonymous parameters

- **2.6** — `Proc` composition with `>>` and `<<`.
- **2.7** — **numbered block parameters** `_1`, `_2`, …: `[1,2,3].map { _1 * 100 }`.
- **3.3** — standalone `it` in a block *warns* that it will become the anonymous parameter next version.
- **3.4** — **`it` becomes the anonymous block parameter**: `arr.map { it ** 2 }`. Can't be mixed with `_1`; soft keyword (local/method `it` wins); allowed in nested blocks (unlike `_1`).

## Method arguments

- **2.0** — keyword arguments introduced (optional only); top-level `define_method`.
- **2.1** — **required keyword arguments** (`def m(x:)`); `def` returns the method name symbol.
- **3.0** — **keyword args fully separated from positional** (no implicit hash↔kwargs conversion). The major 3.0 breaking change.
- **3.1** — anonymous **block** forwarding: `def m(&) = n(&)`.
- **3.2** — anonymous **positional/keyword** forwarding: `def m(*, **) = n(*, **)`.

## Value objects: `Data` and `Struct`

- **2.5** — `Struct.new(..., keyword_init: true)`.
- **3.1** — `Struct.keyword_init?`; warning on passing keywords to a non-keyword-init Struct.
- **3.2** — **`Data.define`** — new immutable value class (mandatory args, no setters, `#with` for copies); `Struct.new` accepts positional *and* keyword by default.

Prefer `Data` over `Struct` for immutable value types on 3.2+.

## Endless methods

- **3.0** — **endless method definition**: `def square(x) = x * x` (single-expression body).
- **3.1** — command syntax allowed in the body (no parens): `def log(m) = puts m`.

## Hash

- **2.0** — `#to_h` convention introduced (on `Hash`, `nil`, `Struct`); `Kernel#Hash()`.
- **2.1** — `Array#to_h`, `Enumerable#to_h`.
- **2.2** — `{**h1, **h2}` later keys win; quoted symbol keys `{"data-key": v}`.
- **2.3** — `#fetch_values`; comparison operators `#<`, `#>`, `#<=`, `#>=` (subset/superset).
- **2.6** — `#to_h` accepts a block: `users.to_h { [it.name, it.admin?] }`.
- **3.1** — **value omission** `{x:, y:}` (shorthand for `{x: x, y: y}`).

## Freezing & immutability

- **2.0** — Integers and Floats frozen.
- **2.1** — all Symbols frozen; `"literal".freeze` returns the same object each time.
- **2.2** — `nil`/`true`/`false` frozen.
- **2.3** — `String#+@` (mutable copy) and `#-@` (frozen copy).
- **2.5** — `String#-@` deduplicates frozen strings.
- **3.4** — *warning* added to prepare for string literals being frozen by default in **3.5** (not yet the default in 3.4).

## `Set`

- **3.0** — `Set#join`, `#<=>`, and other additions (still in stdlib, needs `require 'set'`).
- **3.2** — **`Set` becomes a built-in class** (no `require`).
- **4.0** — `Set` reimplemented in C for efficiency.

## Concurrency

- **3.0** — **`Ractor`** (actor-model parallelism, lifts the GVL; experimental); **non-blocking `Fiber` + `Fiber` scheduler** for async IO.
- **3.2** — per-`Fiber` storage.
- **3.3** — `Fiber#kill`.
- **4.0** — `Ractor::Port`; `Ruby::Box` (experimental isolated namespace loading, needs `RUBY_BOX=1`).

## Anything not covered here

This map and `by-version.md` cover the headline language changes for 3.0–4.0 (plus pre-3.0 context). For the long tail — individual core-method additions, stdlib changes, deprecations — fetch the specific version page from rubyreferences.github.io/rubychanges (e.g. `3.2.html`) rather than guessing the version.
