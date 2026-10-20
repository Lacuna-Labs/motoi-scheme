// scan-reference-pedagogy.mjs — deterministic format + mechanical-pedagogy scan.
//
// Uses Motoi's own reader. Reports FORMAT defects (structural) and PEDAGOGY
// SUSPECTS (mechanical proxies). Suspects are not failures — they are the set
// worth a human/judgment read. Nothing here certifies "the teaching is good";
// it certifies "the shape is right" and "here is what smells off."
//
// Usage: node scratch/scan-reference-pedagogy.mjs
import { parse, Sym } from '../src/reader.js'
import fs from 'fs'
import path from 'path'

const REF = 'scheme/reference'
const REQ_TOP = [':name', ':std', ':library', ':kind', ':signature', ':summary',
  ':examples', ':row-2-audit', ':row-3-dimension', ':row-4-proof', ':row-5-emergence']
const ROWS = [':row-2-audit', ':row-3-dimension', ':row-4-proof', ':row-5-emergence']
const TIERS = ['novice', 'intermediate', 'expert']

const isSym = (x, n) => x instanceof Sym && (n ? x.name === n : true)
const isProgKey = (name) => /(?:code|program|composition)$/.test(name.replace(/^:/, ''))
// plist getter: scan EVERY position for the keyword (entries start with a
// keyword at index 0, verb forms start with a head symbol — this handles both).
const kv = (form, key) => {
  if (!Array.isArray(form)) return undefined
  for (let i = 0; i < form.length; i++) if (isSym(form[i], key)) return form[i + 1]
  return undefined
}
const kwsOf = (form) => {
  const o = []
  if (!Array.isArray(form)) return o
  for (let i = 0; i < form.length; i++) if (form[i] instanceof Sym && form[i].name.startsWith(':')) o.push(form[i].name)
  return o
}
const norm = (s) => typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().toLowerCase() : ''
const isNull = (s) => typeof s === 'string' && (s.trimStart().startsWith(';; honest-null') || /honest-null/.test(s.slice(0, 40)))

const formatDefects = []   // {file, verb, defect}
const pedSuspects = []     // {file, verb, kind, detail}
const noteFreq = new Map() // normalized note/explanation -> [verbs]
const progFreq = new Map() // normalized program body -> [verbs]
let verbCount = 0

function record(map, key, id) {
  if (!key) return
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(id)
}

for (const file of fs.readdirSync(REF).filter((f) => f.endsWith('.slat')).sort()) {
  let forms
  try { forms = parse(fs.readFileSync(path.join(REF, file), 'utf8')) }
  catch (e) { formatDefects.push({ file, verb: '(file)', defect: `PARSE-FAIL: ${e.message}` }); continue }

  for (const f of forms) {
    if (!(Array.isArray(f) && isSym(f[0], 'verb'))) continue
    verbCount++
    const name = typeof kv(f, ':name') === 'string' ? kv(f, ':name') : '?'
    const id = `${file}:${name}`
    const top = kwsOf(f)

    // ---- FORMAT ----
    for (const req of REQ_TOP) if (!top.includes(req)) formatDefects.push({ file, verb: name, defect: `missing ${req}` })

    // examples: list of 3, tiered novice/intermediate/expert, each with :code + :note
    const ex = kv(f, ':examples')
    if (!Array.isArray(ex)) formatDefects.push({ file, verb: name, defect: ':examples not a list' })
    else {
      if (ex.length < 3) formatDefects.push({ file, verb: name, defect: `:examples has ${ex.length}, expected >=3` })
      const seenTiers = []
      ex.forEach((e, i) => {
        const tier = kv(e, ':tier'); const code = kv(e, ':code'); const note = kv(e, ':note')
        if (typeof tier === 'string') seenTiers.push(tier)
        if (typeof code !== 'string') formatDefects.push({ file, verb: name, defect: `example[${i}] :code not a string` })
        if (typeof note !== 'string' || !note.trim()) pedSuspects.push({ file, verb: name, kind: 'empty-note', detail: `example[${i}]` })
        if (typeof code === 'string') record(progFreq, norm(code), id)
        if (typeof note === 'string') record(noteFreq, norm(note), id)
      })
      // tier sanity: every tier must be a known value, and difficulty must be
      // non-decreasing (novice<=intermediate<=expert). Variable counts are fine.
      const rank = (t) => TIERS.indexOf(t)
      const unknown = seenTiers.filter((t) => rank(t) < 0)
      let nonMono = false
      for (let i = 1; i < seenTiers.length; i++) if (rank(seenTiers[i]) < rank(seenTiers[i - 1])) nonMono = true
      if (unknown.length) pedSuspects.push({ file, verb: name, kind: 'tier-unknown', detail: unknown.join(',') })
      else if (nonMono) pedSuspects.push({ file, verb: name, kind: 'tier-order', detail: seenTiers.join(',') })
      // program-mentions-verb: at least one example code references the verb (or its last path segment)
      const base = name.includes('/') ? name.split('/').pop() : name
      const mentions = ex.some((e) => { const c = kv(e, ':code'); return typeof c === 'string' && (c.includes(name) || c.includes(base)) })
      if (!mentions) pedSuspects.push({ file, verb: name, kind: 'no-self-mention', detail: 'no example code references the verb' })
    }

    // rows: the corpus uses MORE THAN ONE valid layout per row (some verbs put
    // :eng/math/cs-program in one rung; others use 3 rungs each with a generic
    // :program; row-3 nests :rungs; row-5 uses :composition keys). So we do NOT
    // demand a fixed key layout — we check CONTENT the way the certifier does:
    // recursively count program slots (key ending code/program/composition ->
    // string) and prose slots (a known prose key -> nonempty string) in the row.
    const PROSE_KEYS = new Set([':problem', ':explanation', ':setup', ':claim',
      ':invariant', ':base', ':emergent', ':note', ':summary'])
    const collectRow = (node, acc) => {
      if (!Array.isArray(node)) return acc
      for (let i = 0; i < node.length; i++) {
        const k = node[i]
        if (k instanceof Sym && k.name.startsWith(':')) {
          const val = node[i + 1]
          if (typeof val === 'string') {
            if (isProgKey(k.name)) { isNull(val) ? acc.nullProg++ : (acc.realProg++, acc.progs.push(val)) }
            else if (PROSE_KEYS.has(k.name) && val.trim()) { acc.prose++; acc.proseStrs.push(val) }
          }
        }
        if (Array.isArray(node[i])) collectRow(node[i], acc)
      }
      return acc
    }
    for (const rk of ROWS) {
      const row = kv(f, rk)
      if (!Array.isArray(row) || !row.length) { formatDefects.push({ file, verb: name, defect: `${rk} empty/not-list` }); continue }
      const acc = collectRow(row, { realProg: 0, nullProg: 0, prose: 0, progs: [], proseStrs: [] })
      const totalProg = acc.realProg + acc.nullProg
      if (totalProg < 3) formatDefects.push({ file, verb: name, defect: `${rk} has ${totalProg} program slots, expected >=3` })
      if (acc.prose === 0) pedSuspects.push({ file, verb: name, kind: 'row-no-prose', detail: rk })
      for (const p of acc.progs) {
        record(progFreq, norm(p), id)
        if (p.trim().length < 12) pedSuspects.push({ file, verb: name, kind: 'stub-program', detail: `${rk}: ${JSON.stringify(p.trim())}` })
      }
      for (const s of acc.proseStrs) record(noteFreq, norm(s), id)
    }
  }
}

