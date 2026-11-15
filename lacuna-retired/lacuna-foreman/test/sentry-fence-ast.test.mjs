// sentry-fence-ast.test.mjs — THE FENCE AND THE AST BOUNDARIES (K1.1, K1.5; SENTRY-2.0 §2, §3). Owns: the proofs that a
// call inside the step's `allows` passes the fence silently and a call outside it leaves one `out-of-sequence` row (warn-only
// in 1.0: the call still goes); that a run with no ladder has no fence; that the cart's scope check refuses an op or a file
// outside its header by code (exit 12, F-02); that the patch boundary's receipt is read into rows: a file that did not parse
// is `ast-error` with its repair sentence (three repairs a run), a module over the law warns, a deleted or skipped test kicks,
// a blast radius over the ceiling warns; that the turn's end form is checked. Refuses: a mock of fence.mjs or ast.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { fileRun, intent } from '../intents.mjs'
import { fence, allowsOf, scope, inTouches } from '../sentry/fence.mjs'
import { receiptAst, endCheck, readEnd, REPAIRS_PER_RUN } from '../sentry/ast.mjs'

const rows = (h) => h.rows.filter((l) => l.startsWith('(verdict '))
const latch = (w, k, steps) => { w.contract.latch = { k, steps: steps.map((allows, i) => ({ n: i + 1, allows })), allows_sha: null } }

// spec: SENTRY-2.0 §2 "A call outside the located step's allows is a verdict row out-of-sequence (warn-only in 1.0)" · class: L3
// technique: a run with a two-step ladder on its contract; a call inside, a call outside
// method: inside: no row; outside: one warn row naming the step and the op, and the intent still goes (a ticket opens)
// sre: when a mind calls out of order, does the record say so without stopping the work in 1.0?
test('inside the step\'s allows the fence is silent; outside it leaves one out-of-sequence warn and the call still goes', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  assert.deepEqual(allowsOf(w), { allows: null, source: null, k: null }, 'no ladder: no fence')
  assert.deepEqual(fence(s, w, 'jobs'), { ok: true, outside: false, verdict: null })
  latch(w, 1, [['jobs', 'disk'], ['files']])
  assert.deepEqual([...allowsOf(w).allows], ['jobs', 'disk'])
  const inside = intent(s, w.id, { tool: 'jobs' })
  assert.equal(inside.ok, true); assert.equal(rows(h).filter((l) => /out-of-sequence/.test(l)).length, 0)
  const outside = intent(s, w.id, { tool: 'files', args: ['.'] })
  assert.equal(outside.ok, true, 'warn-only in 1.0: the call goes')
  const v = rows(h).filter((l) => /out-of-sequence/.test(l))
  assert.equal(v.length, 1)
  assert.match(v[0], /\(step 1\) \(check "out-of-sequence"\) \(by "code"\) \(action "warn"\) \(detail "files outside step 1 \(allows jobs disk\)"\)/)
})

