process.env.LACUNA_AUTO_LOADS = '1'   // these tests exercise the automatic swap road, opt-in since 2026-11-04 (the owner decides who is loaded)
// forge-controls.test.mjs — F2: THE FORGE'S CONTROLS ON THE FOREMAN. Owns: the tests of the pausable header
// (supervisor.mjs pausableOf, the pid from an act's reply, the job's start and end) and the broker's pausable jobs
// (pause · park · resume · control · relieve · the 26B parked for a job · the exam owed to the press), on a real
// Supervisor over the conformance fake host (a clock the test moves; acts, upstream and contract text captured).
// Refuses: files, sockets, the live foreman, a mock of broker.mjs or supervisor.mjs. Implements: MINDS §4.5 (pause =
// SIGSTOP with the mailbox kept and the deadline suspended; park = checkpoint and exit; resume from a park is a press),
// CARDS-2.0 §6.5 (the controls), §8.4 (the 26B parks; the face fronts; swapped-at), §9.3 steps 3, 5, 6.
// Invariants (§18): "a paused worker is not dead"; "if swapped-at is set, the next step started on the new brain from the
// contract"; "an act from the desk is a press ticket or a foreman route". Faults (§16): F-05.
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup, DEADLINES } from '../../../test/conformance/fake-host.mjs'
import { pausableOf } from '../supervisor.mjs'
import { contractExit, readContract, renderContract, contractData } from '../contract.mjs'
import { pauseJob, parkJob, parkDone, resumeJob, signalDone, control, relieve, mustPark, swapDone, wallSweep, brokerStatus,
         broker, JOB_BASES, WALL } from '../broker.mjs'
import { parksBrain, FORGE_BASES } from '../../../lacuna-home/src/pressRoad.js'

const JOB = (extra = '') => `(lacuna-cart 'forge-job '((does . "trains a 270m for signal->label") (done . "trained and scored")
  (agent . ((tier . act) (verbs . (on hand report))))
  (pausable . #t) (checkpoint-every . 100) (memory-mb . 2048) (priority . 5) (base . 270m) (kind . signal->label) ${extra}))
(on 'go (lambda (x) (hand 'jobs)))
(on 'hand (lambda (r) (report 'hand (get r 'op))))
(on 'act (lambda (r) (report 'act (get r 'op))))
(on 'resume (lambda (r) (report 'resumed (get r 'step))))`
const acts = (h, op) => h.acts.filter((a) => a.op === op)
const stops = (w) => (w.contract.stops || []).map((r) => r.kind)
const started = (s, w, pid = 4242) => s.send(w.id, 'act', { op: 'forge', ok: true, rows: { pid, run_dir: '/runs/p-test' } })

// spec: MINDS §4.5 "(pausable #t) (checkpoint-every 100)"; CARDS-2.0 §8.4 "a pausable header and a memory need"
// class: B1 a header field read or lost
// technique: equivalence classes: a cart header with the fields, a spawn option, a cart without them, a plain program
// method: read pausableOf on each; spawn the cart and read w.pausable; send the act reply that started the process and read the pid
// sre: if a job declares itself pausable, does the foreman know it, and know which process to stop?
test('the pausable header: read from a cart, from a spawn option, absent elsewhere; the pid comes from the act reply', () => {
  const p = pausableOf(JOB('(eta-s . 540)'))
  assert.deepEqual([p.checkpointEvery, p.memoryMB, p.priority, p.base, p.kind, p.etaS], [100, 2048, 5, '270m', 'signal->label', 540])
  assert.equal(pausableOf('(lacuna-cart \'x \'((does . "a") (done . "b")))'), null)
  assert.equal(pausableOf('(on \'go (lambda (x) 1))'), null)
  assert.equal(pausableOf('(on \'go (lambda (x) 1))', { pausable: true, priority: 2 }).priority, 2)
  assert.equal(pausableOf('(lacuna-cart \'x \'((does . "a") (done . "b") (pausable . #f)))'), null)
  const { s } = makeSup()
  const w = s.spawn({ program: JOB() })
  assert.equal(w.state, 'running'); assert.equal(w.pausable.base, '270m')
  started(s, w)
  assert.deepEqual([w.pausable.pid, w.pausable.runDir], [4242, '/runs/p-test'])
  const plain = s.spawn({ name: 'plain', program: '(on \'act (lambda (r) 1))' })
  s.send(plain.id, 'act', { op: 'x', rows: { pid: 9 } })
  assert.equal(plain.pausable, null, 'a worker without the header gets no pid record')
})

