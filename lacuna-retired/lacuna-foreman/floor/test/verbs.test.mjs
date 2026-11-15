// verbs.test.mjs — TESTS OF THE TWELVE FLOOR SCHEME VERBS (lacuna-foreman/floor/verbs.js) (lane CL-UX Part A / F5-H; A8-SCENE-SCHEME §3–§5).
// Owns: verifying `floor-scene`, `floor-emit`, `floor-tick`, `floor-wait`, `floor-actor`, `floor-expect`, `floor-snapshot`,
// `floor-probe`, `floor-place`, `floor-camera`, `floor-say`, and `floor-replay` through the Lacuna Scheme interpreter
// (`parse → expandProgram → evaluate`), including every refusal in A8 §3, ledger row recording, law 7 secret refusal on
// `floor-say`, non-throwing verdict recording on `floor-expect`, and playing `stall.slat` through the verbs.
// Refuses: a real or literal token in the source (fake keys are joined from parts per law 7); touching the live day file.
// Implements: docs/eng/floor-5.0/A8-SCENE-SCHEME.md §3; docs/lanes/1.0/tasks/CL-UX-floor-desk-ide-chat.md Part A.
// Invariants (design §18): "a claim is not a record"; "nothing prints a token". Faults (§16): none.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse, sym } from '../../../../lacuna-scheme/src/reader.js'
import { evaluate } from '../../../../lacuna-scheme/src/interp.js'
import { makeBaseEnv } from '../../../../lacuna-scheme/src/base/core.js'
import { expandProgram } from '../../../../lacuna-scheme/src/macro.js'
import { hasVerb } from '../../../../lacuna-scheme/src/registry.js'
import { installFloorVerbs, createFloorHost, FLOOR_VERBS_META, LIMITS } from '../verbs.js'
import { SCENE_AT } from '../scene.js'

const EPOCH = Date.UTC(2026, 10, 1, 12, 0, 0)

function boot(opts = {}) {
  const fuel = { n: 500_000 }
  const env = makeBaseEnv(fuel)
  const host = opts.host ?? createFloorHost({ epoch: EPOCH, ...opts })
  // Provide a convenient `get` helper in the test env matching foreman's alist lookup.
  env.define('get', (alist, key, dflt = false) => {
    const k = key && typeof key === 'object' && 'name' in key ? key.name : String(key)
    if (Array.isArray(alist)) {
      for (const pair of alist) {
        if (Array.isArray(pair) && pair.length >= 2) {
          const pk = pair[0] && typeof pair[0] === 'object' && 'name' in pair[0] ? pair[0].name : String(pair[0])
          if (pk === k) return pair[1]
        }
      }
    }
    return dflt
  })
  installFloorVerbs(env, { host, cart: opts.cart ?? 'floor-truth', runId: opts.runId ?? 'w-test1', fuel })
  const run = (src) => {
    let r
    for (const f of expandProgram(parse(src), {}).forms) r = evaluate(f, env, fuel)
    return r
  }
  return { env, host, run }
}

test('all twelve floor-* verbs register with watch tier metadata', () => {
  const { env } = boot()
  const names = [
    'floor-scene', 'floor-emit', 'floor-tick', 'floor-wait',
    'floor-actor', 'floor-expect', 'floor-snapshot', 'floor-probe',
    'floor-place', 'floor-camera', 'floor-say', 'floor-replay',
  ]
  assert.equal(FLOOR_VERBS_META.length, 12)
  for (const n of names) {
    assert.equal(env.vars.has(n), true, n)
    assert.equal(hasVerb(n), true, n)
  }
  assert.equal(LIMITS.floors, 8)
  assert.equal(LIMITS.sceneEvents, 4000)
})

