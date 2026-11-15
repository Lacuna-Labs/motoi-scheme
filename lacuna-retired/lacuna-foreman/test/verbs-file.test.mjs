// verbs-file.test.mjs — U1 unit tests for `verbs.mjs`'s (file …) verb: a cart files a run under a key, once.
// owns: the proofs that a run is filed once per key, that a filer holds at most `filedEach` (8) living runs, that the
//   filing form is read in every shape a cart writes, and that the filing goes upstream with its trigger and evidence.
// refuses: to mock verbs.mjs or intents.mjs; every test runs a real filer cart on a real Supervisor and a fake clock.
// implements: design §7.2 (file), §10 (≤ 8 run foremen; filedEach), §8 (lifecycle: file → contract filed), law 2 (a run
//   is its own unit of work: filed BY the cart, never its child); eng §3.5 filedEach 8.
// invariants: "If a run foreman died, then its children are buried" (the converse held here: a filed run is no child,
//   so a filer's crash never reaches it).
// faults: F-02 (a filing without a key is refused with a sentence).
// coverage: verbs.mjs — see verbs.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSup } from '../../../test/conformance/fake-host.mjs'
import { LIMITS } from '../supervisor.mjs'

const ups = (h, kind) => h.up.filter((u) => u.kind === kind)
const FILER = (body) => `(lacuna-cart 'filer '((does . "files runs") (done . "filed") (agent . ((tier . watch) (verbs . (on file remember))))))
${body}`

// spec: design §7.2 (file under a key, filed once) · §8 lifecycle · law 2 · eng §3.3 (runs {key, goal, hands, acts, tier})
// class: E10 a duplicate message (the same key filed twice)
// technique: state walk over every field of the filing form, in the shapes a cart writes ((k v), (k . v), (k a b))
// method: a filer files one run with every field; read the run (key, cart, goal, done-check, hands, acts, tier, intensity,
//         repo, touches, press, parent null, by the filer) and the `filed` row (trigger, evidence); file the same key
//         again and read the same id back with one run in the table
// sre: if a trigger fires twice for the same morning, does it start two runs? It must hand back the one already open.
test('a filing reads every field of the form; the same key filed again answers the open run', () => {
  const { h, s } = makeSup()
  const f = s.spawn({ name: 'filer', program: FILER(`(on 'go (lambda (x) (remember 'id (file '((key "ipad-verify@07:00") (cart ipad-verify) (goal "verify the iPad")
    (done-check "(ok)") (hands jobs disk) (acts (checkout pass)) (intensity . high) (repo curator) (touches "lacuna-foreman/**")
    (press standing) (trigger "07:00") (evidence ((n 3))))))))`) })
  s.send(f.id, 'go', 1)
  const run = s.workers.get(f.kv.id)
  assert.deepEqual([run.run.key, run.run.cart, run.contract.goal, run.contract.done_check], ['ipad-verify@07:00', 'ipad-verify', 'verify the iPad', '(ok)'])
  assert.deepEqual([[...run.run.hands].sort(), [...run.run.acts].sort(), run.tier, run.run.intensity], [['disk', 'jobs'], ['checkout', 'pass'], 'act', 'high'])
  assert.deepEqual([run.run.repo, run.run.touches, run.run.press, run.parent, run.by], ['curator', ['lacuna-foreman/**'], 'standing', null, f.id])
  const filed = ups(h, 'filed')[0].data
  assert.deepEqual([filed.run, filed.key, filed.cart, filed.trigger, filed.evidence], [run.id, 'ipad-verify@07:00', 'ipad-verify', '07:00', [['n', 3]]])
  s.send(f.id, 'go', 1)
  assert.equal(f.kv.id, run.id)
  assert.equal(ups(h, 'filed').length, 1)
})

