---
name: skill-optimizer-evals
description: Use when authoring, running, or debugging eval suites for agent skills — Docker-isolated workbench runs, deterministic graders, OpenRouter model matrices, trace inspection. Condensed from the skill-optimizer plugin.
---

# Skill Optimizer Evals

Eval workbench for agent skills. Runs a model in an isolated Docker `/work` directory, exposes skills/references as workspace files, captures an agent trace, grades deterministic local outcomes.

## Core model

- **Case** — one user-like task plus one or more deterministic graders.
- **Suite** — a set of cases plus OpenRouter models, run as a matrix.
- `references/` are copied into `/work` before the agent starts — eval skills live here.
- Agent phase sees `/work` only. Cannot see `/case`, `/results`, graders, hidden answers, hidden metadata.
- Cases may define `mcpServers`, exposed via a workbench `mcp` command during the agent phase.
- Graders run after the agent with `/case`, `/work`, `/results` mounted.
- `trace.jsonl` is the debug source for what the agent saw, said, did.

## Commands

| Goal | Command |
|------|---------|
| Install deps | `npm install` |
| Build CLI | `npm run build` |
| Run one case | `npx tsx src/cli.ts run-case <case.yml>` |
| Run case across models | `npx tsx src/cli.ts run-case <case.yml> --models openrouter/google/gemini-2.5-flash,openrouter/openai/gpt-5.4` |
| Run a suite | `npx tsx src/cli.ts run-suite <suite.yml>` |

Rules: only `openrouter/...` model refs; `OPENROUTER_API_KEY` required for real runs; `run-suite` uses `models:` from `suite.yml` (no override flag); `run-case` uses case `model:` or `--model`/`--models`; Docker image default `skill-optimizer-workbench:local`.

## Authoring workflow

1. Create `suite.yml` with `models`, shared defaults, inline cases or case paths.
2. Put skill/reference material under `references/` — copied into `/work`.
3. Write natural user tasks. Never mention graders, hidden answers, `/case`, or eval internals.
4. Setup/grader helpers under `checks/`; fake CLIs / command shims under `bin/`.
5. Add one or more `graders` per case. Prefer small deterministic graders over one broad grader.
6. Run `run-suite --trials <n>`, inspect `suite-result.json`, failing `result.json`, `summary.json`, `trace.jsonl`.

## Key practices

- `env:` variables forward unchanged into setup, agent, grading, cleanup containers — use scoped test credentials; the agent can read them via shell tools.
- Treat `trace.jsonl`, `result.json`, grader evidence, stdout/stderr, preserved `workspace/` as potentially sensitive if secrets get printed.
- Prefer the real CLI/API/service. Mock only when sure the mock matches the real command surface, validation, outputs, and failure modes — otherwise the eval measures the mock, not the skill.
- For command skills, cover: basic command, important flags/options, a no-tool-needed control, and unsafe-instruction resistance.
- Hidden-source MCP servers: put files under case `mcp/`, define `mcpServices` — Docker runs them as separate service containers, agent sees only the HTTP MCP URL. Direct stdio `mcpServers.command` runs inside the agent container (agent-visible). The workbench generates `/work/mcporter.json` with `imports: []`, so host MCP configs are not imported. No OAuth/browser auth — use env/header credentials.

## Minimal suite

```yaml
name: pdf-skill-eval
references: ./references
models:
  - openrouter/google/gemini-2.5-flash
env:
  - OPENROUTER_API_KEY
timeoutSeconds: 600
setup:
  - node $CASE/checks/create-inputs.mjs
appendSystemPrompt: |
  Keep task outputs at the top level of /work unless the user asks otherwise.
cases:
  - name: extract-pdf-facts
    task: |
      Read statement.pdf and write answer.json with the account, quarter, approval code, and risk flags.
    graders:
      - name: answer-json
        command: node $CASE/checks/extract-pdf-facts.mjs
```

## Directory layout

```text
my-eval/
  suite.yml
  references/my-skill/SKILL.md
  checks/create-inputs.mjs
  checks/extract-pdf-facts.mjs
  bin/fake-cli
  workspace/starter-app/
```

`checks/` mounts read-only at `/case/checks` for setup/grading. `bin/` copies into `/work/bin` (agent) and `/case/bin` (setup/grading). `workspace/` copies into `/work` after `references/`.

## Grader contract

Graders are shell commands run with `$CASE` (read-only case dir at `/case`) and `$WORK` (the mutable workspace the agent used). Exit non-zero to fail the case.
