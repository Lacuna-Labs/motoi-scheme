// tests/pairs.test.mjs — the semantics only real cons cells can have.
//
// Motoi used to spell a PROPER list as a flat JavaScript array and mint a
// `Pair` only for an improper cdr. Every assertion in this file was
// UNWRITEABLE under that representation: `(cdr x)` allocated a fresh array
// instead of handing back an interior pointer, so there was no interior to
// point at, nothing to mutate through, and no way to close a cycle.
//
// This is the gate for two things that are otherwise only claimed in comments:
//
//   1. The `RAW` set in `src/base.js` and the `_RAW` sets in the library
//      installers. A verb listed there is installed against the cells; a verb
//      NOT listed is wrapped by `seqVerb`, which converts to a JS array on the
//      way in and builds a fresh chain on the way out — destroying identity.
//      Every `eq?` assertion below fails if its verb falls out of the raw set.
//
//   2. `tests/_cells.mjs`. That helper normalizes cell spelling to arrays so
//      the several hundred pre-existing assertions keep working. It is only
//      honest if the semantics it erases are asserted SOMEWHERE. Here.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeCoreEnv } from '../core/index.js'
import { evaluate } from '../src/interp.js'
import { parse } from '../src/reader.js'
import { Pair, NIL } from '../lib/base/list.js'
import { expandProgram } from '../src/macro.js'

function run(src) {
  const fuel = { n: 1_000_000 }
  const env = makeCoreEnv({ fuel })
  let last
  for (const form of parse(src)) last = evaluate(form, env, fuel)
  return last
}

function shows(src, expected) {
  assert.equal(run(`(with-output-to-string (lambda () (write ${src})))`), expected)
}

// ── the empty list is one object ─────────────────────────────────────
//
// A learner writing their first recursive list walk leans on `(null? x)` and
// on `'()` being the same thing everywhere. Under arrays every `'()` was a
// fresh `[]`, so `(eq? '() '())` was #f — true of no other Scheme.

test("'() is a singleton", () => {
  assert.equal(run("(eq? '() '())"), true)
  assert.equal(run("(eq? '() (list))"), true)
  assert.equal(run("(eq? (cdr '(1)) '())"), true)
  assert.equal(run("(null? '())"), true)
  assert.equal(run("(pair? '())"), false)
})

// ── cdr is an interior pointer, not a copy ───────────────────────────

test('cdr returns the same object every time', () => {
  assert.equal(run("(let ((x '(1 2 3))) (eq? (cdr x) (cdr x)))"), true)
  assert.equal(run("(let ((x '(1 2 3))) (eq? (cddr x) (cdr (cdr x))))"), true)
})

test('list-tail and list-ref share the spine', () => {
  assert.equal(run("(let ((x '(1 2 3))) (eq? (list-tail x 1) (cdr x)))"), true)
  assert.equal(run("(let ((x '(1 2 3))) (eq? (list-tail x 0) x))"), true)
})

test('last-pair is an interior pointer', () => {
  assert.equal(run("(let ((x '(1 2 3))) (eq? (last-pair x) (cddr x)))"), true)
})

test('list does not copy its arguments (R7RS §6.4)', () => {
  assert.equal(run("(let ((y '(9))) (eq? (car (list y)) y))"), true)
  assert.equal(run("(let ((y '(9))) (eq? (car (cons y '())) y))"), true)
})

test('memq and assq return the tail, not a copy', () => {
  assert.equal(run("(let ((x '(1 2 3))) (eq? (memq 2 x) (cdr x)))"), true)
  assert.equal(run("(let ((a (list (cons 'k 1)))) (eq? (assq 'k a) (car a)))"), true)
})

// ── mutation through a shared tail ───────────────────────────────────
//
// `set-car!` on an interior cell had nowhere to write when `(cdr x)` was a
// fresh array: the write landed on the copy and vanished.

test('set-car! writes through an interior cell', () => {
  shows("(let ((x (list 1 2 3))) (set-car! (cdr x) 9) x)", '(1 9 3)')
})

test('set-cdr! truncates and extends in place', () => {
  shows("(let ((x (list 1 2 3))) (set-cdr! x '()) x)", '(1)')
  shows("(let ((x (list 1 2))) (set-cdr! x (list 9)) x)", '(1 9)')
  shows("(let ((x (list 1 2))) (set-cdr! x 9) x)", '(1 . 9)')
})

