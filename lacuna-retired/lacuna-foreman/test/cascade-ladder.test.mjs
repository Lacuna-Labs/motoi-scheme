// cascade-ladder.test.mjs — THE LADDER AND THE ACCEPT RULE, AT THEIR EDGES. Owns: the tests of cascade.mjs `ladder`,
// `threshold`, `brokenRule`, `judge` and `policy` against tables that are missing, partial, hostile or tied. Refuses: the
// live box profile and the live tiers.json (fixtures only); a mock of cascade.mjs. Implements: work order U5 §3 row
// talk/mind/cascade; design §10 (the box's minds: 2B cap while the 26B is loaded, the 4B reserved), §12.1 (job classes).
// Invariants (§18): "If a mind's gate is below 90% per class, then its verdicts are advice and no notice or kick came
// from it" — a rung that is not benched or not allowed never answers first; the 26B is always last. Faults (§16): F-16
// (a mind that answers no verdict is on purpose until the 90% gate).
// coverage: cascade.mjs — lines 100% branches 98.20% functions 100% (2026-10-24, the lane's files alone; the policy-file default is a todo)
import test from 'node:test'
import assert from 'node:assert/strict'
import { ladder, threshold, brokenRule, judge, policy, LAST_RUNG } from '../cascade.mjs'

const JOB = { name: 'label', labels: ['noise', 'real-error'], verbs: new Set() }
const models = (rs) => rs.map((r) => r.model)

// spec: design §10 (agents stop at 2B while the 26B is loaded; the 4B reserved) · cascade.mjs header (the 26B last_rung always last)
// class: J13 an unset or empty table (no box profile, no tiers.json, a box with no `reserved`, no `last_rung`)
// technique: boundary — every optional table field absent, one at a time
// method: build the ladder from null, {} and partial tables; read the rung list and the last rung
// sre: on a fresh box with no bench yet, does a cart still get a ladder that ends at the 26B, with no model it may not load?
test('with no box profile and no bench the ladder is the workhorse then the 26B; a box without agent_minds is no box', () => {
  assert.deepEqual(models(ladder('label')), ['functiongemma', LAST_RUNG])
  assert.deepEqual(models(ladder('label', { box: { agent_minds: 'functiongemma' } })), ['functiongemma', LAST_RUNG])
  const r = ladder('label', { box: { agent_minds: ['gemma3:270m:latest'] } })
  assert.deepEqual(models(r), ['gemma3:270m', LAST_RUNG], 'no workhorse named: the first agent mind, its :latest dropped')
  assert.deepEqual(r.map((x) => [x.last, x.pct, x.params_b]), [[false, null, null], [true, null, null]])
  assert.deepEqual(models(ladder('label', { box: { agent_minds: [], workhorse: '' } })), [LAST_RUNG], 'nothing allowed: the 26B alone')
})

// spec: design §10 (the 4B reserved; agents stop at 2B) · box-minds.json `last_rung`, `max_params_b`
// class: B7 a bound at its edge (max_params_b 2: a 2.0 B model fits, 2.6 B does not) · J13 a renamed last rung
// technique: boundary on the parameter cap; a reserved workhorse; a box whose last rung is renamed
// method: ladders from tables that put the workhorse in `reserved`, name a custom last rung, and rank models at 2.0 and 2.6 B
// sre: if the box profile reserves the workhorse for training, does any cart still load it as a mind and swap the box?
test('the cap, the reserved list and a renamed last rung hold: a reserved or over-cap model never climbs, the named last rung is last', () => {
  const box = { agent_minds: ['gemma4:e4b', 'gemma3:1b', 'x2', 'big'], workhorse: 'gemma4:e4b', reserved: { 'gemma4:e4b:latest': 'training' },
                max_params_b: 2, last_rung: 'judge-26b:latest' }
  assert.deepEqual(models(ladder('label', { box })), ['judge-26b'], 'the reserved workhorse never answers; nothing benched stands in for it')
  const tiers = { models: [{ model: 'x2', params_b: 2.0 }, { model: 'big', params_b: 2.6 }, { model: 'judge-26b', params_b: 25.2 }],
                  classes: { label: { ranked: [{ model: 'big', pct: 99 }, { model: 'x2', pct: 80 }, { model: 'gemma3:1b', params_b: 1, pct: 70 },
                                               { model: 'judge-26b', pct: 100 }, { model: 'gemma4:e4b', params_b: 4, pct: 95 }] } } }
  const r = ladder('label', { tiers, box })
  assert.deepEqual(models(r), ['gemma3:1b', 'x2', 'judge-26b'])
  assert.deepEqual(r.at(-1), { model: 'judge-26b', params_b: 25.2, pct: 100, last: true })
  assert.deepEqual(r[1], { model: 'x2', params_b: 2, pct: 80, last: false }, 'params_b from tiers.models when the ranked row omits it')
})

