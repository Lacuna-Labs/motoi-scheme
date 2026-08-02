// tests/stack-recording-gate.test.mjs
//
// Provenance: 2026-08-02. `lib/system/stack.js` is an EAGER part of the core
// bundle, and installing it used to wire the interp's frame hooks straight
// away. So every program in the language allocated a frame object per closure
// application and unwound it through a try/finally, whether or not anything
// was reading the ledger. Measured on fib(21) + a 60k-iteration loop: 22% of
// total evaluation time. The verb-call counter next door costs 1.2% and stays
// on; this one is now off by default and arms where a debugger lives.
//
// Two things need holding still, and they pull against each other:
//
//   1. The default must stay OFF. It is an eager installer, so a future edit
//      that calls setStackHooks at install time would silently hand the tax
//      back to every cart with nothing failing.
//   2. Off must not mean SILENT. Returning an empty stack would read as "your
//      program has no frames" rather than "nobody was writing them down" —
//      the same silent-wrong shape the rest of this suite exists to catch.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'
import { setStackRecording, isStackRecording } from '../lib/system/stack.js'

function freshEnv() {
  const fuel = { n: 1_000_000 }
  return { env: makeCoreEnv({ fuel }), fuel }
}

function run(src, ctx = freshEnv()) {
  let last
  for (const form of parse(src)) last = evaluate(form, ctx.env, ctx.fuel)
  return last
}

// The module singleton outlives any one env, so every test starts from off.
const off = () => setStackRecording(false)

test('a fresh env does not record frames', () => {
  off()
  makeCoreEnv({ fuel: { n: 1000 } })
  assert.equal(isStackRecording(), false,
    'installing the core bundle must not arm the frame ledger — it costs ~22% of eval time')
})

test('motoi/stack says it is off rather than reporting an empty stack', () => {
  off()
  const frames = run('(motoi/stack)')
  assert.ok(Array.isArray(frames) && frames.length === 1,
    'the off answer is still shaped like a frame list so existing readers render it')
  const flat = JSON.stringify(frames)
  assert.match(flat, /recording is off/)
  assert.match(flat, /motoi\/stack-record!/,
    'the message must name the verb that turns it on')
})

test('motoi/stack-depth answers #f when off, not 0', () => {
  off()
  // 0 is a number a caller would do arithmetic on, and it is not the truth —
  // the depth is unknown, not zero.
  assert.equal(run('(motoi/stack-depth)'), false)
})

test('motoi/stack-recording? reports the gate', () => {
  off()
  const ctx = freshEnv()
  assert.equal(run('(motoi/stack-recording?)', ctx), false)
  run('(motoi/stack-record! #t)', ctx)
  assert.equal(run('(motoi/stack-recording?)', ctx), true)
  run('(motoi/stack-record! #f)', ctx)
  assert.equal(run('(motoi/stack-recording?)', ctx), false)
})

test('arming the ledger actually records frames', () => {
  off()
  const ctx = freshEnv()
  run('(motoi/stack-record! #t)', ctx)
  run(`(define (h) 1)
       (define (g) (h) 2)
       (define (f) (g) 3)
       (f)`, ctx)
  const peak = run('(motoi/stack-peak)', ctx)
  assert.equal(peak.length, 3, 'f > g > h should be three frames deep')
  assert.doesNotMatch(JSON.stringify(peak), /recording is off/)
  off()
})

// KNOWN LIMIT, found 2026-08-02 while gating the hook. `applyStep` pushes a
// frame, then returns a `Tail` for the last body form and pops in its
// `finally` — so the frame is gone BEFORE the trampoline evaluates that form.
// A procedure whose body is a single expression therefore never nests, and
// the ledger reports depth 1 no matter how deep the recursion actually goes:
//
//   (define (sum n) (if (= n 0) 0 (+ n (sum (- n 1)))))   →  peak depth 1
//
// `(sum (- n 1))` there is a genuine non-tail call — it is an argument to
// `+` — and a real debugger would show twelve frames. Only nesting through a
// NON-LAST body form (the test above) is captured.
//
// Not fixed here: the repair is in the trampoline, which is the hottest code
// in the interpreter, and it is a separate change from turning the hook off.
// Pinned so the gap is a recorded fact rather than a surprise later.
test('KNOWN LIMIT: single-expression bodies never nest in the ledger', () => {
  off()
  const ctx = freshEnv()
  run('(motoi/stack-record! #t)', ctx)
  run(`(define (sum n) (if (= n 0) 0 (+ n (sum (- n 1)))))
       (sum 12)`, ctx)
  const peak = run('(motoi/stack-peak)', ctx)
  assert.equal(peak.length, 1,
    'if this now reports 12, the trampoline was fixed — delete this test and '
    + 'the note above it, and tighten the frame assertions elsewhere')
  off()
})

test('disarming clears the ledger so stale frames cannot be read back', () => {
  off()
  const ctx = freshEnv()
  run('(motoi/stack-record! #t)', ctx)
  run('(define (h) 1) (define (g) (h) 2) (define (f) (g) 3) (f)', ctx)
  run('(motoi/stack-record! #f)', ctx)
  assert.match(JSON.stringify(run('(motoi/stack-peak)', ctx)), /recording is off/)
})

test('a TUI session arms the ledger', async () => {
  off()
  const { default: Session } = await import('../tui/session.js')
  const s = new Session({ fuel: 50_000 })
  assert.equal(isStackRecording(), true,
    'the stack panel is the reason the ledger exists — a TUI session should pay for it')
  s.evalSource('(define (f n) (if (= n 0) 0 (f (- n 1)))) (f 5)')
  off()
})
