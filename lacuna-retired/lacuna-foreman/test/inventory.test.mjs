// inventory.test.mjs — THE CART INVENTORY, THE HAPPY ROAD. Owns: the tests of headers read as data, the deterministic index,
// one exam unit per exam id, the loose-file moves, retirement and the nearest-cart refusal over a temp tree. Refuses: the live
// world and the committed carts tree; a mock of inventory.mjs. Implements: design §12.3, §12.4, §7.9. Invariants (§18): "a claim
// is not a record" (a generated unit is curated: false). Faults (§16): F-02 (a duplicate cart refused, exit 12).
// coverage: inventory.mjs — lines 98.33% branches 99.12% functions 97.83% (2026-10-24, the lane's files alone; the CLI's --write is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, toJson } from '../scheme.mjs'
import {
  applyMoves, examUnits, headerFields, indexText, lastRuns, nearestCart, planMoves, refuseNear, retireCart, scanCarts,
} from '../inventory.mjs'

const cart = (name, does, { tier = 'watch', verbs = 'on hand report done', extra = '', exam = `U-${name}` } = {}) => `(lacuna-cart '${name}
  '((does . "${does}")
    (version . 2)
    (restart . permanent)
    (deadlines . ((hand . 120) (cart . 600)))
    (contract . ((goal . "${does}") (done-check . "one pass read")))
    (sentry . #f)
    (agent . ((tier . ${tier}) (verbs . (${verbs}))))${extra}
    (done . "one pass read")
    (exam . ${exam})))
(define (start) (hand 'disk))
(on 'hand (lambda (r) (done "one pass read")))
`

function tree() {
  const root = mkdtempSync(join(tmpdir(), 'inv-'))
  for (const d of ['drafts', 'attic', 'desk', 'templates']) mkdirSync(join(root, d))
  writeFileSync(join(root, 'disk-watch.sks'), cart('disk-watch', 'reads the disk and says how full it is'))
  writeFileSync(join(root, 'port-watch.sks'), cart('port-watch', 'says which program listens on each of our ports'))
  writeFileSync(join(root, 'broken.sks'), `(lacuna-cart 'broken '((does . "x") (agent . ((tier . watch) (verbs . (on))))))`)
  writeFileSync(join(root, 'drafts', 'idea.sks'), cart('idea', 'a draft that is never loaded unattended'))
  writeFileSync(join(root, 'attic', 'old.v1.sks'), cart('old', 'a retired cart', { exam: 'U-old' }))
  writeFileSync(join(root, 'templates', 'tpl.sks'), cart('tpl', 'a template', { exam: 'U-tpl' }))
  writeFileSync(join(root, 'release.sks.v1-2026-10-19'), cart('release', 'an old release'))
  writeFileSync(join(root, 'shepherd.sks.draft'), cart('shepherd', 'a draft shepherd'))
  return root
}

// spec: design §12.1 (version restart deadlines contract sentry) · §12.3
// class: W5 shapes of input (alists, a #f sentry)
// technique: a header with every 3.0 field
// method: headerFields; read each field
// sre: does the index read the 3.0 fields as the header wrote them?
test('the 3.0 header fields are read as data: version, restart, deadlines and contract as alists, sentry', () => {
  const f = headerFields(cart('disk-watch', 'reads the disk'))
  assert.equal(f.version, 2)
  assert.equal(f.restart, 'permanent')
  assert.deepEqual(f.deadlines, { hand: 120, cart: 600 })
  assert.deepEqual(f.contract, { goal: 'reads the disk', 'done-check': 'one pass read' })
  assert.equal(f.sentry, false)
  assert.deepEqual(headerFields("(on 'x (lambda (v) v))"), {})
  assert.deepEqual(headerFields('(lacuna-cart'), {})
})

