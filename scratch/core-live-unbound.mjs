// Definitive live pass over scheme/reference/01-core.slat.
// Extract every program-bearing code slot, run each in a FRESH core env,
// collect the exact set of still-unbound symbols. In-process (fast).
import { parse, Sym } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { makeCoreEnv } from '../core/index.js'
import { expandProgram } from '../src/macro.js'
import { readFileSync } from 'node:fs'

const FILE = 'scheme/reference/01-core.slat'
const PROG_KEY = /(code|program|composition)$/
const FUEL = 200000

// ---- collect (code, enclosing-canonical, key) under program-bearing keys ----
const codes = []  // {code, canon, key}
function canonOf(node) {
  if (!Array.isArray(node)) return null
  for (let i = 0; i < node.length; i++) {
    if (node[i] instanceof Sym && node[i].name === ':canonical' && typeof node[i + 1] === 'string') return node[i + 1]
  }
  return null
}
function walk(node, canon) {
  if (Array.isArray(node)) {
    const c = canonOf(node) || canon
    for (let i = 0; i < node.length; i++) {
      const k = node[i]
      if (k instanceof Sym && PROG_KEY.test(k.name) && typeof node[i + 1] === 'string') {
        codes.push({ code: node[i + 1], canon: c || '?', key: k.name })
      }
      walk(node[i], c)
    }
  }
}
for (const form of parse(readFileSync(FILE, 'utf8'))) walk(form, null)

// ---- run each in a fresh env, classify ----
const unbound = new Map()   // sym -> count
const otherErr = new Map()  // message-head -> count
let pass = 0, fail = 0
const UNB = /unbound symbol:\s*([^\s\n)]+)/
const failSlots = []  // {canon, key, sym, head}

for (const { code: src, canon, key } of codes) {
  let err = null
  try {
    const env = makeCoreEnv({ fuel: { n: FUEL } })
    const { forms } = expandProgram(parse(src), { fuel: { n: FUEL } })
    const fuel = { n: FUEL }
    for (const f of forms) evaluate(f, env, fuel)
  } catch (e) { err = e }
  if (!err) { pass++; continue }
  fail++
  const msg = String(err && err.message || err)
  const m = UNB.exec(msg)
  const head = (src.trim().split('\n')[0] || '').slice(0, 70)
  if (m) { unbound.set(m[1], (unbound.get(m[1]) || 0) + 1); failSlots.push({ canon, key, sym: m[1], head }) }
  else {
    const h2 = msg.split('\n')[0].slice(0, 60)
    otherErr.set(h2, (otherErr.get(h2) || 0) + 1)
    failSlots.push({ canon, key, sym: '(' + h2 + ')', head })
  }
}
failSlots.sort((a, b) => (a.canon + a.sym).localeCompare(b.canon + b.sym))
console.log('FAILING SLOTS (canonical | key | unbound | code-head):')
for (const f of failSlots) console.log(`  ${f.canon}  |  ${f.key}  |  ${f.sym}  |  ${f.head}`)

const sortEntries = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])
console.log(`01-core code slots: ${codes.length}`)
console.log(`  PASS ${pass}  FAIL ${fail}`)
console.log(`\nUNIQUE UNBOUND SYMBOLS (${unbound.size}):`)
for (const [sym, n] of sortEntries(unbound)) console.log(`  ${String(n).padStart(4)}  ${sym}`)
console.log(`\nOTHER ERROR HEADS (${otherErr.size}):`)
for (const [head, n] of sortEntries(otherErr)) console.log(`  ${String(n).padStart(4)}  ${head}`)

// ---- dump failing slot sources for the fixer (appended) ----
import { writeFileSync as _wf } from 'node:fs'
const _dump = []
for (const { code: src, canon, key } of codes) {
  try {
    const env = makeCoreEnv({ fuel: { n: FUEL } })
    const { forms } = expandProgram(parse(src), { fuel: { n: FUEL } })
    const fuel = { n: FUEL }
    for (const f of forms) evaluate(f, env, fuel)
  } catch (e) {
    const msg = String(e && e.message || e)
    const m = UNB.exec(msg)
    _dump.push({ canon, key, sym: m ? m[1] : ('('+msg.split('\n')[0].slice(0,50)+')'), code: src })
  }
}
_wf('scratch/core-failing-slots.json', JSON.stringify(_dump, null, 2))
console.log('\nDUMPED', _dump.length, 'failing slots -> scratch/core-failing-slots.json')
