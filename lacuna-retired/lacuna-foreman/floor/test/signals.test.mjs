// signals.test.mjs — the engine's truth table and the broken-transformer catalog match A7 row for row (lane F5-E, E.5). Owns:
// the test that floor/signals.js's rows are A7 §4.1, §4.2, §5 and §4.6's rows in the appendix's order, by name, with the
// vocabulary ids each cell names; that the table is pure frozen data; and that every kind a ruling changed keeps A7's word and
// the ruling beside it. Reads the appendix itself (docs/eng/floor-5.0/A7-ANATOMY-ENGINE-TRUTH.md), so an edit there or here is a
// visible failure. spec: A7 §4-§5, RULINGS §1(a), review §5a · class: D (data truth) · technique: the markdown as the oracle ·
// sre: does the floor read one table that says what the appendix says?
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SIGNALS, BROKEN, NOT_REPORTED } from '../signals.js'

const A7 = fs.readFileSync(new URL('../../../../docs/eng/floor-5.0/A7-ANATOMY-ENGINE-TRUTH.md', import.meta.url), 'utf8').split('\n')
/** The data rows of the first table under the heading that starts with `head`: each row's cells, the escaped `\|` kept inside. */
function table(head) {
  const at = A7.findIndex((l) => l.startsWith(head))
  assert.ok(at >= 0, `A7 has no heading ${head}`)
  const rows = [], start = A7.findIndex((l, i) => i > at && /^\|---/.test(l))
  for (let i = start + 1; i < A7.length && A7[i].startsWith('|'); i++) rows.push(A7[i].split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim()))
  return rows
}
const ids = (cell) => [...cell.matchAll(/V-(M\d{2}|W)\b/g)].map((m) => m[0])

test('the signals are A7 §4.1 and §4.2 row for row, each form an id its cell names, led by the cell\'s first', () => {
  for (const [at, head] of [['4.1', '### 4.1 '], ['4.2', '### 4.2 ']]) {
    const rows = table(head), ours = SIGNALS.filter((s) => s.at === at)
    assert.deepEqual(ours.map((s) => s.signal), rows.map((r) => r[0]), `§${at}'s signals, in order`)
    rows.forEach((r, k) => {
      const cell = ids(r.at(-1)), form = ours[k].form
      for (const v of form) assert.ok(cell.includes(v), `§${at} "${r[0]}": ${v} is not in its actor form`)
      if (cell.length) assert.equal(form[0], cell[0], `§${at} "${r[0]}" leads with ${cell[0]}`); else assert.deepEqual(form, [], `§${at} "${r[0]}" names no V row`)
    })
  }
  assert.equal(SIGNALS.length, 23)
})

test('the broken-transformer catalog is A7 §5 row for row, with the V rows its cells name', () => {
  const rows = table('## 5. ')
  assert.deepEqual(BROKEN.map((b) => b.case), rows.map((r) => r[0]), '§5\'s cases, in order')
  rows.forEach((r, k) => assert.deepEqual(BROKEN[k].v, ids(r[2]), `§5 "${r[0]}"'s V row`))
  assert.equal(BROKEN.length, 19)
})

test('what the engine does not report is A7 §4.6 row for row', () => {
  assert.deepEqual(NOT_REPORTED.map((g) => g.wanted), table('### 4.6 ').map((r) => r[0]))
})

test('the table is pure frozen data: no import, ids unique, a ruled kind keeps A7\'s word and the ruling', () => {
  const src = fs.readFileSync(new URL('../signals.js', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /^\s*import\b|\brequire\(|\bimport\(/m, 'signals.js imports nothing (the jail and the browser read it)')
  for (const t of [SIGNALS, BROKEN, NOT_REPORTED]) { assert.ok(Object.isFrozen(t)); assert.equal(new Set(t.map((x) => x.id)).size, t.length) }
  for (const row of [...SIGNALS, ...BROKEN]) if (row.a7) assert.ok(row.ruling, `${row.id}: A7's ${row.a7} changed with no ruling named`)
  const refused = ['mind.engine.crashloop', 'mind.engine.drain', 'mind.kv.lost', 'mind.kv ', 'phase stalled', 'phase degraded']   // review §5a, C-03, C-11
  for (const row of [...SIGNALS, ...BROKEN]) for (const k of refused) assert.ok(!row.kind.includes(k), `${row.id}'s kind uses the refused ${k}`)
})

// spec: F5-E E.5 ("so actors/mind.js reads one table"), A7 §4, §5 · class: D (data truth) · technique: the table against the actors'
// own REACTS lists, imported · method: every kind a signal or catalog row names (split on `|`) is reacted to by at least one actor in
// floor/actors/, and every `mind.*` kind by actors/mind.js · sre: if the engine emits a kind the table promises, can an actor drop it?
test('every kind the table names has an actor that reacts to it, and every mind kind reaches actors/mind.js', async () => {
  const dir = new URL('../actors/', import.meta.url)
  const reacts = {}
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const m = await import(new URL(f, dir).href)
    if (Array.isArray(m.REACTS)) reacts[f] = m.REACTS
  }
  assert.ok(Array.isArray(reacts['mind.js']), 'actors/mind.js exports REACTS')
  // a kind is a dotted word in the row's kind cell (the catalog's cells are prose); `mind.load.*` is a family, not a kind
  const kinds = new Set()
  for (const row of [...SIGNALS, ...BROKEN]) for (const m of row.kind.matchAll(/\b([a-z]+(?:\.[a-z]+)+)(?![a-z]|\.[a-z*])/g)) kinds.add(m[1])
  assert.deepEqual([...kinds].sort(), ['box.coast', 'foreman.hush', 'mind.engine.down', 'mind.engine.up', 'mind.load.done', 'mind.load.refused',
    'mind.load.start', 'mind.slot', 'mind.swap', 'mind.turn.done', 'mind.turn.fail', 'mind.turn.phase', 'mind.turn.start', 'mind.unload', 'service.down'])
  for (const k of kinds) {
    const by = Object.keys(reacts).filter((f) => reacts[f].includes(k))
    assert.ok(by.length, `${k}: no actor reacts to it`)
    if (k.startsWith('mind.')) assert.ok(by.includes('mind.js'), `${k}: actors/mind.js does not react to it`)
  }
})