test('two names for one list see each others writes', () => {
  shows("(let* ((x (list 1 2 3)) (y (cdr x))) (set-car! y 9) x)", '(1 9 3)')
  shows("(let* ((x (list 1 2 3)) (y (cdr x))) (set-car! (cdr x) 9) y)", '(9 3)')
})

// ── append shares its last argument ──────────────────────────────────
//
// R7RS §6.4: append copies every argument but the last, which is shared.
// A learner meets this the first time a mutation "leaks" through an append.

test('append shares the last argument and copies the rest', () => {
  assert.equal(run("(let ((b '(3 4))) (eq? (cdr (cdr (append '(1 2) b))) b))"), true)
  // Only the LAST argument is shared. `(append a '())` therefore COPIES a —
  // its last argument is the empty list, not a. Verified against chibi.
  assert.equal(run("(let ((a '(1 2))) (eq? (append a '()) a))"), false)
  assert.equal(run("(let ((a (list 1 2))) (eq? (cdr (append a '(3))) (cdr a)))"), false)
})

// ── improper lists print and traverse correctly ──────────────────────

test('an improper tail collapses when printed', () => {
  shows("(cons 1 (cons 2 3))", '(1 2 . 3)')
  shows("(cons 1 2)", '(1 . 2)')
  shows("'(1 2 . 3)", '(1 2 . 3)')
})

test('list? rejects an improper chain that pair? accepts', () => {
  assert.equal(run("(pair? (cons 1 2))"), true)
  assert.equal(run("(list? (cons 1 2))"), false)
  assert.equal(run("(list? '(1 2 3))"), true)
  assert.equal(run("(list? '())"), true)
})

test('length refuses an improper list rather than guessing', () => {
  assert.throws(() => run("(length (cons 1 2))"), /improper/)
})

// ── circular lists terminate ─────────────────────────────────────────
//
// A cycle is CONSTRUCTIBLE now, which means every walk needs a stop. `list?`
// walks at two speeds (Floyd) so it answers rather than hanging.

test('list? terminates on a circular list', () => {
  assert.equal(run("(let ((x (list 1 2 3))) (set-cdr! (cddr x) x) (list? x))"), false)
})

test('length refuses a circular list rather than hanging', () => {
  assert.throws(
    () => run("(let ((x (list 1 2 3))) (set-cdr! (cddr x) x) (length x))"),
    /circular/,
  )
})

test('a circular ELEMENT is legal; only a circular SPINE is the mistake', () => {
  // These two were conflated. `(length x)` on a cycle is a real error — x has
  // no length. `(list x 'a)` is not: the list being BUILT is proper, and x is
  // just a value riding in it. R7RS's own `equal?` examples build exactly that
  // structure, so refusing it made a conforming program an error.
  //
  // This is also the gate on `list` and `vector` being RAW. Wrapped, both
  // convert every argument on the way in, which walks into the cycle and
  // raises about a container that was fine.
  assert.equal(
    run("(let ((x (list 1 2 3))) (set-cdr! (cddr x) x) (pair? (list x 'a)))"),
    true,
  )
  assert.equal(
    run("(let ((x (list 1 2 3))) (set-cdr! (cddr x) x) (vector? (vector x)))"),
    true,
  )
  // The element must arrive as the SAME object, not a copy — a copy would mean
  // the conversion ran and merely stopped early.
  assert.equal(
    run("(let ((x (list 1 2 3))) (set-cdr! (cddr x) x) (eq? (car (list x)) x))"),
    true,
  )
  assert.equal(
    run("(let ((x (list 1 2 3))) (set-cdr! (cddr x) x) (eq? (vector-ref (vector x) 0) x))"),
    true,
  )
})

test('write LABELS a cycle rather than refusing it', () => {
  // §6.13.3. `write` must emit datum labels for exactly the structure needed
  // to make the output finite. The label machinery was already here, but
  // `write` and `display` were still being WRAPPED in lib/base/r7rs-small.js
  // (they are raw in the other two installers), so the argument was converted
  // to a JavaScript array on the way in — an array cannot express a cycle —
  // and the conversion raised before the labeller ever ran.
  const out = (src) => run(`(with-output-to-string (lambda () ${src}))`)
  assert.equal(out("(let ((x (list 1))) (set-cdr! x x) (write x))"), '#0=(1 . #0#)')
  // write-shared labels a SUPERSET: every shared datum, not only cycles.
  // write must NOT label a merely-shared one, or the two verbs collapse.
  assert.equal(out("(let ((y (list 1 2))) (write (list y y)))"), '((1 2) (1 2))')
  assert.equal(out("(let ((y (list 1 2))) (write-shared (list y y)))"), '(#0=(1 2) #0#)')
})

