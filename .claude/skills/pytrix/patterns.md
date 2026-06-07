# Patterns & Techniques — Python Tricks

## Assertions as self-checks
**When to use**: Catch "impossible" conditions / programmer bugs during development.
**How**: `assert 0 <= price <= product['price'], msg`. Never for data validation or auth.
**Trade-offs**: Disabled under `-O`/`-OO`/`PYTHONOPTIMIZE` — silent no-op in production.

## Trailing-comma collection style
**When to use**: Any multi-line list/dict/set literal.
**How**: End every element line with a comma, including the last.
**Trade-offs**: Cleaner diffs and no accidental string-literal concatenation; trivial cost.

## Context manager (resource acquire/release)
**When to use**: Files, locks, timers, any acquire/release pair.
**How**: Class with `__enter__`/`__exit__`, or `@contextlib.contextmanager` on a generator that `yield`s the resource in a try/finally.
**Trade-offs**: Generator form is terser but requires understanding decorators+generators.

## Robust decorator
**When to use**: Cross-cutting concerns (logging, timing, auth, caching) over many functions.
**How**: `def deco(func): @functools.wraps(func)\n def wrapper(*args, **kwargs): ...; return func(*args, **kwargs)\n return wrapper`.
**Trade-offs**: Always use `functools.wraps` or you lose `__name__`/`__doc__`; deep stacking adds call overhead.

## Closure factory
**When to use**: Pre-configuring behavior (e.g. `make_adder(n)`).
**How**: Outer function returns an inner function that captures outer params.
**Trade-offs**: Cleaner than a class for simple state; harder to introspect than an object.

## Argument forwarding / unpacking
**When to use**: Wrapper functions, subclass constructors, spreading sequences/dicts into calls.
**How**: Collect with `def f(*args, **kwargs)`; forward/spread with `f(*seq, **mapping)`.
**Trade-offs**: Flexible but produces opaque signatures.

## Always-`__repr__` for classes
**When to use**: Every custom class.
**How**: `def __repr__(self): return f'{self.__class__.__name__}({self.x!r}, ...)'`. Add `__str__` only when a user-facing form differs.
**Trade-offs**: Minimal effort, big debugging payoff; `__class__.__name__` keeps it DRY.

## Custom exception hierarchy
**When to use**: Libraries/modules; any place generic errors obscure intent.
**How**: Module base `class MyError(Exception)`; derive `class SpecificError(MyError)`.
**Trade-offs**: Lets callers catch a family with one `except`; avoid over-nesting.

## ABC interface enforcement
**When to use**: Class hierarchies where subclasses must implement an interface.
**How**: `class Base(metaclass=ABCMeta)` + `@abstractmethod`.
**Trade-offs**: Errors surface at instantiation, not first call; not full compile-time checking.

## classmethod factories (alternative constructors)
**When to use**: Multiple ways to build an object (Python allows one `__init__`).
**How**: `@classmethod def variant(cls): return cls(...)`.
**Trade-offs**: Self-documenting; uses `cls` for DRY/inheritance.

## Shallow vs deep copy
**When to use**: Cloning mutable objects you'll mutate independently.
**How**: `list(x)`/`copy.copy(x)` (shallow); `copy.deepcopy(x)` (full independence).
**Trade-offs**: Deep copy is slower but safe for nested structures.

## Pythonic loops
**When to use**: All iteration.
**How**: Iterate directly; `enumerate()` for index; `dict.items()` for k/v; `range(a, n, s)` for stepped.
**Trade-offs**: Avoids off-by-one/infinite-loop bugs vs `range(len(...))`.

## Comprehensions
**When to use**: Transform/filter a collection into a list/set/dict.
**How**: `[expr for item in coll if cond]`.
**Trade-offs**: Concise; keep to one nesting level for readability.

## Generators & generator expressions
**When to use**: Custom iterators, lazy streams, large/infinite sequences.
**How**: `def g(): yield ...` or `(expr for item in coll if cond)`.
**Trade-offs**: Memory-efficient and terse; genexprs are single-use.

## Iterator chain (data pipeline)
**When to use**: Multi-stage data processing.
**How**: Feed one generator into the next: `negated(squared(integers()))` or chained genexprs.
**Trade-offs**: One element at a time, no buffering; genexprs can't take args.

## Dict `get()` default
**When to use**: Lookups with a fallback.
**How**: `d.get(key, default)`.
**Trade-offs**: One lookup, no KeyError; or use `defaultdict`/EAFP.

## Dict dispatch table (switch/case)
**When to use**: Replacing long `if/elif` value dispatch.
**How**: `{key: func}.get(key, default)()`; hoist the dict to a module constant.
**Trade-offs**: Cleaner at scale; per-call dict creation is wasteful — define once.

## Sort with key func
**When to use**: Custom orderings of collections/dicts.
**How**: `sorted(d.items(), key=lambda x: x[1])` or `operator.itemgetter(1)`; `reverse=True`.
**Trade-offs**: Avoids manual data reshaping.

## Dict merge
**When to use**: Config defaults + overrides.
**How**: `{**defaults, **overrides}` (3.5+, right wins); `update()` for compatibility.
**Trade-offs**: `**` form is faster and merges N dicts; `dict(a, **b)` only two.

## Pretty-print
**When to use**: Debugging/logging data structures.
**How**: `pprint.pprint(d)`, or `json.dumps(d, indent=4, sort_keys=True)` for JSON-only data.
**Trade-offs**: `json.dumps` raises on sets/functions/non-str keys; `pprint` is general.

## REPL introspection
**When to use**: Quick API lookups without leaving the interpreter.
**How**: `dir(obj)` (filter with a comprehension); `help(obj)` (`q` to exit); `dis.dis(func)` for bytecode.
**Trade-offs**: Offline and fast; not a replacement for full docs.

## Virtualenv isolation
**When to use**: Every project.
**How**: `python3 -m venv ./venv` → `source ./venv/bin/activate` → `pip install` → `deactivate`.
**Trade-offs**: Avoids version conflicts and `sudo pip`; one env per project to manage.