// spec: MINDS §4.5 pause row ("SIGSTOP … keeps its mailbox (100) and suspends its deadline clock"); the zombie law knows paused is not dead
// class: J14 clock (a deadline that runs while the job sleeps); E10 a message to a sleeping worker
// technique: fake clock: a hand ticket open, pause, move the clock past its deadline, sweep, resume
// method: read the forge-signal acts (stop, then continue, with the pid), the contract state and stops rows, the mailbox,
//         and the ticket's deadline moved by exactly the held span
// sre: if the owner pauses a training job for an hour, does it come back with its reads still waited on, and its messages?
test('pause freezes in frame: SIGSTOP by the hands, mailbox kept, deadline held; resume sends SIGCONT and shifts the clock', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ program: JOB() }); started(s, w)
  s.send(w.id, 'go', 1)
  const due = w.pending[0].deadline_at
  const r = pauseJob(s, w.id, { why: 'person turn' })
  assert.equal(r.ok, true); assert.equal(r.signal, 'SIGSTOP')
  assert.deepEqual(acts(h, 'forge-signal'), [{ op: 'forge-signal', args: [4242, 'stop', w.id, '/runs/p-test'] }])
  assert.equal(w.state, 'paused'); assert.equal(w.contract.state, 'paused')
  assert.deepEqual(stops(w), ['pause']); assert.equal(w.contract.stops[0].why, 'person turn')
  assert.equal(s.send(w.id, 'hand', { op: 'other', ok: true }).queued, 1, 'the mailbox keeps the message')
  h.tick(DEADLINES.hand * 10); s.sweep()
  assert.equal(w.state, 'paused', 'paused is not dead: the sweep leaves it')
  assert.equal(w.pending.length, 1, 'the ticket is still waited on')
  assert.match(pauseJob(s, w.id).why, /the worker is paused/)
  const back = resumeJob(s, w.id)
  assert.equal(back.ok, true); assert.equal(back.signal, 'SIGCONT')
  assert.deepEqual(acts(h, 'forge-signal').at(-1).args, [4242, 'continue', w.id, '/runs/p-test'])
  assert.equal(w.pending[0].deadline_at, due + DEADLINES.hand * 10, 'the deadline moved by the held span')
  assert.equal(w.contract.stops.at(-1).held_s, DEADLINES.hand * 10)
  assert.deepEqual(stops(w), ['pause', 'resume']); assert.equal(w.contract.state, 'filed', 'at step 0 the contract is filed again')
  assert.deepEqual(h.texts.filter(Boolean).slice(-2).map((t) => t.match(/\(state "(\w+)"\)/)[1]), ['paused', 'filed'], 'the contract text is rewritten on each control')
  assert.match(resumeJob(s, w.id).why, /the worker is running/)
})

// spec: MINDS §4.5 park row ("writes its checkpoint … and exits; the foreman records parked-at <step>; a resume starts a new
//       process from the checkpoint"); CARDS-2.0 §6.5 "resume shows the diff first and is a press"
// class: E3 the wrong strategy (an automatic resume of a parked job); B6 one in flight
// technique: state-machine walk: running → park (in flight) → second park → resume mid-park → parkDone → resume unpressed →
//            resume pressed with the diff hash
// method: read the forge-park act, each refusal's words, the park row (parked-at, checkpoint), the (on 'resume) report with
//         the step, and the resume row naming from-park and the diff
// sre: if memory forces a park, does the job come back only when the owner has seen what changed and pressed?
test('park: paused, forge-park sent once, parked-at recorded; a resume from a park waits on the press and carries the diff', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ program: JOB() }); started(s, w)
  const r = parkJob(s, w.id, { why: 'wall' })
  assert.deepEqual([r.ok, r.parking], [true, true])
  assert.deepEqual(acts(h, 'forge-park'), [{ op: 'forge-park', args: [4242, '/runs/p-test', w.id] }])
  assert.equal(w.state, 'paused')
  assert.match(parkJob(s, w.id).why, /in flight/); assert.equal(acts(h, 'forge-park').length, 1)
  assert.match(resumeJob(s, w.id).why, /in flight/)
  const d = parkDone(s, { id: w.id, ok: true, step: 300, checkpoint: 'adapters/0000300_adapters.safetensors', snapshot: { cfg: 'a1' } })
  assert.deepEqual([d.ok, d.parked_at], [true, 300])
  assert.equal(w.pausable.pid, null, 'the process is gone')
  const row = w.contract.stops.at(-1)
  assert.deepEqual([row.kind, row.parked_at, row.checkpoint, row.why], ['park', 300, 'adapters/0000300_adapters.safetensors', 'wall'])
  assert.match(parkJob(s, w.id).why, /parked at step 300 already/)
  const no = resumeJob(s, w.id)
  assert.equal(no.press, true); assert.match(no.why, /a press \(the diff first\)/)
  assert.equal(w.state, 'paused')
  const yes = resumeJob(s, w.id, { pressed: true, diff: 'd1f2' })
  assert.deepEqual([yes.ok, yes.from_park], [true, 300])
  assert.deepEqual([w.reports.at(-1).kind, w.reports.at(-1).data], ['resumed', [300]], "the job's (on 'resume …) gets the checkpoint step")
  assert.deepEqual([w.contract.stops.at(-1).from_park, w.contract.stops.at(-1).diff], [300, 'd1f2'])
  assert.equal(acts(h, 'forge-signal').filter((a) => a.args[1] === 'continue').length, 0, 'a new process, not a SIGCONT')
})