test('floor-scene opens, reports status, refuses a second open or bad name, and closes with a sha256 hash on the ledger', () => {
  const { host, run } = boot()
  assert.equal(run("(floor-scene 'status)"), false)
  assert.throws(() => run('(floor-scene \'open "Bad Name")'), /not a scene name/)
  const opened = run('(floor-scene \'open "custom-eval")')
  assert.equal(run(`(get '(("a" 1)) 'a)`), 1)
  assert.ok(Array.isArray(opened))
  assert.equal(host.openFloors.size, 1)
  assert.throws(() => run('(floor-scene \'open "second")'), /already open/)

  const st = run("(floor-scene 'status)")
  assert.ok(Array.isArray(st))
  const closed = run("(floor-scene 'close)")
  assert.ok(Array.isArray(closed))
  assert.equal(host.openFloors.size, 0)
  assert.equal(host.ledger.length, 2)
  assert.equal(host.ledger[0].action, 'open')
  assert.equal(host.ledger[1].action, 'close')
  assert.match(host.ledger[1].hash, /^sha256:[0-9a-f]{64}$/)
})

test('floor-scene enforces LIMITS.floors (at most 8 open floors in one host)', () => {
  const host = createFloorHost({ epoch: EPOCH })
  for (let i = 0; i < 8; i++) {
    const b = boot({ host, cart: `cart-${i}` })
    b.run(`(floor-scene 'open "scene-${i}")`)
  }
  const ninth = boot({ host, cart: 'cart-9' })
  assert.throws(() => ninth.run('(floor-scene \'open "scene-9")'), /more than 8 floors are open/)
})

test('floor-emit, floor-tick, floor-wait and floor-actor fold events and refuse past or invalid events', () => {
  const { run } = boot()
  assert.throws(() => run('(floor-tick 1000)'), /no floor is open/)
  run('(floor-scene \'open "unit-work")')
  run('(floor-emit \'run.filed "w-1" \'((cart "backup") (by "foreman")) 1000)')
  run('(floor-emit \'run.start "w-1" \'((brain "e4b")) 2000)')

  // Before ticking to 1000 ms, w-1 is not yet in the registry.
  assert.equal(run('(floor-actor "w-1")'), false)

  // floor-wait steps until w-1 finishes its 1000 ms flight after run.start (2000 ms) and lands in working (3000 ms).
  const waited = run(`
    (floor-wait
      (lambda ()
        (let ((a (floor-actor "w-1")))
          (and a (eq? (get a 'state) 'working))))
      3500
      250)
  `)
  assert.equal(waited, 3000)

  // Emitting before current logT (2000 ms) is refused.
  assert.throws(() => run('(floor-emit \'run.step "w-1" \'((n 1) (op "hand") (tool "disk")) 1000)'), /the past is folded/)
  // Emitting scene.begin or an unknown kind is refused.
  assert.throws(() => run('(floor-emit \'scene.begin "lacuna" \'((name "x")))'), /written only by floor-scene/)
  assert.throws(() => run('(floor-emit \'not.a.kind "w-1" \'())'), /unknown event kind/)

  // floor-wait returns #f (never throws) when the deadline expires before the predicate holds.
  assert.equal(run('(floor-wait (lambda () #f) 500 250)'), false)
  run("(floor-scene 'close)")
})

test('floor-expect records passes and non-throwing fail verdicts with why on the ledger', () => {
  const { host, run } = boot()
  run('(floor-scene \'open "expect-check")')
  run('(floor-emit \'run.filed "w-1" \'((cart "backup") (by "foreman")) 0)')
  run('(floor-emit \'run.start "w-1" \'((brain "e4b")) 500)')
  run('(floor-tick 1500)')

  const pass1 = run('(floor-expect "w-1 working" "w-1" \'((state working)))')
  assert.equal(pass1, true)

  // A failing expectation returns #f and writes a floor-expect row on the ledger — never throws.
  const fail1 = run('(floor-expect "w-1 should be stalled" "w-1" \'((state stalled)))')
  assert.equal(fail1, false)
  const failRow = host.ledger.find((r) => r.kind === 'floor-expect')
  assert.ok(failRow)
  assert.equal(failRow.actor, 'w-1')
  assert.equal(failRow.action, 'fail')
  assert.match(failRow.want, /stalled/)
  assert.match(failRow.got, /working/)

  // Boolean form of floor-expect:
  assert.equal(run('(floor-expect "math holds" #t "1 equals 1")'), true)
  assert.equal(run('(floor-expect "disk check" #f "disk dropped below 8 GB")'), false)
  assert.throws(() => run('(floor-expect "bad-bool" #f "")'), /requires a non-empty why/)
  assert.throws(() => run('(floor-expect "bad-field" "w-1" \'((hue 120)))'), /not `hue`/)
  run("(floor-scene 'close)")
})

