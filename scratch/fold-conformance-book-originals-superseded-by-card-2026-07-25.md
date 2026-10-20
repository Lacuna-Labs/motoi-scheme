# Broken originals — book fold-family conformance sweep (2026-07-25)

Authentic broken artifacts, preserved **before** the conformance fix per the
keep-broken-lane doctrine. Each snippet below is the exact code that lived in a
book on 2026-07-24, using an EXCLUDED fold name (`fold-left` / `foldl` / `foldr`)
that is unbound in Motoi's standard (R7RS-small + SRFI parts; no R6RS, no Racket).
Kept as SFT teaching signal: these are the shapes a programmer trained on R6RS or
Racket produces by muscle memory. The fix in each case is SRFI-1 `fold` (element-
first `(kons elem acc)`) or `fold-right`.

The live books were conformed to `fold`/`fold-right`; these originals survive here.

---

## 1. book-of-music/ch02-language — the worst case: teaches the excluded name AS the fold

The chapter DEFINED `foldl` locally (acc-first), marked it `BUILD: runnable` so it
ran green, and framed it in prose as "**Fold** (also called **reduce**)". A reader
learns the excluded name, the acc-first order, AND a wrong synonym in one blow.

BROKEN (ran, but taught the wrong thing):
```scheme
(define foldl
  (lambda (fn init lst)
    (if (null? lst)
        init
        (foldl fn (fn init (car lst)) (cdr lst)))))     ;; acc-first: (fn init elem)

(define sum (foldl + 0 (list 1 2 3 4)))                 ;; 10
(define product (foldl * 1 (list 2 3 5)))               ;; 30
```
Prose: "Here is a left fold: … **Fold** (also called **reduce**) …"

WHY BROKEN: `foldl` is a Racket name; the local def is acc-first (R6RS `fold-left`
order). Motoi's `fold` is SRFI-1, element-first, and built in — no local def needed.
And `reduce` is NOT a synonym for `fold`: SRFI-1 `reduce` ignores its seed for a
non-empty list; `fold` always folds the seed in.

FIX: use the built-in `(fold + 0 (list 1 2 3 4))` / `(fold * 1 (list 2 3 5))`,
drop the local def, drop the "also called reduce" framing.

---

## 2. book-of-challenges/ch01-recursion-warmups — fold-left acc-first in solution code (×3)

BROKEN:
```scheme
;; revenue-by-channel
(fold-left
  (lambda (acc-map ch) ...)      ;; acc FIRST
  acc channels)

;; platform order totals (twice)
(fold-left (lambda (acc order)
             (let ((total (cdr (assoc 'total order))))
               (if total (+ acc total) acc)))
           0 orders)
```
WHY BROKEN: `fold-left` unbound (R6RS). Lambdas are acc-first.
FIX: `fold` with element-first lambdas — swap params to `(ch acc-map)` / `(order acc)`.

---

## 3. book-of-challenges/ch04-list-surgery — the self-aware shim

The chapter KNEW the name was non-standard and shipped a local shim + a note:
```scheme
(define (group-by-fold key-fn xs)
  (let ((alist (foldr (lambda (item acc) ...) '() xs)))
    ...))

;; Note: many Schemes call right fold 'foldr'. In the runtime's core, assume:
(define (foldr fn init xs)
  (if (null? xs) init (fn (car xs) (foldr fn init (cdr xs)))))
```
WHY BROKEN: the shim is exactly SRFI-1 `fold-right` (element-first) under a
non-standard name. Naming it `foldr` teaches the Racket name as if it were ours.
FIX: use built-in `fold-right`, delete the shim + note.

---

## 4. book-of-challenges/ch12-composition-and-macros — the richest case: internally inconsistent, never ran

