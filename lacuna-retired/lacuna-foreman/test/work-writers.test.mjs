// work-writers.test.mjs — THE FOREMAN'S WORK ROWS (finale order §7 ruling 6, §10 row 5). Owns: the tests that a run (filed, a cart or a
// pausable worker) writes one `(work …)` row when they open and one when they close, through `host.work`, that only the foreman's done-check
// puts `pass` on a run (law 6), and that `livingRuns` carries the last row. Refuses: the live ledger (the fake host captures).
// Implements: order §10 row 5 ("wire the five writers"). Invariants (§18): "a claim is not a record". Faults (§16): none.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { livingRuns } from '../runs.mjs'
import { fileRun, intent, result, finishRun } from '../intents.mjs'
import { readWork } from '../work.mjs'

const workOf = (s) => { const lines = []; s.host.work = (t) => lines.push(t); return lines }

// spec: order §10 row 5 (the foreman's run end writes its row; started, updated, by) · law 6 (pass is the done-check's)
// method: file a run on the fake host, read the open row; finish it through the done-check, read the close row
test('a run writes its work row at filing and at its end, by the foreman, pass only from the done-check', () => {
  const { h, s } = makeSup(); const lines = workOf(s)
  const w = fileRun(s, { key: 'r-work', goal: 'free the disk', doneCheck: '(= hops 1)', by: 'owner' })
  assert.equal(lines.length, 1)
  const [open] = readWork(lines[0])
  assert.deepEqual([open.id, open.kind, open.by, open['asked-by'], open.doing, open.state, open.check], [w.id, 'run', 'foreman', 'owner', 'free the disk', 'running', 'none'])
  assert.ok(open.started && open.updated && !open.ended)
  assert.deepEqual(livingRuns(s).find((r) => r.id === w.id).work, { state: 'running', check: 'none', started: open.started, updated: open.updated, by: 'foreman' })
  const i = intent(s, w.id, { tool: 'disk' }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'disk', exit: 0 })
  h.tick(60)
  finishRun(s, w.id, { pass: true })
  assert.equal(lines.length, 2, 'one open row and one close row')
  const [end] = readWork(lines.join(''))
  assert.deepEqual([end.state, end.check, end.started], ['done', 'pass', open.started])
  assert.ok(end.ended && end.updated >= open.updated)
})

// spec: order §10 row 5 · law 6: a run that did not pass closes with fail or none, never pass
test('a run that fails or is stopped closes its row failed, never pass, and only once', () => {
  const { s } = makeSup(); const lines = workOf(s)
  const a = fileRun(s, { key: 'r-fail', goal: 'g', doneCheck: '(= hops 9)' })
  finishRun(s, a.id, { pass: true })   // the done-check does not hold: no pass
  const b = fileRun(s, { key: 'r-stop', goal: 'g' })
  s.stop(b.id, 'the owner stopped it'); s.stop(b.id, 'again')
  const rows = readWork(lines.join(''))
  assert.ok(rows.every((r) => r.check !== 'pass'))
  assert.equal(lines.filter((l) => l.includes(`(id "${b.id}")`) && l.includes('(ended ')).length, 1, 'one close row')
})

// spec: order §10 row 5 · WORDS-1.0 "job" (design §2.1): a cart is a run, not a job
test('a cart writes its open and close rows as kind run', () => {
  const { s } = makeSup(); const lines = workOf(s)
  const w = s.spawn({ name: 'cart:tidy', program: '(lacuna-cart \'tidy \'((does . "tidy the disk") (done . "the disk is tidy")))\n(on \'go (lambda (x) 1))' })
  assert.ok(w.cart, 'a cart worker')
  s.stop(w.id, 'done: tidy')
  const rows = readWork(lines.join(''))
  assert.equal(rows.length, 1)
  assert.deepEqual([rows[0].kind, rows[0].by, rows[0].doing], ['run', 'foreman', 'tidy the disk'])
  assert.ok(rows[0].ended)
})

test('a watch worker is not work and writes no row; a refusing work ledger is noted on the worker, never a stop', () => {
  const { s } = makeSup(); const lines = workOf(s)
  s.spawn({ name: 'watcher', program: '(on \'go (lambda (x) 1))', tier: 'watch' })
  assert.equal(lines.length, 0)
  s.host.work = () => { throw new Error('disk full') }
  const w = fileRun(s, { key: 'r-x', goal: 'g' })
  assert.equal(w.workError, 'disk full')
})
