---
name: claude-archive-search
description: Use when searching your own past conversations, memory, subagent runs, or tool output stored under ~/.claude/, or when recovering files lost from a prior Write tool call.
---

# Claude Archive Search

Where everything under `~/.claude/` lives, and how to grep it fast.

## Layout

```
~/.claude/
  CLAUDE.md                                  user-global instructions
  settings.json                              settings
  projects/<slug>/                           per-project archive (slug = cwd with / → -)
    <sessionId>.jsonl                        main conversation transcript (user+assistant msgs)
    <sessionId>/subagents/agent-<id>.jsonl   subagent conversation transcript
    <sessionId>/subagents/agent-<id>.meta.json  {agentType, description}
    <sessionId>/tool-results/<rnd>.txt       externalized large tool output (>~2MB)
    memory/MEMORY.md                         auto-memory index (always in context)
    memory/*.md                              auto-memory entries
  transcripts/ses_*.jsonl                    cross-project / desktop session transcripts
  sessions/<pid>.json                        pid → sessionId + cwd mapping
  session-env/<sessionId>/                   per-session env locks
  plans/*.md                                 saved plans
  agents/*.md                                agent definitions
  commands/                                  slash-command definitions
  hooks/                                     user hook scripts
  skills/<name>/SKILL.md                     user skills
  plugins/cache/<pkg>/<ver>/                 installed plugin skills + agents
```

Slug for this repo: `-Users-emmahyde-projects-sector` (prefix dash + `/`→`-`).

## Transcript JSONL format

Each line is one event. Useful fields on message events:

- `sessionId`, `cwd`, `gitBranch`, `timestamp`
- `isSidechain: true` ⇒ subagent message
- `message.content[]` — array of `{type: text|tool_use|tool_result, ...}`
- `tool_use`: `{id, name, input}` — Write keeps full `input.content` inline
- `tool_result`: `{tool_use_id, content}` — large outputs replaced by `<persisted-output>…saved to: <path>` pointing into `tool-results/`

## Find things fast

| Goal | Command |
|---|---|
| Project slug from cwd | `echo "-${PWD//\//-}"` |
| All transcripts for this project | `ls ~/.claude/projects/"$(echo "-${PWD//\//-}")"/*.jsonl` |
| Recent transcripts (10 newest) | `ls -t ~/.claude/projects/<slug>/*.jsonl \| head -10` |
| Full-text search conversation | `rg -l 'PATTERN' ~/.claude/projects/<slug>/` |
| Search memory | `rg 'PATTERN' ~/.claude/projects/<slug>/memory/` |
| Search across ALL projects | `rg 'PATTERN' ~/.claude/projects/` |
| Subagent prompts only | `rg '"isSidechain":true.*"type":"user"' ~/.claude/projects/<slug>/*/subagents/*.jsonl` |
| Subagent metadata | `cat ~/.claude/projects/<slug>/<sess>/subagents/*.meta.json` |
| Map session → cwd | `cat ~/.claude/sessions/*.json \| jq '{sessionId, cwd}'` |
| User prompts in a session | `jq -r 'select(.type=="user" and .message.role=="user") \| .message.content' < FILE.jsonl` |
| Tool calls of type X | `jq -r 'select(.message.content[]?.type=="tool_use" and .message.content[]?.name=="Write") \| .message.content[]?.input.file_path' < FILE.jsonl` |

## Structured extraction from JSONL

```bash
# All Write calls (path + size) from one transcript
jq -r '.message.content[]? | select(.type=="tool_use" and .name=="Write")
       | "\(.input.file_path)\t\(.input.content|length)"' FILE.jsonl

# All text assistant responses
jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text' FILE.jsonl

# Subagent type + task for a session
for m in ~/.claude/projects/<slug>/<sess>/subagents/*.meta.json; do
  jq -r '[.agentType, .description] | @tsv' "$m"
done
```

## Recover lost Write output

Use `recover-writes.py` in this skill dir. It extracts every `Write` tool call from transcripts and reconstructs the files (or a markdown report).

```bash
# Report every Write across all transcripts in current project (stdout markdown)
~/.claude/skills/claude-archive-search/recover-writes.py

# Filter to a path substring, write a markdown report
~/.claude/skills/claude-archive-search/recover-writes.py --path Sector.Engine/Crew -o writes.md

# Restore latest version of each written file to disk under ./recovered/
~/.claude/skills/claude-archive-search/recover-writes.py --restore --out recovered/

# Scope to one transcript or UUID session
~/.claude/skills/claude-archive-search/recover-writes.py --session 090e7f30-f644-4254-a301-b8b0d685c9ed
~/.claude/skills/claude-archive-search/recover-writes.py --transcript ~/.claude/projects/<slug>/<id>.jsonl

# Include subagent writes too
~/.claude/skills/claude-archive-search/recover-writes.py --include-subagents
```

Run `--help` for all flags. Defaults: current project slug inferred from `$PWD`, main transcripts only, markdown to stdout, latest write per path wins.

## Notes / gotchas

- `projects/<slug>/*.jsonl` and `projects/<slug>/<sess>/subagents/*.jsonl` are **separate files**; a full session ≈ main + all matching subagents.
- `transcripts/ses_*.jsonl` is a distinct tree (desktop / MCP sessions) with a different record shape — not the same as project transcripts.
- Write `input.content` is always inline in the jsonl; Edit tool stores `old_string`/`new_string` only. To reconstruct post-Edit state you'd need the pre-Edit Read plus ordered Edit replays — `recover-writes.py` does not do this.
- Large tool *results* (not Writes) get externalized to `tool-results/*.txt` with a `<persisted-output>` stub in the jsonl referencing the path — grep the text files directly for content.
- `memory/MEMORY.md` is injected into every conversation; individual `memory/*.md` files are not.
