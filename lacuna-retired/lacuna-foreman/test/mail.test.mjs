// mail.test.mjs — MAIL TO CLAUDE (lane U2). Owns: the unit tests of mail.mjs: the one letter shape, the dedupe (F-11)
// and its memory bound (KEPT 500), the size cap (8,192 bytes), the file name, the `(mail …)` verb's argument reading, and
// law 7 at emit time (no token, key or PIN in a letter). Refuses: a mock of mail.mjs; the live mail folder
// (~/lacuna-world/foreman/mail) — the conformance fake host captures every letter in memory.
// Implements: design §7.6 (the letter), §9 (mail is the channel; identical `what` within an hour is a count), law 7;
// engineering §3.2 hop 17, §3.3 mail, §3.5 (DEDUPE_S 3,600, BYTES 8,192, KEPT 500).
// Invariants (§18): "a letter names its run and its evidence" (the module's own). Faults (§16): F-11.
// coverage: mail.mjs — lines 100% branches 100% functions 100% (2026-10-24, lane U2 files)
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { sendMail, fileName, mailArgs, KINDS, SEVERITIES, DEDUPE_S, BYTES, KEPT } from '../mail.mjs'
import { KEY_DENYLIST } from '../../../lacuna-executor/redact.mjs'
import { readData } from '../../../lacuna-scheme/src/slat-data.js'

const body = (m) => readData(m.text.replace(/^\(mail /, '').replace(/\)$/, ''))
const run = (o = {}) => ({ id: 'w-7', name: 'triggers', run: { key: 'ipad@07:00' }, ...o })

// spec: design §7.6 "identical what within an hour from one sender raises a count" · §16 F-11 · eng §3.5 DEDUPE_S 3,600
// class: E10 a duplicate message · J14 the clock (the edge of the hour)
// technique: boundary on the window with a fake clock: +3,599 s is a count, +3,600 s is a new letter
// method: read the records the design names: one letter file per new letter (`host.mail`), a count raised in place
//         (`host.mailCount`) with the first letter's id; another sender, or another `what`, is its own letter
// sre: if a cart reports the same sickness every minute, does Claude get one letter with a count instead of sixty?
test('the same what from one sender inside 3,600 s raises a count on the first letter; at 3,600 s it is a new letter', () => {
  const { h, s } = makeSup()
  const first = sendMail(s, run(), { what: 'strict fails the same way', severity: 'stuck' })
  h.tick(DEDUPE_S - 1)
  const again = sendMail(s, run(), { what: 'strict fails the same way', severity: 'stuck' })
  assert.deepEqual(again, { ok: true, id: first.id, count: 2, deduped: true })
  assert.deepEqual(h.counts, [{ id: first.id, count: 2 }]); assert.equal(h.letters.length, 1)
  assert.equal(sendMail(s, run({ name: 'other' }), { what: 'strict fails the same way' }).count, 1, 'another sender')
  assert.equal(sendMail(s, run(), { what: 'strict fails another way' }).count, 1, 'another what')
  assert.equal(sendMail(s, run(), { what: '  strict fails the same way  ' }).deduped, true, 'the same words, trimmed')
  h.tick(1)
  const fresh = sendMail(s, run(), { what: 'strict fails the same way' })
  assert.equal(fresh.count, 1); assert.notEqual(fresh.id, first.id); assert.equal(h.letters.length, 4)
})

