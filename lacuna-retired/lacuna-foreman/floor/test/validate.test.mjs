// validate.test.mjs — THE KIND CATALOG AND ITS VALIDATOR (lane F5-A, unit A.1; RULINGS-2026-10-30 §1(a); A2 §2.1, §2.5, §4.2,
// §10.3). Owns: the proofs that the catalog reads and holds every kind the rulings name; that its compiled text is kinds.slat
// byte for byte; that A2's eighteen canonical examples read and validate; that every kind validates an example made from its
// own types; that each pure malformed shape of A2 §10.3 is refused with its reason; and that every kind the fold reacts to is a
// kind of the catalog. Refuses: a mock of the validator; the catalog read is the real one.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { KINDS_SLAT } from '../kinds-text.js'
import { catalogFrom, kinds, producers, readEventLine, validateEvent } from '../validate.js'
import { KINDS_REACTED } from '../fold.js'
import { AT, BAD_LINES, GOOD_LINES, T } from './fixtures/bad-lines.mjs'

const HERE = new URL('.', import.meta.url)
const EXAMPLES = fs.readFileSync(new URL('fixtures/a2-examples.slat', HERE), 'utf8').split('\n').filter((l) => l.startsWith('(ev '))

// one value that fits a field's type, for the example each kind is held to
function sample(field) {
  const t = field.type
  switch (t.is) {
    case 'int': return 3
    case 'number': return 2.5
    case 'bool': return true
    case 'string': return 'x'.repeat(Math.min(5, t.max))
    case 'one-of': return [...t.values][0]
    case 'list': return t.of === 'number' ? [1, 2] : ['a', 'b']
    case 'counts': return Object.fromEntries([...t.keys].map((k) => [k, 0]))
    default: throw new Error(`no sample for ${t.is}`)
  }
}
const actorFor = (k) => k.actor.literal ?? ({ mind: 'e4b', run: 'w-5f0c6c', sentry: 'sentry-1b:w-5f0c6c', 'work-order': 'wo-995779', service: 'door',
  alert: 'alert:disk-low', 'run-or-petition': 'w-5f0c6c', visitor: 'visitor:k3m9x2ab', any: 'floor' }[k.actor.rule])
const exampleOf = (k) => ({ seq: 1, t: T, kind: k.name, actor: actorFor(k), at: k.at ? AT : '-', ref: k.ref ? 'w-5f0c6c' : null,
  src: [[...k.producers][0] === 'scene' ? 'scene:night' : [...k.producers][0], 7],
  data: Object.fromEntries([...k.fields].map(([key, f]) => [key, sample(f)])) })

// spec: RULINGS §1(a) (A2 §3 plus the review's §5a; the five renames; no run.outcome, no scene.ev, no mind.kv) · class: L5 the
// record's shape · technique: read the frozen catalog with the one reader · method: count the kinds and producers; every kind's
// producers exist; the renamed and refused kinds are absent · sre: does the door admit exactly the kinds the floor was designed for?
test('the catalog holds the 104 ruled kinds and 40 producers, and none of the kinds the rulings refuse', () => {
  assert.equal(kinds().size, 112)      // + owner.update (2026-11-06, lane chat: WORK-CHIPS-CHAT-DESIGN §3.1 #20) + owner.read (2026-11-01), + service.stop (2026-11-02, CL-FLOOR-SERVICES)   + ci.pass.start, ci.suite.start, ci.suite.end, ci.pass.end, scheme.eval (2026-11-04)
  assert.equal(producers().size, 47)  // + owner-updates (2026-11-06, lane chat) + library, + lme-lab, + changes (2026-11-02, CL-FLOOR-SERVICES); + turn-sentry (2026-11-04), + ci-progress, + vm-audit
  for (const k of ['run.claim', 'mind.slot', 'box.disk', 'floor.truth', 'mind.instance.add', 'scene.score']) assert.ok(kinds().has(k), k)
  for (const k of ['run.said', 'run.outcome', 'scene.ev', 'mind.kv', 'box.procs', 'alert.seen', 'mind.engine.crashloop']) assert.ok(!kinds().has(k), k)
  assert.ok(kinds().get('mind.load.start').fields.has('available-mb') && !kinds().get('mind.load.start').fields.has('avail-mb'))
  assert.throws(() => catalogFrom('(kind x.y (producers nobody) (fields))'), /names the producer nobody/)
})

// spec: A2 §4.1 (the registry is data, read once) · class: L5 · technique: the compiled form against its source · method: the
// string kinds-text.js exports equals kinds.slat byte for byte · sre: can the browser and the door read two different catalogs?
test('kinds-text.js is kinds.slat, byte for byte (run kinds-compile.mjs after an edit)', () => {
  assert.equal(KINDS_SLAT, fs.readFileSync(new URL('../kinds.slat', HERE), 'utf8'))
})

