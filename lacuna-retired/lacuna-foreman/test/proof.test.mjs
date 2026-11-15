// P7 — THE PROOF (design §15 P7; work order §6 V21). Parses every contract and ledger row of the newest recorded batch
// (tools/proof/batches/<id>/, written by tools/proof/run-batch.mjs; PROOF_BATCH names another) and holds the gate:
// `(exit 0)` on every pass, `(swapped-at N)` on ≥ 1 contract, ≥ 1 kick on the run record, tackled = the frozen count,
// strict on a clean checkout agrees on 20 audited passes (tools/proof/audit.mjs → audit.json); it prints the tile
// "N tackled · M right · K first try". Run as the gate (`node test/proof.test.mjs`) every row is hard. Inside the foreman
// suite (`node --test test/`) the gate rows are `todo` with their reason until the batch is green, so a red proof never
// hides a red kernel test; the parse rows are hard everywhere. With no batch recorded the gate rows say so and fail.
// Invariants (§18): law 6 ("a claim is not a record": the counts come from contracts and the ledger, never a report).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readContract } from '../contract.mjs'
import { parse } from '../scheme.mjs'
import { fromSlat } from '../protocol.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BATCHES = path.resolve(HERE, '..', '..', '..', 'tools', 'proof', 'batches')
const GATE = !process.env.NODE_TEST_CONTEXT || process.env.PROOF_GATE === '1'
const AUDITED = 20

/** The newest batch folder, or the one PROOF_BATCH names. */
function batchDir() {
  if (process.env.PROOF_BATCH) return path.resolve(process.env.PROOF_BATCH)
  if (!fs.existsSync(BATCHES)) return null
  const ds = fs.readdirSync(BATCHES).filter((d) => fs.existsSync(path.join(BATCHES, d, 'batch.json'))).sort()
  return ds.length ? path.join(BATCHES, ds[ds.length - 1]) : null
}

/** One batch, read: its record, each contract parsed, each ledger row parsed, the audit if written. */
function load(dir) {
  const batch = JSON.parse(fs.readFileSync(path.join(dir, 'batch.json'), 'utf8'))
  const cdir = path.join(dir, 'contracts')
  const contracts = (fs.existsSync(cdir) ? fs.readdirSync(cdir) : []).filter((f) => f.endsWith('.slat')).sort()
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(cdir, f), 'utf8') }))
  const lfile = path.join(dir, 'ledger.slat')
  const ledger = (fs.existsSync(lfile) ? fs.readFileSync(lfile, 'utf8').split('\n') : []).filter((l) => l.trim().startsWith('(run '))
  const afile = path.join(dir, 'audit.json')
  return { batch, contracts, ledger, audit: fs.existsSync(afile) ? JSON.parse(fs.readFileSync(afile, 'utf8')) : null }
}

/**
 * The tile from the records: tackled = distinct slugs with a repair run; right = slugs with a pass on any attempt;
 * first try = slugs whose earliest run (by its ledger `ended`) passed.
 * @param {Array<Object>} cs the parsed contracts.
 * @param {Map<string, Object>} rows the ledger rows by run id.
 * @returns {{tackled: number, right: number, first: number, line: string}}
 */
export function tile(cs, rows) {
  const bySlug = new Map()
  for (const c of cs) {
    if (!String(c.key || '').startsWith('repair@')) continue
    const slug = c.key.slice('repair@'.length)
    if (!bySlug.has(slug)) bySlug.set(slug, [])
    bySlug.get(slug).push(c)
  }
  let right = 0, first = 0
  for (const runs of bySlug.values()) {
    runs.sort((a, b) => (rows.get(a.run)?.ended ?? Infinity) - (rows.get(b.run)?.ended ?? Infinity) || String(a.run).localeCompare(String(b.run)))
    if (runs.some((c) => c.outcome === 'pass')) right += 1
    if (runs[0].outcome === 'pass') first += 1
  }
  const tackled = bySlug.size
  return { tackled, right, first, line: `${tackled} tackled · ${right} right · ${first} first try` }
}

const dir = batchDir()
const b = dir ? load(dir) : null
const parsed = b ? b.contracts.map((c) => ({ file: c.file, c: (() => { try { return readContract(c.text) } catch (e) { return { error: e.message } } })() })) : []
const cs = parsed.filter((p) => !p.c.error).map((p) => p.c)
const rows = new Map(b ? b.ledger.map((l) => fromSlat(parse(l)[0][1])).map((r) => [r.id, r]) : [])
const t = tile(cs, rows)
if (b) console.log(`P7 batch ${b.batch.id}: ${t.line} (frozen ${b.batch.frozen}; ${cs.length} contracts, ${rows.size} ledger rows${b.batch.end ? `; ${b.batch.end}` : ''})`)

/** A gate row: hard as the gate, `todo` with its reason inside the suite. */
function gate(name, fn) {
  let why = null
  try { fn() } catch (e) { why = e.message }
  if (GATE || !why) test(name, () => { if (why) assert.fail(why) })
  else test(name, { todo: why }, () => {})
}

test('a batch is recorded', { todo: !b && !GATE ? 'no batch under tools/proof/batches; run tools/proof/run-batch.mjs' : false }, () => {
  if (GATE) assert.ok(b, 'no batch under tools/proof/batches; run tools/proof/run-batch.mjs')
})

test('every contract reads back field by field (readContract)', () => {
  for (const p of parsed) assert.ok(!p.c.error, `${p.file}: ${p.c.error}`)
})

test('every ledger row of the batch reads back and names its run', () => {
  for (const r of rows.values()) { assert.equal(typeof r.id, 'string'); assert.ok(['pass', 'fail', 'stopped', 'waiting-owner', null].includes(r.outcome)) }
})

test('(exit 0) on every pass (§17; law 6)', () => {
  for (const c of cs.filter((x) => x.outcome === 'pass')) assert.equal(c.exit, 0, `${c.run} passed with exit ${c.exit}`)
})

gate('(swapped-at N) on at least one contract: the brain restarted mid-batch (§10, §18)', () => {
  assert.ok(b, 'no batch recorded')
  const n = cs.filter((c) => c.swapped_at != null).length
  assert.ok(n >= 1, `0 of ${cs.length} contracts carry swapped-at; the swap: ${JSON.stringify(b.batch.swap?.swapped ?? 'not tried').slice(0, 200)}`)
})

gate('at least one kick record (§9.2)', () => {
  assert.ok(b, 'no batch recorded')
  const n = [...rows.values()].reduce((s, r) => s + (Number(r.kicks) || 0), 0)
  assert.ok(n >= 1, `0 kicks over ${rows.size} run records (the contract text carries no kicks field; the ledger row counts them)`)
})

gate('tackled equals the frozen count', () => {
  assert.ok(b, 'no batch recorded')
  assert.equal(t.tackled, b.batch.frozen, `${t.tackled} tackled of ${b.batch.frozen} frozen`)
})

gate(`strict on a clean checkout agrees on ${AUDITED} audited passes (§15 P7; ch. 6 §6.10.4 point 2)`, () => {
  assert.ok(b, 'no batch recorded')
  assert.ok(b.audit, 'no audit.json beside the batch; run tools/proof/audit.mjs')
  assert.equal(b.audit.audited, AUDITED, `${b.audit.audited} audited (${b.audit.passes} passes recorded)`)
  assert.equal(b.audit.agree, AUDITED, `${b.audit.agree} of ${b.audit.audited} agree`)
})

test('the tile line has the desk\'s shape', () => {
  assert.match(t.line, /^\d+ tackled · \d+ right · \d+ first try$/)
})
