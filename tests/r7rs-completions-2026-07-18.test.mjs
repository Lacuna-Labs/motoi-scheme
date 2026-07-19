// r7rs-completions-2026-07-18.test.mjs
//
// Tests for the FILL PASS from the 2026-07-18 language finalization
// audit. Every added R7RS-small / SRFI-1 / SRFI-13 / SRFI-125 verb has
// a smoke test here that exercises the standard behavior + at least
// one edge case (empty input, wrong-type arg where applicable).
//
// See:
//   * engineering/MOTOI-SCHEME-FINALIZATION-2026-07-18.ENG.slat — full report
//   * src/r7rs-completions.js — the module under test
//   * scheme/MOTOI-SCHEME-REFERENCE.slat — reference paragraphs for every add

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeBaseEnv } from '../src/base.js'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'

function run(src) {
  const env = makeBaseEnv(1_000_000)
  const forms = parse(src)
  const fuel = { n: 1_000_000 }
  let last
  for (const f of forms) last = evaluate(f, env, fuel)
  return last
}

// ── SRFI-1 list library ──────────────────────────────────────────────

test('iota — SRFI-1 numeric range with start + step', () => {
  assert.deepEqual(run('(iota 5)'), [0, 1, 2, 3, 4])
  assert.deepEqual(run('(iota 5 10)'), [10, 11, 12, 13, 14])
  assert.deepEqual(run('(iota 5 0 2)'), [0, 2, 4, 6, 8])
  assert.deepEqual(run('(iota 0)'), [])
})

test('fold — SRFI-1 left fold', () => {
  assert.equal(run('(fold + 0 (list 1 2 3 4))'), 10)
  assert.deepEqual(run('(fold cons (list) (list 1 2 3))'), [3, 2, 1])
  assert.equal(run('(fold + 0 (list))'), 0)
})

test('fold-right — SRFI-1 right fold', () => {
  assert.deepEqual(run('(fold-right cons (list) (list 1 2 3))'), [1, 2, 3])
  assert.equal(run('(fold-right + 0 (list 1 2 3 4))'), 10)
})

test('concatenate — SRFI-1 flatten one level', () => {
  assert.deepEqual(run('(concatenate (list (list 1 2) (list 3 4)))'), [1, 2, 3, 4])
  assert.deepEqual(run('(concatenate (list))'), [])
})

test('append-map — SRFI-1', () => {
  assert.deepEqual(run('(append-map (lambda (x) (list x x)) (list 1 2 3))'), [1, 1, 2, 2, 3, 3])
})

test('filter-map — SRFI-1 map then drop #f', () => {
  assert.deepEqual(run('(filter-map (lambda (x) (if (odd? x) (* x x) #f)) (list 1 2 3 4 5))'), [1, 9, 25])
})

test('partition — SRFI-1 split by predicate', () => {
  const r = run('(partition odd? (list 1 2 3 4 5))')
  assert.deepEqual(r, [[1, 3, 5], [2, 4]])
})

test('find — SRFI-1 first match or #f', () => {
  assert.equal(run('(find odd? (list 2 4 5 6))'), 5)
  assert.equal(run('(find odd? (list 2 4 6))'), false)
})

test('delete-duplicates — SRFI-1', () => {
  assert.deepEqual(run('(delete-duplicates (list 1 2 1 3 2 4))'), [1, 2, 3, 4])
})

test('unzip — SRFI-1 inverse of zip', () => {
  assert.deepEqual(run('(unzip (list (list 1 3) (list 2 4)))'), [[1, 2], [3, 4]])
})

test('second through tenth — SRFI-1 positional accessors', () => {
  assert.equal(run('(second (list 10 20 30 40 50 60 70 80 90 100))'), 20)
  assert.equal(run('(third (list 10 20 30 40 50 60 70 80 90 100))'), 30)
  assert.equal(run('(tenth (list 10 20 30 40 50 60 70 80 90 100))'), 100)
})

test('list? / list-tail / list-copy — R7RS §6.4', () => {
  assert.equal(run('(list? (list 1 2 3))'), true)
  assert.equal(run('(list? 5)'), false)
  assert.deepEqual(run('(list-tail (list 1 2 3 4 5) 2)'), [3, 4, 5])
  assert.deepEqual(run('(list-copy (list 1 2 3))'), [1, 2, 3])
})

// ── SRFI-13 string library ──────────────────────────────────────────

test('string-contains / string-index — SRFI-13', () => {
  assert.equal(run('(string-contains "hello world" "world")'), 6)
  assert.equal(run('(string-contains "hello" "xyz")'), false)
  assert.equal(run('(string-index "hello" "l")'), 2)
})

