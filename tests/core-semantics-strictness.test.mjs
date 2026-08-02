// tests/core-semantics-strictness.test.mjs
//
// Provenance: 2026-08-02, from scratch/LANG-ASSESSMENT-2026-08-01.md. Five
// defects in the base vocabulary, all of the same family: the JS host's
// permissiveness leaking through the language, so a mistake produced a
// plausible-looking value instead of an error.
//
//   C2  (apply + 1 2 (list 3 4))     => 1        — leading args dropped
//   C3  (+ 1 "a")                    => "1a"     — JS string concatenation
//   C5  (car (list)) / (length 5)    => blank    — JS undefined printed as ""
//   C6  (/ 1 0)                      => Infinity — JS float semantics
//   C7  (eq? (list 1 2) (list 1 2))  => #t       — eq? was bound to equal?
//
// Every one is a WRONG ANSWER, not a crash. That is what makes them worth a
// test file: a learner cannot debug an answer that looks fine, and the
// arithmetic ones propagate — "1a" and NaN travel several steps before
// surfacing somewhere unrelated to the actual mistake.
//
// C7 is the one with teeth beyond its repro. `eq?`/`eqv?`/`equal?` were all
// bound to the same deep-structural function, so Motoi taught that the
// distinction does not exist. It is the distinction Scheme is most known for,
// and a learner who carries Motoi's version into any other Scheme finds their
// model inverted. The fix was gated on all 41 carts still running.

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

// The defects were all silent, so "it raises" is half the assertion. The
// other half is that the message names the verb — an error that says
// "undefined is not a function" teaches nothing about which call was wrong.
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function raises(src, verb) {
  assert.throws(() => run(src), (e) => {
    assert.match(e.message, new RegExp(`^${rx(verb)}:`),
      `error should name the verb that failed, got: ${e.message}`)
    return true
  }, `${src} must be an error, not a value`)
}

// ── C2 · apply passes the leading arguments ──────────────────────────
//
// R7RS §6.10: (apply proc arg1 … args) calls proc with arg1 … prepended to
// the elements of the list `args`. The old binding took exactly (fn, args),
// so every argument between them vanished.

test('apply prepends its leading arguments to the final list', () => {
  assert.equal(run('(apply + 1 2 (list 3 4))'), 10)
  assert.equal(run('(apply + 1 (list 2))'), 3)
  assert.deepEqual(run('(apply list 1 2 (list 3 4))'), [1, 2, 3, 4])
})

test('apply still accepts the plain two-argument form', () => {
  assert.equal(run('(apply + (list 1 2 3))'), 6)
  assert.equal(run('(apply + (list))'), 0)
})

test('apply threads leading arguments into a closure', () => {
  assert.equal(run('(apply (lambda (a b c) (- a b c)) 10 (list 3 2))'), 5)
})

test('apply rejects a final argument that is not a list', () => {
  // R7RS makes this an error. Accepting it silently wrapped the value, which
  // is how `(apply f 1 2)` looked like it worked while ignoring the 1.
  raises('(apply + 1 2)', 'apply')
})

// ── C3 · arithmetic takes numbers ────────────────────────────────────

test('+ rejects a non-number instead of concatenating', () => {
  raises('(+ 1 "a")', '+')
  // The original defect, stated exactly: JS `1 + "a"` is the string "1a".
  assert.notEqual(run('(guard (e (#t (quote err))) (+ 1 "a"))').name, undefined)
})

for (const [op, expr] of [
  ['+', '(+ 1 (quote sym))'],
  ['-', '(- 1 "2")'],
  ['*', '(* 2 #t)'],
  ['/', '(/ 6 "2")'],
  ['max', '(max 1 "9")'],
  ['min', '(min 1 (list 2))'],
  ['modulo', '(modulo 7 "2")'],
  ['quotient', '(quotient 7 "2")'],
  ['remainder', '(remainder 7 "2")'],
]) {
  test(`${expr} is an error`, () => raises(expr, op))
}