test('equal? compares cyclic structure instead of walking forever', () => {
  // R7RS §6.1. The exact example from the report, which is the case that
  // caught the bug above: two cycles of DIFFERENT spine length that present
  // the same infinite sequence are `equal?`.
  shows(`(let ((x (list 'a 'b 'c 'a)) (y (list 'a 'b 'c 'a 'b 'c 'a)))
           (set-cdr! (list-tail x 2) x)
           (set-cdr! (list-tail y 5) y)
           (list (equal? x x) (equal? x y) (equal? (list x y 'a) (list y x 'b))))`,
  '(#t #t #f)')
})

// ── the representation itself ────────────────────────────────────────
//
// These reach past the printed form to the objects, because the whole point
// of the change is which objects exist.

test('a proper list is a chain of Pairs ending in NIL', () => {
  const v = run("'(1 2)")
  assert.ok(v instanceof Pair)
  assert.equal(v.car, 1)
  assert.ok(v.cdr instanceof Pair)
  assert.equal(v.cdr.car, 2)
  assert.equal(v.cdr.cdr, NIL)
  assert.equal(run("'()"), NIL)
})

test('quote hands back cells, not the evaluator AST', () => {
  // The evaluator's spine is still JS arrays (sound only because Motoi has no
  // `eval` — decision-005). Quoted data crosses at `quote` and nowhere else,
  // so a quoted list must be mutable without corrupting the program.
  assert.ok(run("'(1 2 3)") instanceof Pair)
  assert.ok(run("`(1 2 ,(+ 1 2))") instanceof Pair)
  assert.ok(run("(list 1 2)") instanceof Pair)
  assert.ok(run("((lambda args args) 1 2)") instanceof Pair)
})

test('a quoted literal is shared across evaluations of the same form', () => {
  // Two references to ONE literal are the same object; R7RS leaves mutating a
  // literal unspecified, but they must not be silently different objects.
  assert.equal(run("(let ((f (lambda () '(1 2)))) (eq? (f) (f)))"), true)
})

// ── the guards that answer for BOTH spellings ────────────────────────
//
// `isList` (lib/base/list.js) deliberately answers #t for a cell chain AND a
// JS array, because a guard has to be right on either side of the sequence
// boundary. That makes one mistake very easy and very quiet: writing
// `isList(x)` and then reaching for `x.length` / `x.map` / `x[i]`. A chain's
// `.length` is `undefined`, so `a.length !== b.length` is false, the loop
// bound is `undefined`, the loop never runs — and the function reports
// success. Every case below is a real defect that shipped in that shape.

test('equal? compares list CONTENTS, not just shape', () => {
  // `(equal? '(1 2) '(3 4 5))` answered #t. Verified against chibi.
  assert.equal(run("(equal? '(1 2) '(3 4 5))"), false)
  assert.equal(run("(equal? '(1 2) '(1 3))"), false)
  assert.equal(run("(equal? '(1 2) '(1 2 3))"), false)
  assert.equal(run("(equal? '(1 2) '(1 2))"), true)
  assert.equal(run("(equal? (cons 1 2) (cons 1 3))"), false)
  assert.equal(run("(equal? (cons 1 2) (cons 1 2))"), true)
  assert.equal(run("(equal? '() '(1))"), false)
})

test('equal? sees across the two spellings', () => {
  // A list inside a VECTOR is still an array — the `vector` verb crossed the
  // sequence boundary — while a quoted one is cells. They must compare equal.
  assert.equal(run("(equal? '#(1 (2 3)) (vector 1 (list 2 3)))"), true)
  assert.equal(run("(equal? '#(1 (2 3)) (vector 1 (list 2 4)))"), false)
})

test('member uses the same deep comparison', () => {
  shows("(member '(2) '((1) (2) (3)))", '((2) (3))')
  assert.equal(run("(member '(9) '((1) (2)))"), false)
})

test('write and display walk a chain nested in an improper pair', () => {
  // `(write (cons '(a b) 'c))` threw "v.map is not a function": the car never
  // crossed the boundary, so it was still cells when the printer got it.
  shows("(write (cons '(a b) 'c))", '((a b) . c)')
  shows("(display (cons '(1 2) 3))", '((1 2) . 3)')
  shows("(write (list '()))", '(())')
  shows("(write (list 1 '() (cons 'a 'b)))", '(1 () (a . b))')
})

// ── procedures crossing the sequence boundary keep their tags ────────

