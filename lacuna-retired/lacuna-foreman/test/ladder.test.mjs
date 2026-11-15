// ladder.test.mjs — THE STEP LADDER (K1.2; SENTRY-2.0 §2 "step ladders", §6 chunking). Owns: the proofs that every ladder
// under `lacuna-foreman/ladders/` reads (one per playbook, steps 1 … N, every step with its four fields and a done form);
// that `readLadder` refuses a ladder with no playbook, steps out of order, a missing field, an op that is not a plain name,
// a done that names nothing; that a Markdown playbook's head fence round-trips through `ladderOf` and `withLadder` with the
// prose byte for byte; that `fits` and `rungFor` climb the rungs by the step's budget; that `window` names the step's calls,
// what to bring, what closes it and its budget; that `allowsSha` is stable and order-sensitive. Refuses: a mock of the
// module; the ladders read are the real files.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { LADDERS_DIR, RUNGS, SIZES, STEP_FIELDS, allowsSha, fits, ladderOf, loadLadder, loadLadders, readLadder, rungFor, window, withLadder } from '../ladder.mjs'

const ONE = `(ladder (playbook "DRILL") (version 2) (role operator)
  (step 1 (allows disk jobs) (gives (read "~/x.log" (kb 8)) (hand services) (text "look")) (done (receipt disk) (answer (names "GB"))) (budget (in 4096) (out 256) (s 120)) (says "Read the disk."))
  (step 2 (allows recall) (gives) (done (receipt recall (exit any) (file "*.md"))) (budget (in 8192) (out 1024) (s 60))))`

// spec: SENTRY-2.0 §2 · class: E · technique: the ten real files · method: each reads; steps 1 … N; four fields; a done
// sre: does every playbook the foreman runs carry a ladder it can read? (one bad file would stall its first run)
test('every ladder under ladders/ reads: one playbook each, steps in order, the four fields, a done form per step', () => {
  const files = fs.readdirSync(LADDERS_DIR).filter((f) => f.endsWith('.slat')).sort()
  assert.equal(files.length, 10, files.join(' '))
  const all = loadLadders()
  assert.deepEqual([...all.keys()], files.map((f) => path.basename(f, '.slat')))
  for (const [name, l] of all) {
    assert.equal(l.playbook, name, `${name}: the playbook field is the file's name`)
    assert.ok(l.steps.length >= 1, name)
    l.steps.forEach((s, i) => {
      assert.equal(s.n, i + 1, `${name} step ${s.n}`)
      for (const k of STEP_FIELDS) assert.ok(k in s || k === 'allows', `${name} step ${s.n} ${k}`)
      assert.ok(s.allows.length >= 1 && s.done.length >= 1, `${name} step ${s.n}: allows and done`)
      assert.ok(Number.isInteger(s.budget.in) && Number.isInteger(s.budget.out) && Number.isInteger(s.budget.s), `${name} step ${s.n}: budget`)
    })
  }
  assert.equal(loadLadder('watchdog-red').playbook, 'WATCHDOG-RED')
  assert.equal(loadLadder('WATCHDOG-RED.md').playbook, 'WATCHDOG-RED')
  assert.equal(loadLadder('no-such'), null)
  assert.equal(loadLadder('../etc/passwd'), null)
})

// spec: §2 the form · class: E · technique: one ladder with every kind of gives and done · method: read it back
test('readLadder reads gives (read, hand, text), done (receipt with exit and file; answer with names), budget and says', () => {
  const l = readLadder(ONE)
  assert.deepEqual([l.playbook, l.version, l.role], ['DRILL', 2, 'operator'])
  const [s1, s2] = l.steps
  assert.deepEqual(s1.allows, ['disk', 'jobs'])
  assert.deepEqual(s1.gives, [{ kind: 'read', path: '~/x.log', kb: 8 }, { kind: 'hand', op: 'services', args: [] }, { kind: 'text', text: 'look' }])
  assert.deepEqual(s1.done, [{ kind: 'receipt', op: 'disk', exit: 0, file: null }, { kind: 'answer', names: ['GB'] }])
  assert.deepEqual(s1.budget, { in: 4096, out: 256, s: 120 })
  assert.equal(s1.says, 'Read the disk.')
  assert.deepEqual(s2.done, [{ kind: 'receipt', op: 'recall', exit: 'any', file: '*.md' }])
  assert.equal(s2.says, null)
})

