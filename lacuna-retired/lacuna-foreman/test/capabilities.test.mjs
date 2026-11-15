// capabilities.test.mjs — U1 unit tests for `capabilities.mjs`, the verb set a worker holds.
// owns: the proofs that a set only shrinks (tier → parent → untrusted), that a refusal is one sentence naming why, that
//   no hand op is an effect, and that a child is spawned only from a literal of its parent's text.
// refuses: to mock capabilities.mjs; every test calls it directly or through a real `Supervisor` on a fake clock.
// implements: design §3 law 11 ("capabilities only shrink"; untrusted input never triggers an act), §11 (tiers, a child
//   ≤ its parent, literal spawn), §6 change 1 (hands are reads, acts are effects); eng §2 row capabilities.mjs.
// invariants: law 11 (none of §18's sentences is written in this module).
// faults: F-02 (a verb the tier or header does not hold is refused, exit 12 on a run).
// coverage: capabilities.mjs — lines 100% branches 97.83% functions 100% (2026-10-24, with capabilities-table.test.mjs; :37 todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { VERBS, PURE, ACTING, HAND_READS, governed, tierVerbs, capsFor, literalStrings } from '../capabilities.mjs'
import { symOf } from '../scheme.mjs'
import { makeSup } from '../../../test/conformance/fake-host.mjs'

// the 18 acts of design §6 change 1 (as corrected 2026-10-23)
const ACTS = ['shell', 'patch', 'git-commit', 'git-push', 'merge', 'pytest', 'strict', 'forge', 'pass', 'promote', 'build',
  'install-ipad', 'restart-service', 'prune', 'trash', 'checkout', 'switch-brain', 'bundle']

// spec: design §11 (tiers J0–J3; watch reads, act may ask) · law 11 · F-02
// class: L3 an act without a press (a watch worker that could ask or act would skip the press path)
// technique: state walk over every tier, including one the table does not know
// method: read tierVerbs for watch, act and an unknown tier; assert watch ⊂ act, ask/act only at act, an unknown tier
//         gets the watch ceiling (fail closed, never wider), and no PURE verb is governed
// sre: if a header names a tier nobody spelled right, does the worker get less, never more?
test('a watch worker holds no act-tier verb; an unknown tier gets the watch ceiling, never more', () => {
  const watch = tierVerbs('watch'), act = tierVerbs('act'), odd = tierVerbs('owner')
  assert.ok(!watch.includes('ask') && !watch.includes('act'))
  assert.ok(act.includes('ask') && act.includes('act'))
  assert.ok(watch.every((v) => act.includes(v)))
  assert.deepEqual(odd, watch)
  assert.deepEqual(governed().filter((v) => PURE.has(v)), [])
  assert.equal(governed().length + [...PURE].filter((v) => VERBS.some((x) => x.name === v)).length, VERBS.length)
})

// spec: design §11 (capabilities only shrink) · law 11 · F-02
// class: B7 a ceiling (the set's ceiling, tier → parent → untrusted)
// technique: state walk: asked null × parent × untrusted
// method: compute the set for each combination; assert each step only removes verbs, a symbol in the ask is read by
//         name, and a PURE verb asked for is not counted as a capability
// sre: if a parent holds only report, can its child ever hold spawn?
test('a set only shrinks: the tier, then the parent, then the untrusted mark', () => {
  const all = capsFor({ tier: 'act' })
  const parent = { name: 'p', verbs: new Set(['report', 'spawn', 'need-brain', 'hand']) }
  const child = capsFor({ tier: 'act', parent })
  assert.deepEqual([...child].sort(), ['hand', 'need-brain', 'report', 'spawn'])
  assert.ok([...child].every((v) => all.has(v)))
  const quarantined = capsFor({ tier: 'act', parent, readsUntrusted: true })
  assert.deepEqual([...quarantined].sort(), ['hand', 'report'])
  assert.deepEqual([...capsFor({ tier: 'watch', asked: [symOf('report'), 'on', 'recall'] })], ['report'])
  assert.deepEqual([...capsFor({ tier: 'watch', asked: [] })], [])
})