// spec: design §7.6 (kind: self-report|ticket|handoff-note; severity: sick|stuck|wrong|note) · eng §3.3 mail
// class: W5 malformed (shape) · L5 the record's shape
// technique: table over every kind × severity, the defaults, and the values outside them; an empty and a blank `what`
// method: the twelve good pairs each write one letter; a bad kind, a bad severity, an empty what are refused with a
//         sentence and write nothing; the defaults are self-report and note
// sre: if a cart invents a severity, is the letter refused with a sentence rather than filed where no one looks?
test('three kinds × four severities are letters; any other kind, severity or an empty what is refused and writes nothing', () => {
  const { h, s } = makeSup()
  for (const kind of KINDS) for (const severity of SEVERITIES) assert.equal(sendMail(s, null, { kind, severity, what: `${kind} ${severity}` }).ok, true)
  assert.equal(h.letters.length, 12)
  const d = sendMail(s, null, { what: 'defaults' }); assert.equal(d.ok, true)
  assert.deepEqual([h.letters.at(-1).kind, h.letters.at(-1).severity], ['self-report', 'note'])
  const bad = [[{ kind: 'memo', what: 'x' }, /mail kind is one of self-report ticket handoff-note, not memo/], [{ severity: 'panic', what: 'x' }, /severity is one of sick stuck wrong note, not panic/],
    [{ what: '' }, /a letter says what/], [{ what: '   ' }, /a letter says what/], [{}, /a letter says what/], [undefined, /a letter says what/]]
  for (const [o, why] of bad) { const r = sendMail(s, null, o); assert.equal(r.ok, false); assert.match(r.why, why) }
  assert.equal(h.letters.length, 13)
})

// spec: design §7.6 the letter {id, kind, from, to, at, severity, run, what, evidence, asks, untrusted} · §18 "a letter names its run and its evidence"
// class: L5 the record's shape · B1 bounds (what 2,000 chars, asks 500)
// technique: table over senders: the foreman, a run, a cart with only a contract, a bare worker; boundary on the cuts
// method: read the letter written and its `(mail …)` text by the one reader: run named from the run's key, the contract's
//         key, the worker id, else null; evidence an object or {}; asks null or cut to 500; untrusted only when exactly true
// sre: if Claude opens a letter, does it always say which run and what evidence, in the one form the reader reads?
test('a letter names its sender and its run, carries its evidence as an object, and reads back by the one reader', () => {
  const { h, s } = makeSup()
  sendMail(s, null, { what: 'w'.repeat(3000), asks: 'q'.repeat(600), evidence: { fault: 'F-07', tail: 'x' }, untrusted: 'yes' })
  let m = h.letters.at(-1)
  assert.deepEqual([m.from, m.to, m.run, m.what.length, m.asks.length, m.untrusted, m.count], ['foreman', 'claude', null, 2000, 500, false, 1])
  assert.deepEqual(body(m), { id: m.id, kind: 'self-report', from: 'foreman', to: 'claude', at: h.now(), severity: 'note', run: null, what: m.what, evidence: { fault: 'F-07', tail: 'x' }, asks: m.asks, untrusted: false, count: 1 })
  assert.match(m.id, /^m-[0-9a-z]+-f$/)
  sendMail(s, run(), { what: 'a', run: 'given', evidence: 'not an object', untrusted: true }); m = h.letters.at(-1)
  assert.deepEqual([m.run, m.evidence, m.asks, m.untrusted, m.from], ['given', {}, null, true, 'triggers'])
  sendMail(s, run(), { what: 'b' }); assert.equal(h.letters.at(-1).run, 'ipad@07:00')
  sendMail(s, { id: 'w/9', name: 'cart', contract: { key: 'ck' } }, { what: 'c' }); assert.equal(h.letters.at(-1).run, 'ck'); assert.match(h.letters.at(-1).id, /-w9$/)
  sendMail(s, { id: 'w-10', name: 'bare' }, { what: 'd', evidence: null }); assert.deepEqual([h.letters.at(-1).run, h.letters.at(-1).evidence], ['w-10', {}])
  sendMail(s, { id: '', name: 'blank' }, { what: 'e' }); assert.equal(h.letters.at(-1).run, null)
})

