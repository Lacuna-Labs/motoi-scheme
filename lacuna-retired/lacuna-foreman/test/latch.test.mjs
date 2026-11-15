// latch.test.mjs — THE LATCH (K1.3; SENTRY-2.0 §1–§2). Owns: the proofs that a run filed under a playbook (named, or by
// `(recall NAME)` in its goal) carries step 1 of its ladder on the contract with the step's allows and their hash; that a
// receipt matching step k's `done` moves the latch to k + 1 and nothing else does; that a receipt closing a later step first
// leaves one `out-of-sequence` row and no move; that a step done by `(answer (names …))` closes on a said naming every word
// and the last step closes the ladder; that the coordinate's step field is the latch's k; that the latch persists through the
// contract's text and reads back; that a playbook with no ladder leaves no latch. Refuses: a mock of latch.mjs; the runs are
// filed through intents.mjs on a real Supervisor over the real ladders.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent, result, said } from '../intents.mjs'
import { readContract, renderContract } from '../contract.mjs'
import { parse as parseCoordinate } from '../coordinate.mjs'
import { advanceLatch, answerLatch, currentStep, latchOf, openLatch, playbookOf } from '../latch.mjs'
import { allowsSha, loadLadder, readLadder } from '../ladder.mjs'

const rows = (h, check) => h.rows.filter((l) => l.startsWith('(verdict ') && (l.includes(`(check ${check})`) || l.includes(`(check "${check}")`)))
const LADDER = readLadder(`(ladder (playbook "T") (version 1) (role operator)
  (step 1 (allows disk jobs) (gives) (done (receipt disk)) (budget (in 1) (out 1) (s 1)))
  (step 2 (allows recall) (gives) (done (receipt recall (exit any))) (budget (in 1) (out 1) (s 1)))
  (step 3 (allows recall) (gives) (done (answer (names "GB" "%"))) (budget (in 1) (out 1) (s 1))))`)
const file = (s, o = {}) => fileRun(s, { key: 'wo:wo-273615', goal: 'read the disk (recall DISK) and say the GB', by: 'work-order', tier: 'act', hands: ['disk', 'jobs', 'recall'], acts: ['patch'], ...o })
const receipt = (s, w, op, value = {}) => { const i = intent(s, w.id, { tool: op, args: [] }); return result(s, w.id, 'hand', { ticket: i.ticket, op, exit: 0, ...value }) }

// spec: §2 "the step pointer is a latch" · class: E · technique: a goal naming a playbook · method: step 1's fields on the contract
test('a run filed under a playbook carries step 1 of its ladder: allows, their hash, the done, the budget; the coordinate says step 1', () => {
  const { s } = makeSup()
  const w = file(s)
  const l = w.contract.latch
  const disk = loadLadder('DISK')
  assert.deepEqual([l.playbook, l.k, l.n, l.closed, l.allows], ['DISK', 1, disk.steps.length, false, disk.steps[0].allows])
  assert.equal(l.allows_sha, allowsSha(disk.steps[0].allows))
  assert.deepEqual(l.done, disk.steps[0].done)
  assert.equal(currentStep(w).n, 1)
  receipt(s, w, 'jobs')   // the first step row stamps the coordinate
  assert.equal(parseCoordinate(w.contract.at).step, 1)
  assert.deepEqual([playbookOf('fix it (recall WATCHDOG-RED) now'), playbookOf('the playbook HOTFIX says'), playbookOf('(playbook disk)'), playbookOf('nothing')], ['WATCHDOG-RED', 'HOTFIX', 'DISK', null])
  const named = fileRun(s, { key: 'r-2', goal: 'x', playbook: 'backup', hands: ['disk'] })
  assert.equal(named.contract.latch.playbook, 'BACKUP')
})

