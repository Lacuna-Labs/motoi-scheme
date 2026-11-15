// protocol.test.mjs — THE WIRE (lane U2). Owns: the unit tests of `seal`, `toSlat`/`fromSlat` and the nonce queue in
// protocol.mjs (the gate's drops live in protocol-gate.test.mjs), plus two contract-on-the-file rows kept here from the
// compliance audit of 2026-10-23. Refuses: a mock of protocol.mjs or slat-data.js; the live door; printing a key.
// Implements: design §6 change 6 (one envelope, signed per hop; the reader), §7 (symbols are not body data), law 5;
// engineering §3.1 (the envelope, the one writer and one reader), §3.5 (window 120 s), §3.6.
// Invariants (§18): "if an envelope is unsigned, forged, stale, replayed or malformed, then it was dropped and
// /health.dropped counted it". Faults (§16): F-10, F-20.
// coverage: protocol.mjs — lines 100% branches 97.44% functions 100% (2026-10-24, lane U2 files alone; 100% with the whole suite; :75 :90 named test.todo in protocol-gate)
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { seal, Gate, toSlat, fromSlat, PROTOCOL } from '../protocol.mjs'
import { readForm, writeData, dataToJson } from '../../../lacuna-scheme/src/slat-data.js'
import { openContract, renderContract, readContract, contractExit, EXIT } from '../contract.mjs'

const KEY = 'k'.repeat(48)

// spec: law 5 "one envelope, one reader" · eng §3.1 "toSlat/fromSlat … are writeData/dataToJson" · design §6 change 6
// class: W5 malformed (a symbol as body data) · W8 a reply that cannot be sealed (NaN)
// technique: identity check of the writer and the reader against slat-data; a round trip of every data type
// method: compare toSlat with writeData byte for byte; read back; NaN refuses to write; a symbol refuses to read
// sre: if a second writer crept back into the kernel, would two hops disagree on what a body says?
test('the body writer and reader are slat-data\'s: toSlat is writeData, fromSlat is dataToJson (one writer, one reader)', () => {
  const v = { a: [1, 2.5, 'x"y\n', true, false, null], b: { c: {} } }
  assert.equal(toSlat(v), writeData(v))
  assert.deepEqual(fromSlat(readForm(toSlat(v))), v)
  assert.deepEqual(dataToJson(readForm(toSlat(v))), v)
  assert.throws(() => toSlat({ n: NaN }), /finite/)
  assert.throws(() => fromSlat(readForm('(a b)')), /no symbols/)
})

// spec: design §6 change 6 "nonce expiry from a time-ordered queue" · eng §3.1 "< 1 ms with 40,000 held" · B09
// class: B3 the gate's nonce memory ends with the window · J3 the event loop blocked (a full walk per open)
// technique: load at the measured size (40,000 nonces), then time travel past the window
// method: time 300 opens with 40,000 held (each < 1 ms); move past 120 s; one open forgets every nonce; a replay is caught
// sre: if the nonce memory were walked whole on every open, would the foreman's one thread fall behind under load?
test('nonces expire from a time-ordered queue: 40,000 held, 300 more opens each under 1 ms, and the memory stays inside the window', () => {
  let now = 1_000_000
  const g = new Gate(KEY, () => now)
  for (let i = 0; i < 40_000; i++) { assert.equal(g.open(seal(KEY, { from: 'a', to: 'b', kind: 'ping', body: i, at: now })).ok, true); now += 0.001 }
  assert.equal(g.seen.size, 40_000); assert.equal(g.queue.length, 40_000)
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < 300; i++) assert.equal(g.open(seal(KEY, { from: 'a', to: 'b', kind: 'ping', body: i, at: now })).ok, true)
  const perOpenMs = Number(process.hrtime.bigint() - t0) / 1e6 / 300
  assert.ok(perOpenMs < 1, `${perOpenMs.toFixed(3)} ms per open with 40,000 nonces held`)
  now += PROTOCOL.windowS + 1                              // every nonce above is outside the window now
  assert.equal(g.open(seal(KEY, { from: 'a', to: 'b', kind: 'ping', body: 'late', at: now })).ok, true)
  assert.equal(g.seen.size, 1, 'the sweep forgot every nonce outside the window'); assert.equal(g.queue.length, 1)
  const env = seal(KEY, { from: 'a', to: 'b', kind: 'ping', body: 'again', at: now })
  assert.equal(g.open(env).ok, true); assert.equal(g.open(env).drop, 'replayed', 'a replay inside the window is still caught')
})

