// tests/srfi-surface-completion-2026-08-02.test.mjs
//
// Provenance: 2026-08-02. Thirty procedures that the adopted SRFI parts
// DECLARE but Motoi never bound — every one of them reported "unbound
// symbol" against the live env before this pass:
//
//   SRFI-1   xcons proper-list? span break take-right drop-right split-at
//            reduce-right append-reverse lset-adjoin lset-union
//            lset-intersection lset-difference lset<= lset=
//   SRFI-13  string-tokenize string-fold string-fold-right string-any
//            string-every string-concatenate string-index-right string-skip
//   SRFI-125 hash-table-empty? hash-table-count hash-table-find
//            hash-table-map hash-table-prune! hash-table-pop!
//            hash-table-intern!
//
// The expected values below are the SRFI documents' own worked examples
// wherever the document gives one, because argument ORDER is the thing that
// silently goes wrong here: every lset procedure takes the equality test
// FIRST, SRFI-125 puts the table first for count/intern!/pop!/empty? but the
// procedure first for find/prune!/map, and reduce-right ignores its
// ridentity for a non-empty list. A test that only checks "it returns
// something" would pass on all the wrong orders.
//
// Also locked here: the teaching-quality guards. Proper lists are JS arrays
// and a `Pair` is minted only for an improper cdr, so a list verb handed a
// dotted pair must say so in a sentence about lists — never a raw JS
// "x.map is not a function".

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'

function run (src) {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  let last
  for (const form of parse(src)) last = evaluate(form, env, fuel)
  return last
}

// The printed form is what a learner actually sees.
function shows (src, expected) {
  assert.equal(run(`(with-output-to-string (lambda () (write ${src})))`), expected)
}

function throwsWith (src, re) {
  assert.throws(() => run(src), (e) => re.test(e.message),
    `expected ${src} to throw matching ${re}`)
}

// ── SRFI-1: constructors + predicates ────────────────────────────────

test('xcons flips cons — the tail comes first', () => {
  assert.deepEqual(run("(xcons (list 'b 'c) 'a)").map((s) => s.name), ['a', 'b', 'c'])
  assert.deepEqual(run('(xcons (list 2 3) 1)'), [1, 2, 3])
  // Consing onto a non-list still mints a real improper pair.
  shows('(xcons 2 1)', '(1 . 2)')
  assert.equal(run('(pair? (xcons 2 1))'), true)
  assert.equal(run('(list? (xcons 2 1))'), false)
})

test('proper-list? separates lists from dotted pairs', () => {
  assert.equal(run('(proper-list? (list 1 2 3))'), true)
  assert.equal(run('(proper-list? (list))'), true)
  assert.equal(run('(proper-list? (cons 1 (list 2 3)))'), true)
  assert.equal(run('(proper-list? (cons 1 2))'), false)
  assert.equal(run("(proper-list? '(1 2 . 3))"), false)
  assert.equal(run('(proper-list? 5)'), false)
  assert.equal(run("(proper-list? 'a)"), false)
})

// ── SRFI-1: selectors ────────────────────────────────────────────────

test('take-right / drop-right cut from the far end', () => {
  assert.deepEqual(run('(take-right (list 1 2 3 4 5) 2)'), [4, 5])
  assert.deepEqual(run('(drop-right (list 1 2 3 4 5) 2)'), [1, 2, 3])
  assert.deepEqual(run('(take-right (list 1 2 3) 0)'), [])
  assert.deepEqual(run('(drop-right (list 1 2 3) 0)'), [1, 2, 3])
  assert.deepEqual(run('(take-right (list 1 2 3) 3)'), [1, 2, 3])
  assert.deepEqual(run('(drop-right (list 1 2 3) 3)'), [])
})

test('split-at returns TWO values, not a list of two', () => {
  shows('(call-with-values (lambda () (split-at (list 1 2 3 4 5) 2)) list)',
    '((1 2) (3 4 5))')
  shows('(call-with-values (lambda () (split-at (list 1 2) 0)) list)',
    '(() (1 2))')
})

// ── SRFI-1: searching ────────────────────────────────────────────────

test('span splits at the first FAILURE, break at the first SUCCESS', () => {
  shows('(call-with-values (lambda () (span odd? (list 1 3 4 5 7))) list)',
    '((1 3) (4 5 7))')
  shows('(call-with-values (lambda () (break even? (list 1 3 4 5 7))) list)',
    '((1 3) (4 5 7))')
  // span and break are exact mirrors of each other.
  shows('(call-with-values (lambda () (span even? (list 1 3 4))) list)',
    '(() (1 3 4))')
  shows('(call-with-values (lambda () (break even? (list 1 3 5))) list)',
    '((1 3 5) ())')
})