test('a parameter object survives seqVerb', () => {
  // `parameterize` and `with-input-from-string` find a parameter by a property
  // hung off the procedure. The boundary wrapper is callable but was untagged,
  // so a real parameter was reported as "not a parameter".
  shows('(display (with-input-from-string "hello" (lambda () (read-line))))', 'hello')
})

test(',\'x inside a quasiquote is unquote-of-quote, not an apostrophe typo', () => {
  // The reader rejected `'` unless the previous char was a delimiter, and the
  // other reader macros are not delimiters — so `,'five` read as a typo.
  shows("(display (let ((a 3)) `((1 2) ,a ,4 ,'five 6)))", '((1 2) 3 4 five 6)')
})

// ── the verbs whose whole meaning is the CELL ────────────────────────

test('pair-fold, pair-fold-right and pair-for-each walk real tails', () => {
  // These three hand the callback the cell, not the element. They shared a
  // `_shortest` helper that took `l.length` — `undefined` on a chain, so
  // `Math.min` was NaN, `i < NaN` was false, the loop ran zero times and each
  // verb quietly answered its own seed. Nothing threw.
  shows("(display (pair-fold-right cons '() '(a b c)))", '((a b c) (b c) (c))')
  shows("(display (let ((xs (list 1 2 3)) (l '()))"
      + "  (pair-for-each (lambda (x) (set! l (cons x l))) xs) l))",
    '((3) (2 3) (1 2 3))')
  assert.equal(run("(pair-fold (lambda (p acc) (+ acc 1)) 0 (list 1 2 3))"), 3)
})

// ── SRFI-1's linear-update verbs REUSE the caller's cells ────────────
//
// A `!` verb exists to be `filter` with the allocation taken out. Motoi bound
// every one of them to its pure twin, justified by the old array
// representation — there was no shared tail to reuse — and left the
// justification in place after cells arrived. Alfred ruled for the STRONG
// reading on 2026-08-03, so each of these is now its own implementation.
//
// The assertions below are the shape larceny's SRFI-1 suite uses: capture the
// list's cells with `(pair-fold cons '() x)` BEFORE the call, then check the
// answer's cells are `memq` among them. `eq?` alone is not enough — a verb can
// return its argument's head and still have copied everything after it.
//
// Note chibi answers #f to most of these: chibi's `filter!`, `map!`,
// `partition!`, `delete!` and friends allocate. SRFI-1 permits both readings
// and larceny's suite pins the strong one; per the conformance ladder the SRFI
// text is the authority for a SRFI verb, not another implementation.

function cellsShared(src) {
  // #t iff every cell of the answer came out of the list that went in.
  return run(`(let* ((x ${src.list}) (cells (pair-fold cons '() x)) (r ${src.call}))
                (and (equal? r '${src.expect})
                     (every (lambda (c) (memq c cells)) (pair-fold cons '() r))
                     #t))`)
}

test('take! and drop-right! truncate the caller\'s own chain', () => {
  assert.equal(
    run("(let* ((x (list 1 2 3 4 5 6)) (y (take! x 3)))"
      + "  (and (eq? x y) (eq? (cdr x) (cdr y)) (eq? (cddr x) (cddr y)) (equal? y '(1 2 3))))"),
    true)
  assert.equal(
    run("(let* ((x (list 1 2 3 4 5 6)) (y (drop-right! x 3)))"
      + "  (and (eq? x y) (eq? (cdr x) (cdr y)) (equal? y '(1 2 3))))"),
    true)
})

test('split-at! hands back the caller\'s cell as the second value', () => {
  // `split-at!` was named in `_RAW` and given a doc row but never defined, so
  // it was an unbound symbol — tested, listed, and absent.
  assert.equal(
    run("(let* ((x (list 1 2 3 4 5 6)) (y (cddr x)))"
      + "  (let-values (((a b) (split-at! x 2)))"
      + "    (and (equal? a '(1 2)) (eq? a x) (equal? b '(3 4 5 6)) (eq? b y))))"),
    true)
})

test('append! splices rather than copies, and skips empty arguments', () => {
  assert.equal(
    run("(let ((x (list 1 2)) (y (list 3 4)) (z (list 5 6)))"
      + "  (let ((r (append! x y '() z)))"
      + "    (and (equal? r '(1 2 3 4 5 6)) (eq? r x) (eq? (cddr r) y) (eq? (cddddr r) z))))"),
    true)
  // The last argument is spliced as-is, so a non-list one makes the result
  // improper — the same rule `append` follows.
  shows("(append! (list 1) 2)", '(1 . 2)')
})

