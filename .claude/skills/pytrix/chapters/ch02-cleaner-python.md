# Chapter 2: Patterns for Cleaner Python

## Core Idea
Small, deliberate coding patterns — assertions, comma placement, context managers, naming conventions, string formatting — compound into Python code that is more readable, maintainable, and harder to break.

## Frameworks Introduced
- **Assertions as internal self-checks (2.1)**: Use `assert cond, msg` to declare conditions you believe are *impossible* — bugs, not expected runtime errors.
  - When to use: Catching programmer errors / "this should never happen" invariants during development.
  - How: `assert 0 <= price <= product['price']`. Never for data validation — asserts compile away under `-O`/`-OO`/`PYTHONOPTIMIZE`.
- **Trailing comma style (2.2)**: End every element line in multi-line list/dict/set literals with a comma, including the last.
  - When to use: Any multi-line collection literal.
  - How: Keeps Git diffs to a single added/removed line and avoids accidental string-literal concatenation bugs.
- **Context manager protocol (2.3)**: Implement `__enter__`/`__exit__` (or `@contextlib.contextmanager` on a generator) to support `with`.
  - When to use: Any acquire/release resource pattern (files, locks, indentation levels, timers).
  - How: `with open(...) as f:` desugars to `try/finally` with guaranteed cleanup.
- **Dan's String Formatting Rule of Thumb (2.5)**: If format strings are user-supplied → Template Strings (safe). Else → f-strings (Python 3.6+), or `str.format()` if older.

## Key Concepts
- **`__debug__`**: Built-in flag, true normally, false when optimizations requested; asserts are gated behind it.
- **String literal concatenation**: Adjacent string literals merge (`'a' 'b'` → `'ab'`) — a feature, but a missing comma in a list silently merges items.
- **Name mangling**: A `__name` (double leading underscore) attribute in a class is rewritten to `_ClassName__name` by the interpreter to avoid subclass collisions.
- **Dunder**: "Double underscore" — `__init__` is "dunder init."

## Mental Models
- Think of `_var` as a *politeness sign* ("internal use") — convention only, not enforced (except wildcard imports).
- Think of `__var` as the interpreter *actually renaming* the attribute — enforced.
- Use `_` as the "don't care" variable in loops/unpacking; in the REPL it also holds the last result.

## Anti-patterns
- **Asserts for data validation / auth checks**: Disabled in optimized mode → security holes (`assert user.is_admin()` silently passes). Use `if ...: raise`.
- **Tuple-in-assert**: `assert (cond, 'msg')` is always truthy and never fails. Drop the parens.
- **Naming your own attributes `__var__`**: Reserved for the language; risks future collisions.
- **Wildcard imports** (`from m import *`): Obscure the namespace; also silently skip `_`-prefixed names.

## Code Examples
```python
# Class-based context manager
class ManagedFile:
    def __init__(self, name): self.name = name
    def __enter__(self):
        self.file = open(self.name, 'w'); return self.file
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.file: self.file.close()

# Generator-based equivalent
from contextlib import contextmanager
@contextmanager
def managed_file(name):
    try:
        f = open(name, 'w'); yield f
    finally:
        f.close()
```
- **What it demonstrates**: Two equivalent ways to support the `with` statement.

## Reference Tables
| Underscore pattern | Meaning | Enforced? |
|---|---|---|
| `_var` | Internal-use hint | No (except `import *`) |
| `var_` | Avoid keyword clash (`class_`) | No |
| `__var` | Name mangling → `_Cls__var` | Yes |
| `__var__` | Language-reserved dunder | Yes (don't define your own) |
| `_` | Throwaway / last REPL result | No |

| Formatting | Syntax | Use when |
|---|---|---|
| Old style | `'%s' % name` | Legacy; still supported |
| New style | `'{name}'.format(...)` | Pre-3.6 default |
| f-string | `f'{name}'` | Python 3.6+ default |
| Template | `Template('$name').substitute(...)` | User-supplied strings (safe) |

## Key Takeaways
1. Asserts catch bugs, never validate data or guard security — they can be globally disabled.
2. Always trail commas in multi-line literals for clean diffs and to dodge string-concat bugs.
3. `with` + context managers guarantee resource cleanup via `try/finally`; implement `__enter__`/`__exit__` or use `@contextmanager`.
4. `_var` is convention; `__var` triggers real name mangling; `__var__` is reserved.
5. Prefer f-strings; reach for Template Strings whenever a format string comes from a user.

## Connects To
- **Ch 3**: `@contextmanager` relies on decorators and generators.
- **Ch 4**: Dunder methods (`__repr__`, `__eq__`) are the basis of well-behaved classes.
- **PEP 8**: Source of the underscore and import conventions.
