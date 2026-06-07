# Chapter 5: Common Data Structures in Python

## Core Idea
Python's "human" naming hides which abstract data type each built-in implements. Knowing the mapping — and the performance trade-offs — lets you pick the right dict, array, record, set, stack, queue, or priority queue instead of defaulting to `list` every time.

## Frameworks Introduced
- **Dict as the central structure (5.1)**: `dict` is a finely-tuned hash table with average O(1) lookup/insert/delete; keys must be hashable (immutable + `__hash__`/`__eq__`).
  - Specialized: `OrderedDict` (explicit insertion order), `defaultdict(factory)` (auto-create missing keys), `ChainMap` (search several dicts as one), `MappingProxyType` (read-only view).
- **Array choice (5.2)**: `list` (mutable dynamic array, mixed types), `tuple` (immutable), `array.array` (typed, space-efficient C types), `str` (immutable Unicode chars), `bytes`/`bytearray` (immutable/mutable byte sequences).
- **Record/struct choice (5.3)**: `dict`, `tuple`, custom class, `collections.namedtuple`, `typing.NamedTuple` (typed), `struct.Struct` (serialized C structs), `types.SimpleNamespace` (attribute-access dict).
- **Set choice (5.4)**: `set` (mutable), `frozenset` (immutable, hashable → usable as keys), `collections.Counter` (multiset/bag).
- **Stack/Queue/PQ (5.5–5.7)**: `collections.deque` is the go-to for both stacks and queues (O(1) both ends); `queue.PriorityQueue` (or `heapq`) for priority queues.

## Key Concepts
- **Hashable**: Hash value constant over lifetime; equal objects hash equal — required for dict keys and set members.
- **Amortized O(1)**: `list.append`/`pop` from the *end*; pop/insert at the *front* is O(n).
- **deque**: Doubly-linked list — O(1) at both ends, O(n) random access.
- **Counter pitfall**: `len()` = unique elements; `sum(c.values())` = total count.
- **Empty set**: `set()`, not `{}` (which is an empty dict).

## Mental Models
- Dict = phone book (jump straight to a key). Array = parking lot (indexed slots). Stack = plates (LIFO). Queue = pipe / PyCon line (FIFO). Priority queue = OS task scheduler (highest urgency first).
- Start with `list`; specialize only when performance or storage demands it.

## Anti-patterns
- **`list` as a queue**: `pop(0)`/front-insert is O(n) — use `collections.deque`.
- **`list` as a stack with wrong-end ops**: Only `append`/`pop` (the right end) stay O(1).
- **`list` as a priority queue**: Re-sorting on every insert is O(n log n); only acceptable with few insertions.
- **Relying on plain `dict` ordering pre-3.7**: Was a CPython implementation detail; use `OrderedDict` to be explicit.

## Reference Tables
| Need | Use |
|---|---|
| Mapping (default) | `dict` |
| Missing-key defaults | `collections.defaultdict` |
| Read-only mapping | `types.MappingProxyType` |
| Mixed-type sequence | `list` (mutable) / `tuple` (immutable) |
| Tight numeric array | `array.array` (or NumPy) |
| Record, lock field names | `collections.namedtuple` / `typing.NamedTuple` |
| Record + behavior | custom class |
| Binary serialization | `struct.Struct` |
| Set | `set` / `frozenset` (hashable) |
| Multiset / counting | `collections.Counter` |
| Stack or Queue | `collections.deque` |
| Priority queue | `queue.PriorityQueue` / `heapq` |
| Parallel producers/consumers | `queue.Queue` / `multiprocessing.Queue` |

## Key Takeaways
1. `dict` is central and O(1); reach for `defaultdict`/`OrderedDict`/`ChainMap`/`MappingProxyType` only for special needs.
2. Pick arrays by mutability and type: `list`/`tuple` for mixed, `array.array`/`bytes`/`bytearray` for tight packing.
3. For records, `namedtuple`/`typing.NamedTuple` are the safe default; custom classes when you need behavior.
4. `frozenset` is hashable; `Counter` is a multiset (mind `len` vs `sum`).
5. `collections.deque` is the best general stack *and* queue; `queue.PriorityQueue` for priority queues.

## Connects To
- **Ch 4**: Namedtuples vs custom classes as record types.
- **Ch 6**: Comprehensions build dicts/sets/lists; iterators underlie deque/heapq usage.
- **Ch 7**: Dictionary tricks build directly on `dict`/`defaultdict`.
