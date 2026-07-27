#!/usr/bin/env node
// Local agent-conversation annotation surface (plannotator-style, zero deps).
//
// Parses a Claude Code session transcript (.jsonl), serves a local review UI,
// blocks until the human approves or requests changes, then prints a single
// JSON line to stdout: {decision, sessionId, annotations:[{turn, role, uuid, quote, note}]}
//
// Usage:
//   review-server.mjs [target] [--thinking] [--no-open] [--port N]
//   target: .jsonl path | session-id prefix | omitted = latest for cwd
//
// The agent invokes this in the background and parses the final stdout line.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

// ---------- args ----------
const args = process.argv.slice(2)
const opt = { thinking: false, open: true, port: 0, maxChars: 300 }
const positional = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--thinking') opt.thinking = true
  else if (args[i] === '--no-open') opt.open = false
  else if (args[i] === '--port') opt.port = Number(args[++i])
  else positional.push(args[i])
}

// ---------- transcript parsing ----------
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

const clip = (s, n) => {
  s = String(s).replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}

function toolSummary(block) {
  const inp = block.input ?? {}
  const hint =
    inp.file_path ?? inp.path ?? inp.command ?? inp.pattern ?? inp.query ?? inp.url ??
    inp.prompt ?? inp.description ?? inp.skill ?? ''
  return `${block.name}${hint !== '' ? ' — ' + clip(hint, 160) : ''}`
}

function parseTranscript(path) {
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l !== '')
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
      if (block.type === 'text' && block.text != null && block.text.trim() !== '') {
        const text = block.text
          .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
          .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
          .replace(/<command-(name|message|args)>[\s\S]*?<\/command-\1>/g, '')
          .trim()
        if (text !== '') parts.push({ kind: 'text', text })
      } else if (block.type === 'tool_use') {
        parts.push({ kind: 'tool', text: toolSummary(block) })
      } else if (block.type === 'thinking' && opt.thinking && block.thinking?.trim() !== '') {
        parts.push({ kind: 'thinking', text: clip(block.thinking, 500) })
      }
    }
    if (parts.length === 0) continue

    const prev = turns[turns.length - 1]
    if (prev != null && prev.role === rec.type) {
      prev.parts.push(...parts)
    } else {
      turns.push({ n: turns.length + 1, role: rec.type, uuid: rec.uuid ?? '', ts: rec.timestamp ?? null, parts })
    }
  }
  if (turns.length === 0) throw new Error(`no conversational turns found in ${path}`)
  return { sessionId, transcript: path, turns }
}

