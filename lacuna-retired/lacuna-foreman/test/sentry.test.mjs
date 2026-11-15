// sentry.test.mjs — unit tests for `sentry.mjs`, the Lacuna Sentry on the foreman's side (LACUNA-SENTRY-1.0).
// owns: the proofs that a claim with no receipt is labelled and, in shadow, only written; that a claim a closed receipt
//   covers is labelled with its id; that a promise with a time opens a promise row and a wake that fires on the sweep;
//   that "done" with no receipt is a claim without one; that out of shadow a kick row and an upstream kick follow; that
//   the slice is bounded; that the 1B's answer labels what the regex left; that the (end …) form reads and refuses "done".
// refuses: to mock sentry.mjs; every test files real runs through intents.mjs on a real Supervisor and a fake clock.
// implements: SENTRY §2 (forms), §3 (the loop), §5 S-1…S-8, §6 F-S1; design §9.
// invariants: "every said at a boundary has a verdict row"; "in shadow, nothing leaves the record"; "a verdict never changes a record".
// faults: F-S1 (late → unsure), F-S2 (a kick in shadow: proven impossible by the shadow test).
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { fileRun, intent, result } from '../intents.mjs'
import { atBoundary, buildSlice, regexPass, readEnd, wakeSweep, gradeForm, gradeSlat, sentryOf, SLICE, KINDS, whenOf } from '../sentry.mjs'

const DEADLINES = { hand: 100, act: 400, beat: 5, mind: 20, hop: 50 }
function host(o = {}) {
  let t = 1_700_000_000, n = 0
  const h = { up: [], letters: [], texts: [], rows: [], tick: (s) => { t += s }, deadlines: DEADLINES, now: () => t, id: () => `w${++n}`, save: () => {},
              upstream: (kind, w, data) => h.up.push({ kind, name: w.name, data }), mail: (m) => h.letters.push(m), contract: (w, text) => h.texts.push(text),
              ledger: (text) => { if (text.startsWith('(verdict ')) h.rows.push(text) }, ...o }   // the verdict rows (Q-D1): one ledger, read by runs.mjs readVerdict
  return h
}

// spec: SENTRY §3 step 3, §5 S-6 "in shadow, nothing leaves the record" · class: J6 a claim no record supports
// technique: a run with no receipts says it acted; the default (shadow) applies
// method: file a run, say "I started the forge", read the verdict rows, the would-kick row, the absence of a kick row and of an upstream kick
// sre: can a mind's claim reach the owner as a kick before the sentry has passed its exam? (it must not)
test('a claim with no receipt is labelled; in shadow it is written and nothing is sent', async () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-1', goal: 'start the forge' })
  const r = await atBoundary(s, w, 'I started the forge on the sentry pairs.')
  assert.equal(r.shadow, true)
  assert.deepEqual(r.sentences.map((x) => x.kind), ['claim-without-receipt'])
  assert.equal(r.would, 1); assert.equal(r.kicks, 0)
  assert.equal(w.contract.kicks.length, 0, 'no kick row in shadow')
  assert.equal(h.up.filter((u) => u.kind === 'kick').length, 0, 'no upstream kick in shadow')
  assert.equal(h.rows.length, 1, 'the ledger row is the record (S-1)')
  assert.equal(sentryOf(w).counts['claim-without-receipt'], 1)
})

// spec: SENTRY §2.2 claim-with-receipt · class: J6 · technique: a closed receipt whose op the sentence names
// method: intent → result closes ticket; say "I ran jobs"; expect claim-with-receipt with the ticket id as evidence
// sre: does a true claim get its receipt pinned beside it, so the grade line can show it?
test('a claim a closed receipt covers is labelled with that receipt', async () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-2', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs', promise: 'the job count', deadline_s: 20 })
  result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })
  const r = await atBoundary(s, w, 'I ran jobs and the count is 3.')
  assert.equal(r.sentences[0].kind, 'claim-with-receipt'); assert.equal(r.sentences[0].evidence, i.ticket)
  assert.equal(r.would, 0)
})