// spec: MINDS §4.5 ("nothing is ever killed mid-step except by its deadline"); law 11 (fail closed on the record)
// class: F2 a partial failure (the act refused; the signal did not land)
// technique: fault injection: parkDone ok=false; signalDone ok=false for stop and for continue; a park with no process
// method: read the park-failed and signal-failed rows, the worker's state after each, and the park row of a job with no pid
// sre: if the hands cannot stop the trainer, does the card still say "paused" while the GPU keeps working?
test('a failed park stays paused and says so; a SIGSTOP that did not land undoes the pause; no process parks at step 0', () => {
  const { s } = makeSup()
  const w = s.spawn({ program: JOB() }); started(s, w)
  parkJob(s, w.id)
  assert.equal(parkDone(s, { id: w.id, ok: false, why: 'pid 4242 is not a forge trainer' }).ok, false)
  assert.equal(w.contract.stops.at(-1).kind, 'park-failed'); assert.equal(w.state, 'paused'); assert.equal(w.pausable.parking, null)
  resumeJob(s, w.id)
  pauseJob(s, w.id)
  assert.equal(signalDone(s, { id: w.id, ok: false, mode: 'stop', why: 'ESRCH' }).ok, false)
  assert.equal(w.state, 'running', 'a process that never stopped is not shown paused')
  assert.match(w.contract.stops.at(-1).why, /^stop: ESRCH/)
  assert.equal(signalDone(s, { id: w.id, ok: true }).ok, true)
  assert.equal(signalDone(s, { id: 'nope' }).ok, false); assert.equal(parkDone(s, { id: 'nope' }).ok, false)
  const bare = s.spawn({ program: JOB() })
  const r = parkJob(s, bare.id)
  assert.deepEqual([r.ok, r.parked_at, r.checkpoint], [true, 0, null])
  assert.deepEqual([bare.contract.stops.at(-2).why, bare.contract.stops.at(-1).why], ['park: pressed', 'pressed'])
  assert.match(parkJob(s, 'nope').why, /no such worker/)
  s.stop(bare.id, 'stopped by the owner')
  assert.match(parkJob(s, bare.id).why, /parked at step 0 already/)
  const other = s.spawn({ program: JOB() }); s.stop(other.id, 'stopped by the owner')
  assert.match(parkJob(s, other.id).why, /the worker is retired/)
})

