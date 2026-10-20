// certify-reference.mjs — the self-hosting reference certifier.
//
// Counts program slots per verb using Motoi's OWN reader (src/reader.js) —
// the exact tokenizer the interpreter uses. Not a regex. The reader handles
// multi-line forms, ';;' comments inside strings, and the number tower
// correctly, so it cannot miscount the way a text scan does.
//
// A "program slot" = any keyword ending in code/program/composition whose
// following value is a string. Honest-null slots (a deliberate ';; honest-null'
// marker = "no corpus signal, no fabrication") count toward the 15 but are
// tallied separately so real vs at-spec are both visible.
//
// Usage: node scratch/certify-reference.mjs
import { parse, Sym } from '../src/reader.js'
import fs from 'fs'
import path from 'path'

const REF = 'scheme/reference'
const TARGET = 15
const isKw = (x) => x instanceof Sym && x.name.startsWith(':')
const isProgramKey = (name) =>
  /(?:code|program|composition)$/.test(name.replace(/^:/, ''))
const isNull = (s) =>
  typeof s === 'string' &&
  (s.trimStart().startsWith(';; honest-null') || /honest-null/.test(s.slice(0, 40)))

// Recursively walk a form, counting program slots (real + null).
function countSlots(form) {
  let real = 0, nul = 0
  const walk = (node) => {
    if (!Array.isArray(node)) return
    for (let i = 0; i < node.length; i++) {
      const k = node[i]
      if (isKw(k) && isProgramKey(k.name)) {
        const val = node[i + 1]
        if (typeof val === 'string') {
          if (isNull(val)) nul++; else real++
        }
      }
      if (Array.isArray(node[i])) walk(node[i])
    }
  }
  walk(form)
  return { real, nul }
}

function verbName(form) {
  for (let i = 1; i < form.length; i++) {
    if (form[i] instanceof Sym && form[i].name === ':name') {
      const v = form[i + 1]
      return typeof v === 'string' ? v : String(v)
    }
  }
  return '?'
}

const rows = []
for (const file of fs.readdirSync(REF).filter((f) => f.endsWith('.slat')).sort()) {
  let forms
  try {
    forms = parse(fs.readFileSync(path.join(REF, file), 'utf8'))
  } catch (e) {
    console.error(`PARSE-FAIL ${file}: ${e.message}`)
    continue
  }
  for (const f of forms) {
    if (Array.isArray(f) && f[0] instanceof Sym && f[0].name === 'verb') {
      const { real, nul } = countSlots(f)
      rows.push({ file, name: verbName(f), real, nul, total: real + nul })
    }
  }
}

const total = rows.length
const slots = rows.reduce((a, r) => a + r.total, 0)
const realSlots = rows.reduce((a, r) => a + r.real, 0)
const nullSlots = rows.reduce((a, r) => a + r.nul, 0)
const atSpec = rows.filter((r) => r.total >= TARGET)
const under = rows.filter((r) => r.total < TARGET)

console.log(`=== MOTOI-READER REFERENCE CERTIFIER (target ${TARGET}/verb) ===`)
console.log(`verbs=${total}  program-slots=${slots}  (real=${realSlots} honest-null=${nullSlots})`)
console.log(`mean slots/verb=${(slots / total).toFixed(2)}`)
console.log(`at-spec (>=${TARGET}): ${atSpec.length} (${(100 * atSpec.length / total).toFixed(1)}%)   UNDER: ${under.length}`)

const dist = {}
for (const r of rows) dist[r.total] = (dist[r.total] || 0) + 1
console.log('\n--- distribution: total slots -> #verbs ---')
for (const k of Object.keys(dist).map(Number).sort((a, b) => a - b)) {
  const flag = k < TARGET ? '  <-- UNDER' : (k === TARGET ? '  == target' : '  (over)')
  console.log(`  ${String(k).padStart(3)} slots : ${String(dist[k]).padStart(4)} verbs${flag}`)
}

console.log(`\n--- UNDER-spec verbs (real+null=total) : ${under.length} total ---`)
for (const r of under.sort((a, b) => a.total - b.total || a.file.localeCompare(b.file)).slice(0, 60)) {
  console.log(`  ${String(r.real).padStart(2)}+${String(r.nul).padStart(2)}=${String(r.total).padStart(2)}  ${r.file.padEnd(26)} ${r.name}`)
}
if (under.length > 60) console.log(`  ... and ${under.length - 60} more`)

fs.writeFileSync('scratch/reference-slot-census.json', JSON.stringify(rows, null, 1))
console.log('\nper-verb census -> scratch/reference-slot-census.json')
