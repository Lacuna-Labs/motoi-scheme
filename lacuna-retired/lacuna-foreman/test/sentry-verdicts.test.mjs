// sentry-verdicts.test.mjs — THE VERDICT WRITER (K1.1; RULINGS Q-D1; SENTRY-2.0 unit 3.0). Owns: the proofs that every check
// returns one verdict object and leaves one `(verdict …)` row in the ledger that the one reader reads back field by field;
// that a verdict without a why, a check outside the table or an action outside the seven is refused and nothing is written;
// that the three lights count by level on the worker and foreman-wide; that the inbox letters a warn once an hour per
// `service·check·level` and counts the repeats; that the attach, the check and the verdict ride the bus with the catalog's
// fields and the coordinate. Refuses: a mock of verdicts.mjs or runs.mjs; every test files a real run on a real Supervisor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun } from '../intents.mjs'
import { verdict, inbox, lights, sentryOf, LIGHT_OF, LIGHTS, ACTIONS, LEVEL_OF, DEDUP_S, VERDICTS_KEPT } from '../sentry/verdicts.mjs'
import { readVerdict, verdictLine, VERDICT_FIELDS } from '../runs.mjs'
import { parse as parseCoordinate } from '../coordinate.mjs'

const rows = (h) => h.rows.filter((l) => l.startsWith('(verdict '))

// spec: Q-D1 "one row shape (verdict (run)(step)(check)(by)(action)(detail)(why)(at))" · SENTRY-2.0 §4 (the coordinate on every verdict row)
// class: L5 the record's shape · technique: one verdict on a filed run, read back by the one reader
// method: the object's fields, the line's field order, the read-back equal to the object, the coordinate parses with the run's service
// sre: can an on-call read a verdict row and know the run, the step, the check, who judged, what was done and why?
test('a verdict is one object and one ledger row the reader reads back, with its coordinate and its why', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-273615', goal: 'g', by: 'work-order', attempt: 2 })
  const v = verdict(s, w, { check: 'drift', action: 'warn', by: 'code', detail: 'touched docs/, the goal names src/', why: 'the patch touched files outside the parts the goal names' })
  assert.deepEqual([v.run, v.check, v.by, v.action, v.light, v.level], [w.id, 'drift', 'code', 'warn', 'semantics', 'warn'])
  assert.equal(rows(h).length, 1)
  const r = readVerdict(rows(h)[0])
  assert.deepEqual(Object.keys(r), [...VERDICT_FIELDS])
  assert.deepEqual([r.run, r.step, r.check, r.by, r.action, r.detail, r.why, r.at, r.t], [w.id, v.step, 'drift', 'code', 'warn', v.detail, v.why, v.at, v.t])
  const c = parseCoordinate(r.at)
  assert.deepEqual([c.service, c.wo, c.run, c.gen], [4096, 273615, 2, 1])
  assert.equal(sentryOf(w).verdicts.at(-1), v)
})

// spec: "a verdict without a why is not written" (the brief; SENTRY-2.0 §5) · class: L1 fail closed
// technique: three bad verdicts · method: each throws one sentence and the ledger stays empty; verdictLine refuses the same
// sre: can a check write a row that says nothing about why? (it must not)
test('a verdict without a why, with an unknown check or an unknown action is refused and nothing is written', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  assert.throws(() => verdict(s, w, { check: 'drift', action: 'warn', why: '' }), /without a why is not written/)
  assert.throws(() => verdict(s, w, { check: 'vibes', action: 'warn', why: 'x' }), /not a check the sentry knows/)
  assert.throws(() => verdict(s, w, { check: 'drift', action: 'shout', why: 'x' }), /one of note warn would-kick/)
  assert.throws(() => verdictLine({ run: 'w', step: 1, check: 'drift', by: 'code', action: 'warn', detail: '', why: ' ', at: '-', t: 1 }), /without a why/)
  assert.equal(rows(h).length, 0)
  for (const check of Object.keys(LIGHT_OF)) assert.ok(LIGHTS.includes(LIGHT_OF[check]), `${check} moves a known light`)
  for (const a of ACTIONS) assert.ok(['info', 'warn', 'error'].includes(LEVEL_OF[a]), `${a} has a level`)
})

// spec: SENTRY-2.0 §8 "the three lights as ledger counters" · THE-FLOOR R2 · class: L5
// technique: one verdict per light and level · method: the worker's and the foreman's counters by light and level; the ring is bounded
// sre: when the cube shows red on provenance, does a counter say how many and at what level?
test('the three lights count by level on the worker and foreman-wide; the ring on the worker is bounded', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  verdict(s, w, { check: 'no-ticket', action: 'refuse', why: 'a' })
  verdict(s, w, { check: 'ast-error', action: 'note', why: 'b' })
  verdict(s, w, { check: 'circling', action: 'would-kick', why: 'c' })
  verdict(s, w, { check: 'circling', action: 'kick', why: 'd' })
  const st = sentryOf(w)
  assert.deepEqual([st.lights.provenance.error, st.lights.ast.info, st.lights.semantics.warn, st.lights.semantics.error], [1, 1, 1, 1])
  assert.deepEqual([lights(s).provenance.error, lights(s).semantics.error, st.counts.circling], [1, 1, 2])
  for (let i = 0; i < VERDICTS_KEPT + 5; i++) verdict(s, w, { check: 'remark', action: 'note', why: 'n' })
  assert.equal(st.verdicts.length, VERDICTS_KEPT)
})