// spec: design §12.3 (serving · draft · retired · template; drafts/ attic/ desk/ templates/) · F-02
// class: F-02 a header that does not read is a draft
// technique: a temp tree with every place
// method: scanCarts; read each row's state and problem
// sre: can a draft or a broken cart ever be listed as serving?
test('a tree is scanned by place: serving, draft, retired, template; a header that does not read is a draft with its sentence', () => {
  const rows = scanCarts(tree(), { units: new Set(['U-disk-watch']) })
  const by = Object.fromEntries(rows.map((r) => [r.name, r]))
  assert.equal(by['disk-watch'].state, 'serving')
  assert.equal(by['disk-watch'].unit, true)
  assert.equal(by['port-watch'].unit, false)
  assert.equal(by.broken.state, 'draft')
  assert.match(by.broken.problem, /says what it is done at/)
  assert.equal(by.idea.state, 'draft')
  assert.equal(by.old.state, 'retired')
  assert.equal(by.tpl.state, 'template')
  assert.deepEqual(by['disk-watch'].missing, [])
  assert.deepEqual(by.broken.missing, ['version', 'restart', 'deadlines', 'contract', 'sentry'])
  assert.equal(by['disk-watch'].author, 'claude')
  assert.equal(rows.some((r) => r.name === 'release'), false)        // a loose versioned file is not a cart until it moves
})

// spec: design §12.3 (regenerated deterministically) · §7 (slat)
// class: L5 the index's shape · J15 bytes (each line one form)
// technique: repeated generation over one tree
// method: indexText twice; parse every line back
// sre: does the same set of carts always give the same index bytes (no clock in it)?
test('INDEX.slat is deterministic and every line reads back as one form', () => {
  const root = tree()
  const a = indexText(scanCarts(root))
  const b = indexText(scanCarts(root))
  assert.equal(a, b)
  const forms = toJson(parse(a))
  assert.equal(forms[0][0], 'index')
  assert.equal(forms.length, 1 + scanCarts(root).length)
  const dw = forms.find((f) => f[0] === 'cart' && f[2] === 'disk-watch')
  assert.ok(dw, 'the disk-watch row is in the index')
  assert.equal(dw[dw.indexOf(':version') + 1], 2)
  assert.doesNotMatch(a, /does|reads the disk/)                       // the meaning text stays in memory
})

// spec: design §12.4 · §7.9 (exam units) · law 6
// class: L5 · law 6 (a generated unit is never a passed exam)
// technique: rows with curated, generated and template ids
// method: examUnits; read each unit's curated flag
// sre: can a generated exam unit be mistaken for a curated one?
test('one exam unit per exam id: a curated unit as written, any other id generated and marked uncurated; templates skipped', () => {
  const rows = scanCarts(tree())
  const units = examUnits(rows, { 'U-disk-watch': { class: 'fixture', input: 'test/fixtures/disk.json', expect: 'pass', check: 'the free line is said', gold: true } })
  const ids = units.map((u) => u.id)
  assert.deepEqual(ids, [...ids].sort())
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(ids.includes('U-tpl'), false)
  const dw = units.find((u) => u.id === 'U-disk-watch')
  assert.equal(dw.curated, true)
  assert.equal(dw.cart, 'disk-watch')
  assert.equal(dw.gold, true)
  const pw = units.find((u) => u.id === 'U-port-watch')
  assert.equal(pw.curated, false)
  assert.equal(pw.gold, false)
  for (const u of units) for (const k of ['id', 'cart', 'class', 'input', 'expect', 'check', 'gold']) assert.ok(k in u, `${u.id} has ${k}`)
})

// spec: design §12.3 (drafts/ and attic/; nothing overwritten)
// class: J11 EEXIST (a target that exists)
// technique: a temp tree with loose files
// method: planMoves and applyMoves; read the tree
// sre: can tidying the tree overwrite a file?
test('the loose files move: a .draft into drafts/, a kept version into attic/, and a move never overwrites', () => {
  const root = tree()
  const moves = planMoves(root)
  assert.deepEqual(moves.map((m) => m.to.slice(root.length + 1)).sort(), ['attic/release.v1.sks', 'drafts/shepherd.sks'])
  writeFileSync(join(root, 'drafts', 'shepherd.sks'), 'held')
  assert.throws(() => applyMoves(moves), /would overwrite .*shepherd.sks; nothing was moved/)
  assert.equal(existsSync(join(root, 'release.sks.v1-2026-10-19')), true)
  const clean = tree()
  assert.equal(applyMoves(planMoves(clean)), 2)
  assert.deepEqual(planMoves(clean), [])
  assert.equal(scanCarts(clean).find((r) => r.name === 'release').state, 'retired')
})

