// summary.test.mjs — LACUNA'S SUMMARY (lane F5-BC, BC.9). Owns: the tests that the summary names what runs, what is stuck and
// for how long, what failed with its why, what waits on the owner, and the cube's own lights, from the registry alone; that it
// is one slat form under 1,200 characters; and that a busy floor cuts its lists with a `cut` count rather than overrunning.
// Refuses: prose, a mock of the fold.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readForms } from '../../../../lacuna-scheme/src/slat-data.js'
import { scenario, loadMind, startRun } from './fixtures/scenario.mjs'
import { summary, MAX_CHARS } from '../summary.js'

// spec: master §3.2 "what runs, what is stuck and for how long, what failed and the why, what waits on the owner" · class: J ·
// technique: a small floor · method: one stalled run, one failed, one press waiting; read the form back · sre: what does Lacuna say first?
test('the summary names the living, the stuck with its age, the failed with its why and the press waiting, as one slat form', () => {
  const sc = scenario()
  loadMind(sc, 'e4b', 1)
  startRun(sc, 'w-aaa111', 5, 'e4b')
  startRun(sc, 'w-bbb222', 6, 'e4b')
  startRun(sc, 'w-ccc333', 7, 'e4b')
  sc.ev(20, 'run.stall', 'w-aaa111', { why: 'nothing pending', missed: 2, exit: null })
  sc.ev(30, 'run.fail', 'w-bbb222', { why: 'the hands killed shell at 120 s', exit: 15, step: 2 })
  sc.ev(40, 'press.wait', 'w-ccc333', { id: 'p-1', action: 'git-push', run: 'w-ccc333' })
  sc.to(60)
  const text = summary(sc.f, 60)
  assert.ok(text.length <= MAX_CHARS)
  const [form] = readForms(text)
  assert.equal(String(form[0]), 'summary')
  assert.match(text, /\(logt 60\)/)
  assert.match(text, /\("run" "w-aaa111"\) \("state" "stalled"\) \("for-s" 40\) \("cause" "missed-beats 2"\)/)
  assert.match(text, /\("run" "w-bbb222"\) \("why" "exit 15 deadline: the hands killed shell at 120 s"\) \("age-s" 30\)/)
  assert.match(text, /\("run" "w-ccc333"\) \("action" "git-push"\) \("id" "p-1"\) \("for-s" 20\)/)
  assert.match(text, /\("living" 2\)/)
  assert.match(text, /\("waiting-press" 1\)/)
  assert.match(text, /\("id" "e4b"\) \("state" "waiting.press"\)/)
  assert.match(text, /\("edge" "shadow"\)/)
  assert.doesNotMatch(text, /token|secret/i)
})

// spec: master §3.2's cap · class: J · technique: a flood of failures · method: 40 failed runs; the list is cut with its count and the
// text stays under the cap · sre: does a bad night overrun Lacuna's window?
test('a floor with 40 failed runs cuts its lists with a count and stays under the cap', () => {
  const sc = scenario()
  loadMind(sc, 'e4b', 1)
  for (let i = 0; i < 40; i++) { const id = `w-f${String(i).padStart(5, '0')}`; startRun(sc, id, 5 + i, 'e4b'); sc.ev(60 + i, 'run.fail', id, { why: `failure number ${i} with a long why sentence that fills the row`, exit: 15, step: 1 }) }
  sc.to(120)
  const text = summary(sc.f, 120)
  assert.ok(text.length <= MAX_CHARS, `${text.length}`)
  assert.match(text, /\("cut" \d+\)/)
  assert.match(text, /\("failed" 40\)/)
})