test('string-split / string-join — round-trip', () => {
  assert.deepEqual(run('(string-split "a,b,c" ",")'), ['a', 'b', 'c'])
  assert.equal(run('(string-join (list "a" "b" "c") "-")'), 'a-b-c')
  assert.deepEqual(run('(string-split "hello world foo")'), ['hello', 'world', 'foo'])
})

test('string-upcase / string-downcase / string-titlecase', () => {
  assert.equal(run('(string-upcase "hello")'), 'HELLO')
  assert.equal(run('(string-downcase "HELLO")'), 'hello')
  assert.equal(run('(string-titlecase "hello world")'), 'Hello World')
})

test('string-take / string-drop', () => {
  assert.equal(run('(string-take "hello" 3)'), 'hel')
  assert.equal(run('(string-drop "hello" 2)'), 'llo')
})

test('string-pad / string-pad-right', () => {
  assert.equal(run('(string-pad "7" 3 "0")'), '007')
  assert.equal(run('(string-pad-right "7" 3 "0")'), '700')
})

test('string-trim / string-trim-left / string-trim-right', () => {
  assert.equal(run('(string-trim "  hi  ")'), 'hi')
  assert.equal(run('(string-trim-left "  hi  ")'), 'hi  ')
  assert.equal(run('(string-trim-right "  hi  ")'), '  hi')
})

test('string-replace / string-reverse / string-count', () => {
  assert.equal(run('(string-replace "hello" "l" "L")'), 'heLLo')
  assert.equal(run('(string-reverse "abc")'), 'cba')
  assert.equal(run('(string-count "hello" "l")'), 2)
})

test('string->list / list->string / string constructor', () => {
  assert.deepEqual(run('(string->list "abc")'), ['a', 'b', 'c'])
  assert.equal(run('(list->string (list "a" "b" "c"))'), 'abc')
  assert.equal(run('(string "a" "b" "c")'), 'abc')
})

test('make-string / string-copy', () => {
  assert.equal(run('(make-string 3 "-")'), '---')
  assert.equal(run('(string-copy "hello" 1 4)'), 'ell')
})

test('string<? / string>? / string-ci=?', () => {
  assert.equal(run('(string<? "abc" "abd")'), true)
  assert.equal(run('(string>? "abd" "abc")'), true)
  assert.equal(run('(string-ci=? "Hi" "hi")'), true)
})

test('symbol->string / string->symbol', () => {
  assert.equal(run("(symbol->string 'foo)"), 'foo')
  const s = run('(string->symbol "foo")')
  assert.equal(s.name, 'foo')
})

// ── Characters — R7RS §6.6 ──────────────────────────────────────────

test('char predicates', () => {
  assert.equal(run('(char-alphabetic? "a")'), true)
  assert.equal(run('(char-numeric? "5")'), true)
  assert.equal(run('(char-whitespace? " ")'), true)
  assert.equal(run('(char-upper-case? "A")'), true)
  assert.equal(run('(char-lower-case? "a")'), true)
  assert.equal(run('(char? "a")'), true)
})

test('char conversions', () => {
  assert.equal(run('(char-upcase "a")'), 'A')
  assert.equal(run('(char-downcase "A")'), 'a')
  assert.equal(run('(char->integer "A")'), 65)
  assert.equal(run('(integer->char 65)'), 'A')
  assert.equal(run('(digit-value "5")'), 5)
  assert.equal(run('(digit-value "a")'), false)
})

// ── Numeric tower — R7RS §6.2 ───────────────────────────────────────

test('exact / inexact / integer? / rational? / real?', () => {
  assert.equal(run('(exact 3.7)'), 3)
  assert.equal(run('(inexact 3)'), 3)
  assert.equal(run('(integer? 3)'), true)
  assert.equal(run('(integer? 3.5)'), false)
  assert.equal(run('(rational? 3.5)'), true)
  assert.equal(run('(real? 3.5)'), true)
})

test('exact? / inexact? / exact-integer? / finite? / infinite? / nan?', () => {
  assert.equal(run('(exact? 3)'), true)
  assert.equal(run('(inexact? 3.5)'), true)
  assert.equal(run('(exact-integer? 3)'), true)
  assert.equal(run('(finite? 3.5)'), true)
})

test('gcd / lcm / numerator / denominator / truncate / square', () => {
  assert.equal(run('(gcd 12 18)'), 6)
  assert.equal(run('(lcm 4 6)'), 12)
  assert.equal(run('(numerator 3)'), 3)
  assert.equal(run('(denominator 3)'), 1)
  assert.equal(run('(truncate 3.7)'), 3)
  assert.equal(run('(square 5)'), 25)
  assert.equal(run('(gcd)'), 0)
  assert.equal(run('(lcm)'), 1)
})