// spec: CARDS-2.0 §6.5 keys (pause · park · resume through the foreman); the door's interrupt route calls control()
// class: E1 a control on the wrong kind of worker
// technique: decision table: pausable × {pause, park, resume, stop, kill}; plain × the same
// method: call control for each cell; read ok/why and the worker's state
// sre: if the desk presses park on a worker that cannot checkpoint, is it refused in words rather than half-done?
test('control: a pausable job takes pause · park · resume · stop; a plain worker keeps the interrupt and refuses park', () => {
  const { s } = makeSup()
  const w = s.spawn({ program: JOB() })
  assert.equal(control(s, w.id, 'pause').ok, true); assert.equal(control(s, w.id, 'resume').ok, true)
  assert.equal(control(s, w.id, 'park').ok, true)
  assert.equal(control(s, w.id, 'resume', 'the owner', { pressed: true, diff: 'x' }).from_park, 0)
  assert.match(control(s, w.id, 'kill').why, /pause, park, resume or stop/)
  assert.equal(control(s, w.id, 'stop').ok, true); assert.equal(w.state, 'retired')
  const plain = s.spawn({ name: 'plain', program: '(on \'go (lambda (x) 1))' })
  assert.equal(control(s, plain.id, 'pause').ok, true); assert.equal(plain.state, 'paused')
  assert.match(control(s, plain.id, 'park').why, /not pausable/)
  assert.match(pauseJob(s, plain.id).why, /not pausable/); assert.match(resumeJob(s, plain.id).why, /not pausable/)
  assert.equal(control(s, plain.id, 'resume').ok, true)
  assert.match(control(s, 'nope', 'park').why, /no such worker/)
})

// spec: MINDS §4.5 "the broker pauses the lowest-priority pausable job first and only as many as the need requires";
//       "compute pressure pauses … memory pressure parks"
// class: B5 ordering (who is chosen first)
// technique: equivalence classes over priority and age; pairwise (compute, memory) × (one running, one paused, none)
// method: three jobs (priority 7, 3, and a younger 3); relieve compute twice, then memory three times; read each pick
// sre: if a person's turn needs the GPU, does the least important training job yield first, and only one?
test('relieve: compute pauses the lowest priority (the youngest on a tie), memory parks; none left is said', () => {
  const { h, s } = makeSup()
  const hi = s.spawn({ program: JOB('').replace('(priority . 5)', '(priority . 7)') })
  const lo = s.spawn({ program: JOB('').replace('(priority . 5)', '(priority . 3)') })
  h.tick(5)
  const young = s.spawn({ program: JOB('').replace('(priority . 5)', '(priority . 3)') })
  const a = relieve(s, 'compute', 'person turn')
  assert.deepEqual([a.ok, a.id, a.mode], [true, young.id, 'pause'])
  const b = relieve(s, 'compute', 'person turn')
  assert.equal(b.id, lo.id)
  const c = relieve(s, 'memory', 'wall')
  assert.deepEqual([c.id, c.mode], [young.id, 'park'], 'memory parks the lowest priority, paused or not, the youngest first')
  relieve(s, 'memory', 'wall'); relieve(s, 'memory', 'wall')
  assert.equal(hi.pausable.parked.step, 0)
  assert.match(relieve(s, 'memory', 'wall').why, /no pausable job to park/)
  assert.match(relieve(s, 'compute', 'x').why, /no pausable job to pause/)
})

// spec: CARDS-2.0 §8.4 (the broker parks the 26B; the face fronts; swapped-at on the contract; back when the job ends);
//       §9.3 step 6 ("the exam waits on the press"); MINDS §4.5 Permutation T
// class: M6 memory pressure; E3 an automatic action the owner did not press (the exam)
// technique: state-machine walk with the fake host's acts: an E2B job starts → park act → swapDone → wall held → ends with pass
// method: read the forge-brain acts (park, then unpark), brokerStatus (brain, parked_for, face_says with minutes), the
//         contract's swapped-at, the wall's held word, the exam-owed row and the absence of any exam act
// sre: if a training job needs the whole box, does the desk keep answering, say why, and come back when the job is done?
test('an E2B job parks the 26B: the face fronts and says when it is back; the job ends, the 26B returns, the exam waits on the press', () => {
  const m = { availMB: 9000, wiredMB: 0 }
  const { h, s } = makeSup({ memory: () => m })
  const run = s.spawn({ name: 'other run', program: '(lacuna-cart \'other \'((does . "a") (done . "b")))' })
  const w = s.spawn({ program: JOB('(eta-s . 540)').replace('(base . 270m)', '(base . e2b)') })
  assert.deepEqual(acts(h, 'forge-brain'), [{ op: 'forge-brain', args: ['park'] }])
  assert.equal(brokerStatus(s).swapping.to, 'e2b')
  swapDone(s, { ok: true })
  const st = brokerStatus(s)
  assert.equal(st.brain, 'e2b'); assert.equal(st.parked_for.job, w.id)
  assert.equal(st.face_says, 'The 26B is parked for the forge; back in about 9 minutes.')
  assert.equal(run.contract.brain, 'e2b'); assert.equal(run.contract.swapped_at, 0, 'swapped-at is on every living contract')
  assert.match(wallSweep(s).held, /parked for the forge/)
  contractExit(s, w, 0, 'pass', { checked: true })
  s.stop(w.id, 'done: trained and scored')
  assert.deepEqual(acts(h, 'forge-brain').at(-1), { op: 'forge-brain', args: ['unpark'] })
  assert.deepEqual(h.up.filter((u) => u.kind === 'exam-owed').map((u) => u.data), [{ run: w.id, base: 'e2b', kind: 'signal->label', why: "the exam waits on the owner's press" }])
  assert.equal(h.acts.filter((a) => /exam/.test(a.op)).length, 0, 'no exam runs on its own')
  swapDone(s, { ok: true, to: '26b' })
  assert.equal(brokerStatus(s).brain, '26b'); assert.equal(brokerStatus(s).face_says, null)
  const failed = s.spawn({ program: JOB() }); s.stop(failed.id, 'stopped by the owner')
  assert.equal(h.up.filter((u) => u.kind === 'exam-owed').length, 1, 'a stopped job owes no exam')
})

