// tests/dotted-pairs-and-special-forms.test.mjs
//
// Provenance: 2026-08-02. Two changes are locked in here.
//
// (1) Real cons cells. Before this, `(cons 'sku 42)` built the two-element
//     LIST `(sku 42)`, so `(cdr (assq 'sku alist))` returned `(42)` instead
//     of `42` — the R7RS-correct idiom was silently wrong at 8,232 call
//     sites. The reader had the same defect one level down: `'(1 . 2)` read
//     as a three-element list containing a symbol named `.`, which PRINTED
//     as `(1 . 2)` and so hid itself. Silent-wrong that renders correctly is
//     the worst failure class for a teaching language, hence this file.
//
// (2) The R7RS special forms that were simply absent: letrec*, case-lambda,
//     define-values, delay-force, parameterize, cond-expand, and `case`
//     with `=>`. Plus define-record-type, which was wholly broken because
//     `_make-record-type` was defined twice with incompatible signatures.
//
// Proper lists remain JS arrays — a Pair is minted only for an improper
// cdr — so the array fast path every cart depends on is untouched.

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

// Compare against the printed form, which is what a learner actually sees.
function shows(src, expected) {
  assert.equal(run(`(with-output-to-string (lambda () (write ${src})))`), expected)
}

// ── (1) cons builds a real pair ──────────────────────────────────────

test('cons of a non-list cdr builds an improper pair, not a 2-element list', () => {
  assert.equal(run("(pair? (cons 'sku 42))"), true)
  assert.equal(run("(list? (cons 'sku 42))"), false)
  assert.equal(run("(cdr (cons 'sku 42))"), 42)
  assert.equal(run("(car (cons 'sku 42))").name, 'sku')
})

test('cons onto a list still yields a proper list (the cart fast path)', () => {
  assert.deepEqual(run('(cons 1 (list 2 3))'), [1, 2, 3])
  assert.equal(run('(list? (cons 1 (list 2 3)))'), true)
  assert.equal(run('(length (cons 1 (list 2 3)))'), 3)
})

test('(cdr (assq key alist)) returns the value — the R7RS idiom', () => {
  assert.equal(run("(cdr (assq 'sku (list (cons 'sku 42) (cons 'qty 7))))"), 42)
  assert.equal(run("(cdr (assv 'qty (list (cons 'sku 42) (cons 'qty 7))))"), 7)
  assert.equal(run("(cdr (assoc 'sku (list (cons 'sku 42))))"), 42)
})

test('(cadr (assq key alist)) still works for list-shaped entries', () => {
  assert.equal(run("(cadr (assq 'sku (list (list 'sku 42))))"), 42)
})

test('length rejects an improper list instead of guessing', () => {
  assert.throws(() => run('(length (cons 1 2))'), /improper list/)
})

// ── (2) the reader understands dotted syntax ─────────────────────────

test("reader builds a real pair from '(1 . 2) — not a list containing `.`", () => {
  assert.equal(run("(cdr '(1 . 2))"), 2)
  assert.equal(run("(car '(1 . 2))"), 1)
  assert.equal(run("(pair? '(1 . 2))"), true)
  assert.equal(run("(list? '(1 . 2))"), false)
})

test('a dotted tail collapses the way Scheme writes it', () => {
  assert.equal(run("(cdr (cdr '(1 2 . 3)))"), 3)
  // `(1 . (2 3))` denotes the same object as `(1 2 3)`.
  assert.equal(run("(list? '(1 . (2 3)))"), true)
  assert.deepEqual(run("'(1 . (2 3))"), [1, 2, 3])
})

test('equal? compares pairs structurally', () => {
  assert.equal(run("(equal? '(1 . 2) (cons 1 2))"), true)
  assert.equal(run('(equal? (cons 1 2) (cons 1 3))'), false)
  // An improper pair is NOT the two-element list — the original bug.
  assert.equal(run("(equal? (cons 'a 1) (list 'a 1))"), false)
})

// ── (3) printing ─────────────────────────────────────────────────────

test('write and display render a dotted pair with the dot', () => {
  shows("(cons 1 2)", '(1 . 2)')
  shows("(cons 1 (cons 2 3))", '(1 2 . 3)')
  shows("(list 1 (cons 2 3))", '(1 (2 . 3))')
})