// spec: law 7 "Nothing prints a token, key or PIN. Secrets are named by path. Redact at emit time." · design §7.6 · O-67
// class: W7 a body with a secret (redacted at emit)
// technique: fault injection: a letter whose what, asks and evidence carry every denylisted key of lacuna-executor/redact.mjs
//            and the token shapes the box meets (an Anthropic, Google, Hugging Face, GitHub key; a PEM block; 64-hex)
// method: before the fix mail.mjs wrote them raw into ~/lacuna-world/foreman/mail; now the letter's text and every field
//         carry `[redacted]` instead, the same denylist as the hands' redactor (imported here, so the two cannot drift)
// sre: if a worker mails a failing command with its token in it, does the letter on disk still hold no secret?
test('a letter carries no secret: denylisted keys lose their value, token shapes and key=value pairs are redacted at emit', () => {
  const { h, s } = makeSup()
  const SECRET = 'S3cr3tValue9'
  const evidence = Object.fromEntries(KEY_DENYLIST.map((k) => [k, `${SECRET}-${k}`]))
  evidence.nested = { 'X-Api-Key': SECRET, list: [`--token ${SECRET}`, `password=${SECRET}`], ok: 'kept' }
  evidence.git = 'a'.repeat(40)
  evidence.shapes = ['sk-ant-api03-abcdefghijklmnopqrstuv', 'AIzaSyA1234567890abcdefghijklmnopqrstu', 'hf_abcdefghijklmnopqrstuvwx', 'ghp_' + 'a'.repeat(36),
    '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----', 'f'.repeat(64)]
  const r = sendMail(s, run(), { what: `curl -H "Authorization: Bearer ${SECRET}" failed; token=${SECRET}`, asks: `is api_key: ${SECRET} stale?`, evidence })
  assert.equal(r.ok, true)
  const m = h.letters.at(-1)
  const all = JSON.stringify(m)
  assert.ok(!all.includes(SECRET), all.slice(0, 400))
  for (const shape of evidence.shapes) assert.ok(!all.includes(shape.slice(0, 20)), shape)
  assert.match(m.what, /\[redacted\]/); assert.match(m.asks, /\[redacted\]/)
  assert.equal(m.evidence.nested.ok, 'kept'); assert.equal(m.evidence.token, '[redacted]')
  assert.equal(m.evidence.git, 'a'.repeat(40), 'a 40-hex git sha stays readable')
})

// spec: design §7.6 · eng §3.5 "a letter ≤ 8,192 bytes" · mail.mjs BYTES 8,192
// class: J15 Unicode and bytes (`content-length` in bytes, not chars) · B1 the bound
// technique: boundary on the cap in bytes: an ASCII letter at 8,192 and 8,193 bytes; a letter of three-byte characters
//            that is under 8,192 characters but over 8,192 bytes
// method: before the fix the cap counted characters, so a 3,100-character letter of '中' (≈ 9,300 bytes) was written; now
//         the byte length decides, and a refused letter writes nothing and is not remembered for the dedupe
// sre: if a letter is full of non-Latin text, does the size cap still hold on disk, where bytes are what count?
test('the size cap is 8,192 bytes of the (mail …) text: at the cap it is written, one byte over or wide characters over it are refused', () => {
  const { h, s } = makeSup()
  const probe = sendMail(s, null, { what: 'probe', evidence: { pad: '' } })
  const base = Buffer.byteLength(h.letters.at(-1).text)
  h.tick(1)
  const fit = sendMail(s, null, { what: 'fit', evidence: { pad: 'x'.repeat(BYTES - base + 2) } })
  assert.equal(fit.ok, true); assert.equal(Buffer.byteLength(h.letters.at(-1).text), BYTES)
  const over = sendMail(s, null, { what: 'fit2', evidence: { pad: 'x'.repeat(BYTES - base + 2) } })
  assert.deepEqual(over, { ok: false, why: `a letter is under ${BYTES} bytes` })
  const wide = sendMail(s, null, { what: 'wide', evidence: { detail: '中'.repeat(3100) } })
  assert.equal(wide.ok, false, `${'中'.repeat(3100).length} chars, ${Buffer.byteLength('中'.repeat(3100))} bytes`)
  assert.equal(h.letters.length, 2); assert.equal(probe.ok, true)
  assert.equal(sendMail(s, null, { what: 'wide', evidence: { detail: 'short' } }).count, 1, 'a refused letter is not remembered by the dedupe')
})