// spec: CARDS-2.0 §8.4 (the wall says the 26B must go); broker WALL.admitMB 1,024; one swap at a time
// class: M6 memory pressure (boundary); B6 one in flight (the job ends while the park is in flight)
// technique: boundary: 270M need 2,048 MB at 3,072 / 3,071 MB free; a second parking job; a job ended mid-park
// method: read the forge-brain acts and parked_for after each spawn and end; swapDone after an early end brings the 26B back
// sre: if the trainer would leave the desk without memory, does the 26B leave first, and never stay parked for a job that is gone?
test('a 270M job parks the 26B only when it would leave under 1,024 MB; a job ended mid-park still brings the 26B back', () => {
  const m = { availMB: WALL.admitMB + 2048, wiredMB: 0 }
  const { h, s } = makeSup({ memory: () => m })
  const fits = s.spawn({ program: JOB() })
  assert.equal(acts(h, 'forge-brain').length, 0, '3,072 MB free less 2,048 leaves 1,024: it fits')
  s.stop(fits.id, 'stopped by the owner')
  m.availMB -= 1
  const tight = s.spawn({ program: JOB() })
  assert.equal(acts(h, 'forge-brain').length, 1); assert.equal(broker(s).parkedFor.job, tight.id)
  s.stop(tight.id, 'stopped by the owner')
  assert.equal(acts(h, 'forge-brain').length, 1, 'one swap at a time: the unpark waits for the park to land')
  swapDone(s, { ok: true })
  assert.deepEqual(acts(h, 'forge-brain').at(-1).args, ['unpark']); assert.equal(brokerStatus(s).swapping.to, '26b')
  swapDone(s, { ok: true, to: '26b' })
  const a = s.spawn({ program: JOB().replace('(base . 270m)', '(base . e4b)') }); swapDone(s, { ok: true })
  const b = s.spawn({ program: JOB().replace('(base . 270m)', '(base . e4b)') })
  s.stop(a.id, 'stopped by the owner')
  assert.equal(broker(s).parkedFor.job, b.id, 'the second big job keeps the 26B parked')
  assert.equal(brokerStatus(s).brain, 'e2b')
})

// spec: design §6 change 5 (a worker comes back from its checkpoint); MINDS §4.5 (a parked job resumes only from its checkpoint)
// class: R2 a restart mid-state
// technique: snapshot: park a job, take its contract, resume it on a fresh supervisor as a foreman restart does
// method: read the resumed worker's pausable.parked and the refusal of an unpressed resume
// sre: if the foreman restarts while a job is parked, does it come back parked rather than as a fresh start?
test('a parked job stays parked across a foreman restart (its contract carries the park row)', () => {
  const { s } = makeSup()
  const w = s.spawn({ program: JOB() }); started(s, w)
  parkJob(s, w.id); parkDone(s, { id: w.id, ok: true, step: 200, checkpoint: 'c200' })
  const { s: s2 } = makeSup()
  const back = s2.resume({ id: w.id, name: w.name, program: w.program, tier: w.tier, kv: {}, contract: JSON.parse(JSON.stringify(w.contract)) })
  assert.deepEqual([back.pausable.parked.step, back.pausable.parked.checkpoint], [200, 'c200'])
  assert.equal(back.pausable.pid, null)
})