// spec: design §8 (17 fields; kicks the 17th) · eng §3.3 "the contract file … a file without it still reads"
// class: L5 the record's shape (the contract file)
// technique: round trip and a legacy file (the 16-field form written before 2026-10-23)
// method: render with one kick; read back; strip the 17th field; read again (kicks []); an 18th field is refused
// sre: if the foreman restarts on a contract written by yesterday's code, does it still read the run's record?
test('the contract file carries the typed kick record as its seventeenth field; a sixteen-field file still reads', () => {
  const w = { id: 'w-k' }; openContract(w, { key: 'k', goal: 'g' })
  w.contract.kicks.push({ verdict: 'kick', category: 'deadline', evidence: { promise: 'p-1', deadline: 10, now: 11 }, by: 'kick.mjs' })
  const text = renderContract(w.contract)
  assert.match(text, /\(kicks \(\(@ \("verdict" "kick"\)/)
  assert.deepEqual(readContract(text).kicks, w.contract.kicks)
  const old = text.replace(/ \(kicks .*\)\)$/, ')')
  assert.doesNotMatch(old, /kicks/)
  assert.deepEqual(readContract(old).kicks, [], 'a contract written before 2026-10-23 reads with no kicks')
  assert.throws(() => readContract(text + ' (extra 1)'), /a contract is/)
})

// spec: design §17 exit 0 (pass → done, fail → failed, stopped → done) · §8 states · law 6
// class: L1 `pass` without a form (the state a pass may carry)
// technique: state-machine walk over exit 0 × the three outcomes, plus exit 99
// method: close four contracts; read each state
// sre: if the desk shows a run as done, is it a pass or a clean stop, never a failed check?
test('exit 0 states: pass → done, stopped → done, a failed done-check → failed (§8; corrected 2026-10-23)', () => {
  const s = { host: { now: () => 1, contract: () => {} } }
  const mk = () => { const w = { id: 'w-x' }; openContract(w, { key: 'k', goal: 'g' }); return w }
  const a = mk(); contractExit(s, a, EXIT.DONE, 'pass', { checked: true }); assert.equal(a.contract.state, 'done')
  const b = mk(); contractExit(s, b, EXIT.DONE, 'stopped'); assert.equal(b.contract.state, 'done')
  const c = mk(); contractExit(s, c, EXIT.DONE, 'fail', { checked: true }); assert.equal(c.contract.state, 'failed')
  const d = mk(); contractExit(s, d, EXIT.STALLED, 'fail'); assert.equal(d.contract.state, 'stalled')
})

// spec: design §6 change 6 (the envelope) · eng §3.1 "kind ^[a-z][a-z0-9:_-]*$, ≤ 60 chars", "seal writes 12 random bytes as 24 hex"
// class: W8 a reply that cannot be sealed · W5 malformed (a kind that is not a symbol)
// technique: boundary on the kind (60 and 61 chars; a digit first; a space; a paren) and on the key (absent, empty)
// method: seal each; read the thrown sentence or the slat; a kind of 60 chars opens at a gate; the default nonce is 24 hex
// sre: if a caller builds a kind from user text, can it smuggle a second form into the envelope's head?
test('seal refuses a missing key and a kind that is not a short symbol; at 60 chars it seals, at 61 it throws', () => {
  for (const key of [undefined, null, '', 0]) assert.throws(() => seal(key, { from: 'a', to: 'b', kind: 'k', at: 1 }), /no key to sign with/)
  for (const kind of ['1abc', 'a b', 'a)(b', '', '-x', 'k'.repeat(61)]) assert.throws(() => seal(KEY, { from: 'a', to: 'b', kind, at: 1 }), /is not a message kind/, kind)
  const e = seal(KEY, { from: 'a', to: 'b', kind: 'K:x_y-1'.padEnd(60, 'z'), at: 1000 })
  const r = new Gate(KEY, () => 1000).open(e)
  assert.equal(r.ok, true); assert.equal(r.msg.kind.length, PROTOCOL.kindMax)
  assert.match(r.msg.nonce, /^[0-9a-f]{24}$/)
  assert.equal(r.msg.body, null, 'a body left out is null')
  assert.equal(seal(KEY, { from: 'a', to: 'b', kind: 'k', at: 1, nonce: 'given-nonce' }).slat.includes('(nonce "given-nonce")'), true)
})

// spec: eng §3.1 "`at` number: sender's clock in seconds" · POSTMORTEMS 2026-10-23 "every number that goes on the wire is finite or absent"
// class: W8 a reply that cannot be sealed (NaN) · J13 a value unset or non-numeric
// technique: fault injection on the sender's clock: `at` NaN, undefined, Infinity, a word
// method: before the fix seal wrote `(at NaN)` and every gate dropped it as malformed, so the sender saw only a timeout;
//         now seal throws one sentence at the sender; a numeric string still seals as its number
// sre: if a sender's clock breaks, does it learn at once, at its own seal, instead of from a silent timeout downstream?
test('seal refuses a non-finite `at` at the sender instead of sending an envelope every gate must drop', () => {
  for (const at of [NaN, undefined, Infinity, -Infinity, 'soon']) assert.throws(() => seal(KEY, { from: 'a', to: 'b', kind: 'k', at }), /`at` is a finite number of seconds/, String(at))
  assert.match(seal(KEY, { from: 'a', to: 'b', kind: 'k', at: '1000' }).slat, /\(at 1000\)/)
})

// spec: eng §3.1 body "JSON in slat … depth ≤ 24" · design §7 (symbols are not body data)
// class: J7 JSON.parse on hostile input (depth; NaN/Infinity; BigInt; a function)
// technique: boundary on depth (24 and 25) and on the types JSON cannot carry
// method: toSlat writes depth 24 and refuses 25; BigInt, a function and a Symbol throw one sentence; -0 and 1e21 write as numbers
// sre: if a hand's answer holds a value the wire cannot carry, does the sealer refuse it rather than write half a form?
test('toSlat writes 24 levels and refuses the 25th, a BigInt, a function and a JS Symbol, each with one sentence', () => {
  let deep = 1; for (let i = 0; i < 24; i++) deep = [deep]
  assert.equal(fromSlat(readForm(toSlat(deep))).flat(Infinity)[0], 1)
  assert.throws(() => toSlat([deep]), /nested too deep/)
  assert.throws(() => toSlat({ n: 10n }), /cannot carry a bigint/)
  assert.throws(() => toSlat({ f: () => 1 }), /cannot carry a function/)
  assert.throws(() => toSlat({ s: Symbol('x') }), /cannot carry a symbol/)
  assert.equal(toSlat(-0), '0'); assert.equal(fromSlat(readForm(toSlat(1e21))), 1e21)
  assert.equal(toSlat(undefined), 'null')
})

// spec: eng §3.1 "sig = hex HMAC-SHA256(key, slat) over the exact text that travels; nothing is canonicalized"
// class: J15 Unicode and bytes (multi-byte, NUL, CRLF, a BOM, a lone surrogate)
// technique: round trip of hostile strings through seal → open; a BOM before the form
// method: every string comes back identical; the BOM-prefixed text (signed) is not one form and is malformed
// sre: if a log line full of CJK, NULs and CRLFs rides in a body, does it arrive byte-identical and verifiable?
test('multi-byte text, NUL, CR LF and tabs ride a body byte-identical; a BOM before the form is malformed, not stripped', () => {
  const g = new Gate(KEY, () => 1000)
  const s = 'é中🙂\u0000\r\n\t"\\ end'
  const r = g.open(seal(KEY, { from: 'ü', to: '中', kind: 'k', body: { s, [s]: s }, at: 1000 }))
  assert.equal(r.ok, true); assert.equal(r.msg.body.s, s); assert.equal(r.msg.body[s], s); assert.equal(r.msg.from, 'ü')
  const e = seal(KEY, { from: 'a', to: 'b', kind: 'k', at: 1000 })
  const bom = '﻿' + e.slat
  const sig = crypto.createHmac('sha256', KEY).update(bom, 'utf8').digest('hex')
  assert.equal(g.open({ slat: bom, sig }).drop, 'malformed')
})

// spec: design §7 (a body is data, never evaluated) · eng §3.1 body · law 5 · F-10
// class: J7 hostile input (prototype pollution through a body key)
// technique: hostile keys in a correctly signed body, one at a time
// method: open bodies naming `__proto__`, `constructor` and `prototype`; each is dropped `malformed` with a sentence
//         naming the key (slat-data refuses it, 2026-10-24); Object.prototype stays clean; an ordinary body still opens
// sre: if a key holder sends `__proto__`, can it change what every object in the foreman believes?
test('a body key __proto__, constructor or prototype is dropped malformed; the prototype stays clean', () => {
  for (const k of ['__proto__', 'constructor', 'prototype']) {
    const text = `(msg (v 1) (from "a") (to "b") (kind k) (at 1000) (nonce "0123456789ab") (body (@ ("${k}" (@ ("polluted" #t))))))`
    const r = new Gate(KEY, () => 1000).open({ slat: text, sig: crypto.createHmac('sha256', KEY).update(text).digest('hex') })
    assert.equal(r.drop, 'malformed'); assert.match(r.why, new RegExp(k.replace('_', '_')))
  }
  assert.equal(({}).polluted, undefined); assert.equal(Object.prototype.polluted, undefined)
  const fine = '(msg (v 1) (from "a") (to "b") (kind k) (at 1000) (nonce "0123456789ac") (body (@ ("proto" 1))))'
  assert.equal(new Gate(KEY, () => 1000).open({ slat: fine, sig: crypto.createHmac('sha256', KEY).update(fine).digest('hex') }).ok, true)
})