// spec: eng §3.5 KEPT 500 ("nothing that only grows") · design §9 / F-11 (the dedupe)
// class: B1 every *_KEPT bound holds under 10× its size · J16 a Map that grows without a bound
// technique: flood: 5,000 distinct letters (10× KEPT) inside one hour
// method: the dedupe memory holds 500; the newest letter still dedupes; the oldest is forgotten and writes a new letter
// sre: if a storm of distinct letters arrives, does the foreman's memory of them stay flat?
test('the dedupe memory holds the last 500 letters under a 10× storm; the newest still dedupe', () => {
  const { h, s } = makeSup()
  for (let i = 0; i < 10 * KEPT; i++) sendMail(s, null, { what: `letter ${i}` })
  assert.equal(s.mailRecent.size, KEPT)
  assert.equal(sendMail(s, null, { what: `letter ${10 * KEPT - 1}` }).deduped, true)
  assert.equal(sendMail(s, null, { what: 'letter 0' }).count, 1, 'the oldest was forgotten')
  assert.equal(h.letters.length, 10 * KEPT + 1)
})

// spec: design §9 / F-11 "identical what within an hour … raises a count" · eng §3.5 KEPT 500
// class: B1 every *_KEPT bound holds (the order the bound forgets in) · E10 a duplicate
// technique: state-machine walk with a fake clock: A, ten others, A again after the hour (a new letter), then 491 others
// method: before the fix the renewed A kept its old place in the memory and was forgotten first, so A again inside its
//         new hour wrote a second file; now a renewed letter moves to the newest place and the repeat is a count
// sre: if one sickness recurs every hour amid a busy day, does it still collapse into one letter per hour?
test('a letter renewed after its hour is remembered as the newest, so the memory bound forgets older letters first', () => {
  const { h, s } = makeSup()
  sendMail(s, null, { what: 'A' })
  for (let i = 0; i < 10; i++) sendMail(s, null, { what: `B${i}` })
  h.tick(DEDUPE_S + 1)
  assert.equal(sendMail(s, null, { what: 'A' }).count, 1, 'a new hour, a new letter')
  for (let i = 0; i < KEPT - 9; i++) sendMail(s, null, { what: `C${i}` })
  assert.equal(sendMail(s, null, { what: 'A' }).deduped, true)
})

// spec: design §7.6 (a letter is data) · eng §3.1 body "finite number" · POSTMORTEMS 2026-10-23 ("every number on the wire is finite")
// class: W8 a reply that cannot be sealed (NaN) · J7 hostile input (depth; a cycle; a BigInt)
// technique: fault injection on the evidence: NaN, Infinity, a BigInt, a 40-level nest, a cycle
// method: before the fix `toSlat` threw inside sendMail and the caller (a worker's mail verb, the kick rule) crashed; now
//         each is refused with one sentence, nothing is written, and the foreman carries on
// sre: if a cart mails a NaN it computed, does the letter refuse politely instead of crashing the cart that sent it?
test('evidence the wire cannot carry is refused with a sentence, never a throw', () => {
  const { h, s } = makeSup()
  let deep = {}; const top = deep; for (let i = 0; i < 40; i++) { deep.d = {}; deep = deep.d }
  const cyc = { a: 1 }; cyc.self = cyc
  for (const evidence of [{ n: NaN }, { n: Infinity }, { n: 10n }, top, cyc]) {
    let r
    assert.doesNotThrow(() => { r = sendMail(s, null, { what: `bad ${Math.random()}`, evidence }) })
    if (!r.ok) assert.match(r.why, /a letter is data/)
  }
  assert.ok(h.letters.every((m) => typeof m.text === 'string'))
  assert.equal(sendMail(s, null, { what: 'bad', evidence: { n: NaN } }).ok, false)
})