// spec: design §7.2 · law 2 · F-02
// class: J7 JSON.parse on hostile input (a filing form in a shape the reader did not promise)
// technique: state walk over degenerate forms: no key, a blank key, not a list, rows that are not lists, a bare cart
// method: each form is filed; the keyless ones crash the handler with the sentence; the minimal one (key only) files a
//         watch run whose goal is the key, cart null, no hands of its own beyond the desk's reads, no acts, no press
// sre: if a cart writes a sloppy filing, does it get a clear refusal or a sane minimal run — never a run with no key?
test('a filing with no key is refused with a sentence; a key alone files a minimal watch run', () => {
  const { h, s } = makeSup()
  const f = s.spawn({ name: 'filer', program: FILER(`
    (on 'none (lambda (x) (file '((cart x)))))
    (on 'blank (lambda (x) (file '((key "  ")))))
    (on 'atom (lambda (x) (file 5)))
    (on 'min (lambda (x) (remember 'id (file '(() 7 (key "k-min") (touches . "one/**"))))))`) })
  for (const k of ['none', 'blank', 'atom']) {
    s.send(f.id, k, 1); h.tick(LIMITS.crashWindow)                      // each refusal is a crash; keep them out of one window
    assert.match(ups(h, 'crashed').at(-1).data.why, /filer files a run under a key: \(file '\(\(key "…"\) …\)\)$/)
  }
  s.send(f.id, 'min', 1)
  const run = s.workers.get(f.kv.id)
  assert.deepEqual([run.tier, run.contract.goal, run.run.cart, run.run.acts.size, run.run.press, run.run.intensity, run.run.repo, run.run.touches],
    ['watch', 'k-min', null, 0, null, 'normal', null, ['one/**']])
  assert.equal(ups(h, 'filed').at(-1).data.trigger, null)
})

// spec: design §10 (≤ 8 run foremen) · eng §3.5 filedEach 8 · law 2
// class: B7 workers 65, depth 4, children 9, filedEach 9
// technique: boundary: the 8th, the 9th, and the 9th again after one run ends
// method: a filer files 8 runs under 8 keys (8 ids); the 9th answers #f with the thought naming the ceiling; one run is
//         stopped; the 9th files; a run filed by another filer does not count against this one
// sre: if a cart's bookkeeping slips and it files every tick, does the disk fill with 44 checkouts? It stops at 8.
test('a filer holds at most 8 living runs: the 9th answers #f until one ends', () => {
  const { s } = makeSup()
  const f = s.spawn({ name: 'filer', program: FILER(`(on 'go (lambda (k) (remember 'last (file (list (list 'key k))))))`) })
  const other = s.spawn({ name: 'other', program: FILER(`(on 'go (lambda (k) (file (list (list 'key k)))))`) })
  s.send(other.id, 'go', 'theirs')
  const ids = []
  for (let i = 1; i <= LIMITS.filedEach; i++) { s.send(f.id, 'go', `k-${i}`); ids.push(f.kv.last) }
  assert.equal(new Set(ids).size, 8)
  s.send(f.id, 'go', 'k-9')
  assert.equal(f.kv.last, false)
  assert.ok(f.thoughts.some((t) => /file k-9: 8 runs of mine are living already \(the ceiling is 8\); not filed/.test(t.text)))
  s.stop(ids[0], 'done: one ended')
  s.send(f.id, 'go', 'k-9')
  assert.equal(typeof f.kv.last, 'string')
})

// spec: law 2 (a run is its own unit of work) · design §6 change 5 · invariant "if a run foreman died, its children are buried"
// class: E11 an orphan (the filer dies; the run it filed must not)
// technique: fault injection: the filer crashes three times (the grave), then is stopped
// method: a filer files a run, then its handler throws three times in the window; read the filer (grave) and the run
//         (running, parent null, not in the filer's children)
// sre: if the cart that files runs crash-loops, do its eight runs die with it (2026-10-24)? They must run on.
test('a filed run is not the filer\'s child: the filer\'s grave never reaches it', () => {
  const { s } = makeSup()
  const f = s.spawn({ name: 'filer', program: FILER(`(on 'go (lambda (x) (remember 'id (file '((key "r-own")))))) (on 'boom (lambda (x) (car '())))`) })
  s.send(f.id, 'go', 1)
  for (let i = 0; i < 3; i++) s.send(f.id, 'boom', 1)
  assert.equal(f.state, 'grave')
  const run = s.workers.get(f.kv.id)
  assert.deepEqual([run.state, run.parent, f.children.includes(run.id)], ['running', null, false])
})

test.todo('verbs.mjs:114–118 (file …) takes `acts` and `press standing` from the filing form, not from the filer\'s own header: a watch cart holding `file` files an act-tier run with a standing press (design §3 law 5: the owner\'s press is the only path to an act; T7) — asked of the lead in MAIL; test once the clause says which is intended')
