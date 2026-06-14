# Tool APIs

Each tool's surface in JSON tool-schema format. MCP tools list their real call schema; CLI tools express subcommands in the same shape with an `invocation` attribute showing the shell form. `$VAR` = substitute a value.

---

<tool name="lumen" kind="mcp" purpose="semantic search by meaning">
<function>{"name": "semantic_search", "description": "Search indexed codebase using natural language. FIRST tool for code discovery/exploration; auto-indexes if stale. Retry with lower min_score (0 or -1) and higher limit if no results.", "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "Natural language search query"}, "cwd": {"type": "string", "description": "Project root; used as index root"}, "path": {"type": "string", "description": "Absolute path to search in; subdir of cwd filters results to that subtree"}, "limit": {"type": "integer", "description": "Max results, default 8"}, "max_lines": {"type": "integer", "description": "Truncate each snippet to N lines"}, "min_score": {"type": ["null", "number"], "description": "-1..1 threshold; use -1 to return all"}, "summary": {"type": "boolean", "description": "Location-only (path/symbol/kind/line/score), no code"}}, "required": ["query"]}}</function>
<function>{"name": "health_check", "description": "Check the embedding backend (Ollama/LM Studio) is reachable; reports backend, host, model, status.", "parameters": {"type": "object", "properties": {}}}</function>
<function>{"name": "index_status", "description": "Report index freshness and file/chunk counts for the project.", "parameters": {"type": "object", "properties": {"cwd": {"type": "string", "description": "Project root"}}}}</function>
</tool>

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

<tool name="grepai" kind="cli" binary="grepai" purpose="semantic search + call-graph + live watch">
<function>{"name": "grepai search", "invocation": "grepai search \"$query\"", "description": "Semantic code search via embeddings (Ollama/LM Studio/OpenAI).", "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "Natural language query"}}, "required": ["query"]}}</function>
<function>{"name": "grepai trace", "invocation": "grepai trace $direction $symbol", "description": "Call-graph traversal. Name/AST-based, so it resolves edges import-graph tools miss (e.g. on C#).", "parameters": {"type": "object", "properties": {"direction": {"type": "string", "enum": ["callers", "callees"], "description": "Who calls it, or what it calls"}, "symbol": {"type": "string", "description": "Function/symbol name"}}, "required": ["direction", "symbol"]}}</function>
<function>{"name": "grepai init", "invocation": "grepai init", "description": "Initialize grepai in the current project (writes .grepai/config.yaml).", "parameters": {"type": "object", "properties": {}}}</function>
<function>{"name": "grepai watch", "invocation": "grepai watch", "description": "Start the real-time file-watcher daemon; keeps the index fresh. Requires an Ollama embed model.", "parameters": {"type": "object", "properties": {}}}</function>
<function>{"name": "grepai status", "invocation": "grepai status", "description": "Index status and browse indexed files.", "parameters": {"type": "object", "properties": {}}}</function>
<meta>Also exposes `grepai mcp-serve` (MCP server). Default embed model: nomic-embed-text. `trace.enabled_languages` in config gates which languages get a call graph.</meta>
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

<tool name="agentmemory" kind="mcp" purpose="cross-session memory">
<function>{"name": "memory_recall", "description": "Search past session observations for relevant context — past decisions, how a file changed before.", "parameters": {"type": "object", "properties": {"query": {"type": "string", "description": "Keywords, file names, concepts"}, "format": {"type": "string", "enum": ["full", "compact", "narrative"], "description": "Default full"}, "limit": {"type": "number", "description": "Max results, default 10"}, "token_budget": {"type": "number", "description": "Trim results to a token budget"}}, "required": ["query"]}}</function>
<function>{"name": "memory_save", "description": "Explicitly save an important insight, decision, or pattern to long-term memory.", "parameters": {"type": "object", "properties": {"content": {"type": "string", "description": "The insight or decision"}, "type": {"type": "string", "description": "pattern | preference | architecture | bug | workflow | fact"}, "project": {"type": "string", "description": "Stable canonical project id (match the value used at session start; not a filesystem path)"}, "concepts": {"type": "string", "description": "Comma-separated key concepts"}, "files": {"type": "string", "description": "Comma-separated relevant file paths"}}, "required": ["content"]}}</function>
<meta>Other tools: memory_smart_search, memory_sessions, memory_audit, memory_export, memory_governance_delete.</meta>
</tool>

---

<tool name="jcodemunch" kind="mcp" status="opt-in" purpose="runtime-trace → code (re-add: uvx jcodemunch-mcp)">
<function>{"name": "import_runtime_signal", "description": "Ingest a runtime trace into the runtime tables. otel: OTel JSON/JSON-Lines, maps spans via (file_path, line_no, function_name). sql_log: pg_stat_statements/SQL JSONL. stack_log: Python/JVM/Node tracebacks (NOT .NET — use otel for C#).", "parameters": {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute path to the trace file"}, "source": {"type": "string", "enum": ["otel", "sql_log", "stack_log"], "description": "Trace format; default otel"}, "repo": {"type": "string", "description": "owner/name; defaults to resolved repo"}, "redact_enabled": {"type": "boolean", "description": "Override PII redaction (disable only on synthetic data)"}}, "required": ["path"]}}</function>
<function>{"name": "find_hot_paths", "description": "Top-N symbols by runtime hit count with p50/p95 latency and sources. Empty until traces are ingested.", "parameters": {"type": "object", "properties": {"repo": {"type": "string"}, "query": {"type": "string", "description": "Substring filter on symbol name"}, "top_n": {"type": "integer", "description": "Default 20, max 200"}}, "required": ["repo"]}}</function>
<function>{"name": "get_runtime_coverage", "description": "Histogram of indexed symbols with vs without runtime evidence, plus unmapped spans. coverage_pct=0 until traces ingested.", "parameters": {"type": "object", "properties": {"repo": {"type": "string"}, "file_path": {"type": "string", "description": "Scope to one file"}, "unmapped_limit": {"type": "integer", "description": "Default 50"}}, "required": ["repo"]}}</function>
</tool>
