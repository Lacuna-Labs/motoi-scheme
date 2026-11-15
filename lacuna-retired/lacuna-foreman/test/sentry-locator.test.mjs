// sentry-locator.test.mjs — THE 270M LOCATOR (K1.8; SENTRY-2.0 §5 S1). Owns: the proofs that the locator asks one question
// under a label grammar of `step-1 … step-N | none` within the budget; that a step other than the latch's is one
// `out-of-sequence` warn by the mind and `none` one `off-task` warn, while the latch's own step and `unsure` leave nothing;
// that a mind past the 3 s wall is `unsure` and counted (F-S1), as is a box with no label seat; that a run with no latch is
// never asked; that the evidence row is eval-only. Refuses: a mock of locator.mjs; the mind is a fake behind the host's seam.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun } from '../intents.mjs'
import { atBoundary } from '../sentry.mjs'
import { openLatch } from '../latch.mjs'
import { readLadder } from '../ladder.mjs'
import { BUDGET } from '../sentry/labeler.mjs'
import { locate, locateCheck, locatorLabels, locatorPrompt } from '../sentry/locator.mjs'

const rows = (h, check) => h.rows.filter((l) => l.startsWith('(verdict ') && l.includes(`(check "${check}")`))
const LADDER = readLadder(`(ladder (playbook "L") (version 1) (role operator)
  (step 1 (allows disk) (gives) (done (receipt disk)) (budget (in 1) (out 1) (s 1)) (says "Read the disk."))
  (step 2 (allows recall) (gives) (done (receipt recall)) (budget (in 1) (out 1) (s 1)) (says "Recall the playbook."))
  (step 3 (allows patch) (gives) (done (receipt patch)) (budget (in 1) (out 1) (s 1))))`)
function withMind(answer) {
  const { s, h } = makeSup()
  h.sentryModel = (seat) => (seat === 'label' ? 'sentry-270m' : 'sentry-1b')
  h.asked = []
  h.mind = async (req) => { h.asked.push(req); return typeof answer === 'function' ? answer(req) : answer }
  const w = fileRun(s, { key: 'wo:wo-1', goal: 'read the disk, then recall DISK and patch the note\nsecond line', hands: ['disk', 'recall'], acts: ['patch'] })
  openLatch(s, w, LADDER)
  return { s, h, w }
}

// spec: "step-1 … step-N | none on the goal line, the step list, the last sentence and the call" · class: E · method: the labels and the prompt
test('the labels are step-1 … step-N and none; the prompt carries the goal\'s first line, the steps, the sentence and the call, within the budget', () => {
  assert.deepEqual(locatorLabels(3), ['step-1', 'step-2', 'step-3', 'none'])
  assert.deepEqual(locatorLabels(0), ['step-1', 'none'])
  const p = locatorPrompt({ goal: 'first line\nsecond', steps: LADDER.steps, sentence: 'I am reading the disk now.', call: 'disk (result 1)' })
  assert.match(p, /^Goal: first line\nThe steps:\nstep-1: Read the disk\.\nstep-2: Recall the playbook\.\nstep-3: calls patch\n/)
  assert.match(p, /\(label 'step-1\) \(label 'step-2\) \(label 'step-3\); \(label 'none\)/)
  assert.ok(!p.includes('second'), 'the goal\'s first line only')
  assert.ok(locatorPrompt({ goal: 'x'.repeat(9000), steps: LADDER.steps, sentence: '', call: null }).length <= BUDGET.chars)
})

// spec: "a step other than the latch's k is out-of-sequence by the mind; none is off-task; unsure nothing" · class: E · technique: four fake answers
test('step-2 while the latch is at 1 is an out-of-sequence warn by the 270m; none is off-task; step-1 and unsure leave nothing', async () => {
  for (const [answer, check] of [["(label 'step-2)", 'out-of-sequence'], ["(label 'none)", 'off-task'], ["(label 'step-1)", null], ["(label 'unsure)", null]]) {
    const { s, h, w } = withMind(answer)
    const r = await atBoundary(s, w, 'Looking at the playbook text for the next move.')
    const got = [...rows(h, 'out-of-sequence'), ...rows(h, 'off-task')]
    if (check) {
      assert.equal(got.length, 1, answer)
      assert.match(got[0], new RegExp(`\\(check "${check}"\\) \\(by "270m"\\) \\(action "warn"\\)`))
      assert.ok(r.rows.some((x) => x.check === check))
    } else assert.equal(got.length, 0, answer)
    assert.equal(h.asked.length, 1, 'one question a boundary')
    assert.equal(h.asked[0].model, 'sentry-270m', 'the label seat\'s mind, never a tag in code')
    assert.ok(h.asked[0].prompt.includes('step-2: Recall the playbook.'))
  }
})

// spec: "past the 3 s wall the answer is unsure, counted" (F-S1); "no label seat: unsure" · class: J3 · technique: a mind that never answers
test('a mind past the wall is unsure and counted late; a box with no label seat is unsure and counted none; nothing is written', async () => {
  const slow = withMind(() => new Promise(() => {}))
  const t0 = Date.now()
  const r = await locate(slow.s, slow.w, { goal: 'g', steps: LADDER.steps, sentence: 'x', call: null })
  assert.deepEqual([r.label, r.by], ['unsure', 'late'])
  const elapsed = Date.now() - t0
  assert.ok(elapsed >= 2900 && elapsed < 6000, `${elapsed} ms`)
  assert.deepEqual([slow.w.sentry.locator.asked, slow.w.sentry.locator.late, slow.w.sentry.locator.unsure], [1, 1, 1])
  const none = makeSup()
  const w = fileRun(none.s, { key: 'r-1', goal: 'g', hands: ['disk'] }); openLatch(none.s, w, LADDER)
  const r2 = await locateCheck(none.s, w, { said: 'anything' })
  assert.equal(r2, null)
  assert.deepEqual([w.sentry.locator.none, w.sentry.locator.unsure], [1, 1])
  assert.equal(none.h.rows.filter((l) => l.startsWith('(verdict ')).length, 0)
})

// spec: "a run with no latch is never asked"; the evidence row is eval-only · class: E
test('a run with no latch is never asked; the evidence row lands eval-only under sentry/work', async () => {
  const { s, h } = withMind("(label 'step-2)")
  const plain = fileRun(s, { key: 'r-2', goal: 'a desk question', hands: ['disk'] })
  await atBoundary(s, plain, 'Thinking.')
  assert.equal(h.asked.length, 0)
  const { s: s2, w } = withMind("(label 'step-3)")
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locator-'))
  const r = await locateCheck(s2, w, { said: 'Patching the note.' }, { dir, domain: 'ops' })
  assert.equal(r.check, 'out-of-sequence')
  const line = JSON.parse(fs.readFileSync(path.join(dir, 'sentry', 'work', 'ops.jsonl'), 'utf8').trim())
  assert.deepEqual([line.question, line.label, line.by, line.use], ['locate?', 'step-3', '270m', 'eval-only'])
})