// spec: cascade.mjs `ladder` ("small → large, the 26B last") · design §10
// class: J16 a list that grows without a bound (a model ranked twice) · E3 order (ties broken by a rule, never by insertion)
// technique: seeded bounded fuzz — 200 shuffles of one ranked list with ties on params_b and pct and a duplicate row
// method: build the ladder from each shuffle; assert one order every time, each model once, the last rung last
// sre: does the same bench give the same ladder on every boot, whatever order tiers.json lists its rows in?
test('the ladder is one order for any order of the bench rows: by size, then score, then name; each model once', () => {
  const box = { agent_minds: ['a', 'b', 'c', 'd', 'e', 'f'] }
  const ranked = [{ model: 'a', params_b: 1, pct: 50 }, { model: 'b', params_b: 1, pct: 90 }, { model: 'c', params_b: 1, pct: 90 },
                  { model: 'd', pct: 99 }, { model: 'e', params_b: 0.5 }, { model: 'b:latest', params_b: 1, pct: 90 },
                  { model: 'f', params_b: 1 }]
  let seed = 7
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 }
  for (let i = 0; i < 200; i++) {
    const shuffled = [...ranked].sort(() => rand() - 0.5)
    const r = models(ladder('label', { tiers: { classes: { label: { ranked: shuffled } } }, box }))
    assert.deepEqual(r, ['e', 'b', 'c', 'a', 'f', 'd', LAST_RUNG], `seed 7, shuffle ${i}: ${JSON.stringify(shuffled.map((x) => x.model))}`)
  }
  assert.equal(ladder('label', { tiers: { classes: { label: {} } }, box }).length, 1, 'a class row with no ranked list: the 26B alone')
})

// spec: cascade.mjs `threshold` (thresholds.json: a job × model row, else `default`, else 0.6) · design §9 (the gate is a number a person writes)
// class: J7 hostile or malformed policy values (a string, null, a boolean, NaN in thresholds.json) · J13 a field unset · the 90% gate
// technique: boundary over every lookup path: canonical name, raw `:latest` name, default, a non-number
// method: call threshold with policies that hold each shape; read the number it gives
// sre: if someone writes "high" or null into thresholds.json, does every small mind's guess get trusted, or does it fall back to 0.6?
test('a threshold is the job × model row, then the default, and anything not a number is 0.6', () => {
  const pol = { thresholds: { default: 0.7, jobs: { 'signal->label': { 'gemma3:1b': 0.8, 'odd:latest': 0.9, bad: 'high' } } } }
  assert.equal(threshold(pol, 'signal->label', 'gemma3:1b:latest'), 0.8)
  assert.equal(threshold(pol, 'signal->label', 'odd:latest'), 0.9, 'a row keyed by the raw name')
  assert.equal(threshold(pol, 'signal->label', 'other'), 0.7)
  assert.equal(threshold(pol, 'signal->label', 'bad'), 0.6)
  assert.equal(threshold({}, 'shell', undefined), 0.6)
  assert.equal(threshold({ thresholds: { default: Number.NaN } }, 'shell', 'x'), 0.6)
  // a null, blank or boolean default is no number: 0.6, never 0 (Number(null) is 0, and 0 would accept every guess)
  for (const v of [null, '', ' ', true, false, [], {}]) assert.equal(threshold({ thresholds: { default: v } }, 'shell', 'x'), 0.6, JSON.stringify(v))
  assert.equal(threshold({ thresholds: { default: ' 0.75 ' } }, 'shell', 'x'), 0.75, 'a number a person wrote as a string')
})

