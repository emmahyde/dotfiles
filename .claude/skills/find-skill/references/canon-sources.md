# Canon Sources by Scope

Pinned indexes — surveyed first, always. URLs are stable as of 2026-04.

## plugin / skill
- https://github.com/hesreallyhim/awesome-claude-code (umbrella list)
- https://github.com/wcygan/awesome-claude-skills
- https://github.com/anthropics/claude-cookbooks
- https://github.com/obra/superpowers
- https://claudecode.directory/
- https://github.com/davila7/claude-code-templates
- https://github.com/FlorianBruniaux/claude-code-ultimate-guide (umbrella: skills/agents/hooks/commands/mcp/claude-md templates, ~3.9k★, CC-BY-SA-4.0)
  - companion site: https://cc.bruniaux.com (interactive guide + cheatsheet + quiz)
  - searchable: https://deepwiki.com/FlorianBruniaux/claude-code-ultimate-guide
  - llms-readable index: https://raw.githubusercontent.com/FlorianBruniaux/claude-code-ultimate-guide/main/llms-full.txt
- https://github.com/vercel-labs/agent-skills (Vercel-curated skills collection)
- https://github.com/PackmindHub/coding-agents-matrix (comparison matrix of coding agents)

## hook
- awesome-claude-code → "Hooks" section
- https://github.com/disler/claude-code-hooks-mastery
- GitHub topic: `claude-code-hooks`

## agent / subagent
- https://github.com/wshobson/agents
- https://github.com/VoltAgent/awesome-claude-code-subagents
- https://github.com/contains-studio/agents
- https://github.com/iannuttall/claude-agents

## mcp
- https://github.com/modelcontextprotocol/servers (official)
- https://github.com/punkpeye/awesome-mcp-servers
- https://mcp.so/
- https://smithery.ai/
- https://pulsemcp.com/
- https://github.com/wong2/awesome-mcp-servers

## proxy / token-shaping layer
- https://github.com/musistudio/claude-code-router
- https://github.com/1rgs/claude-code-proxy
- rtk (this user's tool — local)
- headroom (FastAPI proxy)
- GitHub topic: `claude-code-proxy`

## project-md / user-md
- awesome-claude-code → "CLAUDE.md examples"
- https://claudemd.directory/
- https://cursor.directory/rules (cross-pollinate cursor rules)
- https://github.com/PatrickJS/awesome-cursorrules

## Academic / official
- https://www.anthropic.com/engineering (Anthropic engineering blog)
- https://docs.claude.com/en/docs/claude-code (Claude Code docs)
- https://modelcontextprotocol.io/ (MCP spec)
- arXiv search: `agent` `tool use` `prompt engineering` filtered last 12mo

## Code search (cs.github.com replacement)
- https://grep.app — regex code search across ~1M public repos, sub-second
  - API: `GET https://grep.app/api/search?q=…&regexp=1&lang=…&path=…&repo=…`
  - wrapper: `scripts/grep-app.sh` (in this skill)
  - reference impl: https://github.com/ai-tools-all/grep_app_mcp (MCP, ★57)
  - **gotcha**: Vercel TLS-fingerprint checkpoint blocks BOTH bare curl AND
    Claude WebFetch (verified 2026-04-26). Working paths:
    1. `brew install curl-impersonate` → `curl_chrome131` (preferred for scripts)
    2. ai-tools-all/grep_app_mcp (node+axios passes checkpoint — install as MCP)
    3. claude-in-chrome MCP (real browser, heavy but always works)
- `gh search code` — official, regex via `--match`, rate-limited
- https://sourcegraph.com — heaviest query language, free tier shrinking

## Subreddits (priority order)
r/ClaudeAI, r/ClaudeCode, r/cursor, r/LocalLLaMA, r/mcp,
r/AIAgents, r/ChatGPTCoding
