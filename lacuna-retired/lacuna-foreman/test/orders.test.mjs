// orders.test.mjs — THE OWNER'S SCHEME (O20, O21). Owns: the tests that one owner form runs as a worker and reports its value,
// that a hand reply comes back as the do's reply, that a broken form is refused with its sentence, and that standing orders
// load once by name from the orders folder. Refuses: a mock of the supervisor.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Supervisor } from '../supervisor.mjs'
import { runDo, doResult, loadOrders, doProgram } from '../orders.mjs'

function sup() {
  let t = 1000, n = 0
  const up = []
  const host = { deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 }, now: () => t, id: () => `w${++n}`, save: () => {}, contract: () => {}, upstream: (k, w, d) => up.push({ k, d }) }
  return { s: new Supervisor(host), up }
}

test('one owner form runs and reports its value', () => {
  const { s } = sup()
  const w = runDo(s, '(+ 40 2)')
  assert.equal(doResult(w).value, 42)
  assert.equal(w.name.startsWith('do:'), true)
})

test('a hand in a form goes up through the foreman like any worker\'s', () => {
  const { s, up } = sup()
  runDo(s, "(hand 'disk)")
  assert.ok(up.some((u) => u.k === 'hand' && u.d.op === 'disk'))
})

test('a form that does not read is refused with its sentence; an empty one is refused at once', () => {
  const { s } = sup()
  const r = doResult(runDo(s, '(+ 1'))
  assert.equal(r.ok, false); assert.ok(r.why)
  assert.throws(() => doProgram('  '), /one Scheme form/)
})

test('standing orders load once by name; a broken file is refused, the rest run', () => {
  const { s } = sup()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orders-'))
  fs.writeFileSync(path.join(dir, 'hourly-disk.scm'), "(every 3600 (lambda () (hand 'disk)))")
  fs.writeFileSync(path.join(dir, 'broken.scm'), '(every')
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not an order')
  const a = loadOrders(s, dir)
  assert.deepEqual(a.spawned, ['order:hourly-disk'])
  assert.equal(a.refused[0].name, 'order:broken')
  assert.deepEqual(loadOrders(s, dir).kept, ['order:hourly-disk'], 'never twice')
})