// ---------- UI ----------
const PAGE = (dataJson) => `<!doctype html>
<html><head><meta charset="utf-8"><title>Conversation review</title>
<style>
  :root { --bg:#131320; --card:#1a1b2b; --card2:#20223a; --fg:#cdd3f5; --dim:#7982a9;
          --border:#2b2d45; --accent:#7aa2f7; --green:#9ece6a; --danger:#f7768e; }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--fg);
         font:14px/1.55 Inter,system-ui,sans-serif }
  header { position:sticky; top:0; z-index:10; display:flex; align-items:center; gap:12px;
           padding:10px 18px; background:var(--card); border-bottom:1px solid var(--border) }
  header h1 { font-size:14px; margin:0; font-weight:650 }
  header .spacer { flex:1 }
  .count { color:var(--dim); font-size:12.5px }
  button { font:inherit; cursor:pointer; border:1px solid var(--border); border-radius:8px;
           background:none; color:var(--fg); padding:6px 14px }
  .approve { background:var(--green); border-color:var(--green); color:#10101a; font-weight:650 }
  .changes { background:var(--accent); border-color:var(--accent); color:#10101a; font-weight:650 }
  .changes:disabled, .approve:disabled { opacity:.4; cursor:default }
  main { display:flex; gap:0 }
  .convo { flex:1; max-width:860px; margin:0 auto; padding:22px 26px 120px }
  .turn { border:1px solid var(--border); border-radius:12px; background:var(--card);
          margin-bottom:14px; overflow:hidden }
  .turn.user { border-color:#3d4470; background:var(--card2) }
  .turn-h { display:flex; align-items:center; gap:8px; padding:7px 14px; font-size:12px;
            color:var(--dim); border-bottom:1px solid var(--border); user-select:none }
  .turn-h .badge { background:var(--accent); color:#10101a; border-radius:9px; padding:0 7px;
                   font-weight:650; display:none }
  .turn-h .addnote { margin-left:auto; border:none; color:var(--dim); padding:2px 8px }
  .turn-h .addnote:hover { color:var(--accent) }
  .turn-b { padding:12px 16px; white-space:pre-wrap; overflow-wrap:break-word }
  .tool { font:12px/1.5 ui-monospace,Menlo,monospace; color:var(--dim); padding:1px 0;
          white-space:pre-wrap }
  .tool::before { content:'⚙ '; }
  .thinking { color:var(--dim); font-style:italic }
  aside { width:320px; min-height:100vh; border-left:1px solid var(--border);
          background:var(--card); padding:16px; position:sticky; top:0; align-self:flex-start;
          max-height:100vh; overflow:auto }
  aside h2 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); margin:0 0 12px }
  .ann { border:1px solid var(--border); border-radius:10px; padding:10px 12px; margin-bottom:10px }
  .ann .t { color:var(--accent); font-weight:650; font-size:12px }
  .ann .q { color:var(--dim); font-size:12px; font-style:italic; margin:4px 0;
            border-left:2px solid var(--border); padding-left:8px }
  .ann .x { float:right; border:none; color:var(--dim); padding:0 4px }
  .ann .x:hover { color:var(--danger) }
  #fab { position:fixed; display:none; z-index:20 }
  #fab button { background:var(--accent); color:#10101a; border:none; font-weight:650;
                border-radius:16px; padding:5px 14px; box-shadow:0 4px 14px rgb(0 0 0/.5) }
  #composer { position:fixed; display:none; z-index:21; background:var(--card);
              border:1px solid var(--border); border-radius:12px; padding:10px;
              box-shadow:0 8px 28px rgb(0 0 0/.55); width:340px }
  #composer .q { color:var(--dim); font-size:12px; font-style:italic; margin-bottom:8px;
                 max-height:60px; overflow:hidden }
  #composer textarea { width:100%; height:64px; background:var(--bg); color:var(--fg);
                       border:1px solid var(--border); border-radius:8px; padding:8px; resize:vertical; font:inherit }
  #composer .row { display:flex; gap:8px; justify-content:flex-end; margin-top:8px }
  .doneview { display:grid; place-items:center; height:100vh; font-size:16px }
  kbd { background:var(--bg); border:1px solid var(--border); border-radius:4px;
        padding:0 5px; font-size:11px }
</style></head><body>
<header>
  <h1>Conversation review · <span id="sid"></span></h1>
  <span class="count"><span id="anncount">0</span> annotations</span>
  <div class="spacer"></div>
  <button class="changes" id="btn-changes" disabled>Request changes</button>
  <button class="approve" id="btn-approve">Approve <kbd>⌘⏎</kbd></button>
</header>
<main>
  <div class="convo" id="convo"></div>
  <aside><h2>Annotations</h2><div id="annlist"><p class="count">Select text in any turn, or use ＋ on a turn header.</p></div></aside>
</main>
<div id="fab"><button id="fab-btn">💬 Annotate</button></div>
<div id="composer">
  <div class="q" id="composer-q"></div>
  <textarea id="composer-note" placeholder="What should change here?"></textarea>
  <div class="row"><button id="composer-cancel">Cancel</button><button class="changes" id="composer-save">Add</button></div>
</div>
<script>
const DATA = ${dataJson};
const anns = [];
let pending = null; // {turn, role, uuid, quote}

const el = (id) => document.getElementById(id);
el('sid').textContent = (DATA.sessionId ?? '?').slice(0, 8);

const convo = el('convo');
for (const t of DATA.turns) {
  const card = document.createElement('div');
  card.className = 'turn ' + t.role;
  card.dataset.turn = t.n; card.dataset.uuid = t.uuid; card.dataset.role = t.role;
  const ts = t.ts ? new Date(t.ts).toLocaleString() : '';
  const h = document.createElement('div');
  h.className = 'turn-h';
  h.innerHTML = '<span>T' + t.n + '</span><span>' + (t.role === 'user' ? '🧑 user' : '🤖 assistant') +
    '</span><span>' + ts + '</span><span class="badge" id="badge-' + t.n + '">0</span>' +
    '<button class="addnote" title="Annotate this turn">＋ note</button>';
  h.querySelector('.addnote').onclick = (e) => openComposer({turn:t.n, role:t.role, uuid:t.uuid, quote:''}, e.clientX, e.clientY);
  card.appendChild(h);
  const b = document.createElement('div');
  b.className = 'turn-b';
  for (const p of t.parts) {
    const d = document.createElement('div');
    if (p.kind === 'tool') d.className = 'tool';
    if (p.kind === 'thinking') d.className = 'thinking';
    d.textContent = p.text;
    b.appendChild(d);
    if (p.kind === 'text') b.appendChild(document.createElement('br'));
  }
  card.appendChild(b);
  convo.appendChild(card);
}

// selection → floating annotate button (Law 10)
const fab = el('fab');
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel == null || sel.isCollapsed || sel.rangeCount === 0) { fab.style.display = 'none'; return; }
  const range = sel.getRangeAt(0);
  const card = range.commonAncestorContainer.parentElement?.closest('.turn');
  if (card == null) { fab.style.display = 'none'; return; }
  const r = range.getBoundingClientRect();
  fab.style.left = (r.left + r.width / 2 - 40) + 'px';
  fab.style.top = (r.top - 38) + 'px';
  fab.style.display = 'block';
  fab.dataset.turn = card.dataset.turn; fab.dataset.role = card.dataset.role; fab.dataset.uuid = card.dataset.uuid;
});
el('fab-btn').onclick = () => {
  const quote = window.getSelection().toString().slice(0, 400);
  const r = fab.getBoundingClientRect();
  openComposer({turn:Number(fab.dataset.turn), role:fab.dataset.role, uuid:fab.dataset.uuid, quote}, r.left, r.top + 40);
  fab.style.display = 'none';
};

const composer = el('composer');
function openComposer(target, x, y) {
  pending = target;
  el('composer-q').textContent = target.quote !== '' ? '“' + target.quote + '”' : 'Turn T' + target.turn + ' (whole turn)';
  el('composer-note').value = '';
  composer.style.left = Math.min(x, window.innerWidth - 360) + 'px';
  composer.style.top = Math.min(y, window.innerHeight - 200) + 'px';
  composer.style.display = 'block';
  el('composer-note').focus();
}
el('composer-cancel').onclick = () => { composer.style.display = 'none'; pending = null; };
el('composer-save').onclick = () => {
  const note = el('composer-note').value.trim();
  if (note === '' || pending == null) return;
  anns.push({ ...pending, note });
  composer.style.display = 'none'; pending = null;
  renderAnns();
};
el('composer-note').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) el('composer-save').click();
  if (e.key === 'Escape') el('composer-cancel').click();
});

function renderAnns() {
  el('anncount').textContent = anns.length;
  el('btn-changes').disabled = anns.length === 0;
  const list = el('annlist');
  list.innerHTML = anns.length === 0 ? '<p class="count">Select text in any turn, or use ＋ on a turn header.</p>' : '';
  const perTurn = {};
  anns.forEach((a, i) => {
    perTurn[a.turn] = (perTurn[a.turn] ?? 0) + 1;
    const d = document.createElement('div');
    d.className = 'ann';
    d.innerHTML = '<button class="x">×</button><div class="t">T' + a.turn + ' · ' + a.role + '</div>' +
      (a.quote !== '' ? '<div class="q"></div>' : '') + '<div class="n"></div>';
    if (a.quote !== '') d.querySelector('.q').textContent = '“' + a.quote + '”';
    d.querySelector('.n').textContent = a.note;
    d.querySelector('.x').onclick = () => { anns.splice(i, 1); renderAnns(); };
    list.appendChild(d);
  });
  for (const t of DATA.turns) {
    const badge = el('badge-' + t.n);
    const c = perTurn[t.n] ?? 0;
    badge.style.display = c > 0 ? 'inline-block' : 'none';
    badge.textContent = c;
  }
}

async function submit(decision) {
  await fetch('/submit', { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ decision, sessionId: DATA.sessionId, annotations: anns }) });
  document.body.innerHTML = '<div class="doneview">✅ Submitted (' + decision + ', ' + anns.length +
    ' annotations) — you can close this tab.</div>';
}
el('btn-approve').onclick = () => submit('approve');
el('btn-changes').onclick = () => submit('request_changes');
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && composer.style.display !== 'block') submit('approve');
});
</script></body></html>`

// ---------- server (Law 1: block, then structured stdout) ----------
const data = parseTranscript(resolveTranscript(positional[0] ?? null))
const dataJson = JSON.stringify(data).replace(/</g, '\\u003c')

const server = createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(PAGE(dataJson))
  } else if (req.method === 'POST' && req.url === '/submit') {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end('{"ok":true}')
      // final stdout line is the feedback payload the agent parses
      console.log(body)
      setTimeout(() => process.exit(0), 150)
    })
  } else {
    res.writeHead(404); res.end()
  }
})

server.listen(opt.port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`
  console.error(`[annotate-conversation] ${data.turns.length} turns from ${data.transcript}`)
  console.error(`[annotate-conversation] review at ${url} — blocking until submit`)
  if (opt.open && process.platform === 'darwin') spawn('open', [url], { stdio: 'ignore', detached: true })
})