// spec: CARDS-2.0 §6.5 ("the desk writes an estimate … whether the 26B parks") — the desk and the broker apply one rule
// class: C2 two copies of one rule drift
// technique: pairwise over every base × free memory {Infinity, 9,000, 3,072, 3,071, 1,500} × brain {26b, 12b}
// method: compare pressRoad.parksBrain with broker.mustPark on each cell; compare the bases tables
// sre: if the estimate says "the 26B stays", does the broker agree when the job starts?
test('the desk estimate and the broker agree on whether the 26B parks, for every base and wall reading', () => {
  assert.deepEqual(Object.keys(FORGE_BASES).sort(), Object.keys(JOB_BASES).sort())
  for (const [base, row] of Object.entries(JOB_BASES)) {
    assert.deepEqual([FORGE_BASES[base].needMB, FORGE_BASES[base].beside26b], [row.needMB, row.beside26b], base)
    for (const availMB of [Infinity, 9000, 3072, 3071, 1500]) for (const brain of ['26b', '12b']) {
      assert.equal(parksBrain({ base, availMB, brain }), mustPark({ base, availMB, brain }).park, `${base} ${availMB} ${brain}`)
    }
  }
  assert.match(mustPark({ base: 'x', needMB: null }).why, /fits beside the 26B/)
})

// spec: design §6 change 5 (3 crashes in 300 s → the grave, F-04); CARDS-2.0 §8.4 (the 26B back when the job ends, however it ends)
// class: F1 a crash loop; E3 an automatic action (an exam for a job that failed)
// technique: fault injection: a handler that throws, sent three times inside the window
// method: read the worker's state, the forge-brain unpark act, and that no exam-owed row was written
// sre: if the training job dies, does the desk get its 26B back without anyone pressing anything?
test('a buried job brings the 26B back and owes no exam', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ program: JOB('').replace('(base . 270m)', '(base . e4b)') + "\n(on 'boom (lambda (x) (car '())))" })
  swapDone(s, { ok: true })
  for (let i = 0; i < 3; i++) s.send(w.id, 'boom', 1)
  assert.equal(w.state, 'grave')
  assert.deepEqual(acts(h, 'forge-brain').map((a) => a.args[0]), ['park', 'unpark'])
  assert.equal(h.up.filter((u) => u.kind === 'exam-owed').length, 0)
})

