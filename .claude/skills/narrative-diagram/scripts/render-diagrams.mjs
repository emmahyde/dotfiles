#!/usr/bin/env node
// Render a narrative-diagram doc headlessly: export every section to SVG, write PNG
// previews to eyeball, and audit the output for the failure modes that are invisible
// in a byte count (unrendered diagrams, mermaid parse errors, cross-file ID collisions).
//
//   node render-diagrams.mjs <doc.html> [--out DIR] [--no-preview] [--open]
//
// Exit code is non-zero if any check fails, so it can gate "the diagrams are done".

import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// playwright is rarely installed next to the skill; look where the user actually ran from
// (and beside this script) rather than forcing a copy into the skill directory.
const loadChromium = async () => {
  const roots = [process.cwd(), dirname(fileURLToPath(import.meta.url))]
  for (const root of roots) {
    try {
      // playwright ships CJS; require it rather than import(), whose namespace nests it under .default
      const req = createRequire(join(root, 'package.json'))
      return req('playwright').chromium
    } catch { /* try the next root */ }
  }
  console.error('playwright not found. Install it where you are running from:\n  npm i playwright && npx playwright install chromium')
  process.exit(2)
}
const chromium = await loadChromium()

const argv = process.argv.slice(2)
const flag = name => argv.includes(name)
const opt = (name, fallback) => {
  const i = argv.indexOf(name)
  return i === -1 ? fallback : argv[i + 1]
}

const docArg = argv.find(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--out')
if (!docArg) {
  console.error('usage: render-diagrams.mjs <doc.html> [--out DIR] [--no-preview] [--open]')
  process.exit(2)
}

const docPath = resolve(docArg)
const outDir = resolve(opt('--out', join(docPath, '..')))
const wantPreview = !flag('--no-preview')
mkdirSync(outDir, { recursive: true })

const problems = []
const note = m => problems.push(m)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 2400 } })

// A mermaid parse error is reported to the console and leaves the section blank; without
// capturing this the run looks successful and writes a near-empty SVG.
const consoleErrors = []
page.on('console', msg => {
  const text = msg.text()
  if (/parse error|error/i.test(text)) consoleErrors.push(text)
})
page.on('pageerror', err => consoleErrors.push(String(err)))

await page.goto(pathToFileURL(docPath).href)
await page.waitForTimeout(500)

// The colorize/squash/lift passes fire at 0/400/1200ms, so nothing is final before then.
await page.waitForFunction(
  () => [...document.querySelectorAll('.mermaid')].every(m => m.querySelector('svg')),
  null,
  { timeout: 60000 },
).catch(() => note('timed out waiting for every .mermaid block to render an <svg>'))
await page.waitForTimeout(1600)

const names = await page.evaluate(() =>
  [...document.querySelectorAll('.export-svg')].map(b => b.dataset.exportName))

if (!names.length) note('no .export-svg buttons found — sections need data-export-name')

const written = []
for (const name of names) {
  const xml = await page.evaluate(n => {
    const btn = document.querySelector(`.export-svg[data-export-name="${n}"]`)
    // A section holding a current/proposed pair binds each button to one diagram by id;
    // without this the second button silently re-exports the first diagram.
    const div = btn?.dataset.diagram
      ? document.getElementById(btn.dataset.diagram)
      : btn?.closest('section')?.querySelector('.mermaid')
    return div ? window.exportSvg(div, n) : null
  }, name)

  if (!xml) { note(`${name}: exportSvg returned nothing (missing .mermaid or unrendered)`); continue }

  const file = join(outDir, `${name}.svg`)
  writeFileSync(file, xml)
  written.push({ name, file, xml })

  if (wantPreview) {
    const el = await page.$(`section:has(.export-svg[data-export-name="${name}"])`)
    // fullPage waits on font loading and routinely times out; a sized clip does not.
    if (el) await el.screenshot({ path: join(outDir, `${name}.preview.png`) })
  }
}

// --- audits -----------------------------------------------------------------

const idsOf = xml => new Set([...xml.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]))

for (const { name, xml } of written) {
  const stray = [...idsOf(xml)].filter(id => !id.startsWith(`${name}-`))
  if (stray.length) note(`${name}: ${stray.length} un-namespaced id(s), e.g. ${stray.slice(0, 3).join(', ')}`)
  if (!/<style/.test(xml)) note(`${name}: no <style> block — labels will lose their fonts standalone`)
  if (/Unsupported markdown/.test(xml)) note(`${name}: contains a mermaid "Unsupported markdown" placeholder`)
  if (xml.length < 5000) note(`${name}: only ${xml.length} bytes — suspiciously small, likely an empty render`)
}

for (let i = 0; i < written.length; i++) {
  for (let j = i + 1; j < written.length; j++) {
    const shared = [...idsOf(written[i].xml)].filter(id => idsOf(written[j].xml).has(id))
    if (shared.length) {
      note(`${written[i].name} + ${written[j].name} share ${shared.length} id(s) — these will collide in GitHub's lightbox`)
    }
  }
}

// Render every export together in one DOM: the exact condition that surfaces an ID
// collision as a black slab. Screenshot it so the check is visual, not just textual.
if (written.length && wantPreview) {
  const combined = written.map(w => w.xml.replace(/^<\?xml[^>]*\?>\s*/, '')).join('')
  await page.setContent(
    `<body style="margin:0;background:#fff;display:flex;gap:12px;align-items:flex-start">${combined}</body>`)
  await page.waitForTimeout(900)
  await page.screenshot({ path: join(outDir, '_all-in-one-dom.png') })
}

await browser.close()

// --- report -----------------------------------------------------------------

for (const { name, file, xml } of written) {
  console.log(`  ✓ ${name}  ${(xml.length / 1024).toFixed(1)} KB  ${file}`)
}
for (const err of consoleErrors.slice(0, 5)) console.error(`  ! console: ${err.slice(0, 200)}`)
for (const p of problems) console.error(`  ✗ ${p}`)

if (consoleErrors.length) note(`${consoleErrors.length} console error(s) during render`)

if (problems.length) {
  console.error(`\n${basename(docPath)}: ${problems.length} problem(s) — see above.`)
  process.exit(1)
}
console.log(`\n${basename(docPath)}: ${written.length} diagram(s) exported, all checks passed.`)
if (wantPreview) console.log(`Review ${join(outDir, '_all-in-one-dom.png')} before attaching anywhere.`)
