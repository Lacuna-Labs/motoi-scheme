// inventory-files.test.mjs — THE INVENTORY WHEN THE CARTS TREE IS NOT TIDY. Owns: the tests of inventory.mjs
// `scanCarts`, `readRow`, `headerFields` and `lastRuns` over files that do not read (EACCES), links that point nowhere,
// headers in every shape, worker records that are partial or junk, and box lists that a cart's minds do not fit. Refuses:
// the live world (~/lacuna-world) and the committed carts tree (every tree is built under /private/tmp/lacuna-unit/U5);
// a mock of inventory.mjs. Implements: work order U5 §3; design §12.3 (INDEX.slat regenerated from headers on load:
// name, version, hash, tier, minds with served model, acts, exam, last run, fit, state, author), §10 (the box's list).
// Invariants (§18): none of the twelve directly; it feeds "a claim is not a record" (a row says what the header says, a
// header that does not read is a draft). Faults (§16): F-02 (a header that does not read is a draft row with its sentence).
// coverage: inventory.mjs — lines 98.33% branches 99.12% functions 97.83% (2026-10-24, the lane's files alone; the CLI's --write is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { loadCarts } from '../carts.mjs'
import { headerFields, readRow, scanCarts, lastRuns } from '../inventory.mjs'
import { U5_TMP } from './fixtures/u5-door.mjs'

const tmp = (p) => { mkdirSync(U5_TMP, { recursive: true }); return mkdtempSync(join(U5_TMP, `${p}-`)) }
const CART = (name, extra = '', verbs = 'on every report') => `(lacuna-cart '${name} '((does . "watches ${name}") (done . "one pass") (version . 1)
  (restart . permanent) (deadlines . ((hand . 30))) (contract . ((goal . "g") (done-check . "c"))) (sentry . ())
  (agent . ((tier . watch) (verbs . (${verbs})))) ${extra}))
(every 60 (lambda () (report 'tick 1)))`
function host() { let n = 0; const letters = []; return { letters, now: () => 1000, id: () => `w${++n}`, save: () => {}, upstream: () => {}, mail: (m) => letters.push(m) } }

// spec: design §12.3 (the index is regenerated on load; a header that does not read is a draft row) · §12.4 (the first five serve)
// class: J11 fs EACCES (a cart file with mode 000) · M3 a stale link (a .sks link that points nowhere) · E11 one bad file must
//        not orphan the standing carts
// technique: fault injection on the file system of a scratch carts tree; then the boot load over it
// method: scanCarts and loadCarts over a tree with an unreadable draft and a dangling link; read the rows, the spawned list
// sre: if one draft file on disk has the wrong mode, do the three standing carts still start at boot?
test('an unreadable cart file is a draft row with the reason, and a link to nothing is skipped; the serving carts still spawn', (t) => {
  const root = tmp('eacces')
  mkdirSync(join(root, 'drafts'))
  writeFileSync(join(root, 'triggers.sks'), CART('triggers'))
  writeFileSync(join(root, 'drafts', 'locked.sks'), CART('locked'))
  chmodSync(join(root, 'drafts', 'locked.sks'), 0o000)
  t.after(() => chmodSync(join(root, 'drafts', 'locked.sks'), 0o600))
  symlinkSync(join(root, 'gone.sks'), join(root, 'ghost.sks'))
  const rows = scanCarts(root)
  assert.deepEqual(rows.map((r) => [r.name, r.state]), [['triggers', 'serving'], ['locked', 'draft']])
  assert.match(rows[1].problem, /^the file does not read: EACCES/)
  const s = new Supervisor(host())
  const r = loadCarts(s, root, { serve: null })
  assert.deepEqual(r.spawned, ['triggers'])
})

