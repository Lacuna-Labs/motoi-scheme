// tests/guard-reraise-dynamic-extent.test.mjs
//
// R7RS-small §4.2.7: when a `guard` body raises and NO clause matches, the
// condition is re-raised "within the dynamic environment of the original call
// to raise", except that the current exception handler is the guard's. §4.2.7
// spells that out as a call/cc expansion: control jumps BACK INTO the body's
// dynamic extent to perform the re-raise, and then leaves it again on the way
// to the next handler. The observable consequence is that a `dynamic-wind`
// sitting between the guard and the raise point runs its before-thunk AND its
// after-thunk TWICE, not once.
//
// WHY THIS WAS SILENT FOR SO LONG
// -------------------------------
// Motoi implements `guard` as a JavaScript try/catch and `dynamic-wind` as a
// try/finally. That pairing gets the COMMON case exactly right — a guard whose
// clause matches unwinds once, runs `after` once, and returns. It is only the
// no-clause-matched path that diverges, and on that path the guard still
// (a) re-raised the right condition, (b) delivered it to the right outer
// handler, and (c) produced the right final VALUE. Every one of those is what
// a test naturally asserts. The ONLY thing that was wrong was the number of
// times a side-effecting thunk ran, which is invisible unless the test
// deliberately records each entry and exit into a mutable log and then counts.
// So the whole suite could be green while the dynamic extent was never
// re-entered. Every test below therefore asserts on an EFFECT LOG, not on the
// returned value alone.
//
// Each expectation here was checked against chibi-scheme (`chibi-scheme -p`)
// on 2026-08-03 and matches it exactly.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'

function run(src) {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  let last
  for (const form of parse(src)) last = evaluate(form, env, fuel)
  return last
}

// `log` accumulates with cons and is read back with `reverse`, so the result
// reads in TIME ORDER: leftmost symbol happened first. The whole
// `(result . log)` shape is rendered with `write` so the assertion does not
// depend on how the engine happens to spell a list internally.
const withLog = (body) => `(with-output-to-string (lambda ()
  (let ((log (list)))
    (define (note x) (set! log (cons x log)))
    (let ((result ${body}))
      (write (list result (reverse log)))))))`

const WIND = `(dynamic-wind (lambda () (note 'in))
                            (lambda () (raise 5))
                            (lambda () (note 'out)))`

function check(src, expectedResult, expectedLog) {
  assert.equal(
    run(withLog(src)),
    `(${expectedResult} (${expectedLog.join(' ')}))`,
    `for: ${src}`)
}

// ── the bug ──────────────────────────────────────────────────────────
//
// The inner guard's only clause tests for 6 and the raise is 5, so no clause
// matches and the condition must be re-raised in the extent it came from.
// Before 2026-08-03 this logged (in out): the extent was never re-entered.

test('guard with no matching clause re-enters the dynamic extent to re-raise', () => {
  check(
    `(guard (exn ((equal? exn 5) 'five))
       (guard (exn ((equal? exn 6) 'six)) ${WIND}))`,
    'five', ['in', 'out', 'in', 'out'])
})

// ── the case that was ALREADY right, and must stay right ─────────────
//
// This is the guard against over-correcting. When a clause DOES match, the
// guard IS the escape — there is nothing to re-raise, so no re-entry may
// happen. A fix that unconditionally replayed the winders would double these
// thunks too, and the returned value would not reveal it.

test('guard with a matching clause does NOT re-enter the extent', () => {
  check(`(guard (exn ((equal? exn 5) 'five)) ${WIND})`, 'five', ['in', 'out'])
})

// An `else` clause always matches, so an else-bearing guard never re-enters
// either — but the guard BELOW it, whose clause fails, still must.

test('else matches in place; the inner non-matching guard still re-enters', () => {
  check(`(guard (exn (else 'fell-through)) ${WIND})`,
    'fell-through', ['in', 'out'])
  check(
    `(guard (exn (else 'fell-through))
       (guard (exn ((equal? exn 6) 'six)) ${WIND}))`,
    'fell-through', ['in', 'out', 'in', 'out'])
})

// ── `=>` clauses take the same two paths ─────────────────────────────
//
// §4.2.7 gives guard clauses cond's full shape. A `=>` clause whose test is
// truthy is a MATCH (no re-entry); one whose test is #f falls through like any
// other, and must re-enter. Worth its own test because `=>` is handled by a
// separate branch of the clause loop, which could easily miss either path.