// spec: contract.mjs (one writer, one reader: every field rendered is read back in its one order); MINDS §4.5 (the foreman
//       records `parked-at <step>`); CARDS-2.0 §6.5 ("the contract records them")
// class: C1 a field written that no reader reads; C4 old files (a contract with no stops keeps its bytes)
// technique: round trip: pause, park, resume rows rendered to CONTRACT.slat text and read back by readContract
// method: render after each control; read back; compare the stops rows; render a contract with no stops and find no field
// sre: if the foreman restarts or the desk reads the file, does the file itself say when the job was paused and where it parked?
test('the contract file carries (stops …): pause, park and resume render and read back; a contract without stops is unchanged', () => {
  const { h, s } = makeSup()
  const plain = s.spawn({ program: '(lacuna-cart \'other \'((does . "a") (done . "b")))' })
  assert.doesNotMatch(renderContract(plain.contract), /\(stops /)
  assert.deepEqual(readContract(renderContract(plain.contract)).stops, [])
  const w = s.spawn({ program: JOB() }); started(s, w)
  pauseJob(s, w.id, { why: 'person turn' }); resumeJob(s, w.id)
  parkJob(s, w.id, { why: 'wall' }); parkDone(s, { id: w.id, ok: true, step: 300, checkpoint: 'adapters/0000300_adapters.safetensors', snapshot: { cfg: 'a1', meta: null, step: 300 } })
  const text = h.texts.filter(Boolean).at(-1)
  assert.match(text, /\(stops /)
  const back = readContract(text)
  assert.deepEqual(back.stops.map((r) => r.kind), ['pause', 'resume', 'pause', 'park'])
  assert.deepEqual([back.stops[3].parked_at, back.stops[3].checkpoint, back.stops[3].snapshot.cfg, back.stops[0].why], [300, 'adapters/0000300_adapters.safetensors', 'a1', 'person turn'])
  assert.match(contractData(w.contract), /stops/)
})

// spec: the foreman host's act road (foreman.mjs → broker.actReply): each broker act's reply lands on its broker word
// class: E10 a reply routed to the wrong handler
// technique: decision table over the four ops × {0, 12, 15}
// method: call actReply for each; read the worker's state and stops rows, and the broker's brain
// sre: if the hands answer a park, does the park land on the job, and a swap on the brain?
test('actReply lands each broker act on its word: signal, park (15 still parks), forge-brain and switch-brain', async () => {
  const { actReply } = await import('../broker.mjs')
  const { s } = makeSup()
  const w = s.spawn({ program: JOB() }); started(s, w)
  pauseJob(s, w.id)
  assert.equal(actReply(s, 'forge-signal', [4242, 'stop', w.id])({ exit: 12, why: 'not a trainer' }).ok, false)
  assert.equal(w.state, 'running')
  parkJob(s, w.id)
  const p = actReply(s, 'forge-park', [4242, '/runs/p', w.id])({ exit: 15, why: 'killed at the deadline', rows: { parked_at: 200, checkpoint: 'c200', snapshot: {} } })
  assert.deepEqual([p.ok, p.parked_at], [true, 200])
  const b = await import('../broker.mjs')
  b.beginSwap(s, 'e2b', 'test', 'forge')
  assert.equal(actReply(s, 'forge-brain', ['park'])({ exit: 0 }).brain, 'e2b')
  b.beginSwap(s, '26b', 'test', 'forge')
  assert.equal(actReply(s, 'forge-brain', ['unpark'])({ exit: 0 }).brain, '26b')
  b.beginSwap(s, '12b', 'test', 'owner')
  assert.equal(actReply(s, 'switch-brain', ['12b'])({ exit: 0 }).brain, '12b')
})

// spec: CARDS-2.0 §6.5 (pause · park · resume through the foreman); foreman.mjs the interrupt route calls broker.control
// class: E1 a control on the wrong road (the door bypassing the broker)
// technique: the real foreman daemon on a scratch box (foreman-box.mjs boot: scratch dirs, its own port, no live daemon)
// method: spawn the pausable job through POST /workers; interrupt park, resume unpressed, resume pressed with a diff; read
//         the statuses and the worker's thoughts and contract rows through the door
// sre: if the desk presses park on a training job, does the live door take the broker's road, and refuse an unpressed resume?
test('the door: interrupt park goes through the broker; an unpressed resume of a parked job is 409; the pressed one resumes', async () => {
  const { boot } = await import('./foreman-box.mjs')
  const cleanups = []
  try {
    const { f } = await boot({ after: (fn) => cleanups.push(fn) }, { tag: 'f2door' })
    const w = (await f.call('POST', '/workers', { name: 'forge-job', program: JOB(), tier: 'act' })).body.worker
    assert.equal(w.state, 'running')
    const park = await f.call('POST', `/workers/${w.id}/interrupt`, { mode: 'park', by: 'the owner' })
    assert.equal(park.status, 200); assert.equal(park.body.parked_at, 0)
    const no = await f.call('POST', `/workers/${w.id}/interrupt`, { mode: 'resume', by: 'the owner' })
    assert.equal(no.status, 409); assert.equal(no.body.press, true)
    const yes = await f.call('POST', `/workers/${w.id}/interrupt`, { mode: 'resume', by: 'alfred', pressed: true, diff: '0123456789abcdef' })
    assert.equal(yes.status, 200); assert.equal(yes.body.from_park, 0)
    const c = await f.call('GET', `/contracts/${w.id}`)
    assert.match(c.text, /\(stops /)
    const plain = (await f.call('POST', '/workers', { name: 'plain', program: "(on 'go (lambda (x) 1))" })).body.worker
    assert.equal((await f.call('POST', `/workers/${plain.id}/interrupt`, { mode: 'park' })).status, 409)
  } finally { for (const fn of cleanups.reverse()) await fn() }
})

// spec: CARDS-2.0 §9.3 step 5 "the card says paused at step N" (F5) · MINDS §4.5
// class: B1 a field read from the wrong record (the contract's step, not the trainer's)
// technique: the hands' reply carries the trainer's step; a later reply and a pause with no pid keep theirs
// method: pause, deliver signalDone with step 26; read the pause row on the contract object and in the rendered text
// sre: when the owner pauses at step 26, does the record say 26, or the contract's 0?
test('the pause row names the trainer\'s step from the hands\' reply, written once', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ program: JOB() }); started(s, w)
  pauseJob(s, w.id)
  assert.equal(w.contract.stops.at(-1).step, null, 'null until the hands read the trainer')
  signalDone(s, { id: w.id, mode: 'stop', ok: true, step: 26 })
  assert.equal(w.contract.stops.at(-1).step, 26)
  assert.match(h.texts.filter(Boolean).at(-1), /"kind" "pause"[^@]*?"step" 26/)
  signalDone(s, { id: w.id, mode: 'stop', ok: true, step: 99 })
  assert.equal(w.contract.stops.at(-1).step, 26, 'a later reply never rewrites it')
  const q = s.spawn({ program: JOB() })
  pauseJob(s, q.id)
  assert.equal(q.contract.stops.at(-1).step, 0, 'no process yet: the contract\'s step, said as it was')
})

