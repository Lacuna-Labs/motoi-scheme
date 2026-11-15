// talk-interrupt.test.mjs — THE OWNER TALKS TO A WORKER AND INTERRUPTS IT. Owns: the tests of talk.mjs `interrupt` (pause ·
// resume · stop over a family, and the contract's state, D-8), `readSay` (the text grammar: exactly (say "…")),
// `talkModel` (which mind may answer; the 26B only with need-brain) and `talk` (the mind's answer or the program's words).
// Refuses: the brain and the small minds (host.mind is the test's function); a mock of talk.mjs. Implements: work order
// U5 §3; design §13 (thoughts, interrupt, say; the contract window's keys pause · resume · stop), §6 (the mailbox),
// law 11 (talking never makes a worker act). Invariants (§18): "If a mind's gate is below 90% per class, then its
// verdicts are advice and no notice or kick came from it" — a talk answer is words, never a verb. Faults (§16): none by id.
// coverage: talk.mjs — lines 100% branches 100% functions 100% (2026-10-24, the lane's files alone)
import test from 'node:test'
import assert from 'node:assert/strict'
import { Supervisor } from '../supervisor.mjs'
import { interrupt, readSay, talkModel, talk, TALK } from '../talk.mjs'
import { LAST_RUNG } from '../cascade.mjs'

function host(o = {}) {
  let t = 1000
  let n = 0
  const up = []
  const contracts = []
  return { up, contracts, tick: (s) => { t += s }, now: () => t, id: () => `w${++n}`, save: () => {},
           upstream: (kind, w, data) => up.push({ kind, name: w.name, data }), ...o }
}
const TICK = "(on 'tick (lambda (x) (remember 'n x)))"

// spec: design §13.3 (keys pause · resume · stop) · talk.mjs interrupt ("walking its children") · §6 (a child ≤ its parent)
// class: E3 the strategy family (a parent's pause reaches running children only) · E15 shutdown ordering (stop walks children)
// technique: state-machine walk — every mode × the states it may meet (running, paused, retired, stalled), with a family
// method: interrupt a parent with one running and one paused child; read states, ids, events and each refusal's sentence
// sre: when the owner presses pause on a parent, do its working children pause too, and does a wrong press say why?
test('pause and resume walk the running family only; a wrong mode or state is one sentence; stop retires a stalled worker too', () => {
  const h = host()
  const s = new Supervisor(h)
  const p = s.spawn({ name: 'p', verbs: ['on', 'spawn', 'remember'], program: `${TICK}\n(define (start) 1)` })
  const a = s.spawn({ name: 'a', verbs: ['on', 'remember'], program: TICK, parent: p.id })
  const b = s.spawn({ name: 'b', verbs: ['on', 'remember'], program: TICK, parent: p.id })
  assert.deepEqual(interrupt(s, b.id, 'pause', 'alfred'), { ok: true, ids: [b.id] })
  assert.deepEqual(interrupt(s, p.id, 'pause'), { ok: true, ids: [p.id, a.id] }, 'the paused child is left as it was')
  assert.equal(s.events.filter((e) => e.kind === 'pause').at(-1).why, 'its parent p, by the owner')
  assert.deepEqual(interrupt(s, p.id, 'pause'), { ok: false, why: 'the worker is paused' })
  assert.deepEqual(interrupt(s, p.id, 'freeze'), { ok: false, why: 'mode is pause, resume or stop' })
  assert.deepEqual(interrupt(s, 'w-none', 'pause'), { ok: false, why: 'no such worker' })
  assert.deepEqual(interrupt(s, p.id, 'resume'), { ok: true, ids: [p.id, a.id, b.id] })
  assert.equal(b.pausedBy, null)
  a.state = 'stalled'
  const r = interrupt(s, p.id, 'stop', 'alfred')
  assert.deepEqual(r, { ok: true, ids: [p.id, a.id, b.id] })
  assert.deepEqual([p.state, a.state, b.state], ['retired', 'retired', 'retired'])
  assert.deepEqual(interrupt(s, p.id, 'stop'), { ok: false, why: 'the worker is retired' })
})

