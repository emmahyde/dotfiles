# Chapter 3: Effective Functions

## Core Idea
Python functions are first-class objects. Internalizing that — they can be assigned, stored, passed, returned, and captured — unlocks closures, lambdas, decorators, and `*args`/`**kwargs`, the building blocks of clean, flexible function design.

## Frameworks Introduced
- **First-class functions (3.1)**: Functions are objects — assign to variables, store in lists/dicts, pass as args, return from functions.
  - When to use: Abstracting and passing around *behavior* (e.g. `map(func, iterable)`, key funcs, callbacks).
  - How: A name and its function object are separate concerns; `bark = yell` makes a second name to the same object.
- **Closures (3.1)**: An inner function that captures and remembers values from its enclosing lexical scope after that scope exits.
  - When to use: Factory/configuration patterns — `make_adder(n)` returns a pre-configured `add`.
- **Decorators (3.3)**: A callable that takes a callable and returns another callable, modifying behavior via a wrapper closure without permanently changing the original.
  - When to use: Cross-cutting concerns — logging, timing, access control, rate-limiting, caching.
  - How: `@decorator` is sugar for `func = decorator(func)`. Stacked decorators apply **bottom to top**.
- **`*args` / `**kwargs` (3.4)**: Collect variable positional args as a tuple (`*args`) and keyword args as a dict (`**kwargs`).
- **Argument unpacking (3.5)**: `*` explodes an iterable into positional args; `**` explodes a dict into keyword args at the *call site*.

## Key Concepts
- **Higher-order function**: A function that takes other functions as arguments (e.g. `map`, `filter`, `sorted` with `key=`).
- **`__call__`**: Dunder that makes an instance callable; `callable(obj)` checks for it.
- **Lambda**: A single-expression anonymous function with an implicit return; no statements allowed.
- **`functools.wraps`**: Decorator that copies `__name__`, `__doc__`, etc. from the wrapped function to the wrapper.
- **Implicit return None (3.6)**: Any function without an explicit return yields `None`.

## Mental Models
- A decorator *replaces* one function with another (the wrapper closure) — that's why metadata is lost without `functools.wraps`.
- Use a lambda only as a throwaway key func; if it gets complex, name a real function or use a comprehension.
- For procedures (called only for side effects, like `print`), omit `return`; for value-returning functions, decide explicitly.

## Anti-patterns
- **Lambdas for class methods or complex `map`/`filter`**: `rev = lambda self: ...` and `filter(lambda x: x%2==0, ...)` are harmful — prefer named functions or comprehensions.
- **Writing decorators without `functools.wraps`**: Hides the original `__name__`/`__doc__`, breaking introspection and debugging.
- **`*args`/`**kwargs` passthrough constructors**: Convenient for wrapping external classes, but produce unhelpful signatures — use sparingly, balance against DRY.

## Code Examples
```python
# Decorator that handles arguments + preserves metadata
import functools
def trace(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f'TRACE: {func.__name__}({args}, {kwargs})')
        result = func(*args, **kwargs)
        print(f'TRACE: -> {result!r}')
        return result
    return wrapper

# Closure factory
def make_adder(n):
    def add(x): return x + n
    return add
plus_3 = make_adder(3)   # plus_3(4) == 7
```
- **What it demonstrates**: A robust decorator forwarding args via `*args/**kwargs` with `functools.wraps`, and a closure capturing `n`.

## Reference Tables
| Operator | In definition | At call site |
|---|---|---|
| `*args` | Collect extra positional → tuple | Unpack iterable → positional args |
| `**kwargs` | Collect extra keyword → dict | Unpack dict → keyword args |

## Key Takeaways
1. Functions are objects; pass and return them to abstract behavior.
2. Closures capture enclosing-scope values — the basis of factories and decorators.
3. A decorator is `callable -> callable`; `@` is sugar; stacking applies bottom-to-top; always use `functools.wraps`.
4. `*args`/`**kwargs` collect; `*`/`**` at a call unpack. The names are convention; the syntax is the stars.
5. Use lambdas sparingly — readability beats terse wizardry.

## Connects To
- **Ch 2**: `@contextlib.contextmanager` is a decorator over a generator.
- **Ch 6**: Argument unpacking works on generator expressions; comprehensions replace lambda-heavy `map`/`filter`.