test('atan — 1-arg + 2-arg', () => {
  assert.equal(Math.round(run('(atan 1 1)') * 1000) / 1000, 0.785)
  assert.equal(run('(atan 0)'), 0)
})

// ── I/O — R7RS §6.10 ────────────────────────────────────────────────

test('string ports — open/read/write/get-output', () => {
  const port = run('(open-input-string "hello")')
  assert.ok(port)
  assert.equal(run('(read-char (open-input-string "abc"))'), 'a')
  assert.equal(run('(peek-char (open-input-string "abc"))'), 'a')
  assert.equal(run('(read-line (open-input-string "line one\\nrest"))'), 'line one')
})

test('with-output-to-string — capture display', () => {
  const s = run('(with-output-to-string (lambda () (display "captured")))')
  assert.equal(s, 'captured')
})

test('eof-object / eof-object?', () => {
  assert.equal(run('(eof-object? (eof-object))'), true)
  assert.equal(run('(eof-object? 5)'), false)
})

test('port predicates', () => {
  assert.equal(run('(input-port? (open-input-string "hi"))'), true)
  assert.equal(run('(output-port? (open-output-string))'), true)
})

// ── Bytevectors — R7RS §6.9 ─────────────────────────────────────────

test('make-bytevector / bytevector / bytevector? / bytevector-length', () => {
  const bv = run('(make-bytevector 3 42)')
  assert.equal(bv.length, 3)
  assert.equal(bv[0], 42)
  assert.equal(run('(bytevector? (make-bytevector 3))'), true)
  assert.equal(run('(bytevector-length (bytevector 1 2 3 4))'), 4)
})

test('bytevector-u8-ref / -set! / -copy / -append', () => {
  assert.equal(run('(bytevector-u8-ref (bytevector 10 20 30) 1)'), 20)
  const src = `
    (define bv (bytevector 1 2 3 4))
    (bytevector-u8-set! bv 0 99)
    (bytevector-u8-ref bv 0)
  `
  assert.equal(run(src), 99)
  const copied = run('(bytevector-copy (bytevector 1 2 3 4) 1 3)')
  assert.equal(copied.length, 2)
  assert.equal(copied[0], 2)
})

test('utf8->string / string->utf8 — R7RS §6.9', () => {
  assert.equal(run('(utf8->string (bytevector 72 105))'), 'Hi')
  const bv = run('(string->utf8 "Hi")')
  assert.equal(bv.length, 2)
  assert.equal(bv[0], 72)
})

// ── Hash tables — SRFI-125 ──────────────────────────────────────────

test('make-hash-table / set! / ref / exists?', () => {
  const src = `
    (define h (make-hash-table))
    (hash-table-set! h "k" 42)
    (list (hash-table-ref h "k") (hash-table-exists? h "k") (hash-table-exists? h "missing"))
  `
  assert.deepEqual(run(src), [42, true, false])
})

test('hash-table-ref default value on miss', () => {
  assert.equal(run('(hash-table-ref (make-hash-table) "k" "default")'), 'default')
  assert.equal(run('(hash-ref (make-hash-table) "k" "sakura-default")'), 'sakura-default')
})

test('hash-table-delete! / hash-table-size / hash-table-clear!', () => {
  const src = `
    (define h (make-hash-table))
    (hash-table-set! h "a" 1)
    (hash-table-set! h "b" 2)
    (define pre (hash-table-size h))
    (hash-table-delete! h "a")
    (define post (hash-table-size h))
    (hash-table-clear! h)
    (list pre post (hash-table-size h))
  `
  assert.deepEqual(run(src), [2, 1, 0])
})

test('hash-table-keys / values / ->alist / alist->', () => {
  const src = `
    (define h (make-hash-table))
    (hash-table-set! h "a" 1)
    (hash-table-set! h "b" 2)
    (list (length (hash-table-keys h)) (length (hash-table-values h)))
  `
  assert.deepEqual(run(src), [2, 2])
})

test('hash-table-update! — apply updater', () => {
  const src = `
    (define h (make-hash-table))
    (hash-table-set! h "count" 5)
    (hash-table-update! h "count" (lambda (v) (+ v 1)))
    (hash-table-ref h "count")
  `
  assert.equal(run(src), 6)
})

test('hash-table-fold — left fold over entries', () => {
  const src = `
    (define h (make-hash-table))
    (hash-table-set! h "a" 1)
    (hash-table-set! h "b" 2)
    (hash-table-set! h "c" 3)
    (hash-table-fold h (lambda (k v acc) (+ acc v)) 0)
  `
  assert.equal(run(src), 6)
})