// ── (4) dotted syntax is also how variadic params are written ────────

test('variadic parameter lists survive the reader change', () => {
  assert.deepEqual(run('(define (f a . rest) rest) (f 1 2 3)'), [2, 3])
  assert.deepEqual(run('(define (g . xs) xs) (g 1 2)'), [1, 2])
  assert.deepEqual(run('((lambda (a . r) r) 1 2 3)'), [2, 3])
  assert.deepEqual(run('((lambda args args) 1 2)'), [1, 2])
  assert.deepEqual(run('(define (k a . r) r) (k 1)'), [])
  assert.equal(run('(define (h a b) (+ a b)) (h 1 2)'), 3)
})

test('quasiquote expands through a dotted tail', () => {
  shows('`(1 ,(+ 1 1) . 3)', '(1 2 . 3)')
  shows('`(1 . ,(+ 1 2))', '(1 . 3)')
  shows('`(1 ,@(list 2 3) 4)', '(1 2 3 4)')
})

// ── (5) the special forms that were missing ──────────────────────────

test('letrec* evaluates its bindings in sequence', () => {
  assert.equal(run('(letrec* ((a 1) (b (+ a 1))) b)'), 2)
})

test('case supports the => arrow clause', () => {
  assert.equal(run("(case 3 ((3) => (lambda (x) (* x 10))) (else 'no))"), 30)
})

test('case-lambda dispatches on argument count, including a rest clause', () => {
  const src = "(define f (case-lambda ((a) 'one) ((a b) 'two) ((a . r) 'many)))"
  assert.equal(run(`${src} (f 1)`).name, 'one')
  assert.equal(run(`${src} (f 1 2)`).name, 'two')
  assert.equal(run(`${src} (f 1 2 3)`).name, 'many')
  assert.throws(() => run("(define g (case-lambda ((a) 'one))) (g 1 2)"), /no clause/)
})

test('define-values destructures a producer', () => {
  assert.equal(run('(define-values (a b) (values 1 2)) (+ a b)'), 3)
})

test('delay-force forces through the inner promise', () => {
  assert.equal(run('(force (delay-force (delay 7)))'), 7)
})

test('parameterize rebinds for the dynamic extent and restores after', () => {
  assert.deepEqual(run('(define p (make-parameter 1)) (list (p) (parameterize ((p 2)) (p)) (p))'), [1, 2, 1])
  assert.equal(run('(define p (make-parameter 1)) (parameterize ((p 2)) (parameterize ((p 3)) (p)))'), 3)
})

test('parameterize restores even when the body raises', () => {
  assert.equal(run('(define p (make-parameter 1)) (guard (e (#t (p))) (parameterize ((p 2)) (raise (quote x))))'), 1)
})

test('make-parameter runs its converter through the interpreter', () => {
  assert.deepEqual(run('(define q (make-parameter 1 (lambda (x) (* x 10)))) (list (q) (parameterize ((q 2)) (q)))'), [10, 20])
})

test('cond-expand selects on feature requirements', () => {
  assert.equal(run("(cond-expand (motoi 'yes) (else 'no))").name, 'yes')
  assert.equal(run("(cond-expand (nosuch 'yes) (else 'no))").name, 'no')
  assert.equal(run("(cond-expand ((and scheme r7rs) 'both) (else 'no))").name, 'both')
  assert.equal(run("(cond-expand ((or nosuch r7rs) 'ok) (else 'no))").name, 'ok')
  assert.equal(run("(cond-expand ((not nosuch) 'ok) (else 'no))").name, 'ok')
})

// ── (6) define-record-type — was wholly broken ───────────────────────

test('define-record-type builds a working constructor, predicate, accessors', () => {
  const src = '(define-record-type <pt> (mk x y) pt? (x px) (y py))'
  assert.equal(run(`${src} (px (mk 3 4))`), 3)
  assert.equal(run(`${src} (py (mk 3 4))`), 4)
  assert.equal(run(`${src} (pt? (mk 3 4))`), true)
  assert.equal(run(`${src} (pt? 9)`), false)
})

test('define-record-type wires field mutators', () => {
  assert.equal(run('(define-record-type <c> (mkc v) c? (v cv set-cv!)) (define o (mkc 1)) (set-cv! o 9) (cv o)'), 9)
})