// spec: design §12.3 (retire on successor, idle, or press)
// class: J11 EEXIST (a second retire)
// technique: retire twice
// method: retireCart; read the attic file and the refusal
// sre: can retiring a cart twice destroy the first retired copy?
test('a retired cart goes to attic/<name>.v<N>.sks with a dated line; a second retire of the same version is refused', () => {
  const root = tree()
  const to = retireCart(root, 'port-watch', 'disk-watch passes the same exam', '2026-10-23')
  assert.ok(to.endsWith('attic/port-watch.v2.sks'))
  assert.match(readFileSync(to, 'utf8'), /^;; retired 2026-10-23: disk-watch passes the same exam\n\(lacuna-cart 'port-watch/)
  assert.equal(existsSync(join(root, 'port-watch.sks')), false)
  assert.throws(() => retireCart(root, 'port-watch', 'again', '2026-10-23'), /no serving cart port-watch/)
})

// spec: design §12.3 (nearest-cart refusal at 0.85) · F-02 exit 12
// class: B7 a bound at its edge
// technique: a near and a far candidate, with and without an embedder
// method: refuseNear; read the exit and the sentence
// sre: does a near-copy of a serving cart get refused before it serves?
test('a candidate within 0.85 of a serving cart is refused with exit 12; a different one passes; an embedder is used when given', async () => {
  const rows = scanCarts(tree())
  await assert.rejects(refuseNear(cart('disk-watch-2', 'reads the disk and says how full it is'), rows),
    (e) => e.exit === 12 && /already serves: disk-watch \(similarity 1 by words\); extend it/.test(e.message))
  const ok = await refuseNear(cart('mail-reader', 'counts the mail notes waiting for claude by sender'), rows)
  assert.ok(ok.similarity < 0.85)
  assert.equal(ok.by, 'words')
  const seen = []
  const embed = async (texts) => { seen.push(texts.length); return texts.map((t, i) => (i === 0 || /ports/.test(t) ? [1, 0] : [0, 1])) }
  const near = await nearestCart('which program holds a port', rows, { embed })
  assert.deepEqual([near.name, near.similarity, near.by], ['port-watch', 1, 'embedding'])
  assert.equal(seen[0], 1 + rows.filter((r) => r.state === 'serving').length)
})

// spec: design §12.3 (last run) · engineering §6 (workers/*.json)
// class: E14 records out of order
// technique: a temp workers folder
// method: lastRuns; read the newest and the count
// sre: does the index say when each cart last ran?
test('the last run of each cart comes from the worker records: the newest wins and runs are counted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workers-'))
  writeFileSync(join(dir, 'a.json'), JSON.stringify({ state: 'retired', cart: { name: 'ipad-verify', outcome: 'done', started: 1792766389 } }))
  writeFileSync(join(dir, 'b.json'), JSON.stringify({ state: 'retired', cart: { name: 'ipad-verify', outcome: 'stopped', started: 1792700000 } }))
  writeFileSync(join(dir, 'c.json'), JSON.stringify({ state: 'running', name: 'plain-worker' }))
  writeFileSync(join(dir, 'd.json'), '{not json')
  const runs = lastRuns(dir)
  assert.equal(runs.size, 1)
  assert.equal(runs.get('ipad-verify').outcome, 'done')
  assert.equal(runs.get('ipad-verify').runs, 2)
  assert.equal(lastRuns(join(dir, 'absent')).size, 0)
})