test('=> clause: truthy test escapes in place, falsy test re-enters', () => {
  check(
    `(guard (e ((assq 'a e) => cdr))
       (dynamic-wind (lambda () (note 'in))
                     (lambda () (raise (list (cons 'a 7))))
                     (lambda () (note 'out))))`,
    '7', ['in', 'out'])
  check(
    `(guard (e2 (else 'outer))
       (guard (e ((assq 'a e) => cdr))
         (dynamic-wind (lambda () (note 'in))
                       (lambda () (raise (list (cons 'b 7))))
                       (lambda () (note 'out)))))`,
    'outer', ['in', 'out', 'in', 'out'])
})

// ── ordering, which a single winder cannot detect ────────────────────
//
// With one dynamic-wind, replaying the extent in the WRONG order is
// indistinguishable from replaying it correctly. Two nested winds pin it down:
// re-entry must run before-thunks outermost->innermost and after-thunks
// innermost->outermost, i.e. the replay is byte-identical to the first pass.

test('nested dynamic-winds replay outermost-in, innermost-out', () => {
  check(
    `(guard (e ((equal? e 5) 'ok))
       (guard (e ((equal? e 6) 'no))
         (dynamic-wind (lambda () (note 'b1))
           (lambda () (dynamic-wind (lambda () (note 'b2))
                                    (lambda () (raise 5))
                                    (lambda () (note 'a2))))
           (lambda () (note 'a1)))))`,
    'ok', ['b1', 'b2', 'a2', 'a1', 'b1', 'b2', 'a2', 'a1'])
})

// Each guard that fails to match re-enters independently, so N failing guards
// produce N+1 passes through the extent. This catches a fix that only ever
// replays once because it forgot to re-record the extent on the way back out.

test('two failing guards in a row replay the extent twice', () => {
  check(
    `(guard (e ((equal? e 5) 'ok))
       (guard (e ((equal? e 7) 'no2))
         (guard (e ((equal? e 6) 'no1)) ${WIND})))`,
    'ok', ['in', 'out', 'in', 'out', 'in', 'out'])
})

// Conditions raised by `error` are ErrorObjects, not raw raised values, and
// travel a different unwrapping branch in the guard. Same rule applies.

test('an error-object condition re-enters the extent too', () => {
  check(
    `(guard (e (else (error-object-message e)))
       (guard (e ((string? e) 'str))
         (dynamic-wind (lambda () (note 'in))
                       (lambda () (error "boom"))
                       (lambda () (note 'out)))))`,
    '"boom"', ['in', 'out', 'in', 'out'])
})

// ── what must NOT be treated as a condition ──────────────────────────
//
// A call/cc escape is control flow, not a raise. It travels as a thrown
// sentinel and so passes through the very same dynamic-wind catch that records
// the extent — but a guard never re-raises it, so recording it would replay
// before/after thunks that the standard says run exactly once. Silent because
// the RETURNED value (42) is correct either way; only the log shows it.

test('a call/cc escape through a guard winds exactly once', () => {
  check(
    `(call/cc (lambda (k)
       (guard (e ((equal? e 99) 'no))
         (dynamic-wind (lambda () (note 'in))
                       (lambda () (k 42))
                       (lambda () (note 'out))))))`,
    '42', ['in', 'out'])
})

// `raise-continuable` calls its handler AT the raise point and returns the
// handler's value there, so the extent is never left in the first place and
// there is nothing to re-enter. Pinned here because the fix hangs off the
// unwinding path, and a regression that unwound raise-continuable would show
// up as a doubled log rather than a wrong answer.

test('raise-continuable never unwinds, so it never replays', () => {
  check(
    `(with-exception-handler (lambda (e) 42)
       (lambda () (dynamic-wind (lambda () (note 'in))
                                (lambda () (+ (raise-continuable 'x) 1))
                                (lambda () (note 'out)))))`,
    '43', ['in', 'out'])
})

// A dynamic-wind OUTSIDE the guard is not part of the extent between the guard
// and the raise, so it is never replayed no matter what the clauses do.

test('a dynamic-wind outside the guard is never replayed', () => {
  check(
    `(dynamic-wind (lambda () (note 'in))
                   (lambda () (guard (e (else 'caught)) (raise 5)))
                   (lambda () (note 'out)))`,
    'caught', ['in', 'out'])
})
