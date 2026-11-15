// carts.test.mjs — TESTS OF THE FIVE FLOOR TRUTH & SCENE CARTS (lane F5-H, unit H.5; A8-SCENE-SCHEME §6–§7; CL-UX2 #6).
// Owns: verifying that `floor-truth.sks`, `floor-drill.sks`, `floor-scene-check.sks`, `floor-assay.sks`, and `floor-game.sks`
// carry the five 3.0 header fields (`version`, `restart`, `deadlines`, `contract`, `sentry`), parse cleanly under Lacuna Scheme,
// and execute their `(start)` and `(on 'hand / 'act ...)` handlers against real eval floors (`installFloorVerbs`).
// Refuses: touching the live day file; mocking the fold. Invariants (§18): "a claim is not a record". Faults (§16): none.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse, Pair } from '../../../../lacuna-scheme/src/reader.js'
import { evaluate, apply } from '../../../../lacuna-scheme/src/interp.js'
import { makeBaseEnv } from '../../../../lacuna-scheme/src/base/core.js'
import { expandProgram } from '../../../../lacuna-scheme/src/macro.js'
import { FIELDS_3, headerFields } from '../../inventory.mjs'
import { createFloorHost, installFloorVerbs } from '../verbs.js'

const CARTS_DIR = new URL('../carts/', import.meta.url)
const CART_NAMES = ['floor-truth', 'floor-drill', 'floor-scene-check', 'floor-assay', 'floor-game']
const EPOCH = Date.UTC(2026, 10, 1, 12, 0, 0)

function readCartSource(name) {
  return readFileSync(new URL(`${name}.sks`, CARTS_DIR), 'utf8')
}

function bootCart(name, opts = {}) {
  const fuel = { n: 500_000 }
  const env = makeBaseEnv(fuel)
  const host = opts.host ?? createFloorHost({ epoch: EPOCH, ...opts })
  const handlers = new Map()
  const handCalls = []
  const actCalls = []
  const reports = []
  const kv = new Map()
  let doneSaid = null

  const atom = (x) => (x && typeof x === 'object' && 'name' in x ? x.name : String(x))
  const pairToArray = (p) => {
    const out = []
    let cur = p
    while (cur instanceof Pair) {
      out.push(cur.car)
      cur = cur.cdr
    }
    return out
  }

  env.define('lacuna-cart', () => true)
  env.define('on', (kind, fn) => { handlers.set(atom(kind), fn); return true })
  env.define('hand', (op, ...args) => { handCalls.push({ op: atom(op), args }); return true })
  env.define('act', (op, ...args) => { actCalls.push({ op: atom(op), args }); return true })
  env.define('report', (kind, data) => { reports.push({ kind: atom(kind), data }); return true })
  env.define('remember', (k, v) => { kv.set(atom(k), v); return v })
  env.define('recall', (k, dflt = false) => (kv.has(atom(k)) ? kv.get(atom(k)) : dflt))
  env.define('after', () => true)
  env.define('done', (msg) => { doneSaid = String(msg ?? ''); return doneSaid })
  env.define('get', (alist, key, dflt = false) => {
    const k = atom(key)
    if (alist && typeof alist === 'object' && !Array.isArray(alist) && !(alist instanceof Pair)) {
      return k in alist ? alist[k] : dflt
    }
    const arr = alist instanceof Pair ? pairToArray(alist) : Array.isArray(alist) ? alist : []
    for (const item of arr) {
      if (item instanceof Pair && atom(item.car) === k) {
        return item.cdr instanceof Pair && item.cdr.cdr === null ? item.cdr.car : item.cdr
      }
      if (Array.isArray(item) && item.length >= 2 && atom(item[0]) === k) return item[1]
    }
    return dflt
  })

  installFloorVerbs(env, { host, cart: name, runId: `w-${name}`, fuel })
  const src = readCartSource(name)
  for (const f of expandProgram(parse(src), {}).forms) evaluate(f, env, fuel)

  const start = () => evaluate(parse('(start)')[0], env, fuel)
  const send = (kind, payload) => {
    const fn = handlers.get(kind)
    if (!fn) throw new Error(`no handler for ${kind}`)
    return apply(fn, [payload], fuel)
  }

  return { env, host, start, send, handCalls, actCalls, reports, kv, getDone: () => doneSaid }
}