test('the error names what it got, not just that it failed', () => {
  // A learner debugging `(+ total price)` needs to know price was a string.
  assert.throws(() => run('(+ 1 "a")'), /the string "a"/)
  assert.throws(() => run('(length 5)'), /the number 5/)
  assert.throws(() => run('(car (list))'), /the empty list/)
})

test('arithmetic still works on every shape it is supposed to', () => {
  assert.equal(run('(+ 1 2 3)'), 6)
  assert.equal(run('(- 5)'), -5)
  assert.equal(run('(* 2 3 4)'), 24)
  assert.equal(run('(/ 6 3)'), 2)
  assert.equal(run('(+)'), 0)
  assert.equal(run('(*)'), 1)
  assert.equal(run('(max 1 5 2)'), 5)
  assert.equal(run('(min 1 5 2)'), 1)
  assert.equal(run('(+ 0.5 0.25)'), 0.75)
})

test('exact rationals survive the number check', () => {
  // Rationals are heap objects, so a naive `typeof x === "number"` guard
  // would have rejected the entire exact tower.
  assert.equal(run('(with-output-to-string (lambda () (write (+ 1/2 1/3))))'), '5/6')
  assert.equal(run('(with-output-to-string (lambda () (write (* 2/3 3/4))))'), '1/2')
})

// ── C5 · bad input is an error, not JS undefined ─────────────────────
//
// `undefined` prints as an empty string, so the REPL showed a blank line
// where the mistake was and the value carried on into later steps.

test('car and cdr reject the empty list', () => {
  raises('(car (list))', 'car')
  raises('(cdr (list))', 'cdr')
})

test('car and cdr reject non-lists', () => {
  raises('(car 7)', 'car')
  raises('(cdr "abc")', 'cdr')
  raises('(car #t)', 'car')
})

test('cadr and caddr blame themselves, not car', () => {
  // Nesting the internal accessors made a two-element list report a `car`
  // failure, sending the learner to a call they never wrote.
  raises('(cadr (list 1))', 'cadr')
  raises('(caddr (list 1 2))', 'caddr')
})

test('length rejects anything that is not a proper list', () => {
  raises('(length 5)', 'length')
  raises('(length "abc")', 'length')
  raises('(length (cons 1 2))', 'length')
})

test('the accessors still work on the shapes they should', () => {
  assert.equal(run('(car (list 1 2))'), 1)
  assert.deepEqual(run('(cdr (list 1 2))'), [2])
  assert.equal(run('(car (cons 1 2))'), 1)
  assert.equal(run('(cdr (cons 1 2))'), 2)
  assert.equal(run('(cadr (list 1 2 3))'), 2)
  assert.equal(run('(caddr (list 1 2 3))'), 3)
  assert.equal(run('(length (list))'), 0)
  assert.equal(run('(length (list 1 2 3))'), 3)
})

// ── C6 · division by zero ────────────────────────────────────────────

test('division by zero is an error, not Infinity', () => {
  raises('(/ 1 0)', '/')
  raises('(/ 0 0)', '/')
  raises('(/ 0)', '/')
  raises('(/ 10 2 0)', '/')
  raises('(modulo 7 0)', 'modulo')
  raises('(quotient 7 0)', 'quotient')
  raises('(remainder 7 0)', 'remainder')
})

test('a zero DIVIDEND is fine — only the divisor is the error', () => {
  assert.equal(run('(/ 0 5)'), 0)
})

// ── C7 · eq? / eqv? / equal? are three different questions ───────────

test('eq? and eqv? are not structural', () => {
  assert.equal(run('(eq? (list 1 2) (list 1 2))'), false)
  assert.equal(run('(eqv? (list 1 2) (list 1 2))'), false)
  assert.equal(run('(eq? (vector 1 2) (vector 1 2))'), false)
  assert.equal(run('(eq? (cons 1 2) (cons 1 2))'), false)
})

test('equal? IS structural — this is the whole reason it exists', () => {
  assert.equal(run('(equal? (list 1 2) (list 1 2))'), true)
  assert.equal(run('(equal? (vector 1 2) (vector 1 2))'), true)
  assert.equal(run('(equal? (cons 1 2) (cons 1 2))'), true)
  assert.equal(run('(equal? (list 1 (list 2 3)) (list 1 (list 2 3)))'), true)
})