test('map! writes each answer back into the cell it came from', () => {
  assert.equal(
    run("(let* ((l (list 1 2 3)) (m (map! (lambda (x) (* x x)) l)))"
      + "  (and (equal? m '(1 4 9)) (equal? l '(1 4 9)) (eq? m l)))"),
    true)
})

test('reverse! flips the cdrs in place', () => {
  assert.equal(
    run("(let* ((x (list 1 2 3)) (r (reverse! x)))"
      + "  (and (equal? r '(3 2 1))"
      + "       (every (lambda (c) (memq c (pair-fold cons '() r))) (list r (cdr r) (cddr r)))"
      + "       #t))"),
    true)
})

test('the filtering ! verbs answer cells the caller already had', () => {
  assert.equal(cellsShared({ list: "(list 0 7 8 8 43 -4)", call: '(filter! even? x)', expect: '(0 8 8 -4)' }), true)
  assert.equal(cellsShared({ list: "(list 0 7 8 8 43 -4)", call: '(remove! even? x)', expect: '(7 43)' }), true)
  assert.equal(cellsShared({ list: '(list 1 48 2 5 37)', call: '(delete! 5 x <)', expect: '(1 2 5)' }), true)
  assert.equal(cellsShared({ list: "(list 'a 'b 'a 'c 'a 'b 'c 'z)", call: '(delete-duplicates! x)', expect: '(a b c z)' }), true)
})

test('partition! splits into two lists without allocating either', () => {
  assert.equal(
    run("(let* ((x (list 'one 2 3 'four 'five 6)) (cells (pair-fold cons '() x)))"
      + "  (let-values (((a b) (partition! symbol? x)))"
      + "    (and (equal? a '(one four five)) (equal? b '(2 3 6))"
      + "         (every (lambda (c) (memq c cells)) (pair-fold cons '() a))"
      + "         (every (lambda (c) (memq c cells)) (pair-fold cons '() b))"
      + "         #t)))"),
    true)
})

test('take-while!, span! and break! cut the chain instead of copying it', () => {
  assert.equal(
    run("(let* ((x (list 2 18 3 10 22 9)) (r (take-while! even? x)))"
      + "  (and (equal? r '(2 18)) (eq? r x) (eq? (cdr r) (cdr x))))"),
    true)
  // span!'s SECOND value is the caller's cell at the cut, not a fresh tail.
  assert.equal(
    run("(let* ((x (list 2 18 3 10 22 9)) (third (cddr x)))"
      + "  (let-values (((a b) (span! even? x)))"
      + "    (and (equal? a '(2 18)) (eq? a x) (eq? b third))))"),
    true)
  assert.equal(
    run("(let* ((x (list 3 1 4 1 5 9)) (third (cddr x)))"
      + "  (let-values (((a b) (break! even? x))) (and (equal? a '(3 1)) (eq? b third))))"),
    true)
})

test('alist-delete! keeps the surviving ENTRIES, not just their contents', () => {
  // The spine is relinked; the entries themselves are never rebuilt, so an
  // entry in the answer is still the entry a copy of the alist is holding.
  assert.equal(
    run("(let* ((x (list (cons 1 #t) (cons 2 #t) (cons 7 #t) (cons 4 #t)))"
      + "       (y (list-copy x)) (r (alist-delete! 7 x)))"
      + "  (and (equal? r '((1 . #t) (2 . #t) (4 . #t)))"
      + "       (every (lambda (e) (memq e y)) r)"
      + "       #t))"),
    true)
})

// ── shortest-stop means a circular argument is legal ─────────────────

test('filter-map stops at the shortest list, so a cycle cannot hang it', () => {
  // SRFI-1 stops at the shortest argument, which makes a circular list fine as
  // long as one argument is finite. `filter-map` was a sequence verb, and
  // seqVerb converts every argument to an ARRAY before the verb runs — a walk
  // a cycle never returns from. It hit the ten-million-cell cap and reported
  // "circular list passed to a verb that expects a proper list" about an
  // expression the standard allows. It is raw now, and walks cells.
  shows("(display (filter-map (lambda (x y) (and (number? x) (* x x)))"
      + "                     '(a 1 b 3 c 7) (circular-list 1 2)))",
    '(1 9 49)')
  // Same reason: these two must ANSWER about a cycle, so they must not walk it.
  assert.equal(run('(null-list? (circular-list 1 2))'), false)
  assert.equal(run('(length+ (circular-list 1 2 3))'), false)
  assert.equal(run("(length+ '(1 2 3))"), 3)
})

