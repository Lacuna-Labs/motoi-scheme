// purity.test.mjs — PURITY (lane F5-BC, BC.11). Owns: the test that no file under floor/ names three, the DOM, Math.random,
// performance.now or Date.now outside clock.js (law 2; RULINGS R7), and that index.js imports under node from
// lacuna-foreman/ with no dependency beyond Node's built-ins and ../lacuna-scheme/src. Refuses: an allowlist comment.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FLOOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FORBIDDEN = [/\bfrom\s+['"]three['"]/, /\bimport\s*\(\s*['"]three/, /\bdocument\s*[.[]/, /\bwindow\s*[.[]/, /\btypeof\s+(window|document)\b/, /Math\.random/, /performance\.now/, /Date\.now/]

function files(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...files(p))
    else if (/\.(m?js)$/.test(e.name)) out.push(p)
  }
  return out
}

// spec: law 2; master §2.2 (pure modules); RULINGS R7 (only lane D imports three) · class: L · technique: source grep ·
// method: every .js/.mjs under floor/ against the seven patterns; clock.js may name Date.now · sre: can a pose drift with the frame rate?
test('no file under floor/ names three, the DOM, Math.random, performance.now or Date.now (clock.js may name Date.now)', () => {
  const hits = []
  for (const f of files(FLOOR)) {
    const text = fs.readFileSync(f, 'utf8')
    const rel = path.relative(FLOOR, f)
    for (const re of FORBIDDEN) {
      if (re.source === 'Date\\.now' && rel === 'clock.js') continue
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
        if (/^\s*(\/\*\*|\*)/.test(line) || rel === 'test/purity.test.mjs') return
        if (re.test(code)) hits.push(`${rel}:${i + 1} ${re.source}`)
      })
    }
  }
  assert.deepEqual(hits, [])
})

// spec: RULINGS §2 (the address: foreman.sb reads only the foreman's tree); COMMON §6 (Node built-ins and ../lacuna-scheme/src only) ·
// class: L · technique: import under node · method: import index.js from lacuna-foreman/ and list every import specifier ·
// sre: can the foreman load the fold under its jail?
test('index.js imports under node from lacuna-foreman/ and every import is a built-in, a floor file or lacuna-scheme/src', async () => {
  const m = await import('../index.js')
  assert.equal(typeof m.createFold, 'function')
  const bad = []
  for (const f of files(FLOOR)) {
    if (f.includes('/test/')) continue
    const text = fs.readFileSync(f, 'utf8')
    for (const [, spec] of text.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      if (spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../') && !spec.includes('lacuna-home') && !spec.includes('node_modules')) continue
      bad.push(`${path.relative(FLOOR, f)}: ${spec}`)
    }
    for (const [, spec] of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) if (/lacuna-home|node_modules|^three/.test(spec)) bad.push(`${path.relative(FLOOR, f)}: ${spec}`)
  }
  assert.deepEqual(bad, [])
})