test('span and break re-enter the evaluator for a Scheme closure', () => {
  shows('(call-with-values (lambda () (span (lambda (x) (< x 3)) (list 1 2 3 4))) list)',
    '((1 2) (3 4))')
})

// ── SRFI-1: fold + append ────────────────────────────────────────────

test('reduce-right seeds from the LAST element and ignores ridentity', () => {
  // (1 - (2 - (3 - 4))) = -2, NOT a fold that consumes the 0.
  assert.equal(run('(reduce-right - 0 (list 1 2 3 4))'), -2)
  assert.equal(run('(reduce-right + 0 (list 1 2 3))'), 6)
  assert.equal(run('(reduce-right + 0 (list 7))'), 7)
  // ridentity is returned ONLY for the empty list.
  assert.equal(run('(reduce-right + 99 (list))'), 99)
})

test('reduce-right is element-first, like every SRFI-1 fold', () => {
  shows('(reduce-right (lambda (elem acc) (list elem acc)) 0 (list 1 2 3))',
    '(1 (2 3))')
})

test('append-reverse flushes an accumulator in one pass', () => {
  assert.deepEqual(run('(append-reverse (list 3 2 1) (list 4 5 6))'), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(run('(append-reverse (list) (list 1 2))'), [1, 2])
  assert.deepEqual(run('(append-reverse (list 1 2) (list))'), [2, 1])
  // A non-list tail is legal; the result is then improper.
  shows('(append-reverse (list 3 2 1) 9)', '(1 2 3 . 9)')
})

// ── SRFI-1: the lset family ──────────────────────────────────────────
// Expected values are the SRFI-1 document's own worked examples.

test('lset-adjoin conses new elements onto the front', () => {
  shows("(lset-adjoin equal? (list 'a 'b 'c 'd 'c 'e) 'a 'e 'i 'o 'u)",
    '(u o i a b c d c e)')
  shows("(lset-adjoin equal? (list 1 2) 3)", '(3 1 2)')
  // Nothing to add — the list comes back untouched.
  shows("(lset-adjoin equal? (list 1 2) 1 2)", '(1 2)')
})

test('lset-union — SRFI-1 worked example', () => {
  shows("(lset-union equal? (list 'a 'b 'c 'd 'e) (list 'a 'e 'i 'o 'u))",
    '(u o i a b c d e)')
  shows('(lset-union equal?)', '()')
  shows('(lset-union equal? (list 1 2))', '(1 2)')
})

test('lset-intersection keeps lst1 order — SRFI-1 worked example', () => {
  shows("(lset-intersection equal? (list 'a 'b 'c 'd 'e) (list 'a 'e 'i 'o 'u))",
    '(a e)')
  // Any empty later list empties the intersection.
  shows('(lset-intersection equal? (list 1 2 3) (list))', '()')
  // One list intersects with itself.
  shows('(lset-intersection equal? (list 1 2 3))', '(1 2 3)')
})

test('lset-difference keeps lst1 order — SRFI-1 worked example', () => {
  shows("(lset-difference equal? (list 'a 'b 'c 'd 'e) (list 'a 'e 'i 'o 'u))",
    '(b c d)')
  // Empty later lists subtract nothing.
  shows('(lset-difference equal? (list 1 2 3) (list))', '(1 2 3)')
  shows('(lset-difference equal? (list 1 2 3))', '(1 2 3)')
})

test('lset<= and lset= — SRFI-1 worked examples', () => {
  assert.equal(run("(lset<= equal? (list 'a) (list 'a 'b 'a) (list 'a 'b 'c 'c))"), true)
  assert.equal(run('(lset<= equal?)'), true)
  assert.equal(run("(lset<= equal? (list 'a))"), true)
  assert.equal(run("(lset<= equal? (list 'a 'z) (list 'a 'b))"), false)

  assert.equal(run("(lset= equal? (list 'b 'e 'a) (list 'a 'e 'b) (list 'e 'e 'b 'a))"), true)
  assert.equal(run('(lset= equal?)'), true)
  assert.equal(run("(lset= equal? (list 'a))"), true)
  assert.equal(run("(lset= equal? (list 'a 'b) (list 'a))"), false)
})

test('the lset procedures take the equality test FIRST', () => {
  // Passing lists where the predicate belongs must not silently "work".
  throwsWith('(lset-union (list 1) (list 2))', /equality predicate/)
  throwsWith('(lset-intersection (list 1) (list 2))', /equality predicate/)
  throwsWith('(lset-difference (list 1) (list 2))', /equality predicate/)
  throwsWith('(lset-adjoin (list 1) (list 2) 3)', /equality predicate/)
})

test('a custom equality predicate is honored', () => {
  // Case-insensitive set union proves `=` is really being applied.
  shows('(lset-intersection (lambda (a b) (= (modulo a 3) (modulo b 3)))'
    + ' (list 1 2 3) (list 6 7))', '(1 3)')
})

// ── SRFI-1: teaching-quality guards ──────────────────────────────────

test('a dotted pair handed to a list verb gets a sentence about lists', () => {
  for (const src of [
    '(span odd? (cons 1 2))',
    '(break odd? (cons 1 2))',
    '(take-right (cons 1 2) 1)',
    '(drop-right (cons 1 2) 1)',
    '(split-at (cons 1 2) 1)',
    '(reduce-right + 0 (cons 1 2))',
    '(append-reverse (cons 1 2) (list))',
    '(lset-union equal? (cons 1 2))',
  ]) {
    throwsWith(src, /improper \(dotted\) pair/)
    // Never a raw JS message.
    assert.throws(() => run(src), (e) => !/is not a function/.test(e.message))
  }
})

test('a non-list handed to a list verb names what it got', () => {
  throwsWith('(take-right 5 2)', /got the number 5/)
  throwsWith('(drop-right "hi" 1)', /got the string "hi"/)
})

test('over-taking from the end is a counted error, not a silent slice', () => {
  throwsWith('(take-right (list 1 2) 5)', /only 2 long/)
  throwsWith('(drop-right (list 1 2) 5)', /only 2 long/)
  throwsWith('(split-at (list 1 2) 5)', /only 2 long/)
})

// ── SRFI-13 ──────────────────────────────────────────────────────────

test('string-tokenize splits on whitespace and never yields an empty token', () => {
  shows('(string-tokenize "  hello   world foo ")', '("hello" "world" "foo")')
  shows('(string-tokenize "")', '()')
  shows('(string-tokenize "   ")', '()')
  // string-split, by contrast, is allowed to produce empty pieces.
  shows('(string-tokenize "abc123def" char-numeric?)', '("123")')
})

test('string-fold / string-fold-right walk the characters, char first', () => {
  assert.equal(run('(string-fold (lambda (c n) (+ n 1)) 0 "abcd")'), 4)
  shows('(string-fold-right cons (list) "abc")', '(#\\a #\\b #\\c)')
  shows('(string-fold cons (list) "abc")', '(#\\c #\\b #\\a)')
  assert.equal(run('(string-fold (lambda (c n) (+ n 1)) 0 "")'), 0)
  // The optional [start end] window.
  assert.equal(run('(string-fold (lambda (c n) (+ n 1)) 0 "abcdef" 2 4)'), 2)
  shows('(string-fold-right cons (list) "abcdef" 1 3)', '(#\\b #\\c)')
})

test('string-any returns the TRUE VALUE, string-every the LAST value', () => {
  assert.equal(run('(string-any char-numeric? "ab3c")'), true)
  assert.equal(run('(string-any char-numeric? "abc")'), false)
  assert.equal(run('(string-any char-numeric? "")'), false)
  // Not just #t — whatever pred produced.
  assert.equal(run('(string-any (lambda (c) (if (char-numeric? c) 42 #f)) "ab3c")'), 42)

  assert.equal(run('(string-every char-alphabetic? "abc")'), true)
  assert.equal(run('(string-every char-alphabetic? "ab3")'), false)
  // Vacuously true on the empty string.
  assert.equal(run('(string-every char-alphabetic? "")'), true)
  assert.equal(run('(string-every (lambda (c) 7) "abc")'), 7)
})

test('string-concatenate takes ONE list, not loose strings', () => {
  assert.equal(run('(string-concatenate (list "ab" "cd" "ef"))'), 'abcdef')
  assert.equal(run('(string-concatenate (list))'), '')
  throwsWith('(string-concatenate "a" "b")', /takes one list, not many strings/)
})

test('string-index-right mirrors string-index; string-skip finds the first miss', () => {
  assert.equal(run('(string-index-right "hello" #\\l)'), 3)
  assert.equal(run('(string-index "hello" #\\l)'), 2)
  assert.equal(run('(string-index-right "hello" #\\z)'), false)
  assert.equal(run('(string-index-right "hello world" char-alphabetic?)'), 10)

  assert.equal(run('(string-skip "aaab" #\\a)'), 3)
  assert.equal(run('(string-skip "aaaa" #\\a)'), false)
  assert.equal(run('(string-skip "" #\\a)'), false)
  assert.equal(run('(string-skip "  hi" char-whitespace?)'), 2)
  // The [start end] window.
  assert.equal(run('(string-index-right "abcabc" #\\a 0 4)'), 3)
})

test('a multi-character criterion is refused, not guessed at', () => {
  // Motoi has no char-sets; saying so beats inventing a meaning.
  throwsWith('(string-skip "abc" "ab")', /no char-sets/)
  throwsWith('(string-index-right "abc" "ab")', /no char-sets/)
})

// ── SRFI-125 ─────────────────────────────────────────────────────────

test('hash-table-empty? and hash-table-count', () => {
  assert.equal(run('(hash-table-empty? (make-hash-table))'), true)
  assert.equal(run('(hash-table-empty? (hash-table "a" 1))'), false)
  assert.equal(run('(hash-table-count (hash-table "a" 1 "b" 2 "c" 3) (lambda (k v) (> v 1)))'), 2)
  assert.equal(run('(hash-table-count (make-hash-table) (lambda (k v) #t))'), 0)
  // pred sees the KEY as well as the value.
  assert.equal(run('(hash-table-count (hash-table "a" 1 "b" 2) (lambda (k v) (string=? k "a")))'), 1)
})

test('hash-table-find takes the procedure FIRST and falls back to a thunk', () => {
  assert.equal(run('(hash-table-find (lambda (k v) (and (> v 1) v))'
    + ' (hash-table "a" 1 "b" 2) (lambda () #f))'), 2)
  assert.equal(run("(hash-table-find (lambda (k v) #f) (hash-table \"a\" 1) (lambda () 'none))").name, 'none')
  assert.equal(run('(hash-table-find (lambda (k v) #f) (make-hash-table) (lambda () 0))'), 0)
})

test('hash-table-map builds a NEW table and leaves the original alone', () => {
  shows('(hash-table->alist (hash-table-map (lambda (v) (* v 10)) (hash-table "a" 1 "b" 2)))',
    '(("a" 10) ("b" 20))')
  assert.equal(run('(let ((h (hash-table "a" 1)))'
    + ' (hash-table-map (lambda (v) (* v 10)) h)'
    + ' (hash-table-ref/default h "a" 0))'), 1)
})

test('hash-table-prune! REMOVES what matches (the opposite of filter)', () => {
  shows('(let ((h (hash-table "a" 1 "b" 2 "c" 3)))'
    + ' (hash-table-prune! (lambda (k v) (> v 1)) h)'
    + ' (hash-table->alist h))', '(("a" 1))')
  // Mutates in place, returns unspecified.
  assert.equal(run('(let ((h (hash-table "a" 1)))'
    + ' (hash-table-prune! (lambda (k v) #f) h) (hash-table-size h))'), 1)
})

test('hash-table-pop! returns TWO values and shrinks the table', () => {
  shows('(call-with-values (lambda () (hash-table-pop! (hash-table "x" 9))) list)',
    '("x" 9)')
  assert.equal(run('(let ((h (hash-table "x" 9 "y" 8)))'
    + ' (hash-table-pop! h) (hash-table-size h))'), 1)
  throwsWith('(hash-table-pop! (make-hash-table))', /the table is empty/)
})

test('hash-table-intern! computes once, then remembers', () => {
  assert.equal(run('(hash-table-intern! (make-hash-table) "k" (lambda () 42))'), 42)
  // Second call must NOT re-run the thunk.
  assert.equal(run('(let ((h (make-hash-table)))'
    + ' (hash-table-intern! h "k" (lambda () 42))'
    + ' (hash-table-intern! h "k" (lambda () 99)))'), 42)
  assert.equal(run('(let ((h (make-hash-table)) (calls 0))'
    + ' (hash-table-intern! h "k" (lambda () (set! calls (+ calls 1)) 1))'
    + ' (hash-table-intern! h "k" (lambda () (set! calls (+ calls 1)) 1))'
    + ' calls)'), 1)
})

test('the SRFI-125 additions name the argument order when handed the wrong thing', () => {
  throwsWith('(hash-table-count 5 (lambda (k v) #t))', /the table comes FIRST/)
  throwsWith('(hash-table-map (make-hash-table) (lambda (v) v))', /the table SECOND/)
  throwsWith('(hash-table-prune! (make-hash-table) (lambda (k v) #t))', /the table SECOND/)
})

// ── registration ─────────────────────────────────────────────────────

test('every new verb is registered in its part, not just defined', async () => {
  const srfi1 = await import('../lib/std/srfi-1.js')
  const srfi13 = await import('../lib/std/srfi-13.js')
  const srfi125 = await import('../lib/std/srfi-125.js')

  const added = {
    'SRFI-1': [srfi1, ['xcons', 'proper-list?', 'span', 'break', 'take-right',
      'drop-right', 'split-at', 'reduce-right', 'append-reverse', 'lset-adjoin',
      'lset-union', 'lset-intersection', 'lset-difference', 'lset<=', 'lset=']],
    'SRFI-13': [srfi13, ['string-tokenize', 'string-fold', 'string-fold-right',
      'string-any', 'string-every', 'string-concatenate', 'string-index-right',
      'string-skip']],
    'SRFI-125': [srfi125, ['hash-table-empty?', 'hash-table-count',
      'hash-table-find', 'hash-table-map', 'hash-table-prune!',
      'hash-table-pop!', 'hash-table-intern!']],
  }

  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })

  for (const [part, [mod, names]] of Object.entries(added)) {
    const metaNames = new Set(mod.META.map(([n]) => n))
    for (const n of names) {
      assert.ok(mod.VERBS.includes(n), `${part}: ${n} missing from VERBS`)
      assert.ok(metaNames.has(n), `${part}: ${n} missing from META`)
      assert.equal(typeof env.get(n), 'function', `${part}: ${n} does not bind`)
    }
  }
})