// ── more of the isList trap, found in lib/std/srfi-1.js ──────────────

test('list= compares CONTENTS, the same defect equal? shipped with', () => {
  // `a.length !== b.length` on two chains is `undefined !== undefined` — false
  // — and the loop bound is `undefined` too, so it never ran and `list=`
  // answered #t for any two lists at all. Verified against chibi.
  assert.equal(run("(list= equal? '(1 2) '(1 2 3))"), false)
  assert.equal(run("(list= equal? '(1 2) '(1 3))"), false)
  assert.equal(run("(list= equal? '(1 2) '(1 2))"), true)
})

test('delete! and friends compare keys across BOTH list spellings', () => {
  // srfi-1's `_structurallyEqual` guarded with `isList` and then read
  // `a.length`/`a.every`. Two chains threw; an array against a chain compared
  // a number to `undefined` and answered "not equal" for two identical lists.
  shows("(display (delete! '(1) (list (list 1) (list 2) (list 1))))", '((2))')
  shows("(display (delete-duplicates! (list (list 1) (list 1) (list 2))))", '((1) (2))')
})

test('a pair-fold callback receives the caller\'s own cell', () => {
  // The old code took `l.slice(i)` for the tail, which COPIED — so a
  // `set-cdr!` inside the callback wrote to a throwaway. This is SRFI-1's
  // canonical `reverse!`, and it only works if the cell is the real one.
  // Note: chibi answers (1) here because its `pair-fold` does not grab the
  // cdr before calling f; SRFI-1's reference implementation does, and larceny
  // tests for the grab-ahead reading. Motoi follows SRFI-1.
  shows("(display (let* ((x (list 1 2 3)))"
      + "  (pair-fold (lambda (pair tail) (set-cdr! pair tail) pair) '() x)))",
    '(3 2 1)')
})

// ── the shortest-stop family, walked as cells (2026-08-03) ───────────

test('map/for-each/any/every/count/zip stop at the shortest, so a cycle is legal', () => {
  // These six take SEVERAL lists and stop at the shortest (SRFI-1), which is
  // the whole reason a circular argument is allowed: another argument runs out
  // first. They were sequence verbs, and seqVerb converts every argument to an
  // ARRAY before the verb runs — and a circular list has no array spelling. So
  // wrapped, they could only ever refuse an expression the standard answers.
  // Raw now; each walks its arguments through a cursor that handles both the
  // array spelling and a live cell chain.
  shows("(display (zip '(1) (circular-list 1 2)))", '((1 1))')
  assert.equal(run("(count < '(3 1 4 1) (circular-list 1 10))"), 2)
  shows("(display (map + '(3 1 4 1) (circular-list 1 0)))", '(4 1 5 1)')
  assert.equal(run("(any < '(3 1 4 1 5) (circular-list 2 7 1 8 2))"), true)
  assert.equal(run("(every < '(1 2 3) (circular-list 2 3 4))"), true)
  // for-each is the one with no return value, so the cycle has to be observed
  // through a side effect: five calls, one per element of the finite list.
  shows("(display (let ((v 1) (l '()))"
      + "  (for-each (lambda (x y) (let ((n v)) (set! v (+ v 1)) (set! l (cons n l))))"
      + "            '(0 0 0 0 0) (circular-list 1 2))"
      + "  l))",
    '(5 4 3 2 1)')
})

test('every answers the LAST value of pred, not #t, with several lists', () => {
  // SRFI-1: "the value returned by the final application of pred". Motoi
  // answers 6 for `(+ 2 4)`. Chibi answers #t here while answering 2 for the
  // one-list `(every + '(1 2))` — an inconsistency inside chibi, not a reading
  // of the SRFI. Motoi follows the SRFI text in both cases.
  assert.equal(run("(every + '(1 2))"), 2)
  assert.equal(run("(every + '(1 2) '(3 4))"), 6)
})

test('all-circular arguments are refused rather than hung on', () => {
  // With nothing finite there is no shortest list to stop at, so the walk
  // never ends. The old code let this run to the ten-million-cell cap and then
  // blamed "a circular list"; the real fault is the ARGUMENT LIST, and saying
  // so is the difference between a lesson and a stall.
  assert.throws(() => run('(map + (circular-list 1) (circular-list 2))'), /circular/)
})

// ── drop answers an interior cell ────────────────────────────────────