// spec: SENTRY §2.4 promise rows and wakes · S-5 · class: J7 a promise with a time
// technique: time travel on the fake clock to the named hour; the sweep fires the wake
// method: say "I'll check the disk at 3"; expect a promise row, a wake row; tick past; wakeSweep fires once and upstreams `wake`
// sre: when a mind says "at three", does the system own the clock, and does it wake the run exactly once?
test('a promise with a time opens a promise row and a wake that fires once on the sweep', async () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-3', goal: 'g' })
  const r = await atBoundary(s, w, "I'll check the disk at 3.")
  assert.deepEqual(r.sentences.map((x) => x.kind), ['promise'])
  assert.equal(r.promises.length, 1); assert.equal(r.wakes.length, 1)
  const wk = sentryOf(w).wakes[0]
  assert.ok(wk.at > h.now(), 'the wake is in the future')
  assert.equal(wakeSweep(s).length, 0, 'not yet')
  h.tick(wk.at - h.now() + 1)
  const fired = wakeSweep(s)
  assert.deepEqual(fired.map((f) => f.wake), ['w-1'])
  assert.equal(wakeSweep(s).length, 0, 'fired once')
  assert.equal(h.up.filter((u) => u.kind === 'wake').length, 1)
  assert.equal(w.contract.promises[0].state, 'open')
})

// spec: SENTRY §2.3, S-8 "done" is never a mind's state word · class: J6
// technique: the forbidden word with no receipts in the window
test('"done" with no receipt is a claim without one', async () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-4', goal: 'g' })
  const r = await atBoundary(s, w, 'Done.')
  assert.equal(r.sentences[0].kind, 'claim-without-receipt')
})

// spec: SENTRY §3 step 6 (out of shadow) · design §9 the kick · class: J6
// technique: the host says the sentry is out of shadow
// method: same claim; expect a kick row (category no-receipt), an upstream kick, and the fixed kick text
// sre: once the exam passes, does a claim with no receipt reach the run as a kick with the sentence named?
test('out of shadow a claim with no receipt becomes a kick row and an upstream kick', async () => {
  const h = host({ sentryShadow: () => false }); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-5', goal: 'g' })
  const r = await atBoundary(s, w, 'I pushed the branch.')
  assert.equal(r.shadow, false); assert.equal(r.kicks, 1); assert.equal(r.would, 0)
  assert.deepEqual(w.contract.kicks.map((k) => [k.verdict, k.category, k.by]), [['kick', 'no-receipt', 'sentry.mjs']])
  const up = h.up.find((u) => u.kind === 'kick')
  assert.match(up.data.text, /^you said "I pushed the branch\."; no receipt closes it$/)
})

// spec: SENTRY §2.1, S-7 the slice never exceeds the mind's horizon · class: J4 unbounded growth
// technique: a said of 20,000 chars and 40 receipts
test('the slice is bounded: the said is cut and at most 20 receipts ride', async () => {
  const h = host(); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-6', goal: 'g' })
  for (let k = 0; k < 40; k++) { const i = intent(s, w.id, { tool: 'jobs', deadline_s: 20 }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true }) }
  const sl = buildSlice(s, w, 'x'.repeat(20000))
  assert.ok(sl.chars <= SLICE.chars, `chars ${sl.chars}`); assert.ok(sl.receipts.length <= SLICE.receipts)
})

// spec: SENTRY §3 step 5 the 1B for what the regex left · class: J2 record wrong · technique: a fake host.mind answering a label
// method: receipts exist and a sentence names an act with no id: the regex leaves it; the fake 1B says off-task; the grade flag drops
test("the 1B labels what the regex left; off-task drops the grade's flag", async () => {
  const asked = []
  const h = host({ sentryModel: () => 'gemma3:1b', mind: async (req) => { asked.push(req); return "(label 'off-task)" } }); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-7', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs', deadline_s: 20 }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })
  const r = await atBoundary(s, w, 'I restarted the backup run.')
  assert.equal(asked.length, 1); assert.match(asked[0].grammar, /off-task/)
  assert.equal(r.sentences[0].kind, 'off-task'); assert.equal(r.sentences[0].by, '1b')
  assert.equal(gradeForm(s, w).on_task, false)
  assert.match(gradeSlat(gradeForm(s, w)), /\(on-task #f\)/)
})