// spec: design §11 (refused with a sentence, never widened) · F-02 · exit 12
// class: L3 an act without a press
// technique: boundary: each reason the ask is wider than the ceiling, singular and plural
// method: ask for verbs past each ceiling; read the sentence: untrusted → "may not act"; parent → "does not hold
//         it|them"; tier → "a watch worker may not have it|them"; unknown → "do not exist"
// sre: if a cart's header asks for more than it may have, does the refusal tell the author exactly why in one line?
test('a wider ask is refused with one sentence that names why, singular or plural', () => {
  const parent = { name: 'lead', verbs: new Set(['report']) }
  assert.throws(() => capsFor({ name: 'reader', tier: 'act', asked: ['spawn'], readsUntrusted: true }),
    /^Error: reader may not have spawn — it reads untrusted text, so it may not act; a worker's verbs only shrink$/)
  assert.throws(() => capsFor({ name: 'kid', tier: 'act', asked: ['hand'], parent }), /its parent lead does not hold it;/)
  assert.throws(() => capsFor({ name: 'kid', tier: 'act', asked: ['hand', 'mail'], parent }), /may not have hand, mail — its parent lead does not hold them;/)
  assert.throws(() => capsFor({ name: 'w', tier: 'watch', asked: ['ask'] }), /may not have ask — a watch worker may not have it;/)
  assert.throws(() => capsFor({ name: 'w', tier: 'watch', asked: ['ask', 'act'] }), /a watch worker may not have them;/)
  assert.throws(() => capsFor({ tier: 'act', asked: ['rm', 'curl'] }), /^Error: worker asks for verbs that do not exist: rm, curl$/)
  assert.throws(() => capsFor({ tier: 'act', asked: [null] }), /do not exist: null$/, 'a hole in the ask is a refusal, never a wildcard')
  assert.throws(() => capsFor({ tier: 'act', asked: ['report'], readsUntrusted: true, parent: { name: 'q', verbs: new Set(['spawn']) } }),
    /its parent q does not hold it/, 'a non-acting verb refused by the parent names the parent, not the untrusted mark')
})

// spec: design §6 change 1 (hands are reads; acts are effects) · law 4 · eng §2 row capabilities.mjs
// class: L3 an act without a press
// technique: set intersection over the design's list of acts
// method: intersect HAND_READS with the 18 acts of §6 change 1 and with ACTING; both must be empty
// sre: if someone adds 'merge' to the read table, would a quarantined worker merge without the owner's press?
test('no hand op is an act: HAND_READS and the 18 acts of §6 change 1 share nothing', () => {
  assert.deepEqual(ACTS.filter((a) => HAND_READS.has(a)), [])
  assert.deepEqual([...ACTING].filter((a) => HAND_READS.has(a)), [])
  assert.ok(ACTING.has('need-brain'), 'need-brain acts: it hands the reader\'s words to the 26B (dual-LLM rule)')
})

// spec: design §11 (literal spawn: plan, then execute) · law 11
// class: J7 JSON.parse on hostile input (a program text that does not read)
// technique: boundary: nested literals, a quoted list, an unreadable program
// method: read literalStrings of a program with strings at depth 1–3 and of a program that does not parse; the second
//         is an empty set, never a throw
// sre: if a worker's program is garbage, does the spawn check fail closed (no literals → no spawn)?
test('literalStrings reads every string literal at any depth; an unreadable program has none', () => {
  const lits = literalStrings(`(define a "one") (on 'x (lambda (v) (spawn 'k "(define b 2)" '("deep" ("deeper")))))`)
  assert.deepEqual([...lits].sort(), ['(define b 2)', 'deep', 'deeper', 'one'])
  assert.equal(literalStrings('(on (quote x)').size, 0)
})

// spec: design §11 (a child ≤ its parent; literal spawn) · law 11 · F-02
// class: E1 a handler throws (the refusal is a throw in the parent's handler)
// technique: fault injection through a real supervisor on a fake clock (makeSup)
// method: a parent holding spawn and report spawns (a) from a literal, (b) from text that arrived in an event, (c) a
//         child asking for a verb the parent lacks; read the records: one child, two `crashed` rows with the sentences,
//         and no third worker in the table
// sre: if a hostile event carries a program, can a worker run it by spawning it? It must crash with the reason instead.
test('a child is spawned only from the parent\'s own text and never wider than the parent', () => {
  const { h, s } = makeSup()
  const p = s.spawn({ name: 'lead', verbs: ['spawn', 'report'], program: `
    (on 'ok (lambda (x) (spawn 'kid "(on 'y (lambda (v) #t))")))
    (on 'data (lambda (prog) (spawn 'evil prog)))
    (on 'wide (lambda (x) (spawn 'kid2 "(on 'y (lambda (v) #t))" '(hand))))` })
  assert.equal(s.send(p.id, 'ok', 0).ok, true)
  s.send(p.id, 'data', `(on 'z (lambda (v) (report 'owned v)))`)
  s.send(p.id, 'wide', 0)
  const crashed = h.up.filter((u) => u.kind === 'crashed').map((u) => u.data.why)
  assert.match(crashed[0], /lead may spawn only a program written in its own text — runtime data never becomes code/)
  assert.match(crashed[1], /kid2 may not have hand — its parent lead does not hold it/)
  assert.equal(s.workers.size, 2)
})