// ---- PHRASE-LOCK: prose/programs reused across many DISTINCT verbs ----
const REUSE = 3 // appears verbatim in >=3 distinct verbs
const dupNotes = [...noteFreq.entries()]
  .map(([s, ids]) => [s, new Set(ids).size, ids])
  .filter(([s, n]) => n >= REUSE && s.length > 25 && !s.startsWith(';; honest-null'))
  .sort((a, b) => b[1] - a[1])
const dupProgs = [...progFreq.entries()]
  .map(([s, ids]) => [s, new Set(ids).size, ids])
  .filter(([s, n]) => n >= REUSE && s.length > 15)
  .sort((a, b) => b[1] - a[1])

// ---- REPORT ----
const byKind = {}
for (const s of pedSuspects) byKind[s.kind] = (byKind[s.kind] || 0) + 1

console.log(`=== REFERENCE FORMAT + MECHANICAL-PEDAGOGY SCAN (${verbCount} verbs) ===\n`)
console.log(`FORMAT defects: ${formatDefects.length}`)
const fmtByType = {}
for (const d of formatDefects) { const t = d.defect.replace(/\[[0-9]+\]/g, '[i]').replace(/:.*$/, m => m.length > 30 ? ':…' : m); fmtByType[t] = (fmtByType[t] || 0) + 1 }
for (const [t, n] of Object.entries(fmtByType).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${t}`)

console.log(`\nPEDAGOGY suspects: ${pedSuspects.length}`)
for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)

console.log(`\nPHRASE-LOCK — prose reused verbatim across >=${REUSE} verbs: ${dupNotes.length} strings`)
for (const [s, n] of dupNotes.slice(0, 12)) console.log(`  ${String(n).padStart(4)}×  "${s.slice(0, 70)}${s.length > 70 ? '…' : ''}"`)
console.log(`\nPHRASE-LOCK — programs reused verbatim across >=${REUSE} verbs: ${dupProgs.length} strings`)
for (const [s, n] of dupProgs.slice(0, 12)) console.log(`  ${String(n).padStart(4)}×  "${s.slice(0, 70)}${s.length > 70 ? '…' : ''}"`)

fs.writeFileSync('scratch/reference-scan.json', JSON.stringify({ formatDefects, pedSuspects, dupNotes: dupNotes.slice(0, 200), dupProgs: dupProgs.slice(0, 200) }, null, 1))
console.log('\nfull detail -> scratch/reference-scan.json')
