// scene.test.mjs — THE SCENE (lane F5-H, units H.2 and H.3; A8 §2, §5.1, §8.4). Owns: the reader's refusals (the name, the
// version, `by`, `secs`, a stranger actor, an event out of time, a predicate outside the grammar, an expectation with no why, a
// parameter with no param); the stall drill as the L1 test of day one in both branches (unheld: every expectation holds and the
// score is a loss; held at 30 s: every expectation holds and the score is a win); the player's stamp and order; determinism (the same
// scene twice gives the same `(state …)`). Refuses: a mock of the fold (the fold is what the drill proves).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readScene, play, readPred, evalPred } from '../scene.js'
import { refused } from '../fold.js'
import { validateEvent } from '../validate.js'

const STALL = readFileSync(new URL('../drills/stall.slat', import.meta.url), 'utf8')
const EPOCH = Date.UTC(2026, 10, 1, 12, 0, 0)
const mini = (body, head = '(name "mini") (v 1) (by cart) (secs 10)') => `(scene ${head} (actors "lacuna" "w-1") ${body})`

// spec: A8 §2.1's refusal column · class: W (the reader holds the grammar) · technique: one bad field a case · sre: can a file a
// cart wrote smuggle logic, a stranger or a row past its end onto a floor?
test('the reader refuses what A8 §2.1 refuses, each with its sentence', () => {
  const why = (text) => readScene(text).why
  assert.match(why(mini('', '(name "Bad Name") (v 1) (by cart) (secs 10)')), /not a scene name/)
  assert.match(why(mini('', '(name "mini") (v 2) (by cart) (secs 10)')), /only v 1/)
  assert.match(why(mini('', '(name "mini") (v 1) (by someone) (secs 10)')), /drill, cart or replay/)
  assert.match(why(mini('', '(name "mini") (v 1) (by cart) (secs 900)')), /1 to 600/)
  assert.match(why(mini('(ev (at 1000) (kind run.start) (actor "w-2") (ref "w-2"))')), /not in \(actors/)
  assert.match(why(mini('(ev (at 2000) (kind run.start) (actor "w-1")) (ev (at 1000) (kind run.pass) (actor "w-1"))')), /comes before the event above it/)
  assert.match(why(mini('(ev (at 1000) (when (> 1 2)) (kind run.start) (actor "w-1"))')), /not in the scene grammar; author the branch from a cart/)
  assert.match(why(mini('(expect (at 1000) (actor "w-1") (state working))')), /names its why/)
  assert.match(why(mini('(ev (at 20000) (kind run.start) (actor "w-1"))')), /past the scene's 10 s/)
  assert.match(why('(scene (name "mini") (v 1) (by cart) (secs 10) (actors "$who"))'), /no param for \$who/)
})

// spec: A8 §2.4 · class: L (logic) · technique: truth table · sre: does a branch read the press and the registry, and nothing else?
test('the predicates read the scene\'s presses before the row and the registry now', () => {
  const p = (form) => readPred(form).pred
  const ctx = { presses: new Map([['w-1', 5000]]), atMs: 6000, f: null, params: { loud: true } }
  const sym = (name) => ({ name })
  assert.equal(evalPred(p([sym('pressed'), 'w-1']), ctx), true)
  assert.equal(evalPred(p([sym('pressed'), 'w-1']), { ...ctx, atMs: 4000 }), false)
  assert.equal(evalPred(p([sym('and'), [sym('pressed'), 'w-1'], [sym('not'), [sym('param'), sym('quiet')]]]), ctx), true)
  assert.equal(evalPred(p([sym('or'), [sym('state'), 'w-1', sym('working')], [sym('param'), sym('loud')]]), ctx), true)
})

// spec: A8 §2.5, §8.4 (the three drills as L1 tests on day one) · class: D (data truth) · technique: the drill played through the
// real fold in its two branches · sre: does the floor show the owner the stall, the crash and the win as the records make them?
test('the stall drill unheld: every expectation holds, nothing is refused, and the score is a loss', () => {
  const r = readScene(STALL)
  assert.equal(r.ok, true, r.why)
  const out = play(r.scene, { epoch: EPOCH, by: 'owner' })
  assert.deepEqual(refused(out.f), [])
  const bad = out.verdicts.filter((v) => !v.ok)
  assert.deepEqual(bad.map((v) => `${v.at} ${v.actor} want ${JSON.stringify(v.want)} got ${JSON.stringify(v.got)}`), [])
  assert.ok(out.verdicts.length >= 10, `${out.verdicts.length} verdicts`)
  assert.equal(out.score.result, 'lose')
})

test('the stall drill held at 30 s: every expectation holds and the score is a win, its press time kept', () => {
  const r = readScene(STALL)
  const out = play(r.scene, { epoch: EPOCH, by: 'owner', presses: [{ actor: 'w-d20002', atMs: 30000 }] })
  assert.deepEqual(out.verdicts.filter((v) => !v.ok).map((v) => `${v.at} ${v.actor}`), [])
  assert.deepEqual(out.score, { result: 'win', pressedAtMs: 30000, parMs: 30000 })
  const stop = out.events.find((e) => e.kind === 'run.stop')
  assert.equal(stop.t - EPOCH, 31000, 'the held branch\'s row fires at the press plus its after-ms')
})

// spec: A8 §4.2 step 4 (the door validates every row of a drill before it plays) · class: W · technique: every row of both branches
// through the one validator · sre: could a drill put a row on the floor the catalog would refuse from a producer?
test('every row the stall drill plays, in both branches, is an event the catalog accepts', () => {
  const r = readScene(STALL)
  for (const presses of [[], [{ actor: 'w-d20002', atMs: 30000 }]]) {
    const out = play(r.scene, { epoch: EPOCH, by: 'owner', presses })
    const bad = out.events.map((e) => [e, validateEvent(e)]).filter(([, v]) => !v.ok).map(([e, v]) => `${e.kind} ${e.actor}: ${v.why}`)
    assert.deepEqual(bad, [], presses.length ? 'held' : 'unheld')
  }
})

// spec: A8 §2.2 (the stamp is the player's, never the author's) and §5.1 (the determinism hash) · class: D · technique: two
// plays compared · sre: is a drill's every row marked as the drill's, and is a scene folded the same way twice?
test('the player stamps every row with its source, in seq order, and folds the same scene to the same state twice', () => {
  const r = readScene(STALL)
  const a = play(r.scene, { epoch: EPOCH, by: 'owner' })
  const b = play(r.scene, { epoch: EPOCH, by: 'owner' })
  assert.ok(a.events.every((e) => e.src[0] === 'scene:stall'))   // A2's scene producer, `scene:<name>`
  assert.deepEqual(a.events.map((e) => e.seq), a.events.map((_, i) => a.events[0].seq + i))
  assert.equal(a.state, b.state)
})

// spec: A8 §2.6, §8.4 (the night and the disk drills as L1 tests on day one) · class: D (data truth) · technique: each drill
// played through the real fold in each branch, every row validated by the catalog · sre: does each drill show the owner what its
// records make, and only rows a producer could have written?
for (const [name, culprit, held] of [['night', null, null], ['disk', 'w-d10001', 20000], ['stall', 'w-d20002', 30000]]) {
  test(`the ${name} drill holds every expectation${culprit ? ' unheld and held' : ''}, and every row it plays is the catalog's`, () => {
    const r = readScene(readFileSync(new URL(`../drills/${name}.slat`, import.meta.url), 'utf8'))
    assert.equal(r.ok, true, r.why)
    for (const presses of culprit ? [[], [{ actor: culprit, atMs: held }]] : [[]]) {
      const out = play(r.scene, { epoch: EPOCH, by: 'owner', presses })
      assert.deepEqual(refused(out.f), [], `${name}: the fold refused a row`)
      assert.deepEqual(out.verdicts.filter((v) => !v.ok).map((v) => `${v.at} ${v.actor} want ${JSON.stringify(v.want)} got ${JSON.stringify(v.got)}`), [])
      assert.deepEqual(out.events.map((e) => [e, validateEvent(e)]).filter(([, v]) => !v.ok).map(([e, v]) => `${e.kind}: ${v.why}`), [])
      if (r.scene.score) assert.equal(out.score.result, presses.length ? 'win' : 'lose')
    }
  })
}