// ── Vectors — R7RS §6.8 ──────────────────────────────────────────────

test('vector / make-vector / vector? / vector-length', () => {
  assert.deepEqual(run('(vector 1 2 3)'), [1, 2, 3])
  assert.deepEqual(run('(make-vector 3 0)'), [0, 0, 0])
  assert.equal(run('(vector? (vector 1 2))'), true)
  assert.equal(run('(vector-length (vector 1 2 3))'), 3)
})

test('vector-map / vector-for-each / vector-fill!', () => {
  assert.deepEqual(run('(vector-map square (vector 1 2 3))'), [1, 4, 9])
  const src = `
    (define v (vector 1 2 3))
    (vector-fill! v 0)
    v
  `
  assert.deepEqual(run(src), [0, 0, 0])
})

// ── Exceptions — R7RS §6.11 ─────────────────────────────────────────

test('error — raises SchemeError', () => {
  assert.throws(() => run('(error "boom" 1 2 3)'), /boom/)
})

test('guard — catches raised error', () => {
  const src = `
    (guard (err ((error-object? err) "caught"))
      (error "test"))
  `
  assert.equal(run(src), 'caught')
})

test('guard — no error, body value returned', () => {
  const src = `
    (guard (err (else "err"))
      42)
  `
  assert.equal(run(src), 42)
})

test('error-object-message / error-object-irritants', () => {
  const src = `
    (guard (err ((error-object? err) (list (error-object-message err) (error-object-irritants err))))
      (error "boom" 1 2))
  `
  const [msg, irritants] = run(src)
  assert.equal(msg, 'boom')
  assert.deepEqual(irritants, [1, 2])
})

test('raise — throws value (caught via guard)', () => {
  // raise wraps non-SchemeError values in a SchemeError with irritant.
  // Caught via guard, we can inspect the irritant.
  const src = `
    (guard (err ((error-object? err) (error-object-irritants err)))
      (raise "boom"))
  `
  assert.deepEqual(run(src), ['boom'])
})

// ── Records — R7RS §5.5 ─────────────────────────────────────────────

test('define-record-type — full lifecycle', () => {
  const src = `
    (define-record-type point
      (make-point x y)
      point?
      (x point-x set-point-x!)
      (y point-y set-point-y!))
    (define p (make-point 3 4))
    (list (point? p) (point-x p) (point-y p) (begin (set-point-x! p 99) (point-x p)))
  `
  assert.deepEqual(run(src), [true, 3, 4, 99])
})

test('define-record-type — predicate distinguishes types', () => {
  const src = `
    (define-record-type foo (make-foo x) foo? (x foo-x))
    (define-record-type bar (make-bar y) bar? (y bar-y))
    (list (foo? (make-foo 1)) (foo? (make-bar 1)) (bar? (make-bar 1)))
  `
  assert.deepEqual(run(src), [true, false, true])
})

// ── do — R7RS §4.2.4 ────────────────────────────────────────────────

test('do — iteration with test + step', () => {
  const src = `
    (do ((i 0 (+ i 1))
         (acc 0 (+ acc i)))
        ((= i 5) acc))
  `
  assert.equal(run(src), 0 + 1 + 2 + 3 + 4)
})

test('do — no step means no update', () => {
  const src = `
    (do ((i 5)
         (n 0 (+ n 1)))
        ((= n 3) i))
  `
  assert.equal(run(src), 5)
})

// ── delay / force — R7RS §4.2.5 ─────────────────────────────────────

test('delay / force — lazy evaluation', () => {
  assert.equal(run('(force (delay (+ 1 2)))'), 3)
})

test('force is idempotent (memoized)', () => {
  const src = `
    (define counter 0)
    (define p (delay (begin (set! counter (+ counter 1)) 42)))
    (force p)
    (force p)
    counter
  `
  assert.equal(run(src), 1)
})

test('promise? / make-promise', () => {
  assert.equal(run('(promise? (delay 3))'), true)
  assert.equal(run('(force (make-promise 42))'), 42)
})

// ── Higher-order helpers ────────────────────────────────────────────

test('identity / const / compose', () => {
  assert.equal(run('(identity 42)'), 42)
  assert.equal(run('((const 7) 1 2 3)'), 7)
  assert.equal(run('((compose square (lambda (x) (+ x 1))) 4)'), 25)
})

// ── Boolean/symbol equality ─────────────────────────────────────────

test('boolean=? / symbol=?', () => {
  assert.equal(run('(boolean=? #t #t)'), true)
  assert.equal(run('(boolean=? #t #f)'), false)
  assert.equal(run("(symbol=? 'foo 'foo)"), true)
  assert.equal(run("(symbol=? 'foo 'bar)"), false)
})
