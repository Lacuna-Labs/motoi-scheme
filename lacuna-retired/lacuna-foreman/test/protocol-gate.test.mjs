// protocol-gate.test.mjs — THE GATE UNDER ATTACK (lane U2). Owns: the unit tests of `Gate.open` in protocol.mjs, one per
// wire class W1–W9 and the JavaScript classes that reach the gate (J3 J7 J14 J15 J17), the nonce memory's bound (B3) and
// the no-cache rule (F-20). Refuses: a mock of protocol.mjs (the gate is the real one; only the clock is ours); sleeps;
// the live foreman's door (U3 holds the door; this file holds the gate the door calls).
// Implements: design §6 change 6 (one envelope, signed per hop, five drops in their order), §7 (symbols are not body
// data), law 5; engineering §3.1 (the envelope table, the gate's order, constant-time compare), §3.5 (window 120 s).
// Invariants (§18): "if an envelope is unsigned, forged, stale, replayed or malformed, then it was dropped and
// /health.dropped counted it". Faults (§16): F-10 (a dropped envelope), F-20 (the parse cache retained envelopes).
// coverage: protocol.mjs — lines 100% branches 97.44% functions 100% (2026-10-24, lane U2 files alone; 100% with the whole suite; :75 :90 named test.todo in protocol-gate)
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { seal, Gate, PROTOCOL, DROPS, newDrops } from '../protocol.mjs'

const KEY = 'k'.repeat(48)
const T0 = 1_000_000
const sign = (slat, key = KEY) => ({ slat, sig: crypto.createHmac('sha256', key).update(slat, 'utf8').digest('hex') })
const env = (o = {}) => seal(KEY, { from: 'brain', to: 'foreman', kind: 'intent', body: { tool: 'jobs' }, at: T0, ...o })
const msg = (fields) => `(msg ${fields})`
const GOOD = '(v 1) (from "a") (to "b") (kind ping) (at 1000000) (nonce "0123456789ab")'
const total = (g) => Object.values(g.drops).reduce((a, b) => a + b, 0)

// spec: design §6 change 6 drop 1 · eng §3.1 "no slat or no sig → unsigned" · I-05 · F-10
// class: W1 unsigned
// technique: boundary over the envelope's outer shape: every way a caller can hand the gate something that is not {slat, sig}
// method: open nine non-envelopes; read the drop, the sentence, and the `drops` record the desk shows; confirm no nonce was kept
// sre: if a client loses its key or posts a bare form, is it dropped and counted without the gate throwing or remembering it?
test('anything without a slat text and a signature is dropped as unsigned, counted once each, and leaves no nonce behind', () => {
  const g = new Gate(KEY, () => T0)
  const good = env()
  const cases = [null, undefined, 7, 'text', [], {}, { slat: '' }, { slat: 5, sig: good.sig }, { slat: good.slat }, { slat: good.slat, sig: '' }, { slat: good.slat, sig: 12 }]
  for (const c of cases) {
    const r = g.open(c)
    assert.deepEqual([r.ok, r.drop], [false, 'unsigned'], JSON.stringify(c))
    assert.match(r.why, /not a protocol message|not signed/)
  }
  assert.equal(g.drops.unsigned, cases.length); assert.equal(total(g), cases.length)
  assert.equal(g.seen.size, 0); assert.equal(g.queue.length, 0)
})

