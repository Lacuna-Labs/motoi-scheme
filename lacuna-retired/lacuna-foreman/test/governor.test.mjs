process.env.LACUNA_AUTO_LOADS = '1'   // these tests exercise the automatic swap road, opt-in since 2026-11-04 (the owner decides who is loaded)
// governor.test.mjs — E1.3: THE BOX GOVERNOR. Owns: the tests of governor.mjs on a fake host (makeSup: a clock the test
// moves, the ledger, the letters and the acts captured) with the hands' reads replaced by a reader the test sets, a box
// profile written to scratch, and the fake engine of the swap road on a unix socket: the level from the two readings and the
// stale rule; every act and its row; the drain closing admission and holding while nothing reads; the park word acted on
// once; the price of a load with its numbers (the 10-30 swap refused before anything stops); the engine's own `(status)`
// after a swap. Refuses: the live hands, the live engine, ~/lacuna-world. Implements: E1.3 gate ("pressure levels drive the
// acts; a swap mid-generation drains first; no act without a record"). Invariants: "no act without a record"; "a refused
// load names the number it needed". Faults: F-05, F-C1.
// The acts run only under LACUNA_GOVERNOR=1 (`armed` below); off, the default since the owner's word of 2026-11-04, the
// governor reports and every price admits with its figure (the last test).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { GOVERNOR, governor, levelOf, init, handleCast, handleInfo, handleCall, boxRow, engineStatus } from '../governor.mjs'
import { admit, beginSwap, broker, wallSweep, checkServing, swapDone, turnHold } from '../broker.mjs'

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'swap-road')
// vm_stat's text for `mb` MB available (free pages only; 16 KB pages)
const vm = (mb) => `Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: ${Math.round(mb * 1e6 / 16384)}.\nPages active: 1.\nPages inactive: 0.\nPages speculative: 0.\nPages wired down: 1000000.\n`
const BOX = `(box (name "test") (memory-mb 34359) (wired-limit-mb 27917) (admit-floor-mb 1500) (source "test"))
(mind (id e4b) (tag "gemma4:e4b-it-qat") (seat brain) (profile desk) (use-mb 6474) (source "measured: lme-desk.log:1993"))
(mind (id 12b) (tag "gemma4:12b-it-qat") (seat brain) (profile desk) (use-mb 11319) (prefill-tok-s 240) (source "measured: lme-desk.log:1974"))
(mind (id 31b) (tag "gemma4:31b-it-qat") (seat brain) (use-mb null) (source "unmeasured"))
`
function scratch() {
  fs.mkdirSync('/private/tmp/lacuna-unit', { recursive: true })
  const d = fs.mkdtempSync('/private/tmp/lacuna-unit/gov-')
  fs.writeFileSync(path.join(d, 'box.slat'), BOX)
  return d
}
// a governor on a fake host whose hands answer what `say` holds now
function gov(o = {}) {
  const { h, s } = makeSup()
  const say = { pressure: { ok: true, level: 1, seq: 0, changes: [] }, coast: { ok: true, vm: vm(8000) }, ...o }
  const d = scratch()
  const g = governor(s, { read: async (op) => (op === 'pressure' ? say.pressure : say.coast), boxFile: path.join(d, 'box.slat'), deskSock: path.join(d, 'none.sock') })
  return { h, s, g, say, d }
}
const rows = (h, head) => h.rows.filter((r) => r.startsWith(`(${head} `))
// the acting governor (refuse, evict, drain, park), restored by LACUNA_GOVERNOR=1 for one test
const armed = (fn) => async () => { process.env.LACUNA_GOVERNOR = '1'; try { await fn() } finally { delete process.env.LACUNA_GOVERNOR } }