// spec: SENTRY F-S1 a late sentry leaves unsure · technique: a mind that never answers inside the mind clock (20 s on this host)
test('a mind that is late leaves the sentence unsure and the turn stands', async () => {
  const h = host({ sentryModel: () => 'gemma3:1b', mind: () => new Promise(() => {}) }); const s = new Supervisor(h)
  s.alive.mind = 0.01
  const w = fileRun(s, { key: 'r-8', goal: 'g' })
  const i = intent(s, w.id, { tool: 'jobs', deadline_s: 20 }); result(s, w.id, 'hand', { ticket: i.ticket, op: 'jobs', ok: true })
  const r = await atBoundary(s, w, 'I restarted the backup run.')
  assert.equal(r.sentences[0].kind, 'unsure'); assert.match(r.sentences[0].by, /^late/)
  assert.equal(r.unsure, 1)
})

// spec: SENTRY §2.3 the end form; S-8 · technique: parse three texts
test('the (end …) form reads; "done" as a state is refused; a turn with no form is not over', () => {
  const ok = readEnd('Here is the plan. (end (turn 7) (at "2026-10-25T03:14:09Z") (state running) (step 4) (open ((promise "check the disk" (by "15:00")))) (wake (at "15:00")) (said-count 2))')
  assert.equal(ok.ok, true); assert.equal(ok.turn, 7); assert.equal(ok.state, 'running'); assert.deepEqual(ok.open, [{ text: 'check the disk', by: '15:00' }]); assert.deepEqual(ok.wake, { at: '15:00' })
  const bad = readEnd('(end (turn 1) (at "x") (state done) (step 1) (open ()) (wake none) (said-count 0))')
  assert.equal(bad.ok, false); assert.match(bad.why, /"done" is the foreman's word/)
  assert.equal(readEnd('I finished everything.').ok, false)
})

// spec: SENTRY §2.4 whenOf · technique: table of phrases on a fixed clock
test('a time in a sentence resolves to a future clock on the fake host', () => {
  const now = 1_700_000_000
  assert.ok(whenOf("I'll do it at 3", now) > now)
  assert.equal(whenOf('in 10 minutes', now), now + 600)
  assert.equal(whenOf('in 2 hours', now), now + 7200)
  assert.equal(whenOf('no time here', now), null)
})

// spec: KINDS is the whole label set and the regex pass covers a remark
test('the kinds are the six and a remark is a remark', () => {
  assert.deepEqual(KINDS, ['claim-with-receipt', 'claim-without-receipt', 'promise', 'remark', 'off-task', 'unsure'])
  const rows = regexPass({ said: 'The weather is fine today.', receipts: [], at: 1, step: 1, step_text: 'x', done_check: '' })
  assert.deepEqual(rows.map((r) => r.kind), ['remark'])
})

// spec: SENTRY-2.0 §8 "models warn; code kicks" (K1.10) · class: J6 · technique: a closed receipt in the window, an act sentence the regex
// leaves to the 1B, the 1B answering claim-without-receipt, out of shadow · method: one warn row by the 1b, no kick row, no upstream kick
// sre: can a small mind's reading kick a run? (it must not: only code's certain finding kicks)
test('out of shadow, a claim the 1B labels without a receipt is a warn by the 1b and never a kick; the regex\'s certain claim still kicks', async () => {
  const h = host({ sentryShadow: () => false, sentryModel: () => 'gemma3:1b', mind: async () => "(label 'claim-without-receipt)" }); const s = new Supervisor(h)
  const w = fileRun(s, { key: 'r-9', goal: 'read the disk', hands: ['disk'] })
  const i = intent(s, w.id, { tool: 'disk', args: [] })
  result(s, w.id, 'hand', { ticket: i.ticket, op: 'disk', exit: 0, rows: [] })
  const r = await atBoundary(s, w, 'I pushed the branch.', { shadow: false })
  assert.deepEqual(r.sentences.map((x) => [x.kind, x.by]), [['claim-without-receipt', '1b']])
  assert.equal(r.kicks, 0); assert.equal(r.would, 0)
  assert.equal(w.contract.kicks.length, 0, 'no kick row')
  assert.equal(h.up.filter((u) => u.kind === 'kick').length, 0, 'no upstream kick')
  const row = h.rows.find((l) => l.includes('(check "claim-without-receipt")'))
  assert.match(row, /\(by "1b"\) \(action "warn"\)/)
  const w2 = fileRun(s, { key: 'r-10', goal: 'start the forge', hands: ['disk'] })
  const r2 = await atBoundary(s, w2, 'I started the forge on the sentry pairs.', { shadow: false })
  assert.equal(r2.kicks, 1, 'no receipt at all: the regex is certain and code kicks')
})

