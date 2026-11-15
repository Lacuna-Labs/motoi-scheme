// carts-load.test.mjs — THE CARTS AT BOOT WHEN SOMETHING GOES WRONG. Owns: the tests of carts.mjs `loadCarts` and
// `cartRows` when the index folder cannot be written (J11), units.json is missing or junk, a serving cart lives in desk/,
// a cart's header reads but its body crashes at load, and the foreman refuses to spawn (hushed under memory pressure).
// Refuses: the live world and the committed carts tree (every tree is a scratch tree under /private/tmp/lacuna-unit/U5);
// a mock of carts.mjs (the Supervisor is real; the host captures mail). Implements: work order U5 §3; design §12.3 (the
// index regenerated on load), §12.4 (the first five; one living worker per serving cart), §7.6 (mail: self-report, sick),
// law 7 (no secrets in a letter). Invariants (§18): "one living worker per serving cart" (carts.mjs header). Faults (§16):
// F-02 (a cart that does not load is refused with its sentence), F-04 (a body that crashes at load is the grave), F-20
// (the foreman hushes at 400 MB; a cart is refused, not lost).
// coverage: carts.mjs — lines 100% branches 97.14% functions 100% (2026-10-24, the lane's files alone; one dead branch is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { loadCarts, cartRows } from '../carts.mjs'
import { U5_TMP } from './fixtures/u5-door.mjs'

const tmp = (p) => { mkdirSync(U5_TMP, { recursive: true }); return mkdtempSync(join(U5_TMP, `${p}-`)) }
const CART = (name, body = "(every 60 (lambda () (report 'tick 1)))", exam = '') => `(lacuna-cart '${name} '((does . "watches ${name}") (done . "one pass") ${exam}
  (agent . ((tier . watch) (verbs . (on every report))))))
${body}`
function host(o = {}) {
  let n = 0
  const letters = []
  return { letters, now: () => 1000, id: () => `w${++n}`, save: () => {}, upstream: () => {}, mail: (m) => letters.push(m), ...o }
}

// spec: design §12.3 (INDEX.slat and units.jsonl written on load) · engineering §6 (the foreman's folder) · §12.4 (the carts still serve)
// class: J11 fs ENOTDIR/EISDIR (the index folder is a file; units.jsonl is a folder) · E11 a failed write must not orphan the carts
// technique: fault injection on the file system: indexDir is a regular file; then units.jsonl is a directory
// method: loadCarts; read the log lines, that the carts spawned anyway, and what was (not) written
// sre: if the foreman's own folder is broken, do the standing carts still start, and does the log say what was not written?
test('an index folder that cannot be written is one log line each for INDEX.slat and units.jsonl; the carts spawn anyway', () => {
  const root = tmp('idx')
  writeFileSync(join(root, 'triggers.sks'), CART('triggers'))
  const asFile = join(root, 'not-a-dir')
  writeFileSync(asFile, 'x')
  const log = []
  const s = new Supervisor(host())
  const r = loadCarts(s, root, { indexDir: asFile, serve: null, log: (...a) => log.push(a.join(' ')) })
  assert.deepEqual(r.spawned, ['triggers'])
  assert.match(log[0], /^could not write INDEX\.slat: EEXIST|^could not write INDEX\.slat: ENOTDIR/)
  assert.match(log[1], /^could not write units\.jsonl: ENOTDIR/)
  assert.equal(log[2], 'carts: 1 indexed, 1 spawned (triggers), 0 already living, 0 refused')
  const idx = tmp('idx-ok')
  mkdirSync(join(idx, 'units.jsonl'))
  const log2 = []
  loadCarts(new Supervisor(host()), root, { indexDir: idx, serve: [], log: (...a) => log2.push(a.join(' ')) })
  assert.match(readFileSync(join(idx, 'INDEX.slat'), 'utf8'), /^;; carts\/INDEX\.slat/)
  assert.match(log2[0], /^could not write units\.jsonl: EISDIR/)
  assert.equal(log2[1], 'carts: 1 indexed, 0 spawned (-), 0 already living, 0 refused')
})

