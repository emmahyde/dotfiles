<codebase-investigation-available>
This machine has a code-intelligence stack (sem · ast-grep · lizard) that beats grep/Read for understanding and navigating code. When a task matches a trigger below, invoke the **`codebase-investigation`** skill BEFORE reaching for Grep/Glob/Read:

- "What breaks if I change Z?" / "Who calls this?" → impact analysis (sem), not grep
- "Find every place shaped like P" (e.g. all empty catch blocks, all `new Foo()`) → structural search (ast-grep), not grep
- "Which functions are too complex / risky to touch?" → complexity metrics (lizard), not eyeballing
- "Does external library/API X actually behave this way?" → verify with `ctx7` + package source, never assume

Rule of thumb: if you already know the exact literal string, `rg` is fine. If you're *discovering*, *understanding*, or *tracing relationships*, use the skill.
</codebase-investigation-available>