// spec: design §8 (the contract: state paused · running · filed) · talk.mjs D-8 ("the contract says paused, and running again")
// class: L5 the record's shape (the contract's state follows the key the owner pressed) · J13 a host with no contract writer
// technique: state-machine walk over pause and resume with step 0 and step 3; a refused press; a host with no `contract`
// method: read the contract's state and the texts the host wrote after each press
// sre: when the owner pauses a run from the phone, does the contract (the record the desk reads) say paused, and filed or
//      running again on resume — never "running" for a run that has not started?
test('the contract says paused on pause, running again on resume (filed if no step ran); a refused press writes nothing', () => {
  const texts = []
  const h = host({ contract: (w, x) => texts.push(x) })
  const s = new Supervisor(h)
  const w = s.spawn({ name: 'c', program: `(lacuna-cart 'c '((does . "d") (done . "e") (agent . ((tier . watch) (verbs . (on remember))))))\n${TICK}` })
  const n = texts.length
  interrupt(s, w.id, 'pause')
  assert.equal(w.contract.state, 'paused')
  interrupt(s, w.id, 'resume')
  assert.equal(w.contract.state, w.contract.step > 0 ? 'running' : 'filed')
  w.contract.step = 3
  interrupt(s, w.id, 'pause')
  interrupt(s, w.id, 'resume')
  assert.equal(w.contract.state, 'running')
  assert.equal(texts.length, n + 4)
  interrupt(s, w.id, 'resume')
  assert.equal(texts.length, n + 4, 'a refused resume writes no contract')
  const s2 = new Supervisor(host())
  const w2 = s2.spawn({ name: 'c', program: `(lacuna-cart 'c '((does . "d") (done . "e") (agent . ((tier . watch) (verbs . (on remember))))))\n${TICK}` })
  assert.equal(interrupt(s2, w2.id, 'pause').ok, true, 'a host with no contract writer: the state still changes')
  assert.equal(w2.contract.state, 'paused')
  interrupt(s2, w2.id, 'stop')
  assert.notEqual(w2.contract.state, 'paused', 'stop is the contract\'s own close, not D-8')
})

// spec: talk.mjs SAY_GRAMMAR ("exactly (say \"…\"): anything else is refused, never run") · law 11 · design §13
// class: W5 malformed (two forms, a symbol, a string head, a nested verb) · J7 hostile input (nothing, unreadable text) · J15 long text
// technique: seeded bounded fuzz (500 cases: random cuts and joins of valid and verb forms) plus the named shapes
// method: readSay each; assert only one (say "string") with text reads ok, cut at 600; every other shape is refused with why
// sre: can a mind's talk answer ever be anything but words — a verb, two forms, a hidden (act …) — and reach the worker?
test('only one (say "…") with words reads; every other shape is refused with a reason; 500 fuzzed answers never read as a verb', () => {
  assert.deepEqual(readSay('  (say "  hello  ")  '), { ok: true, text: 'hello' })
  assert.equal(readSay(`(say "${'x'.repeat(2000)}")`).text.length, TALK.reply)
  assert.match(readSay('(say "a').why, /^it does not read: /)
  for (const [t, why] of [[null, 'not one (say "…") form'], ['say', 'not one (say "…") form'], ['(say "a") (say "b")', 'not one (say "…") form'],
                          ['("say" "a")', 'not one (say "…") form'], ["(act 'pass)", 'talking may only (say "…"), not (act …)'],
                          ['(say)', '(say "…") holds one string'], ['(say "a" "b")', '(say "…") holds one string'], ['(say 5)', '(say "…") holds one string'],
                          ['(say "   ")', '(say "…") holds one string'], ['(say (act \'pass))', '(say "…") holds one string']])
    assert.equal(readSay(t).why, why, String(t))
  let seed = 24
  const rand = (n) => { seed = (seed * 48271) % 2147483647; return seed % n }
  const parts = ['(say "ok")', "(act 'pass)", '(hand \'disk)', '(', ')', '"', ' ', 'say', "'x"]
  for (let i = 0; i < 500; i++) {
    const text = Array.from({ length: 1 + rand(5) }, () => parts[rand(parts.length)]).join('')
    const r = readSay(text)
    if (r.ok) assert.equal(r.text, 'ok', `seed 24 case ${i}: ${text}`)
    else assert.equal(typeof r.why, 'string', `seed 24 case ${i}: ${text}`)
  }
})