// spec: design §6 change 6 drop 3 · eng §3.1 "HMAC mismatch → forged", "crypto.timingSafeEqual" · I-05 · F-10
// class: W2 forged
// technique: fault injection on the signature: a wrong key, one hex digit flipped, one body byte changed after sealing,
//            a short sig, a 64-char non-hex sig, the right sig in upper case
// method: open each against a fresh gate; read the drop and the counters; the upper-case sig is the same bytes and opens
// sre: if an attacker or a stale key signs a message, is it refused before its text is read, whatever shape the sig has?
test('a signature that does not match the exact text is forged: wrong key, one flipped digit, one changed byte, any length', () => {
  const g = new Gate(KEY, () => T0)
  const good = env()
  const flip = good.sig.slice(0, 63) + (good.sig[63] === '0' ? '1' : '0')
  const forged = [
    seal('x'.repeat(48), { from: 'brain', to: 'foreman', kind: 'intent', body: 1, at: T0 }),
    { slat: good.slat, sig: flip },
    { slat: good.slat.replace('"jobs"', '"jobz"'), sig: good.sig },
    { slat: good.slat, sig: 'ab' },
    { slat: good.slat, sig: good.sig.slice(0, 62) },
    { slat: good.slat, sig: good.sig + '00' },
    { slat: good.slat, sig: 'z'.repeat(64) },
  ]
  for (const e of forged) assert.equal(g.open(e).drop, 'forged', e.sig)
  assert.equal(g.drops.forged, forged.length); assert.equal(g.seen.size, 0)
  const upper = g.open({ slat: good.slat, sig: good.sig.toUpperCase() })
  assert.equal(upper.ok, true, 'hex is case-blind: the same 32 bytes')
})

// spec: eng §3.1 "The gate compares with crypto.timingSafeEqual" · design §11 (constant-time compare)
// class: J17 Buffer vs string compare (timing)
// technique: a spy on node:crypto's timingSafeEqual (a dependency, not the module under test), restored in finally
// method: open a good envelope, a same-length forgery and two wrong-length sigs; count the constant-time calls and their
//         buffer lengths; a wrong length must never reach timingSafeEqual (it throws RangeError on unequal lengths)
// sre: if a forger probes byte by byte, does every compare take the same time, and does a short sig crash the gate instead?
test('every same-length signature is compared in constant time over 32 bytes; a wrong length is forged without the compare throwing', () => {
  const calls = []
  const orig = crypto.timingSafeEqual
  crypto.timingSafeEqual = (a, b) => { calls.push([a.length, b.length, Buffer.isBuffer(a), Buffer.isBuffer(b)]); return orig(a, b) }
  try {
    const g = new Gate(KEY, () => T0)
    const good = env()
    assert.equal(g.open(good).ok, true)
    assert.equal(g.open({ slat: env().slat, sig: 'f'.repeat(64) }).drop, 'forged')
    assert.equal(g.open({ slat: env().slat, sig: 'abc' }).drop, 'forged')
    assert.equal(g.open({ slat: env().slat, sig: 'a'.repeat(66) }).drop, 'forged')
    assert.deepEqual(calls, [[32, 32, true, true], [32, 32, true, true]])
  } finally { crypto.timingSafeEqual = orig }
})

// spec: design §6 change 6 "unsigned→malformed(size)→forged" · eng §3.1 "text over 256,000 chars → malformed" · §3.5 envelope size
// class: W5 malformed (size) · J15 Unicode and bytes
// technique: boundary: the text at 256,000 chars and at 256,001; the same count in three-byte characters
// method: build a signed envelope whose slat is exactly the bound (opens), one char more (malformed before the HMAC: a
//         wrong sig on it is still malformed), and a 256,000-char text of '中' (768,000 bytes: the bound is chars, as eng §3.1 says)
// sre: if a hand's answer balloons, is the gate's cost capped before it hashes or reads a byte of it?
test('the size bound is 256,000 characters of slat: at the bound it opens, one more is malformed before the signature is checked', () => {
  const g = new Gate(KEY, () => T0)
  const shell = (n) => seal(KEY, { from: 'a', to: 'b', kind: 'k', body: 'x'.repeat(n), at: T0, nonce: `nonce-${String(n).padStart(6, '0')}` })
  const base = shell(0).slat.length
  const at = shell(PROTOCOL.bodyBytes - base)
  assert.equal(at.slat.length, PROTOCOL.bodyBytes)
  assert.equal(g.open(at).ok, true)
  const over = shell(PROTOCOL.bodyBytes - base + 1)
  assert.equal(over.slat.length, PROTOCOL.bodyBytes + 1)
  const r = g.open(over)
  assert.deepEqual([r.drop, r.why], ['malformed', 'the message is too large'])
  assert.equal(g.open({ slat: over.slat, sig: 'f'.repeat(64) }).drop, 'malformed', 'size is checked before the signature')
  const wide = seal(KEY, { from: 'a', to: 'b', kind: 'k', body: '中'.repeat(PROTOCOL.bodyBytes - base), at: T0, nonce: 'wide-nonce-1' })
  assert.equal(wide.slat.length, PROTOCOL.bodyBytes); assert.equal(Buffer.byteLength(wide.slat), PROTOCOL.bodyBytes + 2 * (PROTOCOL.bodyBytes - base))
  assert.equal(g.open(wide).ok, true, 'the bound counts characters, not bytes (eng §3.1)')
  assert.deepEqual([g.drops.malformed, g.drops.forged], [2, 0])
})