test('drop returns the caller\'s own cell, not a copy', () => {
  // This is the entire point of the verb: `(drop x k)` IS `(cdr (cdr ...))`.
  // As a sequence verb it received an array and `slice`d it, so the answer was
  // a fresh list that merely printed the same — `(set-car! (drop x 3) 'z)`
  // wrote to a value nobody could reach. The old array spelling could not
  // express this answer at all.
  assert.equal(run('(let ((x (list 1 2 3 4 5 6))) (eq? (cdddr x) (drop x 3)))'), true)
  assert.equal(run('(let ((x (list 1 2 3))) (eq? x (drop x 0)))'), true)
  shows("(display (drop '(1 2 3 4) 2))", '(3 4)')
})

// ── equal? terminates on circular structure ──────────────────────────

test('equal? answers about two cycles instead of running forever', () => {
  // R7RS §6.1 requires equal? to terminate "even if its arguments contain
  // cycles". It walked the spines with no cycle detection, so these hung.
  // Both spines are now walked in lockstep with a two-speed (Floyd) cursor,
  // which costs nothing extra and closes on the product of the two cycles;
  // branching structure falls back to an assumption table after a fixed visit
  // budget. The budget, not a DEPTH threshold, is what makes it terminate: a
  // structure that alternates list/vector BRANCHES about twice per level, so a
  // depth threshold of 200 is never reached before 2^100 paths are explored.
  assert.equal(run("(equal? '#1=(a b . #1#) '#2=(a b a b . #2#))"), true)
  assert.equal(run("(let ((x (list 'a 'b 'c 'a)) (y (list 'a 'b 'c 'a 'b 'c 'a)))"
    + "  (set-cdr! (list-tail x 2) x) (set-cdr! (list-tail y 5) y) (equal? x y))"), true)
  // Different periods must still come out UNEQUAL — a cycle detector that
  // returns #t whenever it meets itself would pass the two above and be wrong.
  assert.equal(run("(equal? '#1=(a b . #1#) '#2=(a c . #2#))"), false)
})

test('a circular datum survives write and read back as an equal? value', () => {
  // The vector slots held flat ARRAY SNAPSHOTS taken when the vector was
  // built, because `vector` is a sequence verb. A later `set-cdr!` mutated the
  // CELLS, which the snapshots could not see, so the label walker wrote a
  // finite well-formed picture of a value that no longer existed — and the
  // read-back really was a different structure. Both the label pass and the
  // render pass normalize to cells now, and the output matches chibi exactly.
  const mk = "(let* ((x (list 1 2 3 4 5)) (v (vector x x x)))"
    + "  (set-car! (cddr x) v) (set-cdr! (cdr (cdr (cdr x))) x)"
    + "  (vector-set! v 1 (list v)) v)"
  shows(mk, '#0=#(#1=(1 2 #0# 4 . #1#) (#0#) #1#)')
  // write and write-shared agree on this datum: every label it needs is one a
  // CYCLE forces, and `write` must emit those too (§6.13.3).
  assert.equal(run(`(with-output-to-string (lambda () (write-shared ${mk})))`),
    '#0=#(#1=(1 2 #0# 4 . #1#) (#0#) #1#)')
  // The round trip is what the equal? fix above buys: the reader rebuilds a
  // genuinely circular value, and comparing it to a freshly built one has to
  // TERMINATE before it can be right.
  assert.equal(run('(equal? (read (open-input-string'
    + ` (with-output-to-string (lambda () (write ${mk}))))) ${mk})`), true)
})

// ── isList says #t to NIL, and NIL is a frozen non-iterable ──────────

test('the c[ad]+r family blames the empty list, not JavaScript', () => {
  // The guard was `isList(x) && x.length === 0`, and on `NIL` that reads
  // `undefined === 0` — FALSE. So `'()` cleared a test written to stop exactly
  // it, reached `NIL.slice(1)`, and leaked "x.slice is not a function": a
  // JavaScript method name shown to someone who has never seen JavaScript.
  assert.throws(() => run("(cddr '())"), /cddr: expected a pair/)
  assert.throws(() => run("(caar '())"), /caar: expected a pair/)
})

test('list->string refuses a non-list instead of answering ""', () => {
  // `if (!isList(lst)) return mstr('')` — so `(list->string 5)` answered the
  // empty string, a plausible-looking value where R7RS §6.7 requires an error.
  // A wrong answer that LOOKS right is the one a learner copies down.
  assert.throws(() => run('(list->string 5)'), /list->string: expected a list/)
  shows("(list->string '())", '""')
  shows("(list->string '(#\\a #\\b))", '"ab"')
})

