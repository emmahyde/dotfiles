# Tool APIs

Each tool's surface in JSON tool-schema format. MCP tools list their real call schema; CLI tools express subcommands in the same shape with an `invocation` attribute showing the shell form. `$VAR` = substitute a value.

---

<tool name="sem" kind="cli" binary="sem" purpose="entity-level impact / diff / blame / history / context">
<function>{"name": "sem impact", "invocation": "sem impact $entity [flags]", "description": "What breaks if an entity changes: direct + transitive dependents and affected tests. Resolves by qualified id (module::class::method); ambiguous bare names error and list candidates.", "parameters": {"type": "object", "properties": {"entity": {"type": "string", "description": "Entity name or full module::class::method id"}, "--deps": {"type": "boolean", "description": "Direct dependencies only"}, "--dependents": {"type": "boolean", "description": "Direct dependents only"}, "--tests": {"type": "boolean", "description": "Show affected tests"}, "--file": {"type": "string", "description": "Disambiguate by file path"}, "--entity-id": {"type": "string", "description": "Disambiguate by exact entity id"}, "--json": {"type": "boolean", "description": "JSON output"}}, "required": ["entity"]}}</function>
<function>{"name": "sem diff", "invocation": "sem diff [flags]", "description": "Entity-level semantic diff of working changes (rename detection, structural hashing, word-level inline highlights).", "parameters": {"type": "object", "properties": {"--json": {"type": "boolean"}}}}</function>
<function>{"name": "sem blame", "invocation": "sem blame $entity", "description": "Who last modified each function/class/method (entity-level, not line-level).", "parameters": {"type": "object", "properties": {"entity": {"type": "string"}}, "required": ["entity"]}}</function>
<function>{"name": "sem log", "invocation": "sem log $entity", "description": "How a single entity evolved through git history.", "parameters": {"type": "object", "properties": {"entity": {"type": "string"}}, "required": ["entity"]}}</function>
<function>{"name": "sem context", "invocation": "sem context $entity [--tokens N]", "description": "Token-budgeted LLM context: the entity plus its dependencies and dependents, fitted to a strict budget.", "parameters": {"type": "object", "properties": {"entity": {"type": "string"}, "--tokens": {"type": "integer", "description": "Max content tokens"}}, "required": ["entity"]}}</function>
<meta>Also exposed as MCP server `sem-mcp` (tools: sem_entities, sem_diff, sem_blame, sem_impact, sem_log, sem_context). Set SEM_NO_TELEMETRY=1 to disable anonymous command-name telemetry.</meta>
</tool>

---

<tool name="ast-grep" kind="cli" binary="ast-grep" purpose="structural AST search / lint / rewrite">
<function>{"name": "ast-grep run", "invocation": "ast-grep run --lang $lang --pattern '$pattern' [--rewrite '$repl'] $paths", "description": "Match (and optionally rewrite) code by AST shape. Pattern must be a COMPLETE AST node — a bare clause like 'catch { }' fails; use 'try { $$$ } catch ($_) { }'. Metavars: $X (one node), $$$ (many). Invoke as ast-grep, NOT sg.", "parameters": {"type": "object", "properties": {"--lang": {"type": "string", "description": "Language id, e.g. csharp, ruby, typescript, python, rust, go"}, "--pattern": {"type": "string", "description": "AST pattern with $X / $$$ metavariables (alias: -p)"}, "--rewrite": {"type": "string", "description": "Replacement template; turns search into codemod (alias: -r)"}, "paths": {"type": "array", "items": {"type": "string"}, "description": "Files/dirs to scan; default cwd"}, "--json": {"type": "boolean", "description": "JSON output"}}, "required": ["--lang", "--pattern"]}}</function>
<function>{"name": "ast-grep scan", "invocation": "ast-grep scan --rule $rule.yml $paths", "description": "Run YAML rule files (relational/composite constraints beyond a single pattern). Use when one pattern can't express the match.", "parameters": {"type": "object", "properties": {"--rule": {"type": "string", "description": "Path to a YAML rule file"}, "paths": {"type": "array", "items": {"type": "string"}}}, "required": ["--rule"]}}</function>
</tool>

