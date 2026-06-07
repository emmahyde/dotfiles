# Chapter 6: Looping & Iteration

## Core Idea
Python loops are "for-each" loops over iterables. Comprehensions, slicing, the iterator protocol, generators, generator expressions, and iterator chains are progressive layers of syntactic sugar over one underlying pattern — letting you process data lazily, memory-efficiently, and readably.

## Frameworks Introduced
- **Pythonic loops (6.1)**: Iterate the container directly; use `enumerate()` for an index, `dict.items()` for key+value, `range(a, n, s)` for stepped C-style loops.
  - Anti-pattern: `for i in range(len(x))` and manual index counters.
- **Comprehensions (6.2)**: `[expr for item in collection if condition]` — sugar for a build-up loop. Also set `{...}` and dict `{k: v for ...}` comprehensions.
- **Slicing / "sushi operator" (6.3)**: `lst[start:stop:step]` (upper bound exclusive). `lst[::-1]` reverses, `del lst[:]` clears in place, `lst[:] = [...]` replaces in place, `lst[:]` shallow-copies.
- **Iterator protocol (6.4)**: Implement `__iter__` (returns the iterator) and `__next__` (returns next value or raises `StopIteration`). `for-in` is sugar for `iter()` + repeated `next()` in a try/except.
- **Generators (6.5)**: Functions using `yield` instead of `return`; `yield` suspends and retains local state. Far less boilerplate than class iterators; ending the function raises `StopIteration` automatically.
- **Generator expressions (6.6)**: `(expr for item in collection if condition)` — lazy, single-use, memory-efficient; parens optional when sole function argument.
- **Iterator chains (6.7)**: Feed one generator's output into the next to build lazy, one-element-at-a-time pipelines (Unix-pipe style).

## Key Concepts
- **`range`**: Immutable lazy number sequence — constant small memory, computes on the fly.
- **`StopIteration`**: The exception signaling iterator exhaustion; iterators can't be reset (request a fresh `iter()`).
- **`yield` vs `return`**: `return` discards local state and ends; `yield` suspends and resumes.
- **Facade builtins**: Prefer `iter(x)`/`next(x)`/`len(x)` over calling `x.__iter__()`/`__next__()`/`__len__()` directly.
- **genexpr vs listcomp**: `[...]` builds a full list; `(...)` yields just-in-time, can't be reused once consumed.

## Mental Models
- Iterators = database cursor: prepare once, fetch one element at a time, isolated from the container's internals — enables *infinite* sequences.
- Generator chains = Unix pipeline: `negated(squared(integers()))` streams each element through all stages with no buffering.
- Generators are "just" syntactic sugar for the iterator protocol.

## Anti-patterns
- **`range(len(...))` / manual index counters**: Use direct iteration or `enumerate()`.
- **Comprehensions/genexprs nested >2 levels**: Becomes unreadable — factor into named sub-generators or fall back to loops.
- **Reusing a consumed generator expression**: It's exhausted; rebuild it or use a generator function/class iterator.

## Code Examples
```python
# Class iterator → generator → generator expression (same behavior)
def bounded_repeater(value, max_repeats):     # generator
    for _ in range(max_repeats):
        yield value

# Lazy pipeline, one element at a time
integers = range(8)
squared  = (i * i for i in integers)
negated  = (-i for i in squared)
# list(negated) -> [0, -1, -4, -9, -16, -25, -36, -49]

# Parens optional as sole argument
total = sum(x * 2 for x in range(10))
```
- **What it demonstrates**: Collapsing a verbose class iterator into a 3-line generator, then chaining lazy generator expressions.

## Key Takeaways
1. Iterate containers directly; reach for `enumerate`/`items`/stepped `range` instead of manual indices.
2. Comprehensions (list/set/dict) are sugar for a build-up loop — keep to one nesting level.
3. The iterator protocol is `__iter__` + `__next__` + `StopIteration`; `for-in` just calls them.
4. Generators (`yield`) and generator expressions replace most class iterators with far less code and lazy, memory-efficient evaluation.
5. Chain generators into pipelines that process one element at a time with no buffering.

## Connects To
- **Ch 3**: Generator functions pair with `@contextlib.contextmanager`; comprehensions replace lambda-heavy `map`/`filter`.
- **Ch 5**: Comprehensions construct the data structures from Ch 5; `heapq`/`deque` consume iterables.
- **Ch 7**: Dict comprehensions and iteration power the dictionary tricks.