// spec: design §12.4 ("exam/units.jsonl is written from the headers"; a curated unit as written) · §7.9 · law 6 (a generated unit is not an exam)
// class: J7 junk JSON (units.json that does not parse) · J11 ENOENT (no units.json) · L5 the unit row's shape
// technique: state-machine walk over the three states of carts/units.json: curated, junk, absent
// method: loadCarts with an indexDir; read units.jsonl line by line; assert curated true only where units.json named the id
// sre: if someone breaks units.json, does every exam silently look curated, or does each say it is generated?
test('units.jsonl takes a curated unit as written, and with units.json junk or absent marks every unit generated', () => {
  for (const [label, units, curated] of [['curated', JSON.stringify({ 'E-t': { class: 'kick', input: 1, expect: 'kick', check: 'c', gold: true } }), true],
                                          ['junk', '{"E-t": ', false], ['absent', null, false]]) {
    const root = tmp(`units-${label}`)
    writeFileSync(join(root, 'triggers.sks'), CART('triggers', undefined, '(exam . E-t)'))
    if (units != null) writeFileSync(join(root, 'units.json'), units)
    const idx = tmp(`units-${label}-idx`)
    loadCarts(new Supervisor(host()), root, { indexDir: idx, serve: [] })
    const rows = readFileSync(join(idx, 'units.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    assert.deepEqual(rows.map((u) => [u.id, u.cart, u.curated]), [['E-t', 'triggers', curated]], label)
  }
})

// spec: design §12.4 (one living worker per serving cart) · §12.3 (desk/ is a serving place) · F-04 (a load that crashes is the grave)
// · F-20 (the foreman hushes; spawn refused) · §7.6 (mail kind self-report, severity sick, `run` the cart's name)
// class: E1 a handler throws at load · M6 memory pressure (a hushed foreman) · E10 a duplicate (a second load keeps the first)
// technique: fault injection — a body that throws at load; a host whose manners() hushes the foreman; then the same tree twice
// method: loadCarts; read spawned, kept, refused with their sentences, and the letters (one per refusal, never a token)
// sre: when a cart cannot start at boot, does someone get one letter that says which cart and why, and the others still run?
test('a cart that crashes at load or meets a hushed foreman is refused with a letter; a desk/ cart serves; a second load keeps them', () => {
  const root = tmp('load')
  mkdirSync(join(root, 'desk'))
  writeFileSync(join(root, 'crash.sks'), CART('crash', "(car '())"))
  writeFileSync(join(root, 'desk', 'deskcart.sks'), CART('deskcart'))
  writeFileSync(join(root, 'ok.sks'), CART('ok'))
  const h = host()
  const s = new Supervisor(h)
  const r = loadCarts(s, root, { serve: null })
  assert.deepEqual(r.spawned.sort(), ['deskcart', 'ok'])
  assert.deepEqual(r.refused.map((x) => x.name), ['crash'])
  assert.match(r.refused[0].why, /^load: /)
  assert.deepEqual(h.letters.map((m) => [m.kind, m.severity, m.run]), [['self-report', 'sick', 'crash']])
  assert.match(h.letters[0].what, /^cart crash did not load: load: /)
  const again = loadCarts(s, root, { serve: null })
  assert.deepEqual([again.spawned, again.kept.sort()], [[], ['deskcart', 'ok']])
  // a hushed foreman refuses new work, never the on-call loop (E14 row 11, cart.mjs onCall): the mindless watch cart starts,
  // the act cart waits with its letter
  writeFileSync(join(root, 'mover.sks'), CART('mover').replace('(tier . watch) (verbs . (on every report))', '(tier . act) (verbs . (on every report))'))
  const hushed = host({ manners: () => 'memory 410 MB over 400 MB' })
  const r2 = loadCarts(new Supervisor(hushed), root, { serve: ['ok', 'mover'] })
  assert.deepEqual(r2.spawned, ['ok'])
  assert.deepEqual(r2.refused, [{ name: 'mover', why: 'not now — the foreman is hushed: memory 410 MB over 400 MB' }])
  assert.equal(hushed.letters[0].what, 'cart mover refused at load: not now — the foreman is hushed: memory 410 MB over 400 MB')
  assert.ok(h.letters.concat(hushed.letters).every((m) => !/token|key|sk-/.test(m.text)), 'law 7: no secret in a letter')
})

// spec: design §13 (the desk's GET /carts: rows, never the programs) · §12.3 · carts.mjs cartRows
// class: W7 a body with a secret (the program and its meaning never leave in a row) · J13 tables unset
// technique: a scratch tree with one living and one draft cart; cartRows without tables
// method: read each row's living field and that no row carries the meaning text or the program
// sre: does the desk's carts list show which carts are alive without shipping their source code to the phone?
test('the desk\'s rows say which cart lives and carry neither its program nor its meaning text', () => {
  const root = tmp('rows')
  writeFileSync(join(root, 'ok.sks'), CART('ok', "(every 60 (lambda () (report 'tick \"sk-live-secret\")))"))
  mkdirSync(join(root, 'drafts'))
  writeFileSync(join(root, 'drafts', 'idea.sks'), CART('idea'))
  const s = new Supervisor(host())
  loadCarts(s, root, { serve: null })
  const rows = cartRows(s, root)
  assert.deepEqual(rows.map((r) => [r.name, r.living && r.living.state]), [['ok', 'running'], ['idea', null]])
  assert.ok(rows.every((r) => r.meaning === undefined && !JSON.stringify(r).includes('sk-live-secret')))
})