test('all five floor .sks carts carry the five 3.0 header fields and valid contracts', () => {
  for (const name of CART_NAMES) {
    const src = readCartSource(name)
    const fields = headerFields(src)
    for (const k of FIELDS_3) assert.ok(k in fields, `${name}.sks has ${k}`)
    assert.equal(fields.version, 1)
    assert.ok(fields.contract?.goal && fields.contract?.['done-check'], `${name}.sks has contract goal and done-check`)
    assert.ok(fields.exam, `${name}.sks names an exam`)
  }
})

test('floor-truth.sks opens the day eval floor, checks invariants, and records a verdict row on an unrecorded red', () => {
  const c = bootCart('floor-truth')
  c.start()
  assert.equal(c.handCalls[0].op, 'floor-fold')
  c.send('hand', {
    ok: true,
    result: {
      transients: 0,
      'unrecorded-reds': 1,
      'non-foreman-greens': 0,
      quarantine: 4,
      'live-scenes': 0,
      deterministic: true,
    },
  })
  assert.equal(c.getDone(), '5 passed, 1 failed')
  const closeRow = c.host.ledger.find((r) => r.kind === 'floor-scene' && r.action === 'close')
  assert.equal(closeRow.passes, 5)
  assert.equal(closeRow.fails, 1)
  const failExpect = c.host.ledger.find((r) => r.kind === 'floor-expect' && r.check === 'red-record')
  assert.ok(failExpect)
  assert.equal(c.reports.some((r) => r.kind === 'alert'), true)
})

test('floor-drill.sks requests the floor-drill act and records the score or refusal', () => {
  const c = bootCart('floor-drill')
  c.start()
  assert.equal(c.actCalls.length, 1)
  assert.equal(c.actCalls[0].op, 'floor-drill')
  c.send('act', { ok: true, result: { drill: 'stall', verdict: 'pass', truth_id: 'ft-123' } })
  assert.equal(c.getDone(), 'drill stall scored pass')
  assert.equal(c.reports[0].kind, 'score')
})

test('floor-scene-check.sks plays stall, night, and disk on eval floors and closes all three', () => {
  const c = bootCart('floor-scene-check')
  c.start()
  const closed = c.host.ledger.filter((r) => r.kind === 'floor-scene' && r.action === 'close')
  assert.equal(closed.length, 3)
  assert.deepEqual(closed.map((r) => r.scene), ['stall', 'night', 'disk'])
  assert.match(c.getDone(), /^checked 3 scenes;/)
})

test('floor-assay.sks checks producer rows and records drifted producers on the eval floor', () => {
  const c = bootCart('floor-assay')
  c.start()
  assert.equal(c.handCalls[0].op, 'floor-assay')
  c.send('hand', {
    ok: true,
    result: {
      rows: [
        { producer: 'foreman-health', state: 'ok', detail: 'healthy' },
        { producer: 'lme-desk', state: 'moved', detail: 'line moved +32 lines' },
      ],
    },
  })
  assert.equal(c.getDone(), '1 ok, 1 drifted')
  const failRow = c.host.ledger.find((r) => r.kind === 'floor-expect' && r.check === 'assay:lme-desk')
  assert.ok(failRow)
})

test('floor-game.sks authors and plays two-pages-one-night on an eval floor with 0 failed expectations', () => {
  const c = bootCart('floor-game')
  c.start()
  const closeRow = c.host.ledger.find((r) => r.kind === 'floor-scene' && r.action === 'close')
  assert.equal(closeRow.scene, 'two-pages-one-night')
  assert.equal(closeRow.fails, 0)
  assert.equal(closeRow.passes, 1)
  assert.equal(c.getDone(), 'two-pages-one-night complete: 1 passed')
})