test('floor-snapshot, floor-probe, floor-place, floor-camera, and floor-say enforce bounds and law 7', () => {
  let probed = null
  const { run } = boot({
    probe: (floorId, actorId) => {
      probed = { floorId, actorId }
      return { ok: true, state: [0.2, 0.8, 1.0, 0], rect: [120, 80, 64, 64], agree: true }
    },
  })
  run('(floor-scene \'open "stage-ops")')
  const snap = run('(floor-snapshot)')
  assert.match(snap, /^\(state \(v 1\)/)
  assert.match(snap, /\(hash "sha256:[0-9a-f]{64}"\)\)$/)

  const pr = run('(floor-probe "lacuna")')
  assert.equal(probed.actorId, 'lacuna')
  assert.equal(run("(get (floor-probe \"lacuna\") 'ok)"), true)

  assert.equal(run('(floor-place "lacuna" \'slot 4 500)'), true)
  assert.equal(run('(floor-place "lacuna" \'to \'(10 0 -12) 500)'), true)
  assert.throws(() => run('(floor-place "lacuna" \'slot 99)'), /slot 99 does not exist/)

  assert.equal(run('(floor-camera \'home 1000 50)'), true)
  assert.throws(() => run('(floor-camera \'home 1000 120)'), /outside 20 to 90/)

  assert.equal(run('(floor-say "the E4B slot is clear")'), true)
  const fakeKey = 'sk-' + 'ABCDEFGHijklmnop1234567890QRSTuv'
  assert.throws(() => run(`(floor-say "leaked ${fakeKey}")`), /a line never holds a secret/)
  run("(floor-scene 'close)")
})

test('floor-replay folds a recorded window and refuses cut or drill-contaminated windows', () => {
  const { env, run } = boot()
  const validReply = [
    [sym('ok'), true],
    [sym('cut'), false],
    [sym('day'), '2026-10-31'],
    [sym('events'), [
      { seq: 1, t: EPOCH + 1000, kind: 'run.filed', actor: 'w-9', at: SCENE_AT, ref: 'w-9', src: ['foreman-bus', 1], data: { cart: 'backup', by: 'foreman' } },
      { seq: 2, t: EPOCH + 2000, kind: 'run.start', actor: 'w-9', at: SCENE_AT, ref: 'w-9', src: ['foreman-bus', 2], data: { brain: 'e4b' } },
      { seq: 3, t: EPOCH + 3000, kind: 'foreman.beat', actor: 'foreman', at: '-', ref: null, src: ['foreman-health', 1], data: { living: 1, total: 1 } },
    ]],
  ]
  env.define('sample-reply', validReply)
  const res = run('(floor-replay sample-reply)')
  assert.equal(run("(get (floor-actor \"w-9\") 'state)").name, 'working')
  assert.ok(Array.isArray(res))

  const cutReply = [[sym('ok'), true], [sym('cut'), true], [sym('events'), []]]
  env.define('cut-reply', cutReply)
  assert.throws(() => run('(floor-replay cut-reply)'), /more than 2000 events/)

  const drillReply = [
    [sym('ok'), true],
    [sym('cut'), false],
    [sym('events'), [
      { seq: 1, t: EPOCH + 1000, kind: 'scene.begin', actor: 'lacuna', at: '-', ref: null, src: ['scene:stall', 1], data: { name: 'stall' } },
    ]],
  ]
  env.define('drill-reply', drillReply)
  assert.throws(() => run('(floor-replay drill-reply)'), /refuses drill or scene event/)
})

test('playing the stall drill through floor-scene and floor-tick evaluates every expectation and scores lose unheld', () => {
  const { host, run } = boot()
  run('(floor-scene \'open "stall")')
  run('(floor-tick 75000)')
  const closed = run("(floor-scene 'close)")
  assert.ok(Array.isArray(closed))
  const closeLedger = host.ledger.find((r) => r.kind === 'floor-scene' && r.action === 'close')
  assert.equal(closeLedger.fails, 0)
  assert.ok(closeLedger.passes >= 10, `expected >= 10 passes, got ${closeLedger.passes}`)
  assert.equal(closeLedger.score, 'lose')
})
