// expectation.test.mjs — the work sentry reads the expectation (sentry/expectation.mjs, sentry/met.mjs; design WORK-CHIPS-CHAT
// §7, part P7): the order's `expect` on the run, a task's `expected` on its ticket, the step boundary's `met?` verdict with `met`
// and `side` (code first, the 1B's `met?` when code cannot tell), the job-end row's side, and the verdict row read back.
// class: F (a fault told by its side) and L5 (the record's shape) · technique: a fake host's supervisor, the real intents door
// · sre: when a run's work goes wrong, does the record say whether to correct the tool or the mind's chain of tasks?
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result, finishRun } from '../intents.mjs'
import { stepCheck, endCheck, expectationOf } from '../sentry/expectation.mjs'
import { metByCode, sideOf, endSide } from '../sentry/met.mjs'
import { readVerdict } from '../runs.mjs'
import { QUESTIONS } from '../sentry/labeler.mjs'

const verdicts = (h) => h.rows.filter((l) => l.startsWith('(verdict ')).map(readVerdict)
const land = (h, s, w, tool, value, expected) => {
  const r = intent(s, w.id, { tool, args: [{}], expected })
  assert.ok(r.ok, r.why)
  result(s, w.id, 'hand', { ticket: r.ticket, op: tool, ...value })
  return r.ticket
}

// spec: §7.2's code rows · class: F · technique: table · method: terms met and missing, prose and comparisons unsure; the sides
test('code finds the terms or says unsure; each side has its row', () => {
  assert.deepEqual(metByCode('the log names src/board.js', 'M src/board.js'), { met: 'met' })
  assert.deepEqual(metByCode('the log names src/board.js and "tiles"', 'M src/board.js'), { met: 'unmet', missing: ['tiles'] })
  assert.deepEqual(metByCode('df reports more than 15 GB free', '70Gi'), { met: 'unsure' })
  assert.deepEqual([sideOf({ shape: true, ok: false }), sideOf({ ok: false }), sideOf({ ok: true, cut: true }), sideOf({ ok: true, met: 'unmet' }), sideOf({ ok: true, met: 'met' })],
    ['thinking', 'tool', 'tool', 'world', 'none'])
  assert.deepEqual([endSide([{ met: 'met' }, { met: 'met' }]), endSide([{ met: 'met' }, { met: 'unmet' }]), endSide([])], ['thinking', 'tool', 'thinking'])
  assert.deepEqual(QUESTIONS['met?'], ['met', 'unmet', 'unsure'])
})

// spec: §7.1 (the order's expect on the run), §7.3 (the work sentry reads the order's expectation first) · the step boundary
// class: F · technique: two runs on the fake host's supervisor · method: a run filed with an expectation keeps it; at the
//         boundary a receipt that lacks its term is a `met?` warn with side world; a failed receipt makes it side tool; one that
//         holds it is a note, met; the verdict row carries met and side and reads back
// sre: does the floor say "the world was not as the mind assumed" apart from "the tool broke"?
test('at a step\'s boundary the order\'s expectation is checked: world, tool and met told apart on the verdict row', async () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-1', goal: 'free the disk', expect: 'the listing names "backup-old.tar"' })
  assert.deepEqual(expectationOf(w), { expected: 'the listing names "backup-old.tar"', from: 'order' })
  land(h, s, w, 'disk', { exit: 0, rows: { text: 'notes.md\nbuild.log' } })
  const world = await stepCheck(s, w, { step: 1 })
  assert.deepEqual([world.check, world.action, world.met, world.side, world.by], ['met?', 'warn', 'unmet', 'world', 'code'])
  const row = verdicts(h).at(-1)
  assert.deepEqual([row.check, row.met, row.side], ['met?', 'unmet', 'world']); assert.match(row.why, /missing backup-old\.tar/)
  land(h, s, w, 'disk', { exit: 12, why: 'refused: the path is outside the run' })
  assert.equal((await stepCheck(s, w, { step: 2 })).side, 'tool', 'a failed receipt is the tool\'s')
  const ok = fileRun(s, { key: 'wo:wo-2', goal: 'free the disk', expect: 'the listing names "backup-old.tar"' })
  land(h, s, ok, 'disk', { exit: 0, rows: { text: 'backup-old.tar' } })
  const met = await stepCheck(s, ok, { step: 1 })
  assert.deepEqual([met.action, met.met, met.side], ['note', 'met', 'none'])
  assert.equal(await stepCheck(s, fileRun(s, { key: 'p', goal: 'g' }), {}), null, 'no expectation, no row')
})