// spec: cascade/rules.json ("a traceback is never noise"; `answer` the kind a job must answer with) · design §9 (line sentry)
// class: J3 a regex on input (a pattern that does not compile is a miss, never a throw) · J13 a rule with fields unset
// technique: state-machine walk over each rule shape: no spec, wrong kind, a verb answer, a string pattern, an array with
//            one miss, flags, a bad pattern, a missing field, no `why`
// method: call brokenRule with each; read null or the sentence
// sre: if a person writes a broken regex into rules.json, does every label stop being checked, or does the foreman crash?
test('a hard rule breaks only when every pattern matches its field; a bad pattern or a missing field is a miss, never a throw', () => {
  const pol = { rules: { 'signal->label': { answer: 'label', rules: [
    { never: ['noise'], match: 'boom', flags: 'i' },
    { field: 'msg', never: ['noise'], match: ['^E', 'x$'], why: 'an E…x message is never noise' },
    { never: ['noise'], match: '(' },
    { match: 'anything' },
  ] }, 'command->verb': { answer: 'verb' }, 'output->route': {} } }
  const noise = { kind: 'label', label: 'noise' }
  assert.equal(brokenRule({}, 'signal->label', {}, noise), null)
  assert.equal(brokenRule(pol, 'shell', {}, noise), null)
  assert.equal(brokenRule(pol, 'signal->label', null, { kind: 'summary' }), 'the job answers with a label, not a summary')
  assert.equal(brokenRule(pol, 'command->verb', {}, { kind: 'verb' }), null)
  assert.equal(brokenRule(pol, 'output->route', {}, noise), null, 'a spec with no rules list')
  assert.equal(brokenRule(pol, 'signal->label', { line: 'BOOM at 3' }, noise), 'a hard rule (said noise)')
  assert.equal(brokenRule(pol, 'signal->label', { msg: 'Ex' }, noise), 'an E…x message is never noise (said noise)')
  assert.equal(brokenRule(pol, 'signal->label', { msg: 'E only' }, noise), null, 'one pattern of two misses: no break')
  assert.equal(brokenRule(pol, 'signal->label', { line: '(' }, noise), null, 'the bad pattern is a miss')
  assert.equal(brokenRule(pol, 'signal->label', null, noise), null)
  assert.equal(brokenRule(pol, 'signal->label', { line: 'boom' }, { kind: 'label', label: 'real-error' }), null)
})

// spec: cascade.mjs `judge` ("the last rung's certainty is recorded, never gating"; unknown certainty climbs) · thresholds.json `unknown`
// class: J7 NaN/Infinity certainty · the 90% gate invariant (a guess is never trusted)
// technique: state-machine walk: unreadable · broken rule · last rung · unknown with climb · unknown with accept · under · at
// method: judge one answer through each state; read ok and why
// sre: is a small mind's answer with no certainty ever accepted unless a person wrote `unknown: accept`?
test('judge: unreadable climbs, a broken rule climbs, the last rung holds, unknown climbs unless the policy accepts, under the threshold climbs', () => {
  const pol = { thresholds: { default: 0.6, unknown: 'climb' }, rules: { 'signal->label': { rules: [{ never: ['noise'], match: 'Traceback' }] } } }
  const small = { model: 'g', last: false }
  const j = (text, certainty, o = {}) => judge({ text, certainty, rung: small, job: JOB, jobClass: 'signal->label', slice: { line: 'ok' }, pol, ...o })
  assert.match(j('noise', 1).why, /outside the grammar/)
  assert.equal(j("(label 'noise)", 1, { slice: { line: 'Traceback x' } }).why, 'a hard rule (said noise)')
  assert.equal(j("(label 'noise)", null, { rung: { model: LAST_RUNG, last: true } }).ok, true)
  assert.equal(j("(label 'noise)", null).why, 'its certainty is unknown')
  assert.equal(j("(label 'noise)", Number.POSITIVE_INFINITY).why, 'its certainty is unknown')
  assert.equal(j("(label 'noise)", undefined, { pol: { thresholds: { unknown: 'accept' } } }).ok, true)
  assert.equal(j("(label 'noise)", 0.59).why, 'certainty 0.59 under 0.6')
  assert.equal(j("(label 'noise)", 0.6).ok, true, 'at the threshold holds')
  assert.equal(judge({ text: "(label 'noise)", certainty: null, rung: small, job: JOB, jobClass: 'x', slice: {}, pol: {} }).why, 'its certainty is unknown')
})

// spec: cascade.mjs header ("the policy files, re-read when they change") · engineering §6 files (cascade/*.json)
// class: B4 a parse cache (a file read once per change, never per call)
// technique: repeated read — the same mtime returns the same parsed document object
// method: call policy() twice; assert the documents are the very same objects and carry the committed default 0.6
// sre: does the foreman re-parse two JSON files on every mind question (event-loop time on the box), or only when they change?
test('the policy files are parsed once per change: two reads give the same objects, the committed default and the traceback rule', () => {
  const a = policy()
  const b = policy()
  assert.equal(a.thresholds, b.thresholds)
  assert.equal(a.rules, b.rules)
  assert.equal(a.thresholds.default, 0.6)
  assert.equal(a.thresholds.unknown, 'climb')
  assert.equal(brokenRule(a, 'signal->label', { line: 'Traceback (most recent call last):' }, { kind: 'label', label: 'noise' }), 'a traceback is never noise (said noise)')
})