// spec: design §12.3 (each row's columns) · §10 (the box's agent minds; a role in service) · §12.1 (author claude|26b|owner)
// class: J7 shapes of input (a header that is not an alist, a sentry plan, a sentry word, no sentry) · J13 tables unset
// technique: state-machine walk over each column's sources: header, the line cart_gen.py writes, the box list, the runs map
// method: write carts into a scratch tree; readRow each with tables and runs; read every column it fills
// sre: does the index the desk shows say the truth about a cart: who wrote it, whether its minds fit this box, when it last ran?
test('a row says what the header says: author from the header or cart_gen\'s line, fit against the box list, sentry, the last run', () => {
  const root = tmp('row')
  const f = (name, text) => { writeFileSync(join(root, `${name}.sks`), text); return join(root, `${name}.sks`) }
  const box = { agent_minds: ['functiongemma:latest', 'gemma3:1b'], roles: { triage: { version: 'v2' } } }
  const fits = readRow(f('fits', CART('fits', "(minds . ((l . ((job . pick)))))", 'on every report mind')), { tables: { box } })
  assert.deepEqual([fits.fit, fits.minds, fits.author, fits.sentry, fits.missing], ['fits', ['l pick served=functiongemma'], 'claude', 'none', []])
  const role = readRow(f('role', CART('role', "(minds . ((l . ((job . pick) (role . triage)))))", 'on every report mind')), { tables: { box } })
  assert.deepEqual([role.fit, role.minds], ['fits', ['l pick role=triage served=triage']], 'a role in service fits by its own name')
  const off = readRow(f('off', CART('off', "(minds . ((l . ((job . pick)))))", 'on every report mind')), { tables: { box: { agent_minds: ['gemma4:e4b'], reserved: { 'gemma4:e4b': '4B' } } } })
  assert.deepEqual([off.fit, off.minds], ['no-fit', ['l pick served=functiongemma']], 'every agent mind reserved: the safe default is not on this box\'s list')
  const gen = readRow(f('gen', `;; written by the 26B (cart_gen.py) 2026-10-20\n${CART('gen', '(sentry . ((cart . sentry-watch) (watch . log)))')}`))
  assert.deepEqual([gen.author, gen.sentry], ['26b', 'sentry-watch'])
  assert.equal(readRow(f('own', CART('own', '(author . owner)').replace('(sentry . ())', '(sentry . error)'))).author, 'owner')
  assert.equal(readRow(f('own2', CART('own2').replace('(sentry . ())', '(sentry . error)'))).sentry, 'error')
  assert.equal(readRow(f('plan', CART('plan').replace('(sentry . ())', '(sentry . ((watch . log)))'))).sentry, 'none', 'a plan with no cart')
  const runs = new Map([['fits', { outcome: null, state: 'retired', at: '2026-10-24T08:00', runs: 4 }]])
  const ran = readRow(join(root, 'fits.sks'), { runs, units: new Set(['E-x']) })
  assert.deepEqual([ran.last, ran.runs, ran.unit, ran.exam], ['retired 2026-10-24T08:00', 4, false, null])
  const odd = readRow(join(root, 'fits.sks'), { place: 'elsewhere' })
  assert.equal(odd.state, 'draft', 'a place the tree does not name is never serving')
  assert.equal(readRow(f('none', 'no header here')).name, 'none')
})

// spec: design §12.3 (headers are read as data) · inventory.mjs headerFields ("including the 3.0 fields readCart does not return")
// class: J7 hostile or malformed input (unreadable text, a first form that is not a header, a header that is text)
// technique: state-machine walk over the first form's shapes
// method: headerFields each; read the field map
// sre: can a malformed cart file stop the inventory from listing every other cart?
test('headerFields reads every field as written, and gives {} for text that does not read or does not open with a header', () => {
  assert.deepEqual(headerFields('(lacuna-cart'), {})
  assert.deepEqual(headerFields(null), {})
  assert.deepEqual(headerFields('(on \'x 1)'), {})
  assert.deepEqual(headerFields('(lacuna-cart \'x "text")'), {})
  assert.deepEqual(headerFields("(lacuna-cart 'x #f)"), {})
  assert.deepEqual(headerFields("(lacuna-cart 'x ((does . \"d\") (minds (l (job . pick))) (tags a b) (empty) loose))"),
    { does: 'd', minds: { l: { job: 'pick' } }, tags: ['a', 'b'], empty: null })
})

// spec: engineering §6 files (~/lacuna-world/foreman/workers/*.json; the foreman writes them) · design §12.3 (last run per cart)
// class: J7 hostile input (junk JSON, a record with no cart, no start time) · J11 fs ENOENT (no workers folder) · E14 records out of order
// technique: boundary — records written older-after-newer, with and without `started`, junk among them
// method: lastRuns over the scratch folder; read each cart's newest outcome, state, time and run count
// sre: if a worker record on disk is half-written after a crash, does the index still say when each cart last ran?
test('the last run per cart is the newest record whatever the file order; junk, plain workers and a missing folder are skipped', () => {
  assert.equal(lastRuns(join(U5_TMP, 'no-such-folder')).size, 0)
  const dir = tmp('workers')
  const put = (f, r) => writeFileSync(join(dir, f), typeof r === 'string' ? r : JSON.stringify(r))
  put('a.json', { state: 'retired', cart: { name: 'c', outcome: 'done', started: 2000 } })
  put('b.json', { state: 'retired', cart: { name: 'c', started: 1000 } })
  put('c.json', '{"state":')
  put('d.json', { state: 'running', started: 3000 })
  put('e.json', { state: 'grave', started: 500, cart: { name: 'z' } })
  put('f.json', { state: 'running', cart: { name: 'y' } })
  put('note.txt', 'not a record')
  const r = lastRuns(dir)
  assert.deepEqual(r.get('c'), { outcome: 'done', state: 'retired', at: new Date(2000_000).toISOString().slice(0, 16), t: 2000, runs: 2 })
  assert.deepEqual([r.get('z').outcome, r.get('z').t, r.get('y').t, r.size], [null, 500, 0, 3])
})