// spec: §7.2 (the prose row: the labeler's `met?`, late is `unsure`, never a guess) · class: F · technique: the host's sentry road
test('an expectation code cannot test goes to the 1B\'s met?, and its label is the verdict\'s', async () => {
  const { h, s } = makeSup()
  s.host.sentryModel = () => 'a-1b'
  let asked = null
  s.host.sentryAsk = async (_s, req) => { asked = req; return "(label 'unmet)" }
  const w = fileRun(s, { key: 'wo:wo-3', goal: 'free the disk', expect: 'df shows more than 15 GB free' })
  land(h, s, w, 'disk', { exit: 0, rows: { text: '/dev/disk3s1 926Gi 9Gi' } })
  const v = await stepCheck(s, w, { step: 1, ask: true })
  assert.equal(asked.job, 'met?'); assert.match(asked.prompt, /^Expected: df shows more than 15 GB free\nWhat came back: \/dev\/disk3s1/)
  assert.deepEqual([v.by, v.met, v.side, v.action], ['1b', 'unmet', 'world', 'warn'])
  const quiet = await stepCheck(s, w, { step: 1 })
  assert.deepEqual([quiet.by, quiet.met, quiet.action], ['code', 'unsure', 'note'], 'without its questions the run asks no mind')
})

// spec: §7.2's last row ("a job ended answered with the order's expect unmet by any receipt: thinking when every call met its
//       expectation; tool when one did not") · class: F · technique: two runs ended through finishRun
// sre: when a run ends short of its order, does the record say whether the tasks or the chain failed?
test('a run that ends short of its order\'s expectation: thinking when every task met its own, tool when one did not', () => {
  const { h, s } = makeSup()
  const chain = fileRun(s, { key: 'wo:wo-4', goal: 'g', desk: true, hands: ['disk'], expect: 'the report names "postmortem.md"' })
  land(h, s, chain, 'disk', { exit: 0, rows: { text: 'notes.md' } }, 'the listing names notes.md')
  finishRun(s, chain.id, { pass: true })
  assert.deepEqual(((r) => [r.check, r.met, r.side])(verdicts(h).at(-1)), ['met?', 'unmet', 'thinking'])
  const tool = fileRun(s, { key: 'wo:wo-5', goal: 'g', desk: true, hands: ['disk'], expect: 'the report names "postmortem.md"' })
  land(h, s, tool, 'disk', { exit: 0, rows: { text: 'notes.md' } }, 'the listing names drafts/a.md')
  finishRun(s, tool.id, { pass: true })
  assert.deepEqual(((r) => [r.side, r.why.slice(0, 21)])(verdicts(h).at(-1)), ['tool', 'a task missed its own'])
  const n = verdicts(h).length
  const done = fileRun(s, { key: 'wo:wo-6', goal: 'g', desk: true, hands: ['disk'], expect: 'the report names "postmortem.md"' })
  land(h, s, done, 'disk', { exit: 0, rows: { text: 'postmortem.md' } })
  finishRun(s, done.id, { pass: true })
  assert.equal(verdicts(h).filter((r) => r.check === 'met?').length, verdicts(h).slice(0, n).filter((r) => r.check === 'met?').length, 'met: no row')
  assert.equal(endCheck(s, fileRun(s, { key: 'q', goal: 'g' })), null)
})
