# Chapter 4: Classes & OOP

## Core Idea
Idiomatic Python OOP rests on understanding identity vs equality, string-conversion dunders, custom exceptions, copy semantics, abstract base classes, namedtuples, the class/instance variable distinction, and the three method types — each a tool for communicating intent clearly.

## Frameworks Introduced
- **`is` vs `==` (4.1)**: `is` compares *identity* (same object); `==` compares *equality* (same contents).
  - When to use: `==` for value checks; `is` only for `None`/singletons or deliberate identity checks.
- **`__repr__` / `__str__` (4.2)**: `__str__` → readable (for users); `__repr__` → unambiguous (for developers, ideally re-creatable).
  - How: Always implement `__repr__`; `__str__` falls back to it. Use `f'{self.__class__.__name__}(...)'` and the `!r` flag.
- **Custom exception hierarchies (4.3)**: Derive from `Exception` or a specific built-in; give a module a base error class and derive concrete errors from it.
  - When to use: Self-documenting errors; lets callers catch a whole family with one `except`.
- **Shallow vs deep copy (4.4)**: Shallow (`list(x)`, `copy.copy`) copies one level; deep (`copy.deepcopy`) recurses the whole object tree.
- **Abstract Base Classes (4.5)**: `abc.ABCMeta` + `@abstractmethod` force subclasses to implement methods — error raised at *instantiation*, not first call.
- **Namedtuples (4.6)**: `collections.namedtuple` — memory-efficient, immutable class shortcut with named fields.
- **Class methods as factories (4.8)**: `@classmethod` using `cls(...)` gives alternative constructors (Python allows only one `__init__`).

## Key Concepts
- **Class variable**: Declared in class body, shared by all instances; modifying affects all.
- **Instance variable**: Set per object (usually in `__init__`); independent across instances.
- **Variable shadowing**: Assigning `self.x` where `x` is a class variable silently creates an instance variable that hides it — a classic bug.
- **`@classmethod` / `@staticmethod`**: `cls` = the class (can modify class state); static = no `self`/`cls`, just namespaced functions.
- **Namedtuple helpers**: `_asdict()`, `_replace()`, `_make()`, `_fields` — single underscore but **public** API.

## Mental Models
- Twin cats: identical-looking but two beings → `==` True, `is` False.
- A `__repr__` you could copy-paste back into Python to recreate the object is the gold standard.
- Static methods signal "this doesn't touch class or instance state" — and Python enforces it, aiding testing.

## Anti-patterns
- **Modifying a class variable via an instance** (`self.num_instances += 1`): Creates a shadowing instance variable; the shared counter never updates. Use `self.__class__.num_instances += 1`.
- **Raising bare generic `ValueError`**: Forces teammates to read your code; define `NameTooShortError(ValueError)` instead.
- **Catch-all `except`**: Silently swallows unrelated errors; catch a custom base class instead.
- **`NotImplementedError`-only base classes**: Error only fires when the missing method is *called*; ABCs catch it at instantiation.

## Code Examples
```python
# Robust __repr__
def __repr__(self):
    return f'{self.__class__.__name__}({self.color!r}, {self.mileage!r})'

# ABC enforcing interface at instantiation
from abc import ABCMeta, abstractmethod
class Base(metaclass=ABCMeta):
    @abstractmethod
    def foo(self): pass

# classmethod factory
class Pizza:
    def __init__(self, ingredients): self.ingredients = ingredients
    @classmethod
    def margherita(cls): return cls(['mozzarella', 'tomatoes'])
```
- **What it demonstrates**: DRY `__repr__`, instantiation-time interface enforcement, and an alternative constructor.

## Reference Tables
| Method type | First arg | Can access instance? | Can access class? |
|---|---|---|---|
| Instance method | `self` | Yes | Yes (via `self.__class__`) |
| `@classmethod` | `cls` | No | Yes |
| `@staticmethod` | none | No | No |

| Copy | Call | Depth |
|---|---|---|
| Shallow | `list(x)`, `copy.copy(x)` | One level (shares children) |
| Deep | `copy.deepcopy(x)` | Recursive (fully independent) |

## Key Takeaways
1. `is` = identity, `==` = equality — never confuse them.
2. Always add `__repr__` (unambiguous); add `__str__` (readable) when useful.
3. Define custom exceptions in a hierarchy with a module base class.
4. Shallow copies share child objects; use `copy.deepcopy` for full independence.
5. ABCs catch missing methods at instantiation; namedtuples are immutable class shortcuts; class/static methods enforce and communicate intent.

## Connects To
- **Ch 2**: Dunders and name-mangling (`_Class__var`) underpin these conventions.
- **Ch 3**: `@classmethod`/`@staticmethod` are decorators; factories rely on first-class `cls`.
- **Ch 5**: Namedtuples are one of several record/struct options.