test('the reader builds `(1 . (2 3))` without spreading a non-array', () => {
  // The dotted-tail branch tested `isList(tail)` and then SPREAD it. `isList`
  // is #t for `NIL` and for a cell chain, and neither can be spread — `NIL` is
  // a frozen singleton with no iterator. A raw type error out of the READER is
  // the worst place for one: nothing has run yet.
  shows("'(1 . (2 3))", '(1 2 3)')
  shows("'(1 . ())", '(1)')
  shows("'(1 . (2 . (3 . ())))", '(1 2 3)')
  shows("'(1 . (2 . 3))", '(1 2 . 3)')
})

test('() inside an alist is not an entry', () => {
  // `_isEntry` was `p instanceof Pair || isList(p)`, and `isList(NIL)` is #t —
  // so `()` counted as an entry whose key was `NIL[0]`, i.e. `undefined`.
  // Nothing in Scheme is eq? to `undefined`, so the wrong reading happened to
  // give the right answer; it was one eq-implementation away from matching a
  // key it must never match. R7RS §6.4: an alist is a list of PAIRS.
  shows("(display (assq 'a '(() (a 1))))", '(a 1)')
  assert.equal(run("(assq 'z '(() (a 1)))"), false)
})

// ── syntax-rules: two identifiers can share a name and not be the same one ──
//
// These four are Al Petrofsky's tests as carried in the R7RS conformance
// suite (scratch/r7rs-conformance/larceny/base.sld). They live here rather
// than in a macro file because they are the same KIND of defect the rest of
// this file gates: a comparison that reads the cheap surface of a value
// (there, `isList` on a frozen NIL; here, the NAME of an identifier) and so
// answers questions about identity that it was never entitled to answer.
//
// Every expectation below was taken from `chibi-scheme -p`, not from the
// suite alone — the suite's own comment on the third case predicted chibi
// would disagree, and it no longer does.

function expandRun(src, fuel = 200000) {
  const env = makeCoreEnv({ fuel: { n: fuel } })
  const { forms } = expandProgram(parse(src), { fuel: { n: fuel } })
  const fuelBox = { n: fuel }
  let last
  for (const f of forms) last = evaluate(f, env, fuelBox)
  return last
}

function expandShows(src, expected) {
  assert.equal(
    expandRun(`(with-output-to-string (lambda () (write ${src})))`),
    expected,
  )
}

test('a lexically bound `...` is a variable, so the transformer has no ellipsis', () => {
  // `...` was recognised by NAME, so binding it as an ordinary variable did
  // not stop `syntax-rules` from reading it as an ellipsis. The first form
  // was then rejected outright ("pattern var 'y' used without (...)") and the
  // second silently DROPPED the trailing `...` from the template — a shorter
  // list than the program asked for, with no error to say so.
  expandShows(`
    (let ((... 19))
      (define-syntax bar (syntax-rules () ((bar x y ...) (list y x ...))))
      (bar 1 2 3))`, '(2 1 3)')
  expandShows(`
    (let ((... 19))
      (define-syntax bar (syntax-rules () ((bar x y) (list y x ...))))
      (bar 1 2))`, '(2 1 19)')
})

test('a pattern literal is matched by binding, not by spelling', () => {
  // The inner transformer's literal `k` is written by the outer macro's
  // template; the `x` beside it is replaced by the USE SITE's `k`. Comparing
  // by name made the second `k` a literal too, so the first clause could only
  // match the identifier `k`, `(n z)` fell through, and the wrong clause won.
  // R7RS leaves the outcome open; chibi answers bound-identifier=?.
  assert.equal(expandRun(`
    (let-syntax ((m (syntax-rules ()
                      ((m x) (let-syntax ((n (syntax-rules (k)
                                               ((n x) 'bound-identifier=?)
                                               ((n y) 'free-identifier=?))))
                               (n z))))))
      (m k))`).name, 'bound-identifier=?')
})

test('a macro can hand its own ellipsis to the macro it writes', () => {
  // `m` spells its ellipsis `:::`, so the `...` in its template is ordinary
  // text, while `dots` carries in the use site's `...`. The generated
  // `syntax-rules` names one as its ellipsis and the other as a literal — the
  // whole form only has a reading if those two are DIFFERENT identifiers.
  // Reading them as one put the ellipsis in its own literal list, which
  // disables it, and no clause could match.
  assert.equal(expandRun(`
    (let-syntax ((m (syntax-rules ::: ()
                      ((m dots)
                       (let-syntax ((n (syntax-rules ... (dots)
                                         ((n dots ...) 1))))
                         (n dots))))))
      (m ...))`), 1)
})
