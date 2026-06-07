# Chapter 7: Dictionary Tricks

## Core Idea
Dicts plus first-class functions enable concise, Pythonic patterns: default-value lookups, custom sorting, switch/case dispatch, and clean merging — plus a deep lesson on how dict keys are identified by both equality and hash.

## Frameworks Introduced
- **Default values via `get()` (7.1)**: `d.get(key, default)` returns the value or a fallback, querying the dict once.
  - When to use: Avoid `if key in d` (double lookup) and bare `d[key]` (KeyError). Prefer EAFP (`try/except KeyError`) or `get()`/`defaultdict`.
- **Sorting with key funcs (7.2)**: `sorted(d.items(), key=lambda x: x[1])` sorts by value; `operator.itemgetter(1)` is the standard-library equivalent. `reverse=True` flips order.
  - Note: A "key func" maps each item to a *comparison key* — unrelated to dict keys.
- **Dict dispatch (7.3)**: Replace long `if/elif/else` chains with `{key: func}.get(key, default)()` — leveraging first-class functions.
  - Perf note: Build the dispatch dict once as a constant, not per call; prefer `operator` over lambdas for real operators.
- **Merging dicts (7.5)**: `{**xs, **ys}` (Python 3.5+, right wins) merges any number; `dict(xs, **ys)` or chained `update()` for two / older Python.
- **Pretty-printing (7.6)**: `pprint.pprint(d)` (handles sets, reproducible order) or `json.dumps(d, indent=4, sort_keys=True)` (JSON-serializable types only).

## Key Concepts
- **EAFP**: "Easier to Ask Forgiveness than Permission" — the Pythonic try/except style over pre-checks.
- **Key identity in dicts (7.4)**: Two keys are "the same" iff they are `__eq__`-equal **and** share a `__hash__` value — neither condition alone suffices.
- **`bool` is a subclass of `int`**: `True == 1 == 1.0` and `hash(True) == hash(1) == hash(1.0) == 1`.
- **Keys aren't replaced on reassignment**: `{True: 'yes', 1: 'no', 1.0: 'maybe'}` → `{True: 'maybe'}` — value updates, original key object kept.

## Mental Models
- The `{...}.get(cond, default)()` dispatch table = a switch/case statement Python lacks.
- The "craziest dict expression" is a Zen kōan: it reveals that dict keys hinge on equality *and* hash, and that bools are ints.

## Anti-patterns
- **`if key in d: return d[key]`**: Double lookup and verbose — use `get()`.
- **Long `if/elif` chains** for value dispatch: Code smell — use a dict dispatch table.
- **Recreating the dispatch dict + lambdas on every call**: Hoist it to a module constant.
- **`json.dumps` on non-JSON types** (sets, functions, non-str keys): Raises `TypeError` — use `pprint`.

## Code Examples
```python
# Default value
def greeting(userid):
    return 'Hi %s!' % name_for_userid.get(userid, 'there')

# Dict dispatch replacing if/elif
def dispatch_dict(operator, x, y):
    return {
        'add': lambda: x + y,
        'mul': lambda: x * y,
    }.get(operator, lambda: None)()

# Merge (3.5+) and sort-by-value
zs = {**xs, **ys}                       # right-hand wins
by_value = sorted(d.items(), key=lambda x: x[1])
```
- **What it demonstrates**: `get()` fallback, function-valued dispatch table, dict merge, and a value-sorting key func.

## Key Takeaways
1. Use `d.get(key, default)` (or `defaultdict`/EAFP) instead of membership pre-checks.
2. Control sort order with a key func; `operator.itemgetter`/`attrgetter` are ready-made.
3. Collapse long `if/elif` value-dispatch into a `{key: func}.get(...)()` table.
4. Merge with `{**a, **b}` (3.5+, right wins) or `update()` for compatibility.
5. Dict keys are identified by equality **and** hash; `bool` is an `int` subclass. Pretty-print with `pprint`/`json.dumps`.

## Connects To
- **Ch 3**: First-class functions enable dispatch tables and key funcs.
- **Ch 5**: Builds on `dict`/`defaultdict` and the hash-table internals.
- **Ch 8**: `dis`/`dir`/`help` help you explore these behaviors interactively.