The chapter used `foldl`/`foldr` 15× with NO local definition (unbound → the whole
chapter's runnable blocks failed), AND mixed two incompatible fold conventions:

BROKEN — pipe assumed acc-first, maybe-pipe assumed element-first, in the same file:
```scheme
(define (pipe . fns) (lambda (x) (foldl (lambda (acc f) (f acc)) x fns)))   ;; acc-first
(define (maybe-pipe . fns) (lambda (x) (foldl maybe-apply x fns)))          ;; needs elem-first
```

BROKEN — transducers: two mutually incompatible mental models. `compose-transducers`
eagerly folded transducers into a reducer, while `transduce` treated its arg as a
transducer and called `(xf reducer)`. Passing raw `cons` as the reducer with the
`(reducer acc (f x))` convention produced nested junk. It never produced `(4 16)`.
```scheme
(define (mapping f)
  (lambda (reducer) (lambda (acc x) (reducer acc (f x)))))     ;; acc-first reducer
(define (compose-transducers . xfs)
  (foldl (lambda (acc xf) (xf acc)) (lambda (acc x) (cons x acc)) (reverse xfs)))
(define (transduce xf reducer init lst)
  (foldl (xf reducer) init lst))                                ;; xf already a reducer → "not a function"
```

WHY BROKEN: (a) `foldl`/`foldr` unbound; (b) acc-first vs element-first mixed within
one chapter; (c) `compose-transducers` returns a reducer but `transduce` expects a
transducer. Classic fold-argument-order confusion compounded across an abstraction.

FIX (now in the live book): SRFI-1 `fold`/`fold-right` element-first throughout;
reducers use `(reducer element acc)`; `compose-transducers` returns a real
transducer via `fold-right`; `transduce` applies `(xf reducer)`. Verified → `(4 16)`.

---

## 5. book-of-challenges/ch16-the-summit — Racket `foldl` ×14 (elem-first, wrong name only)

BROKEN: 14 uses of `foldl`, all element-first `(lambda (elem acc) ...)` — e.g.
`(foldl (lambda (id acc) ...) '() ids)`, `(foldl + 0 scores)`, `(foldl reducer '() events)`.
WHY BROKEN: `foldl` is a Racket name, unbound in Motoi. But the ARG ORDER already
matches SRFI-1 (Racket `foldl` is elem-first like `fold`).
FIX: pure rename `foldl` → `fold`. No param swap. This is the "different name, same
order" corner of the trap — the least dangerous, because once bound it behaves right.

## 6. book-of-animation/ch11-flocking — R6RS `fold-left` ×1 (acc-first)

BROKEN: `(fold-left (lambda (acc obs) ...) '(0 0) obstacles)` — accumulating a 2-vector
flee-force over obstacles, acc-first.
WHY BROKEN: `fold-left` unbound (R6RS); lambda acc-first.
FIX: `(fold (lambda (obs acc) ...) '(0 0) obstacles)` — swap params to element-first.
Accumulation is vector-sum (order-independent), so only the name+order needed fixing.

## 7. book-of-cs-curriculum/04-trees — R6RS `fold-left` ×1 over a bare verb (acc-first)

BROKEN: `(fold-left bst-insert '() '(5 3 8 1 4 7 9))`. `bst-insert` is `(n v)` —
tree-first, i.e. acc-first, matching `fold-left`'s `(kons acc elem)`.
WHY BROKEN: `fold-left` unbound. And a blind rename to `fold` would pass `(v tree)` to
a `(tree v)` verb → args reversed → wrong tree. This is the case a find-replace breaks.
FIX: wrap to restore the verb's order under element-first fold:
`(fold (lambda (v tree) (bst-insert tree v)) '() '(5 3 8 1 4 7 9))`. Verified → in-order `(1 3 4 5 7 8 9)`.

## 8. book-of-logic/13-non-monotonic-and-default-logic — R6RS `fold-left` ×1 + metadata leak

BROKEN: `(fold-left (lambda (acc d) ...) facts defaults)` in `add-fireable-defaults`
(acc-first), PLUS `"fold-left"` listed in the chapter's `:verbs-used` metadata.
WHY BROKEN: `fold-left` unbound; lambda acc-first; metadata advertised the excluded name.
FIX: `(fold (lambda (d acc) ...) facts defaults)` — swap params. SRFI-1 `fold` is a LEFT
fold (same left-to-right traversal as `fold-left`), so the fixpoint semantics are
preserved; only kons arg order flips. Verified → `(has-feathers flies bird)`. Also
corrected `:verbs-used` to `"fold"`.

---

## Canonical home

The authoritative teaching for this trap already lives in the reference, not here:
`scheme/reference/broken-examples/fold-family.slatl` — the `:broken-code` / `:why` /
`:fix-code` / `:lesson` card comparing R5RS, R6RS, Racket, and SRFI-1. This `_status`
file is only the per-book **sweep provenance** (which chapters were caught, 2026-07-25):
book-of-music/ch02, book-of-challenges/{ch01, ch04, ch12, ch16},
book-of-animation/ch11, book-of-cs-curriculum/04-trees, book-of-logic/13.

---

## The lesson (one line)

The fold family is the single most common cross-standard trap: R6RS `fold-left`
(acc-first), Racket `foldl` (elem-first, different name), SRFI-1 `fold` (elem-first,
Motoi's standard). Muscle memory from another Scheme silently produces unbound
symbols or reversed/garbled results. Teach `fold`/`fold-right`; route the rest through
broken-examples. See also `scheme/reference/broken-examples/fold-family.slatl`.