---

<tool name="lizard" kind="cli" binary="lizard" purpose="cyclomatic complexity metrics">
<function>{"name": "lizard", "invocation": "lizard [flags] $paths", "description": "Per-function cyclomatic complexity (CCN), NLOC, token count, parameter count. Stateless, multi-language incl. C#/Ruby. Run via `uvx lizard` if not installed.", "parameters": {"type": "object", "properties": {"paths": {"type": "array", "items": {"type": "string"}, "description": "Files/dirs to analyze; default cwd"}, "-w": {"type": "boolean", "description": "Warnings only — functions exceeding thresholds"}, "-C": {"type": "integer", "description": "CCN threshold (default 15)"}, "-L": {"type": "integer", "description": "Function-length threshold"}, "-a": {"type": "integer", "description": "Parameter-count threshold"}, "-s": {"type": "string", "description": "Sort field, e.g. cyclomatic_complexity, nloc, token_count"}, "-l": {"type": "string", "description": "Restrict to a language"}}}}</function>
</tool>

---

<tool name="ctx7" kind="cli" binary="ctx7" purpose="up-to-date external library/package documentation">
<function>{"name": "ctx7 library", "invocation": "ctx7 library $name [query]", "description": "Resolve a library/package name to a Context7 library id. First step before fetching docs.", "parameters": {"type": "object", "properties": {"name": {"type": "string", "description": "Library/package name, e.g. react, next.js, fastapi"}, "query": {"type": "string", "description": "Optional topic to bias resolution"}}, "required": ["name"]}}</function>
<function>{"name": "ctx7 docs", "invocation": "ctx7 docs $libraryId \"$query\"", "description": "Fetch current documentation for a resolved library id, scoped to a query. Use to verify an external API's real behavior before relying on it — never assume from memory.", "parameters": {"type": "object", "properties": {"libraryId": {"type": "string", "description": "Context7 library id from `ctx7 library`"}, "query": {"type": "string", "description": "What to look up, e.g. \"useEffect cleanup\""}}, "required": ["libraryId", "query"]}}</function>
<meta>Other commands: login, whoami, setup (--mcp/--cli), upgrade. Installable as an MCP via `ctx7 setup --mcp`.</meta>
</tool>

---

<tool name="jcodemunch" kind="mcp" status="opt-in" purpose="runtime-trace → code (re-add: uvx jcodemunch-mcp)">
<function>{"name": "import_runtime_signal", "description": "Ingest a runtime trace into the runtime tables. otel: OTel JSON/JSON-Lines, maps spans via (file_path, line_no, function_name). sql_log: pg_stat_statements/SQL JSONL. stack_log: Python/JVM/Node tracebacks (NOT .NET — use otel for C#).", "parameters": {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute path to the trace file"}, "source": {"type": "string", "enum": ["otel", "sql_log", "stack_log"], "description": "Trace format; default otel"}, "repo": {"type": "string", "description": "owner/name; defaults to resolved repo"}, "redact_enabled": {"type": "boolean", "description": "Override PII redaction (disable only on synthetic data)"}}, "required": ["path"]}}</function>
<function>{"name": "find_hot_paths", "description": "Top-N symbols by runtime hit count with p50/p95 latency and sources. Empty until traces are ingested.", "parameters": {"type": "object", "properties": {"repo": {"type": "string"}, "query": {"type": "string", "description": "Substring filter on symbol name"}, "top_n": {"type": "integer", "description": "Default 20, max 200"}}, "required": ["repo"]}}</function>
<function>{"name": "get_runtime_coverage", "description": "Histogram of indexed symbols with vs without runtime evidence, plus unmapped spans. coverage_pct=0 until traces ingested.", "parameters": {"type": "object", "properties": {"repo": {"type": "string"}, "file_path": {"type": "string", "description": "Scope to one file"}, "unmapped_limit": {"type": "integer", "description": "Default 50"}}, "required": ["repo"]}}</function>
</tool>