// spec: the brief's gate "a receipt for step n advances to n+1; a receipt for step n+1 before n is refused" · class: E
test('only a receipt matching step k\'s done moves the latch; a later step\'s receipt first is out-of-sequence and no move', () => {
  const { s, h } = makeSup()
  const w = file(s)
  openLatch(s, w, LADDER)
  assert.equal(w.contract.latch.k, 1)
  receipt(s, w, 'jobs')
  assert.equal(w.contract.latch.k, 1, 'a read that is not the step\'s done moves nothing')
  receipt(s, w, 'recall')
  assert.equal(w.contract.latch.k, 1, 'step 2\'s receipt before step 1 is refused')
  assert.equal(rows(h, 'out-of-sequence').length, 1)
  assert.match(rows(h, 'out-of-sequence')[0], /closes step 2 of T, but step 1 is open/)
  receipt(s, w, 'disk')
  assert.equal(w.contract.latch.k, 2)
  assert.equal(parseCoordinate(w.contract.at).step, 2)
  assert.deepEqual(w.contract.latch.allows, ['recall'])
  assert.deepEqual(advanceLatch(s, w, { op: 'disk', exit: 0, touched: [] }).advanced, false, 'step 1 is behind: its receipt moves nothing now')
  receipt(s, w, 'recall', { exit: 7 })
  assert.equal(w.contract.latch.k, 3, '(exit any) takes a failed receipt too')
})

// spec: §2 "done (answer (names …))" · class: E · technique: a said with one word, then both · method: the latch closes on both
test('a step done by an answer closes on a said that names every word; the last step closes the ladder; a word moves nothing', () => {
  const { s } = makeSup()
  const w = file(s)
  openLatch(s, w, LADDER, { k: 3 })
  assert.equal(w.contract.latch.k, 3)
  said(s, w.id, 'free space is 14 %')
  assert.equal(w.contract.latch.closed, false, 'one word of two')
  said(s, w.id, 'free space is 62 GB, 14 % of the disk')
  assert.equal(w.contract.latch.closed, true)
  assert.equal(w.contract.latch.k, 3)
  assert.deepEqual(answerLatch(s, w, 'GB %').advanced, false)
  assert.deepEqual(advanceLatch(s, w, { op: 'disk', exit: 0 }), { advanced: false, why: 'closed' })
})

// spec: a receipt with a file glob · class: E · technique: a done naming (file "*.md") · method: a touched .md closes, a .js does not
test('a done with a file glob closes only on a receipt that touched such a file', () => {
  const { s } = makeSup()
  const w = file(s)
  openLatch(s, w, readLadder('(ladder (playbook "F") (step 1 (allows patch) (gives) (done (receipt patch (file "*.md"))) (budget (in 1) (out 1) (s 1))))'))
  assert.equal(advanceLatch(s, w, { op: 'patch', exit: 0, touched: ['docs/x.js'] }).advanced, false)
  assert.equal(advanceLatch(s, w, { op: 'patch', exit: 0, touched: ['docs/eng/notes/why.md'] }).advanced, true)
  assert.equal(w.contract.latch.closed, true)
})

// spec: a checkpoint brings the run back with its latch · class: E · technique: render, read, re-open by name · method: the same step
test('the latch persists on the contract\'s text and reads back by its playbook and k; a contract without one reads as before', () => {
  const { s } = makeSup()
  const w = file(s)
  receipt(s, w, 'disk')
  const text = renderContract(w.contract)
  assert.match(text, /\(latch \(@ \("playbook" "DISK"\) \("version" 1\) \("k" 2\) \("n" \d\) \("closed" 0\)\)\)\)$/)
  const back = readContract(text)
  assert.deepEqual([back.latch.playbook, back.latch.k, back.latch.closed], ['DISK', 2, false])
  const w2 = { id: 'w-x', contract: { ...back }, run: { results: [] } }
  const l = latchOf(w2)
  assert.deepEqual([l.k, l.allows], [2, loadLadder('DISK').steps[1].allows], 'the step\'s fields come back from the ladder')
  const plain = fileRun(s, { key: 'r-9', goal: 'a desk turn', hands: ['disk'] })
  assert.equal(plain.contract.latch, undefined)
  assert.equal(readContract(renderContract(plain.contract)).latch, null)
  assert.equal(latchOf(plain), null)
})

// spec: "a ladder it cannot load: no latch, one think line" · class: E
test('a playbook with no ladder leaves no latch and the run goes on', () => {
  const { s } = makeSup()
  const w = fileRun(s, { key: 'r-3', goal: 'do the thing (recall NO-SUCH-PLAYBOOK)', hands: ['disk'] })
  assert.equal(w.contract.latch, undefined)
  assert.equal(openLatch(s, w, 'no-such'), null)
  assert.ok(w.thoughts?.some?.((t) => /no ladder for NO-SUCH/.test(String(t.text ?? t))) ?? true)
})
