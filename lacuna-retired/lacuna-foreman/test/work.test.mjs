// work.test.mjs — the work record (finale order §7 ruling 6): one form, each kind's writer, the foreman's pass, the fold.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { appendWork, OWNERS, readWork, workForm } from '../work.mjs'

const at = '2026-11-06T19:00:00Z'

test('each kind is written by its owner and refused from anyone else', () => {
  for (const [kind, by] of Object.entries(OWNERS)) {
    assert.match(workForm({ id: `${kind}-1`, kind, started: at, state: 'running' }, by), new RegExp(`^\\(work \\(id "${kind}-1"\\) \\(kind ${kind}\\)`))
    const other = by === 'ci' ? 'bench' : 'ci'
    assert.throws(() => workForm({ id: 'x', kind, started: at }, other), /does not write/)
  }
})

test('pass on a run is the foreman\'s alone (law 6); a turn may carry none', () => {
  assert.match(workForm({ id: 'r1', kind: 'run', started: at, state: 'done', check: 'pass' }, 'foreman'), /\(check pass\)/)
  assert.throws(() => workForm({ id: 'r1', kind: 'run', started: at, check: 'pass' }, 'frontend'))
  assert.match(workForm({ id: 't1', kind: 'turn', started: at }, 'frontend'), /\(check none\)/)
})

test('a kind, a state or a check outside the lists is refused, and so is a row without an id', () => {
  assert.throws(() => workForm({ id: 'x', kind: 'eval', started: at }, 'foreman'), /kind eval/)
  assert.throws(() => workForm({ id: 'x', kind: 'run', started: at, state: 'thinking' }, 'foreman'), /state thinking/)
  assert.throws(() => workForm({ id: 'x', kind: 'run', started: at, check: 'ok' }, 'foreman'), /check ok/)
  assert.throws(() => workForm({ kind: 'run', started: at }, 'foreman'), /needs an id/)
})

test('the ledger appends slat and folds each id to its latest row', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'work-')), 'work.slat')
  appendWork({ id: 'r1', kind: 'run', 'asked-by': 'owner', doing: 'fix the disk', state: 'running', started: at }, { by: 'foreman', file })
  appendWork({ id: 'c1', kind: 'ci', doing: 'build/1.0 at 05a0be69', state: 'queued', parent: 'r1', started: at }, { by: 'ci', file })
  appendWork({ id: 'r1', kind: 'run', state: 'done', check: 'pass', started: at, ended: at }, { by: 'foreman', file })
  const rows = readWork(fs.readFileSync(file, 'utf8'))
  assert.deepEqual(rows.map((r) => [r.id, r.state, r.check, r.doing]), [['r1', 'done', 'pass', 'fix the disk'], ['c1', 'queued', 'none', 'build/1.0 at 05a0be69']])
  assert.equal(rows[1].parent, 'r1')
  assert.ok(!/[{}]/.test(fs.readFileSync(file, 'utf8')), 'no JSON in the ledger (law 12)')
})

test('a row carries its writer, its start and its update; the fold keeps the start a later row repeats', () => {
  const line = workForm({ id: 'r9', kind: 'run', started: 1793581200, updated: 1793581260 }, 'foreman')
  assert.match(line, /^\(work \(id "r9"\) \(kind run\) \(by foreman\) \(state |^\(work \(id "r9"\) \(kind run\) \(by foreman\) \(check none\)/)
  assert.match(line, /\(started "2026-[^"]+"\) \(updated "2026-[^"]+"\)\)$/)
  assert.throws(() => workForm({ id: 'r9', kind: 'run' }, 'foreman'), /a start/)
  assert.deepEqual(readWork(line).map((r) => r.by), ['foreman'])
})

// spec: the design's §7 and P7's last part (the work row's expect): a run filed with an order's expectation carries it on its work
// row, one sentence, so the sentry and the floor read what the run was to achieve · class: L5 the record · technique: the form alone
// · method: a row with expect writes it; a row without writes no field · sre: can the floor say what a run expects without the contract?
test('a work row carries the order\'s expectation when the run has one, and no field when it does not', () => {
  const at = '2026-11-06T22:00:00.000Z';
  const withIt = workForm({ id: 'w-1', kind: 'run', started: at, state: 'running', expect: 'the failing test passes' }, 'foreman');
  assert.match(withIt, /\(expect "the failing test passes"\)/);
  const without = workForm({ id: 'w-2', kind: 'run', started: at, state: 'running' }, 'foreman');
  assert.doesNotMatch(without, /\(expect /);
});
