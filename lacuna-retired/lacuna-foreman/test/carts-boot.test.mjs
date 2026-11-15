// carts-boot.test.mjs — THE CARTS AT BOOT, THE HAPPY ROAD (K7). Owns: the test that serving carts are scanned, indexed into
// the foreman's folder and spawned once by name; a broken header is a draft row. Refuses: the live world (a temp tree); a mock
// of carts.mjs. Implements: design §12.3 (index on load), §12.4 (the first five; three stand). Invariants (§18): "one living
// worker per serving cart". Faults (§16): F-02 (a header that does not read is a draft row, never spawned).
// coverage: carts.mjs — lines 100% branches 97.14% functions 100% (2026-10-24, the lane's files alone; one dead branch is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { loadCarts, cartRows, FIRST_FIVE, STANDING } from '../carts.mjs'

const CART = (name) => `(lacuna-cart '${name} '((does . "d") (done . "e") (version . 1) (restart . permanent) (deadlines . ((hand . 30))) (contract . ((goal . "g") (done-check . "c"))) (sentry . ()) (agent . ((tier . watch) (verbs . (on every report))))))
(every 60 (lambda () (report 'tick 1)))`
function host() { let t = 1000, n = 0; const letters = []; return { letters, now: () => t, id: () => `w${++n}`, save: () => {}, upstream: () => {}, mail: (m) => letters.push(m) } }

// spec: design §12.3 · §12.4 (three stand from boot) · carts.mjs (one living worker per serving cart)
// class: E10 a duplicate (a second load) · F-02 (a broken header is a draft)
// technique: state-machine walk: first load, second load, the default serve list
// method: loadCarts three times; read spawned, kept, refused, the index file, the letters and cartRows
// sre: does a reload ever start a second copy of a cart that is already running?
test('serving carts are spawned once by name; a broken one is a draft row; the index lands in the foreman folder', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'carts-')); const idx = fs.mkdtempSync(path.join(os.tmpdir(), 'idx-'))
  fs.writeFileSync(path.join(root, 'triggers.sks'), CART('triggers'))
  fs.writeFileSync(path.join(root, 'backup.sks'), CART('backup'))
  fs.writeFileSync(path.join(root, 'broken.sks'), `(lacuna-cart 'broken '((does . "d")))`)
  fs.mkdirSync(path.join(root, 'drafts')); fs.writeFileSync(path.join(root, 'drafts', 'idea.sks'), CART('idea'))
  const h = host(); const s = new Supervisor(h)
  const r = loadCarts(s, root, { indexDir: idx, serve: null })
  assert.deepEqual(r.spawned.sort(), ['backup', 'triggers']); assert.equal(r.refused.length, 0)
  const broken = r.rows.find((x) => x.name === 'broken'); assert.equal(broken.state, 'draft'); assert.ok(broken.problem, 'a header that does not read is a draft row carrying the refusal')
  assert.equal(h.letters.length, 0, 'a header that does not read is a draft row, not a letter')
  assert.ok(fs.existsSync(path.join(idx, 'INDEX.slat'))); assert.match(fs.readFileSync(path.join(idx, 'INDEX.slat'), 'utf8'), /\(index :v 1 :carts 4/)
  const again = loadCarts(s, root, { indexDir: idx, serve: null })
  assert.deepEqual(again.spawned, []); assert.deepEqual(again.kept.sort(), ['backup', 'triggers'])
  assert.equal(s.living().filter((w) => w.cart).length, 2)
  const five = loadCarts(s, root, { indexDir: idx })
  assert.deepEqual(five.kept.sort(), ['triggers'], 'the default serve list is the standing three; backup is filed by triggers')
  assert.deepEqual([...FIRST_FIVE].length, 5); assert.deepEqual([...STANDING], ['triggers', 'sentry-watch', 'forge-tender', 'watchdog-sweep', 'memory-audit'])
  const rows = cartRows(s, root)
  assert.equal(rows.find((x) => x.name === 'triggers').living.state, 'running'); assert.equal(rows.find((x) => x.name === 'idea').living, null)
  assert.ok(rows.every((x) => x.meaning === undefined))
})