// spec: design §6 change 6 drop 4 "malformed(shape)", §7 "symbols are not body data" · eng §3.1 the envelope table, field by field
// class: W5 malformed (shape; a symbol as body data; a nested (msg …))
// technique: state-machine walk over the eight positions: every field missing, out of order, of the wrong type, at its bound
// method: sign each variant with the right key (so the signature is not the reason), open it, read the drop and the one
//         sentence; the counter rises once per case and no malformed message spends a nonce
// sre: if a client writes a slightly wrong form, is it refused with a sentence that says which field, never half-read?
test('every field out of place, of the wrong type or past its bound is malformed with a sentence naming it; no nonce is spent', () => {
  const g = new Gate(KEY, () => T0)
  const cases = [
    ['"just a string"', /a message is \(msg/],
    ['(note (v 1))', /a message is \(msg/],
    ['("msg" (v 1) (from "a") (to "b") (kind k) (at 1000000) (nonce "0123456789ab") (body 1))', /a message is/],
    [msg(GOOD), /a message is/],
    [msg(`${GOOD} (body 1) (extra 1)`), /a message is/],
    [msg('(from "a") (v 1) (to "b") (kind ping) (at 1000000) (nonce "0123456789ab") (body 1)'), /field 1 must be \(v/],
    [msg('v (from "a") (to "b") (kind ping) (at 1000000) (nonce "0123456789ab") (body 1)'), /field 1 must be \(v/],
    [msg('(v 1 2) (from "a") (to "b") (kind ping) (at 1000000) (nonce "0123456789ab") (body 1)'), /field 1 must be/],
    [msg('("v" 1) (from "a") (to "b") (kind ping) (at 1000000) (nonce "0123456789ab") (body 1)'), /field 1 must be/],
    [msg('(v 2) (from "a") (to "b") (kind ping) (at 1000000) (nonce "0123456789ab") (body 1)'), /version 2 is not 1/],
    [msg('(v 1) (from 7) (to "b") (kind ping) (at 1000000) (nonce "0123456789ab") (body 1)'), /from, to and nonce are strings/],
    [msg('(v 1) (from "a") (to b) (kind ping) (at 1000000) (nonce "0123456789ab") (body 1)'), /from, to and nonce/],
    [msg('(v 1) (from "a") (to "b") (kind ping) (at 1000000) (nonce 12345678) (body 1)'), /from, to and nonce/],
    [msg('(v 1) (from "a") (to "b") (kind ping) (at 1000000) (nonce "1234567") (body 1)'), /from, to and nonce/],
    [msg('(v 1) (from "a") (to "b") (kind "ping") (at 1000000) (nonce "0123456789ab") (body 1)'), /kind is a symbol/],
    [msg('(v 1) (from "a") (to "b") (kind ping) (at "1000000") (nonce "0123456789ab") (body 1)'), /at is a number/],
    [msg(`${GOOD} (body (tool jobs))`), /a body holds no symbols/],
    [msg(`${GOOD} (body (msg (v 1) (from "x")))`), /a body holds no symbols/],
    [msg(`${GOOD} (body #\\a)`), /malformed: .*not data/],
    [msg(`${GOOD} (body #(1 2))`), /malformed: .*not data/],
    [msg(`${GOOD} (body 1/2)`), /malformed: .*rationals/],
    [msg(`${GOOD} (body +inf.0)`), /malformed: .*infinities/],
    [msg(`${GOOD} (body 1e999)`), /malformed: .*not a finite number/],
    [msg(`${GOOD} (body 'x)`), /malformed: the quote mark/],
    [msg(`${GOOD} (body (@ (tool 1)))`), /no symbols.*object entry/],
    [`${msg(`${GOOD} (body 1)`)} ${msg(`${GOOD} (body 2)`)}`, /malformed: expected exactly one form/],
    [msg(`${GOOD} (body (1 2)`), /malformed: an unclosed list/],
    [msg(`${GOOD} (body ${'('.repeat(24)}${')'.repeat(24)})`), /malformed: nested deeper than 24/],
  ]
  for (const [text, why] of cases) {
    const r = g.open(sign(text))
    assert.equal(r.drop, 'malformed', text.slice(0, 80)); assert.match(r.why, why, text.slice(0, 80))
  }
  assert.equal(g.drops.malformed, cases.length); assert.equal(total(g), cases.length)
  assert.equal(g.seen.size, 0, 'a malformed message spends no nonce')
  assert.equal(g.open(sign(msg('(v 1) (from "a") (to "b") (kind ping) (at 1000000) (nonce "12345678") (body (@ ("tool" "jobs") ("n" (1 2.5 #t #f null))))'))).ok, true,
    'the nonce at its bound (8 chars) and a body of every data type open')
})

// spec: design §6 change 6 drop 5 · eng §3.1 "|now − at| ≤ 120 or stale" · eng §3.5 envelope window 120 s
// class: W3 stale
// technique: boundary with a fake clock: at = now ± 120 opens; now ± 120.001 is stale
// method: open four envelopes stamped at the edges; read the drops and the sentence's seconds; then move the clock so the
//         future-stamped one is inside the window and open the same envelope again: a stale drop spent no nonce
// sre: if a sender's clock drifts or a captured message is replayed late, is the window exact to the second and symmetric?
test('the window is 120 s either way, inclusive: ±120 opens, ±120.001 is stale, and a stale message spent no nonce', () => {
  let now = T0
  const g = new Gate(KEY, () => now)
  assert.equal(g.open(env({ at: T0 - 120 })).ok, true)
  assert.equal(g.open(env({ at: T0 + 120 })).ok, true)
  const past = g.open(env({ at: T0 - 120.001 }))
  assert.equal(past.drop, 'stale'); assert.match(past.why, /sent 120 s from now/)
  const future = env({ at: T0 + 121 })
  const f = g.open(future)
  assert.equal(f.drop, 'stale'); assert.match(f.why, /sent -121 s from now/)
  assert.equal(g.drops.stale, 2)
  now += 1
  assert.equal(g.open(future).ok, true, 'inside the window now: the stale drop never recorded its nonce')
})

// spec: design §6 change 6 drop 6 · eng §3.1 "nonce seen → replayed" · eng §3.5 window · I-05 · F-10
// class: W4 replayed · E10 a duplicate message
// technique: replay inside the window, a fresh body under a reused nonce, and the same replay after the window (time travel)
// method: open an envelope, replay it at +1 s and at +119 s; seal a different body with the same nonce; then move past the
//         window: the memory forgot the nonce and the stale check catches the replay instead (never accepted twice)
// sre: if the brain loop retries a POST or an attacker captures one, does the message act exactly once, ever?
test('a nonce is delivered once: a replay inside the window is replayed, a new body under an old nonce is replayed, and after the window it is stale', () => {
  let now = T0
  const g = new Gate(KEY, () => now)
  const e = env({ nonce: 'nonce-once-0001' })
  assert.equal(g.open(e).ok, true)
  now += 1; assert.equal(g.open(e).drop, 'replayed')
  now += 118; assert.equal(g.open(e).drop, 'replayed')
  assert.equal(g.open(env({ nonce: 'nonce-once-0001', body: 'other', at: now })).drop, 'replayed', 'the nonce is the identity, not the body')
  now = T0 + 121
  const late = g.open(e)
  assert.equal(late.drop, 'stale', 'outside the window the memory may forget: the clock refuses it instead')
  assert.deepEqual(g.drops, { unsigned: 0, forged: 0, stale: 1, replayed: 3, malformed: 0 })
})

// spec: design §6 change 6 "five drops in order unsigned→malformed(size)→forged→malformed(shape)→stale→replayed" · eng §3.1 the gate's order
// class: W9 the order of drops
// technique: state-machine walk over pairs of faults: each envelope carries two faults; the earlier drop must win
// method: build one envelope per adjacent pair; open each on a fresh gate; read which counter rose (exactly one per open)
// sre: if one message is wrong in two ways, is the reason the desk shows the cheap, safe one, and is it counted once only?
test('two faults in one envelope are counted once, under the earlier drop in the design\'s order', () => {
  const big = 'x'.repeat(PROTOCOL.bodyBytes + 1)
  const stale = env({ at: T0 - 500 })
  const pairs = [
    ['unsigned', { slat: big }],                                                       // unsigned + oversize
    ['malformed', { slat: big, sig: 'f'.repeat(64) }],                                 // oversize + forged
    ['forged', { slat: msg('(v 9)'), sig: 'f'.repeat(64) }],                           // forged + malformed shape
    ['malformed', sign(msg('(v 1) (from "a") (to "b") (kind ping) (at 1) (nonce "0123456789ab") (body x)'))],   // shape + stale
    ['stale', stale],                                                                   // stale + (a replay of it below)
  ]
  for (const [want, e] of pairs) {
    const g = new Gate(KEY, () => T0)
    assert.equal(g.open(e).drop, want); assert.equal(total(g), 1)
  }
  const g = new Gate(KEY, () => T0 - 500)
  assert.equal(g.open(stale).ok, true)
  g.now = () => T0
  assert.equal(g.open(stale).drop, 'stale', 'stale + replayed: stale is checked first')
  assert.deepEqual(DROPS, ['unsigned', 'forged', 'stale', 'replayed', 'malformed'])
})

// spec: design §6 change 6 (nonce expiry from a time-ordered queue) · eng §3.5 rings "nonces by the window" · B09
// class: B3 the gate's nonce memory ends with the window · B2 memory flat over N events
// technique: seeded flood on a fake clock: 100 envelopes a second for 1,200 s (10 windows, 120,000 opens)
// method: after every second, read `seen.size` and `queue.length`; both stay ≤ 100 × 121 (the window plus the second in
//         flight) and the queue and map agree; count by shape, not bytes
// sre: if the brain loop hammers the door all night, does the gate's memory stay flat instead of growing until the hush?
test('under a 10-window flood the nonce memory never holds more than one window of nonces', () => {
  let now = T0
  const g = new Gate(KEY, () => now)
  let peak = 0
  for (let s = 0; s < 10 * PROTOCOL.windowS; s++) {
    for (let i = 0; i < 100; i++) assert.equal(g.open(env({ at: now, body: i, nonce: `n-${s}-${i}-pad` })).ok, true)
    peak = Math.max(peak, g.seen.size)
    assert.equal(g.seen.size, g.queue.length)
    now += 1
  }
  assert.ok(peak <= 100 * (PROTOCOL.windowS + 1), `peak ${peak}`)
  assert.ok(peak >= 100 * PROTOCOL.windowS, 'and it does remember a whole window')
})

// spec: design §16 F-20 (the parse cache retained envelopes) · eng §3.1 "slat-data holds no cache … a stream of envelopes retains nothing"
// class: B4 the parse cache (F-20) · J16 a Map that grows without a bound
// technique: allocation by shape: after 2,000 opens of 2 KB envelopes, walk everything the gate holds
// method: the gate's own fields are exactly key, now, drops, seen, queue; `seen` maps nonce strings to numbers; `queue`
//         holds [number, string] pairs; no value the gate keeps is the envelope text or its body
// sre: if 240 KB envelopes stream through, does the foreman keep only 24-char nonces, never the text (the 1,105 MB hush)?
test('the gate keeps only nonces and times: no slat text, no body, no parsed form survives an open', () => {
  let now = T0
  const g = new Gate(KEY, () => now)
  for (let i = 0; i < 2000; i++) { g.open(env({ body: { pad: 'y'.repeat(2000), i }, at: now })); now += 0.01 }
  assert.deepEqual(Object.keys(g).sort(), ['drops', 'key', 'now', 'queue', 'seen'])
  for (const [n, at] of g.seen) { assert.equal(typeof n, 'string'); assert.ok(n.length <= 64); assert.equal(typeof at, 'number') }
  for (const q of g.queue) { assert.equal(q.length, 2); assert.equal(typeof q[0], 'number'); assert.equal(typeof q[1], 'string') }
  assert.equal(g.seen.size, 2000)
})

// spec: eng §3.5 envelope window "clocks on one box agree" · design §6 change 6 (the window)
// class: J14 clock jumps (backwards; forward past the window)
// technique: time travel on the gate's clock: forward 10 windows, then back 1,000 s
// method: fill the memory; jump forward: the next open forgets every nonce (B3) and old envelopes are stale; jump back:
//         new envelopes stamped by the new clock open, old ones are stale, and the forward-era nonces are not forgotten early
// sre: if NTP steps the box's clock either way, does the gate keep refusing replays and never accept a stale message?
test('a clock that jumps forward forgets the window at once; a clock that jumps back keeps refusing the old era', () => {
  let now = T0
  const g = new Gate(KEY, () => now)
  const old = env({ at: now, nonce: 'era-one-0001' })
  for (let i = 0; i < 50; i++) g.open(env({ at: now, nonce: `era-one-${i}-x` }))
  g.open(old)
  now += 10 * PROTOCOL.windowS
  assert.equal(g.open(env({ at: now, nonce: 'era-two-0001' })).ok, true)
  assert.equal(g.seen.size, 1, 'every nonce of the first era expired on the first open after the jump')
  assert.equal(g.open(old).drop, 'stale')
  now -= 1000
  assert.equal(g.open(env({ at: now, nonce: 'era-three-01' })).ok, true)
  assert.equal(g.seen.has('era-two-0001'), true, 'a backward jump expires nothing early')
  assert.equal(g.open(env({ at: T0 + 10 * PROTOCOL.windowS, nonce: 'era-two-0001' })).drop, 'stale')
})

// spec: design §6 change 6 drop 5 (stale) · §18 "if an envelope is … stale … then it was dropped" · eng §3.1 window
// class: J14 clock jumps · J13 a value unset or non-numeric (the host's clock answers NaN)
// technique: fault injection on the host clock: `now` returns NaN, undefined, then a string
// method: open a fresh, well-signed envelope at each broken clock; the window cannot be judged, so the gate must fail
//         closed (stale, counted) and remember nothing; before the fix it accepted all three and kept their nonces forever
// sre: if the clock the gate reads breaks, does the gate refuse everything rather than accept any message from any time?
test('a gate whose clock answers NaN fails closed: every envelope is stale and no nonce is kept', () => {
  for (const bad of [NaN, undefined, 'soon']) {
    const g = new Gate(KEY, () => bad)
    const r = g.open(env({ at: T0 }))
    assert.deepEqual([r.ok, r.drop], [false, 'stale'], String(bad))
    assert.equal(g.drops.stale, 1); assert.equal(g.seen.size, 0); assert.equal(g.queue.length, 0)
  }
})

// spec: law 5 (one envelope, one reader) · eng §3.1 "the foreman's door pins `to` to the URL's worker" · design §6 change 6
// class: W6 a wrong `to`
// technique: fault injection on the addressee: a message sealed for another worker, and one whose `to` was edited after sealing
// method: the gate hands `to` back verbatim so the door can refuse (U3 tests the door's pin); an edited `to` is forged
// sre: if a message meant for one worker is delivered to another, can the receiver tell, and can nobody re-address it?
test('the gate returns `to` exactly as sealed for the door to pin, and a re-addressed envelope is forged', () => {
  const g = new Gate(KEY, () => T0)
  const e = env({ to: 'w-other' })
  const r = g.open(e)
  assert.equal(r.msg.to, 'w-other'); assert.equal(r.msg.from, 'brain'); assert.equal(r.msg.kind, 'intent')
  const moved = { slat: env({ to: 'w-other' }).slat.replace('(to "w-other")', '(to "foreman")'), sig: e.sig }
  assert.equal(g.open(moved).drop, 'forged')
})

// spec: law 7 (nothing prints a token, key or PIN) · eng §3.1 "the key is the foreman token"
// class: W7 a body with a secret (the key itself never travels; redaction of bodies is the hands' emit, U4)
// technique: a canary key; read every string the gate and the sealer produce
// method: seal and open with a recognizable key; drive every drop; assert the key never appears in the slat, the sig, a
//         drop sentence or the opened message
// sre: if a drop is logged to the desk, could the log line ever carry the token that signs every hop?
test('the signing key appears in no envelope, no signature, no drop sentence and no opened message', () => {
  const CANARY = 'CANARY-KEY-0123456789abcdef-CANARY'
  const g = new Gate(CANARY, () => T0)
  const e = seal(CANARY, { from: 'a', to: 'b', kind: 'k', body: { x: 1 }, at: T0 })
  const outs = [JSON.stringify(e), JSON.stringify(g.open(e)), JSON.stringify(g.open(e)), JSON.stringify(g.open({ slat: e.slat, sig: 'f'.repeat(64) })),
    JSON.stringify(g.open({ slat: e.slat })), JSON.stringify(g.open(seal(CANARY, { from: 'a', to: 'b', kind: 'k', at: T0 - 999 })))]
  for (const o of outs) assert.ok(!o.includes(CANARY) && !o.includes('CANARY'), o)
})

// spec: eng §3.6 "A 240 KB envelope opens in 1.47 ms" · design §6 change 6 (the reader: no cache, single pass)
// class: J3 the event loop blocked (a large parse; a pathological text)
// technique: worst-case inputs at the size bound: 255,000 open parens, 255,000 quote marks, one 255,000-char string
// method: time each open with performance.now(); each is refused or opened in well under 50 ms (generous for a loaded box)
// sre: if a hostile client sends the worst text the reader can meet, does the foreman's one thread stay responsive?
test('the worst texts at the size bound are judged in under 50 ms each, so no envelope can block the loop', () => {
  const g = new Gate(KEY, () => T0)
  const N = PROTOCOL.bodyBytes - 1000
  const texts = [sign('('.repeat(N)), sign(`(msg ${'"'.repeat(N)})`), sign(msg(`${GOOD} (body "${'a'.repeat(N - 200)}")`))]
  for (const e of texts) {
    const t0 = performance.now()
    g.open(e)
    assert.ok(performance.now() - t0 < 50, `${(performance.now() - t0).toFixed(1)} ms`)
  }
  assert.equal(g.drops.malformed, 2)
})

// spec: design §6 change 6 "five drops" · eng §3.1 "Each drop is counted once in `drops` and shown on /health"
// class: E9 a message lost (what the sender and the desk see)
// technique: state check on a fresh counter set
// method: newDrops() is five zeros in DROPS order and a new object each time (two gates never share a counter)
// sre: if two gates run in one process, can one gate's drops be read as the other's on the desk?
test('the drop record is five counters in the design\'s five names, fresh per gate', () => {
  const a = newDrops(); const b = newDrops()
  assert.deepEqual(Object.keys(a), DROPS); assert.ok(Object.values(a).every((v) => v === 0))
  a.forged++
  assert.equal(b.forged, 0)
  const g1 = new Gate(KEY, () => T0); const g2 = new Gate(KEY, () => T0)
  g1.open(null)
  assert.deepEqual([g1.drops.unsigned, g2.drops.unsigned], [1, 0])
})