test('all five standard parts still pass the 5-point gate', async () => {
  const { validateStandard } = await import('../core/parts-registry.js')
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  for (const report of validateStandard(env, fuel)) {
    const failed = report.checks.filter((c) => !c.pass).map((c) => `${c.id}: ${c.detail}`)
    assert.deepEqual(failed, [], `${report.name} failed: ${failed.join(' | ')}`)
  }
})

// ── Two SRFI-1 conformance bugs found by the reference-authoring pass ──────
//
// Both were silent-wrong: the verb answered something plausible instead of
// raising, which is the failure class a learner cannot debug.

test('cons* mints a real improper pair for a non-list tail', () => {
  // SRFI-1 defines (cons* a b c) as (cons a (cons b c)), so a non-list tail
  // ends the chain as a dotted pair. This used to flatten to (1 2 3), which
  // silently turned a pair into a list and disagreed with `xcons` and
  // `append-reverse` in the very same part.
  shows('(cons* 1 2 3)', '(1 2 . 3)')
  shows('(cons* 1 2 (list 3 4))', '(1 2 3 4)')
  shows('(cons* 5)', '5')
  shows('(pair? (cons* 1 2 3))', '#t')
  shows('(list? (cons* 1 2 3))', '#f')
  // (cons* a b) must agree with (cons a b) exactly.
  shows('(equal? (cons* 1 2) (cons 1 2))', '#t')
})

test('delete-duplicates honours its optional equality argument', () => {
  // The comparator used to be ignored outright — the verb always keyed on a
  // structural hash, so a caller passing `=` got the DEFAULT answer back and
  // nothing said the argument had been dropped.
  shows('(delete-duplicates (list 1 2 1 3 2))', '(1 2 3)')
  shows(
    '(delete-duplicates (list 1 2 3 4 5 6) (lambda (a b) (= (modulo a 3) (modulo b 3))))',
    '(1 2 3)'
  )
  shows(
    '(delete-duplicates (list "a" "A" "b") (lambda (a b) (string=? (string-downcase a) (string-downcase b))))',
    '("a" "b")'
  )
  // Comparator is applied (kept, candidate) — kept element FIRST. An
  // asymmetric predicate is the only way to observe the order.
  shows('(delete-duplicates (list 1 5 2) (lambda (kept cand) (< kept cand)))', '(1)')
})
