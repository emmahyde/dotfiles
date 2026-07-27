#!/usr/bin/env node
// Render a Claude Code session transcript (.jsonl) into annotatable markdown
// for `plannotator annotate`. Each conversational turn gets a stable anchor
// (turn number + record uuid) so annotations map back to exact turns (Law 31).
//
// Usage:
//   render-transcript.mjs [target] [--out <file>] [--thinking] [--max-chars N]
//
//   target: a .jsonl path, a session id (searched across ~/.claude/projects),
//           or omitted = latest session for the current working directory.
//
// Output: markdown path printed on stdout (last line).

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
const opt = { out: null, thinking: false, maxChars: 300 }
const positional = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') opt.out = args[++i]
  else if (args[i] === '--thinking') opt.thinking = true
  else if (args[i] === '--max-chars') opt.maxChars = Number(args[++i])
  else positional.push(args[i])
}

const projectsDir = join(homedir(), '.claude', 'projects')

function latestJsonl(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f: join(dir, f), m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  return files[0]?.f ?? null
}

function resolveTranscript(target) {
  if (target != null && target.endsWith('.jsonl')) return resolve(target)
  if (target != null) {
    // treat as session id (prefix ok): search every project dir
    for (const proj of readdirSync(projectsDir)) {
      const dir = join(projectsDir, proj)
      if (!statSync(dir).isDirectory()) continue
      for (const f of readdirSync(dir)) {
        if (f.endsWith('.jsonl') && f.startsWith(target)) return join(dir, f)
      }
    }
    throw new Error(`no transcript found for session "${target}"`)
  }
  const slug = process.cwd().replaceAll('/', '-').replaceAll('.', '-').replaceAll('_', '-')
  const dir = join(projectsDir, slug)
  if (existsSync(dir)) {
    const f = latestJsonl(dir)
    if (f != null) return f
  }
  throw new Error(`no transcript for cwd slug "${slug}" — pass a session id or .jsonl path`)
}

const clip = (s, n = opt.maxChars) => {
  s = String(s).replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}

function toolSummary(block) {
  const inp = block.input ?? {}
  const hint =
    inp.file_path ?? inp.path ?? inp.command ?? inp.pattern ?? inp.query ?? inp.url ??
    inp.prompt ?? inp.description ?? inp.skill ?? ''
  return `- 🔧 \`${block.name}\` ${hint !== '' ? '— ' + clip(hint, 160) : ''}`
}

const transcript = resolveTranscript(positional[0] ?? null)
const lines = readFileSync(transcript, 'utf8').split('\n').filter((l) => l !== '')

const turns = []
let sessionId = null
for (const line of lines) {
  let rec
  try { rec = JSON.parse(line) } catch { continue }
  sessionId ??= rec.sessionId ?? null
  if (rec.isSidechain === true) continue
  if (rec.type !== 'user' && rec.type !== 'assistant') continue
  const msg = rec.message
  if (msg == null) continue
  const content = typeof msg.content === 'string'
    ? [{ type: 'text', text: msg.content }]
    : (msg.content ?? [])

  const parts = []
  for (const block of content) {
    if (block.type === 'text' && block.text?.trim() !== '' && block.text != null) {
      // strip harness-injected reminders; they aren't conversation
      const text = block.text
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
        .replace(/<command-(name|message|args)>[\s\S]*?<\/command-\1>/g, '')
        .trim()
      if (text !== '') parts.push({ kind: 'text', text })
    } else if (block.type === 'tool_use') {
      parts.push({ kind: 'tool', text: toolSummary(block) })
    } else if (block.type === 'thinking' && opt.thinking && block.thinking?.trim() !== '') {
      parts.push({ kind: 'thinking', text: block.thinking })
    }
    // tool_result blocks (user-role plumbing) are intentionally omitted
  }
  if (parts.length === 0) continue

  const prev = turns[turns.length - 1]
  const ts = rec.timestamp ?? null
  if (prev != null && prev.role === rec.type) {
    prev.parts.push(...parts) // merge consecutive same-role records into one turn
  } else {
    turns.push({ role: rec.type, uuid: rec.uuid ?? '', ts, parts })
  }
}

if (turns.length === 0) throw new Error(`no conversational turns found in ${transcript}`)

const fmtTime = (ts) => (ts == null ? '' : new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + ' UTC')

let md = `# Agent conversation — session ${sessionId ?? '?'}\n\n`
md += `> Source: \`${transcript}\`\n> Rendered: for annotation via plannotator. `
md += `Annotate any turn below; each heading \`T<n>\` is a stable anchor.\n\n---\n\n`

turns.forEach((t, i) => {
  const n = i + 1
  const who = t.role === 'user' ? '🧑 user' : '🤖 assistant'
  md += `## T${n} · ${who} · ${fmtTime(t.ts)}\n\n<!-- anchor turn:${n} uuid:${t.uuid} -->\n\n`
  for (const p of t.parts) {
    if (p.kind === 'tool') md += p.text + '\n'
    else if (p.kind === 'thinking') md += `> _thinking:_ ${clip(p.text, 500)}\n\n`
    else md += p.text + '\n\n'
  }
  md += '\n'
})

const out = opt.out ?? join(process.cwd(), `conversation-${(sessionId ?? 'session').slice(0, 8)}.md`)
writeFileSync(out, md)
console.log(`${turns.length} turns rendered`)
console.log(out)