// spec: FINAL-TEST §4 "a pause pressed in the first 2 s … freezes the worker but not the trainer" (fixed 2026-10-25)
// class: J1 a race between a press and the process it names
// technique: fake host: pause before the start's reply names the pid, then the reply; and a resume before the pid
// sre: if the owner pauses in the job's first seconds, does the trainer stop the moment it exists — and only then?
test('a pause pressed before the trainer starts sends its SIGSTOP when the pid arrives, once; a resume before the pid cancels it', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ program: JOB() })
  const r = pauseJob(s, w.id)
  assert.equal(r.ok, true); assert.equal(r.signal, null); assert.deepEqual(acts(h, 'forge-signal'), [])
  started(s, w)
  assert.deepEqual(acts(h, 'forge-signal'), [{ op: 'forge-signal', args: [4242, 'stop', w.id, '/runs/p-test'] }])
  s.send(w.id, 'act', { op: 'forge', ok: true, rows: { pid: 4242, run_dir: '/runs/p-test' } })
  assert.equal(acts(h, 'forge-signal').length, 1, 'never a second SIGSTOP')
  assert.equal(resumeJob(s, w.id).signal, 'SIGCONT')

  const b = makeSup()
  const v = b.s.spawn({ program: JOB() })
  pauseJob(b.s, v.id); resumeJob(b.s, v.id); started(b.s, v)
  assert.deepEqual(acts(b.h, 'forge-signal'), [], 'resumed before the trainer existed: nothing to stop')
})

// spec: P-2026-11-01-the-eye-loaded-the-ci (the CI's final red: a park of a running job sent the stop and the park at once; the
//       hands' two checks finished in either order, the stop landed last, and the trainer held SIGTERM pending to the deadline)
// class: B6 one in flight; F2 a partial failure (a stop that misses a trainer already ending)
// technique: state walk: a running job parked; a paused job parked while its stop is in flight, then that stop fails
// method: read the acts after each park, the pause row, the worker's state and its parking after the failed stop
// sre: can a park leave the trainer stopped with nothing to wake it, or a parking job shown running?
test('a park of a running job is one act, the park; a stop that fails while a park is in flight resumes nothing', () => {
  const { h, s } = makeSup()
  const w = s.spawn({ program: JOB() }); started(s, w)
  const r = parkJob(s, w.id)
  assert.deepEqual([r.ok, r.parking, w.state], [true, true, 'paused'])
  assert.deepEqual(acts(h, 'forge-signal'), [], 'no SIGSTOP beside the park: two acts in flight raced')
  assert.deepEqual(acts(h, 'forge-park').map((a) => a.args), [[4242, '/runs/p-test', w.id]])
  const pause = w.contract.stops.at(-1)
  assert.deepEqual([pause.kind, pause.why, pause.step], ['pause', 'park: pressed', w.contract.step ?? null], 'the run\'s own step: no SIGSTOP will fill it')
  const v = s.spawn({ program: JOB() }); started(s, v, 4343)
  pauseJob(s, v.id)   // the owner's pause; its stop is in flight when the park is pressed
  parkJob(s, v.id)
  assert.deepEqual(acts(h, 'forge-signal').map((a) => a.args.slice(0, 2)), [[4343, 'stop']])
  assert.equal(signalDone(s, { id: v.id, ok: false, mode: 'stop', why: 'ESRCH' }).ok, false)
  assert.equal(v.state, 'paused', 'the park owns the process: a stop that missed it does not resume the job')
  assert.ok(v.pausable.parking, 'the park is still in flight')
  assert.deepEqual(parkDone(s, { id: v.id, ok: true, step: 40, checkpoint: 'adapters/0000040_adapters.safetensors' }).parked_at, 40)
})