// spec: §2 "one sentence on a defect" · class: J7 hostile input · technique: seven wrong ladders · method: the sentences
test('readLadder refuses: no playbook, two forms, steps out of order, a missing field, an op that is not a name, an empty done, a bad budget', () => {
  const step = (n, body = '(allows disk) (gives) (done (receipt disk)) (budget (in 1) (out 1) (s 1))') => `(step ${n} ${body})`
  const bad = [
    [`(ladder (version 1) ${step(1)})`, /names its playbook/],
    [`(ladder (playbook "A") ${step(1)}) (ladder (playbook "B") ${step(1)})`, /exactly one/],
    [`(ladder (playbook "A") ${step(1)} ${step(3)})`, /step 2 is 3/],
    [`(ladder (playbook "A") (step 1 (allows disk) (done (receipt disk)) (budget (in 1) (out 1) (s 1))))`, /lacks \(gives/],
    [`(ladder (playbook "A") (step 1 (allows "rm -rf") (gives) (done (receipt disk)) (budget (in 1) (out 1) (s 1))))`, /plain names/],
    [`(ladder (playbook "A") (step 1 (allows disk) (gives) (done) (budget (in 1) (out 1) (s 1))))`, /at least one receipt or answer/],
    [`(ladder (playbook "A") (step 1 (allows disk) (gives) (done (receipt disk)) (budget (in 1) (out -2) (s 1))))`, /whole numbers/],
    [`(ladder (playbook "A"))`, /has no step/],
    ['(ladder (playbook "A"', /does not read/],
  ]
  for (const [text, re] of bad) assert.throws(() => readLadder(text), re, text.slice(0, 60))
})

// spec: §2 "the fence block at the head of a Markdown playbook" · class: E · technique: a playbook with and without a fence ·
// method: ladderOf finds only a head fence; withLadder replaces it and keeps the prose byte for byte
test('ladderOf reads only a head fence; withLadder puts one there and keeps the prose', () => {
  const prose = '# DISK\n\nBLUF: the disk is low.\n\n```slat\n(not a ladder)\n```\n'
  assert.equal(ladderOf(prose), null, 'a fence after the first heading is not the ladder')
  const withIt = withLadder(prose, ONE)
  assert.equal(ladderOf(withIt), ONE.trim())
  assert.ok(withIt.endsWith(prose))
  const again = withLadder(withIt, '(ladder (playbook "X") (step 1 (allows disk) (gives) (done (receipt disk)) (budget (in 1) (out 1) (s 1))))')
  assert.equal(readLadder(ladderOf(again)).playbook, 'X')
  assert.ok(again.endsWith(prose), 'the prose is the same bytes after a second fence')
  assert.equal(ladderOf('no fence at all'), null)
})

// spec: §6 chunking; ROLEBENCH §5.3 one climb per step · class: E · technique: three budgets against the size table · method: the rung
test('fits and rungFor climb the rungs by the step\'s budget; a budget no rung holds answers null', () => {
  const small = { n: 1, budget: { in: 700, out: 20, s: 1 } }
  const mid = { n: 2, budget: { in: 10000, out: 1500, s: 1 } }
  const huge = { n: 3, budget: { in: 10 ** 7, out: 1, s: 1 } }
  assert.equal(rungFor(small), RUNGS[0])
  assert.equal(rungFor(mid), 'e4b')
  assert.equal(rungFor(mid, 'e4b'), '12b', 'from e4b the next rung up')
  assert.equal(rungFor(huge), null)
  assert.deepEqual(fits(mid, 'e2b'), { ok: false, why: 'step 2 asks 10000 tokens in; the e2b holds 8192' })
  assert.deepEqual(fits({ n: 4, budget: { in: 1, out: 9000, s: 1 } }, '12b').ok, false)
  assert.deepEqual(fits(small, 'no-such-mind'), { ok: false, why: 'no size is known for the mind no-such-mind' })
  assert.equal(Object.keys(SIZES).length, RUNGS.length)
})

// spec: §2 the window · class: E · technique: the DRILL ladder · method: the lines; an unknown step throws
test('window names the step, its calls, what to bring, what closes it and its budget', () => {
  const l = readLadder(ONE)
  const w = window(l, 1, { brief: 'You are the operator.' })
  assert.equal(w.step, l.steps[0])
  assert.deepEqual(w.text.split('\n'), ['You are the operator.', 'Step 1 of 2 (DRILL): Read the disk.', 'You may call: disk jobs.',
    'Bring first: read ~/x.log (8 KB); services; look.', 'The step is done by a receipt of disk with exit 0, or an answer naming GB.', 'Budget: 4096 tokens in, 256 out, 120 s.'])
  assert.equal(window(l, 2).text.split('\n')[0], 'Step 2 of 2 (DRILL)')
  assert.throws(() => window(l, 3), /has no step 3/)
})

// spec: the ticket carries the hash of the step's allows · class: E · technique: two orders · method: stable, 64 hex, order-sensitive
test('allowsSha is sha256 of the allows as slat data: stable, order-sensitive', () => {
  const a = allowsSha(['disk', 'jobs'])
  assert.match(a, /^sha256:[0-9a-f]{64}$/)
  assert.equal(a, allowsSha(['disk', 'jobs']))
  assert.notEqual(a, allowsSha(['jobs', 'disk']))
  assert.equal(allowsSha([]), allowsSha(undefined))
})
