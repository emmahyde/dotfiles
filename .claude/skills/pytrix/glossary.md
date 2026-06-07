# Glossary — Python Tricks

**`*args`** — Function parameter collecting extra positional arguments into a tuple (Ch 3).
**`**kwargs`** — Function parameter collecting extra keyword arguments into a dict (Ch 3).
**Abstract Base Class (ABC)** — Class via `abc.ABCMeta` + `@abstractmethod` forcing subclasses to implement methods; error at instantiation (Ch 4).
**Amortized O(1)** — Average constant time despite occasional resizes, e.g. `list.append` (Ch 5).
**Argument unpacking** — `*`/`**` at a call site explode an iterable/dict into args (Ch 3).
**`array.array`** — Typed, space-efficient array of C-style values (Ch 5).
**Assertion** — `assert cond, msg`; internal self-check for impossible conditions; disabled under `-O` (Ch 2).
**`bool` is `int` subclass** — `True == 1 == 1.0`; same hash (Ch 7).
**`bytearray` / `bytes`** — Mutable / immutable sequences of 0–255 ints (Ch 5).
**Callable** — Any object usable with `()`; powered by `__call__`; tested with `callable()` (Ch 3).
**`ChainMap`** — Searches multiple dicts as one mapping (Ch 5).
**Class method** — `@classmethod`; takes `cls`; can modify class state; used for alternative constructors (Ch 4).
**Class variable** — Attribute shared by all instances; declared in class body (Ch 4).
**Closure** — Inner function remembering values from its enclosing scope (Ch 3).
**Comprehension** — `[expr for item in coll if cond]`; also set/dict forms (Ch 6).
**Context manager** — Object with `__enter__`/`__exit__` supporting `with` (Ch 2).
**`collections.Counter`** — Multiset/bag counting occurrences (Ch 5).
**Deep copy** — `copy.deepcopy`; recursively clones child objects (Ch 4).
**`collections.defaultdict`** — Dict auto-creating missing keys via a factory (Ch 5, 7).
**`collections.deque`** — Doubly-linked list; O(1) both ends; best stack/queue (Ch 5).
**Decorator** — Callable taking and returning a callable to modify behavior; `@` syntax (Ch 3).
**Decorator stacking** — Multiple decorators applied bottom-to-top (Ch 3).
**`dir()`** — Lists an object's attributes (Ch 8).
**`dis`** — Bytecode disassembler module (Ch 8).
**Dispatch table** — `{key: func}.get(key, default)()` emulating switch/case (Ch 7).
**Dunder** — "Double underscore" method like `__init__`, `__repr__` (Ch 2, 4).
**EAFP** — "Easier to Ask Forgiveness than Permission"; try/except over pre-checks (Ch 4, 7).
**`enumerate()`** — Yields `(index, item)` pairs in a loop (Ch 6).
**f-string** — `f'{expr}'`; literal string interpolation, Python 3.6+ (Ch 2).
**First-class function** — Function usable as a value (assigned, passed, returned) (Ch 3).
**`frozenset`** — Immutable, hashable set; usable as a key (Ch 5).
**`functools.wraps`** — Copies metadata from wrapped fn to a decorator's wrapper (Ch 3).
**Generator** — Function using `yield`; lazy iterator with retained state (Ch 6).
**Generator expression** — `(expr for item in coll)`; lazy, single-use iterator (Ch 6).
**`get()`** — `d.get(key, default)`; lookup with fallback (Ch 7).
**Hashable** — Object with stable hash and equality; required for dict/set keys (Ch 5, 7).
**`heapq`** — List-based binary min-heap for priority queues (Ch 5).
**Higher-order function** — Takes other functions as arguments (Ch 3).
**Implicit `return None`** — Functions without explicit return yield `None` (Ch 3).
**Instance variable** — Per-object attribute, set in `__init__` (Ch 4).
**`is` vs `==`** — Identity (same object) vs equality (same contents) (Ch 4).
**Iterator protocol** — `__iter__` + `__next__` + `StopIteration` (Ch 6).
**Key func** — Function mapping each item to a comparison key for `sorted()` (Ch 7).
**Lambda** — Single-expression anonymous function with implicit return (Ch 3).
**`MappingProxyType`** — Read-only view of a dict (Ch 5).
**Name mangling** — `__var` in a class rewritten to `_Class__var` (Ch 2).
**Namedtuple** — `collections.namedtuple`; immutable class shortcut with named fields (Ch 4, 5).
**`typing.NamedTuple`** — Typed namedtuple, Python 3.6+ (Ch 5).
**`operator` module** — Ready-made key funcs (`itemgetter`, `attrgetter`) and operators (Ch 7).
**`OrderedDict`** — Dict explicitly preserving insertion order (Ch 5).
**`pprint`** — Pretty-printer handling sets and reproducible order (Ch 7).
**Priority queue** — Retrieves highest-priority element; `queue.PriorityQueue`/`heapq` (Ch 5).
**`__repr__` / `__str__`** — Unambiguous (dev) / readable (user) string conversion (Ch 4).
**Shallow copy** — `list(x)`/`copy.copy`; one level deep, shares children (Ch 4).
**Slicing / sushi operator** — `lst[start:stop:step]`; also reverse/clear/copy (Ch 6).
**Static method** — `@staticmethod`; no `self`/`cls`; namespaced function (Ch 4).
**`StopIteration`** — Exception signaling iterator exhaustion (Ch 6).
**`struct.Struct`** — Serializes Python values to/from C structs (Ch 5).
**`SimpleNamespace`** — Attribute-access dict with nice repr (Ch 5).
**Trailing comma** — Comma after the last multi-line literal element for clean diffs (Ch 2).
**Underscore `_`** — Throwaway variable; last REPL result (Ch 2).
**Virtualenv** — Isolated per-project Python environment (`python3 -m venv`) (Ch 8).
**`with` statement** — Runs a context manager's acquire/release (Ch 2).
**`yield`** — Suspends a generator, retaining state, passing back a value (Ch 6).
**Zen of Python** — `import this`; Tim Peters' guiding aphorisms (Ch 2).
