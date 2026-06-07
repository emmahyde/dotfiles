# Cheatsheet — Python Tricks

## String formatting (Dan's Rule of Thumb)
| Situation | Use |
|---|---|
| User-supplied format string | `Template('$x').substitute(...)` (safe) |
| Python 3.6+ | f-string `f'{x}'` |
| Older Python | `'{x}'.format(...)` |

## Underscore conventions
| Pattern | Meaning | Enforced |
|---|---|---|
| `_var` | internal hint | no (except `import *`) |
| `var_` | avoid keyword clash | no |
| `__var` | name mangling | yes |
| `__var__` | reserved dunder | yes (don't define) |
| `_` | throwaway / last REPL result | no |

## `is` vs `==`
- `==` → equality (contents). `is` → identity (same object). Use `is` only for `None`/singletons.

## Method types
| Type | First arg | Instance? | Class? |
|---|---|---|---|
| instance | `self` | yes | yes |
| `@classmethod` | `cls` | no | yes |
| `@staticmethod` | none | no | no |

## Copy
- Shallow: `list(x)`, `copy.copy(x)` (shares children). Deep: `copy.deepcopy(x)`.

## Data structure picker
| Need | Use |
|---|---|
| mapping | `dict` → `defaultdict` / `OrderedDict` / `ChainMap` / `MappingProxyType` |
| sequence | `list` / `tuple`; tight: `array.array`, `bytes`, `bytearray` |
| record | `namedtuple` / `typing.NamedTuple`; behavior → custom class |
| set | `set` / `frozenset`; counting → `Counter` |
| stack / queue | `collections.deque` |
| priority queue | `queue.PriorityQueue` / `heapq` |
| parallel | `queue.Queue` / `multiprocessing.Queue` |

## Looping
- Direct: `for x in xs`. Index: `enumerate(xs)`. K/V: `d.items()`. Stepped: `range(a, n, s)`.
- Avoid `for i in range(len(xs))`.

## Slicing (sushi operator) `lst[start:stop:step]`
- `lst[::-1]` reverse · `lst[::2]` every other · `del lst[:]` clear in place · `lst[:] = [...]` replace in place · `lst[:]` shallow copy. Stop is exclusive.

## Iterators / generators
- Protocol: `__iter__` + `__next__` + raise `StopIteration`.
- Generator: `def g(): yield v`. Genexpr: `(expr for x in xs if cond)` (single-use).
- Pipeline: `negated(squared(integers()))`.

## Decorators
- `@deco` == `f = deco(f)`. Stack applies **bottom-to-top**. Always `@functools.wraps(func)`.

## `*` / `**`
| | In def | At call |
|---|---|---|
| `*` | collect positional → tuple | unpack iterable |
| `**` | collect keyword → dict | unpack dict |

## Dict tricks
- Default: `d.get(k, default)`. Merge: `{**a, **b}` (right wins, 3.5+).
- Switch/case: `{k: fn}.get(k, default)()` (define dict once).
- Sort by value: `sorted(d.items(), key=lambda x: x[1])`.
- `True == 1 == 1.0` and hash equal → collapse to one key.
- Pretty: `pprint.pprint(d)` / `json.dumps(d, indent=4, sort_keys=True)`.

## REPL & env
- `dir(obj)` · `help(obj)` (`q` to quit) · `dis.dis(func)`.
- Venv: `python3 -m venv ./venv` → `source ./venv/bin/activate` → `pip install` → `deactivate`.

## Don't
- Asserts for validation/auth · tuple in assert · lambdas for methods/complex map · `list` as queue/PQ · catch-all `except` · modify class var via `self.x` · `json.dumps` on sets/functions.
