// tests/srfi-133.test.mjs — the SRFI-133 vector part.
//
// SRFI-133 was adopted 2026-08-03 as the sixth standard part. These are the
// cases where getting it wrong produces a plausible answer rather than an
// error, so a smoke test that only checks the verb EXISTS would pass on a
// broken implementation.

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

// Every assertion goes through `display`, so what is checked is what a
// learner would actually SEE — not a JS-side value that may print differently.
const shows = (src, want) =>
  assert.equal(run(`(with-output-to-string (lambda () ${src}))`), want)

test('vector-fold takes the STATE FIRST, unlike SRFI-1 fold', () => {
  // The single easiest way to get this part wrong. SRFI-1's `fold` calls
  // (kons elem acc); SRFI-133's `vector-fold` calls (kons acc elem). Both
  // live in this engine. With a commutative kons like + the two orders are
  // indistinguishable, so the test has to use a kons that is not.
  shows("(display (vector-fold (lambda (s x) (cons x s)) '() '#(1 2 3)))", '(3 2 1)')
  shows("(display (fold cons '() '(1 2 3)))", '(3 2 1)')
  // cons in the other order would answer ((( () . 1) . 2) . 3) — a dotted
  // structure, not a list, which is the visible tell.
})

test('vector-fold-right walks right to left, state still first', () => {
  shows("(display (vector-fold-right (lambda (s x) (cons x s)) '() '#(1 2 3)))", '(1 2 3)')
})

test('vector= is vacuously true below two vectors', () => {
  // SRFI-133 says #t for zero or one vector — there is no pair to disagree.
  // An implementation that folds pairwise from an unchecked first element
  // crashes here instead.
  shows('(display (vector= eq?))', '#t')
  shows("(display (vector= eq? '#(a)))", '#t')
  shows("(display (vector= eq? '#(a b c d) '#(a b c d)))", '#t')
  shows("(display (vector= eq? '#(a b) '#(a b c)))", '#f')
  // Nested vectors: the element test is what decides, not vector identity.
  shows("(display (vector= equal? (vector (vector 'a)) (vector (vector 'a))))", '#t')
  shows("(display (vector= eq? (vector (vector 'a)) (vector (vector 'a))))", '#f')
})

test('vector-unfold-right fills from the last index down', () => {
  // Both unfolds produce #(0 1 2 3) for an index-only f, so a direction bug
  // is invisible unless the SEED is threaded — that is what distinguishes
  // them. Here the seed counts how many elements have been built so far.
  shows('(display (vector-unfold (lambda (i s) (values s (+ s 1))) 4 0))', '#(0 1 2 3)')
  shows('(display (vector-unfold-right (lambda (i s) (values s (+ s 1))) 4 0))', '#(3 2 1 0)')
})

test('vector-index-right and vector-skip are not the same walk', () => {
  // `skip` is `index` with the predicate inverted. Both answer an INDEX or
  // #f, and index 0 is falsy in many host languages — so a verb that returns
  // a bare JS 0 must still print 0, not #f.
  shows("(display (vector-index even? '#(1 3 4)))", '2')
  shows("(display (vector-index-right even? '#(2 3 4)))", '2')
  shows("(display (vector-skip even? '#(2 4 5)))", '2')
  shows("(display (vector-skip-right even? '#(1 2 4)))", '0')
  shows("(display (vector-index even? '#(1 3 5)))", '#f')
})

test('vector-any answers the VALUE, vector-every the LAST value', () => {
  // Not #t. A predicate that produces something useful must have it
  // preserved — this is the same contract SRFI-1's `any`/`every` carry.
  shows("(display (vector-any (lambda (x) (and (even? x) (* x 10))) '#(1 2 3)))", '20')
  shows("(display (vector-every (lambda (x) (* x 10)) '#(1 2)))", '20')
  shows("(display (vector-every even? '#(1 2)))", '#f')
})

test('vector-reverse-copy! takes its source slice before writing', () => {
  // Overlapping ranges in ONE vector. A naive loop that reads and writes as
  // it goes smears the first element across the range instead of reversing.
  shows('(display (let ((v (vector 1 2 3 4 5)))'
      + '  (vector-reverse-copy! v 0 v 0 3) v))', '#(3 2 1 4 5)')
})

test('vector-cumulate keeps the running states, not just the last', () => {
  shows("(display (vector-cumulate + 0 '#(1 2 3)))", '#(1 3 6)')
})

test('vector-concatenate takes a LIST, vector-append takes arguments', () => {
  // Handing vector-append a list of vectors, or vector-concatenate loose
  // vectors, is the mistake this pair invites. Both must be errors, not a
  // quiet wrong answer.
  shows("(display (vector-concatenate (list '#(1) '#(2 3))))", '#(1 2 3)')
  assert.throws(() => run("(vector-concatenate '#(1) '#(2 3))"))
})

test('vector-append-subvectors rejects a partial group', () => {
  shows("(display (vector-append-subvectors '#(1 2 3) 0 2 '#(4 5) 1 2))", '#(1 2 5)')
  assert.throws(() => run("(vector-append-subvectors '#(1 2 3) 0)"))
})

test('vector-map! writes back into the first vector', () => {
  shows('(display (let ((v (vector 1 2 3)))'
      + '  (vector-map! (lambda (x) (* x 2)) v) v))', '#(2 4 6)')
  // Stops at the shortest — the tail of the longer vector keeps its values
  // rather than being cleared to unspecified.
  shows("(display (let ((v (vector 1 2 3)))"
      + "  (vector-map! + v '#(10 20)) v))", '#(11 22 3)')
})

test('vector-partition returns the regrouped vector AND the split index', () => {
  shows("(display (call-with-values (lambda () (vector-partition even? '#(1 2 3 4)))"
      + '                            (lambda (v n) (list v n))))', '(#(2 4 1 3) 2)')
})

test('vector-binary-search answers #f when absent, and index 0 when first', () => {
  shows("(display (vector-binary-search '#(1 3 5 7) 1 -))", '0')
  shows("(display (vector-binary-search '#(1 3 5 7) 7 -))", '3')
  shows("(display (vector-binary-search '#(1 3 5 7) 4 -))", '#f')
})

test('the list/vector conversions cross the cell boundary correctly', () => {
  // These two are the only SRFI-133 verbs that touch lists. A list arrives
  // as a JavaScript array and a returned array leaves as a real cons chain;
  // getting that backwards prints a vector where a list belongs.
  shows("(display (reverse-vector->list '#(1 2 3)))", '(3 2 1)')
  shows("(display (reverse-list->vector '(1 2 3)))", '#(3 2 1)')
  shows("(display (pair? (reverse-vector->list '#(1 2 3))))", '#t')
})

test('an out-of-range index is an error, not a grown vector', () => {
  // `| 0` truncates floats and lets negatives through to JS slice, where a
  // negative means "from the end" — a reading SRFI-133 does not have.
  assert.throws(() => run('(vector-swap! (vector 1 2) 0 9)'))
  assert.throws(() => run('(vector-swap! (vector 1 2) 0 -1)'))
  assert.throws(() => run("(vector-reverse-copy '#(1 2 3) 0 9)"))
})