// spec: O11 scope check 3 (fence.mjs scope) · F-02 · class: L3 an op or a file outside the header
// technique: a cart header with verbs, hands, acts and touches
// method: an allowed op and file pass; an op outside is refused exit 12 F-02; a file outside touches is refused; a plain worker is not fenced
// sre: can an agent sent with a cart reach the hands with an op its header never named?
test('a cart\'s scope: an op or a file outside the header is refused by code before the hands', () => {
  const w = { cart: { name: 'backup', verbs: ['hand', 'done'], hands: ['disk'], acts: ['bundle'], touches: ['~/Lacuna-Backups/**'] } }
  assert.equal(scope(w, { op: 'bundle', files: ['~/Lacuna-Backups/world/x.tar'] }).ok, true)
  assert.deepEqual([scope(w, { op: 'prune' }).exit, scope(w, { op: 'prune' }).fault], [12, 'F-02'])
  assert.match(scope(w, { op: 'prune' }).why, /not in the cart backup's header/)
  assert.match(scope(w, { op: 'bundle', files: ['~/code/lacuna/x.mjs'] }).why, /outside the cart backup's touches/)
  assert.equal(scope({}, { op: 'anything' }).ok, true)
  assert.ok(inTouches('a/b.js', ['**']) && inTouches('a/b.js', ['a/**']) && inTouches('a/b.js', ['*.js']) && !inTouches('c/b.js', ['a/**']))
})

// spec: SENTRY-2.0 §3 (the patch boundary: parse, module size, test deletions; the model repairs) · class: L5
// technique: one receipt carrying every AST field the hands write (tuples and objects both)
// method: ast-error notes with the repair sentence (counted to three a run), module-over-law warns, a deleted and a skipped test kick, blast-radius warns
// sre: when a patch does not parse, does the next step get the line to fix instead of a stop?
test('a receipt\'s AST fields become rows: a parse error notes its repair, a deleted test kicks, a module over the law warns', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'wo:wo-3', goal: 'g', by: 'work-order', tier: 'act', acts: ['patch'] })
  const t = { ticket: 'w-x-act-1', op: 'patch', call: 1 }
  const r = receiptAst(s, w, t, {
    ast: [['src/a.mjs', 'ok', null, null], ['src/b.mjs', 'error', 42, 'unexpected token'], { file: 'src/c.py', state: 'error', line: 7, msg: 'invalid syntax' }],
    'module-over-law': [['src/big.mjs', 612]], 'test-deleted': ['test/old.test.mjs'], 'test-skipped': [{ file: 'test/skip.test.mjs' }], 'blast-radius': { over: true, ceiling: 80 },
  })
  assert.deepEqual(r.repairs, ['fix src/b.mjs line 42: unexpected token', 'fix src/c.py line 7: invalid syntax'])
  assert.deepEqual(r.verdicts.map((v) => [v.check, v.action]), [['ast-error', 'note'], ['ast-error', 'note'], ['module-over-law', 'warn'], ['test-deleted', 'would-kick'], ['test-skipped', 'would-kick'], ['blast-radius', 'warn']])
  assert.match(r.verdicts[0].why, /repair 1 of 3/)
  assert.equal(rows(h).filter((l) => /ast-error/.test(l)).length, 2)
  for (let i = 0; i < REPAIRS_PER_RUN; i++) receiptAst(s, w, t, { ast: [['src/d.mjs', 'error', 1, 'x']] })
  assert.match(receiptAst(s, w, t, { ast: [['src/d.mjs', 'error', 1, 'x']] }).verdicts[0].why, /repairs are spent/)
  assert.deepEqual(receiptAst(s, w, t, { exit: 0, rows: [] }), { verdicts: [], repairs: [] }, 'a receipt with no AST fields leaves nothing')
})

// spec: SENTRY-1.0 §2.3 the end form, S-8 ("done" is the foreman's word) · class: W5 malformed
// technique: a good form, "done" as a state, no form · method: readEnd reads; endCheck leaves an end-form row only when it does not read
// sre: does a turn that ends without its form leave a trace the light can read?
test('the (end …) form reads; "done" as a state and a missing form are end-form rows', () => {
  const { h, s } = makeSup()
  const w = fileRun(s, { key: 'r', goal: 'g' })
  const ok = readEnd('Here is the plan. (end (turn 7) (at "2026-10-25T03:14:09Z") (state running) (step 4) (open ((promise "check the disk" (by "15:00")))) (wake (at "15:00")) (said-count 2))')
  assert.deepEqual([ok.ok, ok.turn, ok.state, ok.open, ok.wake], [true, 7, 'running', [{ text: 'check the disk', by: '15:00' }], { at: '15:00' }])
  assert.equal(endCheck(s, w, 'x (end (turn 1) (at "t") (state running) (step 1) (open ()) (wake none) (said-count 0))'), null)
  assert.match(endCheck(s, w, '(end (turn 1) (at "x") (state done) (step 1) (open ()) (wake none) (said-count 0))').why, /"done" is the foreman's word/)
  assert.match(endCheck(s, w, 'I finished everything.').why, /no \(end …\) form/)
  assert.equal(rows(h).filter((l) => /end-form/.test(l)).length, 2)
})