test('=? is the friendly spelling of equal?, not of eq?', () => {
  // `=?` is Motoi's own "do what I mean" verb and must stay deep — carts
  // reach for it precisely to avoid choosing.
  assert.equal(run('(=? (list 1 2) (list 1 2))'), true)
})

test('an aggregate is eq? to itself', () => {
  assert.equal(run('(let ((xs (list 1 2))) (eq? xs xs))'), true)
  assert.equal(run('(let ((xs (list 1 2))) (eqv? xs xs))'), true)
})

test('eq? holds for symbols — R7RS requires it', () => {
  assert.equal(run("(eq? 'a 'a)"), true)
  assert.equal(run("(eq? 'a 'b)"), false)
  assert.equal(run("(eqv? 'hello 'hello)"), true)
})

test('eqv? compares numbers and characters by value', () => {
  assert.equal(run('(eqv? 1 1)'), true)
  assert.equal(run('(eqv? 1 2)'), false)
  assert.equal(run('(eqv? 1/2 1/2)'), true)
  assert.equal(run('(eqv? 1/2 2/4)'), true)
  assert.equal(run('(eqv? #\\a #\\a)'), true)
  assert.equal(run('(eqv? #\\a #\\b)'), false)
})

test('eqv? separates exact from inexact', () => {
  // R7RS §6.1: eqv? is #f when one operand is exact and the other is not,
  // even at the same numeric value.
  assert.equal(run('(eqv? 1/2 0.5)'), false)
})

test('eqv? on a number and a non-number is #f, not a crash', () => {
  assert.equal(run('(eqv? 1/2 "x")'), false)
  assert.equal(run('(eqv? 1/2 (list))'), false)
})

test('the empty list is eq? to itself across constructions', () => {
  // `(eq? '() '())` is #t in every Scheme; Motoi's empty list is a fresh
  // JS array each time, so this is the one aggregate that needs the answer
  // pinned rather than inherited from identity.
  assert.equal(run("(equal? '() '())"), true)
  assert.equal(run("(null? '())"), true)
})

// ── substring conforms to R7RS §6.7 (2026-08-02) ──────────────────────────
//
// This was raw JS String.prototype.substring, which clamped past the end,
// clamped negatives, and SWAPPED reversed indices. The swap is the reason
// this matters: a reversed-index bug returned a plausible string and never
// announced itself, which is the failure a learner cannot debug.
test('substring returns the right slice when in range', () => {
  assert.equal(run('(substring "hello" 1 4)'), 'ell')
  assert.equal(run('(substring "hello" 0 5)'), 'hello')
  assert.equal(run('(substring "hello" 2)'), 'llo')
  assert.equal(run('(substring "hello" 3 3)'), '')
})

test('substring RAISES past the end instead of clamping', () => {
  assert.throws(() => run('(substring "ab" 0 3)'), /past the end .*length 2/)
  // and the message points at the two things the caller actually wanted
  assert.throws(() => run('(substring "ab" 0 3)'), /string-prefix\?/)
  assert.throws(() => run('(substring "ab" 0 3)'), /min 3 \(string-length s\)/)
})

test('substring RAISES on a negative index instead of clamping to 0', () => {
  assert.throws(() => run('(substring "hello" -3 2)'), /-3 is negative/)
})

test('substring RAISES on reversed indices instead of swapping them', () => {
  // Used to answer "ell" — a plausible string for a genuine bug.
  assert.throws(() => run('(substring "hello" 4 1)'), /greater than end/)
})

test('the conforming spellings of what callers actually meant both work', () => {
  assert.equal(run('(string-prefix? "au" "audio/x")'), true)
  assert.equal(run('(string-prefix? "au" "a")'), false)   // short input: #f, not an error
  assert.equal(run('(substring "hi" 0 (min 5 (string-length "hi")))'), 'hi')
  assert.equal(run('(substring "hello world" 0 (min 5 (string-length "hello world")))'), 'hello')
})