// spec: SENTRY-2.0 §8 "reach the inbox deduped (one per service·name·level per hour)" · unit 3.7 · class: E10 a duplicate
// technique: three warns of one check inside the hour, one past it; a note never letters; an error is its own key
// method: letters count 1, then 2 past the hour; the dedup answer carries the count; a note leaves no letter
// sre: can one noisy check fill the owner's inbox? (one letter an hour, with a count)
test('a warn is lettered once an hour per service·check·level and counted after; a note never letters', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  verdict(s, w, { check: 'off-task', action: 'warn', why: 'other work' })
  const second = verdict(s, w, { check: 'off-task', action: 'warn', why: 'other work again' })
  verdict(s, w, { check: 'off-task', action: 'warn', why: 'and again' })
  assert.equal(h.letters.length, 1, 'one letter inside the hour')
  const dup = inbox(s, w, second)                       // a fourth of the same key: counted, no letter
  assert.deepEqual([dup.deduped, dup.count], [true, 4])
  assert.match(h.letters[0].what, /^sentry warn: off-task — other work$/)
  verdict(s, w, { check: 'off-task', action: 'kick', why: 'the level is error: its own key' })
  assert.equal(h.letters.length, 2)
  verdict(s, w, { check: 'remark', action: 'note', why: 'a note letters nobody' })
  assert.equal(h.letters.length, 2)
  h.tick(DEDUP_S + 1)
  verdict(s, w, { check: 'off-task', action: 'warn', why: 'an hour later' })
  assert.equal(h.letters.length, 3)
})

// spec: SENTRY-2.0 §7, A2 §3.3 (sentry.attach · sentry.check · sentry.verdict on the bus) · class: L5
// technique: a work run (role coder) and its first verdict · method: the bus carries attach with the model and the mode, then the verdict with the catalog's fields and the coordinate
// sre: does the floor hear a sentry sit on a run before it hears its first verdict?
test('the attach, then the verdict, ride the bus with the catalog fields and the coordinate', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-1', goal: 'fix the probe', by: 'work-order', role: 'coder', tier: 'act', acts: ['patch'] })   // a work run (a run with no hands or acts is a desk turn)
  const att = h.up.find((u) => u.kind === 'sentry.attach')
  assert.ok(att, 'sentry.attach went up at filing')
  assert.deepEqual([att.data.model, att.data.domain, att.data.mode, att.data.ref, att.data.actor], ['code', 'patch', 'shadow', w.id, `sentry-code:${w.id}`])
  const v = verdict(s, w, { check: 'drift', action: 'warn', why: 'x', detail: 'd' })
  const ev = h.up.filter((u) => u.kind === 'sentry.verdict').at(-1)
  assert.deepEqual([ev.data.check, ev.data.action, ev.data.detail, ev.data.shadow, ev.data.by, ev.data.at, ev.data.ref], ['drift', 'warn', 'd', false, 'code', v.at, w.id])
})

// spec: SENTRY-2.0 §8 "models warn; code kicks" (K1.10) · class: E · technique: the four teeth by a model, the same by code
test('a model\'s verdict may warn or note, never kick, stop or refuse; code may; the inbox dedups one letter per check and level an hour', async () => {
  const { verdict, inbox, MODEL_BY, TEETH } = await import('../sentry/verdicts.mjs')
  const { makeSup } = await import('../../../test/conformance/fake-host.mjs')
  const { fileRun } = await import('../intents.mjs')
  const { s, h } = makeSup()
  const w = fileRun(s, { key: 'r-1', goal: 'g', hands: ['disk'] })
  assert.deepEqual([[...MODEL_BY], [...TEETH]], [['1b', '270m'], ['kick', 'stop', 'refuse']])
  for (const by of MODEL_BY) for (const action of TEETH) assert.throws(() => verdict(s, w, { check: 'off-task', action, by, why: 'x' }), /a model warns, code kicks/)
  assert.equal(verdict(s, w, { check: 'off-task', action: 'warn', by: '1b', why: 'x' }).action, 'warn')
  assert.equal(verdict(s, w, { check: 'scope', action: 'stop', by: 'code', why: 'x' }).action, 'stop')
  // a fresh check and level for the inbox's own rule: the stop above already lettered foreman·scope·error once
  const row = { check: 'loop', level: 'error', why: 'x', run: w.id, step: 0, action: 'stop', detail: '', at: null }
  assert.deepEqual(inbox(s, w, row), { deduped: false, count: 1 })
  assert.deepEqual(inbox(s, w, row), { deduped: true, count: 2 })
  h.tick(3600); assert.deepEqual(inbox(s, w, row), { deduped: false, count: 1 })
  assert.deepEqual(inbox(s, w, { ...row, level: 'warn' }).deduped, false, 'another level is another letter')
})