// spec: A2 §2.5 (one canonical example per family) · class: W5 malformed (the design's own lines) · technique: the design is the
// spec · method: each of the eighteen lines through readEventLine · sre: does the validator admit the lines the design promises?
test('the eighteen canonical examples of A2 §2.5 read and validate', () => {
  assert.equal(EXAMPLES.length, 18)
  for (const line of EXAMPLES) {
    const r = readEventLine(line)
    assert.ok(r.ok, `${r.why}: ${line.slice(0, 90)}`)
  }
})

// spec: the brief A.1's gate ("every kind validates its example") · class: L5 · technique: an example made from each kind's own
// types · method: one value per field, the actor and coordinate its family requires · sre: is any kind in the catalog unadmittable?
test('every kind validates an example made from its own types', () => {
  for (const k of kinds().values()) {
    const r = validateEvent(exampleOf(k))
    assert.ok(r.ok, `${k.name}: ${r.why}`)
    assert.equal(r.family, k.family)
  }
})

// spec: A2 §10.3 (one case per reason; the pure ones: the clock, the dedup, the rate and the scene gate are the admit's, A.4) ·
// class: W5 malformed · technique: one hand-made line per shape (fixtures/bad-lines.mjs, which the admit's test reads too) ·
// method: each line through readEventLine, its reason asserted · sre: does every bad line name why it was refused?
test('each malformed shape of A2 §10.3 that needs no state is refused with its reason', () => {
  assert.equal(BAD_LINES.length, 22)
  for (const [name, text, why] of BAD_LINES) assert.equal(readEventLine(text).why, why, name)
  for (const [name, text, opts] of GOOD_LINES) assert.ok(readEventLine(text, opts).ok, name)
})

// spec: RULINGS §1(a) (no scene.ev: a scene's rows carry their real kinds) and A2 §4.7 (the gate is the admit's) · class: W5
// malformed · technique: one scene row and one owner row of a real kind · method: through validateEvent · sre: can a drill
// play a stall, and can the owner's src forge a run's pass?
test('a scene, which feeds any, carries a real kind; the owner, which feeds scenes, does not', () => {
  const ev = (kind, src, actor, data) => ({ t: T, kind, actor, at: AT, ref: actor, src, data })
  assert.ok(validateEvent(ev('run.filed', ['scene:stall', 3], 'w-d20001', { cart: 'sentry-watch', by: 'foreman' })).ok)
  assert.equal(validateEvent(ev('run.pass', ['owner', 3], 'w-d20001', {})).why, 'producer')
  assert.equal(validateEvent(ev('run.filed', ['drill:stall', 3], 'w-d20001', { cart: 'sentry-watch' })).why, 'producer')
})

// spec: RULINGS §1(b) (the fold's kinds) over §1(a) · class: L5 · technique: the consumer's table against the producer's ·
// method: every kind the fold reacts to is a kind of the catalog · sre: can the fold wait for a kind the door never admits?
test('every kind the fold reacts to is a kind of the catalog', () => {
  const missing = [...KINDS_REACTED].filter((k) => !kinds().has(k))
  assert.deepEqual(missing, [])
})

// spec: the make-it-right audit E14 §5 row 8 (A2 fix 6: 160 of 181 rows quarantined on 2026-11-06 were the cart sentry's sweep,
// `(kind control) (by code)`, words the catalog did not hold, so Lacuna's lights read unknown) · class: L5 the record · technique:
// the quarantined line itself · method: readEventLine · sre: does the cart sentry's check reach the floor?
test('the cart sentry\'s sweep (a control check, by code) is admitted; a word outside the catalog is still refused', () => {
  const line = (kind, by) => `(ev (seq 1) (t ${T}) (kind sentry.check) (actor "sentry-270m:w-93a9c6") (at "${AT}") (ref "w-93a9c6") (src "foreman-bus" 3418873882386544) (data (@ ("kind" "${kind}") ("n" 1) ("by" "${by}"))))`
  assert.equal(readEventLine(line('control', 'code')).ok, true)
  assert.equal(readEventLine(line('controls', 'code')).why, 'schema:kind')
})

// spec: the design's P1 (the stop's four words on the floor: a room turn stopped or cut by a swap is said so, never quarantined) ·
// class: L5 the record · technique: the room's own fail rows · method: validateEvent · sre: does a stopped room turn reach the floor?
test('the room\'s stopped and swapped turns are admitted from the agents room', () => {
  for (const reason of ['stop', 'swap', 'cancel', 'deadline']) {
    assert.equal(validateEvent({ t: T, kind: 'mind.turn.fail', actor: 'e4b', at: AT, ref: null, src: ['agents-room', 1], data: { reason, id: 'room-1', ms: 900 } }).ok, true, reason)
  }
})
