# Routing reference

Detailed decision support for `/self-improve`. Load only when the route or scope isn't obvious from the user's prompt.

## Disambiguation question bank

Use `AskUserQuestion` with a targeted-interview discipline: ask only what changes the build, resolve dependent forks in order, and answer a fork yourself from the codebase rather than asking when you can. Keep it lightning-fast — recommended option first, every option shows a *concrete preview of the artifact it would produce*. Ask at most the two forks below.

### Fork 1 — artifact type (when friction could land in >1 home)

> "How should this stick?"

- **Rule** — *"add to CLAUDE.md: 'always X before Y'"* — changes how you behave next time.
- **Script** — *"scripts/deploy-check.sh that runs the 5 steps"* — repeatable steps, no judgment.
- **Memory fact** — *"save fact: the staging DB port is 5544"* — data you forgot, not behavior.
- **Skill** — *"a loadable skill that triggers on 'X' and does Y"* — steps + judgment, auto-discovered.
- **Hook** — *"settings.json hook: run lint on every Stop"* — must run every time, automatically.

### Fork 2 — scope (when artifact type is known)

> "How wide does this apply?"

- **This project** — project CLAUDE.md / project `scripts/` / project memory.
- **Everywhere (you/your workflow)** — global `~/.claude/CLAUDE.md` / global skill.

Skip Fork 2 when scope is self-evident (env quirk of this repo = project; a preference about how you like *all* work done = global).

## Worked examples

**"You keep grepping for the dev server port."**
→ Fact, re-discovered. Artifact: **memory file** (`dev-server-port.md`). Scope: project. One line: the port + how to start it. No grill needed.

**"Stop running the full test suite, just run the affected package."**
→ Preference correcting behavior, every time. Could be a **rule** (CLAUDE.md) or a **hook**. Ask Fork 1: if it's judgment ("usually the affected one") → rule; if mechanical ("always scope tests to changed files") → hook via `update-config`.

**"You rebuilt the FBX→GLB conversion incantation again."**
→ Deterministic steps re-derived. Artifact: **script**. But a convert-3d-asset capability already reads like a skill — check if one exists (`blender` skill does). Route: extend existing skill, don't make a new artifact. Lesson: **always search existing skills/scripts before creating** one.

**"You explained the memory file format from scratch."**
→ The format already lives in global CLAUDE.md. Friction = you didn't read it. Artifact: a **rule** ("memory format is defined in global CLAUDE.md — read it before writing memory"), or nothing if the rule already exists. Don't duplicate what's documented.

## Anti-patterns (don't create an artifact when…)

- The codebase, git history, or CLAUDE.md **already records it** — that's a "read first" failure, not a missing artifact. Fix the reading habit (a rule) at most.
- It only mattered **this once** — ephemeral context, not durable knowledge.
- The "fact" is **derivable** from code structure — let the code be the source of truth.
- You'd be writing **prose longer than the loop it prevents** — wrong artifact; pick a cheaper one.

## Delegation handoffs

- **New skill** → invoke the `write-a-skill` skill with the capability description. Don't hand-roll skill structure here.
- **Hook / permission / env var** → invoke the `update-config` skill. The harness executes hooks, not you, so behavior that must run automatically belongs there.
- **Memory fact** → write directly to the memory dir (from `scripts/targets.sh`) using the format defined in global CLAUDE.md, and add the one-line pointer to `MEMORY.md`.