// spec: ROAD-TO-1.0 Category 5 D2 (one source: the hands' pressure + the coast sample); GOVERNOR lines; F-C1
// class: M6 memory pressure; J13 an absent or stale reading
// technique: boundary over both readings (2,048 / 1,024 MB; the kernel's 1 / 2 / 4) and the 30 s stale line
// method: levelOf on states built by handleCast at each boundary; the worst reading wins; past 30 s the level is unknown
// sre: does the governor read the box the way the kernel and vm_stat both say, and refuse to decide on an old reading?
test('the level is the worse of the two fresh readings; past 30 s a reading decides nothing (unknown)', () => {
  const at = 1000
  const s = (mb, p) => handleCast({ t: 'pressure', level: p, at }, handleCast({ t: 'coast', vm: vm(mb), at }, init(at)))
  assert.equal(levelOf(s(8000, 1), at).level, 'normal')
  assert.equal(levelOf(s(GOVERNOR.warnMB - 1, 1), at).level, 'warn')
  assert.equal(levelOf(s(GOVERNOR.warnMB + 1, 1), at).level, 'normal')
  assert.equal(levelOf(s(GOVERNOR.criticalMB - 1, 1), at).level, 'critical')
  assert.equal(levelOf(s(8000, 2), at).level, 'warn')
  const crit = levelOf(s(8000, 4), at)
  assert.equal(crit.level, 'critical'); assert.match(crit.why, /8000 MB available, the kernel's pressure critical/); assert.equal(crit.source, 'coast+pressure')
  assert.equal(levelOf(s(8000, 4), at + GOVERNOR.staleS).level, 'critical', '30 s is still fresh')
  assert.equal(levelOf(s(8000, 4), at + GOVERNOR.staleS + 1).level, 'unknown')
  const onlyPressure = handleCast({ t: 'pressure', level: 2, at }, init(at))
  assert.deepEqual([levelOf(onlyPressure, at).level, levelOf(onlyPressure, at).source], ['warn', 'pressure'])
  assert.equal(levelOf(init(at), at).level, 'unknown')
  assert.equal(handleCast({ t: 'coast', vm: '' , at }, init(at)).coastAt, null, 'no page counts: no reading')
  assert.equal(handleCast({ t: 'pressure', level: 9, at }, init(at)).pressure, null, 'a level the kernel does not use: no reading')
  assert.equal(handleCast({ t: 'other' }, init(at)).level, 'unknown')
})

// spec: docs/eng/VIDEO-PASS-2026-10-31.md A2 (Activity Monitor at 03:19: 8.47 GB swapped, 9.45 GB compressed, while the governor read
// the pressure level only) · class: M6 memory pressure · technique: a sample with the compressor over its line; two samples with
// swap-outs between them; samples under both lines · method: levelOf, its why, the answer's numbers · sre: does the governor see a
// box that compresses and swaps hard while the kernel still says normal, and say so without draining?
test('compression over its line or swap-outs between samples make the level warn with the number, never critical; the answer carries both', () => {
  const at = 1000
  const vmx = (mb, compMB = 0, swapouts = 0) => `${vm(mb)}\nPages occupied by compressor: ${Math.round(compMB * 1e6 / 16384)}.\nSwapouts: ${swapouts}.`
  const press = (st, t) => handleCast({ t: 'pressure', level: 1, at: t }, st)
  const one = press(handleCast({ t: 'coast', vm: vmx(8000, GOVERNOR.compressedWarnMB + 100), at }, init(at)), at)
  const l1 = levelOf(one, at)
  assert.equal(l1.level, 'warn'); assert.match(l1.why, /^8000 MB available, \d+ MB compressed \(over \d+\), the kernel's pressure normal$/)
  const s0 = handleCast({ t: 'coast', vm: vmx(8000, 0, 1000), at }, init(at))
  const s1 = handleCast({ t: 'coast', vm: vmx(8000, 0, 1000 + Math.round(2 * GOVERNOR.swapWarnMBPerS * 10 * 1e6 / 16384)), at: at + 10 }, s0)
  const l2 = levelOf(press(s1, at + 10), at + 10)
  assert.equal(l2.level, 'warn'); assert.match(l2.why, /swapping out 2(\.0)? MB\/s \(over 1\)/)
  assert.equal(levelOf(press(handleCast({ t: 'coast', vm: vmx(8000, 1000, 5), at }, init(at)), at), at).level, 'normal', 'under both lines')
  assert.equal(levelOf(press(handleCast({ t: 'coast', vm: vmx(8000, 30000), at }, init(at)), at), at).level, 'warn', 'compression alone never drains')
  const reply = handleCall({ t: 'answer', now: at }, one).reply
  assert.ok(reply.compressedMB > GOVERNOR.compressedWarnMB); assert.equal(reply.swapMBPerS, null, 'one sample has no rate')
  assert.equal(handleCall({ t: 'answer', now: at + 10 }, press(s1, at + 10)).reply.swapMBPerS, 2)
})

// spec: E1.3 ("pressure levels drive the acts"; acts: admit, refuse with the number, drain, park through the hands); "no act without a record"
// class: M6 memory pressure; L5 the record's shape
// technique: state-machine walk on the fake clock: normal → critical → normal for 59 s → 60 s; a pausable job to park
// method: each sense() tick; the ledger's (governor …) rows against the acts; admission 89 while draining; the park word
//         acted on once by the broker's sweep (one forge-park act), then cleared; the drain lifts after 60 s of calm
// sre: when the box runs out of memory, does new work stop, does one job park, and does each step leave a row?
test('critical memory drains and parks once, each act with its row; admission is 89 while it drains; 60 s of calm lifts it', armed(async () => {
  const { h, s, g, say } = gov()
  assert.equal((await g.sense()).level, 'normal')
  assert.deepEqual(rows(h, 'governor').length, 1, 'unknown → normal is a row')
  const job = s.spawn({ program: `(lacuna-cart 'forge-job '((does . "trains a 270m") (done . "trained") (agent . ((tier . act) (verbs . (on hand report))))
  (pausable . #t) (priority . 1) (base . 270m)))\n(on 'go (lambda (x) (hand 'jobs)))` })
  job.pausable.pid = 4242
  say.coast = { ok: true, vm: vm(800) }
  const a = await g.sense()
  assert.deepEqual([a.level, a.drain, a.park, a.admit], ['critical', true, true, false])
  const acts = rows(h, 'governor').slice(1).map((r) => r.match(/\("act" "([a-z]+)"\)/)[1])
  assert.deepEqual(acts, ['level', 'drain', 'park'], 'three acts, three rows')
  assert.match(rows(h, 'governor')[2], /\("on" #t\).*\("avail-mb" 800\)/)
  const r = admit(s, 'mind')
  assert.deepEqual([r.ok, r.exit], [false, 89]); assert.match(r.why, /no room: the box drains \(800 MB available/)
  wallSweep(s)
  // one act: the park's SIGCONT and SIGTERM; a SIGSTOP beside it raced it (P-2026-11-01-the-eye-loaded-the-ci)
  assert.deepEqual(h.acts.map((x) => x.op), ['forge-park'], 'the lowest pausable job parks through the hands, one act')
  assert.equal(g.answer().park, false, 'the broker said it acted')
  wallSweep(s)
  assert.equal(h.acts.length, 1, 'once an episode')
  await g.sense()
  assert.equal(rows(h, 'governor').length, 4, 'a critical tick with nothing new to do writes nothing')
  say.coast = { ok: true, vm: vm(8000) }
  await g.sense(); h.tick(GOVERNOR.calmS - 1); await g.sense()
  assert.equal(g.answer().drain, true, '59 s of calm is not 60')
  h.tick(1); await g.sense()
  assert.equal(g.answer().drain, false)
  assert.match(rows(h, 'governor').at(-1), /\("act" "drain"\).*\("why" "below critical for 60 s: 8000 MB available/)
  assert.equal(admit(s, 'mind').ok, true)
}))

// spec: E1.3 (fail closed: a decision on no reading is never taken); F-C1; SRE appendix B (fail sanely)
// class: J13 an absent reading (the hands go down mid-drain)
// technique: critical, then no reading for 60 s and more
// method: the drain holds while the level is unknown; the answer carries no number; a real calm reading then lifts it after 60 s
// sre: if the hands die while the box is short of memory, does the governor keep the door shut instead of guessing it is fine?
test('no reading is not calm: the drain holds while the level is unknown, and the answer carries no number', armed(async () => {
  const { h, g, say } = gov({ coast: { ok: true, vm: vm(800) } })
  await g.sense()
  say.coast = { ok: false, why: 'the hands are not up' }; say.pressure = { ok: false, why: 'the hands are not up' }
  h.tick(GOVERNOR.staleS + 1); await g.sense(); h.tick(GOVERNOR.calmS + 5); await g.sense()
  const a = g.answer()
  assert.deepEqual([a.level, a.drain, a.availMB], ['unknown', true, null])
  say.coast = { ok: true, vm: vm(8000) }; say.pressure = { ok: true, level: 1 }
  await g.sense(); h.tick(GOVERNOR.calmS); await g.sense()
  assert.equal(g.answer().drain, false)
}))

// spec: E1.3 (the hands' pressure read, 1 s samples kept as changes, read by cursor); a blip between two asks counts
// class: J9 an event between samples
// technique: the reader answers a change list with a critical blip and the cursor's next value
// method: one sense(): critical this tick although the level now reads 1; the cursor moves to the answer's seq; the next
//         ask names it
// sre: if memory went critical for two seconds between two reads, does the governor still act on it?
test('a critical blip in the pressure changes since the cursor counts for the tick, and the cursor moves', async () => {
  const asked = []
  const { s } = makeSup()
  let p = { ok: true, level: 1, seq: 7, changes: [{ seq: 6, level: 4, at: 990 }, { seq: 7, level: 1, at: 992 }] }
  const g = governor(s, { read: async (op, args) => { asked.push([op, ...args]); return op === 'pressure' ? p : { ok: true, vm: vm(8000) } }, boxFile: '/nonexistent' })
  assert.equal((await g.sense()).level, 'critical')
  p = { ok: true, level: 1, seq: 7, changes: [] }
  await g.sense()
  assert.deepEqual(asked.filter((a) => a[0] === 'pressure'), [['pressure', 0], ['pressure', 7]])
  assert.equal(handleInfo({ t: 'other' }, init(0)).acts.length, 0)
  assert.match(handleCall({ t: 'other', now: 0 }, init(0)).reply.why, /answers answer or price, not other/)
})

// spec: LME-1.0 §3 law 3 (memory decided before load); E1.2 (the room priced before anything stops); POSTMORTEMS 2026-10-30
// class: M6 memory; E2 the wrong order (a stop for a load that cannot fit)
// technique: the box profile in scratch; boundary at the 1,500 MB floor; the 10-30 morning's numbers
// method: price the 12B from the E4B at 8,000 MB (fits, the sum in the why), at 1,651 MB (the morning: refused before the
//         stop), unknown and critical (refused), an unmeasured row (refused, never a guess), a mind with no row; each price
//         is an admit or refuse row with its number
// sre: before the desk's mind is stopped, does the box know whether the next one fits, and say the numbers either way?
test('the price: the room is available + the serving mind\'s size − the load\'s, at least the 1,500 MB floor; every price is a row', armed(async () => {
  const { h, g, say } = gov()
  await g.sense()
  const ok = g.price({ to: '12b', from: 'e4b' })
  assert.equal(ok.ok, true); assert.equal(ok.roomMB, 8000 + 6474 - 11319)
  assert.match(ok.why, /^the 12b \(desk profile\) fits: 8000 MB available \+ 6474 MB freed − 11319 MB \(measured\) leaves 3155 MB, over the 1500 MB floor$/)
  say.coast = { ok: true, vm: vm(1651) }
  await g.sense()
  const no = g.price({ to: '12b', profile: 'worker', from: 'e4b' })
  assert.equal(no.ok, false); assert.match(no.why, /^no room for the 12b \(worker profile\): 1651 MB available \+ 6474 MB freed − 11319 MB \(measured\) leaves -3194 MB, under the 1500 MB floor$/)
  assert.match(g.price({ to: '31b', from: 'e4b' }).why, /has no measured use-mb in the box profile: a load is never priced on a guess/)
  assert.match(g.price({ to: '99b' }).why, /the 99b has no measured use-mb/)
  say.coast = { ok: true, vm: vm(500) }; await g.sense()
  assert.match(g.price({ to: '12b', from: 'e4b' }).why, /the box's memory is critical .*: no load starts/)
  const prices = rows(h, 'governor').filter((r) => /"act" "(admit|refuse)"/.test(r))
  assert.equal(prices.length, 5); assert.match(prices[0], /\("act" "admit"\).*\("to" "12b"\) \("need-mb" 11319\)/)
  const { g: blind } = gov({ coast: { ok: false }, pressure: { ok: false } })
  await blind.sense()
  assert.match(blind.price({ to: '12b', from: 'e4b' }).why, /^no memory reading \(no reading in the last 30 s .*\): a load is never priced on a guess$/)
  const drained = handleCall({ t: 'price', now: 0, to: '12b', needMB: 1 }, { ...handleCast({ t: 'coast', vm: vm(9000), at: 0 }, init(0)), drain: true }).reply
  assert.match(drained.why, /the box drains until 60 s below critical/)
  assert.deepEqual(boxRow(BOX, '12b'), { id: '12b', useMB: 11319, profile: 'desk', source: 'measured: lme-desk.log:1974', floorMB: 1500, prefillTokS: 240 })
  assert.equal(boxRow(BOX, '31b').profile, null); assert.equal(boxRow(BOX, 'zz'), null)
}))

// spec: E1.2 + E1.3 (the broker asks the governor before the act); law 10 (one try); POSTMORTEMS 2026-10-30 root causes 1 and 3
// class: E2 a stop for a load that cannot fit; E10 the dispatcher's retry
// technique: the 10-30 morning's numbers through the broker's own road: beginSwap by the work-order dispatcher
// method: no act goes to the hands; one (swap …) row with stage price and the numbers; one letter; the dispatcher's next pass
//         is held; the owner's press is the next try (priced again, here refused again: one more row, the letter deduped)
// sre: when the 12B cannot fit, does the E4B keep serving, with one record, one letter, and no swap loop?
test('the broker refuses a swap the governor cannot price: no act, one row with the numbers, one letter, the next automatic try held', armed(async () => {
  const { h, s, g } = gov({ coast: { ok: true, vm: vm(1651) } })
  await g.sense()
  broker(s).brain = 'e4b'
  const r = beginSwap(s, '12b', 'work order wo-251666', 'work-order')
  assert.deepEqual([r.swap, r.refused], [null, true]); assert.match(r.held, /no room for the 12b \(desk profile\)/)
  assert.deepEqual(h.acts, [], 'nothing stops: no switch-brain act')
  const swaps = rows(h, 'swap')
  assert.equal(swaps.length, 1)
  assert.match(swaps[0], /\("from" "e4b"\) \("to" "12b"\) \("by" "work-order"\).*\("ok" #f\) \("failed" "no room for the 12b \(desk profile\): 1651 MB available.*\("stage" "price"\) \("serving" "e4b"\)/)
  assert.equal(h.letters.length, 1); assert.match(h.letters[0].what, /^The swap to the 12b was refused: no room .* The e4b serves the desk\. One try; a press starts the next\.$/)
  assert.match(beginSwap(s, '12b', 'work order wo-251666', 'work-order').held, /was refused at .*; one try: a press starts the next/)
  assert.equal(rows(h, 'swap').length, 1, 'a held try writes no row')
  beginSwap(s, '12b', 'pressed by owner', 'owner')
  assert.equal(rows(h, 'swap').length, 2, 'the press is the next try')
  assert.equal(h.letters.length, 1); assert.equal(h.counts.at(-1).count, 2, 'the same words within the hour: one letter, its count raised (F-11)')
}))

// spec: the finale's order §1.14 ("the swap answer names the price and the first-token time before it loads"); LME-1.0 §3 law 3
// class: M6 memory (the 31B on 11-05: loaded tight, answered nothing in three minutes, its cost said nowhere); J a number
//        invented (an unmeasured rate)
// technique: the box profile in scratch, the governor off (the default); the owner's window passed to beginSwap
// method: the 12B on the tight window it is asked for: its use-mb, the room after the E4B leaves, 8,192 tokens at its measured
//         240 tok/s; on its own table's window (desk, 32,768 tokens) by default; the 31B, unmeasured: nulls, never a guess; the
//         act is the same switch-brain either way
// sre: before the owner waits on a load, does the answer say what it costs and how long the first token takes, from a record?
test('the swap\'s answer says its price before the load: the memory for the window asked, a full window at the measured prefill rate', async () => {
  const { h, s, g } = gov()
  await g.sense()
  broker(s).brain = 'e4b'
  const r = beginSwap(s, '12b', 'pressed by owner', 'owner', 'tight')
  assert.equal(r.swap, '12b')
  assert.deepEqual(r.price, { profile: 'tight', needMB: 11319, roomMB: 8000 + 6474 - 11319, prefillTokens: 8192, prefillTokS: 240, firstTokenS: 34 })
  assert.equal(broker(s).swapping.profile, 'tight')
  swapDone(s, { ok: true }); broker(s).brain = 'e4b'
  assert.deepEqual(beginSwap(s, '12b', 'pressed by owner', 'owner').price,
    { profile: 'desk', needMB: 11319, roomMB: 3155, prefillTokens: 32768, prefillTokS: 240, firstTokenS: 137 }, 'no window asked: the table\'s')
  swapDone(s, { ok: true }); broker(s).brain = 'e4b'
  assert.deepEqual(beginSwap(s, '31b', 'pressed by owner', 'owner').price,
    { profile: 'tight', needMB: null, roomMB: null, prefillTokens: 8192, prefillTokS: null, firstTokenS: null }, 'unmeasured: said as unmeasured')
  assert.deepEqual(h.acts.map((a) => a.args), [['12b'], ['12b'], ['31b']])
  const { s: bare } = gov()
  delete bare.governor
  broker(bare).brain = 'e4b'
  assert.deepEqual(beginSwap(bare, '12b', 'pressed by owner', 'owner', 'tight'), { swap: '12b', why: 'pressed by owner' }, 'nothing priced: no price said')
})

const sockets = []
async function engine(d, { model = 'sha256-aaaa1111', busy = 0 } = {}) {
  const sock = path.join(d, 'e.sock')
  const log = path.join(d, 'sent.log')
  const child = spawn(process.execPath, [path.join(FIX, 'fake-engine.mjs'), sock, model, 'desk', String(busy)], { stdio: 'ignore', env: { ...process.env, FAKE_ENGINE_LOG: log } })
  sockets.push(child)
  for (let i = 0; i < 100 && !fs.existsSync(sock); i++) await new Promise((r) => setTimeout(r, 20))
  return { sock, log, child }
}
test.after(() => { for (const c of sockets) c.kill() })

// spec: the make-it-right audit E14 §5 row 15 ("a swap under a live turn is refused by the broker until the turn ends or the
// owner says so"); T-SRE sre-14 · class: E2 the wrong order (the engine pulled from under a turn) · technique: the fake engine
// busy and idle, read by the governor's own `engine()` · method: turnHold on each, with and without now · sre: does a press
// during a turn wait for it, unless the owner says now?
test('a turn running on the desk\'s engine holds a swap until it ends, unless the owner says now; no engine holds nothing', async () => {
  const d = scratch()
  const busy = await engine(d, { busy: 10 })   // busy for nine reads (the fake counts them down)
  const { s } = makeSup()
  const g = governor(s, { read: async () => ({ ok: false }), boxFile: '/nonexistent', deskSock: busy.sock })
  assert.match(turnHold(await g.engine(), false), /^a turn is running on the desk's engine \(1 busy\): the swap waits for it to end; \/swap <mind> now cuts it/)
  assert.equal(turnHold(await g.engine(), true), null, 'the owner said now')
  busy.child.kill()
  const d2 = scratch()
  const idle = await engine(d2, { busy: 0 })
  const g2 = governor(makeSup().s, { read: async () => ({ ok: false }), boxFile: '/nonexistent', deskSock: idle.sock })
  assert.equal(turnHold(await g2.engine(), false), null, 'idle: the swap begins')
  assert.equal(turnHold({ ok: false, why: 'no socket' }, false), null, 'no engine answers: no turn to cut')
})

// spec: M-32 (liveness from the probe, never the broker's memory); E1.2 (verify after the swap); E1.3 ("a swap mid-generation drains first": the governor never cuts a stream)
// class: J2 a wrong record (a dead engine read as loaded); E1 an act on the wrong road (the governor touching a turn)
// technique: the swap road's fake engine on a unix socket, with a turn in flight; a dead socket
// method: engineStatus reads model, profile, draining and busy; checkServing writes a (swap-check …) row and a letter for
//         another model or a silent socket and nothing for the right one; a critical drain sends the engine nothing: its
//         only received forms are the probes' (status)
// sre: after a swap, does the box believe the engine's own answer; and does a memory drain leave the running turn alone?
test('the engine\'s own (status) after a swap: the right model writes nothing; another model or silence is a row and a letter; a drain never touches the turn', armed(async () => {
  const d = scratch()
  const e = await engine(d, { busy: 50 })
  const st = await engineStatus(e.sock)
  assert.deepEqual([st.ok, st.model, st.profile, st.draining, st.busy], [true, 'sha256-aaaa1111', 'desk', false, 1])
  assert.deepEqual(await engineStatus(path.join(d, 'none.sock')), { ok: false, why: 'ENOENT' })
  const { h, s } = makeSup()
  const g = governor(s, { read: async (op) => (op === 'pressure' ? { ok: true, level: 4 } : { ok: true, vm: vm(600) }), boxFile: '/nonexistent', deskSock: e.sock })
  await g.sense()
  assert.equal(g.answer().drain, true)
  assert.deepEqual(await checkServing(s, { 'serving-blob': '/m/sha256-aaaa1111' }), { ok: true, model: 'sha256-aaaa1111' })
  const wrong = await checkServing(s, { 'serving-blob': 'sha256-bbbb2222' })
  assert.match(wrong.why, /the desk socket serves sha256-aaaa1111, not sha256-bbbb2222/)
  assert.match(rows(h, 'swap-check')[0], /\("ok" #f\) \("why" "the desk socket serves sha256-aaaa1111/)
  assert.equal(h.letters.at(-1).severity, 'wrong')
  const sent = fs.readFileSync(e.log, 'utf8').trim().split('\n')
  assert.ok(sent.length >= 3 && sent.every((l) => l.startsWith('(status ')), `the governor and the broker only read: ${sent}`)
  e.child.kill('SIGTERM')
  for (let i = 0; i < 50 && fs.existsSync(e.sock); i++) await new Promise((r) => setTimeout(r, 20))
  const silent = await checkServing(s, null)
  assert.match(silent.why, /nothing answers on the desk socket after the swap/); assert.equal(h.letters.at(-1).severity, 'sick')
  assert.deepEqual(await checkServing(makeSup().s, null), { ok: true, skipped: true }, 'no governor: no probe')
}))

// spec: CL-GEMMAS Part C (Memory Makes Room: idle minds are freed first; active holders are named on refusal; fit alongside needs no eviction)
// class: M6 memory; E2 a refusal that could have evicted an idle mind
// technique: planted governor states (Refuse with 26B in run, Evict-then-fit with E4B + embedder idle, Fit with 12 GB free)
// method: price the 12B (8,000 MB) in each state and check ok, evict, glass and holders
// sre: does the 12B load when the E4B and embedder are idle, sit alongside when there is room, and name the holder when a run holds the box?
test('memory makes room: idle minds evict LRU-first with a glass line, a fit beside evicts nothing, and a refusal names active holders in GiB', armed(async () => {
  const { g, say } = gov({ coast: { ok: true, vm: vm(4000) } })
  await g.sense()
  // 1. Refuse: 26B (in run, 18 GB) with 4 GB avail -> refuses, lists holders and their GiB
  const refuse = g.price({ to: '12b', needMB: 8000, resident: [{ id: '26b', useMB: 18000, inRun: 'tk-104' }] })
  assert.equal(refuse.ok, false)
  assert.deepEqual(refuse.evict, [])
  assert.equal(refuse.holders.length, 1)
  assert.equal(refuse.holders[0].id, '26b')
  assert.equal(refuse.holders[0].giB, 18)
  assert.match(refuse.why, /held by the 26B \(18\.0 GiB, mid-run on tk-104\)\. Wait for the run or stop it\./)

  // 2. Evict-then-fit: E4B (idle, 4.6 GB) + embedder (idle, 0.6 GB) with 5 GB avail -> evicts E4B + embedder, loads 12B, glass line matches
  say.coast = { ok: true, vm: vm(5000) }
  await g.sense()
  const evictFit = g.price({
    to: '12b',
    needMB: 8000,
    resident: [
      { id: 'e4b', useMB: 4600, lastTurnAt: 10 },
      { id: 'embedder', useMB: 600, lastTurnAt: 20 },
    ],
  })
  assert.equal(evictFit.ok, true)
  assert.deepEqual(evictFit.evict, ['e4b', 'embedder'])
  assert.equal(evictFit.glass, 'Loading the 12B: sending the E4B and the embedder home first (5.2 GiB).')

  // 3. Fit: E4B (idle, 4.6 GB) with 12 GB avail -> loads 12B alongside E4B; no eviction
  say.coast = { ok: true, vm: vm(12000) }
  await g.sense()
  const fit = g.price({
    to: '12b',
    needMB: 8000,
    resident: [{ id: 'e4b', useMB: 4600, lastTurnAt: 10 }],
  })
  assert.equal(fit.ok, true)
  assert.deepEqual(fit.evict, [])
  assert.equal(fit.glass, null)
}))

// spec: the owner, 2026-11-04 ("governors off. when i ask for an llm i get it. let the os clear the memory"); LACUNA_GOVERNOR unset
// class: M6 memory pressure reported, never acted on; E2 a refusal of the owner's load
// technique: a critical box (800 MB), an unmeasured mind, a run holding 18 GB, no reading at all, with the switch off
// method: sense: one level row, no drain, no park, admission open, no act; every price ok with its figure and an admit row; the
//         owner's swap sends switch-brain with no refusal; nothing evicted
// sre: when the owner asks for a mind on a full box, does he get it, with the numbers written down and no one sent home?
test('governor off (the default): critical memory is a level row and nothing else; every load the owner asks for proceeds with its figure', async () => {
  assert.equal(process.env.LACUNA_GOVERNOR, undefined)
  const { h, s, g } = gov({ coast: { ok: true, vm: vm(800) } })
  const a = await g.sense()
  assert.deepEqual([a.level, a.drain, a.park, a.admit], ['critical', false, false, true])
  assert.deepEqual(rows(h, 'governor').map((r) => r.match(/\("act" "([a-z]+)"\)/)[1]), ['level'], 'the level is reported; no drain, no park')
  assert.equal(admit(s, 'mind').ok, true)
  wallSweep(s)
  assert.deepEqual(h.acts, [], 'nothing parks')
  const crit = g.price({ to: '12b', from: 'e4b' })
  assert.equal(crit.ok, true)
  assert.match(crit.why, /^the 12b \(desk profile\) loads on the owner's word: 800 MB available \+ 6474 MB freed − 11319 MB \(measured\) leaves -4045 MB; the governor reports \(level critical\) and refuses nothing$/)
  assert.match(g.price({ to: '31b', from: 'e4b' }).why, /^the 31b loads on the owner's word: 800 MB available; no measured use-mb/)
  const held = g.price({ to: '12b', needMB: 8000, resident: [{ id: '26b', useMB: 18000, inRun: 'tk-104' }, { id: 'e4b', useMB: 4600, lastTurnAt: 10 }] })
  assert.deepEqual([held.ok, held.evict, held.glass], [true, [], null], 'no one is sent home first')
  broker(s).brain = 'e4b'
  assert.equal(beginSwap(s, '12b', 'pressed by owner', 'owner').swap, '12b')
  assert.deepEqual(h.acts, [{ op: 'switch-brain', args: ['12b'] }])
  assert.equal(rows(h, 'swap').length, 0, 'no refusal row')
  const prices = rows(h, 'governor').filter((r) => /"act" "(admit|refuse)"/.test(r))
  assert.deepEqual(prices.map((r) => /"act" "(admit|refuse)"/.exec(r)[1]), ['admit', 'admit', 'admit', 'admit'])
  const { g: blind } = gov({ coast: { ok: false }, pressure: { ok: false } })
  await blind.sense()
  const p = blind.price({ to: '12b', from: 'e4b' })
  assert.equal(p.ok, true); assert.match(p.why, /^the 12b \(desk profile\) loads on the owner's word: no memory reading \(no reading in the last 30 s/)
})