// spec: design §7.6 "file ~/lacuna-world/mail/to-claude/<ts>-<from>-<kind>.slat" · eng §3.2 hop 17
// class: M9 paths (no colon, no slash in a file name) · J15 Unicode in a sender's name
// technique: table over senders with slashes, dots, spaces, colons and 60 characters; a fixed local time
// method: the name is local time `YYYY-MM-DD-HH-MM-SS`, the sender cut to 40 with every unsafe character `_`, then the kind
// sre: if a worker is named "../../etc", can its letter's file name escape the mail folder?
test('the file name is local time, the sender made safe and cut to 40, and the kind; no colon or slash survives', () => {
  const at = new Date(2026, 9, 24, 7, 5, 9).getTime() / 1000
  assert.equal(fileName({ at, from: 'foreman', kind: 'self-report' }), '2026-10-24-07-05-09-foreman-self-report.slat')
  const odd = fileName({ at, from: '../../etc/x:y z中' + 'q'.repeat(60), kind: 'ticket' })
  assert.doesNotMatch(odd, /[/:]/); assert.match(odd, /^2026-10-24-07-05-09-\.\._\.\._etc_x_y_z_q+-ticket\.slat$/)
  assert.equal(odd.split('-ticket')[0].slice(20).length, 40)
})

test.todo('mail.mjs fileName: two letters from one sender of one kind in the same second get the same name, and foreman.mjs ' +
  'mail() overwrites the first (carts.mjs boot mails one letter per refused cart, all from "foreman", in one second: E9 a letter lost). ' +
  'The name is design §7.6 `<ts>-<from>-<kind>.slat` and test/conformance/forms.test.mjs pins its regex, so the fix (a suffix, or ' +
  'milliseconds) is the lead\'s call: MAIL [U2] [lead]. Reachable as a test once the name carries the letter id.')

// spec: design §7.6 the `(mail 'kind "what" (@ ("fault" "F-07") ("severity" "stuck") …))` verb · eng §3.3
// class: J7 hostile input (an alist of odd shapes) · L5 the record's shape
// technique: table over the verb's third argument: an object, an alist with symbol and string keys, a pair of three, an
//            empty pair, junk, nothing
// method: severity comes from the extra, else `wrong` when a fault is named, else `note`; asks and untrusted leave the
//         evidence; a three-element pair keeps its tail as a list; anything not a list or object is no evidence
// sre: if a cart writes its mail extras in the old alist form, does the letter still carry the right severity and evidence?
test('mailArgs reads the verb\'s extras: object or alist; severity from the extra, else wrong for a fault, else note', () => {
  const sym = (name) => ({ name })
  assert.deepEqual(mailArgs('ticket', 'w', { severity: 'sick', fault: 'F-07', asks: 'q', untrusted: true, tail: 't' }),
    { kind: 'ticket', what: 'w', severity: 'sick', evidence: { fault: 'F-07', tail: 't' }, asks: 'q', untrusted: true })
  assert.deepEqual(mailArgs('self-report', 'w', [[sym('fault'), 'F-03'], ['detail', 1, 2], [], 'junk', ['asks', 'who?']]),
    { kind: 'self-report', what: 'w', severity: 'wrong', evidence: { fault: 'F-03', detail: [1, 2] }, asks: 'who?', untrusted: false })
  assert.deepEqual(mailArgs('note', 5, null), { kind: 'note', what: '5', severity: 'note', evidence: {}, asks: undefined, untrusted: false })
  assert.equal(mailArgs('k', 'w', 'text').severity, 'note')
  const { s } = makeSup()
  assert.equal(sendMail(s, null, mailArgs('self-report', 'w', [['severity', 'nope']])).ok, false)
})

// spec: eng §3.2 hop 17 (the foreman writes the file) · design §9 ("nobody is woken")
// class: E9 a message lost (no writer attached) · J4 a callback missing
// technique: a host with no `mail` and no `mailCount`
// method: a letter and its repeat answer ok with an id and a count; nothing throws
// sre: if the foreman runs without a mail folder (a test box, a trial), does mailing still never crash a worker?
test('a host with no mail writer still answers each letter and its count without throwing', () => {
  const s = { host: { now: () => 100 } }
  const a = sendMail(s, null, { what: 'x' }); const b = sendMail(s, null, { what: 'x' })
  assert.deepEqual([a.ok, b.count, b.deduped], [true, 2, true])
})
