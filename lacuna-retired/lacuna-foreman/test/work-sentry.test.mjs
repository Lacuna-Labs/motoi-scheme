// work-sentry.test.mjs — THE WORK SENTRY BY WORK TYPE (O25). Owns: the tests that a run gets the sentry of its work type, that
// the patch triggers refuse before the act goes out (commit before passing tests, past 500 lines, a skipped or deleted test,
// an empty write), that a test-write run's test needs an assertion, that a run's "tests pass" is checked against its
// test-run, and that every finding writes a labeled line for the domain's 1B. Refuses: a mock of the sentry.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attach, beforeIntent, afterResult, finishCheck, domainOf, DOMAINS } from '../work-sentry.mjs'

const run = (role, goal = '') => { const w = { id: 'w1', run: { role } }; attach(w, goal); return w }

test('each run gets its work type: engineer and coder patch; a desk turn gets none; goals pick the rest', () => {
  assert.equal(run('engineer').workSentry.domain, 'patch')
  assert.equal(run('coder').workSentry.domain, 'patch')
  assert.equal(domainOf({ desk: true, role: 'desk' }), null)
  assert.equal(domainOf({ role: 'worker' }, 'write unit tests for prune.mjs'), 'test-write')
  assert.equal(domainOf({ role: 'cart' }), 'cart-step')
  for (const d of Object.values(DOMAINS)) assert.ok(d.triggers.length && d.labels.includes('unsure'), 'every domain has triggers and an honest null')
})

test('a commit before a passing test-run is refused; after one it goes', () => {
  const w = run('engineer')
  assert.match(beforeIntent(w, 'git-commit', ['fix']).why, /no test-run yet/)
  afterResult(w, { tool: 'test-run', value: { exit: 1 } })
  assert.match(beforeIntent(w, 'git-commit', ['fix']).why, /failed/)
  afterResult(w, { tool: 'test-run', value: { exit: 0 } })
  assert.equal(beforeIntent(w, 'git-commit', ['fix']).ok, true)
})

test('a write past 500 lines, a skipped test, a deleted test and an empty write are refused before they go out', () => {
  const w = run('engineer')
  assert.match(beforeIntent(w, 'patch', { edits: [{ file: 'a.mjs', write: 'x\n'.repeat(600) }] }).why, /60\d lines.*split/)
  assert.equal(beforeIntent(w, 'patch', { edits: [{ file: 'notes.md', write: 'x\n'.repeat(600) }] }).ok, true, 'a document is not a module')
  assert.match(beforeIntent(w, 'patch', { edits: [{ file: 'test/a.test.mjs', write: "test.skip('x', () => {})" }] }).why, /skips a test/)
  assert.match(beforeIntent(w, 'patch', { edits: [{ file: 'a.mjs', write: 'ok' }], delete: ['test/a.test.mjs'] }).why, /deleted/)
  assert.match(beforeIntent(w, 'patch', { edits: [{ file: 'a.mjs', write: '  ' }] }).why, /empty/)
  assert.equal(beforeIntent(w, 'patch', { edits: [{ file: 'a.mjs', write: 'export const a = 1\n' }] }).ok, true)
})

test('a test-write run\'s test needs an assertion', () => {
  const w = run('worker', 'write unit tests for prune')
  assert.match(beforeIntent(w, 'patch', { edits: [{ file: 'test/p.test.mjs', write: "test('p', () => { prune([]) })" }] }).why, /no assertion/)
  assert.equal(beforeIntent(w, 'patch', { edits: [{ file: 'test/p.test.mjs', write: "test('p', () => { assert.equal(prune([]).length, 0) })" }] }).ok, true)
})

test('"tests pass" in the run\'s words is checked against its test-run', () => {
  const w = run('engineer')
  assert.match(finishCheck(w, 'Fixed it; all tests pass.').detail, /no test-run ran/)
  afterResult(w, { tool: 'test-run', value: { exit: 0 } })
  assert.equal(finishCheck(w, 'Fixed it; all tests pass.'), null)
})

test('every finding writes a labeled line for the domain\'s exam, eval-only (law 9: never diffs of our repos as training)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'))
  const w = run('engineer')
  beforeIntent(w, 'git-commit', ['fix'], { dir, now: 5 })
  const line = JSON.parse(fs.readFileSync(path.join(dir, 'sentry', 'work', 'patch.jsonl'), 'utf8').trim())
  assert.deepEqual([line.domain, line.label, line.by, line.use], ['patch', 'commit-before-tests', 'code', 'eval-only'])
})

test('a run with no work type is left alone', () => {
  const w = { id: 'd', run: { desk: true } }
  attach(w)
  assert.equal(beforeIntent(w, 'git-commit', []).ok, true)
  assert.equal(finishCheck(w, 'tests pass'), null)
})
