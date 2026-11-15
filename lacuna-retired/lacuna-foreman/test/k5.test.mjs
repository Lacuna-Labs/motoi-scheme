process.env.LACUNA_AUTO_LOADS = '1'   // these tests exercise the automatic swap road, opt-in since 2026-11-04 (the owner decides who is loaded)
// K5 — mail (§7.6, F-11), the run ledger (§7.5) and the broker's wall (§10, F-05).
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { fileRun, intent, result, finishRun } from '../intents.mjs'
import { sendMail, fileName } from '../mail.mjs'
import { runByKey, livingRuns } from '../runs.mjs'
import { admit, release, wallSweep, swapDone, brokerStatus, WALL } from '../broker.mjs'

function host(extra = {}) {
  let t = 1000, n = 0
  const up = [], letters = [], counts = [], rows = []
  return { up, letters, counts, rows, tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {},
           upstream: (kind, w, data) => up.push({ kind, name: w.name, data }), mail: (m) => letters.push(m), mailCount: (id, c) => counts.push([id, c]),
           ledger: (text) => rows.push(text), ...extra }
}

test('a letter is one (mail …) file named <ts>-<from>-<kind>.slat; the same what within an hour raises its count (F-11)', () => {
  const h = host(); const s = new Supervisor(h)
  const w = s.spawn({ name: 'probe', program: `(on 'go (lambda (x) (mail 'self-report "strict fails the same way" '(("fault" "F-07") ("severity" "stuck")))))`, verbs: ['mail'] })
  s.send(w.id, 'go', 0); s.send(w.id, 'go', 0)
  assert.equal(h.letters.length, 1); assert.deepEqual(h.counts, [[h.letters[0].id, 2]])
  const m = h.letters[0]
  assert.equal(m.kind, 'self-report'); assert.equal(m.severity, 'stuck'); assert.equal(m.from, 'probe'); assert.deepEqual(m.evidence, { fault: 'F-07' })
  assert.match(m.text, /^\(mail \(@ \("id" "m-/); assert.match(m.file, /-probe-self-report\.slat$/)
  h.tick(3601); s.send(w.id, 'go', 0)
  assert.equal(h.letters.length, 2, 'an hour later it is a new letter')
  assert.equal(sendMail(s, null, { kind: 'memo', what: 'x' }).ok, false)
  assert.equal(sendMail(s, null, { what: '  ' }).ok, false)
})

test('a run leaves one (run …) row in the ledger when it ends, with its outcome, exit, hands and kicks', () => {
  const h = host({ deadlines: { hand: 10, act: 40, beat: 5, mind: 20, hop: 50 } }); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-1', goal: 'g', hands: ['jobs'], doneCheck: "(get jobs 'ok)" })   // law 6: pass needs a form the foreman checks
  assert.equal(runByKey(s, 'r-1'), w); assert.equal(livingRuns(s)[0].key, 'r-1')
  const i = intent(s, w.id, { tool: 'jobs' }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })
  finishRun(s, w.id, { pass: true })
  assert.equal(h.rows.length, 1)
  assert.match(h.rows[0], /^\(run \(@ \("id" "w1"\) \("cart" null\) \("run" "r-1"\)/)
  assert.match(h.rows[0], /\("first-try" #t\) \("outcome" "pass"\) \("exit" 0\) \("checked-by" "foreman"\) \("rounds" 1\) \("kicks" 0\) \("swaps" 0\) \("hands" 1\)/)
  s.stop(w.id, 'again')
  assert.equal(h.rows.length, 1, 'one row per run')
  assert.equal(runByKey(s, 'r-1'), null)
})

test('the broker admits by the wall: under 1 GB is exit 89; 8 run foremen; MIND_MAX 3 (the governor armed: LACUNA_GOVERNOR=1)', (t) => {
  process.env.LACUNA_GOVERNOR = '1'; t.after(() => { delete process.env.LACUNA_GOVERNOR })   // off by default since the owner's 2026-11-04 ruling
  let avail = 4000
  const s = new Supervisor(host({ memory: () => ({ availMB: avail, wiredMB: 9000 }) }))
  assert.equal(admit(s, 'foreman', { id: 'f1' }).ok, true)
  avail = 900
  assert.deepEqual(admit(s, 'foreman', { id: 'f2' }), { ok: false, exit: 89, fault: 'F-05', why: 'no room: 900 MB non-wired free, under 1024' })
  avail = 4000
  for (let i = 2; i <= WALL.runForemen; i++) assert.equal(admit(s, 'foreman', { id: `f${i}` }).ok, true)
  assert.equal(admit(s, 'foreman', { id: 'f9' }).exit, 89)
  release(s, 'foreman', 'f1'); assert.equal(admit(s, 'foreman', { id: 'f9' }).ok, true)
  for (let i = 0; i < 3; i++) assert.equal(admit(s, 'mind').ok, true)
  assert.match(admit(s, 'mind').why, /MIND_MAX/)
  assert.equal(brokerStatus(s).run_foremen, 8); assert.equal(brokerStatus(s).minds, 3)
})

test('Permutation B with hysteresis: low for 5 min → the 12B as an act; done → every run records swapped-at; high → back', () => {
  let avail = 1500; const acts = []
  const h = host({ memory: () => ({ availMB: avail, wiredMB: 0 }), act: (op, args) => acts.push([op, ...args]) }); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-1', goal: 'g' })
  assert.equal(wallSweep(s).swap, null)
  h.tick(WALL.lowForS - 1); assert.equal(wallSweep(s).swap, null, 'not yet 5 min')
  h.tick(1); assert.equal(wallSweep(s).swap, '12b'); assert.deepEqual(acts, [['switch-brain', '12b']])
  assert.equal(admit(s, 'mind').exit, 89, 'nothing admitted while switching')
  assert.equal(wallSweep(s).swapping, '12b')
  assert.equal(swapDone(s, { to: '12b' }).brain, '12b')
  assert.equal(w.contract.brain, '12b'); assert.equal(w.contract.swapped_at, w.contract.step, 'the step at the swap (§8)')
  assert.equal(h.up.filter((u) => u.kind === 'brain-swap').map((u) => u.data.phase).join(' '), 'begin done')
  avail = 3000; assert.equal(wallSweep(s).swap, null, 'between 2 and 6 GB nothing moves')
  avail = 7000; assert.equal(wallSweep(s).swap, '26b')
  swapDone(s, { to: '26b' }); assert.equal(brokerStatus(s).brain, '26b'); assert.equal(brokerStatus(s).swaps.length, 2)
})

test('the wall undoes only its own swap: a pressed 12B stays when memory is high again (2026-10-23)', async () => {
  const { beginSwap } = await import('../broker.mjs')
  let avail = 7500; const acts = []
  const h = host({ memory: () => ({ availMB: avail, wiredMB: 0 }), act: (op, args) => acts.push([op, ...args]) }); const s = new Supervisor(h)
  assert.equal(beginSwap(s, '12b', 'pressed by the proof', 'proof').swap, '12b')
  swapDone(s, { to: '12b' }); assert.equal(brokerStatus(s).brain, '12b'); assert.equal(brokerStatus(s).by, 'proof')
  const r = wallSweep(s)
  assert.equal(r.swap, null, 'the wall swapped the brain back 22 s after a press'); assert.match(r.held, /does not undo a press/)
  assert.deepEqual(acts, [['switch-brain', '12b']])
  assert.equal(beginSwap(s, '26b', 'pressed back', 'proof').swap, '26b'); swapDone(s, { to: '26b' }); assert.equal(brokerStatus(s).brain, '26b')
})

test('a swap that waits for the owner is held, not begun', () => {
  const h = host({ memory: () => ({ availMB: 100, wiredMB: 0 }), swapArmed: () => false }); const s = new Supervisor(h)
  wallSweep(s); h.tick(WALL.lowForS)
  const r = wallSweep(s)
  assert.equal(r.swap, null); assert.match(r.held, /waits for the owner's press/)
  assert.equal(brokerStatus(s).swapping, null)
})

test('the wall does nothing without a memory reading (never a swap on Infinity)', () => {
  const h = host(); const s = new Supervisor(h)
  const { broker } = { broker: null }
  const st = (s.broker ||= { brain: '12b', swapping: null, lowSince: null, minds: 0, foremen: new Set(), swaps: [] })
  assert.equal(wallSweep(s).swap, null); assert.equal(st.brain, '12b')
})