// spec: design §10 (the 26B is the last rung; the brain only for need-brain) · talk.mjs talkModel ("the 26B unless the worker holds need-brain")
// class: L3 an act without a press (spending the 26B without the right to ask it) · J13 a job with no model and no ladder
// technique: state-machine walk over the jobs a worker may have: none, a model, a ladder with a small rung, only the 26B, nothing
// method: talkModel each, with and without need-brain; read ok, model and why
// sre: can the owner's idle chat with a watch bot wake the 26B for a worker that may never ask it?
test('talk picks the job\'s model, else its smallest rung, else the foreman\'s default; the 26B only for a worker that may ask the brain', () => {
  const w = (job, verbs = []) => ({ jobs: job ? new Map([['j', { name: 'j', ...job }]]) : undefined, verbs: new Set(verbs) })
  assert.deepEqual(talkModel(w(null)), { ok: false, why: 'it has no mind' })
  assert.deepEqual(talkModel(w({ model: 'gemma3:1b' })), { ok: true, model: 'gemma3:1b', job: 'j' })
  assert.deepEqual(talkModel(w({ rungs: [LAST_RUNG, 'gemma3:270m'] })), { ok: true, model: 'gemma3:270m', job: 'j' })
  assert.deepEqual(talkModel(w({ rungs: [LAST_RUNG] })), { ok: false, why: 'only the 26B could answer, and it may not ask the brain' })
  assert.deepEqual(talkModel(w({ rungs: [LAST_RUNG] }, ['need-brain'])), { ok: true, model: LAST_RUNG, job: 'j' })
  assert.deepEqual(talkModel(w({})), { ok: true, model: null, job: 'j' })
  assert.deepEqual(talkModel({ jobs: new Map([['j', { name: 'j', model: LAST_RUNG }]]) }), { ok: false, why: 'only the 26B could answer, and it may not ask the brain' })
})

// spec: design §13 (talk: a mind answers from a quarantine-safe slice, as (say "…"); else the program) · law 11
// class: J1 a rejection that is not an Error · L4 a claim in `said` (an answer outside the grammar is dropped, never relayed)
// technique: state-machine walk — no mind on the host, a bare-string answer, an answer with certainty, a refused answer,
//            a rejection with a string, the 26B as the talker (the cascade flags), empty words
// method: talk once each; read who answered, the reply, the request the host saw, the counts and the ring
// sre: whatever the mind does when the owner talks, does the owner get one honest answer, and is the worker left unchanged?
test('talk: the mind\'s (say …) when it reads, the program\'s words otherwise; the 26B is asked as the last rung; counts and ring hold', async () => {
  const PROG = "(mind-job 'j '(:needs (line) :labels (a)))\n(on 'x (lambda (v) v))"
  const answers = ['(say "I count lines")', { text: '(say "sure")', certainty: 0.876 }, { text: "(act 'pass)" }, () => Promise.reject('down')]
  const reqs = []
  const h = host({ mind: (req) => { reqs.push(req); const a = answers.shift(); return typeof a === 'function' ? a() : a } })
  const s = new Supervisor(h)
  const w = s.spawn({ name: 't', verbs: ['on', 'mind-job', 'mind'], program: PROG })
  assert.deepEqual(await talk(s, w, '  what do you do?  '), { reply: 'I count lines', by: 'mind' })
  assert.deepEqual(await talk(s, w, 'sure?'), { reply: 'sure', by: 'mind' })
  assert.match(w.thoughts.filter((t) => t.kind === 'answer').at(-1).text, /\(certainty 0\.88\)$/)
  const act = await talk(s, w, 'pass the build')
  assert.equal(act.by, 'program')
  assert.equal(w.mind.last_drop, 'talking may only (say "…"), not (act …)')
  assert.equal((await talk(s, w)).by, 'program')
  assert.match(w.thoughts.filter((t) => t.kind === 'answer').at(-1).text, /^the mind did not answer: down$/)
  assert.deepEqual([w.mind.dropped, w.mind.failed, h.up.some((u) => u.kind === 'act')], [1, 1, false])
  assert.equal(s.events.filter((e) => e.kind === 'talk').at(-1).why, 'the owner: ')
  assert.deepEqual([reqs[0].job, reqs[0].model, reqs[0].cascade, reqs[0].last, reqs[0].untrusted], ['talk', null, false, false, false])
  assert.match(reqs[0].prompt, /^THE OWNER SAYS: what do you do\?\nYOUR STATE: \{"name":"t"/)
  const brainy = s.spawn({ name: 'b', verbs: ['on', 'mind-job', 'mind', 'need-brain'], program: PROG })
  brainy.jobs.get('j').rungs = [LAST_RUNG]
  answers.push('(say "from the 26B")')
  assert.equal((await talk(s, brainy, 'x', 'alfred')).reply, 'from the 26B')
  assert.deepEqual([reqs.at(-1).model, reqs.at(-1).cascade, reqs.at(-1).last], [LAST_RUNG, true, true])
  const off = new Supervisor(host())
  const w3 = off.spawn({ name: 'o', verbs: ['on', 'mind-job', 'mind'], program: PROG })
  assert.equal((await talk(off, w3, 'hi')).by, 'program', 'a foreman with no small mind: the program answers')
  assert.equal(w3.thoughts.at(-1).kind, 'talk')
})
