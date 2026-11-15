// assign.test.mjs — unit tests for `assign.mjs`, the load balancer's one decision (MINDS §4.3, §7.1; work order A16).
// owns: the proofs that the lowest rung meeting the SLO in role is picked; that a bare-question row never qualifies; that a
//   warm mind wins a tie; that the pick climbs and says so when nothing meets; that residency state excludes a mind; that
//   no index is the honest null; that the served row records the climb. refuses: a mock of assign.mjs; fixtures are files.
// implements: MINDS §4.3, §7.1. invariants: "if a mind served a class, then its row met the SLO or the served row says climb". faults: F-A1.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadIndex, assign, servedRow, rungOf, RUNGS } from '../assign.mjs'

const DIR = new URL('./fixtures/assign/', import.meta.url).pathname
const index = loadIndex({ mindsDir: DIR + 'minds', jobsDir: DIR + 'jobs' })

// spec: MINDS §4.3 "the lowest-level resident mind whose exam row meets the job's SLO" · §7.1 in role only
test('the index reads; the lowest rung meeting the SLO in role is picked, a bare row never qualifies', () => {
  assert.equal(index.minds.length, 5); assert.equal(index.jobs.size, 2); assert.equal(index.why, null)
  assert.deepEqual(index.minds.map((m) => [m.id, m.rung]).sort(), [['base/12b@0', RUNGS.indexOf('12b')], ['base/270m@0', 0], ['base/e2b@0', RUNGS.indexOf('e2b')], ['sentry/1b@3', RUNGS.indexOf('1b')], ['sentry/270m@4', 0]].sort())
  const p = assign('signal->label', index, { state: 'a' })
  assert.equal(p.mind.id, 'sentry/1b@3'); assert.equal(p.climb, false); assert.equal(p.recall, 0.93); assert.equal(p.level, 'L1')
  assert.match(p.why, /sentry\/1b@3 meets signal->label at recall 0.93 ≥ 0.9 \(L1, in role\)/)
})

// spec: MINDS §4.3 affinity: a warm mind wins a tie on the same rung · technique: two 270Ms on rung 0, one loaded
test('a warm mind wins a tie on the same rung; the SLO still decides first', () => {
  const low = { ...index, jobs: new Map([['signal->label', { class: 'signal->label', slo: { pass: 0.5 }, may: ['270m', '1b'], level: 'L3' }]]) }
  const cold = assign('signal->label', low, { state: 'a' })
  assert.equal(cold.mind.id, 'sentry/270m@4')                       // 0.51 ≥ 0.5 on the lowest rung; base/270m@0 is 0.0
  const warm = assign('signal->label', low, { state: 'a', loaded: ['gemma3:1b-it-q8_0'] })
  assert.equal(warm.mind.id, 'sentry/270m@4', 'a lower rung that meets the SLO beats a warm higher one')
  assert.match(cold.why, /sentry\/270m@4 meets/); assert.doesNotMatch(cold.why, /warm/)
})

// spec: MINDS §4.3 the climb is counted · §7.1 · technique: raise the SLO past every row
test('when nothing meets the SLO the pick climbs to the lowest mind with an in-role row and says so', () => {
  const hard = { ...index, jobs: new Map([['signal->label', { class: 'signal->label', slo: { pass: 0.99 }, may: ['270m', '1b', 'e2b'], level: 'L3' }]]) }
  const p = assign('signal->label', hard, { state: 'a' })
  assert.equal(p.climb, true); assert.equal(p.mind.id, 'base/270m@0'); assert.match(p.why, /no resident mind meets signal->label at 0.99; climbed to base\/270m@0 .*; counted/)
  assert.deepEqual(servedRow({ job: 'signal->label', pick: p, ms: 120, result: 'pass', instance: '#1' }).result, 'climb')
})

// spec: MINDS §4 residency states · technique: the 12B is resident in state b only; `may` excludes it for this job
test('residency state and the job\'s may-list bound the candidates; the 12B serves only in state b for a job that allows it', () => {
  const open = { ...index, jobs: new Map([['signal->label', { class: 'signal->label', slo: { pass: 0.94 }, may: [], level: 'L3' }]]) }
  const a = assign('signal->label', open, { state: 'a' }); assert.equal(a.climb, true, 'in state a the 12B is not resident')
  const b = assign('signal->label', open, { state: 'b' }); assert.equal(b.mind.id, 'base/12b@0'); assert.equal(b.climb, false)
  assert.equal(assign('signal->label', index, { state: 'b' }).mind.id, 'sentry/1b@3', 'the job\'s may-list keeps the 12B out')
})

// spec: F-A1 honest null · technique: a class with no rows; an empty index
test('a class nobody has sat is the honest null (the brain, counted); an empty index says so', () => {
  const p = assign('yes-no', index, { state: 'a' })
  assert.equal(p.mind, null); assert.equal(p.climb, true); assert.match(p.why, /no resident mind has an in-role row for yes-no; the brain takes it; counted/)
  assert.equal(servedRow({ job: 'yes-no', pick: p, ms: 5, result: 'pass' }).mind, 'brain')
  const none = loadIndex({ mindsDir: DIR + 'nowhere', jobsDir: DIR + 'nowhere' })
  assert.match(none.why, /no minds index under/); assert.match(assign('yes-no', none).why, /\(no index\)/)
})

// spec: §3.1 ids and the ladder · technique: a table of tags
test('the rung of a mind comes from its tag or id, fewest parameters first', () => {
  assert.deepEqual(['gemma3:270m', 'functiongemma:latest', 'gemma3:1b-it-q8_0', 'gemma4:e2b-it-q8_0', 'gemma3:4b-it-q8_0', 'gemma4:e4b-it-q8_0', 'gemma4:12b-it-q8_0', 'gemma4:26b'].map((tag) => rungOf({ tag })), [0, 1, 2, 3, 4, 5, 6, 7])
  assert.equal(rungOf({ id: 'sentry/1b@3' }), 2); assert.equal(rungOf({ tag: 'embeddinggemma:latest' }), -1)
})

// spec: call 19, step 3 (the build order §6.14) · class: E a retired head · technique: a jobs dir with one file of each head ·
// method: the index's jobs · sre: can a job class filed on the old head steer a pick after the head was retired?
test('a job file on the old head is read as nothing; the job-class file beside it is read', () => {
  const jobs = fs.mkdtempSync(path.join(os.tmpdir(), 'assign-jobs-'))
  fs.writeFileSync(path.join(jobs, 'new.slat'), '(job-class (class yes-no) (level L3) (slo (pass 0.9)) (may 270m))\n')
  fs.writeFileSync(path.join(jobs, 'old.slat'), '(job (class signal->label) (level L3) (slo (pass 0.9)) (may 270m))\n')
  const idx = loadIndex({ mindsDir: DIR + 'minds', jobsDir: jobs })
  assert.deepEqual([...idx.jobs.keys()], ['yes-no'])
  fs.rmSync(jobs, { recursive: true, force: true })
})

test('R1.4 Part 2: a passing Rolebench grid cell (authority === record) takes precedence in assign', () => {
  const cells = [
    { mind: 'e4b', role: 'engineer', function: 'triage', level: 'L2', standing: 'passes', sitting: { lb90: 0.94, n: 20 } },
  ]
  const pick = assign('engineer/triage', index, { state: 'a', cells })
  assert.equal(pick.authority, 'record')
  assert.equal(pick.mind.id, 'e4b')
  assert.equal(pick.recall, 0.94)
})
