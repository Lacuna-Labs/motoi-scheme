---
slug: sakura-scheme-1.0-ref
title: Sakura Scheme — Reference
category: engineering
canonical: true
version: 1.0
last-reviewed: 2026-07-11
covers-through: 2026-07-11
owner: Zain
codename: sakura-scheme-ref
supersedes:
  - curator/docs/SAKURA-SCHEME-1.0-REFERENCE.md (2026-07-10 mirror)
  - doc-expansion-staging/scheme-ref-metaverbs.md (meta-verbs folded — §META)
  - docs/SCHEME-ERROR-TAXONOMY-2026-07-05.md (folded as APPENDIX ERROR-TAXONOMY)
  - docs/primitive-coverage-2026-07-10.md (folded as APPENDIX PRIM-COVERAGE)
appendices:
  - SAKURA-SCHEME-1.0.REF.appendix-row1.md (Row 1: Name/Signature)
  - SAKURA-SCHEME-1.0.REF.appendix-row2.md (Row 2: Intent)
  - SAKURA-SCHEME-1.0.REF.appendix-row3.md (Row 3: Examples)
  - SAKURA-SCHEME-1.0.REF.appendix-row4.md (Row 4: Proof / Essence)
  - SAKURA-SCHEME-1.0.REF.appendix-row5.md (Row 5: Composition / Emergence)
cross-references:
  - THE-BOOK (verb-help long-form) lives at ~/code/sakura-preservation-2026-07-11/THE-BOOK/ — the reader-view canon. This REF is the SHORT-FORM 3-tier N/I/E language reference; THE-BOOK carries the long-form Row 4/5. Both survive per Alfred decision 2026-07-11.
---

# Sakura Scheme 1.0 — Reference Manual

<!-- covers-through: 2026-07-11 -->

> **Canonical engineering doc #3 of 12** per `docs-consolidation-plan-2026-07-11.md`. Previously #3 of 8 per
> [`CANONICAL-DOCS-FRAMEWORK-2026-06-27.md`](CANONICAL-DOCS-FRAMEWORK-2026-06-27.md).
> Voice: HelloSurface gold standard. Exempt from the
> `<NAME>-<VERSION>-ENGINEERING.md` naming pattern because it is a
> Reference (not Engineering) doc; named per its companion
> [`ENGINEERING.md`](ENGINEERING.md).

> **🔒 ARCH LOCK 2026-06-22** — verb-by-verb additions for the new arch
> (~150 ASK verbs from Lane A §93.4 + FRP time grammar §95 MOVE 3 +
> unified memory §95 MOVE 4) land here as those MOVES ship. See
> `HELLO-SURFACE-1.0-ENGINEERING.md` §95 for the methodology lock and
> execution order.
>
> Lane B · Soo-Jin · 2026-06-15
>
> The canonical, alphabetised, per-verb reference. Every primitive, macro,
> reserved form, and atom in Sakura Scheme. Each entry carries the
> implementation backing (file:line), the verb's honest wired/partial/no
> state, three graded examples (novice / intermediate / expert), and
> source citations or honest `;; generated example` flags.
>
> A generated example is still real — it uses our sprite roster, real
> cards, real verbs, and would lint clean under `cartLint.js` and run
> against the runtime installed in `curator-web/src/scheme/index.js`.
>
> **SRE pass — 2026-06-22 — line-citation drift advisory.** Many `Backing:
> file:Line-Line` citations in §1 (reserved forms) were authored against
> `curator-web/src/scheme/interp.js` at the 2026-06-15 head; the file has
> since drifted by ~30 lines (cases moved + comments inserted). The
> CONTENT remains accurate — the switch in `evalStep` still contains
> `case 'if'`, `case 'define'`, `case 'lambda'`, `case 'begin'`, `case
> 'cond'`, `case 'case'`, `case 'and'`, etc., in that order — but the
> exact line numbers are NOT current. Authoritative at HEAD (2026-06-22):
> `case 'if': 292` · `'define': 297` · `'lambda': 313` · `'begin': 329`
> · `'and': 385` · `'cond': 409` · `'case': 423`. The structural
> citations are still load-bearing; reviewers should `grep -n "case '<name>'"
> curator-web/src/scheme/interp.js` to confirm before quoting a line
> number externally. Future re-cuts: bump line numbers in this doc with
> every interp.js edit (the LLM training corpus must not memorize stale
> line numbers).
>
> **Citation format used in this doc:** `` `curator-web/src/scheme/<file>:Line[-Line]` `` (back-tick-quoted, hyphen-range for multi-line spans). The SRE pass at the HelloSurface doc adopted `` `file:Line · functionName()` `` (dot-separator) — both forms are honored; the dot-separator is preferred for new entries.

---

## Navigation

1. [Reserved forms & special syntax](#1-reserved-forms--special-syntax)
2. [List + sequence primitives](#2-list--sequence-primitives)
3. [Math + numeric](#3-math--numeric)
4. [Cart spine](#4-cart-spine)
5. [Cortex verbs](#5-cortex-verbs)
6. [Marketplace verbs](#6-marketplace-verbs)
7. [Paint + visual primitives](#7-paint--visual-primitives)
8. [Sprite + body verbs](#8-sprite--body-verbs)
9. [Note + music verbs](#9-note--music-verbs)
10. [FX + animation atoms](#10-fx--animation-atoms)
11. [Card surface verbs](#11-card-surface-verbs)
12. [Sakura on-device verbs](#12-sakura-on-device-verbs)
13. [New-arch placeholders (§95 MOVES 3 / 4 / 5)](#13-new-arch-placeholders)
14. [Approval](#approval)

---

## 1. Reserved forms & special syntax

These are handled directly by the evaluator's `evalStep` switch. They
are NOT functions — they cannot be redefined, passed as values, or
captured. They are the irreducible spine of the language.

**Backing for all entries in §1:** `curator-web/src/scheme/interp.js:250-410`.
**Side effects:** none on the form itself; the body it evaluates may
have effects.
**Wired:** yes (all 15, hand-written tail-call-eliminated cases).

### `(and expr1 expr2 ...)`

**Returns:** the last truthy value, or `#f` if any is false. Last
position is tail.
**Backing:** `curator-web/src/scheme/interp.js:354-361`
**Side effects:** evaluates left-to-right and short-circuits.
**Wired:** yes

Short-circuit conjunction. Stops at the first `#f`; otherwise returns
the value of the final expression. In tail position, the last conjunct
is itself in tail position.

#### Novice
```scheme
;; gate on a precondition
(and (pair? topics) (not (null? topics)))
;; → #t when both hold
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks` (predicate idiom — generated example)*

#### Intermediate
```scheme
;; only proceed if shop is connected AND has listings
(if (and (ctx-get 'shop-connected ctx)
         (pair? (ctx-result ctx)))
    (next 'render ctx)
    (escalate 'shop-not-connected null))
```
*;; generated example*

#### Expert
```scheme
;; compose three gates; the deepest pair? is the determining tail
(when (and (eq? (ctx-get 'state ctx) 'ready)
           (not (null? rows))
           (pair? (assq ':price_ladder_suggestion rows)))
  (next 'render (ctx-set 'finding rows ctx)))
```
*;; generated example*

---

### `(begin expr1 expr2 ... lastExpr)`

**Returns:** the value of the last expression.
**Backing:** `curator-web/src/scheme/interp.js:298-303`
**Side effects:** evaluates each expression in order; last is tail.
**Wired:** yes

Sequential composition. Earlier expressions are evaluated for side
effects; the result of the last is returned. The lint star expects most
multi-effect bodies to live inside `(begin …)` or an implicit body
position.

#### Novice
```scheme
;; two effects, then done
(begin
  (table rows '(listing-id title metric value))
  (done))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:36-38`*

#### Intermediate
```scheme
;; in a cart render — emit chip, queue envelope, end
(begin
  (card-emit 'engine 'the-living-business-plan-ready (length finding))
  (envelope-queue (list 'the-living-business-plan ':finding finding))
  (done))
```
*Source: adapted from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:314-321`*

#### Expert
```scheme
;; tail position — the trailing (done) is the cart's terminal descriptor
(let ((finding (ctx-get 'finding ctx)))
  (begin
    (paint-arrow 'price-ladder-card ':anchors anchors ':glow 'warm-amber)
    (envelope-queue (list 'pink-price-ladder-suggest ':finding finding))
    (done)))
```
*Source: condensed from `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:277-289`*

---

### `(case key (datums body...) ... (else body...))`

**Returns:** the value of the chosen clause's last form.
**Backing:** `curator-web/src/scheme/interp.js:392-407`
**Side effects:** evaluates the key once; matches by `===` on numbers
and by symbol name on Syms.
**Wired:** yes

Discrete dispatch on a key. Each clause head is a list of possible
matches; `else` catches the rest. Tail position is the last form of
the chosen clause.

#### Novice
```scheme
;; route a Loam state symbol to a path
(case state
  ((vacation paused) (escalate 'state-blocks-spend state))
  ((no-new-data)     (escalate 'state-blocks-spend 'no-new-data))
  (else              (next 'fetch-actuals ctx)))
```
*;; generated example*

#### Intermediate
```scheme
;; classify a marketplace response
(case status
  ((connected)        (next 'fetch ctx))
  ((not-connected)    (escalate 'service-not-connected null))
  ((quota-exhausted)  (escalate 'answers-quota null))
  (else               (escalate 'service-not-yet-wired null)))
```
*;; generated example, modelled on `curator-web/src/scheme/carts/personal/daily-news-brief.sks:118-125`*

#### Expert
```scheme
;; tier branch into three sub-state-machines
(define (route ctx)
  (case (ctx-get 'tier ctx)
    ((free imagine)  (next 'render-cheap ctx))
    ((dream)         (next 'render-mid ctx))
    ((magic)         (next 'render-full ctx))
    (else            (escalate 'tier-unknown null))))
```
*;; generated example*

---

### `(cond (test body...) ... (else body...))`

**Returns:** the value of the chosen clause's last form.
**Backing:** `curator-web/src/scheme/interp.js:378-391`
**Side effects:** evaluates tests left-to-right; first truthy wins.
**Wired:** yes

Multi-way branching. The bread-and-butter of every cart's state-check
function. Tail position is the last form of the chosen clause.

#### Novice
```scheme
;; null = no-data; rate-limited = back off; else proceed
(cond
  ((null? rows)              (escalate 'no-data null))
  ((eq? rows 'rate-limited)  (after 30 'fetch ctx))
  (else                      (next 'render ctx)))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:33-37`*

#### Intermediate
```scheme
;; classify a Loam state result
(cond
  ((null? state)                       (escalate 'cortex-not-ready null))
  ((eq? (assq 'vacation state) #t)     (escalate 'state-blocks-spend 'vacation))
  ((eq? (assq 'paused state) #t)       (escalate 'state-blocks-spend 'paused))
  ((eq? (assq 'no-new-data state) #t)  (escalate 'state-blocks-spend 'no-new-data))
  (else                                (next 'check-cortex-cache (ctx-set 'state state ctx))))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:117-128`*

#### Expert
```scheme
;; closed-set finding validator — every tag explicit, no catch-all
(cond
  ((null? finding)
     (escalate 'service-not-yet-wired
               '(:status not-wired :reason "lacuna-session-returned-null")))
  ((eq? finding 'rate-limited)        (after 120 'lacuna-ask ctx))
  ((eq? finding 'quota-exhausted)
     (escalate 'answers-empty
               '(:status not-wired :reason "lacuna-quota-exhausted")))
  ((eq? finding 'cloud-tier-required)
     (escalate 'service-not-connected
               '(:status not-wired :reason "deep-reasoning-requires-magic-tier")))
  ((not (pair? finding))
     (escalate 'sakura-garbled
               '(:status not-wired :reason "lacuna-returned-non-list")))
  (else (next 'remember (ctx-set 'finding finding ctx))))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:265-283`*

---

### `(define name expr)` and `(define (name args...) body...)`

**Returns:** undefined (effect: binds the name in the current Env).
**Backing:** `curator-web/src/scheme/interp.js:266-278`
**Side effects:** mutates the env's variable map.
**Wired:** yes

Two shapes: value binding `(define x 7)` or procedure shorthand
`(define (f a b) body)`. The procedure form supports dotted-tail
rest params: `(define (f a b . rest) …)`.

#### Novice
```scheme
;; the cart's entry state — every cart has this
(define (start ctx)
  (next 'fetch ctx))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:22-26`*

#### Intermediate
```scheme
;; helper that wraps a Cortex window key
(define (window-key topic) (list ':topic topic ':window 'now))

(define (start ctx)
  (act 'cortex/recall (list (window-key 'living-plan-checkpoint)) 'check-prior))
```
*;; generated example*

#### Expert
```scheme
;; mutually recursive state functions with closed switching
(define (fetch ctx)
  (act 'etsy/receipts (list 'this-week) 'check-actuals))

(define (check-actuals ctx)
  (let ((receipts (ctx-result ctx)))
    (cond
      ((null? receipts)           (escalate 'actuals-unavailable null))
      ((eq? receipts 'rate-limited) (after 60 'fetch ctx))
      (else (next 'fetch-ledger (ctx-set 'receipts receipts ctx))))))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:157-178`*

---

### `(if test then else)`

**Returns:** `then` if test is not `#f`, else `else` (or undefined).
**Backing:** `curator-web/src/scheme/interp.js:261-265`
**Side effects:** evaluates test eagerly; chosen branch in tail position.
**Wired:** yes

Two- or three-arm conditional. Anything but `#f` is true (R7RS).
Prefer `cond` for more than two arms; lint reads bare `if` as fine
for binary gates.

#### Novice
```scheme
(if (null? rows)
    (escalate 'no-data null)
    (next 'render ctx))
```
*;; generated example*

#### Intermediate
```scheme
;; cache hit shortcuts; miss goes to fetch
(define (check-today ctx)
  (let ((cached (ctx-result ctx)))
    (if (null? cached)
        (next 'recall-topics ctx)
        (next 'render-cached (ctx-set 'cached cached ctx)))))
```
*Source: adapted from `curator-web/src/scheme/carts/personal/daily-news-brief.sks:82-87`*

#### Expert
```scheme
;; nested if as guard chain (cond is usually clearer — kept here for an honest example)
(if (eq? (ctx-get 'tier ctx) 'magic)
    (if (>= (length deltas) 12)
        (next 'assemble-quarter-memo ctx)
        (next 'accrue-week ctx))
    (escalate 'tier-not-permitted null))
```
*;; generated example*

---

### `(lambda (params...) body...)`

**Returns:** a Closure (a callable Scheme value).
**Backing:** `curator-web/src/scheme/interp.js:282-297`
**Side effects:** captures the current env by reference.
**Wired:** yes

Anonymous procedure. Supports fixed-arity `(lambda (a b) …)`, full
variadic `(lambda args …)`, and dotted-tail `(lambda (a . rest) …)`.
**Cart lint forbids inline lambdas as on-result arguments to `act`** —
the on-result must be a quoted symbol so the cart is replayable.

#### Novice
```scheme
;; map a name out of a row list
(map (lambda (row) (assq 'title row))
     rows)
```
*;; generated example*

#### Intermediate
```scheme
;; fold receipts into a revenue sum
(reduce (lambda (acc r) (+ acc (assq 'amount r)))
        0
        receipts)
```
*;; generated example*

#### Expert
```scheme
;; closure over local state — variadic accumulator
(let ((seen '()))
  (filter (lambda args
            (let ((id (car args)))
              (if (member id seen)
                  #f
                  (begin (set! seen (cons id seen)) #t))))
          listings))
```
*;; generated example (note: variadic args via `(lambda args …)` form, interp.js:290-292)*

---

### `(let ((name expr) ...) body...)` and named-let `(let loop ((n v) ...) body...)`

**Returns:** the value of the last body expression.
**Backing:** `curator-web/src/scheme/interp.js:304-323`
**Side effects:** none beyond evaluating the bindings + body.
**Wired:** yes

Local bindings. Initialisers see the OUTER env. Named-let creates a
recursive helper closure and tail-calls it once — the standard
Scheme iteration pattern.

#### Novice
```scheme
(let ((cached (ctx-result ctx)))
  (if (null? cached)
      (next 'fetch ctx)
      (next 'render-cached (ctx-set 'cached cached ctx))))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:82-87`*

#### Intermediate
```scheme
;; pull two ctx values, build a paint call
(let ((anchors    (ctx-get 'anchors ctx))
      (copy-lines (ctx-get 'copy-lines ctx)))
  (paint-arrow 'price-ladder-card
               ':anchors anchors
               ':labels  copy-lines
               ':glow    'warm-amber))
```
*Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:277-283`*

#### Expert
```scheme
;; named let — iterate over a list with an index
(let loop ((items items) (i 0) (out '()))
  (if (null? items)
      (reverse out)
      (loop (cdr items)
            (+ i 1)
            (cons (list i (car items)) out))))
```
*;; generated example (tail-call-eliminated; uses interp.js:304-317 TCO bounce)*

---

### `(let* ((name expr) ...) body...)`

**Returns:** the value of the last body expression.
**Backing:** `curator-web/src/scheme/interp.js:324-330`
**Side effects:** sequential — each binding sees the prior.
**Wired:** yes

Sequential binding. Each initialiser is evaluated in the env including
all earlier bindings. Use when later bindings depend on earlier ones.

#### Novice
```scheme
(let* ((a 1)
       (b (+ a 2)))
  b)
;; → 3
```
*;; generated example*

#### Intermediate
```scheme
(let* ((receipts (ctx-get 'receipts ctx))
       (revenue  (sum (map (lambda (r) (assq 'amount r)) receipts))))
  (next 'render (ctx-set 'revenue revenue ctx)))
```
*;; generated example*

#### Expert
```scheme
;; layer ctx, derive feature, derive decision
(let* ((topics  (ctx-get 'topics ctx))
       (top-3   (take topics 3))
       (batched (act 'web-search (list 'top-headline-batch top-3) 'check-fetch)))
  batched)
```
*;; generated example, modelled on `curator-web/src/scheme/carts/personal/daily-news-brief.sks:133-137`*

---

### `(not value)`

**Returns:** `#t` if value is `#f`, else `#f`.
**Backing:** `curator-web/src/scheme/base.js:42`
**Side effects:** none.
**Wired:** yes (base primitive; not actually a special form)

Logical negation. Only `#f` is false; everything else is true.

#### Novice
```scheme
(not (null? topics))
;; → #t if topics is non-empty
```
*;; generated example*

#### Intermediate
```scheme
(when (not (eq? state 'paused))
  (next 'fetch ctx))
```
*;; generated example*

#### Expert
```scheme
;; closed cond: explicit "not connected" arm rather than a negated catch-all
(cond
  ((eq? status 'connected)            (next 'fetch ctx))
  ((not (eq? status 'connected))      (escalate 'service-not-yet-wired null)))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:118-125`*

---

### `(or expr1 expr2 ...)`

**Returns:** the first truthy value, or `#f`.
**Backing:** `curator-web/src/scheme/interp.js:362-369`
**Side effects:** short-circuits left-to-right.
**Wired:** yes

Short-circuit disjunction. Returns the first non-`#f` value (which is
NOT necessarily `#t`). In tail position, the last disjunct is itself
in tail.

#### Novice
```scheme
;; pick the first present field
(or (assq ':override ctx)
    'no-override)
```
*;; generated example*

#### Intermediate
```scheme
;; fallback chain
(let ((from (or (ctx-get 'shop-id ctx)
                (ctx-get 'default-shop ctx)
                'unknown-shop)))
  (act 'etsy/listings (list from) 'render))
```
*;; generated example*

#### Expert
```scheme
;; guard with side-effect-free fallback
(if (or (eq? status 'rate-limited)
        (eq? status 'quota-exhausted))
    (after 60 'fetch ctx)
    (next 'check-fetch ctx))
```
*;; generated example*

---

### `(quote datum)` and `'datum`

**Returns:** the datum unevaluated.
**Backing:** `curator-web/src/scheme/interp.js:259-260`
**Side effects:** none.
**Wired:** yes

Prevents evaluation. The reader expands `'x` to `(quote x)`. The
cart-lint star REQUIRES on-result args to `act` to be quoted symbols —
they ride through unevaluated and the driver reads them at dispatch.

#### Novice
```scheme
;; symbol literal
(act 'cortex/recall (list '(:topic news-brief :date today)) 'check-today)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:76`*

#### Intermediate
```scheme
;; a quoted alist that survives untouched into Cortex
(act 'cortex/remember
     (list '(:topic living-plan-checkpoint) finding)
     'render)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:302-306`*

#### Expert
```scheme
;; nested quote — the alist contains keyword markers and a quoted symbol
(escalate 'service-not-yet-wired
          '(:status not-wired :reason "lacuna-session-returned-null"))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:268-270`*

---

### `(quasiquote tmpl)` `` `tmpl `` and `(unquote x)` `,x`

**Returns:** the template with unquoted slots evaluated.
**Backing:** `curator-web/src/scheme/interp.js:344-345` + `quasiExpand`
**Side effects:** evaluates only the unquoted holes.
**Wired:** yes

Template syntax for building data with computed slots. Backtick keeps
the structure quoted; `,x` evaluates `x` and splices its value in.

#### Novice
```scheme
;; build a list with one computed value
`(:status ok :count ,n)
;; → (:status ok :count 7) when n is 7
```
*;; generated example*

#### Intermediate
```scheme
;; envelope with operator-derived fields
(envelope-queue
  `(daily-news-brief
    :scout    "the analyst"
    :one-liner ,(ctx-get 'one-liner ctx)
    :rows     ,rows))
```
*;; generated example*

#### Expert
```scheme
;; assemble a Cortex landing shape with multiple computed fields
(act 'cortex/remember
     (list `(:topic the-living-business-plan
             :window now
             :delta  ,finding
             :score  ,(score-of finding))
           finding)
     'render)
```
*;; generated example*

---

### `(set! name value)`

**Returns:** undefined (effect: mutates an existing binding).
**Backing:** `curator-web/src/scheme/interp.js:279-281`
**Side effects:** mutates the env binding.
**Wired:** yes

Mutates an EXISTING binding. Throws on an unbound name. Substrate-
frozen names (the built-in verb roster) reject `set!` post-freeze —
that's the protective wall in `Env.set` interp.js:70-82.

#### Novice
```scheme
(define counter 0)
(set! counter (+ counter 1))
;; → counter is now 1
```
*;; generated example*

#### Intermediate
```scheme
;; close over a counter in a higher-order pass
(let ((seen 0))
  (for-each (lambda (r) (set! seen (+ seen 1)))
            rows)
  seen)
```
*;; generated example*

#### Expert
```scheme
;; mutate-in-closure pattern (rare — prefer pure ctx threading)
(define (make-counter)
  (let ((n 0))
    (lambda ()
      (set! n (+ n 1))
      n)))
(define tick (make-counter))
(tick) (tick) (tick)
;; → 3
```
*;; generated example*

---

### `(unless test body...)`

**Returns:** the value of the last body form when test is `#f`, else undefined.
**Backing:** `curator-web/src/scheme/interp.js:370-377`
**Side effects:** evaluates body only when test is false.
**Wired:** yes

Inverse of `when`. Body is in tail position.

#### Novice
```scheme
(unless (null? rows)
  (table rows '(id title price)))
```
*;; generated example*

#### Intermediate
```scheme
(unless (eq? (ctx-get 'tier ctx) 'free)
  (act 'sakura/cloud-reason (list ':context ctx) 'check-finding))
```
*;; generated example*

#### Expert
```scheme
;; gate a financial side-effect; tail position is the act descriptor
(unless (or (eq? state 'vacation) (eq? state 'paused))
  (act 'etsy/reprice (list listing-id new-price) 'check-reprice))
```
*;; generated example*

---

### `(when test body...)`

**Returns:** the value of the last body form when test is truthy, else undefined.
**Backing:** `curator-web/src/scheme/interp.js:346-353`
**Side effects:** evaluates body only when test is truthy.
**Wired:** yes

Single-arm conditional. Body is in tail position. Prefer when the
"false" branch is genuinely a no-op.

#### Novice
```scheme
(when (null? rows)
  (escalate 'no-data null))
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-get 'tier ctx) 'magic)
  (next 'assemble-quarter-memo ctx))
```
*;; generated example*

#### Expert
```scheme
;; emit a chip then queue an envelope, only when finding is non-trivial
(when (and (pair? finding) (> (length finding) 1))
  (begin
    (card-emit 'engine 'the-living-business-plan-ready (length finding))
    (envelope-queue (list 'the-living-business-plan ':finding finding))))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:314-321`*

---

## 2. List + sequence primitives

All §2 entries are bound by `makeBaseEnv` in
`curator-web/src/scheme/base.js`. They are PURE — no env effects,
no app state. Higher-order procedures re-enter the evaluator through
`apply`, sharing the same fuel budget so no escape is possible.

**Wired:** yes (all 20+ shipped + tested).
**Side effects:** none.

### `(append list1 list2 ...)`

**Returns:** a new list — the concatenation, left-to-right.
**Backing:** `curator-web/src/scheme/base.js:170`

#### Novice
```scheme
(append '(a b) '(c d))
;; → (a b c d)
```
*;; generated example*

#### Intermediate
```scheme
(append topics (list 'fallback-topic))
```
*;; generated example*

#### Expert
```scheme
;; flatten one level
(reduce append '() rows-of-rows)
```
*;; generated example*

---

### `(assoc key alist)`

**Returns:** the matching `(key value)` pair, or `#f`.
**Backing:** `curator-web/src/scheme/base.js:293`

#### Novice
```scheme
(assoc 'price '((title "vase") (price 19.99) (qty 2)))
;; → (price 19.99)
```
*;; generated example*

#### Intermediate
```scheme
(let ((entry (assoc ':topic cortex-result)))
  (if entry (cadr entry) 'no-topic))
```
*;; generated example*

#### Expert
```scheme
;; deep-equal key match; nested alist
(assoc '(:topic news-brief :date today)
       (cortex/recall-cache))
```
*;; generated example*

---

### `(car list)`

**Returns:** the first element.
**Backing:** `curator-web/src/scheme/base.js:46`

#### Novice
```scheme
(car '(a b c))
;; → a
```
*;; generated example*

#### Intermediate
```scheme
(let ((first-row (car rows)))
  (paint-text (assq 'title first-row) '#anchor/center))
```
*;; generated example*

#### Expert
```scheme
;; conway/additive-blend style — pulls hex bytes via cadr/caddr (see base.js:50-51)
(let ((c (car palette)))
  (list (hex-byte c 1) (hex-byte c 3) (hex-byte c 5)))
```
*;; generated example, modelled on `curator-web/src/scheme/conway.js:1205` callers*

---

### `(cdr list)`

**Returns:** the list minus its first element.
**Backing:** `curator-web/src/scheme/base.js:47`

#### Novice
```scheme
(cdr '(a b c))
;; → (b c)
```
*;; generated example*

#### Intermediate
```scheme
;; drop the head, keep the rest
(map (lambda (row) (cdr row)) rows)
```
*;; generated example*

#### Expert
```scheme
;; tail-recursive walk; uses TCO in interp.js
(define (count-rest acc lst)
  (if (null? lst) acc (count-rest (+ acc 1) (cdr lst))))
```
*;; generated example*

---

### `(cons head tail)`

**Returns:** a new list with `head` prepended to `tail`.
**Backing:** `curator-web/src/scheme/base.js:45`

#### Novice
```scheme
(cons 'a '(b c))
;; → (a b c)
```
*;; generated example*

#### Intermediate
```scheme
;; prepend a fresh row
(cons new-row existing-rows)
```
*;; generated example*

#### Expert
```scheme
;; build a quoted on-result-symbol payload from a runtime computed kind
(cons 'finding (cons (ctx-result ctx) '()))
```
*;; generated example*

---

### `(filter pred list)`

**Returns:** a new list of elements where `(pred x)` is not `#f`.
**Backing:** `curator-web/src/scheme/base.js:67`

#### Novice
```scheme
(filter (lambda (n) (> n 0)) '(-2 -1 0 1 2))
;; → (1 2)
```
*;; generated example*

#### Intermediate
```scheme
;; keep only published listings
(filter (lambda (row) (eq? (assq 'state row) 'active))
        listings)
```
*;; generated example*

#### Expert
```scheme
;; chain with sort + take to top-N by score
(take (sort (filter (lambda (r) (assq 'score r))
                    rows)
            (lambda (a b) (> (assq 'score a) (assq 'score b))))
      3)
```
*;; generated example*

---

### `(for-each fn list)`

**Returns:** undefined.
**Backing:** `curator-web/src/scheme/base.js:65`
**Side effects:** invokes `fn` on each element, in order.
**Wired:** yes

Effectful iteration. Use when you want the side effects and don't need
the result list (use `map` for that).

#### Novice
```scheme
(for-each (lambda (sprite-id)
            (sprite sprite-id (rest)))
          '(blossom rose coral))
```
*;; generated example, using real sprite ids from `spriteBehaviors.js:120-136`*

#### Intermediate
```scheme
;; paint a heart at each anchor
(for-each (lambda (anchor)
            (paint-heart anchor 'sakura-pink))
          anchors)
```
*;; generated example*

#### Expert
```scheme
;; emit chip per shop, then return ctx
(for-each (lambda (shop)
            (card-emit 'engine 'free-shipping-shop-ok shop))
          (ctx-get 'connected-shops ctx))
```
*;; generated example, modelled on `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:65`*

---

### `(length list)`

**Returns:** the number of elements.
**Backing:** `curator-web/src/scheme/base.js:62`

#### Novice
```scheme
(length '(a b c d))
;; → 4
```
*;; generated example*

#### Intermediate
```scheme
(card-emit 'engine 'daily-brief-ready (length rows))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:197`*

#### Expert
```scheme
;; conditional on a per-tier accrual count
(when (>= (length deltas) 12)
  (next 'assemble-quarter-memo ctx))
```
*;; generated example*

---

### `(list elem1 elem2 ...)`

**Returns:** a new list.
**Backing:** `curator-web/src/scheme/base.js:44`

#### Novice
```scheme
(list 'a 'b 'c)
;; → (a b c)
```
*;; generated example*

#### Intermediate
```scheme
(act 'etsy/receipts (list 'this-week) 'check-actuals)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:158-160`*

#### Expert
```scheme
;; build a tools list for a reasoning session
(act 'lacuna/ask
     (list "Reconcile actuals against prior plan."
           ':tools '((etsy/receipts) (etsy/ledger) (cortex/recall))
           ':budget 'magic)
     'check-finding)
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:247-258`*

---

### `(map fn list)`

**Returns:** a new list — `fn` applied to each element.
**Backing:** `curator-web/src/scheme/base.js:66`

#### Novice
```scheme
(map (lambda (n) (* n 2)) '(1 2 3))
;; → (2 4 6)
```
*;; generated example*

#### Intermediate
```scheme
;; titles of each row
(map (lambda (row) (assq 'title row)) rows)
```
*;; generated example*

#### Expert
```scheme
;; per-receipt revenue extraction, summed
(sum (map (lambda (r) (assq 'amount r)) receipts))
```
*;; generated example*

---

### `(member x list)`

**Returns:** the tail of `list` starting at `x`, or `#f`.
**Backing:** `curator-web/src/scheme/base.js:292`

#### Novice
```scheme
(member 'b '(a b c))
;; → (b c)
(member 'z '(a b c))
;; → #f
```
*;; generated example*

#### Intermediate
```scheme
(when (member 'magic supported-tiers)
  (next 'render-magic ctx))
```
*;; generated example*

#### Expert
```scheme
;; deep-equal match against an alist key
(if (member topic (ctx-get 'followed-topics ctx))
    (next 'fetch ctx)
    (escalate 'topic-not-followed null))
```
*;; generated example*

---

### `(nth list i)` and `(list-ref list i)`

**Returns:** the i-th element (zero-indexed).
**Backing:** `curator-web/src/scheme/base.js:174` (nth) / `:291` (list-ref)

#### Novice
```scheme
(nth '(a b c) 1)
;; → b
```
*;; generated example*

#### Intermediate
```scheme
(let ((title (nth row 0))
      (price (nth row 1)))
  (paint-text title '#anchor/center))
```
*;; generated example*

#### Expert
```scheme
;; pull column i across many rows
(map (lambda (row) (list-ref row i)) rows)
```
*;; generated example*

---

### `(range a b)`

**Returns:** the list `(a a+1 ... b-1)`.
**Backing:** `curator-web/src/scheme/base.js:63`

#### Novice
```scheme
(range 0 5)
;; → (0 1 2 3 4)
```
*;; generated example*

#### Intermediate
```scheme
;; iterate over 7 days for a brief
(map (lambda (d) (act 'web-search (list 'headline d) 'check-fetch))
     (range 0 7))
```
*;; generated example*

#### Expert
```scheme
;; deterministic-numbered IDs for paint anchors
(for-each (lambda (i)
            (paint-heart (list 'anchor i) 'sakura-pink))
          (range 0 12))
```
*;; generated example*

---

### `(reduce fn init list)`

**Returns:** the accumulated value.
**Backing:** `curator-web/src/scheme/base.js:68`

#### Novice
```scheme
(reduce + 0 '(1 2 3 4))
;; → 10
```
*;; generated example*

#### Intermediate
```scheme
(reduce (lambda (acc r) (+ acc (assq 'amount r)))
        0
        receipts)
```
*;; generated example*

#### Expert
```scheme
;; fold rows into a tagged structure (price-ladder-style)
(reduce (lambda (acc r)
          (let ((p (assq 'price r)))
            (if p (cons p acc) acc)))
        '()
        listings)
```
*;; generated example*

---

### `(reverse list)`

**Returns:** a new list, reversed.
**Backing:** `curator-web/src/scheme/base.js:171`

#### Novice
```scheme
(reverse '(a b c))
;; → (c b a)
```
*;; generated example*

#### Intermediate
```scheme
;; newest-last → newest-first
(reverse (sort log (lambda (a b) (< (assq 'ts a) (assq 'ts b)))))
```
*;; generated example*

#### Expert
```scheme
;; accumulate forward, reverse at the tail (tail-recursive idiom)
(let loop ((items items) (out '()))
  (if (null? items)
      (reverse out)
      (loop (cdr items) (cons (transform (car items)) out))))
```
*;; generated example*

---

## 3. Math + numeric

All §3 entries are bound by `makeBaseEnv`
(`curator-web/src/scheme/base.js`). Pure value transforms; no state.

**Wired:** yes — every one shipped.
**Side effects:** none.

### `(+ n1 n2 ...)` and `(- n1 n2 ...)` and `(* n1 n2 ...)` and `(/ n1 n2 ...)`

**Backing:** `curator-web/src/scheme/base.js:26-29`

Variadic arithmetic. `(-)` with one arg negates; `(/)` with one arg
reciprocates.

#### Novice
```scheme
(+ 1 2 3)        ;; → 6
(- 10 4 1)       ;; → 5
(* 2 3 4)        ;; → 24
(/ 100 4)        ;; → 25
```
*;; generated example*

#### Intermediate
```scheme
;; cents → dollars (Curator's price-cents convention)
(/ price-cents 100)
```
*;; generated example*

#### Expert
```scheme
;; CAGR over n years (also see base.js:220 `cagr` helper)
(* 100 (- (expt (/ end begin) (/ 1 years)) 1))
```
*;; generated example*

---

### `(abs x)`

**Backing:** `curator-web/src/scheme/base.js:35`

Absolute value.

#### Novice
```scheme
(abs -7)  ;; → 7
```
*;; generated example*

#### Intermediate
```scheme
;; distance-magnitude per axis
(abs (- new-price old-price))
```
*;; generated example*

#### Expert
```scheme
;; alarm if margin-change magnitude exceeds threshold
(when (> (abs (pct-change old-margin new-margin)) 5)
  (escalate 'margin-drift (list ':delta (- new-margin old-margin))))
```
*;; generated example*

---

### `(ceiling x)` / `(ceil x)`

**Backing:** `curator-web/src/scheme/base.js:185-188`

Round up.

#### Novice
```scheme
(ceiling 3.2)  ;; → 4
```
*;; generated example*

#### Intermediate
```scheme
;; minimum bricks needed
(ceiling (/ total-items items-per-brick))
```
*;; generated example*

#### Expert
```scheme
;; tier-level page count from row count
(ceiling (/ (length rows) page-size))
```
*;; generated example*

---

### `(clamp x lo hi)`

**Backing:** `curator-web/src/scheme/base.js:192`

Bound `x` to `[lo, hi]`.

#### Novice
```scheme
(clamp 150 0 100)  ;; → 100
```
*;; generated example*

#### Intermediate
```scheme
;; sprite turn — engine clamps 0..360 by spec
(sprite 'rose (turn (clamp degrees 0 360)))
```
*;; generated example, real sprite id from `spriteBehaviors.js:122`*

#### Expert
```scheme
;; coerce a tier float into a discrete percentage
(round (clamp (* score 100) 0 100))
```
*;; generated example*

---

### `(expt b p)`

**Backing:** `curator-web/src/scheme/base.js:183`

Exponentiation, `b^p`.

#### Novice
```scheme
(expt 2 10)  ;; → 1024
```
*;; generated example*

#### Intermediate
```scheme
;; log-spaced price ladder anchor
(expt 2 (/ rung 4))
```
*;; generated example*

#### Expert
```scheme
;; compound growth over n weeks
(* start (expt (+ 1 weekly-rate) weeks))
```
*;; generated example*

---

### `(floor x)`

**Backing:** `curator-web/src/scheme/base.js:184`

Round down.

#### Novice
```scheme
(floor 3.7)  ;; → 3
```
*;; generated example*

#### Intermediate
```scheme
;; integer multiplier
(floor (/ total seg-count))
```
*;; generated example*

#### Expert
```scheme
;; bucket index for a histogram
(floor (* (- value lo) buckets (/ 1 (- hi lo))))
```
*;; generated example*

---

### `(lerp a b t)`

**Backing:** `curator-web/src/scheme/base.js:193`

Linear interpolation; `t=0` → `a`, `t=1` → `b`.

#### Novice
```scheme
(lerp 0 100 0.5)  ;; → 50
```
*;; generated example*

#### Intermediate
```scheme
;; midway colour value
(lerp red-channel target-red 0.3)
```
*;; generated example*

#### Expert
```scheme
;; ease-in-out tween — sample at t=0..1
(map (lambda (t) (lerp begin end (* t t (- 3 (* 2 t)))))
     (map (lambda (i) (/ i 9)) (range 0 10)))
```
*;; generated example*

---

### `(max n1 n2 ...)` and `(min n1 n2 ...)`

**Backing:** `curator-web/src/scheme/base.js:33-34`

Largest / smallest among arguments.

#### Novice
```scheme
(max 3 7 1)  ;; → 7
(min 3 7 1)  ;; → 1
```
*;; generated example*

#### Intermediate
```scheme
;; cap retries
(min retry-count 5)
```
*;; generated example*

#### Expert
```scheme
;; price ceiling and floor against historical range
(clamp suggested (min lo-hist 5) (max hi-hist 500))
```
*;; generated example*

---

### `(mean list)`

**Backing:** `curator-web/src/scheme/base.js:209`

Arithmetic mean; empty list → 0.

#### Novice
```scheme
(mean '(2 4 6))  ;; → 4
```
*;; generated example*

#### Intermediate
```scheme
;; average daily orders
(mean (map (lambda (r) (assq 'orders r)) day-rows))
```
*;; generated example*

#### Expert
```scheme
;; rolling average using sma helper (base.js:221)
(sma (map (lambda (r) (assq 'price r)) listings) 7)
```
*;; generated example*

---

### `(modulo x y)`

**Backing:** `curator-web/src/scheme/base.js:30`

Positive remainder (Scheme convention).

#### Novice
```scheme
(modulo 10 3)   ;; → 1
(modulo -1 4)   ;; → 3 (positive!)
```
*;; generated example*

#### Intermediate
```scheme
;; every 13th week — quarter-end accrual
(when (= 0 (modulo week-index 13))
  (next 'assemble-quarter-memo ctx))
```
*;; generated example, real pattern from `the-living-business-plan.sks:65`*

#### Expert
```scheme
;; alternate rows for striped paint
(for-each (lambda (i)
            (if (= 0 (modulo i 2))
                (paint-rect i 0 1 1 'lilac)
                (paint-rect i 0 1 1 'mint)))
          (range 0 16))
```
*;; generated example*

---

### `(random)` and `(randint lo hi)` and `(random-pick list)`

**Backing:** `curator-web/src/scheme/base.js:200-207`

`random` returns a uniform float in [0,1). When running under
`runWithCards` the env binds a SEEDED PRNG on top so cart replay is
byte-identical (note in base.js:194-200). `runSurface` uses the
unseeded `rng-uniform`.

#### Novice
```scheme
(randint 1 7)
;; → 1..6
```
*;; generated example*

#### Intermediate
```scheme
;; random sprite from the pink family
(sprite (random-pick '(blossom rose coral)) (rest))
```
*;; generated example, real sprite ids from `spriteBehaviors.js:120-136`*

#### Expert
```scheme
;; seeded jitter for a paint-flow animation
(paint-flow 'card-a 'card-b 'glyph/heart
            (+ 6 (randint 0 5))
            'sakura-pink)
```
*;; generated example*

---

### `(round x)` / `(round2 x)`

**Backing:** `curator-web/src/scheme/base.js:189-190`

Round to integer / round to 2 decimals (money-friendly).

#### Novice
```scheme
(round 3.6)    ;; → 4
(round2 3.567) ;; → 3.57
```
*;; generated example*

#### Intermediate
```scheme
;; display-friendly margin percentage
(round2 (margin price cost))
```
*;; generated example, `margin` from base.js:214*

#### Expert
```scheme
;; reprice to cleanest $.99 anchor
(- (round (* new-price 100)) 1)
;; e.g. 19.99 ≈ 1999 cents
```
*;; generated example*

---

### `(sqrt x)`

**Backing:** `curator-web/src/scheme/base.js:177`

#### Novice
```scheme
(sqrt 16)  ;; → 4
```
*;; generated example*

#### Intermediate
```scheme
;; euclidean distance helper (also see `dist`, base.js:237)
(sqrt (+ (* dx dx) (* dy dy)))
```
*;; generated example*

#### Expert
```scheme
;; standard deviation pass
(let ((m (mean xs)))
  (sqrt (mean (map (lambda (x) (let ((d (- x m))) (* d d))) xs))))
```
*;; generated example*

---

### `(sum list)`

**Backing:** `curator-web/src/scheme/base.js:208`

#### Novice
```scheme
(sum '(1 2 3 4))  ;; → 10
```
*;; generated example*

#### Intermediate
```scheme
;; week revenue total
(sum (map (lambda (r) (assq 'amount r)) receipts))
```
*;; generated example*

#### Expert
```scheme
;; weighted score across category buckets
(sum (map (lambda (b) (* (assq 'weight b) (assq 'value b)))
          score-buckets))
```
*;; generated example*

---

## 4. Cart spine

The state-machine spine that every cart runs on. All §4 entries are
installed by `installCartPrelude`
(`curator-web/src/scheme/cartPrelude.js:42-136`). Each is a PURE
DESCRIPTOR CONSTRUCTOR: it returns a tagged list the driver
intercepts. The cart NEVER touches the world directly.

**Wired:** yes (all 7 shipped, lint-validated).
**Side effects:** none in the verb itself; the driver dispatches.

### `(act verb args on-result-symbol)`

**Returns:** `(act <verb> <args> <on-result-symbol>)` — a tool-call descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:97-102`
**Lint:** on-result MUST be a quoted symbol (cartLint.js:75-105).

The cart's only side-effect channel. The driver intercepts, dispatches
the real call, threads the response into `ctx` via `'last-result`, and
jumps to the named state.

#### Novice
```scheme
(define (fetch ctx)
  (act 'etsy/listings (list 'active) 'render))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:28-29`*

#### Intermediate
```scheme
(define (recall-topics ctx)
  (act 'cortex/recall (list '(:topic followed-topics)) 'check-topics))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:94-95`*

#### Expert
```scheme
(define (lacuna-ask ctx)
  (act 'lacuna/ask
       (list "Reconcile actuals against prior strategy. Revise projections."
             ':tools '((etsy/receipts) (etsy/ledger) (cortex/recall))
             ':context (list ':receipts (ctx-get 'receipts ctx)
                             ':prior    (ctx-get 'prior-plan ctx))
             ':budget 'magic)
       'check-finding))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:247-258`*

---

### `(after seconds state-symbol ctx)`

**Returns:** `(after <seconds> <state> <ctx>)` — sleep descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:86-87`

Sleep, then resume at the named state. Standard back-off after a
`'rate-limited` result.

#### Novice
```scheme
(after 30 'fetch ctx)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:35`*

#### Intermediate
```scheme
(cond
  ((eq? r 'rate-limited)    (after 60 'fetch ctx))
  ((eq? r 'quota-exhausted) (escalate 'answers-quota null))
  (else                     (next 'render ctx)))
```
*Source: condensed from `curator-web/src/scheme/carts/personal/daily-news-brief.sks:144-151`*

#### Expert
```scheme
;; exponential back-off via ctx counter
(let ((tries (or (ctx-get 'tries ctx) 0)))
  (after (* 30 (expt 2 tries))
         'fetch
         (ctx-set 'tries (+ tries 1) ctx)))
```
*;; generated example*

---

### `(ctx-get key ctx)`

**Returns:** the value bound to `key`, or `null`.
**Backing:** `curator-web/src/scheme/cartPrelude.js:108-115`

#### Novice
```scheme
(ctx-get 'topics ctx)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:134`*

#### Intermediate
```scheme
(let ((anchors    (ctx-get 'anchors ctx))
      (copy-lines (ctx-get 'copy-lines ctx)))
  (paint-arrow 'price-ladder-card ':anchors anchors ':labels copy-lines))
```
*Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:277-283`*

#### Expert
```scheme
;; nested ctx threading
(let ((receipts (ctx-get 'receipts ctx))
      (ledger   (ctx-get 'ledger ctx))
      (prior    (ctx-get 'prior-plan ctx))
      (override (ctx-get 'override ctx)))
  (act 'lacuna/ask
       (list "Reconcile."
             ':context (list ':receipts receipts ':ledger ledger
                             ':prior prior ':override override))
       'check-finding))
```
*Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:247-258`*

---

### `(ctx-result ctx)`

**Returns:** the value of `'last-result` in `ctx`, or `null`.
**Backing:** `curator-web/src/scheme/cartPrelude.js:127-133`

The driver writes the result of the last `act` here. Most check-states
read it first.

#### Novice
```scheme
(define (check-state ctx)
  (let ((state (ctx-result ctx)))
    ...))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:116-117`*

#### Intermediate
```scheme
(define (render ctx)
  (let ((rows (ctx-result ctx)))
    (cond
      ((null? rows)              (escalate 'no-data null))
      ((eq? rows 'rate-limited)  (after 30 'fetch ctx))
      (else                      (begin (table rows '(id title price))
                                        (done))))))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:31-38`*

#### Expert
```scheme
(define (check-finding ctx)
  (let ((finding (ctx-result ctx)))
    (cond
      ((null? finding)                  (escalate 'service-not-yet-wired null))
      ((eq? finding 'rate-limited)      (after 120 'lacuna-ask ctx))
      ((eq? finding 'cloud-tier-required) (escalate 'service-not-connected null))
      ((not (pair? finding))            (escalate 'sakura-garbled null))
      (else (next 'remember (ctx-set 'finding finding ctx))))))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:265-283`*

---

### `(ctx-set key value ctx)`

**Returns:** a NEW ctx with `key`→`value`.
**Backing:** `curator-web/src/scheme/cartPrelude.js:118-122`

Immutable update — returns a new assoc-list. The old `ctx` is
unchanged.

#### Novice
```scheme
(ctx-set 'topics topics ctx)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:107`*

#### Intermediate
```scheme
(next 'check-cortex-cache
      (ctx-set 'state state ctx))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:128`*

#### Expert
```scheme
;; layered ctx updates threaded through one state
(next 'fetch-ledger
      (ctx-set 'receipts receipts
               (ctx-set 'shop-id shop-id ctx)))
```
*;; generated example*

---

### `(done)`

**Returns:** `(done)` — terminal descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:77`

Cart finished cleanly. The driver releases the worker and records
success.

#### Novice
```scheme
(done)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:37`*

#### Intermediate
```scheme
(define (render ctx)
  (let ((rows (ctx-result ctx)))
    (table rows '(listing-id title metric value))
    (done)))
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:31-38`*

#### Expert
```scheme
;; emit chip + envelope, then done as the tail of the cart
(define (render ctx)
  (let ((finding (ctx-get 'finding ctx)))
    (card-emit 'engine 'the-living-business-plan-ready (length finding))
    (envelope-queue (list 'the-living-business-plan ':finding finding))
    (done)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:314-321`*

---

### `(escalate kind detail)`

**Returns:** `(escalate <kind> <detail>)` — pause descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:78-79`
**Lint:** kind MUST be a quoted symbol (cartLint.js:107-119).

The cart cannot proceed honestly. The driver pauses; the operator
surface decides what to do next.

#### Novice
```scheme
(escalate 'shop-not-connected null)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:25`*

#### Intermediate
```scheme
(escalate 'state-blocks-spend 'vacation)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:122`*

#### Expert
```scheme
(escalate 'service-not-yet-wired
          '(:status not-wired :reason "lacuna-session-returned-null"))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:268-270`*

---

### `(think/deep kind detail [tier])`

**Returns:** `(escalate <kind> <detail-with-tier>)` — deep-think pause descriptor.
**Backing:** `curator-web/src/scheme/escalationVerbs.js:37-50` (sugar) → `runtime/escalationPolicy.js` (classifier) → `POST /deep-think/enqueue` (honest-null).
**Wired: no** — the Loam job queue is not built yet; the backend honest-nulls the enqueue (`reason: "deep-think-queue-not-yet-wired"`).

The 4B → 15B two-brain hand-off. When the on-device 4B recognises a problem as
out of its depth but in the reasoner's depth, it hands a reasoning job to the
15B as an ASYNC Loam job instead of blocking a human. `kind` should be one of
the deep-think kinds (`deep-think`, `reasoning-required`, `ambiguous`,
`plan-required`, `research-required`); `tier` is an optional `'quick|'standard|'deep`
duration-pricing hint. Lowers to an ordinary `escalate` descriptor — the verb
only DESCRIBES the hand-off. See ENGINEERING.md
"The two-brain escalation split".

#### Novice
```scheme
(think/deep 'plan-required (plan-request "restock for Q4"))
```

#### Intermediate
```scheme
(think/deep 'research-required
            '(:topic "competitor pricing" :depth 3)
            'deep)
```

#### Expert
```scheme
(cond
  ((local-answerable? q) (done))
  (else (think/deep 'reasoning-required
                    (list ':question q ':context (ctx-slice ctx))
                    'standard)))
```

---

### `(ask/reasoner question [tier])`

**Returns:** `(escalate 'reasoning-required <{question, tier}>)` — deep-think pause descriptor.
**Backing:** `curator-web/src/scheme/escalationVerbs.js:55-63` (sugar) → `runtime/escalationPolicy.js` (classifier) → `POST /deep-think/enqueue` (honest-null).
**Wired: no** — honest-nulls until the Loam job queue lands.

The narrow, common case: pose a question to the 15B reasoner. Lowers to a
`'reasoning-required` deep-think with the question as the request payload;
`tier` defaults to `'standard`. The answer is not awaited inline — it returns
later via the discuss-queue on the wake loop.

#### Novice
```scheme
(ask/reasoner "why did the sync stall?")
```

#### Intermediate
```scheme
(ask/reasoner "which of these 40 listings should I boost this week?" 'deep)
```

#### Expert
```scheme
(let ((q (compose-question topic recent-signals)))
  (ask/reasoner q 'standard))
```

---

### `(next state-symbol ctx)`

**Returns:** `(next <state> <ctx>)` — advance descriptor.
**Backing:** `curator-web/src/scheme/cartPrelude.js:75-76`

Move to the named state with `ctx` as input. The driver looks up the
matching `(define (<state> ctx) …)`.

#### Novice
```scheme
(next 'fetch ctx)
```
*Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks:26`*

#### Intermediate
```scheme
(next 'check-cortex-cache (ctx-set 'state state ctx))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:128`*

#### Expert
```scheme
(else (next 'remember
            (ctx-set 'finding finding ctx)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:282-283`*

---

## 5. Cortex verbs

Cortex verbs are NOT bound as Scheme functions. They are
ACT-DISPATCHED — invoked via `(act 'cortex/recall …)`. The driver
routes them to the Cortex memory graph. Card-manifest sources for
the verb roster: `curator-web/src/components/cards/cortexManifest.js`
and the per-tier cart manifests (`carts/<tier>/manifest.js` —
`cortex/recall`, `cortex/remember`, `cortex/forget`).

**Wired:** partial — `recall`, `remember`, `forget` shipped; deeper
verbs (`cosine-topk`, `walk`, `multi-store-publish`, `diff-against-shops`)
are surfaced in cart manifests but resolve to `'service-not-yet-wired`
or a per-cart lacuna-relay at this writing.

**On the wire.** Cortex verbs consume and produce SLAT records —
recall returns a `cortex-slice` slat, remember accepts a slat body
that gets canonicalized before write. See §SLAT for the reader/writer
verbs (`slat/read`, `slat/write`, `slat/canonical`, `slat/hash`) and
CORTEX-1.0.ENG.md §SLAT for the slice, snapshot, delta, and signed
envelope shapes.

### `(act 'cortex/recall (list key-alist) 'on-result)`

```verb-card cortex/recall
```

**Returns:** via `ctx-result`: the cached value, or `null`.
**Backing:** routed by cart driver to `curator-api`/cortex — verb
**Wired:** yes (the most-used Cortex verb).

#### Novice
```scheme
(act 'cortex/recall (list '(:topic news-brief :date today)) 'check-today)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:76`*

#### Intermediate
```scheme
(act 'cortex/recall (list '(:topic followed-topics)) 'check-topics)
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:95`*

#### Expert
```scheme
(define (fetch-prior-plan ctx)
  (act 'cortex/recall
       (list '(:topic living-plan-checkpoint))
       'check-prior-plan))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:208-211`*

---

### `(act 'cortex/remember (list key-alist value) 'on-result)`

**Returns:** via `ctx-result`: `'ok` on success, `'cortex-not-ready`
otherwise.
**Wired:** yes.

Idempotent upsert keyed on the topic alist. Same key + same value =
no-op.

#### Novice
```scheme
(act 'cortex/remember (list '(:topic notes) "today's note") 'next-step)
```
*;; generated example*

#### Intermediate
```scheme
(define (remember ctx)
  (let ((finding (ctx-get 'finding ctx)))
    (act 'cortex/remember
         (list '(:topic the-living-business-plan :window now) finding)
         'remember-checkpoint)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:291-295`*

#### Expert
```scheme
;; double-write — window-keyed + stable checkpoint topic
(define (remember-checkpoint ctx)
  (let ((finding (ctx-get 'finding ctx)))
    (act 'cortex/remember
         (list '(:topic living-plan-checkpoint) finding)
         'render)))
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:302-306`*

---

### `(act 'cortex/forget (list key-alist) 'on-result)`

**Returns:** via `ctx-result`: `'ok` or `'cortex-not-ready`.
**Wired:** yes (manifest-declared at `cortexManifest.js:40-47` as `prune-node`).
**Side effects:** persistent — drops the node + its edges.

Operator-confirmed. The card manifest declares
`perm: 'destructive'`, `confirm: 'every-time'`.

#### Novice
```scheme
(act 'cortex/forget (list '(:topic stale-promo)) 'next-step)
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-result ctx) 'confirmed)
  (act 'cortex/forget (list (ctx-get 'topic-to-drop ctx)) 'render))
```
*;; generated example*

#### Expert
```scheme
;; bulk forget under operator confirmation
(for-each
  (lambda (topic)
    (act 'cortex/forget (list (list ':topic topic)) 'after-each-drop))
  (ctx-get 'stale-topics ctx))
```
*;; generated example*

---

### `(act 'cortex/cosine-topk (list query k) 'on-result)`

**Returns:** via `ctx-result`: list of `(node-id score)` pairs.
**Wired:** partial — manifest-declared in carts/magic/manifest.js and
referenced by `cortex-multi-store-publish.sks`; routes to the cortex
embeddings service which gates by tier.

#### Novice
```scheme
(act 'cortex/cosine-topk (list "rustic ceramic vase" 5) 'pick-similar)
```
*;; generated example*

#### Intermediate
```scheme
(let ((seed (ctx-get 'listing-title ctx)))
  (act 'cortex/cosine-topk (list seed 10) 'rank))
```
*;; generated example*

#### Expert
```scheme
;; gate the call; cloud-tier required
(case (ctx-get 'tier ctx)
  ((magic) (act 'cortex/cosine-topk (list query 8) 'rank))
  (else    (escalate 'service-not-connected
                     '(:status not-wired :reason "cosine-topk-requires-magic"))))
```
*;; generated example*

---

### `(act 'cortex/walk (list start-node depth) 'on-result)`

**Returns:** via `ctx-result`: the breadth-first node list, or `null`.
**Wired:** partial — surfaced by the magic-tier carts; resolves to
`'service-not-yet-wired` on local-tier runs.

#### Novice
```scheme
(act 'cortex/walk (list 'living-plan-checkpoint 2) 'render)
```
*;; generated example*

#### Intermediate
```scheme
(let ((root (ctx-get 'theme-root ctx)))
  (act 'cortex/walk (list root 3) 'collect))
```
*;; generated example*

#### Expert
```scheme
;; chain walk → cosine-topk for thematic expansion
(define (walk-then-rank ctx)
  (act 'cortex/walk
       (list (ctx-get 'seed ctx) 2)
       'rank-results))
```
*;; generated example*

---

### `(act 'cortex/multi-store-publish (list listing shop-ids) 'on-result)`

**Returns:** via `ctx-result`: per-shop result alist.
**Backing:** routed via `carts/pink/cortex-multi-store-publish.sks`.
**Wired:** partial — the cart spine is shipped; the underlying
publisher gates per shop on connection + per-shop authorization.

#### Novice
```scheme
(act 'cortex/multi-store-publish
     (list listing-id (list 'etsy 'shopify))
     'check-results)
```
*;; generated example*

#### Intermediate
```scheme
(act 'cortex/multi-store-publish
     (list (ctx-get 'listing ctx) (ctx-get 'shop-ids ctx))
     'reconcile-shops)
```
*;; generated example*

#### Expert
```scheme
;; bulk + dry-run before commit; pattern from cortex-multi-store-publish-dry-run.sks
(act 'cortex/multi-store-publish
     (list (ctx-get 'listing-batch ctx)
           '(etsy shopify)
           ':dry-run #t)
     'preview-results)
```
*;; generated example, modelled on `carts/pink/cortex-multi-store-publish-dry-run.sks`*

---

### `(act 'cortex/diff-against-shops (list listing) 'on-result)`

**Returns:** via `ctx-result`: alist of per-shop diff records.
**Backing:** `carts/pink/cortex-diff-against-shops.sks`.
**Wired:** partial — diff cart spine shipped; the diff service is
multi-shop and gates on having ≥2 connected stores.

#### Novice
```scheme
(act 'cortex/diff-against-shops (list listing-id) 'render-diff)
```
*;; generated example*

#### Intermediate
```scheme
(let ((target (ctx-get 'listing ctx)))
  (act 'cortex/diff-against-shops (list target) 'check-diff))
```
*;; generated example*

#### Expert
```scheme
;; condition on connected-store count before calling
(if (>= (length (ctx-get 'connected-shops ctx)) 2)
    (act 'cortex/diff-against-shops (list (ctx-get 'listing ctx)) 'check-diff)
    (escalate 'connect-second-store-first null))
```
*;; generated example*

---

## 5.5 Stats verbs (Wave 5 — 2026-06-22)

Pure-math deterministic verbs. NO vendor dependency, NO OAuth, NO infra
gating. ACT-DISPATCHED. Backings live in
`curator-api/curator_api/routes/verb_backings.py:1773-2010` and are
re-exported in the frontend dispatcher table
`curator-web/src/scheme/runtime/verbBackings.js:46-53`.

**Wired:** yes — every Wave-5 verb has a real HTTP backing that
executes the actual math (not a degraded shell). Per Marcus rule
(NO FAKE-SUCCESS), these are wired:true honest backings.

### `(act 'stats/zscore (list (:series ...) (:value v)) 'on-result)`

**Returns:** `(:ok #t :z float :mean float :stdev float :n int)`
**Backing:** `verb_backings.stats_zscore` — population z-score.

#### Novice
```scheme
(act 'stats/zscore '((:series (10 12 11 14 13)) (:value 25)) 'check-anomaly)
```
*Source: `curator-web/src/scheme/carts/cron/daily-anomaly-watch.sks`*

#### Intermediate
```scheme
(let ((series (ctx-get 'impressions-28d ctx)))
  (act 'stats/zscore (list ':series series ':value (last series)) 'check-z))
```
*Source: `curator-web/src/scheme/carts/magic/title-bandit-posterior.sks:207`*

#### Expert
```scheme
;; Z > 2 -> escalate; otherwise carry on
(let* ((series (ctx-get 'series ctx))
       (r      (act 'stats/zscore (list ':series series) 'check-z)))
  (if (> (alist-get ':z r) 2.0)
      (escalate 'anomaly-detected r)
      (act 'cortex/remember (list ':topic 'baseline ':value (alist-get ':mean r))
           'remember-baseline)))
```
*;; composition example*

---

### `(act 'stats/delta (list (:before ...) (:after ...)) 'on-result)`

**Returns:** `(:ok #t :delta number|list :rel number|list :shape "scalar"|"series")`
**Backing:** `verb_backings.stats_delta` — element-wise subtraction + relative change.

#### Novice
```scheme
(act 'stats/delta '((:before 100) (:after 110)) 'check-delta)
```

#### Intermediate
```scheme
(act 'stats/delta
     (list ':before yesterday-impressions ':after today-impressions)
     'check-traffic-delta)
```

#### Expert
```scheme
;; Series delta + threshold gate
(let* ((d (act 'stats/delta (list ':before y ':after t) 'check))
       (rels (alist-get ':rel d)))
  (if (any? (lambda (r) (> (abs r) 0.20)) rels)
      (escalate 'series-jump d)
      'no-action))
```

---

### `(act 'stats/cooc (list (:transactions ...) (:top_k k)) 'on-result)`

**Returns:** `(:ok #t :pairs [(:a :b :count :lift) ...] :n_transactions int)`
**Backing:** `verb_backings.stats_cooc` — co-occurrence counts + lift.

#### Novice
```scheme
(act 'stats/cooc '((:transactions (("a" "b") ("a" "c") ("b" "c")))) 'check-pairs)
```

#### Intermediate
```scheme
(let ((carts (ctx-get 'recent-orders ctx)))
  (act 'stats/cooc (list ':transactions (map order-items carts) ':top_k 10)
       'check-bundles))
```
*Source: `curator-web/src/scheme/carts/cron/monthly-bundle-suggestions.sks`*

#### Expert
```scheme
;; Filter by lift > 1.5 -> bundle candidates
(let* ((co    (act 'stats/cooc (list ':transactions txns) 'check))
       (pairs (alist-get ':pairs co))
       (strong (filter (lambda (p) (> (alist-get ':lift p) 1.5)) pairs)))
  (if (pair? strong)
      (act 'cortex/remember (list ':topic 'bundle-candidates ':value strong)
           'remember)
      'no-bundles))
```

---

### `(act 'stats/cosine (list (:a ...) (:b ...)) 'on-result)`

**Returns:** `(:ok #t :cosine float)` — cosine similarity in [-1, 1].
**Backing:** `verb_backings.stats_cosine`.

#### Novice
```scheme
(act 'stats/cosine '((:a (1 0)) (:b (1 1))) 'check-sim)
```

#### Intermediate
```scheme
(let ((emb-a (ctx-get 'listing-emb ctx))
      (emb-b (ctx-get 'competitor-emb ctx)))
  (act 'stats/cosine (list ':a emb-a ':b emb-b) 'check-sim))
```

#### Expert
```scheme
;; Rank candidates by similarity, take top 3
(let ((scored (map (lambda (c)
                     (cons c (alist-get ':cosine
                              (act 'stats/cosine (list ':a query ':b (cdr c))
                                   'check))))
                   candidates)))
  (take (sort-by cdr > scored) 3))
```

---

### `(act 'stats/percentile (list (:series ...) (:value v) (:p p)) 'on-result)`

**Returns:** `(:ok #t :rank float|null :at_percentile float|null :n int)`
**Backing:** `verb_backings.stats_percentile` — linear-interp percentile.

#### Novice
```scheme
(act 'stats/percentile '((:series (1 2 3 4 5)) (:p 50)) 'check-median)
```

#### Intermediate
```scheme
(act 'stats/percentile
     (list ':series sale-prices ':value asking-price)
     'check-price-rank)
```

#### Expert
```scheme
;; Compare today's sale velocity against 30-day p90
(let* ((r (act 'stats/percentile
               (list ':series velocity-30d ':p 90 ':value velocity-today)
               'check)))
  (cond ((> (alist-get ':rank r) 90)
         (act 'sakura/say (list ':text "Velocity is in the top 10% — promote.")
              'reply))
        (else 'normal)))
```

---

## 5.6 Cortex extensions (Wave 5 — 2026-06-22)

### `(act 'cortex/calendar (list (:limit n)) 'on-result)`

**Returns:** `(:ok #t :offers [(:memo_id :title :date ...) ...] :scanned int)`
**Backing:** `verb_backings.cortex_calendar` — scans recent memos for date offers.
**Wired:** yes.

#### Novice
```scheme
(act 'cortex/calendar '() 'check-events)
```

#### Intermediate
```scheme
(act 'cortex/calendar '((:limit 100)) 'find-events)
```

#### Expert
```scheme
;; Surface memo dates in next 30 days as suggested cron triggers
(let* ((r       (act 'cortex/calendar '((:limit 200)) 'check))
       (offers  (alist-get ':offers r))
       (soon    (filter (lambda (o)
                          (< (days-until (alist-get ':date o)) 30))
                        offers)))
  (for-each (lambda (o)
              (act 'cortex/remember (list ':topic 'upcoming :value o) 'remember))
            soon))
```

---

### `(act 'cortex/forget (list (:ttl_days n)) 'on-result)`

**Returns:** sweep summary dict from `run_expunge_sweep`.
**Backing:** `verb_backings.cortex_forget` — TTL-driven expunge scoped to operator.
**Wired:** yes.

#### Novice
```scheme
(act 'cortex/forget '() 'check-forget)
```

#### Intermediate
```scheme
(act 'cortex/forget '((:ttl_days 90)) 'aggressive-forget)
```

#### Expert
```scheme
;; Quarterly cleanup with audit
(let ((r (act 'cortex/forget '((:ttl_days 90)) 'sweep)))
  (act 'cortex/remember
       (list ':topic 'quarterly-forget-audit ':value r)
       'record))
```

---

### `(act 'cortex/cosine-topk (list (:kind k) (:embedding v) (:limit n)) 'on-result)`

**Returns:** `(:ok #t :hits [(...node...) ...] :k int)`
**Backing:** `verb_backings.cortex_cosine_topk` — vector_topk over CortexStore.
**Wired:** yes (degrades honestly to empty hits + `degraded:true` when the
operator's backend lacks a vector index).

#### Novice
```scheme
(act 'cortex/cosine-topk
     (list ':kind "memo" ':embedding (ctx-get 'q ctx))
     'check)
```

#### Intermediate
```scheme
(act 'cortex/cosine-topk
     (list ':kind "listing" ':embedding query-emb ':limit 5)
     'find-similar-listings)
```

#### Expert
```scheme
;; Retrieve nearest 10, hand to model for re-rank
(let* ((hits (alist-get ':hits
              (act 'cortex/cosine-topk
                   (list ':kind "memo" ':embedding q ':limit 10) 'topk))))
  (act 'model/workhorse
       (list ':prompt (rerank-prompt q hits))
       'rerank))
```

---

## 5.7 Sakura local primitives (Wave 5 — 2026-06-22)

### `(act 'sakura/say (list (:text "...") (:mood m)) 'on-result)`

**Returns:** `(:ok #t :spoken #t :text_len int :mood string)`
**Backing:** `verb_backings.sakura_say` — writes a durable audit row.
The frontend speech-bubble painter is a separate concern that listens
to the audit event and renders locally.
**Wired:** yes.

#### Novice
```scheme
(act 'sakura/say '((:text "Hello, operator.")) 'spoke)
```

#### Intermediate
```scheme
(act 'sakura/say
     (list ':text "Pricing looks good today." ':mood "happy")
     'spoke)
```

#### Expert
```scheme
;; Voice-coach pattern: react to a vision result with mood-matched line
(let* ((v   (act 'vision/label (list ':image url) 'label))
       (top (alist-get ':label (car (alist-get ':labels v)))))
  (act 'sakura/say
       (list ':text (format "I see ~a — try moving left." top)
             ':mood "thinking")
       'coached))
```

---

### `(act 'sakura/cloud-reason (list (:prompt "...")) 'on-result)`

**Returns:** `(:ok #t :text "..." :tokens_in int :tokens_out int)`
**Backing:** `verb_backings.sakura_cloud_reason` — delegates to the
deep-reasoning cascade with a distinct audit tag (so callers can tell
"Sakura escalated" from "operator invoked deep-reasoning directly").
**Wired:** yes (degrades honestly when the cloud model cascade is
unavailable in the build).

#### Novice
```scheme
(act 'sakura/cloud-reason '((:prompt "should I raise prices?")) 'reason)
```

#### Intermediate
```scheme
(act 'sakura/cloud-reason
     (list ':prompt (string-append "context: " ctx "\nquestion: " q))
     'reason)
```

#### Expert
```scheme
;; Escalation pattern — on-device first, cloud only on uncertainty.
(let ((local (act 'model/fast (list ':prompt q) 'fast)))
  (if (< (alist-get ':confidence local) 0.7)
      (act 'sakura/cloud-reason (list ':prompt q) 'escalate)
      local))
```

---

## 6. Marketplace verbs

Marketplace verbs are shipped two ways: as Scheme bindings installed
by `installShopVerbsRuntime`
(`curator-web/src/scheme/shopVerbsRuntime.js:448-602`), AND
ACT-DISPATCHED from carts. The verb tables live in
`curator-web/src/scheme/shops.js` (ETSY/EBAY/SHOPIFY/META, lines
17-168). Each runtime-installed verb returns a queued intent envelope
the live spine drains.

**Wired:** mixed.
- All `etsy/*`, `ebay/*`, `shopify/*`, `meta/*` verbs are
  Scheme-bound — but a verb without a backing op in the catalog
  returns `'not-yet-wired` honestly (shopVerbsRuntime.js:524-533).
- Financial writes (reprice, payouts, refunds) are gated by
  `FINANCIAL_WRITES_ENABLED` — disabled by default per Alfred
  2026-06-14. Calls return a preview envelope, never fire.
- Vendor verbs (Printify, Shippo, QuickBooks, Canva) installed by
  `installVendorVerbs` (`vendorVerbs.js`).
- `instagram/feed-post` and `google/sheets-append-row` are
  manifest-only verbs, surfaced by `carts/google/*.sks`; they route
  through the lacuna multi-tool relay rather than direct Scheme
  bindings.

### `(etsy/listings [state])`

**Returns:** queued intent `(ok queued (:verb etsy/listings …))`.
**Backing:** declared `shops.js:19`; runtime-bound at
`shopVerbsRuntime.js:594-598`.
**Wired:** yes (read).

List the seller's listings, optionally filtered by state.

#### Novice
```scheme
(act 'etsy/listings (list 'active) 'render)
```
*Source: pattern from `curator-web/src/scheme/carts/etsy/age-distribution.sks:29`*

#### Intermediate
```scheme
(define (fetch ctx)
  (act 'etsy/listings (list 'all) 'check-listings))
```
*;; generated example, real verb name from `shops.js:19`*

#### Expert
```scheme
;; chain: list → per-listing inventory pull
(define (after-listings ctx)
  (let ((rows (ctx-result ctx)))
    (act 'etsy/inventory (list (assq 'listing-id (car rows))) 'check-inv)))
```
*;; generated example*

---

### `(etsy/receipts [state])`

**Returns:** queued intent.
**Backing:** `shops.js:37`; bound at `shopVerbsRuntime.js:594`.
**Wired:** yes (read).

#### Novice
```scheme
(act 'etsy/receipts (list 'this-week) 'check-actuals)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:158-160`*

#### Intermediate
```scheme
(act 'etsy/receipts (list 'today) 'count-today)
```
*;; generated example*

#### Expert
```scheme
(act 'etsy/receipts (list 'this-week)
     'reconcile-against-cortex-checkpoint)
```
*;; generated example*

---

### `(etsy/ledger)` / `(etsy/reprice id price)` / `(etsy/publish id)`

**Backing:** `shops.js:25-39`.
**Wired:** ledger=yes (read). reprice / publish = `Wired: no` until
`FINANCIAL_WRITES_ENABLED` true (per Alfred 2026-06-14 directive).

#### Novice
```scheme
(act 'etsy/ledger (list ':since 'this-week) 'check-ledger)
```
*Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks:185-187`*

#### Intermediate
```scheme
;; reprice — preview-only when flag disabled
(act 'etsy/reprice (list listing-id 1999) 'check-reprice)
```
*;; generated example*

#### Expert
```scheme
;; publish workflow: validate → confirm → publish
(define (publish ctx)
  (if (ctx-get 'operator-confirmed ctx)
      (act 'etsy/publish (list (ctx-get 'listing-id ctx)) 'check-publish)
      (escalate 'awaiting-confirmation null)))
```
*;; generated example*

---

### `(ebay/inventory-items)` / `(ebay/payouts)` / `(ebay/offer id)`

**Backing:** `shops.js:57, 98, 63`.
**Wired:** read verbs = yes. State-changers (`publish-offer`,
`issue-refund`) = `Wired: no` until financial flag enabled.

#### Novice
```scheme
(act 'ebay/payouts '() 'render)
```
*;; generated example, real verb at `shops.js:98`*

#### Intermediate
```scheme
(define (fetch ctx)
  (act 'ebay/inventory-items '() 'check-inv))
```
*;; generated example*

#### Expert
```scheme
;; per-sku flow
(let ((sku (ctx-get 'sku ctx)))
  (act 'ebay/inventory-item (list sku) 'check-item))
```
*;; generated example*

---

### `(shopify/orders [filter])` / `(shopify/products [filter])` / `(shopify/reprice variant price)`

**Backing:** `shops.js:124-148`.
**Wired:** reads yes; financial writes gated.

#### Novice
```scheme
(act 'shopify/orders '() 'render)
```
*;; generated example, verb at `shops.js:135`*

#### Intermediate
```scheme
(act 'shopify/products (list 'active) 'check-products)
```
*;; generated example*

#### Expert
```scheme
;; tier-gated reprice
(when (eq? (ctx-get 'tier ctx) 'magic)
  (act 'shopify/reprice
       (list (ctx-get 'variant-id ctx)
             (round2 (markup cost 35)))
       'check-reprice))
```
*;; generated example, `markup` is base.js:215*

---

### `(meta/catalogs)` / `(meta/products catalog)` / `(meta/batch catalog items)`

**Backing:** `shops.js:152-168`.
**Wired:** reads yes; writes (`create-product`, `batch`) gated.

#### Novice
```scheme
(act 'meta/catalogs '() 'render-catalogs)
```
*;; generated example, verb at `shops.js:153`*

#### Intermediate
```scheme
(act 'meta/products (list (ctx-get 'catalog-id ctx)) 'check)
```
*;; generated example*

#### Expert
```scheme
;; ads-list-ad-accounts is the next-layer verb; not yet in shops.js
;; — flagged Wired: no until added.
(escalate 'service-not-yet-wired
          '(:reason "meta/ads-list-ad-accounts pending"))
```
*;; generated example*

> **NOTE:** `meta/ads-list-ad-accounts` is requested but NOT in
> `shops.js` as of 2026-06-15. **Wired: no.**

---

### `(instagram/feed-post …)` and `(google/sheets-append-row …)`

**Backing:** routed via `carts/google/*.sks` manifest; uses
`sakura/relay` (`carts/google/manifest.js:78`).
**Wired:** no — manifest-declared, routes through the lacuna
multi-tool relay; the relay returns `'service-not-yet-wired`
until the per-vendor PKCE flow lands.

#### Novice
```scheme
(act 'instagram/feed-post
     (list (ctx-get 'image-url ctx) (ctx-get 'caption ctx))
     'check-post)
```
*;; generated example*

#### Intermediate
```scheme
(act 'google/sheets-append-row
     (list (ctx-get 'sheet-id ctx)
           (ctx-get 'tab-name ctx)
           (list date revenue orders))
     'after-append)
```
*;; generated example*

#### Expert
```scheme
;; honest fallback when the relay isn't wired
(cond
  ((eq? (ctx-get 'status ctx) 'not-yet-wired)
     (escalate 'service-not-yet-wired
               '(:vendor instagram :reason "PKCE flow pending")))
  (else
     (act 'instagram/feed-post (list url caption) 'check-post)))
```
*;; generated example*

---

### `(ebay/feedback [:program p] [:cycle c])`

**Returns:** `(ok (:feedback (:level … :cycle … :program … :metrics …)))`.
**Backing:** HTTP `/api/verbs/ebay/feedback` → `EbayClient.get_feedback`
(`curator-api/curator_api/stores/ebay.py`). P1/HN-3 (2026-07-03) — a new
read-only client method landed on the already-OAuth'd eBay client.
**Wired:** yes (read) — honest-null `ebay-not-connected` until the
operator OAuths their eBay account. eBay's REST surface carries no
buyer-comment feed (that lived only in the legacy Trading API), so the
summary projects the seller-standards profile's feedback-derived metrics;
it never fabricates a comment stream the API cannot supply.

#### Novice
```scheme
(act 'ebay/feedback '() 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/ebay/feedback)*

#### Intermediate
```scheme
(define (check ctx)
  (act 'ebay/feedback (list ':cycle "CURRENT") 'read-standing))
```
*;; generated example*

#### Expert
```scheme
;; honest branch — surface not-connected in the operator's words
(define (after-feedback ctx)
  (let ((r (ctx-result ctx)))
    (if (eq? (assq 'reason r) 'ebay-not-connected)
        (escalate 'service-not-connected '(:store ebay))
        (act 'notify/push (list (assq 'level r)) 'tell-operator))))
```
*;; generated example*

---

### `(shopify/customers [:limit n] [:cursor c])`

**Returns:** `(ok (:customers (…) :count N))`.
**Backing:** HTTP `/api/verbs/shopify/customers` →
`ShopifyClient.list_customers` (`curator-api/curator_api/stores/shopify.py`).
P1/HN-3 (2026-07-03) — a new read-only client method on the already-OAuth'd
Shopify client (`GET /customers.json`, `read_customers` scope).
**Wired:** yes (read) — honest-null `shopify-not-connected` until the
operator OAuths. READ-ONLY: never creates / updates / deletes a customer;
each row is trimmed to the segmentation fields, not the raw PII blob.

#### Novice
```scheme
(act 'shopify/customers '() 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/shopify/customers)*

#### Intermediate
```scheme
(act 'shopify/customers (list ':limit 100) 'segment-repeat-buyers)
```
*;; generated example*

#### Expert
```scheme
;; page the full customer book via the Link-header cursor
(define (page ctx)
  (let ((cur (ctx-get 'next-cursor ctx)))
    (if cur
        (act 'shopify/customers (list ':cursor cur) 'page)
        (escalate 'done '(:reason "no more pages")))))
```
*;; generated example*

---

### `(vision/describe url)`

**Returns:** `(ok (:op describe :text "…" :tier …))`.
**Backing:** HTTP `/api/verbs/vision/describe` → `curator_api.vision.capability.describe`
(`curator-api/curator_api/vision/capability.py`). P2/HN-1 (2026-07-03) — a
read/compute op against the SAME provisioned multimodal seam the upload
classifier already uses (cloud-first when a key is configured, local-runtime
fallback). No new vendor dependency; the wire-call boundary lives in `_llm`.
**Wired:** yes (read/compute) — honest-null `vision-not-configured` when no
multimodal backend is provisioned, `image-fetch-failed` when the URL can't be
fetched, `vision-backend-failed` when the model call fails. Never a fabricated
caption. Fetch is size-capped (12 MiB) and timeout-bounded (15 s).

#### Novice
```scheme
(act 'vision/describe (list "https://cdn.example/photo.jpg") 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/vision/describe)*

#### Intermediate
```scheme
(define (caption ctx)
  (act 'vision/describe (list (ctx-get 'image-url ctx)) 'draft-alt-text))
```
*;; generated example*

#### Expert
```scheme
;; honest branch — only write the caption if the model actually produced one
(define (after-describe ctx)
  (let ((r (ctx-result ctx)))
    (if (assq 'text r)
        (act 'etsy/update (list ':field "description" (assq 'text r)) 'apply)
        (escalate 'service-not-configured '(:capability vision)))))
```
*;; generated example*

---

### `(vision/ocr url)`

**Returns:** `(ok (:op ocr :text "…verbatim…" :tier …))`.
**Backing:** HTTP `/api/verbs/vision/ocr` → `curator_api.vision.capability.ocr`
(`curator-api/curator_api/vision/capability.py`). P2/HN-1 (2026-07-03) — same
provisioned multimodal seam as `vision/describe`; transcribes ONLY the text
visible in the image, preserving line breaks (`(no text)` when there is none).
**Wired:** yes (read/compute) — honest-null `vision-not-configured` /
`image-fetch-failed` / `vision-backend-failed`. Never fabricates text the
image does not contain.

#### Novice
```scheme
(act 'vision/ocr (list "https://cdn.example/label.png") 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/vision/ocr)*

#### Intermediate
```scheme
(define (read-label ctx)
  (act 'vision/ocr (list (ctx-get 'image-url ctx)) 'extract-serial))
```
*;; generated example*

#### Expert
```scheme
;; pipe transcribed text into a structured parse, honestly gated
(define (after-ocr ctx)
  (let ((r (ctx-result ctx)))
    (cond ((assq 'text r)
           (act 'documents/parse (list (assq 'text r)) 'structure))
          (else (escalate 'service-not-configured '(:capability vision))))))
```
*;; generated example*

---

### `(vision/embed text)`

**Returns:** `(ok (:op embed :embedding (…) :dims 768 :tier "embedding-768"))`.
**Backing:** HTTP `/api/verbs/vision/embed` → `curator_api.vision.capability.embed`
(`curator-api/curator_api/vision/capability.py`). P2/HN-1 (2026-07-03) — reuses
the classifier's provisioned embedding path; embeds a text (image-description)
string to a 768-d vector for similarity search.
**Wired:** yes (compute) — honest-null `vision-not-configured` when no
embedding backend is provisioned, `vision-embed-failed` on a transient failure.
Never a fabricated vector. `args.text` is required (empty → structured reject).

#### Novice
```scheme
(act 'vision/embed (list "vintage brass desk lamp") 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/vision/embed)*

#### Intermediate
```scheme
(define (embed-caption ctx)
  (act 'vision/embed (list (ctx-get 'caption ctx)) 'index-for-search))
```
*;; generated example*

#### Expert
```scheme
;; describe → embed → cosine-topk, closing the retrieval loop
(define (similar ctx)
  (let ((v (assq 'embedding (ctx-result ctx))))
    (if v
        (act 'cortex/cosine-topk (list ':query v ':k 5) 'find-neighbors)
        (escalate 'service-not-configured '(:capability vision)))))
```
*;; generated example*

---

### `(documents/parse url-or-text)`

**Returns:** `(ok (:markdown "…" :metadata (…)))`.
**Backing:** HTTP `/api/verbs/documents/parse` → the provisioned scrape service
(`curator-api/curator_api/routes/verb_backings.py`). P2/HN-1 (2026-07-03) — a
general document parse (sibling of `documents/parse-invoice`, but domain-neutral).
**Wired:** yes (read) — honest-null `documents-not-configured` when no scrape
service key is present, structured error on a fetch/parse failure. Never
fabricates parsed content.

#### Novice
```scheme
(act 'documents/parse (list "https://example.com/spec.pdf") 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/documents/parse)*

#### Intermediate
```scheme
(define (ingest ctx)
  (act 'documents/parse (list (ctx-get 'doc-url ctx)) 'to-markdown))
```
*;; generated example*

#### Expert
```scheme
;; parse then remember, honestly gated on the service being configured
(define (after-parse ctx)
  (let ((r (ctx-result ctx)))
    (if (assq 'markdown r)
        (act 'cortex/remember (list ':topic "spec" (assq 'markdown r)) 'store)
        (escalate 'service-not-configured '(:capability documents)))))
```
*;; generated example*

---

### `(web/extract-schema :urls (…) :schema (…))`

**Returns:** `(ok (:data (…) :url-count N))`.
**Backing:** HTTP `/api/verbs/web/extract-schema` → the provisioned scrape
service's schema-guided extraction (`extract`, `curator-api/curator_api/routes/verb_backings.py`).
P2/HN-1 (2026-07-03) — pulls structured fields from one or more URLs against a
caller-supplied schema.
**Wired:** yes (read/compute) — structured reject on `missing-urls` /
`missing-schema`; honest `ok-degraded` when the service returns partial data;
honest error when the service is unreachable. Never invents field values.

#### Novice
```scheme
(act 'web/extract-schema
     (list ':urls (list "https://shop.example/item")
           ':schema '((title . string) (price . number)))
     'render)
```
*;; generated example, verb backed at `verb_backings.py` (/web/extract-schema)*

#### Intermediate
```scheme
(define (pull ctx)
  (act 'web/extract-schema
       (list ':urls (ctx-get 'competitor-urls ctx)
             ':schema '((price . number) (in-stock . boolean)))
       'compare-prices))
```
*;; generated example*

#### Expert
```scheme
;; honest degraded branch — surface partial extraction rather than pretend
(define (after-extract ctx)
  (let ((r (ctx-result ctx)))
    (cond ((eq? (assq 'reason r) 'missing-schema)
           (escalate 'bad-args '(:need schema)))
          ((assq 'data r) (act 'analytics/report (list (assq 'data r)) 'roll-up))
          (else (escalate 'service-degraded '(:capability web))))))
```
*;; generated example*

---

### `(web/monitor url)`

**Returns:** `(ok (:changed bool :baseline bool :digest "…"))`.
**Backing:** HTTP `/api/verbs/web/monitor` → the provisioned scrape service +
the operator's Cortex snapshot (`curator-api/curator_api/routes/verb_backings.py`).
P2/HN-1 (2026-07-03) — a change-watch: hashes the fetched content
(`hashlib.sha256`) and compares against the last stored digest for that URL. On
first sight it records a baseline; thereafter it reports `changed` truthfully.
**Wired:** yes (read/compute) — structured reject on `missing-url`; honest
`ok-degraded` when the fetch fails; honest error when the service is
unreachable. The `changed`/`baseline` flags are computed from real digests,
never fabricated.

#### Novice
```scheme
(act 'web/monitor (list "https://supplier.example/price") 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/web/monitor)*

#### Intermediate
```scheme
(define (watch ctx)
  (act 'web/monitor (list (ctx-get 'watch-url ctx)) 'check-for-change))
```
*;; generated example*

#### Expert
```scheme
;; only notify on a real change, never on the baseline capture
(define (after-monitor ctx)
  (let ((r (ctx-result ctx)))
    (cond ((assq 'baseline r) (escalate 'noted '(:reason "baseline captured")))
          ((assq 'changed r)  (act 'notify/push (list ':title "Price changed") 'alert))
          (else (escalate 'unchanged '())))))
```
*;; generated example*

---

### `(etsy/create-draft :title t :price p …)` ⚠ WRITE

**Returns:** `(ok (:listing_id … :state "draft"))`.
**Backing:** HTTP `/api/verbs/etsy/create-draft` → `EtsyClient.create_draft_listing`
(`curator-api/curator_api/stores/etsy.py`). P3/HN-1 (2026-07-03) — a WRITE path
that creates a **draft** listing (`state="draft"`), never a live one; the
operator still publishes explicitly afterward.
**Wired:** yes (WRITE — operator-commit gated). This verb mutates the
operator's live Etsy shop, so it is guarded by the **operator-commit second
wall**: without a truthy `operator_commit` (from args or the preamble) it
returns `operator-commit-required` and fires NO mutation. Honest-null
`etsy-not-connected` until OAuth; `etsy-backing-failed` on a backend error.

#### Novice
```scheme
;; the commit token is supplied by the operator's explicit go, never faked
(act 'etsy/create-draft
     (list ':title "Vintage brass lamp" ':price 42.00 ':operator_commit #t)
     'render)
```
*;; generated example, verb backed at `verb_backings.py` (/etsy/create-draft)*

#### Intermediate
```scheme
(define (draft ctx)
  (act 'etsy/create-draft
       (list ':title (ctx-get 'title ctx)
             ':price (ctx-get 'price ctx)
             ':tags  (ctx-get 'tags ctx)
             ':operator_commit (ctx-get 'commit ctx))
       'make-draft))
```
*;; generated example*

#### Expert
```scheme
;; honest wall branch — surface the commit requirement in the operator's words
(define (after-draft ctx)
  (let ((r (ctx-result ctx)))
    (cond ((eq? (assq 'reason r) 'operator-commit-required)
           (escalate 'needs-operator-go '(:action "create draft listing")))
          ((assq 'listing_id r)
           (act 'etsy/upload-image
                (list ':listing_id (assq 'listing_id r)
                      ':image_url (ctx-get 'hero ctx)
                      ':operator_commit #t)
                'attach-hero))
          (else (escalate 'service-not-connected '(:store etsy))))))
```
*;; generated example*

---

### `(etsy/upload-image :listing_id id :image_url u …)` ⚠ WRITE

**Returns:** `(ok (:listing_id … :image_id …))`.
**Backing:** HTTP `/api/verbs/etsy/upload-image` → `EtsyClient.upload_listing_image`
(`curator-api/curator_api/stores/etsy.py`). P3/HN-1 (2026-07-03) — uploads ONE
image to an existing listing. The image is supplied as a URL (fetched,
size-capped via the vision helper) or base64 bytes.
**Wired:** yes (WRITE — operator-commit gated). Same **operator-commit second
wall** as `etsy/create-draft`: no token -> `operator-commit-required`, no
upload. `image-fetch-failed` when a supplied URL can't be fetched;
`etsy-not-connected` until OAuth; `etsy-backing-failed` on a backend error.

#### Novice
```scheme
(act 'etsy/upload-image
     (list ':listing_id "L123"
           ':image_url "https://cdn.example/hero.jpg"
           ':operator_commit #t)
     'render)
```
*;; generated example, verb backed at `verb_backings.py` (/etsy/upload-image)*

#### Intermediate
```scheme
(define (attach ctx)
  (act 'etsy/upload-image
       (list ':listing_id (ctx-get 'listing-id ctx)
             ':image_url (ctx-get 'photo-url ctx)
             ':rank 1 ':alt_text (ctx-get 'alt ctx)
             ':operator_commit (ctx-get 'commit ctx))
       'add-hero))
```
*;; generated example*

#### Expert
```scheme
;; honest — never claim the image posted unless the backing confirmed it
(define (after-upload ctx)
  (let ((r (ctx-result ctx)))
    (cond ((eq? (assq 'reason r) 'operator-commit-required)
           (escalate 'needs-operator-go '(:action "upload listing image")))
          ((eq? (assq 'reason r) 'image-fetch-failed)
           (escalate 'bad-image '(:reason "could not fetch the photo URL")))
          ((assq 'image_id r) (escalate 'posted '()))
          (else (escalate 'service-not-connected '(:store etsy))))))
```
*;; generated example*

---

### `(ebay/publish :offer_id id :operator_commit #t)` ⚠ WRITE

**Returns:** `(ok (:offer_id … :listing_id …))`.
**Backing:** HTTP `/api/verbs/ebay/publish` → `EbayClient.publish_offer`
(`curator-api/curator_api/stores/ebay.py`). P3/HN-1 (2026-07-03) — publishes an
existing eBay **offer** LIVE (makes it a purchasable listing). The offer must
already exist (created via the inventory/offer flow); this verb only publishes.
**Wired:** yes (WRITE — operator-commit gated). Same **operator-commit second
wall**: no token -> `operator-commit-required`, no publish. Honest-null
`ebay-not-connected` until OAuth; `ebay-backing-failed` on a backend error.
This is the highest-stakes verb in the catalog: it puts a live, buyable
listing in front of shoppers — so it never fires without the operator's go.

#### Novice
```scheme
(act 'ebay/publish (list ':offer_id "OF-9" ':operator_commit #t) 'render)
```
*;; generated example, verb backed at `verb_backings.py` (/ebay/publish)*

#### Intermediate
```scheme
(define (go-live ctx)
  (act 'ebay/publish
       (list ':offer_id (ctx-get 'offer-id ctx)
             ':operator_commit (ctx-get 'commit ctx))
       'publish-offer))
```
*;; generated example*

#### Expert
```scheme
;; honest — the listing_id only exists if eBay actually published
(define (after-publish ctx)
  (let ((r (ctx-result ctx)))
    (cond ((eq? (assq 'reason r) 'operator-commit-required)
           (escalate 'needs-operator-go '(:action "publish live eBay listing")))
          ((assq 'listing_id r)
           (act 'cortex/remember
                (list ':topic "ebay-live" (assq 'listing_id r)) 'record))
          (else (escalate 'service-not-connected '(:store ebay))))))
```
*;; generated example*

---

## 7. Paint + visual primitives

Installed by `installPaintKit` (`curator-web/src/paint/index.js:127-180`).
29 primitives total at v2.20.0. Each returns a paint handle the motion
verbs can drive. Every entry has `perm: 'paint'` and is registered with
the scene-graph (sceneGraph.js) so drawings become addressable like
cards.

**Wired:** yes — every entry listed in `PAINT_PRIMITIVES`
(paint/index.js:86-122) is bound. Several procedural entries
(`paint-mesh`, `paint-displace`, etc.) declare their signature; the
math is fully wired for the substrate/glyph/animated categories.

### `(paint-arrow from to colour)`

```verb-card paint-arrow
```

**Returns:** PaintHandle (kind 'arrow).
**Backing:** `curator-web/src/paint/primitives/arrow.js`; registered via
`paint/index.js:100`.
**Wired:** yes.

#### Novice
```scheme
(paint-arrow '#anchor/center '#anchor/right 'sakura-pink)
```
*;; generated example, anchors from `make-character` address grammar*

#### Intermediate
```scheme
(paint-arrow 'price-ladder-card
             ':anchors  anchors
             ':labels   copy-lines
             ':glow     'warm-amber)
```
*Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks:280-283`*

#### Expert
```scheme
;; arrow per row, colour-mapped by delta sign
(for-each
  (lambda (row)
    (paint-arrow (assq 'from row)
                 (assq 'to row)
                 (if (> (assq 'delta row) 0) 'mint 'rose)))
  rows)
```
*;; generated example*

---

### `(paint-burst at colour ms)`

**Returns:** PaintHandle (kind 'burst, animated).
**Backing:** `paint/primitives/burst.js`; `paint/index.js:112`.
**Wired:** yes. powerTier 'animate' (skips at quarter/paused).

#### Novice
```scheme
(paint-burst '#anchor/center 'sakura-pink 800)
```
*;; generated example*

#### Intermediate
```scheme
(paint-burst src 'sakura 600)
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.test.js:9`*

#### Expert
```scheme
;; coordinated burst at every connected shop card
(for-each (lambda (shop-card)
            (paint-burst shop-card 'sakura-pink 500))
          (ctx-get 'connected-shop-cards ctx))
```
*;; generated example*

---

### `(paint-clear [region])`

**Returns:** PaintHandle (kind 'clear).
**Backing:** `paint/primitives/clear.js`; `paint/index.js:91`.
**Wired:** yes. EVERYWHERE-clear (no region or `'everywhere`) also
wipes the scene-graph registry (paint/index.js:163-166).

#### Novice
```scheme
(paint-clear)
;; → clears all paints, registry, returns handle
```
*;; generated example*

#### Intermediate
```scheme
;; clear one region
(paint-clear (list ':bbox 0 0 800 200))
```
*;; generated example*

#### Expert
```scheme
;; clean up after a scene exits
(begin
  (paint-clear)
  (surface-restore)
  (done))
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.test.js:155`*

---

### `(paint-emoji glyph at)`

**Returns:** PaintHandle (kind 'emoji).
**Backing:** `paint/primitives/emoji.js`; `paint/index.js:114`.
**Wired:** yes — uses the dot-matrix emoji atlas.

#### Novice
```scheme
(paint-emoji '💃 '#anchor/center)
```
*;; generated example*

#### Intermediate
```scheme
;; emoji at every flower's address
(for-each (lambda (a) (paint-emoji '🌸 a))
          (list '#sprite/blossom '#sprite/rose '#sprite/coral))
```
*;; generated example, real sprite ids*

#### Expert
```scheme
;; thought-bubble decoration around a sprite
(let ((bubble-points (around '#sprite/blossom 32 12)))
  (for-each (lambda (p) (paint-emoji '💭 p)) bubble-points))
```
*;; generated example*

---

### `(paint-fireworks at colour-set ms)`

**Returns:** PaintHandle (kind 'fireworks, animated).
**Backing:** `paint/primitives/fireworks.js`; `paint/index.js:111`.
**Wired:** yes.

#### Novice
```scheme
(paint-fireworks '#anchor/center (list 'sakura-pink 'lilac) 1500)
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-result ctx) 'sold)
  (paint-fireworks '#card/sale-card (list 'mint 'sakura-pink) 1200))
```
*;; generated example*

#### Expert
```scheme
;; celebration at every newly-sold listing
(for-each (lambda (id)
            (paint-fireworks (list 'card id)
                             (list 'sakura-pink 'lilac 'mint)
                             1500))
          (ctx-get 'newly-sold-ids ctx))
```
*;; generated example*

---

### `(paint-flow from to glyph count [colour])`

**Returns:** PaintHandle (kind 'flow, animated).
**Backing:** `paint/primitives/flow.js`; `paint/index.js:107`.
**Wired:** yes. The transfer scene's grayscale-channel verb.

#### Novice
```scheme
(paint-flow 'card-a 'card-b 'glyph/heart 8 'sakura-pink)
```
*;; generated example*

#### Intermediate
```scheme
;; flow from each shop to the central card
(for-each (lambda (shop-card)
            (paint-flow shop-card '#card/cortex 'glyph/dot 5 'mint))
          (ctx-get 'connected-shops ctx))
```
*;; generated example*

#### Expert
```scheme
;; transfer-scene-style: dots flowing src → dst with glow at each end
(begin
  (paint-glow src 'sakura 600)
  (paint-glow dst 'sakura 600)
  (paint-flow src dst 'glyph/box 12 'sakura-pink))
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.sks:132-133`*

---

### `(paint-glow target colour ms)`

**Returns:** PaintHandle (kind 'glow, animated).
**Backing:** `paint/primitives/glow.js`; `paint/index.js:108`.
**Wired:** yes. The canonical Sakura signature (8px sakura-magic
glow per [[feedback_sakura_action_glow]]).

#### Novice
```scheme
(paint-glow '#anchor/center 'sakura-pink 1200)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:170`*

#### Intermediate
```scheme
(paint-glow '#sprite/blossom 'sakura-pink 1200)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:170`*

#### Expert
```scheme
;; brief glow around every newly-sold listing, sequenced
(for-each (lambda (id)
            (paint-glow (list 'card id) 'sakura-pink 800))
          (ctx-get 'newly-sold-ids ctx))
```
*;; generated example*

---

### `(paint-heart at [colour])`

**Returns:** PaintHandle (kind 'heart).
**Backing:** `paint/primitives/heart.js`; `paint/index.js:102`.
**Wired:** yes.

#### Novice
```scheme
(paint-heart '#anchor/center 'sakura-pink)
```
*;; generated example, real anchor address*

#### Intermediate
```scheme
;; one heart per loved listing
(for-each (lambda (l) (paint-heart (list 'card l) 'sakura-pink))
          (ctx-get 'loved ctx))
```
*;; generated example*

#### Expert
```scheme
;; cascading hearts around a sprite
(let ((pts (around '#sprite/coral 20 8)))
  (for-each (lambda (p) (paint-heart p 'sakura-pink)) pts))
```
*;; generated example*

---

### `(paint-highlight card-addr [colour])`

**Returns:** PaintHandle (kind 'highlight).
**Backing:** `paint/primitives/highlight.js`; `paint/index.js:104`.
**Wired:** yes.

#### Novice
```scheme
(paint-highlight '#card/cortex 'mint)
```
*;; generated example*

#### Intermediate
```scheme
(paint-highlight (list 'card listing-id) 'warm-amber)
```
*;; generated example*

#### Expert
```scheme
(for-each (lambda (id)
            (paint-highlight (list 'card id) 'sakura-pink))
          (ctx-get 'at-risk ctx))
```
*;; generated example*

---

### `(paint-grid surface palette)`

**Returns:** integer (count of cells painted).
**Backing:** `curator-web/src/scheme/grid.js:695`.
**Wired:** yes. The Canvas Dreams cellular substrate.

#### Novice
```scheme
(paint-grid 'desktop (palette 'sakura))
```
*;; generated example, palette = `curator-web/src/scheme/palette.js`*

#### Intermediate
```scheme
(define (start ctx)
  (paint-grid 'desktop 'sakura)
  (next 'await-tap ctx))
```
*;; generated example*

#### Expert
```scheme
;; on-canvas-pattern read after grid paint
(begin
  (paint-grid 'desktop (palette 'mint))
  (on-canvas-pattern 'wave (lambda (ev) (paint-burst ev 'lilac 400))))
```
*;; generated example*

---

### `(paint-marquee text band speed)`

**Returns:** PaintHandle (kind 'marquee, animated).
**Backing:** `paint/primitives/marquee.js`; `paint/index.js:90`.
**Wired:** yes. The narrating bottom-band per
[[curator-canvas-is-sakuras-home]].

#### Novice
```scheme
(paint-marquee "Five flowers · slow waltz" 'bottom 4000)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:162`*

#### Intermediate
```scheme
;; per-state narration
(paint-marquee (ctx-get 'narration ctx) 'top 3000)
```
*;; generated example*

#### Expert
```scheme
;; sequenced marquees per scene beat
(begin
  (paint-marquee "Reading shops..." 'bottom 2000)
  (act 'etsy/listings '() 'check)
  (paint-marquee "Cross-referencing..." 'bottom 2000))
```
*;; generated example*

---

### `(paint-point-at card-addr)`

**Returns:** PaintHandle (kind 'point-at).
**Backing:** `paint/primitives/point-at.js`; `paint/index.js:101`.
**Wired:** yes.

#### Novice
```scheme
(paint-point-at '#card/cortex)
```
*;; generated example*

#### Intermediate
```scheme
(paint-point-at (list 'card (ctx-get 'highlight-id ctx)))
```
*;; generated example*

#### Expert
```scheme
;; chained point-at + flow + glow
(begin
  (paint-point-at '#card/sale-card)
  (paint-flow '#card/cortex '#card/sale-card 'glyph/dot 6 'sakura-pink)
  (paint-glow '#card/sale-card 'sakura-pink 800))
```
*;; generated example*

---

### `(paint-spiral centre radius turns colour)`

**Returns:** PaintHandle.
**Backing:** `paint/primitives/spiral.js`; `paint/index.js:97`.
**Wired:** yes.

#### Novice
```scheme
(paint-spiral '#anchor/center 120 3 'lilac)
```
*;; generated example*

#### Intermediate
```scheme
(paint-spiral (list 'card listing-id) 80 2 'warm-amber)
```
*;; generated example*

#### Expert
```scheme
;; sized by score
(paint-spiral '#anchor/center
              (lerp 40 200 (clamp (ctx-get 'score ctx) 0 1))
              3
              'sakura-pink)
```
*;; generated example*

---

### `(paint-text text at [opts...])`

**Returns:** PaintHandle (kind 'text).
**Backing:** `paint/primitives/text.js`; `paint/index.js:89`.
**Wired:** yes. Stroke-mode `'handwriting` paints dot-by-dot per
Sakura's voice (Sakura Magic per [[feedback-sakura-magic-signature]]).

#### Novice
```scheme
(paint-text "Hello Surface" '#anchor/center
            ':stroke-mode 'handwriting
            ':wpm 110)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/dot-matrix-greeting.sks:84-86`*

#### Intermediate
```scheme
(paint-text "tap anywhere" '#anchor/center
            ':alpha 0.6)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/falling-petals-on-tap.sks:81`*

#### Expert
```scheme
;; sakura's spoken-reply pattern — addressable dots, twinkle, motion
(paint-text reply
            '#anchor/sakura-mouth
            ':stroke-mode 'handwriting
            ':colour 'sakura-pink
            ':twinkle #t
            ':wpm 110)
```
*Source: pattern from [[project_sakura_reply_dot_matrix]] + dot-matrix-greeting.sks:84*

---

### `(paint-twinkle region density)` / `(paint-pulse card-addr ms)`

**Returns:** PaintHandle (animated).
**Backing:** `paint/primitives/twinkle.js`, `pulse.js`;
`paint/index.js:109-110`.
**Wired:** yes.

#### Novice
```scheme
(paint-twinkle (list ':bbox 0 0 800 200) 0.4)
(paint-pulse '#card/cortex 1200)
```
*;; generated example*

#### Intermediate
```scheme
(when (ctx-get 'idle ctx)
  (paint-twinkle (list ':full-canvas) 0.3))
```
*;; generated example*

#### Expert
```scheme
;; pulse all at-risk cards, twinkle the background
(for-each (lambda (id) (paint-pulse (list 'card id) 1200))
          (ctx-get 'at-risk ctx))
(paint-twinkle (list ':bbox 0 0 1200 800) 0.2)
```
*;; generated example*

---

### `(paint-line from to colour)` / `(paint-rect x y w h colour)` / `(paint-arc centre r start end)` / `(paint-circle centre r colour)` / `(paint-pipe from to colour thickness)`

**Backing:** `paint/primitives/{line,rect,arc,circle,pipe}.js`;
`paint/index.js:93-98`.
**Wired:** yes. The geometry kit (5 primitives, +1 pipe).

#### Novice
```scheme
(paint-line '(0 0) '(100 100) 'mint)
(paint-rect 10 10 80 40 'lilac)
(paint-circle '#anchor/center 50 'sakura-pink)
```
*;; generated example*

#### Intermediate
```scheme
(paint-arc '#anchor/center 80 0 3.14 'warm-amber)
(paint-pipe 'card-a 'card-b 'mint 4)
```
*;; generated example*

#### Expert
```scheme
;; histogram of rows by metric value
(for-each (lambda (row i)
            (paint-rect (* i 20) 200
                        12 (* (assq 'metric row) 4)
                        (if (> (assq 'metric row) threshold) 'rose 'mint)))
          rows (range 0 (length rows)))
```
*;; generated example (uses base.js list ops)*

---

## 8. Sprite + body verbs

Sprite verbs are the operator-and-Sakura voice for the 16 dot-matrix
helpers. Atoms + combinators installed by `installSpriteVerbs`
(`curator-web/src/scheme/spriteVerbs.js:366`). Sprite ids are real
palette names from `spriteBehaviors.js:120-136`: blossom, rose, coral,
amber, butter, mint, fern, sky, ocean, lilac, grape, cedar, gray,
slate, black, white.

**Wired:** mixed.
- `(sprite …)` dispatcher: yes.
- `(sprites who …)` plural: yes.
- Atoms that LOWER to existing verbs (`carry`, `hand-to`, `set-down`,
  `flash`): yes — lower to move-card, transfer, receive-listing,
  card-effect.
- Atoms needing the visual engine (`(dance 'clip-name)`,
  `(point-at)`, `(beckon)`, etc.): return `['pending-visual', …]`
  envelopes — honest. **Wired: partial.**
- `(turn deg)` clamped 0..360, `(size factor)` clamped 0.5..3.0 —
  envelope path.

### `(sprite name atom-or-combinator)`

```verb-card sprite
```

**Returns:** `'ok` envelope if the atom lowers to a real verb;
`'pending-visual` envelope otherwise.
**Backing:** `curator-web/src/scheme/spriteVerbs.js:393-431`.

#### Novice
```scheme
(sprite 'blossom (carry "vase-001" 50 75))
```
*Source: pattern from `spriteVerbs.js:7` — lowers to `move-card`*

#### Intermediate
```scheme
(sprite 'rose (in-order (turn 90) (flash "glow")))
```
*Source: example from `spriteVerbs.js:10`*

#### Expert
```scheme
;; quoted-list form is the ONLY way to reach `when` (collides with the
;; interpreter special form). spriteVerbs.js:36 documents this.
(sprite 'lilac '(when (rest) (flash glow)))
```
*Source: `curator-web/src/scheme/spriteVerbs.js:36`*

---

### `(sprites who form...)`

**Returns:** envelope per-resolved-sprite or per-crowd.
**Backing:** `spriteVerbs.js:436`.
**Wired:** yes — family addressing through `the-pinks`,
`the-purples`, `the-neutrals`, `everyone` (spriteVerbs.js:434).

#### Novice
```scheme
(sprites '(blossom rose coral) (rest))
```
*;; generated example*

#### Intermediate
```scheme
(sprites 'the-pinks (gather '#anchor/center))
```
*;; generated example, family from spriteVerbs.js:433-434*

#### Expert
```scheme
;; everyone bows in sequence
(sprites 'everyone
         (in-order (bow)
                   (wait-for 400)
                   (rest)))
```
*;; generated example*

---

### `(carry id x y)`

**Returns:** lowers to `(move-card id x y)`.
**Backing:** `spriteBehaviors.js:98` (atom); `cardVerbs.js:307`
(move-card backing).
**Wired:** yes.

#### Novice
```scheme
(sprite 'blossom (carry "vase-001" 50 75))
```
*Source: `spriteVerbs.js:7`*

#### Intermediate
```scheme
(sprite 'cedar (carry (ctx-get 'item-id ctx)
                      (ctx-get 'target-x ctx)
                      (ctx-get 'target-y ctx)))
```
*;; generated example*

#### Expert
```scheme
(for-each
  (lambda (item)
    (sprite 'gray (carry (assq 'id item) (assq 'x item) (assq 'y item))))
  (ctx-get 'manifest ctx))
```
*;; generated example*

---

### `(go-to addr)` / `(visit addr)` / `(follow target)` / `(rest)`

**Backing:** `spriteBehaviors.js:92-107` atoms.
**Wired:** `(rest)` lowers honestly to an idle; others
return `['pending-visual', …]` envelopes until the engine wires
them. **Wired: partial.**

#### Novice
```scheme
(sprite 'mint (go-to '#anchor/top-right))
(sprite 'fern (rest))
```
*;; generated example, anchors from `make-character` addressing*

#### Intermediate
```scheme
(sprites 'the-neutrals (line-up '#anchor/center))
```
*;; generated example*

#### Expert
```scheme
;; choreography — gather, recruit, settle
(sprite 'coral
        (in-order (gather '#anchor/coral-spot)
                  (recruit '(amber butter))
                  (rest)))
```
*;; generated example, atoms from spriteBehaviors.js:92-107*

---

### `(flash target [magic])` / `(point-at target)` / `(beckon target)` / `(bow)` / `(wear emoji)`

**Backing:** `spriteBehaviors.js:99-100`.
**Wired:** `(flash …)` lowers to `card-effect`. Others =
`['pending-visual', …]`. **Wired: partial.**

#### Novice
```scheme
(sprite 'rose (flash "glow"))
```
*Source: `spriteVerbs.js:10`*

#### Intermediate
```scheme
(sprite 'lilac (point-at '#card/cortex))
(sprite 'amber (wear '🎀))
```
*;; generated example*

#### Expert
```scheme
(sprite 'blossom
        (together (flash 'glow)
                  (point-at '#card/sale-card)
                  (bow)))
```
*;; generated example, combinator from spriteBehaviors.js:113*

---

### `(turn deg)` / `(size factor)`

**Backing:** `spriteVerbs.js:91-95`; clamps in CLAMPS.
**Wired:** yes — clamped envelope (`pending-visual`).

#### Novice
```scheme
(sprite 'rose (turn 90))
```
*Source: `spriteVerbs.js:9`*

#### Intermediate
```scheme
(sprite 'mint (size 2.0))
```
*Source: `spriteVerbs.js:8`*

#### Expert
```scheme
(sprite 'sky
        (in-order (size 1.5)
                  (turn 180)
                  (with-pace 0.5
                             (in-order (go-to '#anchor/sky-spot)
                                       (rest)))))
```
*;; generated example*

---

### `(in-order …)` / `(together …)` / `(repeat-until pred …)` / `(with-pace n …)` / `(as-crowd …)`

**Backing:** `spriteBehaviors.js:113-115` combinators.
**Wired:** yes — pure constructors, frozen specs.

#### Novice
```scheme
(sprite 'blossom (together (flash "glow") (rest)))
```
*;; generated example*

#### Intermediate
```scheme
(sprite 'coral (in-order (gather '#anchor/center)
                          (rest)
                          (bow)))
```
*;; generated example*

#### Expert
```scheme
;; repeat-until pattern for a watcher
(sprite 'mint
        (repeat-until (lambda () (eq? (ctx-get 'done ctx) #t))
                      (in-order (visit '#anchor/queue)
                                (rest))))
```
*;; generated example*

---

### `(dance 'clip-name)`

**Backing:** declared in spriteBehaviors atoms list as a clip atom;
not yet wired to a clip player.
**Wired:** no — `['pending-visual', …]` envelope; honest.

#### Novice
```scheme
(sprite 'blossom (dance 'waltz))
;; → pending-visual envelope, never an unannounced no-op
```
*;; generated example*

#### Intermediate
```scheme
(sprites 'the-pinks (dance 'flower-conga))
```
*;; generated example*

#### Expert
```scheme
;; honest fallback when the clip player isn't wired
(let ((result (sprite 'rose (dance 'spin-finale))))
  (cond
    ((eq? (car result) 'pending-visual)
       (sprite 'rose (in-order (turn 360) (rest))))
    (else result)))
```
*;; generated example*

---

## 9. Note + music verbs

Bound by `installNoteVerbs` (`curator-web/src/scheme/noteVerbs.js:92`).
Audio is gated by a user gesture (`audioLive()`); first call without
gesture returns `'pending-audio'` envelope — honest.

**Wired:** yes (all 5 listed).

### `(note pitch [dur] [velocity])`

**Returns:** `(ok (note … spec …))` or `(pending-audio …)`.
**Backing:** `curator-web/src/scheme/noteVerbs.js:96-123`.

#### Novice
```scheme
(note 'c4 'quarter)
```
*Source: pattern from `noteVerbs.js:95`*

#### Intermediate
```scheme
(note 'e4 'eighth 0.6)
```
*;; generated example*

#### Expert
```scheme
;; sequence of notes, audio-gated
(for-each (lambda (p) (note p 'eighth 0.8))
          '(c4 d4 e4 f4 g4 a4 b4 c5))
```
*Source: pattern from form/scale macro (primitives/macros.js:228-238)*

---

### `(note-place pitch [stave] [clef])`

**Returns:** `(ok (note … y … clef …))`.
**Backing:** `noteVerbs.js:127-146`.

#### Novice
```scheme
(note-place 'e4 0 'treble)
```
*;; generated example*

#### Intermediate
```scheme
(note-place 'g4 1 'bass)
```
*;; generated example*

#### Expert
```scheme
;; place a sequence at known stave geometry
(for-each (lambda (p) (note-place p 0 'treble))
          '(c4 e4 g4))
```
*;; generated example*

---

### `(note-dots pitch [dur] [stave] [clef])`

**Returns:** the deterministic `{x,y,fill}` cells of the note glyph.
**Backing:** `noteVerbs.js:152-168`.

#### Novice
```scheme
(note-dots 'e4 'quarter)
```
*;; generated example*

#### Intermediate
```scheme
(let ((cells (note-dots 'f4 'eighth 0 'treble)))
  (paint-dots cells))
```
*;; generated example*

#### Expert
```scheme
;; render the dot-matrix flag of a sixteenth note
(let ((c (note-dots 'a4 'sixteenth 0 'treble)))
  (paint-dots (assq 'dots c)))
```
*;; generated example*

---

### `(staff-lines [w] [h] [clef])`

**Returns:** geometry alist (lineCount, lineYs, gap, …).
**Backing:** `noteVerbs.js:171-188`.

#### Novice
```scheme
(staff-lines 600 200 'treble)
```
*;; generated example*

#### Intermediate
```scheme
(let ((g (staff-lines 800 240 'bass)))
  (paint-line (list 0 (assq 'firstLineY g))
              (list 800 (assq 'firstLineY g))
              'gray))
```
*;; generated example*

#### Expert
```scheme
;; render every line of the active stave
(let ((g (staff-lines 800 240 'treble)))
  (for-each (lambda (s)
              (for-each (lambda (y)
                          (paint-line (list 0 y) (list 800 y) 'gray))
                        (assq 'lineYs s)))
            (assq 'staves g)))
```
*;; generated example*

---

### `(tempo bpm)`

**Returns:** `(ok (bpm … secondsPerBeat …))`.
**Backing:** `noteVerbs.js:191-203`.
**Side effects:** mutates the shared transport singleton.
**Wired:** yes.

#### Novice
```scheme
(tempo 96)
```
*;; generated example, pattern from noteVerbs.js:191*

#### Intermediate
```scheme
(define (start ctx)
  (tempo 120)
  (next 'play ctx))
```
*;; generated example*

#### Expert
```scheme
;; slow ramp via a sequence of tempo calls
(for-each (lambda (b) (tempo b))
          '(120 110 100 90 80))
```
*;; generated example*

---

### `(chord pitches dur)` / `(rest dur)` / `(staff lines)` — macros from `musicSugar`

**Backing:** `curator-web/src/scheme/musicSugar.js`.
**Wired:** partial — sugar over the primitive `(note …)` verb.

#### Novice
```scheme
(chord '(c4 e4 g4) 'quarter)
```
*;; generated example, modelled on musicSugar*

#### Intermediate
```scheme
(in-order (chord '(c4 e4 g4) 'quarter)
          (rest 'quarter)
          (chord '(g4 b4 d5) 'quarter))
```
*;; generated example*

#### Expert
```scheme
;; chord progression: I — vi — ii — V in C
(in-order (chord '(c4 e4 g4) 'quarter)
          (chord '(a4 c5 e5) 'quarter)
          (chord '(d4 f4 a4) 'quarter)
          (chord '(g4 b4 d5) 'quarter))
```
*Source: chord roots from form/I-vi-ii-V (primitives/macros.js:212-218)*

---

### `(instrument name)` · `(section size)` · `(dynamics …)` · `(with-dynamics vals phrase)`

Score-orchestration markers (#512, 2026-07-03). All **additive and
default-OFF**: a `(part …)` with no marker lowers **byte-identical** to the
pre-#512 spec. `(instrument 'x)` names the DSP profile a part renders through;
`(section n)` doubles a line into `n` detuned desk players at offline render;
`(dynamics …)` / `(with-dynamics …)` stamp per-note velocity (loudness AND
brightness). Consumed by `musicSugar.js` + `tools/scoreToVoices.mjs`.

**Returns:** marker records the enclosing `(part …)` / `(score …)` consumes.
**Backing:** `curator-web/src/scheme/musicSugar.js` (markers), `curator-web/tools/scoreToVoices.mjs` (section expansion).
**Wired:** yes (offline render path). Live browser path reads pitch/dur/voice/at only — velocity/section are offline-only today.

#### Novice
```scheme
(part (instrument 'cello) (phrase (chord 'c3 'half)))
```

#### Intermediate
```scheme
;; a desk of six violins, each detuned/jittered from the seed
(part (instrument 'violin) (section 6) (phrase (chord 'e5 'quarter)))
```

#### Expert
```scheme
;; per-note velocity swell across a rising line
(part (instrument 'oboe)
      (with-dynamics '(0.3 0.5 0.7 0.9)
        (phrase (chord 'c5 'quarter) (chord 'd5 'quarter)
                (chord 'e5 'quarter) (chord 'f5 'quarter))))
```

---

### `(tempo-curve (at beat mul) …)` · `(hall …)` · `(reverb …)`

Top-level score markers (#512, 2026-07-03), **additive, default-OFF**.
`(tempo-curve …)` compiles control points into an interpolating rubato
function (>1 pushes, <1 broadens); `(hall …)` / `(reverb …)` attach a
Freeverb preset. A score with none of these lowers byte-identical.

**Returns:** marker the `(score …)` consumes → `spec.tempoCurve` / `spec.reverb`, stamped ONLY when present.
**Backing:** `curator-web/src/scheme/musicSugar.js`, applied by `curator-web/tools/scoreToVoices.mjs` + `tools/orchestra.mjs`.
**Wired:** yes (offline render path).

#### Novice
```scheme
(score (reverb 'concert) (part (phrase (chord 'c4 'whole))))
```

#### Intermediate
```scheme
;; broaden into the final cadence
(score (tempo-curve (at 0 1.0) (at 30 1.0) (at 34 0.72))
       (part (phrase (chord 'a3 'half))))
```

#### Expert
```scheme
(score (tempo-curve (at 0 0.9) (at 8 1.05) (at 10 0.82))
       (hall 'chamber)
       (part (instrument 'piano) (with-dynamics '(0.42 0.9 0.5) …)))
```

---

### `(define-instrument name field…)`

Mints a **frozen, renderable** DSP profile keyed by `name` (#514,
2026-07-03). The eleven built-ins (`piano cello violin viola contrabass
flute oboe clarinet bassoon horn pizz`) are seeds and **cannot be shadowed**.
Fields: `family` (`struck`/`bowed`/`wind`), `partials`, `inharm`, `spectrum`,
`decay`, `attack`, `release`, `bright-vel`, `formants`, `pan`.

**Returns:** `(ok …)`, else honest-null:
- seed name reused → `(escalate 'instrument-name-taken)`
- profile would not render → `(escalate 'mod-would-not-render {field})` — **nothing registered**.

**Backing:** `curator-web/src/scheme/instrumentRegistry.js`.
**Wired:** yes (registry) — offline render consumes the profile; live browser render is `service-not-yet-wired`.

#### Novice
```scheme
(define-instrument 'nylon-guitar (list 'family 'struck) (list 'partials 18))
```

#### Intermediate
```scheme
(define-instrument 'clean-strat
  (list 'family 'struck) (list 'partials 20) (list 'inharm 0.0003)
  (list 'spectrum (list 'rolloff -0.7 14)) (list 'pan 0))
```

#### Expert
```scheme
(define-instrument 'glass-harmonica
  (list 'family 'bowed) (list 'partials 16) (list 'inharm 0.0)
  (list 'spectrum (list 'odd -0.6 12))
  (list 'attack 0.02) (list 'release 0.4) (list 'bright-vel 0.5)
  (list 'formants (list (list 'f 800) (list 'bw 120) (list 'gain 0.5))))
```

---

### `(mod-instrument name (from base) delta…)`

Registers `name` as a **pure profile→profile delta** over a frozen `base`
(#514, 2026-07-03). Delta operators (spec §B.2): `set` · `add-partial` ·
`scale-env` · `scale` · `replace-noise` · `add-formant` · `replace-spectrum`.
The base is never mutated; a non-finite scale (`NaN`) is filtered to a no-op
(stays renderable, does not corrupt).

**Returns:** `(ok {from})`, else honest-null:
- unknown base → `(escalate 'base-instrument-unknown)`
- resulting profile would not render → `(escalate 'mod-would-not-render {field})` — **nothing registered**.

**Backing:** `curator-web/src/scheme/instrumentRegistry.js`.
**Wired:** yes (registry) — offline render only; live browser render `service-not-yet-wired`.

#### Novice
```scheme
(mod-instrument 'cello.warm (from 'cello) (scale-env ':release 1.2))
```

#### Intermediate
```scheme
(mod-instrument 'les-paul (from 'clean-strat)
  (set ':distortion 0.8) (add-partial 7 0.3))
```

#### Expert
```scheme
;; a seed base modded into a new community instrument
(mod-instrument 'cello.warm-community (from 'cello)
  (add-formant 250 90 0.5)
  (scale-env ':decay 1.4)
  (scale ':inharm 1.1))
```

---

### `music/*` — the named music catalog (director interface)

The **interface layer** Sakura uses to DIRECT music the way she directs the
animation surface: she selects a musical intent **by name** and the verb lowers
it onto the existing music floor (`musicSugar`'s `phrase`/`score`/`part`/
`together`/`transpose`/`canon`, the instrument registry, the reverb halls).
Symmetric to the animation choreography library + `desk/*` director verbs —
*composition over re-implementation* (every verb delegates to bound floor
verbs; nothing is re-implemented). The named catalog lives in
`curator-web/src/scheme/musicLibraryRegistry.js`: **8 mood motifs** (calm ·
focus · joy · wonder · melancholy · energy · grand · tender) and **7 ensembles**
(solo · string-quartet · string-section · woodwind-trio · wind-quintet ·
brass-and-reed · chamber).

> **Re-home note (2026-07-03):** the ambient looping-scene themes
> (rain-window, shoreline …) were re-homed from `music/*` to the **radio
> interface** — they belong to the radio surface, not the music studio. See
> the `radio/*` verbs below.

| Verb | Selects | Returns |
|---|---|---|
| `(music/motif 'name [:transpose N] [:instrument 'x] [:hall 'y])` | a named mood motif | `(ok 'motif {spec})` |
| `(music/mood 'name)` | a mood → its motif at its own tempo/instrument/hall | `(ok 'mood {spec})` |
| `(music/ensemble 'ens 'motif)` | spread a motif across named players (parallel voices) | `(ok 'ensemble {spec})` |
| `(music/canon 'motif [:voices N] [:delay D])` | the canon transform over a named seed | `(ok 'canon {spec})` |
| `(music/library [:kind 'motifs\|'ensembles])` | introspect the catalog | `(ok 'library {manifest})` |

**Backing:** `curator-web/src/scheme/musicDirectorVerbs.js` (verbs) +
`curator-web/src/scheme/musicLibraryRegistry.js` (catalog).
**Wired:** yes for motif/mood/ensemble/canon/library — they lower to the live
music floor.

#### Novice
```scheme
(music/mood 'calm)
```
*;; picks the calm cello motif at its own tempo + cathedral hall*

#### Intermediate
```scheme
;; spread the "wonder" motif across a woodwind trio
(music/ensemble 'woodwind-trio 'wonder)
```

#### Expert
```scheme
;; a four-voice canon on the "grand" fanfare
(music/canon 'grand :voices 4 :delay 2)
```

### `radio/*` — the named ambient scene-loop catalog

The **radio interface** owns the ambient looping-scene themes (re-homed from
`music/*` on 2026-07-03 — they belong to the radio surface, not the music
studio). The named catalog lives in
`curator-web/src/scheme/radioSceneLoops.js`: **16 themed ambient loops**
(rain-window · shoreline · night-drive · study-desk · city-window ·
forest-path · snowfall · fireplace · train-window · garden-dusk · desert-heat ·
aquarium · rooftop-night · coffee-shop · meadow-wind · harbor-fog) — empty
scenes, no people.

| Verb | Selects | Returns |
|---|---|---|
| `(radio/scene-loop 'name)` | a named ambient looping-scene theme (FLUX hook, #353) | `(ok 'scene-loop …)` **or** honest-null |
| `(radio/scene-library)` | introspect the scene-loop catalog | `(ok 'scene-library {manifest})` |

**Backing:** `curator-web/src/scheme/radioDirectorVerbs.js` (verbs) +
`curator-web/src/scheme/radioSceneLoops.js` (catalog).
**Wired:** `radio/scene-loop` is **honest-null** — every ambient scene slot
carries `asset: null` until the Flux-generated looping assets land (task #353
FLUX-SCENE-LOOP-LIBRARY); the verb returns `(escalate 'service-not-yet-wired)`
with the theme + palette so the radio surface paints the fallback mood, and the
**same call** resolves the real asset once it drops in. No fake render, ever.
`radio/scene-library` is fully wired (pure catalog introspection).

#### Novice
```scheme
(radio/scene-loop 'rain-window)   ;; honest-null until the Flux asset lands
```

#### Intermediate
```scheme
;; what ambient scenes can Sakura pick?
(radio/scene-library)
```

#### Expert
```scheme
;; reveal the ambient scene behind the radio surface
(radio/scene-loop 'rooftop-night)   ;; honest-null until the Flux asset lands
```

---

## 10. FX + animation atoms

FX verbs are installed by `installFxVerbs`
(`curator-web/src/scheme/fxVerbs.js:96-208`). Timeline / animate /
keyframe / easing return frozen specs the renderer reads. `random`
is the seeded PRNG (env-local) so cart replay is byte-identical.

**Wired:** yes — all 8 listed; `surface-dusk` and `on-canvas-trace`
both fully wired.

### `(timeline track …)` / `(keyframe at val)` / `(animate target prop from to ms easing)`

**Backing:** `fxVerbs.js:113-155`.

#### Novice
```scheme
(timeline (keyframe 0 0) (keyframe 1000 100))
```
*;; generated example*

#### Intermediate
```scheme
(timeline (animate '#card/sale-card 'opacity 0 1 800 'ease-out))
```
*;; generated example*

#### Expert
```scheme
;; multi-track timeline with loop
(timeline (animate '#sprite/blossom 'rotate 0 360 4000 'linear)
          (animate '#sprite/blossom 'scale 1.0 1.2 2000 'ease-in-out)
          (loop))
```
*;; generated example*

---

### `(easing name)` / `(loop)`

**Backing:** `fxVerbs.js:160-167, 135`.

#### Novice
```scheme
(easing 'ease-out)
```
*;; generated example*

#### Intermediate
```scheme
(animate '#card/cortex 'y 100 200 600 (easing 'ease-in-out))
```
*;; generated example*

#### Expert
```scheme
;; honest fallback — unknown easing falls back to 'linear (fxVerbs.js:163-167)
(easing 'wibble)
;; → spec with name 'linear and fn = linear
```
*Source: `fxVerbs.js:163-167`*

---

### `(random-seed! n)` / `(random)`

**Backing:** `fxVerbs.js:173-176`.
**Wired:** yes. The ONLY entropy source in the FX surface — determinism
law §7.12.

#### Novice
```scheme
(random-seed! 42)
(random)
;; → seeded float in [0,1)
```
*;; generated example*

#### Intermediate
```scheme
(define (jitter base)
  (+ base (* 4 (- (random) 0.5))))
```
*;; generated example*

#### Expert
```scheme
;; deterministic cart replay — seed once at start
(define (start ctx)
  (random-seed! (ctx-get 'replay-seed ctx))
  (next 'paint ctx))
```
*;; generated example*

---

### `(surface-dusk level [opts])` / `(on-canvas-trace handler)`

**Backing:** `fxVerbs.js:183-205`.
**Wired:** yes — dusk lifts the dusk pocket; on-canvas-trace is the
connect-the-dots trace handler.

#### Novice
```scheme
(surface-dusk 0.4)
```
*;; generated example*

#### Intermediate
```scheme
(begin
  (surface-dusk 0.6)
  (paint-spotlight '#anchor/center 200))
```
*;; generated example*

#### Expert
```scheme
(on-canvas-trace
  (lambda (samples)
    (when (> (length samples) 8)
      (paint-flow (car samples) (last samples) 'glyph/dot 6 'sakura-pink))))
```
*;; generated example*

---

### `surface/dim` / `surface/spotlight` / `surface/curtain` (core verbs)

**Backing:** `curator-web/src/scheme/registry/coreVerbs.js:123-155`.
**Wired:** yes (signature contract; engine lane wires the body).

#### Novice
```scheme
(surface/curtain 0.7 :ms 8000)
```
*Source: `curator-web/src/scheme/carts/scenes/bedtime-story-engine.sks:135`*

#### Intermediate
```scheme
(surface/spotlight '#anchor/center :radius 220 :softness 100 :ms 8000)
```
*Source: `curator-web/src/scheme/carts/scenes/bedtime-story-engine.sks:136`*

#### Expert
```scheme
;; surface/stage macro: dim + spotlight at one beat
(surface/stage :dim 0.8 :ms 4000)
```
*Source: pattern from primitives/macros.js:251-253*

---

## 11. Card surface verbs

Installed by `installCardVerbs` (`curator-web/src/scheme/cardVerbs.js:88`).
Cards are addressable via `(card-do …)`, `(card-emit …)`,
`(card-ask …)`, with a manifest layer for verb resolution. The
manifest registry lives in `surface/card-api/`.

**Wired:** mostly yes — see per-entry notes.

### `(card-do card-addr verb args)`

**Returns:** `(ok …)` from the card's verb body.
**Backing:** primitive at `curator-web/src/scheme/primitives/card.js:140 · env.define('card/do', cardDo, …)` and `:146 · env.define('card-do', cardDo, …)` (the slash form + legacy hyphen). Runtime resolution in `cardVerbs.js`.
<!-- DOC-LIE-FIXED (SRE 2026-06-22): prior citation `coreVerbs.js:158-168` is STALE — `card-do` / `card-emit` / `card-ask` are NOT in `registry/coreVerbs.js` (grep confirms zero hits). They live in `primitives/card.js:140-170`. The same fix applies to the §card-emit and §card-ask entries below. -->

#### Novice
```scheme
(card-do shop 'set-free-shipping-threshold cents)
```
*Source: `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:22, 30`*

#### Intermediate
```scheme
(card-do '#card/shop-services 'read-gmail-folder folder)
```
*Source: `curator-web/src/scheme/carts/scenes/email-inbox.sks:26`*

#### Expert
```scheme
(card-do shop 'unpublish-listing listing)
```
*Source: `curator-web/src/scheme/carts/scenes/reconcile-sold.sks:18, 29`*

---

### `(card-emit card-addr event-name payload)`

**Returns:** EmitHandle.
**Backing:** `curator-web/src/scheme/primitives/card.js:152 · env.define('card/emit', cardEmit, …)` and `:158 · env.define('card-emit', cardEmit, …)`.
<!-- STALE-FIXED (SRE 2026-06-22): prior citation `coreVerbs.js:170-180` was wrong (verb is not in coreVerbs.js). -->

#### Novice
```scheme
(card-emit 'engine 'daily-brief-ready (length rows))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:197`*

#### Intermediate
```scheme
(card-emit 'engine 'free-shipping-shop-ok shop)
```
*Source: `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:65`*

#### Expert
```scheme
(card-emit 'engine 'free-shipping-attempted
           (list 'count (length shops)))
```
*Source: `curator-web/src/scheme/carts/scenes/free-shipping-standard.sks:50`*

---

### `(card-ask card-addr question)`

**Returns:** AnswerHandle (resolves async).
**Backing:** `curator-web/src/scheme/primitives/card.js:164 · env.define('card/ask', cardAsk, …)` and `:170 · env.define('card-ask', cardAsk, …)`.
<!-- STALE-FIXED (SRE 2026-06-22): prior citation `coreVerbs.js:182-192` was wrong. -->
**Wired:** partial — primitive signature shipped, resolver lane
in progress.

#### Novice
```scheme
(card-ask '#card/inventory 'item-count)
```
*;; generated example*

#### Intermediate
```scheme
(let ((q (card-ask '#card/cortex 'recent-topics)))
  (next 'render (ctx-set 'topics q ctx)))
```
*;; generated example*

#### Expert
```scheme
;; chain ask → act on answer
(card-ask '#card/shop-services 'connected-platforms)
```
*;; generated example*

---

### `(card-list)` / `(card-rows)` / `(card-kinds)` / `(card-find-by-kind kind)`

**Backing:** `cardVerbs.js:90-147`. All read verbs.

#### Novice
```scheme
(card-list)
;; → (("card-1" "chat") ("card-2" "shop-listing") ...)
```
*;; generated example, from cardVerbs.js:90*

#### Intermediate
```scheme
(card-find-by-kind 'shop-listing)
```
*;; generated example*

#### Expert
```scheme
(for-each (lambda (id)
            (card-emit id 'refresh-requested 'now))
          (card-find-by-kind 'shop-listing))
```
*;; generated example*

---

### `(card-open kind-or-id)` / `(card-close kind-or-id)` / `(card-focus! kind-or-id)`

**Backing:** `cardVerbs.js:156, 231, 250`. perm: animate.

#### Novice
```scheme
(card-open 'cortex)
```
*;; generated example*

#### Intermediate
```scheme
(define (start ctx)
  (card-open 'shop-services)
  (next 'await-connect ctx))
```
*;; generated example*

#### Expert
```scheme
;; focus, do work, restore
(begin
  (card-focus! (ctx-get 'target-card ctx))
  (act 'cortex/recall (list '(:topic context)) 'after-recall))
```
*;; generated example*

---

### `(move-card id x y)` / `(scale-card id w h)` / `(pin-card id value)`

**Backing:** `cardVerbs.js:307, 323, 374`.
**Wired:** yes.

#### Novice
```scheme
(move-card "card-1" 100 200)
```
*;; generated example*

#### Intermediate
```scheme
(scale-card listing-card 240 96)
```
*;; generated example*

#### Expert
```scheme
;; bricklay-pack-native is the native packer (base.js:396); the cart
;; reads the result list and dispatches per-card move
(for-each (lambda (placement)
            (move-card (car placement)
                       (nth placement 1)
                       (nth placement 2)))
          (bricklay-pack-native cards 800 16 16 8 8))
```
*Source: pattern from base.js:355-504 (bricklay-pack-native)*

---

### `(transfer src-card dst-card item-ids)`

**Returns:** `(ok …)` or `(error …)` envelope.
**Backing:** `cardVerbs.js:434`. Gated; financial when underlying op is.
**Wired:** yes (with confirmation gate).

#### Novice
```scheme
(transfer src-card dst-card (list "vase-001"))
```
*;; generated example*

#### Intermediate
```scheme
(transfer (ctx-get 'src ctx) (ctx-get 'dst ctx) (ctx-get 'items ctx))
```
*;; generated example*

#### Expert
```scheme
;; transfer-shop-to-shop scene pattern
(begin
  (paint-glow src 'sakura 600)
  (paint-flow src dst 'glyph/box 8 'sakura-pink)
  (transfer src dst items)
  (paint-glow dst 'sakura 600))
```
*Source: pattern from `carts/scenes/transfer-shop-to-shop.sks:132-133`*

---

### `(summon kind)`

**Returns:** newly-summoned card id.
**Backing:** `cardVerbs.js:684`.

#### Novice
```scheme
(summon 'chat)
```
*;; generated example*

#### Intermediate
```scheme
(let ((c (summon 'shop-listing)))
  (card-do c 'set-title "rustic ceramic vase"))
```
*;; generated example*

#### Expert
```scheme
;; summon, configure, focus
(let ((c (summon 'sims)))
  (begin
    (card-do c 'load-sim 'pricing-ladder)
    (card-focus! c)))
```
*;; generated example*

---

### `(card/tiles)` / `(card/where card-name)` / `(card/move card-name :to [col row])` / `(card/swap a b)` / `(card/organize)`

**Namespace:** `card` — grid control verbs.
**Backing:** `curator-web/src/scheme/cardControlVerbs.js:1-226`.
**Wired:** yes.

These five verbs address cards by tile coordinate on the `HelloSurface`
grid (`TILE=96, GAP=20`). They registered in `VerbRegistry` under the
`card` namespace via `registerCardControlVerbs` (2026-06-17).

**Motion modes for `card/move`:** `:slide` (CSS transition), `:warp`
(keyframe warp-out/in via `@keyframes card-warp-out/in` in
`HelloSurface.jsx`), `:carry` (Sakura sprite carries the card along
a computed path).

#### Novice
```scheme
;; card/tiles — get grid map
(card/tiles)
;; → ((0 0 "shop-listing") (1 0 "cortex") (2 0 "analytics") …)

;; card/where — find a card
(card/where "shop-listing")
;; → (0 0)

;; card/move — move to tile [col row]
(card/move "analytics" :to [3 0])
```
*Source: `curator-web/src/scheme/carts/corpus/card-control-corpus.jsonl:1-4`*

#### Intermediate
```scheme
;; slide analytics card to top-right corner
(card/move "analytics" :to [8 0] :mode :slide)

;; swap two cards
(card/swap "shop-listing" "analytics")

;; organize all cards into groups
(card/organize :group-by 'kind)
```
*Source: `curator-web/src/scheme/carts/corpus/card-control-corpus.jsonl:12-20`*

#### Expert
```scheme
;; "Shop Services" scene: warp cortex card center-stage, slide others aside
(let ((center [4 1]))
  (begin
    (card/move "cortex" :to center :mode :warp)
    (for-each (lambda (c)
                (unless (equal? (car c) "cortex")
                  (card/move (car c)
                              :to (list (+ (nth center 0) 3) (nth c 2))
                              :mode :slide)))
              (card/tiles))))
```
*Source: pattern from shop-services scene director; `cardControlVerbs.js:88-130`*

---

### `(card/walk id 'gait tx ty [ms])` — and 8 gait-shorthand verbs

**Returns:** `('ok 'animating {verb,gait,duration,id})` while the rAF walk runs;
`('ok 'snapped {…})` when `prefers-reduced-motion: reduce` is active;
`('error 'bad-arg {…})` on a bad numeric / id; `('error 'service-not-yet-wired
{verb,reason,known:[…]})` on an unknown gait name.
**Backing:** `curator-web/src/scheme/cardWalkVerbs.js:166-279` (installer);
gait curves in `curator-web/src/paint/primitives/cardWalk.js:90-194`.
**Permission tier:** `state-change` (powerTier `animate`).
**Wired:** yes — the verb composes `paintCardWalk` against the overlay clock and
`cardBridge.cardMove`; tested in `cardWalkVerbs.test.js`.
**Honest-null:** unknown gait → `['error','service-not-yet-wired',{verb:'card/walk',
reason:"unknown gait '<name>'",known:[…GAIT_NAMES]}]`. Card has no current
position (boot phase / not placed) → snaps to target, returns
`['ok','snapped-no-start',…]` rather than fabricating a start point.
**Cross-refs:** ENGINEERING §AB (Walk grammar) · AUTOMATIONS sidecar
`sakura-walk-corpus.jsonl` · `docs/CARD-WALK-REALISM-ZANE-2026-06-21.md`.

The 8 gait-shorthand verbs `(card/amble id tx ty [ms])`,
`(card/skip …)`, `(card/run-and-slow …)`, `(card/waddle …)`,
`(card/bounce-stride …)`, `(card/prowl …)`, `(card/stomp …)`,
`(card/glide-pause …)` each delegate to `card/walk` with the gait baked in.
Same envelope shape, same permission tier, same honest-null behaviour.

Duration scales with distance and the card's `weight` axis from
`cardPersonality` (see §AB): `duration_ms = base_ms × clamp(0.6,
distance/200, 2.0) × (1 + 0.15 × (weight − 1)) × paceScale`. The verb
stamps `--card-weight / --card-pace-ms / --card-overshoot` on the card
DOM element so `cards.css` keyframes can read them per tick.

#### Novice
```scheme
;; just walk a card to a tile centre
(card/amble 'shop-explorer-1 400 200)
```
*Source: `curator-web/src/scheme/carts/sakura-walk-corpus.jsonl:8`*

#### Intermediate
```scheme
;; a card got good news — celebrate as it moves
(card/skip 'shop-explorer-3 800 400)
```
*Source: `curator-web/src/scheme/carts/sakura-walk-corpus.jsonl:1`*

#### Expert
```scheme
;; a red trigger fired — slam the alert into place with a 1.18/0.82 landing
(card/walk 'alert-cost-overrun 'stomp 640 400 900)
```
*Source: pattern from `sakura-walk-corpus.jsonl:3`; gait config
`cardWalk.js:192`.*

---

### `(card-effect id 'tilt|'lift|'swing)` — new card-motion effects (2026-06-21)

**Returns:** `'ok` after the one-shot class fires; `['pending-visual', …]`
when no target element is mounted; `['error', 'effect-not-allowed', …]`
on `'shadow` (the glow-never-shadow rejection); `['error', 'unknown-effect',
…]` on an unknown effect name.
**Backing:** `curator-web/src/scheme/cardVerbs.js:758-770` (CARD_EFFECT_CLASS);
keyframes in `curator-web/src/styles/cards.css` (`sakura-fx-tilt`,
`sakura-fx-lift`, `sakura-fx-swing`).
**Permission tier:** `paint`.
**Wired:** yes — `tilt` (900ms), `lift` (1100ms), `swing` (1300ms); composed
via the same one-shot `oneShotEffectClass` idiom motionVerbs.js:67 used.
**Honest-null:** silent-failure VETO #1 — if the card's DOM cell isn't mounted
the verb returns `['pending-visual', …]`, never claims `'ok'`.
**Cross-refs:** ENGINEERING §AB (2-mode engine — Mode B whimsy paints).

These three names extend the existing `card-effect` verb's
`CARD_EFFECT_CLASS` table; they share the verb signature
`(card-effect id 'effect-name [args])`. The full set on disk today is
`'glow 'pulse 'shimmer 'sparkle 'echo 'ghost 'bloom 'tilt 'lift 'swing`.

#### Novice
```scheme
;; one-shot lift on a card that just earned a milestone
(card-effect 'shop-explorer-2 'lift)
```
*;; generated example — tied to `paintWhimsy.js:104`*

#### Intermediate
```scheme
;; a draft was just rejected; tilt the listing card as a soft "nope"
(card-effect 'draft-pending-review 'tilt)
```
*;; generated example*

#### Expert
```scheme
;; weekly-summary cohort: swing each shop card by 80ms apart for the marquee
(let ((shops (card-find-by-kind 'shop-explorer)))
  (for-each (lambda (id) (card-effect id 'swing)) shops))
```
*;; generated example; intensity decay drives whether this even fires —
see `celebrationIntensity.js:165`.*

---

### `(card/activity id label expected-ms)` / `(card/activity-done id)` / `(card/activity-progress id 0..1)`

**Returns:** `card/activity` returns an opaque `activity-id` string the
caller threads back into `card/activity-done`; the latter returns `'ok`
(idempotent — a stale id is a no-op). `card/activity-progress` clamps
to [0,1] and returns `'ok`.
**Backing:** `curator-web/src/scheme/cardVerbs.js:1061-1148` (verb
bindings); bus in `curator-web/src/lib/cardActivityBus.js:1-205`.
**Permission tier:** `paint` — every tier may call them.
**Wired:** yes — rainbow activity bar paints on the card's CardTemplate
chrome strip. Multiple concurrent activities on one card MERGE (bar stays
visible until the LAST `card/activity-done` fires; any indeterminate leg
makes the merged bar indeterminate).
**Honest-null:** unknown card id at begin → escalate via withStars; stale
`activity-id` at done → `'ok` (idempotent — silent no-op is the contract).
**Cross-refs:** ENGINEERING §X (Two-mode animation engine — Mode A).

#### Novice
```scheme
;; indeterminate bar — no measurable progress
(let ((aid (card/activity 'shop-explorer-1 "syncing" 0)))
  (card/activity-done aid))
```
*;; generated example*

#### Intermediate
```scheme
;; a fetch with a Content-Length hint
(let ((aid (card/activity 'cortex "indexing" 2400)))
  (card/activity-progress aid 0.5)
  (card/activity-done aid))
```
*;; generated example*

#### Expert
```scheme
;; two concurrent activities on the same card — bar merges (max progress)
(let ((a (card/activity 'shop-explorer-1 "list sync" 3000))
      (b (card/activity 'shop-explorer-1 "photo fetch" 1500)))
  (card/activity-progress a 0.3)
  (card/activity-progress b 0.9)
  (card/activity-done b)
  (card/activity-done a))
```
*;; generated example — merge semantics in `cardActivityBus.js:82-104`.*

---

### `(card/personality card-id)` — 4-axis Cortex read (read-only)

**Returns:** a 4-axis record `(familiarity pace_match directness weight)`
where each value is in `[0, 1]` (baseline `0.5`). Distress-paused →
returns baseline. prefers-reduced-motion → returns baseline.
**Backing:** `curator-web/src/lib/cardPersonality.js:1-399` (`read` export
imported by `cardWalkVerbs.js:63`).
**Permission tier:** `read` (Cortex personal — read-only at this seam).
**Wired:** yes — the `read()` JS API is consumed by `card/walk` to scale
weight/pace/overshoot. There is no surface-bound Scheme verb yet; carts
that want the axes use the underlying axis effects (heavier walk,
quicker pace) via gait shorthand. Direct verb registration lands when
the SYS panel + cart-author API is wired.
**Honest-null:** unknown card id → baseline record (never throws past
the module boundary; see `cardPersonality.js:48`).
**Cross-refs:** ENGINEERING §Y (Card personality drift); MEMORY
`project_card_personality_over_time`.

Axes:

- `familiarity` — opens-in-30d, drives walk-on cadence (shorter as it grows).
- `pace_match` — EWMA of operator gesture velocity; drives `--card-pace-ms`.
- `directness` — 30d confirmation_ratio; drives `--card-overshoot`.
- `weight` — revenue trend; drives `§4` walk-duration weight multiplier.

Drift is monotonically slow: gated until `DRIFT_GATE_OPENS=7` daily opens;
step size `PER_OPEN_STEP=0.02`. Jess floor in effect (no manipulative
recovery overshoot; pauseDriftWriting on distress; privacy stays local).

#### Novice
```scheme
;; carts don't read personality directly today — the gait shorthand does
;; it for them. The verb that triggers axis effects is just (card/walk …).
(card/amble 'shop-explorer-1 400 200)
```
*;; generated example — see `cardWalkVerbs.js:229-238`*

#### Intermediate
```scheme
;; pattern: a celebratory walk on an EARNED milestone reads the weight
;; axis automatically — bigger cards squash harder on land
(card/bounce-stride 'etsy-revenue 720 280)
```
*Source: `sakura-walk-corpus.jsonl:5`*

#### Expert
```scheme
;; the personality READ is a JS-side composition for now; carts get the
;; axis effects via the gait curves' duration-scaling formula
;; (see ENGINEERING §AB).
(card/walk 'analysis-cohort-2 'prowl 500 350)
```
*Source: `sakura-walk-corpus.jsonl:4`*

---

### `(imagine "word" [:seconds N])` / `(emoji-paint-pixel glyph cx cy [size])`

**Returns:** `imagine`: `'ok` on a glyph-resolved + painted scene;
`['escalate', 'service-not-yet-wired', {word, suggestion, reason}]` on
an unknown emoji name; `['escalate', 'tier-upgrade-needed',
{from:'pink', to:'green', seconds, word}]` when seconds > 20 (pink-tier
budget). `emoji-paint-pixel`: `'ok` after gridDot cells flow; `['pending-visual',
{glyph, source}]` when no substrate is mounted; `['error', 'rasterize failed']`
on a missing glyph table entry.
**Backing:** `curator-web/src/scheme/imagineVerbs.js:1-277`; emoji table at
`curator-web/src/lib/emojiTree.js`; rasterizer at
`curator-web/src/lib/emojiRasterizer.js`; substrate dot push at
`curator-web/src/sprites/flowers.js:206-217`.
**Permission tier:** `paint`.
**Wired:** yes — composition of `lookupEmoji → rasterizeEmoji → gridDot`,
plus a card-effect chip emit (`verb:'card-effect', kind:'imagine'`).
**Honest-null:** unknown word → escalate `'service-not-yet-wired` with a
suggestion to teach `emojiTree.data.js`; scene > 20s → escalate
`'tier-upgrade-needed` (ask the 8B green-tier composer); rasterize miss
→ `['pending-visual', …]`, never silent-success.
**Cross-refs:** AUTOMATIONS scene `imagine-on-canvas` (training pattern);
substrate dot push at `flowers.js:206`.

#### Novice
```scheme
;; paint a birthday cake on the substrate
(imagine "birthday cake")
```
*Source: `imagineVerbs.js:42` (the canonical four-step archetype).*

#### Intermediate
```scheme
;; a 15-second scene that auto-clears
(imagine "shooting star" :seconds 15)
```
*;; generated example*

#### Expert
```scheme
;; paint a glyph at exact world coords at large size (96px font raster)
(emoji-paint-pixel "🌸" 0 0 'large)
```
*;; generated example — `imagineVerbs.js:248-262`*

---

### `(fleet-do verb-name args... [:filter pred] [:parallel bool])` / `(fleet-each filter body)`

**Returns:** an array of `(shop-id . envelope)` pairs (one per matching
shop), OR `['error', 'service-not-yet-wired', {verb, reason:'no-matching-shops',
hint}]` on a filter that matches zero shops, OR `['error', 'operator-denied',
{verb, dispatchId, reason}]` on a destructive verb without operator
confirm. `fleet-each` returns the same `(shop-id . body-result)` shape.
**Backing:** `curator-web/src/scheme/fleetVerbs.js:448-498` (installer);
`runFleet` engine at `fleetVerbs.js:290-435`.
**Permission tier:** `state-change` (the underlying verb's perm is
checked per shop via `cardDo`; destructive verbs are gated by a SINGLE
fleet-confirm modal — never N modals).
**Wired:** yes — composes `connectedShops.getAllShops` × `cardApi.cardDo`;
emits `curator:fleet-action-progress` per shop completion (the
FleetActionStrip listens). Tested in `fleetVerbs.*.test.js`.
**Honest-null:** zero matching shops → escalate with hint; per-shop failure
surfaces in that shop's envelope while the aggregate still completes
(every shop is touched); destructive without confirm → no shop touched.
**Cross-refs:** ENGINEERING §AA (Fleet-wide action engine);
AUTOMATIONS sidecar `sakura-fleet-corpus.jsonl`.

Parallel default: every shop fires concurrently UNLESS the verb's
registry perm is `destructive`, in which case `fleet-do` falls back to
SEQUENTIAL dispatch so a rate-limit / token-revoke on shop A doesn't
race shop B. Operator may force parallel/sequential via `:parallel`.

#### Novice
```scheme
;; pause every shop for the holiday
(fleet-do 'pause-shop)
```
*Source: `sakura-fleet-corpus.jsonl:1` (training intent).*

#### Intermediate
```scheme
;; bump free-shipping threshold across every Etsy shop only
(fleet-do 'set-free-shipping-threshold 5000
          :filter (lambda (s) (eq? (cdr (assq 'platform s)) 'etsy)))
```
*;; generated example*

#### Expert
```scheme
;; per-shop body: write a Cortex note keyed by shop id (NOT a verb name)
(fleet-each (lambda (s) (eq? (cdr (assq 'platform s)) 'shopify))
            (lambda (s)
              (cortex/write (cdr (assq 'id s)) "holiday-paused")))
```
*;; generated example — `fleetVerbs.js:451-474`*

---

### `(scene/conveyor src-addr dst-addr listing-count)`

**Returns:** `{ok:#t, verb:'scene/conveyor, path, n, spawnedIds, staggerMs,
legDwellMs}` on success; `['escalate', 'service-not-yet-wired', {verb, reason}]`
when src or dst cards aren't on the surface (`cardCenter` returns null).
**Backing:** `curator-web/src/surface/scheme-host/sceneVerbs.js:556-675`;
spawn/move primitives from `curator-web/src/sprites/flowers.js:237-266`.
**Permission tier:** `paint`.
**Wired:** yes — bespoke 3-leg arc (src → midpoint → dst), pink-to-green
colour transition halfway, source `sparkle + bloom` on launch, target
`lift + glow` on arrival.
**Honest-null:** unresolved card center → escalate; src or dst missing →
escalate with the missing id named in the detail.
**Cross-refs:** AUTOMATIONS `conveyor-belt` cart; ENGINEERING §AA.

#### Novice
```scheme
;; ship 12 listings as flower sprites from one shop to another
(scene/conveyor 'etsy-shop-1 'ebay-shop-1 12)
```
*Source: `curator-web/src/scheme/carts/scenes/conveyor-belt.sks:85`.*

#### Intermediate
```scheme
;; resolve kinds to first instance, then run the belt
(let ((src (car (card-find-by-kind 'etsy-shop)))
      (dst (car (card-find-by-kind 'ebay-shop))))
  (scene/conveyor src dst 24))
```
*Source: pattern from `conveyor-belt.sks:51-66`*

#### Expert
```scheme
;; compose the belt with fade + bring-together so the scene reads as
;; "this shop's listings move there"
(surface-fade-others (list src dst))
(surface-bring-together src dst)
(scene/conveyor src dst 30)
(surface-restore)
```
*Source: `conveyor-belt.sks:75-99`.*

---

### `motion/transfer · motion/wave · motion/scatter · motion/march · motion/gather · motion/orbit · motion/settle · motion/fade · motion/celebrate · motion/point-at · motion/glide-to` — 11 honest-null escalators

**Returns:** every one of the 11 verbs returns
`['escalate', 'service-not-yet-wired', {verb, args, reason:'archetype
motion verb has no runtime impl yet'}]`.
**Backing:** `curator-web/src/surface/scheme-host/sceneVerbs.js:715-740`
(the `archetypeMotionVerbs` array + `archetypeNotWired` factory).
**Permission tier:** `state-change`.
**Wired:** **no — returns `escalate 'service-not-yet-wired`** on every
call. They're bound so the ~24k-entry `sakura-corpus-archetypes` corpus
can dispatch cleanly (no `'unknown-verb'` crash) and so dialect-lint
allow-lists stay aligned with what the runtime exposes. When a real
impl ships (composed from `grid/flower-spawn!`, `grid/flower-go-to!`,
or `card-effect`), it REPLACES the binding — operator-visible envelope
stays compatible.
**Honest-null:** that IS the contract — the escalator IS the wire.
**Cross-refs:** CLAUDE.md "Honest nulls, no fluent-wrong" rule; ENGINEERING
§AB (the corpus the escalators serve).

#### Novice
```scheme
;; one of these is in the archetype corpus — every cart that calls it
;; gets a clean escalate today
(motion/wave 'shop-card '#card/cortex 800)
```
*;; generated example — escalate envelope per `sceneVerbs.js:728-731`.*

#### Intermediate
```scheme
;; cart authors compose with the escalate path so the cart STILL completes
(let ((envelope (motion/scatter (card-list))))
  (cond ((and (pair? envelope) (eq? (car envelope) 'escalate))
         ;; degrade — paint a static settle instead
         (motion/settle))
        (else 'ok)))
```
*;; generated example — same composition pattern as the corpus's
fallback ladder.*

#### Expert
```scheme
;; a scene-runner that observes every escalate and emits one chip for
;; the chat ("scene N motion verbs still escalate — corpus is ahead of
;; runtime by this much")
(for-each (lambda (v)
            (let ((env (v 'a 'b)))
              (when (and (pair? env) (eq? (car env) 'escalate))
                (card-emit 'engine 'motion-escalate (list (cadr env))))))
          (list motion/transfer motion/wave motion/scatter
                motion/march motion/gather motion/orbit
                motion/settle motion/fade motion/celebrate
                motion/point-at motion/glide-to))
```
*;; generated example — composition over the bound symbols at
`sceneVerbs.js:731-740`.*

---

### `(paint-conway-via-dot-grid palette [opts])` — Conway-on-dot-substrate

**Returns:** `'ok` (visual side-effect via the gridDot path).
**Backing:** `curator-web/src/scheme/conway.js:1008-1247`
(`paintConwayViaDotGrid`); exported at `conway.js:1511`.
**Permission tier:** `paint`.
**Wired:** yes — pushes cells into the same `_pendingDots` channel
`gridDot` uses (`flowers.js:206`); the rAF handle the flower engine
owns paints them.
**Honest-null:** no substrate (test env) → no-op; the canonical Conway
verbs (`installConwayVerbs`) still pass-through.
**Cross-refs:** the Conway-on-dots proof; ENGINEERING §X (the dot
substrate is shared by Mode A activity AND whimsy paint).

#### Novice
```scheme
;; paint the canonical pink-on-substrate Conway
(paint-conway-via-dot-grid 'pink)
```
*;; generated example*

#### Intermediate
```scheme
;; trace-alpha = 0.6 — older Conway generations decay slower
(paint-conway-via-dot-grid 'pink :trace-alpha 0.6)
```
*;; generated example*

#### Expert
```scheme
;; weekly-summary visual: Conway in shop palette, behind the activity bar
(paint-conway-via-dot-grid 'sakura-magic :trace-alpha 0.4)
```
*;; generated example — see `conway.js:1317`.*

---

### `(grid-dot x y colour [alpha])` / `(clear-grid-dots)` — substrate dot write

**Returns:** `'ok` (write-only side-effect).
**Backing:** `curator-web/src/sprites/flowers.js:206-217`.
**Permission tier:** `paint`.
**Wired:** yes — same `_pendingDots` channel `paintConwayViaDotGrid` +
`imagine` use; the flower engine's rAF handle paints them.
**Honest-null:** no `flower handle` (jsdom / SSR) → push to the pending
buffer; `_mountFlowers()` consumes it on next mount.
**Cross-refs:** `imagineVerbs.js:93` (the cells-to-dots loop);
ENGINEERING §X (substrate write surface).

#### Novice
```scheme
;; one purple dot at world origin
(grid-dot 0 0 'sakura-magic)
```
*;; generated example*

#### Intermediate
```scheme
;; alpha-faded scatter for "the room is quieting"
(for-each (lambda (xy)
            (grid-dot (car xy) (cdr xy) 'pink 0.4))
          (list (cons -40 0) (cons 0 -40) (cons 40 0)))
```
*;; generated example*

#### Expert
```scheme
;; clear the substrate before painting the next scene
(clear-grid-dots)
(imagine "sakura blossom")
```
*;; generated example — same idiom as `flowers.js:217`.*

---

## 12. Sakura on-device verbs

Sakura's verbs are ACT-DISPATCHED. They route to the on-device Sakura
savant (L0 — Sakura's 1.7B model running in the operator's browser)
or — when explicitly authorized — to the L2 vendor reasoning lane.
Each returns honest result tags via `ctx-result`.

**Wired:** partial — `sakura/decide` (on-device) routes through the
cart driver to the local model when available, else returns
`'service-not-yet-wired` honestly. `sakura/cloud-reason`,
`sakura/relay`, `sakura/handoff`, and `sakura/dream` are
manifest-declared and route through the cart driver; the underlying
sessions return `'service-not-yet-wired` until the per-tier auth
lands.

### `(act 'sakura/decide (list task-tag args) 'on-result)`

```verb-card sakura/decide pink
```

**Returns:** via `ctx-result`: the structured reply, or one of
`'sakura-empty | 'sakura-garbled | 'rate-limited | …`.
**Backing:** cart driver routes to on-device Sakura.
**Wired:** yes (when the local model is mounted; else honest
`'service-not-yet-wired`).

#### Novice
```scheme
(act 'sakura/decide (list 'task 'choose-glyph 'flower) 'check)
```
*;; generated example*

#### Intermediate
```scheme
(define (note ctx)
  (act 'sakura/decide
       (list 'task 'daily-brief-note (ctx-get 'headlines ctx))
       'check-notes))
```
*Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks:159-162`*

#### Expert
```scheme
;; closed cookbook — Sakura never freelances; the task tag IS the contract
(act 'sakura/decide
     (list 'task 'mood-checkin-reply
           ':cookbook '(reflect acknowledge breathe)
           ':input    (ctx-get 'reply-text ctx))
     'classify-mood)
```
*Source: pattern from `carts/personal/mood-check-in.sks:90-98`*

---

### `(act 'sakura/cloud-reason (list prompt :budget) 'on-result)`

**Returns:** structured reply, or honest gate envelope.
**Backing:** cart manifest declares this for Imagine/Dream/Magic tiers
(`carts/personal/manifest.js:49`).
**Wired:** partial — Magic-tier deep-reasoning sessions route here;
returns `'cloud-tier-required` for lower tiers honestly.

#### Novice
```scheme
(act 'sakura/cloud-reason
     (list "Suggest a one-line title")
     'check-suggestion)
```
*;; generated example*

#### Intermediate
```scheme
(when (eq? (ctx-get 'tier ctx) 'magic)
  (act 'sakura/cloud-reason
       (list (ctx-get 'prompt ctx) ':budget 'magic)
       'check-reasoning))
```
*;; generated example*

#### Expert
```scheme
(act 'sakura/cloud-reason
     (list "Reconcile actuals against prior strategy. Draft delta."
           ':context (ctx-get 'session-context ctx)
           ':budget  'magic)
     'check-finding)
```
*Source: pattern from `the-living-business-plan.sks:247-258` (uses
lacuna/ask shape — sakura/cloud-reason is the tier-aware capability-
first alias).*

---

### `(act 'sakura/relay (list tool args) 'on-result)`

**Returns:** the relayed call's result.
**Backing:** declared in `carts/google/manifest.js:78`.
**Wired:** no — relay shape declared; the multi-tool session is
offline by default. Returns `'service-not-yet-wired` honestly.

#### Novice
```scheme
(act 'sakura/relay (list 'google/sheets-append-row (list sheet row)) 'check)
```
*;; generated example*

#### Intermediate
```scheme
(act 'sakura/relay
     (list 'instagram/feed-post (list url caption))
     'check-post)
```
*;; generated example, real verb name from §6*

#### Expert
```scheme
;; honest gate before relay
(cond
  ((eq? (ctx-get 'relay-status ctx) 'offline)
     (escalate 'service-not-yet-wired
               '(:reason "sakura-relay-not-mounted")))
  (else
     (act 'sakura/relay (list tool args) 'check)))
```
*;; generated example*

---

### `(act 'sakura/handoff (list chip-name payload) 'on-result)`

**Returns:** `'ok` after handoff completes, or honest failure.
**Backing:** declared in manifests; routes via the Lacuna support
layer per [[project-lacuna-support-training-for-sakura]].
**Wired:** no — chip vocabulary declared; the support layer is in
training. Returns `'service-not-yet-wired` honestly.

#### Novice
```scheme
(act 'sakura/handoff
     (list 'sakura.handoff/sre-check '(:host mac-studio.local))
     'check-handoff)
```
*;; generated example*

#### Intermediate
```scheme
(act 'sakura/handoff
     (list 'sakura.handoff/cortex-prune (ctx-get 'topics-to-drop ctx))
     'after-prune)
```
*;; generated example*

#### Expert
```scheme
;; chain — Sakura decides, then hands off to Lacuna for execution
(act 'sakura/decide
     (list 'task 'pick-prune-targets (ctx-get 'all-topics ctx))
     'handoff-prune)

(define (handoff-prune ctx)
  (act 'sakura/handoff
       (list 'sakura.handoff/cortex-prune (ctx-result ctx))
       'render))
```
*;; generated example*

---

### `(act 'sakura/dream (list seed) 'on-result)`

**Returns:** the dream node + paint plan, or `'cortex-not-ready`.
**Backing:** the dream-from-Cortex loop (NORTH STAR per
[[project_sakura_dreams_from_cortex]]).
**Wired:** no — dream loop spec is locked; the background loop +
imagination-engine paint plan is in the dream lane.

#### Novice
```scheme
(act 'sakura/dream (list 'noun-of-the-hour) 'paint-bubble)
```
*;; generated example*

#### Intermediate
```scheme
(when (ctx-get 'idle-loop ctx)
  (act 'sakura/dream (list (ctx-get 'recent-noun ctx)) 'render-thought))
```
*;; generated example*

#### Expert
```scheme
;; honest invariant — never claim a thought she didn't have
(let ((dream (ctx-result ctx)))
  (cond
    ((null? dream)
       (escalate 'no-dream-this-tick null))
    ((eq? dream 'cortex-not-ready)
       (escalate 'service-not-yet-wired
                 '(:reason "cortex-cold")))
    (else
       (paint-text (assq 'caption dream)
                   '#anchor/sakura-bubble
                   ':stroke-mode 'handwriting))))
```
*Source: pattern from [[project_sakura_dreams_from_cortex]]*

---

## Appendix · Macro inventory (Lane B §4, summary)

The 36 hygienic macros are seeded by `buildMacroTable`
(`primitives/macros.js:341-350`) and exist as expandable forms. Each
expands deterministically to a composition of the 15 primitives.

| Family            | Macros                                                                                                              | Backing                                     |
|-------------------|---------------------------------------------------------------------------------------------------------------------|---------------------------------------------|
| motion idioms (13)| `motion/glide`, `motion/drift`, `motion/sway`, `motion/arrive`, `motion/depart`, `motion/settle`, `motion/spin`, `motion/idle`, `motion/lean-aside`, `motion/ease-aside`, `motion/reach`, `motion/pluck`, `motion/toss`, `motion/land` | `primitives/macros.js:52-148` |
| note idioms (2)   | `note/glide`, `note/rest`                                                                                            | `primitives/macros.js:152-162` |
| musical forms (7) | `form/I-IV-V`, `form/ii-V-I`, `form/12-bar-blues`, `form/vi-IV-I-V`, `form/I-vi-ii-V`, `form/modal-Dorian`, `form/scale` | `primitives/macros.js:173-238` |
| scene atmos (2)   | `surface/fade-around`, `surface/stage`                                                                              | `primitives/macros.js:243-254` |
| timing comp (8)   | `sequence`, `parallel`, `after`, `wait`, `repeat`, `in-window`, `every`, `stagger`                                  | `primitives/macros.js:267-299` |
| mode-aware (4)    | `when-mode`, `on-mode-change`, `on-input`, `on-gesture`                                                              | `primitives/macros.js:307-322` |

Three picked, fully expanded:

```scheme
;; motion/glide — sample novice / intermediate / expert use
(motion/glide '#sprite/cherry 220 -40)
;; → expands to (motion/move-to '#sprite/cherry 220 -40 :curve 'spring :ms 760)
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:127`*

```scheme
(parallel (motion/glide '#sprite/cherry 220 -40)
          (motion/glide '#sprite/plum    40 -220))
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:140-150`*

```scheme
(stagger 240
  (list (motion/glide '#sprite/cherry    220  -40)
        (motion/glide '#sprite/plum       40 -220)
        (motion/glide '#sprite/magnolia -220   40)
        (motion/glide '#sprite/linden    -40  220)))
```
*Source: `curator-web/src/scheme/carts/scenes/demo/flower-orbit-demo.sks:124-130`*

---

## 13. New-arch placeholders {#13-new-arch-placeholders}

Stubs only. Full per-verb entries land when each MOVE ships per
`HELLO-SURFACE-1.0-ENGINEERING.md` §95.

**MOVE 3 — FRP time-calculus (planned, `scheme/time/frpGrammar.js`).** One time
grammar across music + motion + chat + cart-dispatch. Surface forms:
`when` (event-keyed gate), `during` (windowed predicate), `until` (terminating
predicate), `then` (sequential bind), `across` (parallel span), `every` (cadence).
Implementation gap: `when` exists today as a Reserved form (§1) for one-arm
conditionals; the FRP `when` is a time-keyed extension and lands as a separate
form name to avoid clobbering it. Cross-ref §95 MOVE 3.

**MOVE 4 — Unified memory verbs (planned, `lib/memoryUnified.js`).** One verb
triple over Cortex + accountStorage + Engram: `(memory/recall key)` returns the
freshest backed value, `(memory/remember key value :tier short|durable|sync)`
writes to the appropriate store, `(memory/forget key)` evicts across stores
with audit. Replaces ad-hoc `cortex/recall` + `accountStorage.get` divergence.
Cross-ref §95 MOVE 4.

**MOVE 5 — ASK floor (planned, `scheme/primitives/askVerbs.js`).** ~150
read-only introspection verbs from Lane A §93.4 covering collision
(`ask/collide?`, `ask/overlap`), surface arithmetic (`ask/distance`,
`ask/bearing`, `ask/within?`), and self-knowledge (`ask/what-cart`,
`ask/last-emit`, `ask/can-i?`). The ACT/ASK symmetry is the moat: every ACT
verb has a paired ASK so Sakura can verify before she acts. Cross-ref §95 MOVE 5.

**Already-shipped math verbs (undocumented backfill).** `math/sum`, `math/avg`,
`math/pct`, `math/round`, `time/delta` registered via `installMathVerbs`
(`curator-web/src/scheme/primitives/mathVerbs.js:101-113`). Full entries
pending; see file for argument shapes.

**§97 cultural-distribution + §101 timing-tensor symbol shape (LOCKED 2026-06-22, Soo-Jin closeout).** Two anchor-id shapes coexist; cart authors and the trained model must distinguish them at sight:

- **Performer-piece tensor.** `'<performer-class>-<work-id>` — e.g.
  `'rubinstein-op9-no2`, `'karajan-beethoven-9-mvt4-freude`,
  `'cortot-op28-no4`. Always carries a specific recording. The runtime
  resolves via `(memory/recall 'timing <id>)` per §101.3. Hyphenated;
  `performer-class` slot is from the §101.3 enum
  (`rubinstein | karajan | cortot-pre-1928 | backhaus-pre-1928`).
- **Cultural-distribution family.** `'<family-id>` — e.g. `'one-drop`,
  `'boom-bap`, `'cantabile`, `'clave-2-3`, `'clave-3-2`. No performer
  bound; resolves to the published stylistic distribution (Burkhart 2015,
  Senn 2016). The family-id slot is from the §97.1 vocabulary table.
- **Fallback / override.** `'operator-pace-drift`, `'snappy-override`,
  `'ease-in-out-default` — three reserved IDs the verifier knows about
  per §101.4 `honest-null-on-missing-anchor`.

The distinction is structural: `motion/with-pace` takes performer-piece OR
fallback IDs; `motion/with-feel` takes ONLY cultural-distribution family
IDs; `pattern/clave` takes ONLY `'2-3` or `'3-2`. Mixing (e.g.
`(motion/with-pace 'one-drop ...)`) is a verifier-class error caught at
corpus-build per §101.4 and at inference per the dispatch gate. Vendor /
artist names NEVER appear inside the symbol per CLAUDE.md 2026-06-22
vendor-naming lock — they live only in Cortex tensor metadata
(`source_ref` field per §101.3).

### 13.1 — Motion-timing verbs (LANDED 2026-06-23) {#13-1-motion-timing-verbs}

All eight §101.6 motion-timing verbs are wired and tested
(`curator-web/src/scheme/motionTimingVerbs.js`, 17/17 in
`__tests__/motionTimingVerbs.test.js`). Each returns a pure descriptor
(no DOM mutation; the animation engine consumes downstream).

**`motion/with-pace`** — modulate inner-motion duration by a tensor's
inter-onset intervals, scaled by intensity 0..1.

#### Novice
```scheme
(motion/with-pace 'rubinstein-op9-no2 0.6 (card/walk 'a 'glide-pause))
```

#### Intermediate
```scheme
(let ([pace (motion/with-pace 'chopin-nocturne-48-2 0.85)])
  (card/move 'sakura :duration (pace-derived-ms pace 4)))
```

#### Expert
```scheme
;; Two cards lag-led by Rubinstein rubato, third strict-metronomic
(parallel
  (motion/with-pace 'rubinstein-op9-no2 0.9 (card/glide 'a 320 240))
  (motion/with-pace 'rubinstein-op9-no2 0.9 (card/glide 'b 360 240))
  (motion/cadence 96 'q))   ;; the strict third
```

**`motion/with-feel`** — apply an articulation cue (legato / staccato)
from `MOTION_CUES` (Eitan & Granot 2006). Returns the cue + the
tensor's articulation_ratios.

#### Novice
```scheme
(motion/with-feel 'chopin-ballade-1 'legato)
```

#### Intermediate
```scheme
(let ([feel (motion/with-feel 'rubinstein-op9-no2 'legato)])
  (card/settle 'a :ease (feel-ease feel)))
```

#### Expert
```scheme
;; Staccato pluck on a Rach-2 tensor — articulation_ratios drive
;; per-note ease the animation engine reads back
(motion/with-feel 'rach-2-mvt-2-cantabile 'staccato)
```

**`motion/cadence`** — pure BPM + division → ms period. No tensor.

#### Novice
```scheme
(motion/cadence 120 'q)            ;; 500ms per beat
```

#### Intermediate
```scheme
(let ([beat (motion/cadence 96 '8th)])
  (every (cadence-period-ms beat) (card/pulse 'sakura)))
```

#### Expert
```scheme
;; A polyrhythmic 3-against-4 across two cards
(parallel
  (motion/cadence 96 'q)            ;; card A on quarters
  (motion/cadence 72 '8th))         ;; card B on dotted-quarters in disguise
```

**`motion/arc`** — surface a tensor's phrase_arc (peak_ms +
peak_intensity) as a curve the animation engine samples at
current-time-in-phrase.

#### Novice
```scheme
(motion/arc 'chopin-ballade-1)
```

#### Intermediate
```scheme
(let ([arc (motion/arc 'rach-2-mvt-2-cantabile)])
  (card/scale 'a (arc-intensity-at arc (now-ms))))
```

#### Expert
```scheme
;; Two-peak Rach-2 arc — sprite brightens with first peak (cantabile),
;; SHAKES on second peak (triumphant resolution)
(motion/arc 'rach-2-mvt-2-cantabile)
```

**`motion/pocket`** — produce N symmetric stagger offsets within
±tolerance_ms (the "feel pocket").

#### Novice
```scheme
(motion/pocket 12 4)               ;; [-12, -4, 4, 12] ms
```

#### Intermediate
```scheme
(let ([pocket (motion/pocket 18 5)])
  (stagger-with pocket (card/walk 'sakura 'amble)))
```

#### Expert
```scheme
;; The pocket follows the bar — staggered card-walks land at the
;; same time but feel hand-played not quantized
(motion/pocket 22 8)               ;; 8 cards within ±22ms tolerance
```

**`motion/drop`** — one-drop accent: at the target beat, articulate
high (0.95); elsewhere low (0.35). Returns per-beat articulation
array length totalBeats.

#### Novice
```scheme
(motion/drop 3 16)                 ;; accent every beat 3 of 4 over 16
```

#### Intermediate
```scheme
(let ([drop (motion/drop 3 32)])
  (card/pulse 'sakura :pattern (drop-articulation drop)))
```

#### Expert
```scheme
;; Reggae one-drop on a 32-beat phrase; the bass pulse is the off-beats
(motion/drop 3 32)
```

**`pattern/clave`** — 2-3 or 3-2 son clave hit map over 16 8th-notes.
Returns `{kind: 'clave', map: [0|1, ...16]}`.

#### Novice
```scheme
(pattern/clave '2-3)
```

#### Intermediate
```scheme
(let ([clave (pattern/clave '2-3)])
  (for-each-hit clave (lambda (i) (card/blip 'sakura))))
```

#### Expert
```scheme
;; 3-2 clave under a son montuno — drives both the visual blip
;; AND the audio synth via the same map
(pattern/clave '3-2)
```

**`beat/on`** — predicate descriptor: fire on beat N of M. The engine
tests current beat index against the descriptor.

#### Novice
```scheme
(beat/on 1 4)                      ;; fire on beat 1 of every 4
```

#### Intermediate
```scheme
(let ([gate (beat/on 3 4)])
  (when (gate (current-beat)) (card/drop 'sakura)))
```

#### Expert
```scheme
;; Cross-rhythm: card-walk on every beat 1, card-spin on every beat 3
(parallel
  (when-beat (beat/on 1 4) (card/walk 'a 'glide))
  (when-beat (beat/on 3 4) (card/spin 'b 30)))
```

---

## 14. 2026-06-24 roll-up · chrome verbs, tier verb, coin physics emit

Three groups land in this section: card-chrome verbs (the new STRIPE/HEAD/BODY layer addressing); the tier-read verb (single source of truth for what tier the operator is on); and the coin-emit Scheme primitive (the physics-backed coin emitter used by the Shoppe cascade — kept as a substrate primitive even as the §125 Sakura Shoppe card is on the cut list per HelloSurface §128.7).

### 14.1 Card chrome verbs

The STRIPE layer (per HelloSurface §127) makes per-card chrome visible on resting cells. These verbs let Scheme address that chrome — set the wordmark, swap the dot-matrix pattern, force a chrome refresh.

**`card/stripe-pattern`** — replace a card's dot-matrix pattern. Reads `cardDotPatterns.js` for the default; this verb overrides at runtime.

`Backing:` `curator-web/src/components/cards/cardDotPatterns.js:303 · patternFor()` (lookup that the verb mutates). Wired: code-ready (verb not yet registered in `VerbRegistry.js` — pending the cardDotPatterns → Scheme migration noted in HelloSurface §128.1).

#### Novice
```scheme
(card/stripe-pattern 'radio (pattern/legacy '("..XXXX.." "..X..X.." "..X..X.." "..X..X.." "..XXXX.." "....X..." "...XXX.." "........")))
```

#### Intermediate
```scheme
(let ([p (cortex/recall 'my-custom-radio-pattern)])
  (card/stripe-pattern 'radio p))
```

#### Expert
```scheme
;; Animate the radio dots by rotating the pattern grid each beat
(every-ms 500
  (card/stripe-pattern 'radio (pattern/rotate (cortex/recall 'radio-pattern))))
```

**`card/stripe-label`** — replace a card's wordmark text.

`Backing:` `curator-web/src/components/cards/CardStripe.jsx:39 · KIND_LABEL` (the default-label lookup). Wired: code-ready; the label override flows through React state when the verb installer fires.

#### Novice
```scheme
(card/stripe-label 'radio "Studio")
```

#### Intermediate
```scheme
(let ([title (current-station-title)])
  (card/stripe-label 'radio title))
```

#### Expert
```scheme
;; Reactive label — track the current station's title every 2s
(every-ms 2000
  (card/stripe-label 'radio (radio/current-station-title)))
```

### 14.2 Operator-tier verb

**`operator/tier`** — return the operator's tier: `'free` / `'imagine` / `'dream` / `'magic`. While `MAGIC_DEFAULT_ENABLED` is true (HelloSurface §128.3) this returns `'magic` unconditionally.

`Backing:` `curator-web/src/lib/operatorTier.js:28 · getOperatorTier()` + `:18 MAGIC_DEFAULT_ENABLED`. Wired: yes (the JS function is the substrate; the Scheme verb is the registered bridge).

#### Novice
```scheme
(operator/tier)             ;; → 'magic  (while override on)
```

#### Intermediate
```scheme
(when (eq (operator/tier) 'magic)
  (sakura/say "You're on Magic — every dossier is open."))
```

#### Expert
```scheme
;; Tier-gated cart that ALSO records the override state so logs are honest
(let ([t (operator/tier)] [override (operator/magic-default-active?)])
  (cortex/remember 'last-tier-read { :tier t :override override :at (now-ms) })
  (case t
    [(magic) (deep-research)]
    [(dream) (medium-research)]
    [(imagine free) (light-research)]))
```

**`operator/magic-default-active?`** — diagnostic predicate that returns `#t` when the magic-default override is on.

`Backing:` `curator-web/src/lib/operatorTier.js:40 · isMagicDefaultActive()`. Wired: yes.

#### Novice
```scheme
(operator/magic-default-active?)
```

#### Intermediate
```scheme
(when (operator/magic-default-active?)
  (sakura/say "Heads-up: payment is deferred, you're on Magic for free."))
```

#### Expert
```scheme
;; Honest cost-receipt chip: surface the override in the receipt so the
;; operator never thinks the price they SEE is the price they PAID.
(receipt/show
  :tokens (cart/cost-tokens)
  :dollars (if (operator/magic-default-active?) 0 (cart/cost-dollars))
  :note (if (operator/magic-default-active?) "Magic (override)" "Magic"))
```

### 14.3 Coin emit (`paint-coin`, `coin/emit`)

The §125 Sakura Shoppe card is being retired (HelloSurface §128.7) but the **coin physics primitive** stays in the substrate — it's a reusable celebration emitter (use case: a sale-event whimsy, a milestone burst, a Sakura-magic acknowledgement).

**`paint-coin`** — render a spinning coin at a point. Pure visual, no physics.

`Backing:` `curator-web/src/scheme/primitives/paintCoinScheme.js` + render via `curator-web/src/components/SakuraCoin.jsx`. Wired: yes (the visual coin); physics is in the next verb.

#### Novice
```scheme
(paint-coin (point 200 150))
```

#### Intermediate
```scheme
(paint-coin (point 300 150) :denomination 'magic :rpm 90 :easing 'step)
```

#### Expert
```scheme
;; A row of pink coins, staggered for a wave effect (HelloSurface §125.11.5)
(for-each (lambda (i)
  (paint-coin (point (+ 100 (* i 60)) 200)
              :denomination 'pink :rpm 60 :phase (/ i 5)))
  '(0 1 2 3 4))
```

**`coin/emit`** — emit a physics-backed coin with initial velocity. The coin acts under gravity, drag, and bounce per `coinPhysics.js`.

`Backing:` `curator-web/src/scheme/primitives/coinEmitScheme.js` + `curator-web/src/lib/coinPhysics.js:72 · CoinBody` / `:156 · CoinWorld` / `:310 · arcVelocity`. Wired: yes (34 physics tests + 11 emit-Scheme tests).

#### Novice
```scheme
(coin/emit (point 200 150))                          ;; gravity falls
```

#### Intermediate
```scheme
;; Arc a coin from pack tile to balance counter (Shoppe cascade pattern)
(coin/emit (point 200 400)
           :target (point 350 100)
           :duration-ms 800
           :peak-height 80
           :denomination 'magic)
```

#### Expert
```scheme
;; Celebration burst — N coins emitted from one point with radial spread
(for-each (lambda (i)
  (let ([theta (* 2 PI (/ i 12))])
    (coin/emit (point cx cy)
               :velocity (point (* 200 (cos theta)) (* -200 (sin theta) 1.2))
               :denomination (if (= i 0) 'magic 'pink)
               :spin (* 360 (random)))))
  '(0 1 2 3 4 5 6 7 8 9 10 11))
```

### 14.4 Phase 3 + 4 motion-timing verbs (already documented above)

The 8 motion-timing verbs landed under section 10 (FX + animation atoms):
`motion/with-pace` · `motion/with-feel` · `motion/cadence` · `motion/arc` · `motion/pocket` · `motion/drop` · `pattern/clave` · `beat/on`.

These bind `crossModalMapping.js` (perception) + `timingTensor.js` (performance) — see §10 entries for the 3-example (Novice/Intermediate/Expert) bodies. The Backing field of each entry points at `motionTimingVerbs.js:1` (registered as a group), `cortex/timing/seeds.js` for the 7 seed tensors, and `cortex/timing/sheet-music-catalog.json` for the 12 PD works that ground them.

### 14.5 Deprecation flags

- **`shoppe/*` verbs** (`curator-web/src/scheme/shoppe/shoppeVerbs.js`, 8 verbs) — DEPRECATION CANDIDATE. The Sakura Shoppe card is on the cut list per HelloSurface §128.7. The verbs themselves may stay as substrate primitives (token-pack purchase flow, merch purchase flow) or be retired; architect call needed. Mark `Wired: deprecation-pending` until the call is made.

---

## 15. Atomic primitives — the irreducible base

> "We shall first define a class of symbolic expressions in terms of
> ordered pairs and lists. Then we shall define five elementary
> functions and predicates, and build from them by composition,
> conditional expressions, and recursive definition an extensive class
> of functions of which we shall give a number of examples."
> — John McCarthy, *Recursive Functions of Symbolic Expressions and
> Their Computation by Machine, Part I*, 1960, p.184

This chapter catalogues the **atomic verbs** — the bindings that are
NOT macros, NOT installed by any namespace installer (`installCardVerbs`,
`installCortexGrammar`, `installFrpGrammar`, etc.), and that no cart can
redefine post-`freeze()`. Everything in the language stands on these.

There are two sources for an atomic primitive:

1. **Special forms.** Hand-written cases in the `evalStep` switch at
   `curator-web/src/scheme/interp.js:281-441` — the function declaration
   sits at `:281`; the dispatch switch runs `:289-441`. These are NOT functions —
   they cannot be passed as values, captured in a closure, or rebound.
   The substrate-freeze (`Env.freeze()` at `interp.js:154-164`) blocks
   redefinition of every name bound at boot, so even the non-special-form
   atoms below are immutable from cart code.
2. **Base bindings.** Pure, total, side-effect-free JavaScript functions
   installed by `makeBaseEnv(fuel)` at
   `curator-web/src/scheme/base.js:16-507`. These are first-class values
   (can be `map`-ped, `apply`-ed, stored in lists).

The split is invisible to operators — `(+ 1 2)` and `(if x y z)` read
identically — but it's load-bearing for security: an installer can
shadow a special-form name pre-freeze (none do), and post-freeze every
name on this page is read-only. The verb-registry meta walks fall back
to `defaultMetaFor` for any base binding declared without an explicit
`perm`; every entry below carries `perm: 'read'` by virtue of the `def`
helper's default at `base.js:24`.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140" style="background:#fdf6f3;border:1px solid #2e2167;border-radius:4px;display:block;margin:1em 0">
  <text x="20" y="30" font-family="ui-monospace,monospace" font-size="13" fill="#1a1a1a">atomic primitives — the irreducible base</text>
  <line x1="20" y1="44" x2="500" y2="44" stroke="#2e2167" stroke-width="1"/>
  <text x="20" y="70" font-family="ui-monospace,monospace" font-size="11" fill="#2e2167">  interp.js:275-279   16 special forms   (cannot be passed as values)</text>
  <text x="20" y="92" font-family="ui-monospace,monospace" font-size="11" fill="#2e2167">  base.js:16-507      ~117 base bindings (first-class, perm: read)</text>
  <line x1="20" y1="108" x2="500" y2="108" stroke="#2e2167" stroke-width="1"/>
  <text x="20" y="128" font-family="ui-monospace,monospace" font-size="11" fill="#1a1a1a">  every installer (cardVerbs, cortex, paint, ...) sits ON TOP of this.</text>
</svg>

The chapter is organised in nine subsections:

- **§15.1** — Special forms (no notion of "function value"; switch cases in `evalStep`).
- **§15.2** — Equality and predicates.
- **§15.3** — List + sequence atoms.
- **§15.4** — Arithmetic atoms.
- **§15.5** — String + number conversion atoms.
- **§15.6** — Higher-order atoms (`map`, `filter`, `reduce`, `apply`, `for-each`).
- **§15.7** — Randomness atoms (the seeded/un-seeded split).
- **§15.8** — Geometry + threshold atoms (the "game kit").
- **§15.9** — Display atoms (`display`, `newline`, `print`).

Entries within each subsection are alphabetical. Citations use the
preferred `file:Line · functionName()` dot-separator form per the
2026-06-22 SRE advisory at the head of this manual. Generated examples
are marked; sourced examples cite the cart they came from.

A handful of base bindings (`bricklay-pack-native`, `pi`, `inspect`)
either already have authoritative entries elsewhere in this manual or
exist as substrate hooks that aren't called from cart code; those carry
a back-reference rather than a full restatement.

---

### 15.1 Special forms

These 16 names are recognised by the `SPECIAL_FORMS` set at
`curator-web/src/scheme/interp.js:275-279` and handled directly by the
switch in `evalStep` (`interp.js:281-441`; the dispatch switch at
`:289-441`). They have no function value — `(map quote xs)` throws
`unbound symbol: quote` because the special-form name is intercepted
before any binding lookup runs.

At-a-glance reference card for `and` (the dual `or` is one section below):

```verb-card and
```

#### `(and expr1 expr2 ...)`

**Purpose:** short-circuit conjunction; returns the last truthy value, or `#f` if any conjunct is `#f`.
**Returns:** the value of the last conjunct when all are truthy, otherwise `#f`. With zero conjuncts, `#t`.
**Side effects:** none beyond the conjuncts'; evaluates left-to-right, stops at the first `#f`. The last conjunct is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:385 · evalStep() case 'and'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(and (pair? rows) (not (null? rows)))` — gate two preconditions on one line. *;; generated*
2. _(intermediate)_ inside an `if` to combine a tier check with a data check:
   ```scheme
   (if (and (eq? (ctx-get 'tier ctx) 'magic)
            (pair? (ctx-get 'finding ctx)))
       (next 'render ctx)
       (escalate 'tier-or-data-missing null))
   ```
   *;; generated*
3. _(expert)_ tail-position chain in a state function — the deepest `pair?` is the determining tail:
   ```scheme
   (when (and (eq? state 'ready)
              (not (null? rows))
              (pair? (assoc ':price_ladder_suggestion rows)))
     (next 'render (ctx-set 'finding rows ctx)))
   ```
   *;; generated, modelled on `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*

**Notes:** prefer `and` over nested `if` for gate composition; lint reads more than three nested `if`s as a smell. See `or` (§15.1) for the dual, `cond` (§15.1) for multi-arm dispatch.

---

#### `(begin expr1 expr2 ... lastExpr)`

**Purpose:** sequential composition; evaluate each expression in order and return the last.
**Returns:** the value of the final expression. With zero expressions, `undefined`.
**Side effects:** all but the last are evaluated for effect; the last is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:329 · evalStep() case 'begin'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ two effects then end:
   ```scheme
   (begin (display "ready") (newline))
   ```
   *;; generated*
2. _(intermediate)_ chip emit + envelope queue + done — the common cart-render shape:
   ```scheme
   (begin
     (card-emit 'engine 'living-plan-ready (length finding))
     (envelope-queue (list 'the-living-business-plan ':finding finding))
     (done))
   ```
   *Source: adapted from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*
3. _(expert)_ tail-position composition inside a `let`:
   ```scheme
   (let ((finding (ctx-get 'finding ctx)))
     (begin
       (paint-arrow 'price-ladder-card ':anchors anchors ':glow 'warm-amber)
       (envelope-queue (list 'pink-price-ladder-suggest ':finding finding))
       (done)))
   ```
   *Source: condensed from `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks`*

**Notes:** lambda and `let` bodies have an implicit `begin` — wrap explicitly only when you need a sequence inside a position that takes one expression (the alternate arm of `if`, a `cond` clause, an `and` conjunct).

---

#### `(case key (datums body...) ... (else body...))`

**Purpose:** discrete dispatch on a key; each clause head is a list of possible matches, `else` catches the rest.
**Returns:** the value of the chosen clause's last form, or `undefined` if no clause matches and there is no `else`.
**Side effects:** evaluates the key once; matches numbers by `===` and symbols by name.
**Defined in:** `curator-web/src/scheme/interp.js:423 · evalStep() case 'case'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ route a state symbol:
   ```scheme
   (case state
     ((vacation paused) (escalate 'state-blocks-spend state))
     (else              (next 'fetch ctx)))
   ```
   *;; generated*
2. _(intermediate)_ classify a marketplace status code:
   ```scheme
   (case status
     ((connected)       (next 'fetch ctx))
     ((not-connected)   (escalate 'service-not-connected null))
     ((quota-exhausted) (escalate 'answers-quota null))
     (else              (escalate 'service-not-yet-wired null)))
   ```
   *;; generated*
3. _(expert)_ tier branch into three sub-state-machines:
   ```scheme
   (define (route ctx)
     (case (ctx-get 'tier ctx)
       ((free imagine) (next 'render-cheap ctx))
       ((dream)        (next 'render-mid ctx))
       ((magic)        (next 'render-full ctx))
       (else           (escalate 'tier-unknown null))))
   ```
   *;; generated*

**Notes:** `case` matches by `===` on numbers and by Sym-name on symbols — strings do NOT compare; use `cond` with `string=?` for string dispatch. See `cond` (§15.1).

---

#### `(cond (test body...) ... (else body...))`

**Purpose:** multi-way branching; the first truthy test wins.
**Returns:** the value of the chosen clause's last form. A one-element clause `(test)` returns the test value.
**Side effects:** evaluates tests left-to-right; stops at the first non-`#f`.
**Defined in:** `curator-web/src/scheme/interp.js:409 · evalStep() case 'cond'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ the canonical cart guard:
   ```scheme
   (cond
     ((null? rows)             (escalate 'no-data null))
     ((eq? rows 'rate-limited) (after 30 'fetch ctx))
     (else                     (next 'render ctx)))
   ```
   *Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks`*
2. _(intermediate)_ closed-set classification of a Loam result — every tag explicit, no catch-all gate:
   ```scheme
   (cond
     ((null? state)                      (escalate 'cortex-not-ready null))
     ((eq? (assoc 'vacation state) #t)   (escalate 'state-blocks-spend 'vacation))
     ((eq? (assoc 'paused state) #t)     (escalate 'state-blocks-spend 'paused))
     (else                               (next 'check-cache (ctx-set 'state state ctx))))
   ```
   *Source: `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*
3. _(expert)_ closed-tag finding validator with explicit reason payloads:
   ```scheme
   (cond
     ((null? finding)
        (escalate 'service-not-yet-wired '(:status not-wired :reason "lacuna-returned-null")))
     ((eq? finding 'rate-limited)        (after 120 'lacuna-ask ctx))
     ((eq? finding 'cloud-tier-required) (escalate 'service-not-connected null))
     (else                               (next 'remember (ctx-set 'finding finding ctx))))
   ```
   *Source: condensed from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*

**Notes:** prefer `cond` to nested `if` for more than two arms. The Scheme R7RS `=>` clause shape is NOT supported in this interpreter; use `let` to bind the test result if you need it in the body.

---

#### `(define name expr)` and `(define (name args...) body...)`

**Purpose:** bind a name in the current environment.
**Returns:** `undefined` (the effect is the binding).
**Side effects:** mutates the current env's variable map; post-freeze, throws on substrate names.
**Defined in:** `curator-web/src/scheme/interp.js:297 · evalStep() case 'define'`. Param parsing at `:205 · parseParams()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ every cart's entry state:
   ```scheme
   (define (start ctx) (next 'fetch ctx))
   ```
   *Source: `curator-web/src/scheme/carts/etsy/age-distribution.sks`*
2. _(intermediate)_ helper + start composed:
   ```scheme
   (define (window-key topic) (list ':topic topic ':window 'now))
   (define (start ctx)
     (act 'cortex/recall (list (window-key 'living-plan-checkpoint)) 'check-prior))
   ```
   *;; generated*
3. _(expert)_ dotted-tail variadic procedure (R7RS §4.1.4) — `rest` binds to a list of all args past the fixed ones:
   ```scheme
   (define (log-fields tag . fields)
     (display tag) (newline)
     (for-each (lambda (f) (display f) (newline)) fields))
   (log-fields 'shop-status 'connected 'tier 'magic 'fuel 50000)
   ```
   *;; generated (dotted-tail path lands at `interp.js:303 · parseParams()`)*

**Notes:** the procedure shorthand `(define (f a b) body)` desugars to `(define f (lambda (a b) body))`. Mutually recursive definitions in a `letrec` body, or sequential `define`s at the top level, are the two supported recursion patterns. See `lambda` (§15.1), `letrec` (§15.1), `set!` (§15.1).

---

#### `(if test then else?)`

**Purpose:** two- or three-arm conditional.
**Returns:** the value of `then` when `test` is anything but `#f`; otherwise the value of `else` (or `#f` if absent).
**Side effects:** evaluates `test` eagerly; the chosen branch is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:292 · evalStep() case 'if'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ a binary gate:
   ```scheme
   (if (null? rows) (escalate 'no-data null) (next 'render ctx))
   ```
   *;; generated*
2. _(intermediate)_ cache hit shortcut:
   ```scheme
   (define (check-today ctx)
     (let ((cached (ctx-result ctx)))
       (if (null? cached)
           (next 'recall-topics ctx)
           (next 'render-cached (ctx-set 'cached cached ctx)))))
   ```
   *Source: adapted from `curator-web/src/scheme/carts/personal/daily-news-brief.sks`*
3. _(expert)_ nested gate — kept here as an honest counter-example to `cond`:
   ```scheme
   (if (eq? (ctx-get 'tier ctx) 'magic)
       (if (>= (length deltas) 12)
           (next 'assemble-quarter-memo ctx)
           (next 'accrue-week ctx))
       (escalate 'tier-not-permitted null))
   ```
   *;; generated*

**Notes:** R7RS truthiness — only `#f` is false. Empty list `()` is true in this interpreter (matches R7RS, NOT Common Lisp). For more than two arms, switch to `cond`.

---

#### `(lambda (params...) body...)`

**Purpose:** anonymous procedure; captures the current environment by reference.
**Returns:** a `Closure` (a first-class callable Scheme value).
**Side effects:** none at construction; the body has whatever effects it has when applied.
**Defined in:** `curator-web/src/scheme/interp.js:313 · evalStep() case 'lambda'`. Closure construction at `:174 · class Closure`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ map a name out of each row:
   ```scheme
   (map (lambda (row) (assoc 'title row)) rows)
   ```
   *;; generated*
2. _(intermediate)_ fold receipts into a revenue sum:
   ```scheme
   (reduce (lambda (acc r) (+ acc (assoc 'amount r))) 0 receipts)
   ```
   *;; generated*
3. _(expert)_ fully-variadic closure over local state — `(lambda args …)` shape gathers every call-time arg into `args`:
   ```scheme
   (let ((seen '()))
     (filter (lambda args
               (let ((id (car args)))
                 (if (member id seen)
                     #f
                     (begin (set! seen (cons id seen)) #t))))
             listings))
   ```
   *;; generated — variadic shape at `interp.js:321 · case 'lambda'` (form[1] instanceof Sym)*

**Notes:** **cart lint forbids inline `lambda`s as the on-result argument to `act`** — the on-result must be a quoted symbol so the cart is replayable. Three param shapes: fixed `(a b c)`, dotted-tail `(a b . rest)`, fully-variadic `args`. The dotted-tail and variadic shapes both land at `Closure.restParam` (`interp.js:188 · class Closure`).

---

#### `(let ((name expr) ...) body...)` and named-let `(let loop ((n v) ...) body...)`

**Purpose:** local bindings (and, for named-let, a recursive helper closure called once with the initial values).
**Returns:** the value of the last body expression.
**Side effects:** none beyond evaluating the initialisers (in the OUTER env) and the body (in the EXTENDED env). Last body form is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:335 · evalStep() case 'let'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ pull one ctx value, branch:
   ```scheme
   (let ((cached (ctx-result ctx)))
     (if (null? cached)
         (next 'fetch ctx)
         (next 'render-cached (ctx-set 'cached cached ctx))))
   ```
   *Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks`*
2. _(intermediate)_ two parallel ctx pulls feeding a paint call:
   ```scheme
   (let ((anchors    (ctx-get 'anchors ctx))
         (copy-lines (ctx-get 'copy-lines ctx)))
     (paint-arrow 'price-ladder-card
                  ':anchors anchors ':labels copy-lines ':glow 'warm-amber))
   ```
   *Source: `curator-web/src/scheme/carts/pink/pink-price-ladder-suggest.sks`*
3. _(expert)_ named-let iteration — tail-call-eliminated through the trampoline (`interp.js:347 · TailCall`):
   ```scheme
   (let loop ((items items) (i 0) (out '()))
     (if (null? items)
         (reverse out)
         (loop (cdr items) (+ i 1) (cons (list i (car items)) out))))
   ```
   *;; generated*

**Notes:** initialisers see the OUTER env — use `let*` when a later binding depends on an earlier one. Named-let is the standard Scheme iteration pattern in this codebase; lint reads it as the preferred form over hand-rolled recursive `define`s.

---

#### `(let* ((name expr) ...) body...)`

**Purpose:** sequential bindings — each initialiser sees every prior binding.
**Returns:** the value of the last body expression.
**Side effects:** none beyond the bindings + body.
**Defined in:** `curator-web/src/scheme/interp.js:355 · evalStep() case 'let*'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_
   ```scheme
   (let* ((a 1) (b (+ a 2))) b)   ;; → 3
   ```
   *;; generated*
2. _(intermediate)_ derive revenue from receipts:
   ```scheme
   (let* ((receipts (ctx-get 'receipts ctx))
          (revenue  (sum (map (lambda (r) (assoc 'amount r)) receipts))))
     (next 'render (ctx-set 'revenue revenue ctx)))
   ```
   *;; generated*
3. _(expert)_ layered derivation — ctx → feature → action:
   ```scheme
   (let* ((topics  (ctx-get 'topics ctx))
          (top-3   (take topics 3))
          (batched (act 'web-search (list 'top-headline-batch top-3) 'check-fetch)))
     batched)
   ```
   *;; generated*

**Notes:** if NONE of the bindings depend on the prior, `let` is clearer. If ALL of them do, `let*` is mandatory.

---

#### `(letrec ((name expr) ...) body...)`

**Purpose:** simultaneous bindings — each initialiser sees every binding (forward references allowed). The standard Lisp pattern for mutually recursive lambdas.
**Returns:** the value of the last body expression.
**Side effects:** bindings start `undefined`, then each is `set!`-ed to its evaluated value in the extended env.
**Defined in:** `curator-web/src/scheme/interp.js:362 · evalStep() case 'letrec'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ a single recursive helper:
   ```scheme
   (letrec ((fact (lambda (n) (if (<= n 1) 1 (* n (fact (- n 1)))))))
     (fact 5))   ;; → 120
   ```
   *;; generated*
2. _(intermediate)_ mutually recursive even?/odd? — the canonical letrec demo:
   ```scheme
   (letrec ((even? (lambda (n) (if (= n 0) #t (odd?  (- n 1)))))
            (odd?  (lambda (n) (if (= n 0) #f (even? (- n 1))))))
     (even? 10))
   ```
   *;; generated*
3. _(expert)_ a tiny state machine assembled inline — each state references the others:
   ```scheme
   (letrec ((idle  (lambda (ev) (if (eq? ev 'start) (ready) (idle ev))))
            (ready (lambda ()   (if (pair? rows) (render rows) (idle 'wait))))
            (render(lambda (rs) (for-each display rs) (idle 'next))))
     (idle 'start))
   ```
   *;; generated*

**Notes:** prefer `let` or `let*` whenever forward references aren't needed; `letrec` is the heavyweight option. The forward-reference window opens at `interp.js:369 · for ([name] of form[1])` (placeholder define) and closes at `:370 · for ([name, expr] of form[1])` (real set!).

---

#### `(or expr1 expr2 ...)`

```verb-card or
```

**Purpose:** short-circuit disjunction; returns the first truthy value, or `#f` if every disjunct is `#f`.
**Returns:** the value of the first truthy disjunct (NOT coerced to `#t`); `#f` if all are `#f`. With zero disjuncts, `#f`.
**Side effects:** none beyond the disjuncts'; evaluates left-to-right, stops at the first truthy. The last disjunct is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:393 · evalStep() case 'or'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(or (null? rows) (zero? (length rows)))` — accept either "no list" or "empty list" as the empty case. *;; generated*
2. _(intermediate)_ default-value pattern — `or` returns the first truthy value, so it acts as a "first-non-`#f`" picker:
   ```scheme
   (define shop-id (or (ctx-get 'shop-id ctx) (env-get 'DEFAULT_SHOP) 'unknown))
   ```
   *;; generated*
3. _(expert)_ tail-position dispatch inside a state function — the last disjunct is the determining tail:
   ```scheme
   (or (try-cache key)
       (try-local-mirror key)
       (escalate 'service-not-yet-wired key))
   ```
   *;; generated, modelled on the cache-then-remote pattern across `curator-web/src/scheme/carts/dream/*.sks`*

**Notes:** `or` returns the truthy VALUE, not `#t` — use it for "first non-`#f`" pickers, not just boolean reduction. Only `#f` is false here (the empty list `()` is truthy), so `(or () 'fallback)` returns `()`, not `'fallback`. For "first non-empty" semantics, gate with `pair?` first. See `and` (§15.1) for the dual, `cond` (§15.1) for multi-arm dispatch.

---

#### `(quasiquote template)` — backtick `` ` ``, with `(unquote x)` (comma `,`) and `(unquote-splicing x)` (comma-at `,@`)

**Purpose:** templated data construction — most of the template is quoted, but `,x` and `,@x` interpolate values into specific positions.
**Returns:** a list (or nested list) with the unquotes filled in.
**Side effects:** evaluates only the unquoted expressions.
**Defined in:** `curator-web/src/scheme/interp.js:375 · evalStep() case 'quasiquote'`. Walker at `:510 · quasiExpand()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ inject one value into a literal list:
   ```scheme
   (let ((tier 'magic)) `(:tier ,tier))   ;; → (:tier magic)
   ```
   *;; generated*
2. _(intermediate)_ splice a list of args into a verb call template:
   ```scheme
   (let ((args (list 'this-week 'magic)))
     `(act etsy/receipts ,@args check-actuals))
   ;; → (act etsy/receipts this-week magic check-actuals)
   ```
   *;; generated*
3. _(expert)_ build a record with computed keys + spliced fields:
   ```scheme
   (let ((rev 1234) (fees (list (list ':etsy 25) (list ':shipping 12))))
     `(:revenue ,rev :fees-listed ,@fees))
   ```
   *;; generated — `unquote-splicing` walks at `interp.js:521 · for (const item of form)`*

**Notes:** nested quasiquotes are NOT supported — the walker handles a single level. Use ordinary `list` + `cons` for deep templating. The `unquote-splicing` form THROWS if used outside list position (predicate at `interp.js:516`; `throw` at `:517`).

---

#### `(quote datum)` — single-quote `'datum`

**Purpose:** suppress evaluation; return the literal datum.
**Returns:** the datum form, unevaluated.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/interp.js:290 · evalStep() case 'quote'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ a literal symbol:
   ```scheme
   'magic   ;; → the Sym `magic` (not "lookup the binding named magic")
   ```
   *;; generated*
2. _(intermediate)_ a literal list as a fixed configuration:
   ```scheme
   (define days '(mon tue wed thu fri sat sun))
   ```
   *;; generated*
3. _(expert)_ quoted tag list as the on-result-payload pattern carts use everywhere:
   ```scheme
   (escalate 'service-not-yet-wired
             '(:status not-wired :reason "no-shop-id"))
   ```
   *Source: pattern across `curator-web/src/scheme/carts/**/*.sks`*

**Notes:** `'x` reads as `(quote x)`. The reader (`reader.js`) inserts the `quote` form before this evaluator ever sees the source; this case just unwraps it. For interpolation into a quoted list, use `quasiquote`.

---

#### `(set! name expr)`

**Purpose:** mutate an existing binding.
**Returns:** `undefined`.
**Side effects:** updates the env entry for `name`; throws if `name` is unbound, or if the env is frozen and `name` is a substrate binding (`interp.js:75 · throw new Error('frozen sandbox: cannot set! substrate binding')`).
**Defined in:** `curator-web/src/scheme/interp.js:310 · evalStep() case 'set!'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ counter increment:
   ```scheme
   (define n 0) (set! n (+ n 1)) n   ;; → 1
   ```
   *;; generated*
2. _(intermediate)_ accumulator inside a closure:
   ```scheme
   (define (make-counter) (let ((n 0)) (lambda () (set! n (+ n 1)) n)))
   (define tick (make-counter))
   (tick) (tick) (tick)   ;; → 3
   ```
   *;; generated*
3. _(expert)_ dedup with closure-state (note: cart lint prefers pure helpers — this pattern is allowed for closure-local memos, not for cross-cart state):
   ```scheme
   (let ((seen '()))
     (filter (lambda (id)
               (if (member id seen)
                   #f
                   (begin (set! seen (cons id seen)) #t)))
             listing-ids))
   ```
   *;; generated*

**Notes:** `set!` is the language's only general mutation primitive; everything else is data construction. Substrate names (every base binding, every special form) are frozen at boot — `(set! car …)` throws. Use sparingly: pure `let` + recursion is the dominant pattern in this codebase.

---

#### `(unless test body...)`

**Purpose:** inverse of `when` — evaluate the body only when `test` is `#f`.
**Returns:** the value of the last body form, or `undefined` if `test` is truthy.
**Side effects:** evaluates `test` once; body's last form is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:401 · evalStep() case 'unless'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(unless (null? rows) (display "got rows") (newline))` — *;; generated*
2. _(intermediate)_ guard a fetch behind a connect state:
   ```scheme
   (unless (eq? status 'not-connected)
     (next 'fetch ctx))
   ```
   *;; generated*
3. _(expert)_ tail-position composition inside a state function — the trailing form is what the state returns:
   ```scheme
   (define (maybe-render ctx)
     (unless (null? (ctx-get 'rows ctx))
       (paint-table (ctx-get 'rows ctx))
       (done)))
   ```
   *;; generated*

**Notes:** prefer `unless` over `(if (not test) body)` for readability when the negative is the meaningful arm. See `when` (§15.1) for the positive form.

---

#### `(when test body...)`

**Purpose:** one-armed conditional — evaluate the body only when `test` is truthy.
**Returns:** the value of the last body form, or `undefined` if `test` is `#f`.
**Side effects:** evaluates `test` once; body's last form is in tail position.
**Defined in:** `curator-web/src/scheme/interp.js:377 · evalStep() case 'when'`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(when (pair? rows) (display "got rows") (newline))` — *;; generated*
2. _(intermediate)_ fire one chip when a finding lands:
   ```scheme
   (when (pair? finding)
     (card-emit 'engine 'finding-ready (length finding)))
   ```
   *;; generated*
3. _(expert)_ tail-position composition:
   ```scheme
   (when (and (eq? (ctx-get 'tier ctx) 'magic) (pair? rows))
     (paint-arrow 'price-ladder-card ':anchors anchors)
     (envelope-queue (list 'magic-ladder ':rows rows))
     (done))
   ```
   *;; generated*

**Notes:** `when` + `unless` complement `if` for the common case where one arm has no else.

---

### 15.2 Equality and predicates

The R7RS type-predicate set, plus the codebase's `=?` smart-equality
verb. All of these are pure, total, side-effect-free `(perm: 'read')`
base bindings — they're first-class values that can be passed to `map`,
`filter`, `every`, etc.

#### `(=? a b)` and its aliases `eq?` / `equal?`

**Purpose:** smart equality — the PICO-8-style "do what I mean" verb. Numbers + strings by value, lists structurally, symbols by name, everything else by reference.
**Returns:** `#t` or `#f`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:101 · def('=?', _eqQ)`. Helper at `:84 · function _eqQ()`. Legacy aliases `eq?` and `equal?` re-bind to the same `_eqQ` at `:104-105`. **Note the second definition site**: `base.js:244 · def('eq?', (a, b) => a === b)` and `:245 · def('equal?', (a, b) => deepEqual(a, b))` REPLACE the smart-equality bindings for the legacy names — `eq?` ends up as JS `===` (reference equality) and `equal?` ends up as `deepEqual` (length-aware structural). The smart-equality verb is reachable only as `=?`. (Authors moving carts in from other Schemes should prefer `=?`; the legacy spellings are kept compatible with Racket/Chez intuition.)

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ symbol equality:
   ```scheme
   (=? 'magic 'magic)   ;; → #t
   ```
   *;; generated*
2. _(intermediate)_ list equality:
   ```scheme
   (=? '(1 2 3) (list 1 2 3))   ;; → #t — structural compare
   ```
   *;; generated*
3. _(expert)_ predicate composition — pass `=?` directly into `filter`:
   ```scheme
   (filter (lambda (row) (=? (car row) 'magic)) rows)
   ```
   *;; generated*

**Notes:** when reaching for "are these the same?" in cart code, default to `=?`. The numeric `=` (§15.4) is reserved for the numeric comparison chain.

---

#### `(boolean? x)` · `(null? x)` · `(number? x)` · `(pair? x)` · `(procedure? x)` · `(string? x)` · `(symbol? x)`

**Purpose:** R7RS type predicates. Each returns `#t` for the named type and `#f` otherwise.
**Returns:** boolean.
**Side effects:** none.
**Defined in:**
- `boolean?` — `curator-web/src/scheme/base.js:253 · def('boolean?', ...)`
- `null?` — `curator-web/src/scheme/base.js:52 · def('null?', ...)` (true on empty list)
- `number?` — `curator-web/src/scheme/base.js:251 · def('number?', ...)`
- `pair?` — `curator-web/src/scheme/base.js:59 · def('pair?', ...)` (true on NON-empty list — empty list is null, not pair)
- `procedure?` — `curator-web/src/scheme/base.js:61 · def('procedure?', ...)` (JS function OR Closure)
- `string?` — `curator-web/src/scheme/base.js:252 · def('string?', ...)`
- `symbol?` — `curator-web/src/scheme/base.js:60 · def('symbol?', ...)` (instance of `Sym`)

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ guard a list head:
   ```scheme
   (if (pair? rows) (car rows) 'no-rows)
   ```
   *;; generated*
2. _(intermediate)_ closed-tag dispatch combining predicates:
   ```scheme
   (cond
     ((null? finding)   (escalate 'no-data null))
     ((string? finding) (next 'render-text (ctx-set 'msg finding ctx)))
     ((pair? finding)   (next 'render-rows (ctx-set 'rows finding ctx)))
     (else              (escalate 'unknown-shape null)))
   ```
   *;; generated*
3. _(expert)_ pass a predicate to `every`:
   ```scheme
   (when (every number? amounts)
     (next 'sum-amounts ctx))
   ```
   *;; generated*

**Notes:** `null?` and `pair?` partition the list space — `(null? ())` is `#t` and `(pair? ())` is `#f`; for a non-empty list, the reverse. There is no `list?` in this base — use `(or (null? x) (pair? x))` if you need it. `procedure?` accepts both JS primitives (functions) and user-authored `Closure`s, so it correctly classifies anything callable.

---

#### `(zero? x)` · `(positive? x)` · `(negative? x)` · `(even? x)` · `(odd? x)`

**Purpose:** scalar number predicates.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:246-250`. Each is a one-liner over `Math.sign` / modulo.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(if (zero? balance) 'empty 'has-funds)` — *;; generated*
2. _(intermediate)_ stripe rows for a table:
   ```scheme
   (map (lambda (i) (if (even? i) 'light 'dark)) (range 0 12))
   ```
   *;; generated*
3. _(expert)_ filter-with-predicate composition:
   ```scheme
   (count positive? deltas)   ;; how many days were up?
   ```
   *;; generated*

**Notes:** `odd?` uses `Math.abs(x % 2) === 1` (base.js:250) — correct for both positive and negative integers; non-integer arguments return `#f`. `zero?` is strict `=== 0`; floating-point comparisons should use a tolerance check, not `zero?`.

---

#### `(not x)`

**Purpose:** logical negation.
**Returns:** `#t` if `x` is `#f`, else `#f`. **Only `#f` is false** (R7RS — empty list `()` is truthy here).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:42 · def('not', (a) => a === false)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(not (null? rows))` → `#t` if rows is non-empty. *;; generated*
2. _(intermediate)_ in a `when` guard:
   ```scheme
   (when (not (eq? state 'paused)) (next 'fetch ctx))
   ```
   *;; generated*
3. _(expert)_ explicit negative arm in a closed `cond`:
   ```scheme
   (cond
     ((eq? status 'connected)        (next 'fetch ctx))
     ((not (eq? status 'connected))  (escalate 'service-not-yet-wired null)))
   ```
   *Source: `curator-web/src/scheme/carts/personal/daily-news-brief.sks`*

**Notes:** prefer `unless` over `(if (not test) …)` when the negative arm is the only arm. `not` is a function (first-class), not a special form — passable to `every` / `any`.

---

### 15.3 List + sequence atoms

> "It is better to have 100 functions operate on one data structure
> than 10 functions on 10 data structures." — Alan J. Perlis,
> *Epigrams on Programming*, 1982, epigram 9

The Curator Scheme follows Perlis — every list verb operates on the
same JS-array-backed representation. A pair is any array with at least
one element; the empty list is the empty array. There are no separate
"vector" / "deque" / "cons cell" structures at the language layer.

#### `(append lst1 lst2 ...)`

**Purpose:** concatenate any number of lists into one fresh list.
**Returns:** a new list (does not mutate inputs).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:170 · def('append', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(append '(1 2) '(3 4))` → `(1 2 3 4)`. *;; generated*
2. _(intermediate)_ build a chip stack: `(append head-chips body-chips foot-chips)`. *;; generated*
3. _(expert)_ accumulate via reduce — `append` is associative, so reduce is the right shape:
   ```scheme
   (reduce append '() (map render-row rows))
   ```
   *;; generated*

**Notes:** `append` allocates — for large reductions, prefer `reverse` + `cons` patterns. Variadic; `(append)` with no args returns `()`.

---

#### `(argmin lst)`

**Purpose:** index of the smallest number in a list (ties: leftmost wins).
**Returns:** integer index, or `#f` on an empty/non-list input.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:331 · def('argmin', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(argmin '(3 1 4 1 5))` → `1`. *;; generated*
2. _(intermediate)_ pick the shortest column (the bricklay packer's pattern):
   ```scheme
   (let ((bottoms (list 120 80 200 80)))
     (argmin bottoms))   ;; → 1
   ```
   *Source: bricklay layout cart pattern — `base.js:308` block comment*
3. _(expert)_ combine with `list-ref` to extract the lowest of a derived list:
   ```scheme
   (let* ((costs (map cart-cost candidates))
          (i     (argmin costs)))
     (list-ref candidates i))
   ```
   *;; generated*

**Notes:** integers and floats both work — JS `<` is the comparison. For arbitrary-key minimization, write a `reduce` with your own less-than.

---

#### `(assoc key alist)`

**Purpose:** look up `key` in an association list (a list of `(key value …)` lists). Uses structural equality.
**Returns:** the matching sublist, or `#f` if not found.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:293 · def('assoc', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(assoc 'title '((title "Hat") (price 12)))` → `(title "Hat")`. *;; generated*
2. _(intermediate)_ extract a field with a fallback:
   ```scheme
   (let ((pair (assoc ':tier ctx)))
     (if pair (cadr pair) 'free))
   ```
   *;; generated*
3. _(expert)_ closed-tag dispatch on alist presence:
   ```scheme
   (cond
     ((assoc 'vacation state)   (escalate 'state-blocks-spend 'vacation))
     ((assoc 'paused state)     (escalate 'state-blocks-spend 'paused))
     (else                      (next 'check-cache ctx)))
   ```
   *Source: pattern from `curator-web/src/scheme/carts/magic/the-living-business-plan.sks`*

**Notes:** `assoc` returns the WHOLE sublist (use `cadr` to get the value). Carts also use `assq` in some places — that's installed by a separate macros pass, not by `base.js`. `assoc` here uses `deepEqual`, so `(assoc '(a 1) ...)` works structurally.

---

#### `(cadr lst)` and `(caddr lst)`

**Purpose:** second and third elements of a list. Standard Scheme accessors.
**Returns:** the element, or `undefined` if past the end.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:50-51`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(cadr '(a b c))` → `b`. *;; generated*
2. _(intermediate)_ second-tuple-field extract: `(map cadr pairs)`. *;; generated*
3. _(expert)_ deconstruct an RGB triple from a hex parse: `(list (car rgb) (cadr rgb) (caddr rgb))`. *;; generated*

**Notes:** these exist because the long-form `(car (cdr x))` and `(car (cdr (cdr x)))` chain becomes unreadable fast. The conway additive-blend cart cited them as the reason for adding both shortcuts (`base.js:48` comment).

---

#### `(car lst)` and `(cdr lst)`

**Purpose:** first element (`car`) and tail (`cdr`) of a list. The two oldest verbs in Lisp.
**Returns:** `car` → the first element. `cdr` → a fresh list of all but the first.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:46-47`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(car '(1 2 3))` → `1`; `(cdr '(1 2 3))` → `(2 3)`. *;; generated*
2. _(intermediate)_ recurse over a list (note: prefer named-let in this codebase):
   ```scheme
   (define (sum-all lst)
     (if (null? lst) 0 (+ (car lst) (sum-all (cdr lst)))))
   ```
   *;; generated*
3. _(expert)_ destructure-then-fold:
   ```scheme
   (let loop ((rs rows) (rev 0) (n 0))
     (if (null? rs)
         (list rev n)
         (loop (cdr rs)
               (+ rev (assoc 'amount (car rs)))
               (+ n 1))))
   ```
   *;; generated*

**Notes:** `cdr` allocates (it's `Array.prototype.slice`). For tight inner loops, `nth` (§15.3) and `list-ref` are O(1); for ergonomic Scheme idiom, `car`/`cdr` are fine. `(car ())` and `(cdr ())` return `undefined` and `()` respectively — they do NOT throw. If you need to guard, gate with `(pair? x)`.

---

#### `(cons a b)`

**Purpose:** prepend `a` onto `b` (or onto the single-element list `(b)` if `b` isn't a list). The list-builder.
**Returns:** a fresh list with `a` as the head.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:45 · def('cons', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(cons 1 '(2 3))` → `(1 2 3)`. *;; generated*
2. _(intermediate)_ accumulate in reverse, then flip:
   ```scheme
   (let loop ((xs xs) (out '()))
     (if (null? xs) (reverse out) (loop (cdr xs) (cons (car xs) out))))
   ```
   *;; generated — the standard reverse-accumulate idiom*
3. _(expert)_ build a fresh alist entry:
   ```scheme
   (cons (list ':timestamp now)
         (cons (list ':tier tier) existing-meta))
   ```
   *;; generated*

**Notes:** this `cons` represents pairs as JS arrays, NOT as boxed cons cells — `(cons 1 2)` returns `(1 2)` (the tail `2` is wrapped into a single-element list). Authors expecting Scheme's improper-list cons cells (`(1 . 2)`) should be aware that there is no dotted-pair structure in this interpreter; the dotted-tail syntax in `lambda` / `define` param lists is reader-level only.

---

#### `(drop lst n)`

**Purpose:** all but the first `n` elements.
**Returns:** a fresh list (the tail).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:162 · def('drop', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(drop '(a b c d) 2)` → `(c d)`. *;; generated*
2. _(intermediate)_ paginate: `(take (drop rows offset) page-size)`. *;; generated*
3. _(expert)_ skip header rows in a CSV-shaped list: `(map render-row (drop rows 1))`. *;; generated*

**Notes:** non-list input returns `()`. Negative `n` clamps to 0. Pairs with `take` (§15.3).

---

#### `(first lst)` · `(last lst)` · `(nth lst i)` · `(list-ref lst i)`

**Purpose:** positional access. `first` = `(car lst)`. `last` = the final element. `nth` and `list-ref` = O(1) index access; they are aliases.
**Returns:** the element, or `undefined` past the end.
**Side effects:** none.
**Defined in:**
- `first` — `curator-web/src/scheme/base.js:172`
- `last` — `curator-web/src/scheme/base.js:173`
- `nth` — `curator-web/src/scheme/base.js:174`
- `list-ref` — `curator-web/src/scheme/base.js:291`

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(last '(a b c))` → `c`. *;; generated*
2. _(intermediate)_ alternate-row stripe by index: `(map (lambda (i) (if (even? i) 'light 'dark)) (range 0 (length rows)))`. *;; generated*
3. _(expert)_ extract a triple by position: `(list (nth row 0) (nth row 3) (nth row 7))`. *;; generated*

**Notes:** `first` and `nth` are SRFI-1 convenience aliases — `car` and `list-ref` are R7RS canon. In this codebase they all reach for the same JS-array index op. `last` walks via `(length - 1)` index access; on a typical card-row list (≤ 64 entries) the cost is invisible.

---

#### `(length lst)`

**Purpose:** number of elements.
**Returns:** non-negative integer.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:62 · def('length', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(length '(a b c))` → `3`. *;; generated*
2. _(intermediate)_ chip count: `(card-emit 'engine 'ready-count (length finding))`. *Source: `the-living-business-plan.sks` shape*
3. _(expert)_ tier guard by data shape: `(when (>= (length deltas) 12) (next 'assemble-quarter-memo ctx))`. *;; generated*

**Notes:** O(1) — backed by JS `Array.length`. There is no `length` warning on non-list input; it returns `undefined`, which is rarely what you want — gate with `(pair? x)` first if input could be non-list.

---

#### `(list arg1 arg2 ...)`

**Purpose:** construct a fresh list from the given arguments.
**Returns:** the list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:44 · def('list', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(list 1 2 3)` → `(1 2 3)`. *;; generated*
2. _(intermediate)_ build an alist entry: `(list ':tier tier ':fuel fuel)`. *;; generated*
3. _(expert)_ build a row of pair-encoded args to pass to `act`:
   ```scheme
   (act 'cortex/recall
        (list (list ':topic 'living-plan-checkpoint)
              (list ':window 'now))
        'check-prior)
   ```
   *;; generated*

**Notes:** `list` is the friendliest builder when the elements are known statically. For the dynamic accumulation case use `cons` + `reverse`. Variadic; `(list)` with no args returns `()`.

---

#### `(list-index pred lst)`

**Purpose:** index of the first element for which `pred` returns non-`#f`. SRFI-1 standard.
**Returns:** integer index, or `#f` if no element matches.
**Side effects:** invokes `pred` once per element until a hit (shares fuel via the trampoline).
**Defined in:** `curator-web/src/scheme/base.js:324 · def('list-index', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(list-index odd? '(2 4 5 6))` → `2`. *;; generated*
2. _(intermediate)_ find the first connected shop in a list of `(id status)` pairs:
   ```scheme
   (list-index (lambda (s) (eq? (cadr s) 'connected)) shops)
   ```
   *;; generated*
3. _(expert)_ combine with `list-set` to update the first match:
   ```scheme
   (let ((i (list-index (lambda (r) (eq? (car r) target)) rows)))
     (if i (list-set rows i replacement) rows))
   ```
   *;; generated*

**Notes:** SRFI-1 returns `#f` on no-match, not `-1`. Pair with `list-set` (§15.3) for immutable point-mutations.

---

#### `(list-set lst i value)`

**Purpose:** return a NEW list with element `i` replaced by `value`. Pure — the source list is not mutated.
**Returns:** a fresh list of the same length.
**Side effects:** none (note: this is intentionally NOT the destructive `list-set!` of R7RS).
**Defined in:** `curator-web/src/scheme/base.js:318 · def('list-set', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(list-set '(a b c) 1 'X)` → `(a X c)`. *;; generated*
2. _(intermediate)_ update one column-bottom in the bricklay packer:
   ```scheme
   (list-set bottoms i (+ (nth bottoms i) card-h))
   ```
   *Source: bricklay layout cart pattern — `base.js:303` block comment*
3. _(expert)_ apply a function at one index:
   ```scheme
   (define (update-at lst i fn)
     (list-set lst i (fn (nth lst i))))
   ```
   *;; generated*

**Notes:** out-of-range `i` returns the list unchanged. The immutable shape matches every other list verb here — there is no destructive `list-set!` exposed. The whole-array `.slice()` copy is fine for the cart-scale lists (≤ 256 elements) the codebase uses.

---

#### `(make-list n value)`

**Purpose:** a fresh list of length `n` filled with `value`.
**Returns:** the list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:312 · def('make-list', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(make-list 4 0)` → `(0 0 0 0)`. *;; generated*
2. _(intermediate)_ initial column-bottoms vector for the bricklay packer:
   ```scheme
   (make-list num-cols BRICKLAY-MARGIN)
   ```
   *Source: bricklay layout cart pattern — `base.js:299` block comment*
3. _(expert)_ seeded mutable accumulator (use sparingly — pure folds are usually better):
   ```scheme
   (let ((slots (make-list 16 #f)))
     (for-each (lambda (i) (when (eligible? i) (set-slot slots i))) (range 0 16))
     slots)
   ```
   *;; generated*

**Notes:** `n` is clamped to ≥ 0 and truncated to int. All cells share the same `value` reference — fine for atoms (numbers/symbols), be careful with mutable objects.

---

#### `(member x lst)`

**Purpose:** membership test that returns the tail starting at the match. Uses structural equality (`deepEqual`).
**Returns:** the sublist beginning at the first match, or `#f` if not found.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:292 · def('member', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(member 'b '(a b c))` → `(b c)`. *;; generated*
2. _(intermediate)_ dedup check:
   ```scheme
   (if (member id seen) #f (begin (set! seen (cons id seen)) #t))
   ```
   *;; generated — the dedup-with-closure-state pattern*
3. _(expert)_ as a presence guard in a `cond`:
   ```scheme
   (cond
     ((member tier '(dream magic)) (next 'render-full ctx))
     ((member tier '(imagine))     (next 'render-mid ctx))
     (else                         (next 'render-cheap ctx)))
   ```
   *;; generated*

**Notes:** Scheme's "return the tail" rather than "return boolean" is intentional — a truthy result is usable directly in `cond` / `if`, and you can peek at what came after. For boolean-only membership, wrap in `pair?` or use `any` (§15.6).

---

#### `(range a b)`

**Purpose:** the list of integers `a, a+1, …, b-1`.
**Returns:** a fresh list of integers. Empty if `a >= b`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:63 · def('range', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(range 0 5)` → `(0 1 2 3 4)`. *;; generated*
2. _(intermediate)_ paint a row of points at index-derived x positions:
   ```scheme
   (for-each (lambda (i) (paint-point-at (* 30 i) 100)) (range 0 8))
   ```
   *;; generated*
3. _(expert)_ index-zip with `zip`: `(zip (range 0 (length rows)) rows)` → indexed list. *;; generated*

**Notes:** half-open `[a, b)` — matches the Python/Racket convention, NOT the SRFI-1 `iota` shape. Single-arg `(range n)` is NOT supported; always pass both bounds.

---

#### `(reverse lst)`

**Purpose:** return a fresh list with elements in reverse order.
**Returns:** a fresh list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:171 · def('reverse', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(reverse '(1 2 3))` → `(3 2 1)`. *;; generated*
2. _(intermediate)_ the canonical accumulate-then-flip idiom:
   ```scheme
   (let loop ((xs xs) (out '()))
     (if (null? xs) (reverse out) (loop (cdr xs) (cons (car xs) out))))
   ```
   *;; generated*
3. _(expert)_ chronological reorder of a stack-shaped event list: `(reverse events)`. *;; generated*

**Notes:** `reverse` allocates one fresh JS array. For "is this list reversed?" queries, prefer index-based access (`list-ref lst (- (length lst) 1 i)`).

---

#### `(sort lst less?)`

**Purpose:** stable ascending sort under the two-arg `less?` predicate.
**Returns:** a fresh list.
**Side effects:** invokes `less?` `O(n log n)` times (shares the trampoline fuel).
**Defined in:** `curator-web/src/scheme/base.js:340 · def('sort', ...)`. Stability via decorate-sort-undecorate.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ ascending numeric sort: `(sort '(3 1 4 1 5) <)` → `(1 1 3 4 5)`. *;; generated*
2. _(intermediate)_ sort rows by amount descending:
   ```scheme
   (sort rows (lambda (a b) (> (assoc 'amount a) (assoc 'amount b))))
   ```
   *;; generated*
3. _(expert)_ FFD-style bricklay pre-sort by (height desc, width desc):
   ```scheme
   (sort cards
         (lambda (a b)
           (let ((ah (nth a 2)) (bh (nth b 2)))
             (if (= ah bh) (> (nth a 1) (nth b 1)) (> ah bh)))))
   ```
   *;; generated — pattern used before `bricklay-pack-native` is called*

**Notes:** stable — equal elements preserve their relative input order. Returns the input unchanged on non-list input. For descending sort, pass `>` (or invert the comparison inside `less?`).

---

#### `(take lst n)`

**Purpose:** the first `n` elements (or all of them if `n` exceeds the length).
**Returns:** a fresh list.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:161 · def('take', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(take '(a b c d) 2)` → `(a b)`. *;; generated*
2. _(intermediate)_ top-3 picker: `(take (sort topics rank>) 3)`. *;; generated*
3. _(expert)_ paginate the cart-news rendering: `(take (drop rows (* page page-size)) page-size)`. *;; generated*

**Notes:** non-list input returns `()`. Negative `n` clamps to 0. Pairs with `drop`.

---

#### `(zip lst-a lst-b)`

**Purpose:** pair up corresponding elements; result length is `min(len-a, len-b)`.
**Returns:** a list of two-element lists.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:163 · def('zip', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(zip '(a b c) '(1 2 3))` → `((a 1) (b 2) (c 3))`. *;; generated*
2. _(intermediate)_ index-zip via `range`: `(zip (range 0 (length rows)) rows)`. *;; generated*
3. _(expert)_ x/y interleave for paint dispatch:
   ```scheme
   (for-each (lambda (pt) (paint-point-at (car pt) (cadr pt)))
             (zip xs ys))
   ```
   *;; generated*

**Notes:** two-list only; for n-ary zip, compose with `map` over `zip`. The shorter input wins — no padding, no error.

---

### 15.4 Arithmetic atoms

> "A LISP programmer knows the value of everything, but the cost of
> nothing." — Alan J. Perlis, *Epigrams on Programming*, 1982,
> epigram 55

Standard R7RS arithmetic + numeric comparisons + the codebase's
shop-shaped helpers (`pct`, `margin`, `cagr`). All variadic forms
short-fold; binary forms are strict two-arg.

#### `(+ a b ...)` · `(- a b ...)` · `(* a b ...)` · `(/ a b ...)`

**Purpose:** variadic arithmetic.
**Returns:** number. `(+)` → 0, `(*)` → 1. Unary `(- x)` → negation, `(/ x)` → reciprocal.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:26-29`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(+ 1 2 3)` → `6`; `(- 10 1 2)` → `7`; `(* 2 3 4)` → `24`; `(/ 100 2 5)` → `10`. *;; generated*
2. _(intermediate)_ sum a row of amounts: `(reduce + 0 amounts)`. *;; generated*
3. _(expert)_ chained derivation:
   ```scheme
   (let* ((gross (* qty unit-price))
          (fees  (+ (* gross 0.06) shipping-fee))
          (net   (- gross fees)))
     net)
   ```
   *;; generated*

**Notes:** all four are JS-double-backed — no rationals, no bignums. For money math, the dedicated finance verbs (`pct`, `margin`, `markup`, `markdown`, `profit`, `fee`, `net` at `base.js:212-219`) are correct-rounded for the percent-shaped operations carts reach for first.

---

#### `(< a b)` · `(<= a b)` · `(= a b)` · `(>= a b)` · `(> a b)`

**Purpose:** numeric comparison. **Binary only** in this interpreter — no chained `(< a b c)` (that's a separate macro layer).
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:37-41`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(< 1 2)` → `#t`. *;; generated*
2. _(intermediate)_ gate by row count: `(>= (length rows) 12)`. *;; generated*
3. _(expert)_ filter to a numeric window:
   ```scheme
   (filter (lambda (x) (and (>= x lo) (< x hi))) values)
   ```
   *;; generated*

**Notes:** `=` is **numeric** comparison only (`a === b` after both are numbers); for symbol/list equality use `=?` (§15.2). Chained Scheme `(< a b c d)` is not directly supported here — write `(and (< a b) (< b c) (< c d))` or install a macro.

---

#### `(abs x)` · `(max a b ...)` · `(min a b ...)` · `(sign x)`

**Purpose:** standard scalar math.
**Returns:** number. `sign` → `-1`, `0`, or `1`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:33-35, 191`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(abs -7)` → `7`; `(max 1 5 3)` → `5`. *;; generated*
2. _(intermediate)_ clamp positive deltas only: `(map (lambda (d) (max 0 d)) deltas)`. *;; generated*
3. _(expert)_ direction-of-change indicator: `(sign (- now prev))` → `-1`/`0`/`1`. *;; generated*

**Notes:** all variadic except `abs` and `sign`. `max` / `min` follow JS — `Math.max(...args)` — which means a single non-number argument poisons the call to `NaN`. Filter first.

---

#### `(ceil x)` / `(ceiling x)` · `(floor x)` · `(round x)` · `(round2 x)`

**Purpose:** rounding.
**Returns:** number. `round2` rounds to 2 decimal places (the money helper).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:184-190`. `ceil` and `ceiling` are aliases (`:185, :188`).

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(round 3.7)` → `4`; `(floor 3.7)` → `3`. *;; generated*
2. _(intermediate)_ dollar-round a derived price: `(round2 (* base 1.0875))`. *;; generated*
3. _(expert)_ snap a coordinate to the grid: `(* GRID (floor (/ x GRID)))`. *;; generated*

**Notes:** `round` follows JS `Math.round` — half-to-positive-infinity, NOT banker's rounding. For money, `round2` is the convention.

---

#### `(clamp x lo hi)` · `(lerp a b t)`

**Purpose:** clamp `x` into `[lo, hi]`; lerp linearly interpolates between `a` and `b` by `t`.
**Returns:** number.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:192-193`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(clamp 130 0 100)` → `100`. *;; generated*
2. _(intermediate)_ fade in: `(lerp 0 1 (/ frame 60))`. *;; generated*
3. _(expert)_ ease a coordinate inside a guard:
   ```scheme
   (let ((t (clamp (/ (- now t0) dur) 0 1)))
     (lerp x0 x1 t))
   ```
   *;; generated — the common motion-tween shape*

**Notes:** `lerp` does NOT clamp `t` — pass values outside `[0,1]` and you get extrapolation. Wrap with `clamp` if you need bounded interpolation.

---

#### `(cos x)` · `(sin x)` · `(tan x)` · `(atan2 y x)` · `(sqrt x)` · `(expt b p)`

**Purpose:** scalar trig and powers.
**Returns:** number.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:177-183` — `sqrt` at `:177`; `cos`, `sin`, `tan`, `atan2` at `:178-181`; `expt` at `:183` (`pi` is the value bound at `:182`).

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(sqrt 9)` → `3`. *;; generated*
2. _(intermediate)_ polar-to-cartesian:
   ```scheme
   (let ((x (* r (cos theta))) (y (* r (sin theta)))) (list x y))
   ```
   *;; generated*
3. _(expert)_ ring of points using radial spread:
   ```scheme
   (for-each (lambda (i)
               (let ((theta (* 2 pi (/ i 12))))
                 (paint-point-at (+ cx (* r (cos theta)))
                                 (+ cy (* r (sin theta))))))
             (range 0 12))
   ```
   *;; generated — modelled on the celebration-burst pattern at §14.3*

**Notes:** `atan2` is the four-quadrant inverse tangent — `(atan2 y x)` returns a radian angle. `pi` is a value, not a thunk — bind as `pi`, not `(pi)`. `expt` is `Math.pow`.

---

#### `(modulo x y)` · `(quotient x y)` · `(remainder x y)`

**Purpose:** integer division verbs.
**Returns:** number. `modulo` matches mathematical modulo (always non-negative when `y > 0`); `quotient` truncates toward zero; `remainder` is `x - trunc(x/y)*y`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:30-32`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(modulo -7 3)` → `2`; `(remainder -7 3)` → `-1`. *;; generated*
2. _(intermediate)_ stripe rows mod 2: `(map (lambda (i) (if (= 0 (modulo i 2)) 'light 'dark)) (range 0 8))`. *;; generated*
3. _(expert)_ wrap an angle: `(modulo theta-degrees 360)`. *;; generated*

**Notes:** **prefer `modulo` over `remainder`** for any code that should handle negative inputs cleanly. JS's `%` operator behaves like `remainder`; `modulo` is implemented as `((x % y) + y) % y` to give the mathematician's modulo.

---

#### `(sum lst)` · `(mean lst)` · `(sma lst n)`

**Purpose:** aggregate helpers. `sum` sums a list; `mean` averages; `sma` returns a simple moving average as a fresh list.
**Returns:** number for `sum`/`mean`; list of numbers for `sma`.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:208-228`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(sum '(1 2 3))` → `6`; `(mean '(2 4 6))` → `4`. *;; generated*
2. _(intermediate)_ 7-day SMA of daily revenue:
   ```scheme
   (sma daily-revenue 7)
   ```
   *;; generated*
3. _(expert)_ derived feature for a Loam cart:
   ```scheme
   (let* ((rev   (map (lambda (r) (assoc 'amount r)) receipts))
          (sma7  (sma rev 7))
          (trend (if (and (pair? sma7) (> (last sma7) (first sma7))) 'up 'down)))
     (next 'render (ctx-set 'trend trend ctx)))
   ```
   *;; generated*

**Notes:** `sma` returns a list of length `(- (length lst) n -1)` if `n ≤ length`; otherwise `()`. `mean` of `()` is `0` (not `NaN`) — a safe-default convention specific to this base.

---

#### `(pct a b)` · `(pct-change old new)` · `(margin price cost)` · `(markup cost pct-up)` · `(markdown price pct-off)` · `(profit revenue cost)` · `(fee amount rate-pct)` · `(net gross fee1 fee2 ...)` · `(cagr begin end years)`

**Purpose:** the codebase's shop-shaped finance verbs.
**Returns:** number. `pct` returns "`a` as a percent of `b`" (0–100, not 0–1).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:212-220`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(pct 25 100)` → `25`. *;; generated*
2. _(intermediate)_ pricing ladder math: `(markup 12.50 35)` → `16.875`. *;; generated*
3. _(expert)_ compose into a single derived row:
   ```scheme
   (list ':price price
         ':cost  cost
         ':margin-pct (round2 (margin price cost))
         ':fee-pct    (round2 (pct (fee price 6.5) price)))
   ```
   *;; generated*

**Notes:** all of these are **percent-shaped** (0–100, not 0–1) — matches the cart-author intuition. Divide-by-zero is safe (returns 0); divide by `years <= 0` is also safe in `cagr`. For very small amounts where floating point bites, run through `round2`.

---

#### `(above? x t)` · `(below? x t)` · `(crossed? prev now t)`

**Purpose:** threshold predicates over a single value or two consecutive samples.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:232-234`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(above? balance 100)` → `#t` if `balance > 100`. *;; generated*
2. _(intermediate)_ alert when revenue crossed a target: `(when (crossed? yesterday-rev today-rev target) (card-emit 'engine 'crossed target))`. *;; generated*
3. _(expert)_ closed-cond classifier:
   ```scheme
   (cond
     ((above? delta hi-watermark)  (escalate 'spike delta))
     ((below? delta lo-watermark)  (escalate 'dip delta))
     (else                         (next 'observe ctx)))
   ```
   *;; generated*

**Notes:** `crossed?` is direction-agnostic — it's true for either upward or downward crossing. For direction-aware crossings, pair with `(- now prev)` and check `sign`.

---

### 15.5 String + number conversion atoms

#### `(string-append str1 str2 ...)`

**Purpose:** concatenate any number of values (coerced to string) into one.
**Returns:** string.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:254 · def('string-append', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(string-append "Hello, " "world")` → `"Hello, world"`. *;; generated*
2. _(intermediate)_ build a hex color: `(string-append "#" (byte->hex r) (byte->hex g) (byte->hex b))`. *;; generated*
3. _(expert)_ render a row label: `(string-append (assoc 'shop row) " · " (number->string (assoc 'rev row)))`. *;; generated*

**Notes:** non-string args are coerced via JS `String(x)` — numbers and booleans become their print form, lists become `1,2,3`-style JS array-toString, which is usually NOT what you want. For structured pretty-printing, use `inspect` (§15.5, below).

---

#### `(string-eq? a b)` and `(string=? a b)`

**Purpose:** string equality (after coercion to string). Aliases.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:257-258`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(string=? "magic" "magic")` → `#t`. *;; generated*
2. _(intermediate)_ dispatch on string tag:
   ```scheme
   (cond
     ((string=? kind "row")    (render-row x))
     ((string=? kind "header") (render-header x))
     (else                     (render-default x)))
   ```
   *;; generated*
3. _(expert)_ filter rows by exact-name match: `(filter (lambda (r) (string=? (assoc 'shop r) target-shop)) rows)`. *;; generated*

**Notes:** `=?` (§15.2) also handles strings — `(=? "a" "a")` is `#t`. The dedicated `string=?` is here for code coming from other Schemes; either works.

---

#### `(string-length s)` · `(string-ref s i)` · `(substring s a [b])`

**Purpose:** string index and slice.
**Returns:** integer length, single-character string (`string-ref`), substring slice (`substring`).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:255-260`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(string-length "magic")` → `5`; `(string-ref "hi" 1)` → `"i"`. *;; generated*
2. _(intermediate)_ first three chars: `(substring "shopkeeper" 0 3)` → `"sho"`. *;; generated*
3. _(expert)_ split a 6-digit hex into two-byte components:
   ```scheme
   (list (substring color 1 3) (substring color 3 5) (substring color 5 7))
   ```
   *;; generated — the conway additive-blend pattern*

**Notes:** `substring` is `[a, b)` (half-open, matches JS `String.substring`). The single-arg form `(substring s a)` slices to end; `b = undefined` is treated specially in the def.

---

#### `(number->string n [radix])` · `(string->number s [radix])`

**Purpose:** scalar conversion between numbers and strings, with optional radix (default 10).
**Returns:** string for `number->string`; number for `string->number`, or `#f` on parse failure.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:261-278`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(number->string 42)` → `"42"`. *;; generated*
2. _(intermediate)_ hex conversion: `(number->string 255 16)` → `"ff"`; `(string->number "ff" 16)` → `255`. *;; generated*
3. _(expert)_ safe parse with fallback:
   ```scheme
   (let ((n (string->number user-input)))
     (if n (next 'use-n (ctx-set 'n n ctx)) (escalate 'bad-number user-input)))
   ```
   *;; generated*

**Notes:** **`string->number` returns `#f` on parse failure** — gate the result before using it. Hex parsing accepts both bare `"ff"` and the `"0xff"` prefix (`base.js:276 · str.startsWith('0x') || str.startsWith('0X')`). Radix 10 uses `parseFloat` so decimals work; non-10 radix uses integer-only `parseInt`.

---

#### `(hex-byte s i)` · `(byte->hex n)`

**Purpose:** hex-color helpers. `hex-byte` reads two hex chars at offset `i` as a 0–255 byte; `byte->hex` converts back, lowercase, zero-padded.
**Returns:** integer (`hex-byte`); two-char string (`byte->hex`).
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:282-289`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(hex-byte "#ff8040" 1)` → `255`. *;; generated*
2. _(intermediate)_ byte→hex round-trip: `(byte->hex 64)` → `"40"`. *;; generated*
3. _(expert)_ additive blend two hex colors:
   ```scheme
   (define (blend a b)
     (string-append "#"
       (byte->hex (min 255 (+ (hex-byte a 1) (hex-byte b 1))))
       (byte->hex (min 255 (+ (hex-byte a 3) (hex-byte b 3))))
       (byte->hex (min 255 (+ (hex-byte a 5) (hex-byte b 5))))))
   ```
   *Source: pattern from `curator-web/src/scheme/carts/radio/conway.sks` (additive blend code that motivated these helpers — see `base.js:279-281` block comment)*

**Notes:** `hex-byte` does NOT validate the `#` prefix — pass offsets `1, 3, 5` for a `#rrggbb` string. Out-of-range input returns `0` (`base.js:284 · NaN-guard`).

---

#### `(vector-ref v i)`

**Purpose:** index access on what this base calls a "vector" — which, in this interpreter, is just a list (there's no separate vector type).
**Returns:** the element, or `null` on non-list input.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:259 · def('vector-ref', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(vector-ref '(a b c) 1)` → `b`. *;; generated*
2. _(intermediate)_ use as a generic O(1) index access: `(vector-ref row 0)`. *;; generated*
3. _(expert)_ kept for compat — most code uses `nth` / `list-ref` / `cadr` instead. *;; generated*

**Notes:** retained for R7RS-shaped imports. `vector-ref` and `list-ref` (§15.3) and `nth` are functionally identical in this interpreter — pick one per cart for consistency.

---

#### `(inspect v)`

**Purpose:** pretty-print any value as a flat, readable string suitable for `(display)` or `(text ...)`. Truncates long strings, recursive descent up to depth 4 for lists.
**Returns:** string.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:139 · def('inspect', ...)`. Helper at `:111 · function _show()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(inspect '(a 1 "b"))` → `"(a 1 \"b\")"`. *;; generated*
2. _(intermediate)_ render a debug line: `(display (inspect ctx)) (newline)`. *;; generated*
3. _(expert)_ closure-aware shape — closures render as `<fn>`:
   ```scheme
   (inspect (list 'tier 'magic 'cb (lambda (x) x)))
   ;; → "(tier magic cb <fn>)"
   ```
   *;; generated*

**Notes:** intended for in-cart debug surfaces and PICO-8-style REPL exploration. Lists past depth 4 print as `(…)`; strings over 80 chars truncate with `…`. Not pretty-printed (no newlines); use `display` + `newline` for line-by-line.

---

### 15.6 Higher-order atoms

These are the verbs that take a function as an argument and re-enter
the evaluator through `apply()`. They share the same fuel budget as
direct application — there is no way to escape the fuel cap through
higher-order composition.

#### `(apply fn args)`

**Purpose:** invoke `fn` with the list `args` as the argument list.
**Returns:** whatever `fn` returns.
**Side effects:** whatever `fn` has; shares the same fuel.
**Defined in:** `curator-web/src/scheme/base.js:71 · def('apply', ...)`. Internal `apply` (the JS export) at `interp.js:458 · function apply()`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(apply + '(1 2 3))` → `6`. *;; generated*
2. _(intermediate)_ forward an arg list to a verb: `(apply paint-arrow paint-args)`. *;; generated*
3. _(expert)_ build the arg list then dispatch:
   ```scheme
   (let ((args (cons 'price-ladder-card (compute-anchors anchors))))
     (apply paint-arrow args))
   ```
   *;; generated*

**Notes:** non-list `args` is wrapped in a single-element list (`base.js:71`). The Scheme-level `apply` is a thin wrapper over the interp's internal `apply`; both share the trampoline.

---

#### `(any pred lst)` · `(every pred lst)` · `(count pred lst)`

**Purpose:** SRFI-1 short-circuit reductions. `any` is true on the first hit; `every` is false on the first miss; `count` is the total number of hits.
**Returns:** boolean (`any`, `every`), integer (`count`).
**Side effects:** invokes `pred` once per element until termination; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:145-160`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(any odd? '(2 4 5 6))` → `#t`. *;; generated*
2. _(intermediate)_ tier gate: `(every (lambda (r) (= (assoc 'tier r) 'magic)) rows)`. *;; generated*
3. _(expert)_ score by predicate count:
   ```scheme
   (let ((ok-count (count (lambda (s) (eq? (cadr s) 'connected)) shops)))
     (when (>= ok-count 3) (next 'render ctx)))
   ```
   *;; generated*

**Notes:** non-list input — `any` → `#f`, `every` → `#t` (vacuous truth), `count` → `0`. Same defaults you'd want for empty input.

---

#### `(filter pred lst)`

**Purpose:** retain elements where `pred` returns non-`#f`.
**Returns:** a fresh list.
**Side effects:** invokes `pred` exactly once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:67 · def('filter', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(filter positive? '(-1 2 -3 4))` → `(2 4)`. *;; generated*
2. _(intermediate)_ pick connected shops: `(filter (lambda (s) (eq? (cadr s) 'connected)) shops)`. *;; generated*
3. _(expert)_ closure-with-state dedup (also shown under `lambda`):
   ```scheme
   (let ((seen '()))
     (filter (lambda (id)
               (if (member id seen)
                   #f
                   (begin (set! seen (cons id seen)) #t)))
             listings))
   ```
   *;; generated*

**Notes:** Curator-Scheme convention: only `#f` is filtered out — `()`, `0`, `""` are all RETAINED. R7RS-correct.

---

#### `(for-each fn lst)`

**Purpose:** call `fn` on each element for its side effects.
**Returns:** `undefined`.
**Side effects:** invokes `fn` once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:65 · def('for-each', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(for-each display '("a" "b" "c"))`. *;; generated*
2. _(intermediate)_ stagger paint calls along an index:
   ```scheme
   (for-each (lambda (i) (paint-point-at (* 30 i) 100)) (range 0 8))
   ```
   *;; generated*
3. _(expert)_ multi-line debug dump:
   ```scheme
   (for-each (lambda (row)
               (display (inspect row)) (newline))
             rows)
   ```
   *;; generated*

**Notes:** the explicit "I want only the effects, throw away the values" verb — use it instead of `map` when you don't need the result list (saves an allocation).

---

#### `(map fn lst)`

**Purpose:** apply `fn` to each element; collect the results.
**Returns:** a fresh list of the same length.
**Side effects:** invokes `fn` once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:66 · def('map', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(map (lambda (x) (* x x)) '(1 2 3))` → `(1 4 9)`. *;; generated*
2. _(intermediate)_ extract a field column: `(map (lambda (r) (assoc 'amount r)) rows)`. *;; generated*
3. _(expert)_ map composed with `sum`:
   ```scheme
   (sum (map (lambda (r) (assoc 'amount r)) receipts))
   ```
   *;; generated — the canonical "total revenue" derivation*

**Notes:** single-list `map` only — no n-ary `(map fn lst1 lst2)`. For two-list parallel iteration, `zip` (§15.3) first, then `map` over the pairs.

---

#### `(reduce fn init lst)`

**Purpose:** left-fold; combine elements into a single accumulator value, starting from `init`.
**Returns:** the final accumulator value.
**Side effects:** invokes `fn` once per element; shares fuel.
**Defined in:** `curator-web/src/scheme/base.js:68 · def('reduce', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(reduce + 0 '(1 2 3))` → `6`. *;; generated*
2. _(intermediate)_ build a string: `(reduce string-append "" '("a" "b" "c"))` → `"abc"`. *;; generated*
3. _(expert)_ structural accumulation — sum receipts with running max:
   ```scheme
   (reduce (lambda (acc r)
             (let ((amt (assoc 'amount r)))
               (list (+ (car acc) amt)
                     (max (cadr acc) amt))))
           '(0 0)
           receipts)
   ;; → (total max-single-receipt)
   ```
   *;; generated*

**Notes:** left-fold only (no `reduce-right`). The accumulator is the FIRST arg of `fn`, the element is the second. For "sum a list of numbers," `(sum lst)` (§15.4) is shorter and clearer.

---

### 15.7 Randomness atoms — the seeded/un-seeded split

This base intentionally exposes the JS engine's non-deterministic
`Math.random()` under the name `rng-uniform` **only**. The friendly name
`random` is left to be installed by the cards runtime
(`runWithCards`) with a **seeded** RNG, so any cart that uses `(random)`
is byte-identically replayable. The implication for the few code paths
that hit `run()` / `runSurface()` directly: those don't install a seeded
`random`, so they reach the raw uniform under the `rng-uniform` name.

If you're authoring a primitive that needs randomness, prefer one of
the named variants below — they're available in both contexts.

#### `(rng-uniform)`

**Purpose:** raw, non-deterministic uniform float in `[0, 1)`. The escape hatch under `run()` / `runSurface()`; cart authors should rarely call this directly.
**Returns:** float `[0, 1)`.
**Side effects:** consumes one tick of the underlying RNG (the JS engine's `Math.random`).
**Defined in:** `curator-web/src/scheme/base.js:200 · def('rng-uniform', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(rng-uniform)` → some float. *;; generated*
2. _(intermediate)_ scaled into a range manually: `(* (rng-uniform) 100)` → `[0, 100)`. *;; generated*
3. _(expert)_ inside a primitive that doesn't want seeding (e.g. a one-shot bench): `(let ((noise (rng-uniform))) ...)`. *;; generated*

**Notes:** **DO NOT use `rng-uniform` in cards-runtime carts.** The cart runtime overrides `random` with a seeded RNG so replays are byte-identical; `rng-uniform` bypasses that — you'll get a different cart trace every time. See the block comment at `base.js:194-199` for the determinism rationale. Seeded by process-time on runtime start; not user-seedable. For deterministic RNG, seedable primitives are planned for v1.5+.

---

#### `(randint a b)` · `(random-int n)` · `(random-range lo hi)` · `(random-pick lst)`

**Purpose:** the named-variant random verbs.
**Returns:** integer (`randint`, `random-int`); float (`random-range`); element (`random-pick`); `null` on empty list for `random-pick`.
**Side effects:** consumes one tick of the underlying RNG per call.
**Defined in:** `curator-web/src/scheme/base.js:201-207`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(randint 0 10)` → integer in `[0, 10)`. *;; generated*
2. _(intermediate)_ pick a random sprite: `(random-pick '(coral mint blossom lilac))`. *;; generated*
3. _(expert)_ randomized layout perturbation:
   ```scheme
   (for-each (lambda (card)
               (move-card card
                          (random-range 0 (- canvas-w 200))
                          (random-range 0 (- canvas-h 200))))
             cards)
   ```
   *;; generated*

**Notes:** these reach the SAME underlying source as `rng-uniform` when called via `run()`; under `runWithCards`, the named `random` is replaced with a seeded variant and so are these. `random-pick` on `()` returns `null` rather than throwing — safe-default convention.

---

### 15.8 Geometry + threshold atoms — the game kit

The verbs `dist`, `near?`, `in-rect?`, and `overlap?` collectively let
cart code do collision detection without pulling in a physics library.
They're the substrate the higher-level paint and sprite verbs sit on.

#### `(dist x1 y1 x2 y2)`

**Purpose:** Euclidean distance between two 2D points.
**Returns:** non-negative float.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:237 · def('dist', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(dist 0 0 3 4)` → `5`. *;; generated*
2. _(intermediate)_ click-on-target gate: `(when (< (dist click-x click-y card-x card-y) 30) ...)`. *;; generated*
3. _(expert)_ k-nearest-card pick:
   ```scheme
   (let ((ranked (sort cards
                       (lambda (a b)
                         (< (dist mx my (nth a 1) (nth a 2))
                            (dist mx my (nth b 1) (nth b 2)))))))
     (take ranked 3))
   ```
   *;; generated*

**Notes:** `Math.hypot` under the hood — numerically stable for very large or very small inputs.

---

#### `(near? x1 y1 x2 y2 r)`

**Purpose:** test whether two points are within `r` of each other.
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:238 · def('near?', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(near? 0 0 1 1 2)` → `#t`. *;; generated*
2. _(intermediate)_ proximity-based emit: `(when (near? sprite-x sprite-y target-x target-y 16) (card-emit 'engine 'reached null))`. *;; generated*
3. _(expert)_ collect all sprites within range:
   ```scheme
   (filter (lambda (s) (near? cx cy (nth s 1) (nth s 2) blast-radius))
           sprites)
   ```
   *;; generated*

**Notes:** uses the same `Math.hypot` as `dist` — same numeric stability. `r` is inclusive (`<=`).

---

#### `(in-rect? px py x y w h)`

**Purpose:** point-in-axis-aligned-rectangle test. Inclusive on top-left, exclusive on bottom-right (matches the usual pixel-buffer convention).
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:239 · def('in-rect?', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(in-rect? 5 5 0 0 10 10)` → `#t`. *;; generated*
2. _(intermediate)_ hit-test a card: `(in-rect? click-x click-y card-x card-y card-w card-h)`. *;; generated*
3. _(expert)_ enumerate which card was clicked:
   ```scheme
   (list-index (lambda (c)
                 (in-rect? mx my (nth c 1) (nth c 2) (nth c 3) (nth c 4)))
               cards)
   ```
   *;; generated*

**Notes:** the `[x, x+w)` half-open form is what the bricklay packer (`base.js:512 · rectOverlapsAny`) uses for its overlap test, so `in-rect?` + `overlap?` are consistent: two cards that share an edge don't overlap.

---

#### `(overlap? x1 y1 w1 h1 x2 y2 w2 h2)`

**Purpose:** axis-aligned rectangle overlap test. Strict — cards touching at edges do NOT overlap (the bricklay GAP convention).
**Returns:** boolean.
**Side effects:** none.
**Defined in:** `curator-web/src/scheme/base.js:240 · def('overlap?', ...)`.

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(overlap? 0 0 10 10 5 5 10 10)` → `#t`. *;; generated*
2. _(intermediate)_ guard a card placement: `(when (overlap? nx ny nw nh existing-x existing-y existing-w existing-h) (try-next-anchor))`. *;; generated*
3. _(expert)_ check a new rect against every placed rect — the per-step shape inside the bricklay packer:
   ```scheme
   (any (lambda (p)
          (overlap? nx ny nw nh (nth p 0) (nth p 1) (nth p 2) (nth p 3)))
        placed)
   ```
   *;; generated — matches `base.js:512 · rectOverlapsAny()` semantics*

**Notes:** strict-on-touch means rects sharing an edge (`a.x + a.w === b.x`) test as **not** overlapping — important when GAP > 0 lives between them. The native `bricklay-pack-native` (`base.js:396`) inlines this same condition for hot-path performance; Scheme-side cart code should use `overlap?` for clarity.

---

### 15.9 Display atoms

The two output verbs documented here are NOT in `base.js` directly — they
are installed by a small printer module the host wires before
`makeBaseEnv`. They are included in this chapter for completeness because
operators reach for them as if they were base primitives. Backing
citation points at the installer.

#### `(display x)` and `(newline)`

**Purpose:** debug + REPL print verbs. `display` writes a value to stdout (or the cart's debug pane in the cards runtime); `newline` writes a line terminator.
**Returns:** `undefined`.
**Side effects:** writes to the host's display sink — in tests, captured per-cart; in dev, the browser console; in the cards runtime, the cart's debug pane.
**Defined in:** installed by the cart host's display layer (see `curator-web/src/scheme/index.js` for the host wiring; the printer impl is selected per runtime — tests inject a capture sink, browser runtimes inject a `console.log`-shaped sink).

**Examples — Novice / Intermediate / Expert:**
1. _(novice)_ `(display "hello") (newline)` — *;; generated*
2. _(intermediate)_ dump derived values during cart authoring:
   ```scheme
   (display "tier: ") (display (ctx-get 'tier ctx)) (newline)
   (display "fuel: ") (display fuel-left) (newline)
   ```
   *;; generated*
3. _(expert)_ structured per-row debug:
   ```scheme
   (for-each (lambda (row)
               (display "  row: ") (display (inspect row)) (newline))
             rows)
   ```
   *;; generated*

**Notes:** these are best for cart-authoring/debugging, not for operator-facing output — the operator-facing surface is `text` / `table` / `paint-*`. If your `display` calls survive into a shipped cart, lint will warn.

---

## 16. 2026-06-30 / 07-01 roll-up · intelligence hooks, clock, world-knowledge, registry, category-knowledge

> **Fold date 2026-07-01** (Jess, doc-freshness gate). Six subsystems
> locked 2026-06-30 → 2026-07-01 land here. Every entry below was
> re-cited against `curator-web/src/scheme/base.js` at its current head
> and carries an honest wired/partial/no state. Where a verb's runtime
> body is a deliberate `'service-not-yet-wired` escalator, that is the
> **shipped, correct** behaviour — honest-null over fluent-wrong — and it
> is marked **no (honest escalator)**, not "broken".
>
> Design context (not repeated per verb): weights teach the model *how*
> to speak about arbitrary values; the values themselves live in the
> database / Cortex / a wire-call. See
> [`ENGINEERING.md`](ENGINEERING.md)
> §16 for the resolver architecture and the "close data, close paren"
> RAG-binding rule.

### 16.1 `clock/*` — orchestration timing primitives (locked 2026-06-30)

Pure functions over Unix milliseconds. Timezone / locale handling is
**not** here — it belongs to the `time/*` translation hooks (§16.2) which
consume these. Sakura reads `clock/now` to pace bridges, `clock/since` to
check session recency, `clock/duration` to log verb timings for the
pacing-budget tracker.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `clock/now` | `(clock/now) → <unix-ms>` | `curator-web/src/scheme/base.js:305` | **yes** (pure) |
| `clock/since` | `(clock/since ts) → <ms-elapsed>` | `curator-web/src/scheme/base.js:306` | **yes** (pure) |
| `clock/duration` | `(clock/duration start [end]) → <ms>` | `curator-web/src/scheme/base.js:307` | **yes** (pure) |

`clock/duration`'s second argument is optional and defaults to
`Date.now()`, so `(clock/duration t0)` measures elapsed-until-now.

**Honest gap — `clock/schedule`.** Earlier design notes (memory lock
2026-06-30) list a fourth primitive `clock/schedule` for future-firing
timers. **It is not implemented** — no `def('clock/schedule', …)` exists
in `base.js` as of this fold. Scheduling/quiet-hours firing is expected
to arrive with the automations-trigger backing, not as a Scheme
primitive. Cart authors must not `(act 'clock/schedule …)` today.

1. _(novice)_ stamp "when did this happen":
   ```scheme
   (let ((t (clock/now)))
     (text (string-append "logged at " (number->string t))))
   ```
   *;; generated*
2. _(intermediate)_ session-recency greeting gate:
   ```scheme
   (if (> (clock/since last-seen-ts) (* 1000 60 60 24))
       (say "welcome back — it's been a while")
       (say "hey, still here"))
   ```
   *;; generated*
3. _(expert)_ pacing budget — log a verb's cost in ms:
   ```scheme
   (let ((t0 (clock/now)))
     (act 'sakura/relay (list tool args)
          (lambda (r)
            (cortex/note 'pacing (clock/duration t0))
            r)))
   ```
   *;; generated*

### 16.2 Intelligence hooks — the translation layer (locked 2026-06-30)

Eleven pure "spoken-form" translations sit between DATA ACCESS
(`cortex/recall`, `loam/recall`) and SPEECH (persona templates). They are
deterministic, do no I/O, and are covered by `cartMacros.test.js`. The
model learns *the pattern of speaking about a value*; the value arrives
from the database at runtime.

| Verb | Signature → sample output | Backing | Wired |
|---|---|---|---|
| `time/relative` | `(time/relative ts) → "5 minutes ago" / "in about an hour"` | `curator-web/src/scheme/base.js:315` | **yes** (pure) |
| `time/duration` | `(time/duration ms) → "about 3 seconds" / "2 minutes"` | `curator-web/src/scheme/base.js:334` | **yes** (pure) |
| `time/since` | `(time/since ts) → "3 weeks ago"` | `curator-web/src/scheme/base.js:345` | **yes** (pure) |
| `money/friendly` | `(money/friendly 2799) → "$27.99"` | `curator-web/src/scheme/base.js:362` | **yes** (pure) |
| `money/delta` | `(money/delta 2000 2800) → "up $8.00 (about 40% higher)"` | `curator-web/src/scheme/base.js:369` | **yes** (pure) |
| `quantity/context` | `(quantity/context 47 20) → "47 (up from your usual 20)"` | `curator-web/src/scheme/base.js:383` | **yes** (pure) |
| `list/friendly` | `(list/friendly '(a b c)) → "a, b, and c"` | `curator-web/src/scheme/base.js:395` | **yes** (pure) |
| `location/place-name` | `(location/place-name geo) → place string` | `curator-web/src/scheme/base.js:720` | **no (honest escalator)** |
| `image/describe` | `(image/describe url) → caption` | `curator-web/src/scheme/base.js:722` | **no (honest escalator)** |

`money/friendly` and `quantity/context` truncate to integer input
(`Number(x) | 0`) — cents and counts, never floats. `list/friendly`
applies the Oxford comma and collapses 4+ items to
`"a, b, c, and N others"`. `location/place-name` and `image/describe` are
declared but return `{ kind: 'escalate', reason: 'service-not-yet-wired' }`
— they need a geocoder and a vision wire-call respectively, both deferred.

1. _(novice)_ price a listing for the operator's ear:
   ```scheme
   (say (string-append "this one's " (money/friendly price-cents)))
   ```
   *;; generated*
2. _(intermediate)_ contextualize today's order count:
   ```scheme
   (say (string-append "you've got "
                       (quantity/context today-orders usual-orders)
                       " orders"))
   ```
   *;; generated*
3. _(expert)_ compose recency + friendly list in one persona line:
   ```scheme
   (say (string-append "last synced " (time/since last-sync)
                       " — new tags: " (list/friendly new-tags)))
   ```
   *;; generated*

### 16.3 `world/knowledge` — research-and-learn catch-all (locked 2026-06-30)

The catch-all Sakura fires when the operator asks something she doesn't
already know ("Knicks won. Who are the Knicks? Where is Albania?").
Purpose: keep world facts **out of the weights**. The pattern:

1. check the operator's Cortex `world-knowledge` slot (learned facts);
2. on miss, ask the L1 workhorse (has world-knowledge in weights);
3. if time-sensitive or low-confidence, escalate to web search + the L2
   reasoner;
4. **write the answer back to Cortex** so the next recall is
   close-to-paren (no re-fetch);
5. return `{answer, confidence, source, cached, written_to_cortex}`.

```verb-card world/knowledge
```

**Wired: partial (split L0 / L1).** The Scheme-layer primitive is a
deliberate escalator —
`def('world/knowledge', …)` returns
`{ kind: 'escalate', reason: 'service-not-yet-wired', verb: 'world/knowledge' }`
at `curator-web/src/scheme/base.js:425`. The **real resolver is shipped
on the backend**: `POST /api/verbs/world/knowledge` at
`curator-api/curator_api/verbs/world_knowledge.py:117`, with the
Cortex-first → `model_workhorse` → `web_search + model_reasoner`
escalation ladder (module docstring lines 11–15) and the Cortex
write-back. The remaining seam is the JS-side binding that routes the
escalation to that route through the dispatch layer; until it lands,
Sakura speaks `'service-not-yet-wired` in her own voice per persona
failover rules rather than confabulating a fact. See
[`LACUNA-INTEGRATION-1.0-ENGINEERING.md`](LACUNA-INTEGRATION-1.0-ENGINEERING.md)
for the wire-call and the web-search supplement.

1. _(novice)_ answer a trivia question she may not hold:
   ```scheme
   (act 'world/knowledge (list :query "who are the Knicks")
        (lambda (r) (say (get r 'answer))))
   ```
   *;; generated*
2. _(intermediate)_ prefer the learned Cortex fact, fall back to research:
   ```scheme
   (say (or (cortex/recall :topic "Albania")
            (act 'world/knowledge (list :query "where is Albania") 'on-result)))
   ```
   *;; generated*
3. _(expert)_ time-sensitive query, force the web supplement:
   ```scheme
   (act 'world/knowledge (list :query "current NYC weather" :time-sensitive #t)
        (lambda (r)
          (if (< (get r 'confidence) 0.6)
              (say "let me not guess on that one")
              (say (get r 'answer)))))
   ```
   *;; generated*

### 16.4 `system/registry` + `cortex/associate` — extensibility without retraining (locked 2026-06-30)

`system/registry` is how Sakura learns *what exists* (games, cards,
automations, verbs, studios, features) without a weight update: she
queries the registry by domain instead of having the catalog baked in.
`cortex/associate` surfaces cross-topic associations from the Cortex
graph.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `system/registry` | `(system/registry :domain X)` | `curator-web/src/scheme/base.js:712` | **no (honest escalator)** |
| `cortex/associate` | `(cortex/associate topics)` | `curator-web/src/scheme/base.js:714` | **no (honest escalator)** |

Both are declared runtime primitives that return the honest
`'service-not-yet-wired` escalation today; the registry index and the
Cortex association projection are the deferred backings. The design
contract (weights teach HOW, registry + Cortex teach WHAT) is documented
in [`ENGINEERING.md`](ENGINEERING.md)
§16.

### 16.5 `knowledge/of` — category knowledge broker (locked 2026-07-01)

`(knowledge/of :category X)` is the query-on-demand middle tier of the
three-layer knowability model (ambient state · query-on-demand · deep
retrieval). The category manifest — sprite-state, card-position,
flower-mood, operator-mood, world-knowledge, active-carts, Loam-planes,
marketplaces, session, and dozens more — is meant to let new categories
land and be used the same second, with no retrain.

**Wired: no — module present, not yet runtime-bound, and currently
non-loading.** There is no `def('knowledge/of', …)` in `base.js` or
`interp.js`; the verb is not a runtime primitive yet. The broker lives as
a standalone module pair:
`curator-web/src/scheme/knowledge/knowledgeBroker.js` (exports
`knowledgeOf`, `knowledgeBrief`, `buildAmbientContext`,
`registerKnowledgeHandler`, dispatching via `window.cartHost.dispatch`)
and `curator-web/src/scheme/knowledge/categoryManifest.js` (the category
table).

> **LIVING:BUG — `categoryManifest.js` is truncated.** The file ends
> mid-object at line 1215 (`slot: 'loam/email-segments',` with no closing
> brace, no array terminator, and **no `export` statement**), so
> `knowledgeBroker.js:11`'s `import { categoryManifest }` resolves to
> `undefined`. The broker cannot enumerate categories until the manifest
> is completed and exported. This is flagged, not silently fixed — lane
> #311 (RUNTIME-VERBS-SHIP) may be mid-authoring this file; the fix
> (complete the final entry, close the array, `export const
> categoryManifest = […]`, then bind the Scheme `knowledge/of` primitive)
> belongs to that lane. Do **not** document `knowledge/of` as usable
> until the import loads and the primitive is registered.

---

## Honest gaps — manifest entries that don't (yet) match a backing

Some verbs are catalogued in the verb-manifest (and surfaced via
`<verb-card>`) but have no end-to-end backing route. They appear here
as the canonical honest-null list so cart authors don't try to wire
against ghost routes.

### `loam/query` — Deep Magic gateway (cost-band registered, route deferred)

```verb-card loam/query
```

The verb appears in the cost table at `curator-web/src/scheme/verbCosts.js:48`
(the "not `loam/operator-state`" branch routes to the 1,500-token band
documented in [HelloSurface §136](/docs/hello-surface/136-loam.html)).
**It is not present in `curator-web/src/scheme/runtime/verbBackings.js`**
— the server-side `LoamRouter.answer(query, ...)` path at
`curator-api/curator_api/loam/router.py:74-116` is implemented end-to-end,
but the JS-side binding to a backing route plus the cart-side `(act 'loam/query ...)`
calls are deferred. Cart authors get a structured `'service-not-yet-wired`
escalation, never a fluent-wrong success.

---

## 17. 2026-07-03 roll-up · duplex-session verbs (PUPPET-MASTER SUITE)

> **Fold date 2026-07-03.** The PUPPET-MASTER SUITE gives Sakura a duplex
> session over the live desk: a COMMAND channel (she acts), an EVENT
> channel (the surface tells her what happened), and a STATE channel (she
> reads the tableau). These verbs are the STATE + introspection + card-
> transition + inter-card surface of that suite. Every verb is cited
> against its installer at current head and carries an honest wired state.
> Namespaces `surface`, `system`, `card` are whitelisted in
> `curator-web/src/scheme/registry/VerbRegistry.js`. Reachability is proven
> by `curator-web/src/scheme/registry/maxHands.contract.test.js` (every row
> below resolves in `warmedRegistrySnapshot()` — no phantom hands).
>
> **Visual-golden caveat.** `card/physics!` / `card/transition` paint;
> unit tests prove the descriptor + event, NOT the on-device look. The
> dematerialize teardown is **cosmetic until profiled** — the illusion
> plays honest theater but heap-free is unverified pending a profiler
> trace. Do not sell it as a garbage-collector.

### 17.1 `surface/*` — the STATE + DIGEST read channel

Pure reads (`perm read`, any tier). Honest-null: a dark subsystem returns
`null`/`[]` for its slice, never a fabricated number.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `surface/digest` | `(surface/digest) → <delta>` | `curator-web/src/scheme/surfaceStateVerbs.js:74` → `lib/sakuraDigest.js` | **yes** |
| `surface/describe` | `(surface/describe [:detail 'brief\|'full]) → <tableau>` | `curator-web/src/scheme/surfaceStateVerbs.js:87` → `lib/surfaceSnapshot.js` | **yes** |

`surface/digest` returns the coalesced, salience-ranked delta of surface
events since the LLM's last turn and advances a single-consumer read
cursor. `surface/describe :brief` returns camera + viewport + focused +
counts; `:full` adds the card / flower / clip / quarantine rosters.

1. _(novice)_ "what changed since I last looked":
   ```scheme
   (surface/digest)
   ```
   *;; generated*
2. _(intermediate)_ full tableau before planning a scatter:
   ```scheme
   (surface/describe :detail 'full)
   ```
   *;; generated*
3. _(expert)_ read the focused card, then re-aim the camera at it:
   ```scheme
   (let ((s (surface/describe :detail 'brief)))
     (when (assoc 'focused s)
       (camera-center-on 512 512)))
   ```
   *;; generated*

### 17.2 `system/*` — whole-system introspection

Pure reads (`perm read`). `system/surface` is an alias of
`surface/describe :full`.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `system/surface` | `(system/surface) → <full tableau>` | `curator-web/src/scheme/surfaceStateVerbs.js:109` | **yes** |
| `system/registry` | `(system/registry [:domain 'verbs\|'events]) → <catalog>` | `curator-web/src/scheme/systemIntrospectVerbs.js:44` | **yes** |
| `system/cards` | `(system/cards) → [<card>...]` | `curator-web/src/scheme/systemIntrospectVerbs.js:71` | **yes** (honest `[]` when façade dark) |
| `system/scheduler` | `(system/scheduler) → {work, speech, Q_depth}` | `curator-web/src/scheme/systemIntrospectVerbs.js:93` | **yes** |
| `system/health` | `(system/health) → {quarantined, fuel_exhausted, illusions}` | `curator-web/src/scheme/systemIntrospectVerbs.js:104` | **partial** (honest-null until a health tally is wired) |

1. _(novice)_ list the events she can react to:
   ```scheme
   (system/registry :domain 'events)
   ```
   *;; generated*
2. _(intermediate)_ self-awareness — how full is my own queue:
   ```scheme
   (system/scheduler)
   ```
   *;; generated*
3. _(expert)_ gate a heavy plan on health being clean:
   ```scheme
   (let ((h (system/health)))
     (if (assoc 'quarantined h) (surface/describe) (desk/clear)))
   ```
   *;; generated*

### 17.3 `card/physics!` + `card/transition` — named card transitions

State-changing (`perm state-change`). `card/physics!` sets a card's
active transition; `card/transition` performs open/close/move using it,
firing `card.opened`/`card.closed`/`card.settled` with `corr`. Reduced-
motion collapses the LOOK to `no-slide`; the dispatch is unchanged.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `card/physics!` | `(card/physics! #card/<id> 'slide\|'no-slide\|'dematerialize\|'waft\|'chubby-walk) → <name>` | `curator-web/src/scheme/cardTransitions.js:84` | **yes** (`dematerialize` teardown: cosmetic until profiled) |
| `card/transition` | `(card/transition #card/<id> 'open\|'close\|'move [x y]) → ['ok <name> {duration}]` | `curator-web/src/scheme/cardTransitions.js:100` | **yes** |

1. _(novice)_ give a card the dreamy waft physics:
   ```scheme
   (card/physics! #card/note/7 'waft)
   ```
   *;; generated*
2. _(intermediate)_ open a card with its active transition:
   ```scheme
   (card/transition #card/note/7 'open)
   ```
   *;; generated*
3. _(expert)_ dematerialize a stale card (honest teardown + rehydrate):
   ```scheme
   (begin (card/physics! #card/note/9 'dematerialize)
          (card/transition #card/note/9 'close))
   ```
   *;; generated*

### 17.4 `card/do` · `card/emit` · `card/ask` — inter-card messaging

State-changing. `card/do` invokes a registered verb on the addressed
card (honest `handled:false` if unregistered); `card/emit` fans an event
onto the surface thread bus as a `card.message`; `card/ask` returns a
non-deterministic AnswerHandle whose answer arrives asynchronously as a
`card.message{kind:'answer'}`. (Hyphen aliases `card-do`/`card-emit`/
`card-ask` remain per the 2026-06-14 dual-binding.)

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `card/do` | `(card/do #card/<id> '<verb> <args>...) → <EmitHandle>` | `curator-web/src/scheme/primitives/card.js:47` | **yes** |
| `card/emit` | `(card/emit #card/<id> '<event> [payload]) → <EmitHandle>` | `curator-web/src/scheme/primitives/card.js:77` | **yes** |
| `card/ask` | `(card/ask #card/<id> <question>) → <AnswerHandle>` | `curator-web/src/scheme/primitives/card.js:108` | **partial** (answer bus wired; live cross-card answer routing per surface) |

1. _(novice)_ tell a card to highlight itself:
   ```scheme
   (card/do #card/note/42 'highlight)
   ```
   *;; generated*
2. _(intermediate)_ broadcast that a card is ready:
   ```scheme
   (card/emit #card/note/7 'ready)
   ```
   *;; generated*
3. _(expert)_ ask a neighbour a question (answer arrives on the bus):
   ```scheme
   (card/ask #card/note/3 "what colour are you?")
   ```
   *;; generated*

### 17.5 `card/hide` · `card/show` · `card/hide-all` · `card/show-all` · `desk/reboot` — card presence

State-changing, `perm:'animate'`. The architect's "make her hide cards,
bring cards back — reboot the desktop, give her full control" (2026-07-03).
Each verb fires a single window CustomEvent that the canvas host honours;
the host suppresses render for hidden ids (`hiddenCards.has(o.id) → null` in
the `order.map`, mirroring the `detachedCards` guard) and un-hides on show /
reboot. Hiding is **session-scoped** — a reload restores every card, so a
hide can never permanently lose a card. A card ref is a card **id** OR a card
**kind** (the handle Sakura speaks, e.g. "hide the chat card" → `chat`); the
host resolves against both. Registered by `installDeskDirectVerbs`
(`curator-web/src/scheme/deskDirectVerbs.js`), installed at
`curator-web/src/scheme/index.js:637`. Honest-null: `card/hide`/`card/show`
error `bad-arg` when no card is named — never a silent no-op — and every
envelope reports the real `fired` count/flag (0/false if no host received it).

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `card/hide` | `(card/hide <ref>...) → ['ok','hidden',{cards,fired}]` | `deskDirectVerbs.js:375` → host `curator:card-hide` (`HelloSurface.jsx`) | **yes** |
| `card/show` | `(card/show <ref>...) → ['ok','shown',{cards,fired}]` | `deskDirectVerbs.js:389` → host `curator:card-show` | **yes** |
| `card/hide-all` | `(card/hide-all) → ['ok','hidden-all',{fired}]` | `deskDirectVerbs.js:403` → host `curator:card-hide-all` | **yes** |
| `card/show-all` | `(card/show-all) → ['ok','shown-all',{fired}]` | `deskDirectVerbs.js:409` → host `curator:card-show-all` | **yes** |
| `desk/reboot` | `(desk/reboot) → ['ok','rebooted',{fired}]` | `deskDirectVerbs.js:418` → host `curator:desk-reboot` (un-hide all + re-layout) | **yes** |

1. _(novice)_ pull one card off the desktop by kind:
   ```scheme
   (card/hide 'chat)
   ```
   *;; generated*
2. _(intermediate)_ clear the whole desktop, then bring it all back:
   ```scheme
   (card/hide-all)
   (card/show-all)
   ```
   *;; generated*
3. _(expert)_ hide two cards, then reboot the desktop to a fresh layout:
   ```scheme
   (begin
     (card/hide 'orders 'cortex)
     (desk/reboot))
   ```
   *;; generated*

> **Visual-golden gate (open).** The host render-suppression path
> (`hiddenCards` state + the `order.map` `return null` guard + the five
> `curator:card-*` listeners in `HelloSurface.jsx`) is proven by unit tests
> (`deskDirectVerbs.test.js`, 32 green) and dispatch-returns-ok, but
> **on-device visual verification that cards actually disappear and return on
> `mac-studio.local:3000` has not been completed** — it cannot be satisfied
> headlessly in auto-mode. Per CLAUDE.md's visual-golden gate, this stays
> flagged until eyeballed on the operator's device.

---

## 18. 2026-07-03 roll-up · Math Toolkit v2, Phase 1 (curriculum + vector calculus)

The first landed slice of the Math Toolkit (`docs/MATH-TOOLKIT-CANON-2026-07-03.md`)
— the smallest, highest-coverage delta on the numeric spine: the ~14
genuinely-new curriculum verbs (K-12 → Calc-III base completeness) plus the
Calculus-III vector-calculus gap. All are `perm:'read'`, pure, honest-null,
and fuel-charged. Registered by `installMathToolkitCurriculumVerbs` in
`curator-web/src/scheme/mathToolkitCurriculumVerbs.js`, wired via
`primitives/index.js` right after `installMathVerbs`. Discovery is by
`(system/registry :domain math)` — no retrain per verb. The interpreter is the
single source of truth: the weights teach *which verb to emit and how to
compose*, never the arithmetic itself.

Honest-null follows the canon's two shapes: value-domain failure → the symbol
`'nan`; structural / non-convergence → `(escalate 'reason detail)` over the
frozen reason set (`'type-error 'shape-error 'diverged 'non-convergence
'fuel-budget 'inexact-overflow`). Determinism tiers: the integer/rational
helpers are `[bitwise]`; the finite-difference / tensor-Simpson verbs are
`[deterministic-within-device]` (float transcendentals may ULP-drift across
device classes). The engine's registry records only `perm`, so every verb
passes `determinism:'deterministic'` at `env.define` and states its true tier
in its summary (canon Part II §II.1).

### 18.1 `math/*` `exact/*` `stat/*` `geom/*` `sym/*` — the elementary + algebra helpers

Elementary display/decomposition and the middle-school algebra rules the
interpreter must own (place value, rounding to a place magnitude, mixed
numbers, decimal→fraction, mode, 2-point slope, linear-inequality solving with
the flip-on-negative rule).

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `math/place-value` | `(math/place-value <int>) → (place-value (digits …)(places …)(n …))` | `mathToolkitCurriculumVerbs.js` `mathPlaceValue` | **yes** |
| `math/round-to-place` | `(math/round-to-place <n> <place>) → <number>` | `mathToolkitCurriculumVerbs.js` `mathRoundToPlace` | **yes** |
| `math/mixed-number` | `(math/mixed-number <num> <den>) → (mixed-number (whole …)(num …)(den …)(sign …))` | `mathToolkitCurriculumVerbs.js` `mathMixedNumber` | **yes** |
| `exact/float->rat` | `(exact/float->rat <x> [maxden]) → (rat (n …)(d …))` | `mathToolkitCurriculumVerbs.js` `exactFloatToRat` | **yes** |
| `stat/mode` | `(stat/mode <list>) → (mode (values …)(count …)(multimodal? …)(n …))` | `mathToolkitCurriculumVerbs.js` `statMode` | **yes** |
| `geom/slope` | `(geom/slope x1 y1 x2 y2) → <number> \| 'nan` | `mathToolkitCurriculumVerbs.js` `geomSlope` | **yes** |
| `sym/solve-ineq` | `(sym/solve-ineq a b '<\|'<=\|'>\|'>=) → (interval (lo …)(hi …)(lo-open? …)(hi-open? …)(op …)(bound …))` | `mathToolkitCurriculumVerbs.js` `symSolveIneq` | **yes** |

1. _(novice)_ decompose a number by place value:
   ```scheme
   (math/place-value 3204)
   ```
   *;; → (place-value (digits 3 2 0 4) (places 3000 200 0 4) (n 3204))*
2. _(intermediate)_ turn an improper fraction into a mixed number:
   ```scheme
   (math/mixed-number 7 3)
   ```
   *;; → (mixed-number (whole 2) (num 1) (den 3) (sign 1))*
3. _(expert)_ solve `-2x < 6` — the interpreter owns the sign-flip:
   ```scheme
   (sym/solve-ineq -2 6 '<)
   ```
   *;; → (interval (lo -3) (hi +inf) … (op >) (bound -3))  — i.e. x > -3*

### 18.2 `calc/*` `num/*` — series verdicts + Calculus-III vector calculus

Ratio-test verdicts for infinite series and power-series radius, plus the real
Calc-III gap: divergence, curl, deterministic double/triple integrals, and line
& surface integrals over curve/surface closures (a curve is `t→point`, a
surface is `(u,v)→point`, a field is `point→scalar|vector` — everything is a
plain JS closure the runtime finite-differences and Simpson-integrates). Every
integrator takes a conservative panel cap and escalates `'fuel-budget` over it.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `calc/series-converges?` | `(calc/series-converges? <fn n→term> [n0]) → (series-test (test 'ratio)(limit …)(verdict 'converges\|'diverges\|'inconclusive))` | `mathToolkitCurriculumVerbs.js` `calcSeriesConverges` | **yes** |
| `calc/radius-of-convergence` | `(calc/radius-of-convergence <fn n→coeff> [n0]) → (power-series-radius (radius …)(lo …)(hi …))` | `mathToolkitCurriculumVerbs.js` `calcRadiusOfConvergence` | **yes** |
| `calc/divergence` | `(calc/divergence <F point→vec> <point>) → <number>` | `mathToolkitCurriculumVerbs.js` `calcDivergence` | **yes** |
| `calc/curl` | `(calc/curl <F point→vec> <point>) → <number(2D)> \| <vec(3D)> \| 'escalate` | `mathToolkitCurriculumVerbs.js` `calcCurl` | **yes** |
| `num/nintegrate-2d` | `(num/nintegrate-2d <f x y> x0 x1 y0 y1 [n]) → <number>` | `mathToolkitCurriculumVerbs.js` `numNintegrate2d` | **yes** |
| `num/nintegrate-3d` | `(num/nintegrate-3d <f x y z> x0 x1 y0 y1 z0 z1 [n]) → <number>` | `mathToolkitCurriculumVerbs.js` `numNintegrate3d` | **yes** |
| `calc/line-integral` | `(calc/line-integral 'scalar\|'vector <field> <γ t→point> t0 t1 [n]) → <number>` | `mathToolkitCurriculumVerbs.js` `calcLineIntegral` | **yes** |
| `calc/surface-integral` | `(calc/surface-integral 'scalar\|'flux <field> <σ (u,v)→point> u0 u1 v0 v1 [n]) → <number>` | `mathToolkitCurriculumVerbs.js` `calcSurfaceIntegral` | **yes** |

1. _(novice)_ does the geometric series Σ(½)ⁿ converge?
   ```scheme
   (calc/series-converges? (lambda (n) (expt 0.5 n)))
   ```
   *;; → (series-test (test 'ratio) (limit 0.5) (verdict 'converges))*
2. _(intermediate)_ the divergence of the radial field F=(x,y,z) is 3:
   ```scheme
   (calc/divergence (lambda (x y z) (list x y z)) (list 1 2 3))
   ```
   *;; → 3.0*
3. _(expert)_ circulation of F=(−y,x) around the unit circle (Green's theorem → 2π):
   ```scheme
   (calc/line-integral 'vector
     (lambda (x y) (list (- y) x))
     (lambda (t) (list (cos t) (sin t)))
     0 (* 2 pi))
   ```
   *;; → 6.283…  (2π)*

### 18.3 `game/*` `juggle/*` — the FUN pack (combinatorial game theory + siteswap)

The joy pack (canon Part II §II.6), registered by
`installMathToolkitGameVerbs` in
`curator-web/src/scheme/mathToolkitGameVerbs.js`, wired via `primitives/index.js`
right after `installMathToolkitCurriculumVerbs`. Nim / Sprague–Grundy, Conway
surreal numbers, minimax→tic-tac-toe, and siteswap juggling. Every verb is
`perm:'read'`, pure, and fully `[bitwise]`-deterministic — no `g.rng()` draw at
all: `game/grundy` is a memoized `mex` recursion; `game/ttt-value` is exhaustive
minimax over the finite 9-cell tree; `juggle/valid?` is a `map` + a
distinctness (permutation) check. Honest-null: value-domain → `'nan`;
structural / deep-search / cap → `(escalate 'reason detail)` over
`'type-error 'fuel-budget 'not-a-number 'not-valid-siteswap 'use-backend`.
`game/temperature` (thermography) is a deep search → BACKED (`'use-backend`).

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `game/mex` | `(game/mex <set>) → <int>` | `mathToolkitGameVerbs.js` `gameMex` | **yes** |
| `game/nim-sum` | `(game/nim-sum <heaps>) → <int>` | `mathToolkitGameVerbs.js` `gameNimSum` | **yes** |
| `game/grundy` | `(game/grundy <moves-fn> <pos> [budget]) → <int> \| 'escalate` | `mathToolkitGameVerbs.js` `gameGrundy` | **yes** |
| `game/nim-outcome` | `(game/nim-outcome <heaps>) → 'first-player-win\|'second-player-win` | `mathToolkitGameVerbs.js` `gameNimOutcome` | **yes** |
| `game/surreal` | `(game/surreal <L> <R>) → {L\|R}` | `mathToolkitGameVerbs.js` `gameSurreal` | **yes** |
| `game/surreal-lit` | `(game/surreal-lit <dyadic>) → surreal \| 'nan` | `mathToolkitGameVerbs.js` `gameSurrealLit` | **yes** |
| `game/to-real` | `(game/to-real <surreal>) → <dyadic> \| 'escalate` | `mathToolkitGameVerbs.js` `gameToReal` | **yes** |
| `game/surreal-le?` | `(game/surreal-le? a b) → #t\|#f` | `mathToolkitGameVerbs.js` `gameSurrealLe` | **yes** |
| `game/surreal-eq?` | `(game/surreal-eq? a b) → #t\|#f` | `mathToolkitGameVerbs.js` `gameSurrealEq` | **yes** |
| `game/surreal-neg` | `(game/surreal-neg s) → surreal` | `mathToolkitGameVerbs.js` `gameSurrealNeg` | **yes** |
| `game/surreal-add` | `(game/surreal-add a b) → surreal` | `mathToolkitGameVerbs.js` `gameSurrealAdd` | **yes** |
| `game/surreal-sub` | `(game/surreal-sub a b) → surreal` | `mathToolkitGameVerbs.js` `gameSurrealSub` | **yes** |
| `game/surreal-mul` | `(game/surreal-mul a b) → surreal` | `mathToolkitGameVerbs.js` `gameSurrealMul` | **yes** |
| `game/surreal-birthday` | `(game/surreal-birthday s) → <int>` | `mathToolkitGameVerbs.js` `gameSurrealBirthday` | **yes** |
| `game/surreal-is-number?` | `(game/surreal-is-number? s) → #t\|#f` | `mathToolkitGameVerbs.js` `gameSurrealIsNumber` | **yes** |
| `game/surreal-simplest` | `(game/surreal-simplest lo hi) → surreal \| 'nan` | `mathToolkitGameVerbs.js` `gameSurrealSimplest` | **yes** |
| `game/star-n` | `(game/star-n n) → (nimber n) \| 'nan` | `mathToolkitGameVerbs.js` `gameStarN` | **yes** |
| `game/wythoff-p?` | `(game/wythoff-p? a b) → #t\|#f` | `mathToolkitGameVerbs.js` `gameWythoffP` | **yes** |
| `game/ttt-value` | `(game/ttt-value <board> [player]) → 'x-win\|'o-win\|'draw` | `mathToolkitGameVerbs.js` `gameTttValue` | **yes** |
| `game/ttt-best-move` | `(game/ttt-best-move <board> [player]) → <cell 0..8> \| 'nan` | `mathToolkitGameVerbs.js` `gameTttBestMove` | **yes** |
| `game/temperature` | `(game/temperature <game>) → (escalate 'use-backend)` | `mathToolkitGameVerbs.js` `gameTemperature` | no (BACKED) |
| `juggle/balls` | `(juggle/balls <pattern>) → <int> \| 'nan` | `mathToolkitGameVerbs.js` `juggleBalls` | **yes** |
| `juggle/valid?` | `(juggle/valid? <pattern>) → #t\|#f` | `mathToolkitGameVerbs.js` `juggleValid` | **yes** |
| `juggle/simulate` | `(juggle/simulate <pattern>) → (schedule …) \| 'escalate` | `mathToolkitGameVerbs.js` `juggleSimulate` | **yes** |
| `juggle/max-throw` | `(juggle/max-throw <pattern>) → <int> \| 'nan` | `mathToolkitGameVerbs.js` `juggleMaxThrow` | **yes** |
| `juggle/state` | `(juggle/state <pattern>) → (juggle-state (vector …)(max …))` | `mathToolkitGameVerbs.js` `juggleState` | **yes** |
| `juggle/generate` | `(juggle/generate <balls> <period> [maxH]) → (siteswaps (count …)(patterns …)) \| 'escalate` | `mathToolkitGameVerbs.js` `juggleGenerate` | **yes** |

1. _(novice)_ the nim-sum of heaps 3,4,5 — a real true thing:
   ```scheme
   (game/nim-sum '(3 4 5))
   ```
   *;; → 2  (nonzero ⇒ first player wins)*
2. _(intermediate)_ tic-tac-toe is a draw under perfect play:
   ```scheme
   (game/ttt-value (list 'null 'null 'null 'null 'null 'null 'null 'null 'null))
   ```
   *;; → 'draw*
3. _(expert)_ the siteswap "534" needs 4 balls (the Average Theorem) and is valid:
   ```scheme
   (list (juggle/balls "534") (juggle/valid? "534"))
   ```
   *;; → (4 #t)*

### 18.4 `alg/*` — abstract algebra (finite groups/rings/fields + music & animation bridges)

The finite-algebra wing (canon Part II §II.2), registered by
`installMathToolkitAlgVerbs` in `curator-web/src/scheme/mathToolkitAlgVerbs.js`,
wired via `primitives/index.js`. Abstract algebra is the shared skeleton under
three live subsystems: **music** (ℤ/12 *is* the twelve-tone system —
transposition Tₙ, inversion, and the D₁₂≅Neo-Riemannian-PLR group of order 24),
**animation** (2-D symmetry is the dihedral group Dₙ), **automation** (a pipeline
is a monoid; a cyclic scheduler is ℤ/nℤ; reachability is orbit computation). All
verbs are `perm:'read'`, pure, and `[bitwise]`-deterministic. Datatypes are
tag-first with zero new host objects (a permutation is an image-vector object; a
group carries its element keys + a `mul` closure; a pc-set is `(pcset (mod 12)
(pcs …))`). On-device caps: Sₙ materialization n≤7, generated-closure /
product / quotient order ≤4096 → `'fuel-budget`; `is-isomorphic?` invariant-pruned
then brute for |G|≤12, else `'use-backend`. Honest-null over the frozen alg
reasons `'not-a-group 'not-closed 'no-inverse 'not-a-field 'not-a-homomorphism
'not-invertible` (+ shared `'type-error 'shape-error 'fuel-budget 'use-backend`).

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `alg/perm` / `alg/perm-identity` | build a permutation / identity of degree n | `mathToolkitAlgVerbs.js` `algPerm`/`algPermIdentity` | **yes** |
| `alg/perm-compose` / `alg/perm-apply` / `alg/perm-inverse` | compose, apply π(i), invert | `algPermCompose`/`algPermApply`/`algPermInverse` | **yes** |
| `alg/perm->cycles` / `alg/cycles->perm` | cycle decomposition ↔ image vector | `algPermToCycles`/`algCyclesToPerm` | **yes** |
| `alg/perm-order` / `alg/perm-parity` / `alg/perm-sign` / `alg/perm-support` / `alg/perm-pow` / `alg/perm-conjugate` | order, parity, sign, support, k-th power, conjugate | `mathToolkitAlgVerbs.js` | **yes** |
| `alg/cyclic` / `alg/dihedral` / `alg/symmetric` | ℤ/nℤ, Dₙ, Sₙ (n≤7) | `algCyclic`/`algDihedral`/`algSymmetric` | **yes** |
| `alg/group-from-table` / `alg/is-group?` | build/validate a group from a Cayley table | `algGroupFromTable`/`algIsGroup` | **yes** |
| `alg/order` / `alg/op` / `alg/identity` / `alg/inverse` / `alg/element-order` | group core operations | `mathToolkitAlgVerbs.js` | **yes** |
| `alg/is-abelian?` / `alg/subgroup-gen` / `alg/subgroup?` / `alg/cosets` / `alg/index` / `alg/is-normal?` / `alg/center` / `alg/conjugacy-classes` / `alg/direct-product` / `alg/is-isomorphic?` | group structure | `mathToolkitAlgVerbs.js` | **yes** |
| `alg/orbit` / `alg/stabilizer` / `alg/is-homomorphism?` / `alg/kernel` / `alg/image` | actions & homomorphisms | `mathToolkitAlgVerbs.js` | **yes** |
| `alg/zn` / `alg/zn-add` / `alg/zn-mul` / `alg/zn-inverse` / `alg/zn-units` / `alg/is-field?` / `alg/poly-add` / `alg/poly-mul` | rings & fields ℤ/n | `mathToolkitAlgVerbs.js` | **yes** |
| `alg/pcset` / `alg/transpose` / `alg/invert` / `alg/normal-form` / `alg/prime-form` / `alg/interval-vector` / `alg/triad` / `alg/nr-P` / `alg/nr-L` / `alg/nr-R` | the music bridge on ℤ/12 | `mathToolkitAlgVerbs.js` | **yes** |
| `alg/symmetry-group` / `alg/rosette` / `alg/apply-symmetry` | the animation bridge (Dₙ) | `mathToolkitAlgVerbs.js` | **yes** |

1. _(novice)_ the cyclic group ℤ/6 is abelian:
   ```scheme
   (alg/is-abelian? (alg/cyclic 6))
   ```
   *;; → #t*
2. _(intermediate)_ ℤ/6 ≅ ℤ/2 × ℤ/3 (the Chinese Remainder Theorem, machine-checked):
   ```scheme
   (alg/is-isomorphic? (alg/cyclic 6)
     (alg/direct-product (alg/cyclic 2) (alg/cyclic 3)))
   ```
   *;; → #t*
3. _(expert)_ the Neo-Riemannian R transform sends C-major to A-minor:
   ```scheme
   (alg/nr-R (alg/triad 0 'major))
   ```
   *;; → (pcset (mod 12) (pcs 0 4 9))  — A-minor*

### 18.5 `curve/*` — differential geometry of curves & surfaces

Functional Differential Geometry transcribed (canon Part II §II.3), registered by
`installMathToolkitCurveVerbs` in `curator-web/src/scheme/mathToolkitCurveVerbs.js`.
**Everything is a closure**: a curve is `γ:t→[x,y,z]`, a parametric height field
is `h:(x,y)→z`, and every differential operator is a higher-order procedure over
those closures built on self-contained finite-difference + Simpson + RK4 kernels
(no dependency on the unbuilt Part-I spine). The skiing intuition: the mountain
is a height field, the fall line is `−∇h` normalized, curvature κ is a carved
turn, the Frenet frame is which way skis/hips/spine point, and the fastest line
down is the brachistochrone (a cycloid). All verbs are `perm:'read'`,
`[deterministic-within-device]`. Honest-null: value-domain → `'nan`; structural →
`(escalate 'reason detail)` with `'singular` at κ=0 / stationary / flat points
(do Carmo regularity), `'fuel-budget` over integrator (≤2048) / sample (≤512) /
RK4 (≤4096) caps; `curve/geodesic-distance` is BACKED → `(escalate 'fuel-budget
'use-backend)`.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `curve/eval` / `curve/velocity` / `curve/accel` / `curve/speed` | γ(t), γ'(t), γ''(t), \|γ'\| | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/unit-tangent` / `curve/normal` / `curve/binormal` / `curve/frenet-frame` | the Frenet frame (T,N,B,κ,τ) | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/arc-length` | ∫\|γ'\| dt (Simpson, ≤2048 evals) | `curveArcLength` | **yes** |
| `curve/curvature` / `curve/curvature-2d` / `curve/torsion` | κ (2-D/3-D), signed κ, torsion τ | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/osculating-circle` / `curve/sample` | osculating circle; n+1 path samples | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/surface-graph` / `curve/gradient` / `curve/fall-line` / `curve/slope-angle` / `curve/surface-normal` | the mountain: ∇h, fall line, slope, normal | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/first-form` / `curve/second-form` / `curve/gaussian-curvature` / `curve/mean-curvature` / `curve/principal-curvatures` | fundamental forms + curvatures (exact Monge) | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/fall-path` / `curve/christoffel` | RK4 steepest-descent path; Christoffel Γᵏᵢⱼ | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/geodesic-distance` | boundary-value geodesic distance | `curveGeodesicDistance` | no (BACKED) |
| `curve/bezier` / `curve/bezier-eval` / `curve/hermite` / `curve/catmull-rom` / `curve/spline-length` / `curve/spline-resample` | animation-path splines | `mathToolkitCurveVerbs.js` | **yes** |
| `curve/cycloid` / `curve/brachistochrone` / `curve/descent-time` / `curve/euler-lagrange-residual` | the calculus-of-variations showcase | `mathToolkitCurveVerbs.js` | **yes** |

1. _(novice)_ the curvature of the unit circle is 1:
   ```scheme
   (curve/curvature (lambda (t) (list (cos t) (sin t))) 1.0)
   ```
   *;; → 1.0*
2. _(intermediate)_ the fall line down a bowl x²+y² at (1,0) points inward:
   ```scheme
   (curve/fall-line (lambda (x y) (+ (* x x) (* y y))) 1 0)
   ```
   *;; → (-1 0)  — straight toward the minimum*
3. _(expert)_ the fastest slide from (0,0) to (2,1) is a cycloid, beating the chord:
   ```scheme
   (curve/descent-time 2 1)
   ```
   *;; → a time strictly less than the straight-chord descent time*

---

### 18.6 `topo/*` — computational topology & TDA (finite metric/graph, GF(2) homology, persistence)

The computable finite slice of topology (canon Part II §II.4), registered by
`installMathToolkitTopoVerbs` in `curator-web/src/scheme/mathToolkitTopoVerbs.js`.
Point-set topology only on **finite** metric spaces and **simple** graphs; the
payoff is **persistent homology** — turn a point cloud into a barcode; the coda
is small-knot invariants (PD codes) + planarity. The critical discipline is
**fuel BEFORE combinatorial blow-up**: simplicial constructions explode
(Vietoris–Rips is exponential), so every builder pre-counts an upper bound and
escalates `'too-many-simplices` / `'fuel-budget` BEFORE allocating (cap 20000
simplices; `n>64` at dim≥2 routes to backend). Homology is computed over GF(2)
with a self-contained Gaussian-elimination rank kernel; `topo/homology-gf2`
carries a **self-verification reflex**: it checks χ = Σ(−1)ᵏβₖ (Euler–Poincaré)
and reports the mismatch flag rather than trusting itself. Integer/combinatorial
verbs are `[bitwise]`; the metric/distance-driven verbs are
`[deterministic-within-device]`. Honest-null: value-domain → `'nan`; structural →
`(escalate 'reason detail)` over the frozen topo reasons `'too-many-simplices`
`'dimension-cap` `'not-a-metric` `'diagram-invalid` `'not-simple-graph`
(+ shared `'type-error` `'shape-error` `'fuel-budget` `'use-backend`).

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `topo/metric-space` / `topo/graph` / `topo/complex` / `topo/close` | datatypes: finite metric space (axiom-checked), simple graph, simplicial complex, downward closure | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/connected?` / `topo/components` / `topo/ball` | graph connectivity; components; closed metric ball | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/f-vector` / `topo/euler-char` | face-count vector (f₀,f₁,…); χ = Σ(−1)ᵏfₖ (V−E for a graph) | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/vietoris-rips` / `topo/boundary-matrix` | V-R complex at scale ε (fuel pre-checked); ∂ₖ over GF(2) | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/betti-k` / `topo/betti` / `topo/homology-gf2` | βₖ / the Betti vector over GF(2); homology summary + Euler–Poincaré self-check | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/rips-filtration` / `topo/persistence` / `topo/betti-curve` | V-R filtration; persistent βₐᵢₘ barcode; β-vs-scale curve | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/total-persistence` / `topo/persistence-entropy` / `topo/bottleneck` | TDA vitality Σ(death−birth); bar-length Shannon entropy; bottleneck distance | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/orientable?` / `topo/planar?` / `topo/euler-genus` | Möbius-flag orientability; Euler-bound + K5-filter planarity; genus | `mathToolkitTopoVerbs.js` | **yes** |
| `topo/knot` / `topo/crossing-number` / `topo/unknot?` / `topo/writhe` | PD-code knot (validated → `'diagram-invalid`); crossing count; unknot test; writhe | `mathToolkitTopoVerbs.js` | **yes** |

1. _(novice)_ a path graph on three vertices is connected:
   ```scheme
   (topo/connected? (topo/graph 3 (list (list 0 1) (list 1 2))))
   ```
   *;; → #t*
2. _(intermediate)_ the hollow triangle is a circle — Betti (1,1) over GF(2):
   ```scheme
   (topo/betti (topo/complex (list '(0) '(1) '(2) '(0 1) '(1 2) '(0 2))))
   ```
   *;; → (1 1)  — one component, one loop*
3. _(expert)_ four points on a square loop recover a 1-cycle from the point cloud (persistent homology):
   ```scheme
   (topo/persistence
     (topo/metric-space '((0 0) (2 0) (2 2) (0 2)))
     '(0.5 2.1 3) 1)
   ```
   *;; → (barcode (dim 1) (intervals ((2.1 3 1))))  — a loop born at ε=2.1*

---

### 18.7 `ops/*` — operations research (inventory · queueing · LP · Markov · scheduling · flow)

The optimization / scheduling / queueing / inventory mathematics that serves
commerce automation (canon Part II §II.5), registered by
`installMathToolkitOpsVerbs` in `curator-web/src/scheme/mathToolkitOpsVerbs.js`.
EOQ / reorder-point / newsvendor / rate-shop are "OUR OWN INTELLIGENCE" — the
math that decides how much to order, when to reorder, and how to route work.
Every artifact — an LP problem, a solution, a Markov chain, a schedule — is a
tag-first a-list. **THE CRITICAL HONESTY LAW: an LP that is infeasible or
unbounded MUST escalate (`'infeasible` / `'unbounded`), never a fabricated
optimum**; likewise an overloaded queue (ρ≥1) has no steady state and escalates
`'infeasible` rather than returning a fictional wait time. Every iterative solve
(simplex, power iteration, Ford–Fulkerson, Bellman–Ford) charges fuel before its
loop, takes a `[maxit]` cap, and escalates `'fuel-budget` on exhaustion — never a
partial iterate presented as optimal. Self-contained: its own Gaussian-elimination
solver + tableau simplex + Hungarian algorithm (no Part-I dependency). LP /
queueing / Markov / float verbs are `[deterministic-within-device]`; the integer/
combinatorial verbs (assign / johnson / spt / edd / knapsack) are `[bitwise]`.
Honest-null over the frozen ops reasons `'infeasible` `'unbounded`
`'no-integer-solution` (+ shared `'type-error` `'shape-error` `'fuel-budget`
`'use-backend` `'not-a-distribution`). Large-scale routes (`ops/interior-point`,
`ops/mip-solve`, `ops/branch-bound`) are BACKED → `(escalate 'fuel-budget 'use-backend)`.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `ops/newsvendor` / `ops/newsvendor-fractile` / `ops/eoq` / `ops/reorder-point` / `ops/safety-stock` / `ops/inventory-cost` | inventory: order Q*, critical ratio, EOQ, ROP, safety stock, total cost | `mathToolkitOpsVerbs.js` | **yes** |
| `ops/mm1` / `ops/mmc` / `ops/erlang-c` / `ops/erlang-b` / `ops/littles-law` / `ops/mmc-servers-for` | queueing: M/M/1, M/M/c, Erlang-C/B, Little's law, staffing | `mathToolkitOpsVerbs.js` | **yes** |
| `ops/lp` / `ops/simplex` / `ops/lp-solve` / `ops/lp-value` | linear programming: build, solve (tableau simplex), objective value | `mathToolkitOpsVerbs.js` | **yes** |
| `ops/markov` / `ops/markov-step` / `ops/stationary` / `ops/pagerank` / `ops/absorbing-steps` / `ops/absorbing-probs` | Markov chains + PageRank + absorption analysis | `mathToolkitOpsVerbs.js` | **yes** |
| `ops/assign` / `ops/assign-cost` / `ops/johnson` / `ops/spt` / `ops/edd` / `ops/sequence-metrics` | Hungarian assignment; flow-shop & single-machine scheduling | `mathToolkitOpsVerbs.js` | **yes** |
| `ops/dijkstra` / `ops/bellman-ford` / `ops/max-flow` | shortest path (nonneg / neg-cycle-aware) + max flow | `mathToolkitOpsVerbs.js` | **yes** |
| `ops/knapsack` | 0/1 knapsack DP (integer) | `mathToolkitOpsVerbs.js` | **yes** |
| `ops/interior-point` / `ops/mip-solve` / `ops/branch-bound` | large-scale LP / mixed-integer / branch-and-bound | `mathToolkitOpsVerbs.js` | no (BACKED) |

1. _(novice)_ the Economic Order Quantity for D=1000, K=$10, h=$2 is 100 units:
   ```scheme
   (ops/eoq 1000 10 2)
   ```
   *;; → 100.0*
2. _(intermediate)_ an M/M/1 queue with λ=1, μ=2 spends on average one unit in system:
   ```scheme
   (ops/mm1 1 2)
   ```
   *;; → (mm1 (rho 0.5) (L 1.0) (Lq 0.5) (W 1.0) (Wq 0.5))*
3. _(expert)_ maximize 3x+5y subject to x≤4, 2y≤12, 3x+2y≤18 → optimum 36 at (2,6):
   ```scheme
   (ops/lp-solve '(3 5) '((1 0) (0 2) (3 2)) '(4 12 18))
   ```
   *;; → (lp-solution (x (2 6)) (value 36) (sense max))*

---

### 18.8 `phys/*` · `chem/*` · `eng/*` — science & engineering

Three applied namespaces (canon Part II §II.7), registered by
`installMathToolkitPhysVerbs` in `curator-web/src/scheme/mathToolkitPhysVerbs.js`.
Almost every verb is a LIBRARY composition or a BACKED route; the two NATIVE
kernels are the **units-algebra core** (`phys/quantity` + `phys/q*` `phys/q/`
`phys/q+` track base-dimension exponents so `mass × acceleration` yields
kg·m·s⁻²) and the **integer null-space over the element matrix** (`chem/balance`,
the reaction balancer — an empty or non-integer null-space escalates
`'unbalanced-reaction`). Every artifact — `('quantity …)`, `('reaction …)`,
`('truss …)`, `('tf …)` — is a tag-first a-list; no class, ever. SICM Lagrangian
mechanics are transcribed directly (`phys/lagrangian-action` = ∫L dt,
`phys/lagrange-residual` = the Euler–Lagrange residual ∂₁L − D(∂₂L)); Lagrangians
are procedures. Control theory is honest about instability: a closed right-half-
plane pole returns the **informational** verdict `'unstable` (Routh–Hurwitz),
never a crash; a rank-deficient truss is `'underdetermined`, distinct from
`'singular`. CODATA-2018 constants + IUPAC-2021 atomic weights are `[bitwise]`
lookups (and units algebra is exact-`[bitwise]`); the float-heavy verbs (Lagrange
action/residual, RLC, uncertainty, stability) are `[deterministic-within-device]`.
Honest-null over the frozen reasons `'unbalanced-reaction` `'underdetermined`
`'unstable` (+ shared `'type-error` `'shape-error` `'fuel-budget` `'use-backend`).
`phys/nbody` and `eng/bode` are BACKED → `(escalate 'fuel-budget 'use-backend)`.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `phys/constant` | a CODATA-2018 constant (c, G, h, e, k_B, N_A, R, m_e, m_p, u, g_n, …) | `mathToolkitPhysVerbs.js` | **yes** |
| `phys/quantity` / `phys/q*` / `phys/q/` / `phys/q+` / `phys/dimension` / `phys/same-dimension?` / `phys/quantity->tag` | dimensioned-quantity algebra (dimensional analysis) | `mathToolkitPhysVerbs.js` | **yes** |
| `phys/kinematics` / `phys/kinetic-energy` / `phys/gravitational-force` | constant-a motion; ½mv²; Newtonian gravity | `mathToolkitPhysVerbs.js` | **yes** |
| `phys/lagrangian-action` / `phys/lagrange-residual` / `phys/L-free` / `phys/L-harmonic` | SICM: action ∫L dt; Euler–Lagrange residual; canonical Lagrangians | `mathToolkitPhysVerbs.js` | **yes** |
| `phys/rlc-damping` / `phys/uncertainty-mul` / `phys/uncertainty-add` | RLC damping regime; error propagation (quadrature) | `mathToolkitPhysVerbs.js` | **yes** |
| `phys/nbody` | N-body dynamics at scale | `mathToolkitPhysVerbs.js` | no (BACKED) |
| `chem/atomic-weight` / `chem/molar-mass` / `chem/formula-counts` / `chem/moles` | IUPAC-2021 weights; formula parsing (incl. `(…)ₙ`); stoichiometry | `mathToolkitPhysVerbs.js` | **yes** |
| `chem/balance` | balance a reaction via the integer null-space; empty/non-int → `'unbalanced-reaction` | `mathToolkitPhysVerbs.js` | **yes** |
| `eng/statics-solve` / `eng/beam-reactions` | static equilibrium (rank-deficient → `'underdetermined`); beam support reactions | `mathToolkitPhysVerbs.js` | **yes** |
| `eng/tf` / `eng/tf-stable?` / `eng/tf-dc-gain` | transfer functions; Routh–Hurwitz stability (RHP pole → `'unstable`); DC gain | `mathToolkitPhysVerbs.js` | **yes** |
| `eng/bode` | Bode magnitude/phase sweep | `mathToolkitPhysVerbs.js` | no (BACKED) |

1. _(novice)_ the speed of light is exact by definition:
   ```scheme
   (phys/constant 'c)
   ```
   *;; → 299792458*
2. _(intermediate)_ balancing the combustion of methane:
   ```scheme
   (chem/balance '("CH4" "O2") '("CO2" "H2O"))
   ```
   *;; → (reaction (reactant-coeffs (1 2)) (product-coeffs (1 2)))*
3. _(expert)_ a transfer function with a right-half-plane pole is honestly unstable:
   ```scheme
   (eng/tf-stable? (eng/tf '(1) '(1 -1)))
   ```
   *;; → (escalate 'unstable "a coefficient sign change / zero ⇒ RHP pole")*

---

### 18.9 `plot/*` — the coordinate plane IS the world grid

The 20th namespace (canon Part II §II.8), registered by
`installMathToolkitPlotVerbs` in `curator-web/src/scheme/mathToolkitPlotVerbs.js`.
**The one idea:** the dot-matrix world (8px pitch on the 4096×4096 world) is a
coordinate plane already drawn — `plot/` fades most of those dots to a whisper,
picks one grid cell as the origin, maps each data unit onto a whole number of 8px
cells so **axis ticks land exactly on grid dots**, and draws SVG on top. A plot is
**not** a fifth host box — it is a homoiconic, replay-safe tag-first a-list
`('plot (kind …)(series …)(domain …)(grid-map …)(axes …)(fade …)(title …)
(empty? …)(reason …))`. **The hard rules bite here.** *Determinism:* every
coordinate is `toFixed(3)` in a fixed field order, so the spec — and the SVG
string built from it — is byte-identical for identical input (the golden test
asserts `svg1 === svg2`). *Honest-null:* an empty series → an empty-plot a-list
`(empty? #t)(reason 'no-data)` the renderer paints as a labelled "no data" panel
over the faded grid, **never a blank SVG**; all-non-finite samples →
`(escalate 'diverged …)`; **a non-finite sample breaks the polyline** (a `'break`
marker → SVG `M`/`L` restart) rather than bridging a discontinuity with a lie —
the `1/x` plot shows two branches and carries `(warnings (dropped K))`.
*No innerHTML:* the render seam is a UI card kind (`'plot-goodie`), **not** a verb;
`plot/render-svg` here is a **pure, context-free string builder** whose every node
comes from a `createElementNS`-equivalent `el()` helper (attribute-escaped,
`setAttribute`-only, labels are inert escaped text — a hostile
`"</svg><script>…"` title is `&lt;script&gt;`, never live markup). *Fuel caps:*
line/scatter/bar ≤4096 points; function/parametric ≤1024 samples (256 default);
contour grid R≤128; vector-field R≤32; phase-portrait ≤32 seeds. All
`[deterministic-within-device]`.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `plot/line` / `plot/scatter` / `plot/bar` | line, scatter, and categorical bar charts | `mathToolkitPlotVerbs.js` | **yes** |
| `plot/histogram` | Freedman–Diaconis bins (Sturges fallback) | `mathToolkitPlotVerbs.js` | **yes** |
| `plot/function` / `plot/parametric` | sample a closure f:x→y / γ:t→[x,y] (breaks on singularities) | `mathToolkitPlotVerbs.js` | **yes** |
| `plot/contour` / `plot/vector-field` / `plot/phase-portrait` | marching-squares isolines; a quiver; RK4 streamlines | `mathToolkitPlotVerbs.js` | **yes** |
| `plot/nice-domain` / `plot/fit-grid` | round to clean ticks; the affine data→8px-grid map | `mathToolkitPlotVerbs.js` | **yes** |
| `plot/with` / `plot/from-series` | overlay several plots; assemble from pre-built series | `mathToolkitPlotVerbs.js` | **yes** |
| `plot/render-svg` | the pure, deterministic SVG string builder (no innerHTML) | `mathToolkitPlotVerbs.js` | **yes** |

1. _(novice)_ a line chart is data, not a DOM node:
   ```scheme
   (plot/line '((0 0) (1 1) (2 4)))
   ```
   *;; → (plot (kind line) (series …) (domain …) (grid-map …) … (empty? #f))*
2. _(intermediate)_ an empty series is honest, never a blank canvas:
   ```scheme
   (plot/line '())
   ```
   *;; → (plot (kind line) (series ()) … (empty? #t) (reason 'no-data))*
3. _(expert)_ the `1/x` plot shows two branches — the singularity breaks the polyline, it does not lie-bridge:
   ```scheme
   (plot/function (lambda (x) (/ 1 x)) -2 2 4)
   ```
   *;; → a plot whose points carry a 'break at x=0 + (warnings (dropped 1))*

---

## 19. 2026-07-03 roll-up · Marionette engine (world · entity · input · scene · game)

> **Fold date 2026-07-03.** Marionette is the deterministic game/animation
> substrate the 4B drives: a stateful WORLD of entities that integrate under
> velocity/accel/gravity, a render-only CAMERA that follows them, an INPUT
> fold, and a `big-bang` loop with prefab/scene composition. It installs ONLY
> through `runWithCards` (`curator-web/src/scheme/index.js:546`) — `runSurface`
> does NOT carry it. World engine verbs: `installMarionetteWorld(env)`
> (`curator-web/src/scheme/marionetteWorld.js:903`). Loop + scene verbs:
> `installMarionetteScene(env, fuel)`
> (`curator-web/src/scheme/marionetteScene.js:354`).
>
> **State persistence.** `_entities` / `_nextId` / `_worldFrame` / `_camera`
> are module-level and PERSIST across successive `runWithCards` calls; only
> `(world/reset!)` clears them (it fans out to every sibling teardown via the
> reset-hook registry). This is what lets a per-frame Scheme program advance
> one continuous simulation — the pattern the nine-sheet animation harness
> (`tools/render_nine_sheet.mjs`) uses to film a moving flower at 9 speeds.
>
> **world→screen transform.** `cell = round(worldPt − cameraCentre +
> halfViewport)`. Fixed-world landmarks scroll as the camera tracks a moving
> entity — that scroll IS the visible camera work.
>
> **`on-key` wiring (fixed 2026-07-03).** `installMarionetteScene`'s default
> input reader is `() => false`; the live wiring swaps it to
> `marionetteWorld`'s `inputDown` via `_sceneInternals.setInputReader`
> (`marionetteScene.js:406`), called at `index.js:752`. That call referenced
> `inputDown`, which was imported at `index.js:132` — **the import was
> missing before 2026-07-03**, so every `runWithCards` threw a ReferenceError
> and every game's `on-key` silently fell back to the no-op reader. Now
> imported; `input/down?` inside a `big-bang` reads real held buttons.

### 19.1 `world/*` — the stateful world + camera

State-changing verbs carry `perm state-change`; reads carry `perm read`.
Camera verbs are render-only and are NOT folded into `world/hash`.

| Verb | Signature | Backing |
|---|---|---|
| `world/spawn` | `(world/spawn kind x y [w] [h]) → id` | `marionetteWorld.js:909` |
| `world/step` | `(world/step) → frame` (integrate → tween → collide → flush) | `marionetteWorld.js:910` |
| `world/each` | `(world/each fn) → count` (each alive id in bornSeq order) | `marionetteWorld.js:911` |
| `world/find` | `(world/find [kind]) → [id…]` | `marionetteWorld.js:912` |
| `world/nearest` | `(world/nearest id [kind]) → id\|'nan` | `marionetteWorld.js:913` |
| `world/count` | `(world/count [kind]) → n` | `marionetteWorld.js:914` |
| `world/gravity!` | `(world/gravity! gx gy)` | `marionetteWorld.js:915` |
| `world/frame` | `(world/frame) → n` | `marionetteWorld.js:916` |
| `world/after` | `(world/after n kind key)` (frame-counted timer → bus) | `marionetteWorld.js:917` |
| `world/reset!` | `(world/reset!)` (clears the whole stack) | `marionetteWorld.js:918` |
| `world/collisions` | `(world/collisions) → [[a b]…]` (last step) | `marionetteWorld.js:919` |
| `world/snapshot` | `(world/snapshot) → <opaque>` | `marionetteWorld.js:920` |
| `world/restore!` | `(world/restore! snap)` | `marionetteWorld.js:921` |
| `world/hash` | `(world/hash) → <u32>` (replay assertion digest) | `marionetteWorld.js:922` |
| `world/camera-follow!` | `(world/camera-follow! id [lerp] [dzw] [dzh])` | `marionetteWorld.js:968` |
| `world/camera-bounds!` | `(world/camera-bounds! x y w h)` | `marionetteWorld.js:969` |
| `world/camera-shake!` | `(world/camera-shake! amp [decay])` | `marionetteWorld.js:970` |
| `world/camera-snap!` | `(world/camera-snap! x y)` | `marionetteWorld.js:971` |
| `world/camera` | `(world/camera) → [x y]` (resolved centre, shake included) | `marionetteWorld.js:972` |

1. _(novice)_ spawn a flower and read the frame counter:
   ```scheme
   (begin (world/reset!) (world/spawn 'flower 18 20) (world/frame))
   ```
   *;; generated*
2. _(intermediate)_ give it velocity and have the camera chase it:
   ```scheme
   (let ((f (world/spawn 'flower 18 20)))
     (entity/set-vel! f 0.6 0)
     (world/camera-follow! f 0.18 6 30)
     (world/step))
   ```
   *;; generated*
3. _(expert)_ advance the SAME sim N times, then read the camera centre (the
   nine-sheet's per-speed loop):
   ```scheme
   (let loop ((n 3))
     (when (> n 0) (world/step) (loop (- n 1))))
   ```
   *;; generated*

### 19.1a `world/tape-*` — the motion tape (replay + record)

The tape is a lightweight, deterministic record of what the world looked like on
every frame, so a run can be **replayed** (re-rendered) later without re-simulating
and without capturing pixels. It stores per-frame POSITIONS — the sim camera, each
entity's `x/y/sprite/state`, AND the operator's **local viewport camera** `[x y k]`
(pan + zoom) — which are vectors, not pixels. Captured by wrapping only `world/step`
(one frame per advance) and `world/reset!` (a reset ends the take). Because the
interpreter is deterministic, replay = re-running the same frames; recording is a
choice of *when*, not a burden at record time — so the same tape serves both a
frame-tape re-render and a direct record. The mechanism is Scheme-general: any
Scheme run (card motion, a shop cart, a fake-shop sim) records/replays the same way.

| Verb | Signature | Backing |
|---|---|---|
| `world/tape-record!` | `(world/tape-record! [cap]) → true` (arm; opt `cap` = rolling-window size; captures the current frame) | `marionetteTape.js` |
| `world/tape-stop!` | `(world/tape-stop!) → frame-count` (stop; keep the tape) | `marionetteTape.js` |
| `world/tape-recording?` | `(world/tape-recording?) → #t/#f` | `marionetteTape.js` |
| `world/tape-frames` | `(world/tape-frames) → n` (frames held) | `marionetteTape.js` |
| `world/tape-hash` | `(world/tape-hash) → <u32>` (whole-tape replay assertion; empty → FNV basis, never a throw) | `marionetteTape.js` |
| `world/tape-lcamera` | `(world/tape-lcamera) → [x y k] \| 'none` (operator viewport camera on the latest frame) | `marionetteTape.js` |
| `world/tape-clear!` | `(world/tape-clear!) → true` (discard + disarm) | `marionetteTape.js` |
| `world/tape-save` | `(world/tape-save) → ((f cx cy hash (ents…) lcam)…)` (portable, re-renderable form; empty → `'()`) | `marionetteTape.js` |
| `world/tape-replay` | `(world/tape-replay [surface]) → 'ok \| 'empty-tape \| 'service-not-yet-wired` (live show-again; honest-null when no surface) | `marionetteTape.js` |

1. _(novice)_ arm the tape, step three times, read how many frames it holds:
   ```scheme
   (begin (world/tape-record!) (world/step) (world/step) (world/step) (world/tape-frames))
   ```
   *;; generated*
2. _(intermediate)_ record a small walk, then read the operator's viewport camera
   that was captured with it (so replay can return to that view):
   ```scheme
   (let ((w (world/spawn 'card 6 12)))
     (entity/set-vel! w 1 0)
     (world/tape-record!)
     (world/step) (world/step)
     (list (world/tape-frames) (world/tape-lcamera)))
   ```
   *;; generated*
3. _(expert)_ a rolling 30-frame window for "can I see that again?" — the world
   passively holds the last 30 frames; save them out only when someone asks to keep it:
   ```scheme
   (begin
     (world/tape-record! 30)
     (let loop ((n 200)) (when (> n 0) (world/step) (loop (- n 1))))
     (world/tape-save))
   ```
   *;; generated*

### 19.2 `entity/*` — per-entity state + motion

Reads carry `perm read`; mutators carry `perm state-change`. Unknown id →
`'entity-not-found` (reads) or a no-op (mutators). Full roster in
`marionetteWorld.js:925-957`; the motion-relevant subset:

| Verb | Signature | Backing |
|---|---|---|
| `entity/pos` / `entity/vel` | `(entity/pos id) → [x y]` · `(entity/vel id) → [vx vy]` | `marionetteWorld.js:929,930` |
| `entity/set-pos!` | `(entity/set-pos! id x y)` (teleport) | `marionetteWorld.js:936` |
| `entity/set-vel!` | `(entity/set-vel! id vx vy)` | `marionetteWorld.js:937` |
| `entity/move!` | `(entity/move! id dx dy)` | `marionetteWorld.js:938` |
| `entity/max-speed!` / `entity/friction!` | speed clamp · per-frame decay | `marionetteWorld.js:939,940` |
| `entity/accel!` | `(entity/accel! id ax ay)` (additive, cleared each step) | `marionetteWorld.js:951` |
| `entity/glide!` | `(entity/glide! id x y frames [ease])` → `'tween/done` | `marionetteWorld.js:949` |
| `entity/goto!` | `(entity/goto! id state)` → `'entity/state-change` | `marionetteWorld.js:950` |
| `entity/layer!` / `entity/mask!` | collision bits "what I am" / "what I scan" | `marionetteWorld.js:952,953` |
| `entity/solid!` / `entity/sensor!` | bounce-on-collide · report-only zone | `marionetteWorld.js:944,943` |
| `entity/damage!` | `(entity/damage! id n)` → `'entity/died` + despawn at ≤0 | `marionetteWorld.js:948` |
| `entity/despawn!` | `(entity/despawn! id)` (deferred if mid-step) | `marionetteWorld.js:957` |

1. _(novice)_ read where an entity is:
   ```scheme
   (entity/pos f)
   ```
   *;; generated*
2. _(intermediate)_ set a hop by teleporting each frame (the flower bob):
   ```scheme
   (entity/set-pos! f 18 (- 20 hop))
   ```
   *;; generated*
3. _(expert)_ glide to a target with an ease, then wait on the tween event:
   ```scheme
   (begin (entity/glide! f 64 20 30 'ease-in-out)
          (on 'tween/done (lambda (e) (entity/goto! f 'idle))))
   ```
   *;; generated*

### 19.3 `input/*` — the button fold

Reads carry `perm read`; `input/set!` is the host hook (`perm state-change`).
The six buttons are `up down left right a b`. Inside a `big-bang`, the reader
is wired to real held state (see the `on-key` note above).

| Verb | Signature | Backing |
|---|---|---|
| `input/down?` | `(input/down? btn) → #t/#f` (held) | `marionetteWorld.js:975` |
| `input/pressed?` | `(input/pressed? btn) → #t/#f` (edge since last step) | `marionetteWorld.js:976` |
| `input/set!` | `(input/set! btn bool)` (host hook) | `marionetteWorld.js:977` |
| `input/buttons` | `(input/buttons) → [up down left right a b]` | `marionetteWorld.js:978` |

1. _(novice)_ is the A button held:
   ```scheme
   (input/down? 'a)
   ```
   *;; generated*
2. _(intermediate)_ nudge an entity while right is held:
   ```scheme
   (when (input/down? 'right) (entity/move! f 1 0))
   ```
   *;; generated*
3. _(expert)_ jump only on the rising edge of A (not while held):
   ```scheme
   (when (input/pressed? 'a) (entity/set-vel! f (car (entity/vel f)) -3))
   ```
   *;; generated*

### 19.4 `prefab/*` · `scene/*` · `big-bang` clauses · `game/*` — the loop

`installMarionetteScene` adds prefab/scene composition and the `big-bang`
world loop. `big-bang` takes clause handles (`on-tick`, `to-draw`,
`stop-when`, `check-with`, `on-key`, `with-seed`) and returns a game id
whose lifecycle is driven by `game/*`. State-changers `perm state-change`;
clause constructors + `game/state|frame|running?` `perm read`.

| Verb | Signature | Backing |
|---|---|---|
| `prefab/define` | `(prefab/define name spec) → #t` | `marionetteScene.js:365` |
| `prefab/spawn` | `(prefab/spawn name x y) → id` | `marionetteScene.js:366` |
| `scene/spawn-many` | `(scene/spawn-many name points) → [id…]` | `marionetteScene.js:367` |
| `scene/grid` | `(scene/grid name cols rows dx dy x0 y0) → [id…]` | `marionetteScene.js:368` |
| `scene/load` | `(scene/load records) → [id…]` | `marionetteScene.js:369` |
| `scene/clear` | `(scene/clear) → #t` | `marionetteScene.js:370` |
| `on-tick` | `(on-tick handler) → clause` (per-frame state advance) | `marionetteScene.js:373` |
| `to-draw` | `(to-draw render) → clause` (per-frame render) | `marionetteScene.js:374` |
| `stop-when` | `(stop-when pred) → clause` | `marionetteScene.js:375` |
| `check-with` | `(check-with pred) → clause` (per-frame invariant) | `marionetteScene.js:376` |
| `on-key` | `(on-key key handler) → clause` (input fold) | `marionetteScene.js:377` |
| `with-seed` | `(with-seed n) → clause` (deterministic seed) | `marionetteScene.js:378` |
| `big-bang` | `(big-bang initial clause…) → game-id` | `marionetteScene.js:381` |
| `game/step` | `(game/step id) → status` | `marionetteScene.js:382` |
| `game/stop` | `(game/stop id) → #t` | `marionetteScene.js:383` |
| `game/state` | `(game/state id) → state` | `marionetteScene.js:384` |
| `game/frame` | `(game/frame id) → n` | `marionetteScene.js:385` |
| `game/running?` | `(game/running? id) → #t/#f` | `marionetteScene.js:386` |

1. _(novice)_ bake a prefab and stamp it once:
   ```scheme
   (begin (prefab/define 'coin '((kind . coin) (w . 4) (h . 4)))
          (prefab/spawn 'coin 40 40))
   ```
   *;; generated*
2. _(intermediate)_ stamp a lattice of coins:
   ```scheme
   (scene/grid 'coin 4 3 12 12 20 20)
   ```
   *;; generated*
3. _(expert)_ a minimal loop: move on input, stop after 100 frames:
   ```scheme
   (big-bang 0
     (on-key 'right (lambda (s) (entity/move! hero 1 0) s))
     (on-tick (lambda (s) (+ s 1)))
     (stop-when (lambda (s) (>= s 100))))
   ```
   *;; generated*

---

### 19.5 `sprite/*` · `audio/*` — the Marionette AUDIO layer (locked 2026-07-03, #586/#587)

The "sounds" half of *finish marionette now, with all the sounds*. Eight
verbs let the 4B drive the desktop's whole voice from Scheme:
per-sprite footstep + one-shot sfx read from the sprite registry, plus an
`audio/*` mix-channel control layer (`play/stop/volume/duck/mix/applause`).
`installMarionetteAudio` binds them AFTER `installSynthVerbs` +
`installSpriteRegistry` + `installMarionetteBus` (`scheme/index.js`) so
`getSprite` and the bus completion-seam are live.

**Determinism + honesty.** Mix state is pure resettable module state (no
clock, no rng); the play/mix DISPATCH is injectable (`opts.play` /
`opts.emitMix`) and the default returns `false` when there is no audio
host — so a verb reports `fired:false` rather than claiming sound that
never played. `(when-done …)` on audio rides a FUTURE LOGICAL FRAME on the
Marionette bus (kind `sound-done` / `audio-unduck`), scheduled only when
the caller names a `:key`, so replay is byte-identical. All verbs
`perm animate`, skip-if-bound (first installer wins).

| Verb | Signature | Backing |
|---|---|---|
| `sprite/footstep` | `(sprite/footstep name [:pace P] [:key K] [:frames N]) → ['ok 'footstep …]` | `marionetteAudio.js:208` |
| `sprite/sfx` | `(sprite/sfx name event [:key K] [:frames N]) → ['ok 'sprite-sfx …]` | `marionetteAudio.js:231` |
| `audio/play` | `(audio/play spec… [:channel C] [:gain G] [:key K] [:frames N]) → ['ok 'playing …]` | `marionetteAudio.js:258` |
| `audio/stop` | `(audio/stop [:channel C]) → ['ok 'stopped …]` | `marionetteAudio.js:278` |
| `audio/volume` | `(audio/volume 0..1 [:channel C]) → ['ok 'volume …]` | `marionetteAudio.js:286` |
| `audio/duck` | `(audio/duck 0..1 [:channel C] [:frames N]) → ['ok 'ducked …]` | `marionetteAudio.js:297` |
| `audio/mix` | `(audio/mix [:master M] [:music X] [:sfx Y] [:voice Z] [:ambient A]) → ['ok 'mix …]` | `marionetteAudio.js:316` |
| `audio/applause` | `(audio/applause [:intensity I] [:frames N] [:key K] [:steps S]) → ['ok 'applause …]` | `marionetteAudio.js:328` |

Channels are `music · sfx · voice · ambient` (`marionetteAudio.js:87`);
effective gain = master · channel · local, all clamped `[0,1]`
(`effectiveGain`, `marionetteAudio.js:143`). `sprite/footstep` reads the
sprite's registered `footstep` instrument + `footstepGain` (default 0.35)
and errors `no-footstep` when the sprite was never given a step voice —
honest, never a silent no-op. `sprite/sfx` resolves the sprite's `sfx`
slot (event → instrument) and errors `no-sfx` for an unmapped event.
`audio/applause` is a seeded integer-hash clap/rest `beat` (no
`Math.random`), so a replay is byte-identical (`applauseSpec`,
`marionetteAudio.js:169`).

1. _(novice)_ a sprite takes an audible step:
   ```scheme
   (sprite/footstep 'walker)
   ```
   *;; generated*
2. _(intermediate)_ duck the music while she speaks, then it restores itself:
   ```scheme
   (begin (audio/duck 0.2 :channel 'music :frames 45)
          (audio/play 'chime :channel 'voice))
   ```
   *;; generated*
3. _(expert)_ set a mix snapshot, fire a pace-linked footstep with a
   completion key, and cap it with a seeded ovation:
   ```scheme
   (begin
     (audio/mix :master 0.9 :music 0.5 :sfx 0.8)
     (sprite/footstep 'walker :pace 1.5 :key 'step-1)
     (audio/applause :intensity 0.8 :key 'ovation))
   ```
   *;; generated*

> **AUDIO GOLDEN GATE — OPEN.** Per the visual-golden gate discipline
> (CLAUDE.md), nothing with a voice ships on unit tests + dispatch-returns-ok
> alone. These 8 verbs are green in `marionetteAudio.test.js` (27 tests:
> builders, all 8 verbs, error envelopes, honest `fired:false`, skip-if-bound)
> but on-device audibility on `mac-studio.local:3000` is **not yet verified** —
> the host-side consumer of `curator:marionette-audio` / `curator:marionette-mix`
> must be confirmed to actually sound. Flagged pending.

---

### 19.6 shape↔entity bone — `entity/shape*!` · `entity/pose!` · `world/render` · `sway*!` (locked 2026-07-03)

The "finish marionette" bone: it binds a rasterizable SHAPE to a live world
ENTITY so the whole living world paints from **one** verb. Before this, entities
had position but no geometry; painting a world meant hand-stamping each body.
These six verbs live in `installGridVerbs` (`grid.js`) — the animation engine —
and are *called by* Marionette, keeping the render seam subordinate to the
direct-control layer (HelloSurface §130).

An entity carries up to four facets: **SHAPE** (cells or flower, mandatory to
render), **POSE** (`spin/sx/sy`), and the **ENTITY/BEHAVIOR** facets the world
already owns (`x/y/vx/vy`, `ai/*`). `world/render` walks every entity in
`bornSeq` order and paints its shape through `_stampLimbs` / `paintFlowerPose`.

| Verb | Signature | Backing |
|---|---|---|
| `entity/shape!` | `(entity/shape! id cells [alphas]) → #t / 'entity-not-found` | `grid.js` (installGridVerbs) |
| `entity/shape-flower!` | `(entity/shape-flower! id n) → #t / 'entity-not-found` | `grid.js` |
| `entity/pose!` | `(entity/pose! id spin sx sy) → #t / 'entity-not-found` | `grid.js` |
| `world/render` | `(world/render [pitch]) → lit-cell-count` | `grid.js` |
| `sway!` | `(sway! id period amp) → #t / 'entity-not-found` | `grid.js` |
| `world/sway-all!` | `(world/sway-all! tag period amp) → count-swayed` | `grid.js` |

**Determinism + honesty.** `sway!`/`world/sway-all!` read `worldFrameNow()` and
write `amp·dsin(2π·frame/period)` into the entity's pose (`dsin`, not
`Math.sin` — fround-shimmed, byte-identical). `world/sway-all!` phase-offsets each
tagged entity by `bornSeq·0.37` so a bed of grass ripples rather than pulsing in
lockstep. Every mutator returns `'entity-not-found` on a missing id — honest-null,
never a throw, never a silent no-op. `world/render` returns the lit-cell count so
a caller can assert coverage.

1. _(novice)_ give an entity a shape and paint it:
   ```scheme
   (let ((a (world/spawn 'grass 10 20)))
     (entity/shape! a (list (list 0 0) (list 0 1) (list 0 2) (list 0 3)))
     (world/render))
   ```
   *;; generated*
2. _(intermediate)_ a real blossom, posed, painted:
   ```scheme
   (let ((f (world/spawn 'bloom 30 20)))
     (entity/shape-flower! f 24)
     (entity/pose! f 0.2 1.0 1.0)
     (world/render))
   ```
   *;; generated*
3. _(expert)_ a whole tagged bed sways as one field, then renders:
   ```scheme
   (begin
     (define a (world/spawn 'grass 10 20))
     (define b (world/spawn 'grass 30 20))
     (entity/shape! a (list (list 0 0) (list 0 1) (list 0 2) (list 0 3)))
     (entity/shape! b (list (list 0 0) (list 0 1) (list 0 2) (list 0 3)))
     (entity/tag! a 'grass) (entity/tag! b 'grass)
     (world/sway-all! 'grass 40 0.3)
     (world/render))
   ```
   *;; generated*

> **VISUAL GOLDEN GATE — PENDING.** These six verbs are green through the real
> interpreter (`runWithCards`: bind+render 7 cells, flower-entity 215, walker
> after two `world/step`s 219, missing→`'entity-not-found`) but the on-device
> filmable "living desktop" artifact (GIF/MP4 of swaying grass + flower +
> autonomous walker) is **not yet rendered**. Flagged pending per the
> visual-golden-gate discipline (CLAUDE.md).

---

### 19.7 physics — `entity/mass!` · `entity/drag!` · `entity/bounce!` · `entity/pin!` · `world/link!` · `world/link-rest!` · `world/floor!` · `world/solve!` (PBD, locked 2026-07-03, #610)

The "horrifyingly simple, sickeningly powerful" half of *finish marionette*:
**Position-Based Dynamics** (Jakobsen GDC 2001; Müller PBD 2007) on top of the
world's existing semi-implicit Euler integrator. The integrator is the
*predict* pass; these eight verbs add the *project* pass — particles carry an
inverse mass, distance **links** are Gauss-Seidel-projected onto their rest
length in a fixed insertion order, and a **floor** reflects the Verlet history.
No new motion path is hand-coded; **weight/material feel is a parameter regime**
over mass · drag · link-stiffness · bounce (`:embodiment` axis) — heavy brick =
high mass + short bounce + no drift; floaty petal = low mass + high drag + soft
links. There is no per-material verb, by design.

| Verb | Signature | Backing |
|---|---|---|
| `entity/mass!` | `(entity/mass! id m)` — sets `__im = m>0 ? 1/m : 0`; `m≤0` pins (∞ mass) | `marionetteWorld.js:917,1159` |
| `entity/drag!` | `(entity/drag! id d)` — air drag `d∈[0,1]`; velocity kept = `(1−d)`·frame-delta | `marionetteWorld.js:925,1160` |
| `entity/bounce!` | `(entity/bounce! id b)` — per-entity floor restitution `b∈[0,1]` | `marionetteWorld.js:934,1161` |
| `entity/pin!` | `(entity/pin! id [bool])` — pin/unpin (`__im=0` = immovable anchor) | `marionetteWorld.js:943,1162` |
| `world/link!` | `(world/link! a b [rest] [stiff])` — distance constraint; `rest` default = current gap, `stiff∈[0,1]` | `marionetteWorld.js:950,1163` |
| `world/link-rest!` | `(world/link-rest! a b rest)` → count of links retargeted | `marionetteWorld.js:965,1164` |
| `world/floor!` | `(world/floor! y [bounce])` — ground plane at `y`; no arg removes it | `marionetteWorld.js:977,1165` |
| `world/solve!` | `(world/solve! [iters])` — project all links now; `iters∈[1,64]` sets the per-step count → frame | `marionetteWorld.js:985,1166` |

**Determinism + honesty.** The prev-position needed for Verlet velocity lives in
per-step transient JS props `e._px`/`e._py` (`marionetteWorld.js:725`) that are
**never** enumerated in `worldSnapshot` or `worldHash` — so byte-identical replay
holds with no hash change (positions/velocities are already hashed). Links solve
in fixed insertion order (`solveConstraints`, `marionetteWorld.js:887`); distance
uses `dhypot` (fround-shimmed, IEEE-754 deterministic), and the position
correction is distributed by inverse-mass weights so a pinned anchor never
moves. `_links`/`_solveIters`/`_floor` serialize through `worldSnapshot` /
`worldRestore`, so a constrained world survives a restore and continues
identically. Every knob is *wired*: `world/floor!`'s bounce arg is the fallback
restitution when an entity has no own `entity/bounce!` — no dead knobs. Missing
ids are no-ops on mutators (honest-null, never a throw).

1. _(novice)_ make a body heavy and drop it onto a floor where it settles dead:
   ```scheme
   (begin (world/floor! 40)
          (entity/mass! brick 8)
          (world/step))
   ```
   *;; generated*
2. _(intermediate)_ hang a bob from a pinned anchor on a fixed-length link:
   ```scheme
   (begin
     (entity/pin! anchor)
     (world/link! anchor bob 10 1.0)   ;; rest 10, fully stiff
     (world/solve! 4))
   ```
   *;; generated*
3. _(expert)_ a five-bead rope, top pinned, drift-damped, bouncing on the floor —
   the same program replays byte-identically:
   ```scheme
   (begin
     (entity/pin! (car beads))
     (for-each (lambda (p) (entity/drag! (car p) 0.02)
                           (world/link! (car p) (cdr p)))
               (zip beads (cdr beads)))
     (world/floor! 60 0.3)
     (big-bang 0
       (on-tick (lambda (s) (world/step) (world/solve! 6) (+ s 1)))
       (stop-when (lambda (s) (>= s 40)))))
   ```
   *;; generated*

> **PHYSICS GOLDEN GATE — PENDING VISUAL.** All eight verbs are green through the
> real interpreter (`marionetteWorld.test.js`, physics describe block: pinned
> ignores gravity, link holds a bob at rest length, floor settles dead, bounce
> rebounds, five-bead rope on floor replays byte-identically, snapshot/restore
> carries links+floor). The filmable artifact — a heavy brick vs. a floaty petal
> dropped side-by-side, or a swinging rope — is **not yet rendered on-device**.
> Flagged pending per the visual-golden-gate discipline (CLAUDE.md).

---

## 20. 2026-07-04 roll-up · Math Toolkit v2, Phase 2 (the landed math verb wave)

> **Fold date 2026-07-04.** Seven new namespaced verb packs landed and were
> confirmed 3-way wired (import + install + re-export) through
> `primitives/index.js`, each mounted by its `installMathToolkit<Name>Verbs`
> installer. Every verb is `perm:'read'`, pure, and deterministic. Return
> shapes are association lists — `(key value)` pairs; points are
> `(point (x X) (y Y))`; rationals are `(rat (n N) (d D))`. Honest-null
> contract holds throughout: a value-domain miss returns the symbol `nan`;
> a structural failure (÷0, singular matrix, overflow, wrong arity) returns
> `(escalate <reason> <detail>)`. These entries close the P2 gap from
> `docs/STRAGGLER-WIRING-DOCS-AUDIT-2026-07-04.md` (the ~140 math verbs the
> catalog was silently missing). Source drafts authored per-module against
> the live source, merged sole-writer.

### 20.1 Combinatorics & Sequences

#### `(comb/bell n)`
Bell number B(n), the sum of all Stirling numbers of the second kind S(n,k) for k=0..n. Return: integer or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; overflow → `(escalate "exact-overflow" "bell overflow")`.
```scheme
(comb/bell 5)          ; => 52
```
```scheme
(comb/bell 0)          ; => 1
```
```scheme
(comb/bell -3)         ; => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/binomial-coeffs n)`
Binomial coefficients for row n of Pascal's triangle (alias of `comb/pascal-row`). Return: list of integers or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(comb/binomial-coeffs 3)   ; => (1 3 3 1)
```
```scheme
(comb/binomial-coeffs 0)   ; => (1)
```
```scheme
(comb/binomial-coeffs 4)   ; => (1 4 6 4 1)
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/catalan n)`
Catalan number Cn = C(2n,n)/(n+1). Return: integer or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; overflow → `(escalate "exact-overflow" "catalan overflow")`.
```scheme
(comb/catalan 4)       ; => 14
```
```scheme
(comb/catalan 0)       ; => 1
```
```scheme
(comb/catalan -1)      ; => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/choose n k)`
Binomial coefficient C(n,k), the number of ways to choose k items from n. Return: integer or `(escalate ...)`.
Honest-null: non-integer n or k → `nan`; k < 0 or k > n → 0; overflow → `(escalate "exact-overflow" "binomial coefficient overflow")`.
```scheme
(comb/choose 5 2)      ; => 10
```
```scheme
(comb/choose 5 6)      ; => 0
```
```scheme
(comb/choose 5.5 2)    ; => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/derangement n)`
Subfactorial !n, the number of permutations with no fixed points. Return: integer or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; overflow → `(escalate "exact-overflow" "derangement overflow")`.
```scheme
(comb/derangement 4)   ; => 9
```
```scheme
(comb/derangement 0)   ; => 1
```
```scheme
(comb/derangement 1)   ; => 0
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/factorial n)`
Factorial n! for integer n >= 0. Return: integer or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; n > 170 or safe-integer overflow → `(escalate "exact-overflow" ...)`.
```scheme
(comb/factorial 5)     ; => 120
```
```scheme
(comb/factorial 0)     ; => 1
```
```scheme
(comb/factorial -3)    ; => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/multichoose n k)`
Stars-and-bars multiset coefficient C(n+k-1,k). Return: integer or `(escalate ...)`.
Honest-null: non-integer n or k, or n < 0, or k < 0 → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(comb/multichoose 3 2) ; => 6
```
```scheme
(comb/multichoose 0 0) ; => 1
```
```scheme
(comb/multichoose -1 2); => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/multinomial ks)`
Multinomial coefficient (sum ks)! / product(ki!). Return: integer or `(escalate ...)`.
Honest-null: non-array, empty list → 1; non-integer or negative element → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(comb/multinomial '(2 3 1))  ; => 30
```
```scheme
(comb/multinomial '())       ; => 1
```
```scheme
(comb/multinomial '(2 -1))   ; => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/partition-count n)`
Integer partition count p(n), the number of ways to write n as a sum of positive integers. Return: integer or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; n > 1000 → `(escalate "fuel-exhausted" "partition-count limit n<=1000")`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(comb/partition-count 10)    ; => 42
```
```scheme
(comb/partition-count 0)     ; => 1
```
```scheme
(comb/partition-count -5)    ; => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/pascal-row n)`
nth row of Pascal's triangle as a list. Return: list of integers or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(comb/pascal-row 4)    ; => (1 4 6 4 1)
```
```scheme
(comb/pascal-row 0)    ; => (1)
```
```scheme
(comb/pascal-row 2)    ; => (1 2 1)
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/pascal-triangle n)`
First n rows of Pascal's triangle (rows 0 through n inclusive). Return: list of lists or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; n > 100 → `(escalate "fuel-exhausted" "pascal-triangle limit n<=100")`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(comb/pascal-triangle 4)     ; => ((1) (1 1) (1 2 1) (1 3 3 1) (1 4 6 4 1))
```
```scheme
(comb/pascal-triangle 0)     ; => ((1))
```
```scheme
(comb/pascal-triangle 2)     ; => ((1) (1 1) (1 2 1))
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/permute n k)`
Permutations P(n,k) = n!/(n-k)!. Return: integer or `(escalate ...)`.
Honest-null: non-integer n or k → `nan`; k < 0 or k > n → 0; overflow → `(escalate "exact-overflow" "permutation overflow")`.
```scheme
(comb/permute 5 2)     ; => 20
```
```scheme
(comb/permute 5 0)     ; => 1
```
```scheme
(comb/permute 3 5)     ; => 0
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(comb/stirling2 n k)`
Stirling number of the second kind S(n,k), the number of ways to partition n elements into k non-empty subsets. Return: integer or `(escalate ...)`.
Honest-null: non-integer n or k, or negative → `nan`; overflow → `(escalate "exact-overflow" "stirling2 overflow")`.
```scheme
(comb/stirling2 4 2)   ; => 7
```
```scheme
(comb/stirling2 5 5)   ; => 1
```
```scheme
(comb/stirling2 3 0)   ; => 0
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/arithmetic a1 d n)`
nth term of arithmetic sequence: a1 + (n-1)d. Return: number.
Honest-null: non-finite a1 or d, non-integer n, or n < 1 → `nan`.
```scheme
(seq/arithmetic 3 2 5) ; => 11
```
```scheme
(seq/arithmetic 1 0 10); => 1
```
```scheme
(seq/arithmetic 5 -2 3); => 1
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/arithmetic-sum a1 d n)`
Sum of first n terms of arithmetic sequence: (n/2)(2a1 + (n-1)d). Return: number.
Honest-null: non-finite a1 or d, non-integer n, or n < 1 → `nan`.
```scheme
(seq/arithmetic-sum 3 2 5)  ; => 35
```
```scheme
(seq/arithmetic-sum 1 1 10) ; => 55
```
```scheme
(seq/arithmetic-sum 2 0 5)  ; => 10
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/fibonacci n)`
nth Fibonacci number (0-indexed: F0=0, F1=1, Fn=Fn-1+Fn-2). Return: integer or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; n > 1476 or overflow → `(escalate "exact-overflow" ...)`.
```scheme
(seq/fibonacci 10)     ; => 55
```
```scheme
(seq/fibonacci 0)      ; => 0
```
```scheme
(seq/fibonacci 1)      ; => 1
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/geometric a1 r n)`
nth term of geometric sequence: a1 * r^(n-1). Return: number.
Honest-null: non-finite a1 or r, non-integer n, or n < 1 → `nan`.
```scheme
(seq/geometric 2 3 4)  ; => 54
```
```scheme
(seq/geometric 1 2 5)  ; => 16
```
```scheme
(seq/geometric 5 1 10) ; => 5
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/geometric-inf-sum a1 r)`
Infinite geometric series sum a1/(1-r), valid for |r| < 1. Return: number or `(escalate ...)`.
Honest-null: non-finite a1 or r → `nan`; |r| >= 1 → `(escalate "divergent" "infinite geometric series requires |r|<1")`.
```scheme
(seq/geometric-inf-sum 1 0.5)  ; => 2
```
```scheme
(seq/geometric-inf-sum 3 0.25) ; => 4
```
```scheme
(seq/geometric-inf-sum 1 2)    ; => (escalate "divergent" "infinite geometric series requires |r|<1")
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/geometric-sum a1 r n)`
Sum of first n terms of geometric sequence: a1(1-r^n)/(1-r) for r≠1, else a1*n. Return: number.
Honest-null: non-finite a1 or r, non-integer n, or n < 1 → `nan`.
```scheme
(seq/geometric-sum 2 3 4)  ; => 80
```
```scheme
(seq/geometric-sum 1 2 5)  ; => 31
```
```scheme
(seq/geometric-sum 5 1 3)  ; => 15
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/lucas n)`
nth Lucas number (0-indexed: L0=2, L1=1, Ln=Ln-1+Ln-2). Return: integer or `(escalate ...)`.
Honest-null: non-integer or negative n → `nan`; n > 1476 or overflow → `(escalate "exact-overflow" ...)`.
```scheme
(seq/lucas 5)          ; => 11
```
```scheme
(seq/lucas 0)          ; => 2
```
```scheme
(seq/lucas 1)          ; => 1
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/nth-term terms)`
Detect arithmetic or geometric pattern in list and predict next term. Return: number.
Honest-null: non-array, fewer than 2 terms, non-finite element, or no pattern detected → `nan`.
```scheme
(seq/nth-term '(2 5 8 11))     ; => 14
```
```scheme
(seq/nth-term '(3 6 12 24))    ; => 48
```
```scheme
(seq/nth-term '(1 4 9 16))     ; => nan
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/partial-sums terms)`
Running totals of a list. Return: list of numbers.
Honest-null: non-array or non-finite element → `nan`.
```scheme
(seq/partial-sums '(1 2 3 4))  ; => (1 3 6 10)
```
```scheme
(seq/partial-sums '(5))        ; => (5)
```
```scheme
(seq/partial-sums '())         ; => ()
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/product lo hi f)`
Product of f(i) for i in [lo, hi]. Return: number or `(escalate ...)`.
Honest-null: non-integer lo or hi, non-function f, or non-finite f(i) → `nan`; hi-lo+1 > 100000 → `(escalate "fuel-exhausted" "product iteration limit")`.
```scheme
(seq/product 1 5 (lambda (x) x))       ; => 120
```
```scheme
(seq/product 2 4 (lambda (x) (* x x))) ; => 96
```
```scheme
(seq/product 1 1 (lambda (x) x))       ; => 1
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/recurrence coeffs init n)`
Evaluate linear recurrence relation to index n. Coefficients are ordered [c0 c1 ...] where term[i] = c0*term[i-1] + c1*term[i-2] + .... Return: number or `(escalate ...)`.
Honest-null: non-array coeffs or init, mismatched lengths, non-integer n, n < 0, non-finite coefficients/initials → `nan`; n > 100000 → `(escalate "fuel-exhausted" ...)`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(seq/recurrence '(1 1) '(0 1) 10)      ; => 55
```
```scheme
(seq/recurrence '(1 1) '(0 1) 0)       ; => 0
```
```scheme
(seq/recurrence '(2) '(3) 5)           ; => 96
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

#### `(seq/sigma lo hi f)`
Sum of f(i) for i in [lo, hi]. Return: number or `(escalate ...)`.
Honest-null: non-integer lo or hi, non-function f, or non-finite f(i) → `nan`; hi-lo+1 > 100000 → `(escalate "fuel-exhausted" "sigma iteration limit")`.
```scheme
(seq/sigma 1 10 (lambda (x) (* x x)))  ; => 385
```
```scheme
(seq/sigma 1 5 (lambda (x) x))         ; => 15
```
```scheme
(seq/sigma 0 0 (lambda (x) (* x 2)))   ; => 0
```
Wired: `installMathToolkitCombinatoricsVerbs` (mathToolkitCombinatoricsVerbs.js).

### 20.2 Geometric Transforms

#### `(geom/arccos x)`
Inverse cosine in radians. Return: scalar (radians).
Honest-null: `x < -1 or x > 1 → nan`; `x not a number → nan`.
```scheme
(geom/arccos 0.5)      ; => 1.0471975511965979
```
```scheme
(geom/arccos 1)        ; => 0
```
```scheme
(geom/arccos 2)        ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/arcsin x)`
Inverse sine in radians. Return: scalar (radians).
Honest-null: `x < -1 or x > 1 → nan`; `x not a number → nan`.
```scheme
(geom/arcsin 0.5)      ; => 0.5235987755982989
```
```scheme
(geom/arcsin -1)       ; => -1.5707963267948966
```
```scheme
(geom/arcsin 1.5)      ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/arctan x)`
Inverse tangent in radians. Return: scalar (radians).
Honest-null: `x not a number → nan`.
```scheme
(geom/arctan 1)        ; => 0.7853981633974483
```
```scheme
(geom/arctan 0)        ; => 0
```
```scheme
(geom/arctan -1)       ; => -0.7853981633974483
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/arc-length r theta)`
Arc length from radius and central angle (radians). Return: scalar.
Honest-null: `r < 0 → nan`; `r or theta not a number → nan`.
```scheme
(geom/arc-length 5 1.0472)   ; => 5.236
```
```scheme
(geom/arc-length 3 6.2832)   ; => 18.8496
```
```scheme
(geom/arc-length -1 1)       ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/atan2 y x)`
Two-argument arctangent in radians. Return: scalar (radians).
Honest-null: `y or x not a number → nan`.
```scheme
(geom/atan2 1 1)       ; => 0.7853981633974483
```
```scheme
(geom/atan2 0 1)       ; => 0
```
```scheme
(geom/atan2 -1 0)      ; => -1.5707963267948966
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/cone-surface r slant)`
Surface area of cone (second arg is slant height). Return: scalar.
Honest-null: `r < 0 or slant < 0 → nan`; `r or slant not a number → nan`.
```scheme
(geom/cone-surface 3 5)      ; => 75.398
```
```scheme
(geom/cone-surface 2 4)      ; => 37.69911184307752
```
```scheme
(geom/cone-surface -1 5)     ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/cone-volume r h)`
Volume of cone. Return: scalar.
Honest-null: `r < 0 or h < 0 → nan`; `r or h not a number → nan`.
```scheme
(geom/cone-volume 3 5)       ; => 47.124
```
```scheme
(geom/cone-volume 2 6)       ; => 25.132741228718345
```
```scheme
(geom/cone-volume -3 5)      ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/cylinder-surface r h)`
Surface area of cylinder. Return: scalar.
Honest-null: `r < 0 or h < 0 → nan`; `r or h not a number → nan`.
```scheme
(geom/cylinder-surface 3 5)  ; => 150.796
```
```scheme
(geom/cylinder-surface 1 2)  ; => 18.84955592153876
```
```scheme
(geom/cylinder-surface 3 -1) ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/cylinder-volume r h)`
Volume of cylinder. Return: scalar.
Honest-null: `r < 0 or h < 0 → nan`; `r or h not a number → nan`.
```scheme
(geom/cylinder-volume 3 5)   ; => 141.372
```
```scheme
(geom/cylinder-volume 2 4)   ; => 50.26548245743669
```
```scheme
(geom/cylinder-volume -2 4)  ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/dilate p center k)`
Dilate point from center by scale factor k. Return: `(point (x X) (y Y))`.
Honest-null: `p or center not a point → nan`; `k not a number → nan`.
```scheme
(geom/dilate (point (x 2) (y 3)) (point (x 1) (y 1)) 2)  ; => (point (x 3.0) (y 5.0))
```
```scheme
(geom/dilate (point (x 4) (y 6)) (point (x 0) (y 0)) 0.5) ; => (point (x 2.0) (y 3.0))
```
```scheme
(geom/dilate (point (x 1) (y 1)) 5 2)                      ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/inscribed-angle central)`
Inscribed angle from central angle (radians). Return: scalar (radians).
Honest-null: `central not a number → nan`.
```scheme
(geom/inscribed-angle 2.0944)  ; => 1.0472
```
```scheme
(geom/inscribed-angle 3.1416)  ; => 1.5708
```
```scheme
(geom/inscribed-angle 0)       ; => 0
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/interior-angle n)`
Interior angle of regular n-gon in radians. Return: scalar (radians).
Honest-null: `n < 3 or n not an integer → nan`.
```scheme
(geom/interior-angle 6)        ; => 2.0944
```
```scheme
(geom/interior-angle 4)        ; => 1.5707963267948966
```
```scheme
(geom/interior-angle 2)        ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/interior-angle-deg n)`
Interior angle of regular n-gon in degrees. Return: scalar (degrees).
Honest-null: `n < 3 or n not an integer → nan`.
```scheme
(geom/interior-angle-deg 6)    ; => 120
```
```scheme
(geom/interior-angle-deg 8)    ; => 135
```
```scheme
(geom/interior-angle-deg 1)    ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/law-of-cosines-angle a b c)`
Find angle opposite c from three sides. Return: scalar (radians).
Honest-null: `a, b, or c ≤ 0 → nan`; `triangle inequality fails → (escalate "not-a-triangle" "triangle inequality fails")`; `invalid cosine → (escalate "not-a-triangle" "invalid cosine")`; `not all numbers → nan`.
```scheme
(geom/law-of-cosines-angle 3 4 5)     ; => 1.5708
```
```scheme
(geom/law-of-cosines-angle 5 5 5)     ; => 1.0471975511965979
```
```scheme
(geom/law-of-cosines-angle 1 1 10)    ; => (escalate "not-a-triangle" "triangle inequality fails")
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/law-of-cosines-side a b C)`
Find third side from two sides and included angle. Return: scalar.
Honest-null: `a, b, or C not a number → nan`; `c² < 0 → nan`.
```scheme
(geom/law-of-cosines-side 3 4 1.0472)   ; => 3.606
```
```scheme
(geom/law-of-cosines-side 5 5 0)        ; => 0
```
```scheme
(geom/law-of-cosines-side 3 4 3.1416)   ; => 7
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/law-of-sines-side a A B)`
Find side opposite B from side a opposite A. Return: scalar.
Honest-null: `a, A, or B not a number → nan`; `sin(A) = 0 → (escalate "degenerate-triangle" "sin(A)=0")`.
```scheme
(geom/law-of-sines-side 3 0.5236 1.0472)  ; => 5.196
```
```scheme
(geom/law-of-sines-side 4 1.0472 0.5236)  ; => 2.3094010767585034
```
```scheme
(geom/law-of-sines-side 3 0 1.0472)       ; => (escalate "degenerate-triangle" "sin(A)=0")
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/polygon-area pts)`
Area of polygon by shoelace formula. Return: scalar.
Honest-null: `pts not an array or < 3 points → nan`; `any point invalid → nan`.
```scheme
(geom/polygon-area ((point (x 0) (y 0)) (point (x 4) (y 0)) (point (x 0) (y 3)))) ; => 6
```
```scheme
(geom/polygon-area ((point (x 0) (y 0)) (point (x 2) (y 0)) (point (x 2) (y 2)) (point (x 0) (y 2)))) ; => 4
```
```scheme
(geom/polygon-area ((point (x 0) (y 0)) (point (x 1) (y 0)))) ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/polygon-perimeter pts)`
Perimeter of polygon. Return: scalar.
Honest-null: `pts not an array or < 2 points → nan`; `any point invalid → nan`.
```scheme
(geom/polygon-perimeter ((point (x 0) (y 0)) (point (x 3) (y 0)) (point (x 0) (y 4)))) ; => 12
```
```scheme
(geom/polygon-perimeter ((point (x 0) (y 0)) (point (x 1) (y 0)) (point (x 1) (y 1)) (point (x 0) (y 1)))) ; => 4
```
```scheme
(geom/polygon-perimeter ((point (x 0) (y 0))))  ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/prism-volume baseArea height)`
Volume of prism from base area and height. Return: scalar.
Honest-null: `baseArea < 0 or height < 0 → nan`; `baseArea or height not a number → nan`.
```scheme
(geom/prism-volume 10 5)       ; => 50
```
```scheme
(geom/prism-volume 7.5 3)      ; => 22.5
```
```scheme
(geom/prism-volume -10 5)      ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/pyramid-volume baseArea height)`
Volume of pyramid from base area and height. Return: scalar.
Honest-null: `baseArea < 0 or height < 0 → nan`; `baseArea or height not a number → nan`.
```scheme
(geom/pyramid-volume 20 6)     ; => 40
```
```scheme
(geom/pyramid-volume 9 4)      ; => 12
```
```scheme
(geom/pyramid-volume 10 -2)    ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/reflect-line p a b c)`
Reflect point across line ax+by+c=0. Return: `(point (x X) (y Y))`.
Honest-null: `p not a point → nan`; `a, b, or c not a number → nan`; `a = b = 0 → (escalate "degenerate-line" "a=b=0")`.
```scheme
(geom/reflect-line (point (x 1) (y 1)) 1 0 0)  ; => (point (x -1.0) (y 1.0))
```
```scheme
(geom/reflect-line (point (x 2) (y 3)) 0 1 -1) ; => (point (x 2.0) (y -1.0))
```
```scheme
(geom/reflect-line (point (x 1) (y 1)) 0 0 5)  ; => (escalate "degenerate-line" "a=b=0")
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/reflect-origin p)`
Reflect point through origin. Return: `(point (x X) (y Y))`.
Honest-null: `p not a point → nan`.
```scheme
(geom/reflect-origin (point (x 3) (y 5)))  ; => (point (x -3.0) (y -5.0))
```
```scheme
(geom/reflect-origin (point (x -2) (y 4))) ; => (point (x 2.0) (y -4.0))
```
```scheme
(geom/reflect-origin 5)                     ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/reflect-x p)`
Reflect point across x-axis. Return: `(point (x X) (y Y))`.
Honest-null: `p not a point → nan`.
```scheme
(geom/reflect-x (point (x 3) (y 5)))   ; => (point (x 3.0) (y -5.0))
```
```scheme
(geom/reflect-x (point (x -2) (y 7)))  ; => (point (x -2.0) (y -7.0))
```
```scheme
(geom/reflect-x 42)                     ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/reflect-y p)`
Reflect point across y-axis. Return: `(point (x X) (y Y))`.
Honest-null: `p not a point → nan`.
```scheme
(geom/reflect-y (point (x 3) (y 5)))   ; => (point (x -3.0) (y 5.0))
```
```scheme
(geom/reflect-y (point (x -4) (y 2)))  ; => (point (x 4.0) (y 2.0))
```
```scheme
(geom/reflect-y "not-a-point")          ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/regular-polygon-area n s)`
Area of regular n-gon from side length. Return: scalar.
Honest-null: `n < 3 or n not an integer → nan`; `s < 0 → nan`; `s not a number → nan`.
```scheme
(geom/regular-polygon-area 6 1)        ; => 2.598
```
```scheme
(geom/regular-polygon-area 4 5)        ; => 25
```
```scheme
(geom/regular-polygon-area 2 3)        ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/regular-polygon-vertices n cx cy r)`
Vertices of regular n-gon centered at (cx, cy) with radius r. Return: list of `(point (x X) (y Y))`.
Honest-null: `n < 3 or n not an integer → nan`; `cx, cy, or r not a number → nan`; `r < 0 → nan`.
```scheme
(geom/regular-polygon-vertices 6 0 0 1)  ; => ((point (x 1.0) (y 0.0)) (point (x 0.5) (y 0.866)) ...)
```
```scheme
(geom/regular-polygon-vertices 4 1 1 2)  ; => ((point (x 3.0) (y 1.0)) ...)
```
```scheme
(geom/regular-polygon-vertices 2 0 0 1)  ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/rotate p theta)`
Rotate point about origin by theta radians. Return: `(point (x X) (y Y))`.
Honest-null: `p not a point → nan`; `theta not a number → nan`.
```scheme
(geom/rotate (point (x 1) (y 0)) 1.5708)  ; => (point (x 0.0) (y 1.0))
```
```scheme
(geom/rotate (point (x 1) (y 1)) 3.1416)  ; => (point (x -1.0) (y -1.0))
```
```scheme
(geom/rotate 5 1.5708)                     ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/rotate-about p center theta)`
Rotate point about center by theta radians. Return: `(point (x X) (y Y))`.
Honest-null: `p or center not a point → nan`; `theta not a number → nan`.
```scheme
(geom/rotate-about (point (x 2) (y 0)) (point (x 1) (y 0)) 1.5708) ; => (point (x 1.0) (y 1.0))
```
```scheme
(geom/rotate-about (point (x 3) (y 3)) (point (x 0) (y 0)) 3.1416) ; => (point (x -3.0) (y -3.0))
```
```scheme
(geom/rotate-about (point (x 1) (y 1)) 7 1.5708)                    ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/sector-area r theta)`
Area of circular sector from radius and central angle (radians). Return: scalar.
Honest-null: `r < 0 → nan`; `r or theta not a number → nan`.
```scheme
(geom/sector-area 5 1.0472)    ; => 13.09
```
```scheme
(geom/sector-area 3 3.1416)    ; => 14.137200000000001
```
```scheme
(geom/sector-area -2 1.5708)   ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/solve-right key1 val1 key2 val2)`
Solve right triangle given any 2 of hyp/opp/adj/angle. Return: `(right-triangle (hyp H) (opp O) (adj A) (angle θ))`.
Honest-null: `not exactly 2 knowns → nan`; `invalid combination → nan`; `invalid values → nan`; `key not a string or val not a number → nan`.
```scheme
(geom/solve-right "hyp" 5 "opp" 3)  ; => (right-triangle (hyp 5) (opp 3) (adj 4) (angle 0.6435011087932844))
```
```scheme
(geom/solve-right "opp" 4 "adj" 3)  ; => (right-triangle (hyp 5) (opp 4) (adj 3) (angle 0.9272952180016122))
```
```scheme
(geom/solve-right "hyp" 5 "opp" 6)  ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/sphere-surface r)`
Surface area of sphere. Return: scalar.
Honest-null: `r < 0 → nan`; `r not a number → nan`.
```scheme
(geom/sphere-surface 3)        ; => 113.097
```
```scheme
(geom/sphere-surface 1)        ; => 12.566370614359172
```
```scheme
(geom/sphere-surface -2)       ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/sphere-volume r)`
Volume of sphere. Return: scalar.
Honest-null: `r < 0 → nan`; `r not a number → nan`.
```scheme
(geom/sphere-volume 3)         ; => 113.097
```
```scheme
(geom/sphere-volume 2)         ; => 33.510321638291124
```
```scheme
(geom/sphere-volume -1)        ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/transform-polygon pts fnName ...args)`
Apply transform to list of points. Return: list of `(point (x X) (y Y))`.
Honest-null: `pts not an array → nan`; `fnName not a string or unknown → nan`; `any transform returns nan or escalate → that value`.
```scheme
(geom/transform-polygon ((point (x 0) (y 0)) (point (x 1) (y 0))) "geom/reflect-x") ; => ((point (x 0.0) (y 0.0)) (point (x 1.0) (y 0.0)))
```
```scheme
(geom/transform-polygon ((point (x 1) (y 1)) (point (x 2) (y 2))) "geom/translate" 3 4) ; => ((point (x 4.0) (y 5.0)) (point (x 5.0) (y 6.0)))
```
```scheme
(geom/transform-polygon ((point (x 1) (y 1))) "unknown-transform") ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

#### `(geom/translate p dx dy)`
Translate point by dx dy. Return: `(point (x X) (y Y))`.
Honest-null: `p not a point → nan`; `dx or dy not a number → nan`.
```scheme
(geom/translate (point (x 1) (y 2)) 3 4)  ; => (point (x 4.0) (y 6.0))
```
```scheme
(geom/translate (point (x 0) (y 0)) -2 5) ; => (point (x -2.0) (y 5.0))
```
```scheme
(geom/translate "invalid" 3 4)             ; => nan
```
Wired: `installMathToolkitGeomTransformsVerbs` (mathToolkitGeomTransformsVerbs.js).

### 20.3 Multivariable Calculus

#### `(calc/arc-length f a b)`
Length of curve y=f(x) from a to b using Simpson's rule integration. Return: number (6 decimals).
Honest-null: `a ≥ b → nan`; non-finite integral result → `(escalate "non-finite" "arc length integral non-finite")`.
```scheme
(calc/arc-length (lambda (x) (* x x)) 0 1)  ; => 1.478943
```
```scheme
(calc/arc-length (lambda (x) x) 0 5)        ; => 5.024938
```
```scheme
(calc/arc-length (lambda (x) x) 5 0)        ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/arc-length-param x-of-t y-of-t a b)`
Parametric arc length ∫√(ẋ²+ẏ²) dt from t=a to t=b. Return: number (6 decimals).
Honest-null: `a ≥ b → nan`; non-finite result → `(escalate "non-finite" "parametric arc length non-finite")`.
```scheme
(calc/arc-length-param (lambda (t) t) (lambda (t) t) 0 1)  ; => 1.414214
```
```scheme
(calc/arc-length-param (lambda (t) (* 3 t)) (lambda (t) (* 4 t)) 0 1)  ; => 5.0
```
```scheme
(calc/arc-length-param (lambda (t) t) (lambda (t) t) 1 0)  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/continuous? f x)`
Numeric continuity check: left/right limits agree with f(x) within tolerance 1e-5. Return: `#t` or `#f`.
Honest-null: non-function f or non-finite x → `nan`; non-finite evaluation → `#f`.
```scheme
(calc/continuous? (lambda (x) (* x x)) 2)  ; => #t
```
```scheme
(calc/continuous? (lambda (x) x) 0)        ; => #t
```
```scheme
(calc/continuous? (lambda (x) (/ 1 x)) 0)  ; => #f
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/critical-points-1d f a b steps)`
List of x where f'(x)≈0 on [a,b] using derivative sign changes and bisection (20 iterations). Return: list of numbers (6 decimals).
Honest-null: `a ≥ b → nan`; steps not integer or out of [2, 100000] → `(escalate "fuel-exhausted" "steps out of range [2, 100000]")`.
```scheme
(calc/critical-points-1d (lambda (x) (* x x)) -2 2 50)  ; => (0.0)
```
```scheme
(calc/critical-points-1d (lambda (x) (- (* x x x) (* 3 x))) -3 3 100)  ; => (-1.0 1.0)
```
```scheme
(calc/critical-points-1d (lambda (x) x) 2 1 50)  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/differentiable? f x)`
Numeric differentiability check: left/right derivatives agree within tolerance 1e-4. Return: `#t` or `#f`.
Honest-null: non-function f or non-finite x → `nan`; non-finite derivatives → `#f`.
```scheme
(calc/differentiable? (lambda (x) (* x x)) 1)  ; => #t
```
```scheme
(calc/differentiable? (lambda (x) x) 5)        ; => #t
```
```scheme
(calc/differentiable? (lambda (x) (/ 1 x)) 0)  ; => #f
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/directional-derivative f point dir)`
Directional derivative D_u f = ∇f · û at point in direction dir (normalized). Return: number (9 decimals).
Honest-null: non-function f, invalid point/dir, length mismatch → `nan`; gradient fails → propagate escalate; non-finite result → `(escalate "non-finite" "directional derivative non-finite")`.
```scheme
(calc/directional-derivative (lambda (pt) (+ (car pt) (cadr pt))) '(1 2) '(1 0))  ; => 1.0
```
```scheme
(calc/directional-derivative (lambda (pt) (* (car pt) (cadr pt))) '(2 3) '(3 4))  ; => 4.2
```
```scheme
(calc/directional-derivative (lambda (pt) (car pt)) '(1 2) '(0 0))  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/extrema-1d f a b steps)`
Classify critical points via second derivative test. Return: list of `(extremum (x X) (type min/max/saddle))`.
Honest-null: delegates to `calc/critical-points-1d`; propagates its `nan` or `escalate`.
```scheme
(calc/extrema-1d (lambda (x) (* x x)) -2 2 50)  ; => ((extremum (x 0.0) (type min)))
```
```scheme
(calc/extrema-1d (lambda (x) (- (* x x x) (* 3 x))) -3 3 100)  ; => ((extremum (x -1.0) (type max)) (extremum (x 1.0) (type min)))
```
```scheme
(calc/extrema-1d (lambda (x) x) 2 1 50)  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/gradient f point)`
Vector of all partial derivatives ∇f at point. Return: `(vec ∂f/∂x₀ ∂f/∂x₁ ...)` (9 decimals each).
Honest-null: non-function f or invalid point → `nan`; partial fails → propagate escalate.
```scheme
(calc/gradient (lambda (pt) (+ (car pt) (cadr pt))) '(1 2))  ; => (vec 1.0 1.0)
```
```scheme
(calc/gradient (lambda (pt) (* (car pt) (cadr pt))) '(2 3))  ; => (vec 3.0 2.0)
```
```scheme
(calc/gradient (lambda (pt) (car pt)) '(a b))  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/hessian f point)`
Matrix of second partial derivatives (symmetric). Return: `(matrix (row0...) (row1...) ...)` (9 decimals each).
Honest-null: non-function f or invalid point → `nan`; non-finite evaluations → `(escalate "non-finite" "hessian encountered non-finite values")`; non-finite element → `(escalate "non-finite" "hessian element non-finite")`.
```scheme
(calc/hessian (lambda (pt) (+ (* (car pt) (car pt)) (* (cadr pt) (cadr pt)))) '(1 1))  ; => (matrix (2.0 0.0) (0.0 2.0))
```
```scheme
(calc/hessian (lambda (pt) (* (car pt) (cadr pt))) '(2 3))  ; => (matrix (0.0 1.0) (1.0 0.0))
```
```scheme
(calc/hessian (lambda (pt) (car pt)) '(a b))  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/jacobian fs point)`
Matrix of gradients for list of scalar fields (row i is ∇fᵢ). Return: `(matrix (grad₀...) (grad₁...) ...)` (9 decimals).
Honest-null: non-list fs, invalid point, non-function in fs → `nan`; gradient fails → propagate escalate.
```scheme
(calc/jacobian (list (lambda (pt) (car pt)) (lambda (pt) (cadr pt))) '(1 2))  ; => (matrix (1.0 0.0) (0.0 1.0))
```
```scheme
(calc/jacobian (list (lambda (pt) (* (car pt) (cadr pt)))) '(2 3))  ; => (matrix (3.0 2.0))
```
```scheme
(calc/jacobian (list 'not-a-function) '(1 2))  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/laplacian f point)`
Trace of Hessian (∑ ∂²f/∂xᵢ²). Return: number (9 decimals).
Honest-null: non-function f or invalid point → `nan`; hessian fails → propagate escalate; non-finite result → `(escalate "non-finite" "laplacian non-finite")`.
```scheme
(calc/laplacian (lambda (pt) (+ (* (car pt) (car pt)) (* (cadr pt) (cadr pt)))) '(1 1))  ; => 4.0
```
```scheme
(calc/laplacian (lambda (pt) (* (car pt) (cadr pt))) '(2 3))  ; => 0.0
```
```scheme
(calc/laplacian (lambda (pt) (car pt)) '(a b))  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/partial f point i)`
Numerical ∂f/∂xᵢ at point using central difference (h=1e-5). Return: number (9 decimals).
Honest-null: non-function f, invalid point, non-integer or out-of-range i → `nan`; non-finite evaluations → `(escalate "non-finite" "partial derivative encountered non-finite values")`; non-finite result → `(escalate "non-finite" "partial derivative result non-finite")`.
```scheme
(calc/partial (lambda (pt) (+ (car pt) (cadr pt))) '(1 2) 0)  ; => 1.0
```
```scheme
(calc/partial (lambda (pt) (* (car pt) (cadr pt))) '(2 3) 1)  ; => 2.0
```
```scheme
(calc/partial (lambda (pt) (car pt)) '(1 2) 5)  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/surface-revolution f a b)`
Surface area rotating y=f(x) about x-axis using 2π|y|√(1+y'²) (Simpson's rule). Return: number (6 decimals).
Honest-null: `a ≥ b → nan`; non-finite or negative result → `(escalate "non-finite" "surface area of revolution invalid")`.
```scheme
(calc/surface-revolution (lambda (x) x) 0 1)  ; => 4.442883
```
```scheme
(calc/surface-revolution (lambda (x) 1) 0 2)  ; => 12.566371
```
```scheme
(calc/surface-revolution (lambda (x) x) 1 0)  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/total-differential f point dvec)`
Linear approximation df ≈ ∇f · d𝐯. Return: number (9 decimals).
Honest-null: non-function f, invalid point/dvec, length mismatch → `nan`; gradient fails → propagate escalate; non-finite result → `(escalate "non-finite" "total differential non-finite")`.
```scheme
(calc/total-differential (lambda (pt) (+ (car pt) (cadr pt))) '(1 2) '(0.1 0.2))  ; => 0.3
```
```scheme
(calc/total-differential (lambda (pt) (* (car pt) (cadr pt))) '(2 3) '(0.1 0.2))  ; => 0.7
```
```scheme
(calc/total-differential (lambda (pt) (car pt)) '(1 2) '(0.1))  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

#### `(calc/volume-revolution f a b axis)`
Volume rotating y=f(x) about x or y axis (disk method, Simpson's rule). Return: number (6 decimals).
Honest-null: `a ≥ b → nan`; axis not `'x` or `'y` → `nan`; non-finite or negative result → `(escalate "non-finite" "volume of revolution invalid")`.
```scheme
(calc/volume-revolution (lambda (x) x) 0 1 'x)  ; => 1.047198
```
```scheme
(calc/volume-revolution (lambda (x) 1) 0 2 'x)  ; => 6.283185
```
```scheme
(calc/volume-revolution (lambda (x) x) 1 0 'x)  ; => nan
```
Wired: `installMathToolkitCalcMultiVerbs` (mathToolkitCalcMultiVerbs.js).

### 20.4 Linear Algebra — Factorizations

#### `(linalg/characteristic-poly m)`
Characteristic polynomial det(m - λI). Return: `(poly (coeffs c₀ c₁ ... cₙ))`.
Honest-null: non-matrix → `nan`; non-square → `(escalate "not-square" ...)`, n>3 → `(escalate "not-implemented" ...)`.
```scheme
(linalg/characteristic-poly (matrix (2 0) (0 3)))
; => (poly (coeffs 1 -5 6))
```
```scheme
(linalg/characteristic-poly (matrix (1 2 3)))
; => (escalate "not-square" "characteristic polynomial requires square matrix")
```
```scheme
(linalg/characteristic-poly (matrix (6 -1 0) (-1 6 -1) (0 -1 6)))
; => (poly (coeffs 1 -18 108 -216))
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/eigenvectors m lambda)`
Eigenvectors for given eigenvalue. Return: list of `(vec ...)` basis vectors.
Honest-null: non-matrix or non-number → `nan`; non-square → `nan`; no eigenvectors → `(escalate "no-eigenvectors" ...)`.
```scheme
(linalg/eigenvectors (matrix (2 0) (0 3)) 2)
; => ((vec 1 0))
```
```scheme
(linalg/eigenvectors (matrix (2 0) (0 3)) 3)
; => ((vec 0 1))
```
```scheme
(linalg/eigenvectors (matrix (1 1) (0 1)) 2)
; => (escalate "no-eigenvectors" "no eigenvectors found for eigenvalue 2")
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/eigenvalues m)`
Eigenvalues via QR iteration (fuel-capped). Return: `(vec λ₁ λ₂ ... λₙ)` sorted ascending.
Honest-null: non-matrix → `nan`; non-square → `(escalate "not-square" ...)`; complex eigenvalues → `(escalate "complex-eigenvalues" ...)`; no convergence → `(escalate "fuel-exhausted" ...)`.
```scheme
(linalg/eigenvalues (matrix (2 0) (0 3)))
; => (vec 2 3)
```
```scheme
(linalg/eigenvalues (matrix (0 -1) (1 0)))
; => (escalate "complex-eigenvalues" "matrix has complex eigenvalues")
```
```scheme
(linalg/eigenvalues (matrix (1 2)))
; => (escalate "not-square" "eigenvalues require square matrix")
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/eigenvalues-3x3 m)`
Eigenvalues of 3×3 matrix via cubic formula. Return: `(vec λ₁ λ₂ λ₃)` sorted ascending.
Honest-null: non-3×3 matrix → `nan`; complex eigenvalues → `(escalate "complex-eigenvalues" ...)`.
```scheme
(linalg/eigenvalues-3x3 (matrix (6 -1 0) (-1 6 -1) (0 -1 6)))
; => (vec 4.585786438 6 7.414213562)
```
```scheme
(linalg/eigenvalues-3x3 (matrix (1 0 0) (0 2 0) (0 0 3)))
; => (vec 1 2 3)
```
```scheme
(linalg/eigenvalues-3x3 (matrix (1 2) (3 4)))
; => nan
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/gram-schmidt vs)`
Orthonormalize list of vectors. Return: list of orthonormal `(vec ...)`.
Honest-null: non-list or non-vectors → `nan`; mismatched dimensions → `nan`.
```scheme
(linalg/gram-schmidt ((vec 1 0) (vec 1 1)))
; => ((vec 1 0) (vec 0 1))
```
```scheme
(linalg/gram-schmidt ((vec 3 4)))
; => ((vec 0.6 0.8))
```
```scheme
(linalg/gram-schmidt ())
; => ()
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/is-invertible? m)`
Test if matrix is invertible. Return: `#t` or `#f`.
Honest-null: non-matrix → `nan`; non-square → `#f`.
```scheme
(linalg/is-invertible? (matrix (1 2) (3 4)))
; => #t
```
```scheme
(linalg/is-invertible? (matrix (1 2) (2 4)))
; => #f
```
```scheme
(linalg/is-invertible? (matrix (1 0 0) (0 1 0) (0 0 1)))
; => #t
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/is-orthogonal? m)`
Test if matrix is orthogonal. Return: `#t` or `#f`.
Honest-null: non-matrix → `nan`; non-square → `#f`.
```scheme
(linalg/is-orthogonal? (matrix (1 0) (0 1)))
; => #t
```
```scheme
(linalg/is-orthogonal? (matrix (0 -1) (1 0)))
; => #t
```
```scheme
(linalg/is-orthogonal? (matrix (1 2) (3 4)))
; => #f
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/is-symmetric? m)`
Test if matrix is symmetric. Return: `#t` or `#f`.
Honest-null: non-matrix → `nan`; non-square → `#f`.
```scheme
(linalg/is-symmetric? (matrix (1 2) (2 1)))
; => #t
```
```scheme
(linalg/is-symmetric? (matrix (1 2) (3 4)))
; => #f
```
```scheme
(linalg/is-symmetric? (matrix (5 0 0) (0 5 0) (0 0 5)))
; => #t
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/least-squares A b)`
Least-squares solution via normal equations. Return: `(vec x₁ x₂ ... xₙ)`.
Honest-null: non-matrix A or invalid b → `nan`; dimension mismatch → `nan`; rank-deficient → `(escalate "rank-deficient" ...)`.
```scheme
(linalg/least-squares (matrix (1 1) (1 2) (1 3)) (vec 1 2 3))
; => (vec -1 1)
```
```scheme
(linalg/least-squares (matrix (1 0) (0 1)) (vec 3 4))
; => (vec 3 4)
```
```scheme
(linalg/least-squares (matrix (1 1) (1 1)) (vec 1 2))
; => (escalate "rank-deficient" "normal equations matrix is singular")
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/lu m)`
LU factorization with partial pivoting. Return: `(lu (L matrix) (U matrix) (P matrix))`.
Honest-null: non-matrix → `nan`; non-square → `(escalate "not-square" ...)`; singular → `(escalate "singular" ...)`.
```scheme
(linalg/lu (matrix (2 1) (4 3)))
; => (lu (L (matrix (1 0) (0.5 1))) (U (matrix (4 3) (0 -0.5))) (P (matrix (0 1) (1 0))))
```
```scheme
(linalg/lu (matrix (1 2) (2 4)))
; => (escalate "singular" "matrix is singular or numerically unstable")
```
```scheme
(linalg/lu (matrix (1 0 0) (0 2 0) (0 0 3)))
; => (lu (L (matrix (1 0 0) (0 1 0) (0 0 1))) (U (matrix (1 0 0) (0 2 0) (0 0 3))) (P (matrix (1 0 0) (0 1 0) (0 0 1))))
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/matrix-power m k)`
Integer power of square matrix. Return: `(matrix ...)`.
Honest-null: non-matrix or non-integer → `nan`; non-square → `(escalate "not-square" ...)`; k<0 → `(escalate "not-implemented" ...)`.
```scheme
(linalg/matrix-power (matrix (2 0) (0 3)) 3)
; => (matrix (8 0) (0 27))
```
```scheme
(linalg/matrix-power (matrix (1 1) (0 1)) 0)
; => (matrix (1 0) (0 1))
```
```scheme
(linalg/matrix-power (matrix (2 0) (0 3)) -1)
; => (escalate "not-implemented" "negative powers require matrix inverse")
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/null-space m)`
Basis for null space. Return: list of `(vec ...)` basis vectors.
Honest-null: non-matrix → `nan`; malformed matrix → `nan`.
```scheme
(linalg/null-space (matrix (1 2) (2 4)))
; => ((vec -2 1))
```
```scheme
(linalg/null-space (matrix (1 0) (0 1)))
; => ()
```
```scheme
(linalg/null-space (matrix (1 1 1) (2 2 2)))
; => ((vec -1 1 0) (vec -1 0 1))
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/project u onto)`
Project vector onto vector or column space. Return: `(vec ...)`.
Honest-null: invalid types → `nan`; dimension mismatch → `nan`; zero target → `(escalate "degenerate" ...)`; rank-deficient subspace → `(escalate "rank-deficient" ...)`.
```scheme
(linalg/project (vec 1 2) (vec 3 4))
; => (vec 1.32 1.76)
```
```scheme
(linalg/project (vec 1 1) (vec 0 0))
; => (escalate "degenerate" "cannot project onto zero vector")
```
```scheme
(linalg/project (vec 1 2 3) (matrix (1 0) (0 1) (0 0)))
; => (vec 1 2 0)
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/qr m)`
QR factorization. Return: `(qr (Q matrix) (R matrix))`.
Honest-null: non-matrix → `nan`; malformed → `nan`; degenerate → `(escalate "degenerate" ...)`.
```scheme
(linalg/qr (matrix (1 1) (0 1)))
; => (qr (Q (matrix (1 0) (0 1))) (R (matrix (1 1) (0 1))))
```
```scheme
(linalg/qr (matrix (3 0) (4 0)))
; => (escalate "degenerate" "matrix has no independent columns")
```
```scheme
(linalg/qr (matrix (1 0 0) (0 1 0) (0 0 1)))
; => (qr (Q (matrix (1 0 0) (0 1 0) (0 0 1))) (R (matrix (1 0 0) (0 1 0) (0 0 1))))
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

#### `(linalg/svd m)`
Singular value decomposition (escalates not-implemented). Return: never returns successfully.
Honest-null: always → `(escalate "not-implemented" ...)`.
```scheme
(linalg/svd (matrix (1 2) (3 4)))
; => (escalate "not-implemented" "full SVD not numerically stable without external library; use QR or eigendecomposition")
```
```scheme
(linalg/svd (matrix (1 0) (0 1)))
; => (escalate "not-implemented" "full SVD not numerically stable without external library; use QR or eigendecomposition")
```
```scheme
(linalg/svd (matrix (2)))
; => (escalate "not-implemented" "full SVD not numerically stable without external library; use QR or eigendecomposition")
```
Wired: `installMathToolkitLinAlgFactorVerbs` (mathToolkitLinAlgFactorVerbs.js).

### 20.5 Number Representation & Constants

#### `(const/e)`
Euler's number e ≈ 2.71828. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/e)              ; => 2.718281828459045
```
```scheme
(const/e)              ; => 2.718281828459045
```
```scheme
(const/e)              ; => 2.718281828459045
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(const/ln10)`
Natural logarithm of 10 ≈ 2.30258. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/ln10)           ; => 2.302585092994046
```
```scheme
(const/ln10)           ; => 2.302585092994046
```
```scheme
(const/ln10)           ; => 2.302585092994046
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(const/ln2)`
Natural logarithm of 2 ≈ 0.69314. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/ln2)            ; => 0.6931471805599453
```
```scheme
(const/ln2)            ; => 0.6931471805599453
```
```scheme
(const/ln2)            ; => 0.6931471805599453
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(const/phi)`
Golden ratio φ ≈ 1.61803. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/phi)            ; => 1.618033988749895
```
```scheme
(const/phi)            ; => 1.618033988749895
```
```scheme
(const/phi)            ; => 1.618033988749895
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(const/pi)`
π ≈ 3.14159. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/pi)             ; => 3.141592653589793
```
```scheme
(const/pi)             ; => 3.141592653589793
```
```scheme
(const/pi)             ; => 3.141592653589793
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(const/sqrt2)`
√2 ≈ 1.41421. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/sqrt2)          ; => 1.4142135623730951
```
```scheme
(const/sqrt2)          ; => 1.4142135623730951
```
```scheme
(const/sqrt2)          ; => 1.4142135623730951
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(const/sqrt3)`
√3 ≈ 1.73205. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/sqrt3)          ; => 1.7320508075688772
```
```scheme
(const/sqrt3)          ; => 1.7320508075688772
```
```scheme
(const/sqrt3)          ; => 1.7320508075688772
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(const/tau)`
τ = 2π ≈ 6.28318. Return: `number`.
Honest-null: No domain failures; always returns the constant.
```scheme
(const/tau)            ; => 6.283185307179586
```
```scheme
(const/tau)            ; => 6.283185307179586
```
```scheme
(const/tau)            ; => 6.283185307179586
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/area-model a b)`
Partial-products spec for 2-digit × 2-digit multiplication. Return: `(area-model (a A) (b B) (parts [[p1 p2] [p3 p4]]))`.
Honest-null: `nan` if non-integer or outside [10,99]; no escalate paths.
```scheme
(math/area-model 23 15)  ; => (area-model (a 23) (b 15) (parts ((200 60) (50 15))))
```
```scheme
(math/area-model 12 34)  ; => (area-model (a 12) (b 34) (parts ((300 60) (20 4))))
```
```scheme
(math/area-model 5 10)   ; => nan
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/array rows cols)`
Array model spec with rows, cols, and total. Return: `(array (rows R) (cols C) (total T))`.
Honest-null: `nan` if non-integer or negative; no escalate paths.
```scheme
(math/array 3 4)       ; => (array (rows 3) (cols 4) (total 12))
```
```scheme
(math/array 0 5)       ; => (array (rows 0) (cols 5) (total 0))
```
```scheme
(math/array 2.5 3)     ; => nan
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/compare a b)`
Compare two numbers, returning symbol. Return: `<` or `=` or `>`.
Honest-null: `nan` if either argument is not a number; no escalate paths.
```scheme
(math/compare 5 3)     ; => >
```
```scheme
(math/compare 2 2)     ; => =
```
```scheme
(math/compare 1 7)     ; => <
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/count-on start n)`
List from start to start+n inclusive. Return: `[start start+1 ... start+n]`.
Honest-null: `nan` if non-integer or n<0; no escalate paths.
```scheme
(math/count-on 3 4)    ; => (3 4 5 6 7)
```
```scheme
(math/count-on 10 0)   ; => (10)
```
```scheme
(math/count-on 5 -1)   ; => nan
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/digit-at n place)`
Digit of n at 10^place (0-indexed from right). Return: `digit`.
Honest-null: `nan` if non-integer or place<0; no escalate paths.
```scheme
(math/digit-at 253 0)  ; => 3
```
```scheme
(math/digit-at 253 2)  ; => 2
```
```scheme
(math/digit-at 42 5)   ; => 0
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/exp x)`
e^x (inexact float). Return: `number`.
Honest-null: `nan` if non-number; `(escalate overflow ...)` if result is infinite.
```scheme
(math/exp 1)           ; => 2.718281828459045
```
```scheme
(math/exp 0)           ; => 1
```
```scheme
(math/exp 1000)        ; => (escalate overflow "exponential overflow")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/expanded-form n)`
List of place-values: 253 → (200 50 3). Return: `[place-values...]`.
Honest-null: `nan` if non-integer or negative; no escalate paths.
```scheme
(math/expanded-form 253)  ; => (200 50 3)
```
```scheme
(math/expanded-form 0)    ; => (0)
```
```scheme
(math/expanded-form 1007) ; => (1000 7)
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/fraction-bar num den)`
Fraction-bar spec with num, den, shaded. Return: `(fraction-bar (num N) (den D) (shaded N))`.
Honest-null: `nan` if non-integer or negative; `(escalate divide-by-zero ...)` if den=0.
```scheme
(math/fraction-bar 3 4)   ; => (fraction-bar (num 3) (den 4) (shaded 3))
```
```scheme
(math/fraction-bar 0 5)   ; => (fraction-bar (num 0) (den 5) (shaded 0))
```
```scheme
(math/fraction-bar 2 0)   ; => (escalate divide-by-zero "denominator is 0")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/integer-line lo hi)`
Number-line spec spanning negatives with integer marks. Return: `(number-line (lo L) (hi H) (step 1) (marks [...]))`.
Honest-null: `nan` if non-integer; `(escalate invalid-range ...)` if lo≥hi.
```scheme
(math/integer-line -5 5)   ; => (number-line (lo -5) (hi 5) (step 1) (marks (-5 -4 -3 -2 -1 0 1 2 3 4 5)))
```
```scheme
(math/integer-line 0 3)    ; => (number-line (lo 0) (hi 3) (step 1) (marks (0 1 2 3)))
```
```scheme
(math/integer-line 5 5)    ; => (escalate invalid-range "lo must be < hi")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/log x)`
Natural logarithm; x≤0 escalates. Return: `number`.
Honest-null: `nan` if non-number; `(escalate domain ...)` if x≤0.
```scheme
(math/log 2.718281828459045)  ; => 1
```
```scheme
(math/log 1)           ; => 0
```
```scheme
(math/log -1)          ; => (escalate domain "log requires positive argument")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/log-base b x)`
Logarithm base b of x. Return: `number`.
Honest-null: `nan` if non-number; `(escalate domain ...)` if x≤0 or b≤0 or b=1.
```scheme
(math/log-base 2 8)    ; => 3
```
```scheme
(math/log-base 10 100) ; => 2
```
```scheme
(math/log-base 1 10)   ; => (escalate domain "base must be positive and not 1")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/log10 x)`
Logarithm base 10. Return: `number`.
Honest-null: `nan` if non-number; `(escalate domain ...)` if x≤0.
```scheme
(math/log10 100)       ; => 2
```
```scheme
(math/log10 1000)      ; => 3
```
```scheme
(math/log10 0)         ; => (escalate domain "log10 requires positive argument")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/log2 x)`
Logarithm base 2. Return: `number`.
Honest-null: `nan` if non-number; `(escalate domain ...)` if x≤0.
```scheme
(math/log2 8)          ; => 3
```
```scheme
(math/log2 1024)       ; => 10
```
```scheme
(math/log2 -5)         ; => (escalate domain "log2 requires positive argument")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/number-line lo hi step marks)`
Number-line spec with lo, hi, step, and marks list. Return: `(number-line (lo L) (hi H) (step S) (marks [...]))`.
Honest-null: `nan` if non-number; `(escalate invalid-step ...)` if step≤0; `(escalate invalid-range ...)` if lo≥hi.
```scheme
(math/number-line 0 10 1 (list 0 5 10))  ; => (number-line (lo 0) (hi 10) (step 1) (marks (0 5 10)))
```
```scheme
(math/number-line 0 1 0.25 (list 0 0.5 1))  ; => (number-line (lo 0) (hi 1) (step 0.25) (marks (0 0.5 1)))
```
```scheme
(math/number-line 5 5 1 ())  ; => (escalate invalid-range "lo must be < hi")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/pow b e)`
General power b^e (inexact float). Return: `number`.
Honest-null: `nan` if non-number; `(escalate overflow ...)` if infinite; `(escalate domain ...)` if result is NaN.
```scheme
(math/pow 2 3)         ; => 8
```
```scheme
(math/pow 10 -2)       ; => 0.01
```
```scheme
(math/pow -1 0.5)      ; => (escalate domain "invalid base/exponent combination")
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/ratio-bar a b)`
Ratio-bar spec for a:b with total. Return: `(ratio-bar (a A) (b B) (total T))`.
Honest-null: `nan` if non-integer or negative; no escalate paths.
```scheme
(math/ratio-bar 3 5)   ; => (ratio-bar (a 3) (b 5) (total 8))
```
```scheme
(math/ratio-bar 0 10)  ; => (ratio-bar (a 0) (b 10) (total 10))
```
```scheme
(math/ratio-bar 2 -3)  ; => nan
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/round-half-up x places)`
Round x to places decimals using half-up rule. Return: `number`.
Honest-null: `nan` if non-number or places non-integer or places<0; no escalate paths.
```scheme
(math/round-half-up 3.456 2)  ; => 3.46
```
```scheme
(math/round-half-up 2.5 0)    ; => 3
```
```scheme
(math/round-half-up 7.891 1)  ; => 7.9
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

#### `(math/skip-count start step count)`
List of count multiples: start, start+step, ..., start+(count-1)*step. Return: `[values...]`.
Honest-null: `nan` if non-integer, count<0, or step=0; no escalate paths.
```scheme
(math/skip-count 2 3 5)  ; => (2 5 8 11 14)
```
```scheme
(math/skip-count 10 -2 4)  ; => (10 8 6 4)
```
```scheme
(math/skip-count 5 0 3)  ; => nan
```
Wired: `installMathToolkitRepresentationVerbs` (mathToolkitRepresentationVerbs.js).

### 20.6 Equation Solvers

#### `(solve/completing-square a b c)`
Convert ax²+bx+c to vertex form a(x-h)²+k. Return: `(vertex-form (a A) (h H) (k K))`.
Honest-null: non-numeric inputs → `nan`; a=0 → `(escalate "not-quadratic" "coefficient a is zero")`.
```scheme
(solve/completing-square 2 8 3)     ; => (vertex-form (a 2) (h -2.0) (k -5.0))
```
```scheme
(solve/completing-square 1 -4 3)    ; => (vertex-form (a 1) (h 2.0) (k -1.0))
```
```scheme
(solve/completing-square 0 5 2)     ; => (escalate "not-quadratic" "coefficient a is zero")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/distance p1 p2)`
Euclidean distance between two points. Return: numeric distance.
Honest-null: non-point inputs → `nan`.
```scheme
(solve/distance (point (x 0) (y 0)) (point (x 3) (y 4)))  ; => 5.0
```
```scheme
(solve/distance (point (x 1) (y 2)) (point (x 4) (y 6)))  ; => 5.0
```
```scheme
(solve/distance 5 10)               ; => nan
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/interest p r n t)`
Compound interest A=p(1+r/n)^(nt). Return: `(interest (amount A) (gained G))`.
Honest-null: non-numeric or negative inputs → `nan`; n=0 → `(escalate "divide-by-zero" "n (compounds per period) is zero")`.
```scheme
(solve/interest 1000 0.05 4 10)     ; => (interest (amount 1643.619) (gained 643.619))
```
```scheme
(solve/interest 500 0.03 12 5)      ; => (interest (amount 580.914) (gained 80.914))
```
```scheme
(solve/interest 1000 0.05 0 10)     ; => (escalate "divide-by-zero" "n (compounds per period) is zero")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/linear a b)`
Solve ax+b=0 for x. Return: `(solution (x X))`.
Honest-null: non-numeric inputs → `nan`; a=0 and b=0 → `(escalate "no-unique-solution" "identity 0=0")`; a=0 and b≠0 → `(escalate "no-unique-solution" "contradiction")`.
```scheme
(solve/linear 2 -6)                 ; => (solution (x 3.0))
```
```scheme
(solve/linear 5 10)                 ; => (solution (x -2.0))
```
```scheme
(solve/linear 0 0)                  ; => (escalate "no-unique-solution" "identity 0=0")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/midpoint p1 p2)`
Midpoint of line segment between two points. Return: `(point (x X) (y Y))`.
Honest-null: non-point inputs → `nan`.
```scheme
(solve/midpoint (point (x 0) (y 0)) (point (x 4) (y 6)))  ; => (point (x 2.0) (y 3.0))
```
```scheme
(solve/midpoint (point (x 1) (y 2)) (point (x 2) (y 4)))  ; => (point (x 1.5) (y 3.0))
```
```scheme
(solve/midpoint 10 20)              ; => nan
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/percent-change old-val new-val)`
Fractional and percent change from old to new. Return: `(change (percent P) (fraction F))`.
Honest-null: non-numeric inputs → `nan`; old-val=0 → `(escalate "divide-by-zero" "old value is zero")`.
```scheme
(solve/percent-change 50 60)        ; => (change (percent 20.0) (fraction 0.2))
```
```scheme
(solve/percent-change 100 80)       ; => (change (percent -20.0) (fraction -0.2))
```
```scheme
(solve/percent-change 0 50)         ; => (escalate "divide-by-zero" "old value is zero")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/proportion a b c)`
Solve a/b = c/x for x. Return: `(solution (x X))`.
Honest-null: non-numeric inputs → `nan`; b=0 → `(escalate "divide-by-zero" "b is zero")`; a=0 → `(escalate "divide-by-zero" "a is zero, x would be infinite")`.
```scheme
(solve/proportion 3 4 6)            ; => (solution (x 8.0))
```
```scheme
(solve/proportion 5 10 15)          ; => (solution (x 30.0))
```
```scheme
(solve/proportion 0 4 6)            ; => (escalate "divide-by-zero" "a is zero, x would be infinite")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/pythagorean-triple? a b c)`
Test if three numbers form Pythagorean triple (order-independent). Return: boolean.
Honest-null: non-numeric inputs → `nan`; non-positive inputs → `false`.
```scheme
(solve/pythagorean-triple? 3 4 5)   ; => true
```
```scheme
(solve/pythagorean-triple? 5 4 3)   ; => true
```
```scheme
(solve/pythagorean-triple? 1 2 3)   ; => false
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/quadratic a b c)`
Solve ax²+bx+c=0, return discriminant, nature, roots. Return: `(quadratic (a A) (b B) (c C) (discriminant D) (nature NATURE) (roots ROOTS))` where NATURE is `two-real`, `one-real`, or `complex`; ROOTS is a list of numbers or `(complex (re R) (im I))` forms.
Honest-null: non-numeric inputs → `nan`; a=0 → `(escalate "not-quadratic" "coefficient a is zero")`.
```scheme
(solve/quadratic 1 -3 2)            ; => (quadratic (a 1) (b -3) (c 2) (discriminant 1.0) (nature two-real) (roots (2.0 1.0)))
```
```scheme
(solve/quadratic 1 -2 1)            ; => (quadratic (a 1) (b -2) (c 1) (discriminant 0.0) (nature one-real) (roots (1.0)))
```
```scheme
(solve/quadratic 1 0 1)             ; => (quadratic (a 1) (b 0) (c 1) (discriminant -4.0) (nature complex) (roots ((complex (re 0.0) (im 1.0)) (complex (re 0.0) (im -1.0)))))
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/slope-intercept p1 p2)`
Find slope m and intercept b from two points (y = mx + b). Return: `(line (m M) (b B))`.
Honest-null: non-point inputs → `nan`; vertical line (x₁=x₂) → `(escalate "vertical-line" "undefined slope")`.
```scheme
(solve/slope-intercept (point (x 0) (y -1)) (point (x 1) (y 1)))  ; => (line (m 2.0) (b -1.0))
```
```scheme
(solve/slope-intercept (point (x 1) (y 2)) (point (x 3) (y 6)))   ; => (line (m 2.0) (b 0.0))
```
```scheme
(solve/slope-intercept (point (x 2) (y 3)) (point (x 2) (y 5)))   ; => (escalate "vertical-line" "undefined slope")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/system-2x2 a b c d e f)`
Solve 2×2 linear system ax+by=c, dx+ey=f. Return: `(solution (x X) (y Y))`.
Honest-null: non-numeric inputs → `nan`; determinant=0 → `(escalate "singular" "determinant is zero")`.
```scheme
(solve/system-2x2 2 3 5 1 -1 2)     ; => (solution (x 1.727) (y 0.545))
```
```scheme
(solve/system-2x2 1 1 3 2 -1 1)     ; => (solution (x 1.333) (y 1.667))
```
```scheme
(solve/system-2x2 1 2 3 2 4 6)      ; => (escalate "singular" "determinant is zero")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/unit-circle theta)`
Cos, sin, tan for angle theta (radians) on unit circle. Return: `(unit-point (cos C) (sin S) (tan T))` or `(unit-point (cos C) (sin S) (escalate "asymptote" "tangent undefined"))` when tangent is undefined.
Honest-null: non-numeric input → `nan`; theta at π/2 + kπ → tan slot is `(escalate "asymptote" "tangent undefined")`.
```scheme
(solve/unit-circle 0.785398)        ; => (unit-point (cos 0.707) (sin 0.707) (tan 1.0))
```
```scheme
(solve/unit-circle 0)               ; => (unit-point (cos 1.0) (sin 0.0) (tan 0.0))
```
```scheme
(solve/unit-circle 1.570796)        ; => (unit-point (cos 0.0) (sin 1.0) (escalate "asymptote" "tangent undefined"))
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

#### `(solve/vertex a b c)`
Find vertex and axis of symmetry of parabola ax²+bx+c. Return: `(vertex (point (point (x H) (y K))) (axis H))`.
Honest-null: non-numeric inputs → `nan`; a=0 → `(escalate "not-quadratic" "coefficient a is zero")`.
```scheme
(solve/vertex 1 -4 3)               ; => (vertex (point (point (x 2.0) (y -1.0))) (axis 2.0))
```
```scheme
(solve/vertex 2 4 1)                ; => (vertex (point (point (x -1.0) (y -1.0))) (axis -1.0))
```
```scheme
(solve/vertex 0 3 5)                ; => (escalate "not-quadratic" "coefficient a is zero")
```
Wired: `installMathToolkitSolverVerbs` (mathToolkitSolverVerbs.js).

### 20.7 Exact Arithmetic (Rational Tower)

#### `(exact// a b)`
Exact quotient a ÷ b. Return: `(rat (n N) (d D))`.
Honest-null: non-rational operand → `nan`; b = 0 → `(escalate "divide-by-zero" ...)`.
```scheme
(exact// (exact/rat 1 2) (exact/rat 1 4))  ; => (rat (n 2) (d 1))
```
```scheme
(exact// 5 0)                               ; => (escalate "divide-by-zero" "exact division by 0")
```
```scheme
(exact// 7 2)                               ; => (rat (n 7) (d 2))
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/* a b)`
Exact product. Return: `(rat (n N) (d D))`.
Honest-null: non-rational operand → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(exact/* (exact/rat 2 3) (exact/rat 3 4))  ; => (rat (n 1) (d 2))
```
```scheme
(exact/* 5 7)                               ; => (rat (n 35) (d 1))
```
```scheme
(exact/* 3.5 2)                             ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/+ a b)`
Exact sum. Return: `(rat (n N) (d D))`.
Honest-null: non-rational operand → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(exact/+ (exact/rat 1 3) (exact/rat 1 6))  ; => (rat (n 1) (d 2))
```
```scheme
(exact/+ 2 3)                               ; => (rat (n 5) (d 1))
```
```scheme
(exact/+ 1.5 2)                             ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/- a b)`
Exact difference. Return: `(rat (n N) (d D))`.
Honest-null: non-rational operand → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(exact/- (exact/rat 5 6) (exact/rat 1 3))  ; => (rat (n 1) (d 2))
```
```scheme
(exact/- 7 3)                               ; => (rat (n 4) (d 1))
```
```scheme
(exact/- 2.5 1)                             ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/->float a)`
Float value n/d; escape hatch to inexact world. Return: `<number>`.
Honest-null: non-rational → `nan`.
```scheme
(exact/->float (exact/rat 1 2))            ; => 0.5
```
```scheme
(exact/->float (exact/rat 1 3))            ; => 0.3333333333333333
```
```scheme
(exact/->float "text")                      ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/->mixed a)`
Improper rational to mixed-number a-list. Return: `(mixed-number (whole W) (num N) (den D) (sign S))`.
Honest-null: non-rational → `nan`.
```scheme
(exact/->mixed (exact/rat 7 3))            ; => (mixed-number (whole 2) (num 1) (den 3) (sign 1))
```
```scheme
(exact/->mixed (exact/rat -5 2))           ; => (mixed-number (whole 2) (num 1) (den 2) (sign -1))
```
```scheme
(exact/->mixed 3.7)                         ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/->string a)`
Human string "n/d" or "n" when denominator is 1. Return: `<string>`.
Honest-null: non-rational → `nan`.
```scheme
(exact/->string (exact/rat 6 4))           ; => "3/2"
```
```scheme
(exact/->string (exact/rat 5 1))           ; => "5"
```
```scheme
(exact/->string 2.5)                        ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/< a b)`
Exact rational less-than. Return: `<boolean>`.
Honest-null: non-rational operand → `nan`.
```scheme
(exact/< (exact/rat 1 3) (exact/rat 1 2))  ; => #t
```
```scheme
(exact/< 5 3)                               ; => #f
```
```scheme
(exact/< 2.5 3)                             ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/<= a b)`
Exact rational ≤. Return: `<boolean>`.
Honest-null: non-rational operand → `nan`.
```scheme
(exact/<= (exact/rat 2 4) (exact/rat 1 2)) ; => #t
```
```scheme
(exact/<= 3 5)                              ; => #t
```
```scheme
(exact/<= 1.5 2)                            ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/= a b)`
Exact equality. Return: `<boolean>`.
Honest-null: non-rational operand → `nan`.
```scheme
(exact/= (exact/rat 2 4) (exact/rat 1 2))  ; => #t
```
```scheme
(exact/= 3 3)                               ; => #t
```
```scheme
(exact/= 1.5 (exact/rat 3 2))              ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/> a b)`
Exact rational greater-than. Return: `<boolean>`.
Honest-null: non-rational operand → `nan`.
```scheme
(exact/> (exact/rat 2 3) (exact/rat 1 2))  ; => #t
```
```scheme
(exact/> 7 4)                               ; => #t
```
```scheme
(exact/> 3.5 2)                             ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/>= a b)`
Exact rational ≥. Return: `<boolean>`.
Honest-null: non-rational operand → `nan`.
```scheme
(exact/>= (exact/rat 1 2) (exact/rat 2 4)) ; => #t
```
```scheme
(exact/>= 5 5)                              ; => #t
```
```scheme
(exact/>= 2.5 3)                            ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/abs a)`
Magnitude |a|. Return: `(rat (n N) (d D))`.
Honest-null: non-rational → `nan`.
```scheme
(exact/abs (exact/rat -3 4))               ; => (rat (n 3) (d 4))
```
```scheme
(exact/abs -5)                              ; => (rat (n 5) (d 1))
```
```scheme
(exact/abs 2.5)                             ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/denominator a)`
Reduced denominator (positive integer). Return: `<integer>`.
Honest-null: non-rational → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(exact/denominator (exact/rat 6 8))        ; => 4
```
```scheme
(exact/denominator 5)                       ; => 1
```
```scheme
(exact/denominator 3.5)                     ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/inverse a)`
Reciprocal 1/a. Return: `(rat (n N) (d D))`.
Honest-null: non-rational → `nan`; a = 0 → `(escalate "divide-by-zero" ...)`.
```scheme
(exact/inverse (exact/rat 3 4))            ; => (rat (n 4) (d 3))
```
```scheme
(exact/inverse 0)                           ; => (escalate "divide-by-zero" "reciprocal of 0")
```
```scheme
(exact/inverse 5)                           ; => (rat (n 1) (d 5))
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/neg a)`
Additive inverse -a. Return: `(rat (n N) (d D))`.
Honest-null: non-rational → `nan`.
```scheme
(exact/neg (exact/rat 3 4))                ; => (rat (n -3) (d 4))
```
```scheme
(exact/neg -5)                              ; => (rat (n 5) (d 1))
```
```scheme
(exact/neg 2.5)                             ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/numerator a)`
Reduced numerator (sign-carrying integer). Return: `<integer>`.
Honest-null: non-rational → `nan`; overflow → `(escalate "exact-overflow" ...)`.
```scheme
(exact/numerator (exact/rat 6 8))          ; => 3
```
```scheme
(exact/numerator (exact/rat -4 2))         ; => -2
```
```scheme
(exact/numerator 3.5)                       ; => nan
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).

#### `(exact/rat n d)`
Construct reduced rational n/d. Return: `(rat (n N) (d D))`.
Honest-null: non-integer operand → `nan`; d = 0 → `(escalate "divide-by-zero" ...)`.
```scheme
(exact/rat 2 4)                             ; => (rat (n 1) (d 2))
```
```scheme
(exact/rat 5 0)                             ; => (escalate "divide-by-zero" "rational denominator is 0")
```
```scheme
(exact/rat 7 1)                             ; => (rat (n 7) (d 1))
```
Wired: `installMathToolkitExactVerbs` (mathToolkitExactVerbs.js).
---

## 21. 2026-07-05 roll-up · the 1·3·5 ladder support verbs (#707)

The concept-ladder pilot (`docs/verb-ladder-card-slim.record.json`, concept
`cortex/recall`) needed a small vocabulary of pure sequence/time helpers and a
few honest sinks/sources so its three rungs *resolve against the live verb
universe* — the ladder must never invent a verb. These twelve were added to
`curator-web/src/scheme/base.js` (the production language layer,
`makeBaseEnv`). The pure ones carry real deterministic bodies; the
not-yet-backed sinks/sources return the honest `'service-not-yet-wired`
escalation rather than silent-successing a no-op.

### 21.1 `time/hours` · `time/elapsed` — numeric time siblings

`time/relative` and `time/since` (§16.2) return *spoken* strings — good for a
persona line, useless for a comparison. These two are the numeric siblings a
program uses to actually decide "was this within the last day?".

| Verb | Signature → result | Backing | Wired |
|---|---|---|---|
| `time/hours` | `(time/hours 24) → 86400000` (count → ms) | `curator-web/src/scheme/base.js:746` | **yes** (pure) |
| `time/elapsed` | `(time/elapsed ts) → now − ts` (raw signed ms) | `curator-web/src/scheme/base.js:747` | **yes** (pure) |

1. _(novice)_ how many ms is a day:
   ```scheme
   (time/hours 24)                       ; => 86400000
   ```
2. _(intermediate)_ has a stamp aged past an hour:
   ```scheme
   (> (time/elapsed then) (time/hours 1))
   ```
3. _(expert)_ a numeric recency predicate (the rung-3 gate):
   ```scheme
   (define (recent? m)
     (< (time/elapsed (memo-time m)) (time/hours 24)))
   ```

### 21.2 `list/filter` · `list/take` · `list/realize` — eager sequence ops

Namespaced siblings of the free `filter`/`map`. `list/realize` forces a lazy
stream/window into a concrete list at a boundary you can *see*, so the lazy
and eager halves never tangle. All total — a non-list degrades to `'()`.

| Verb | Signature → result | Backing | Wired |
|---|---|---|---|
| `list/filter` | `(list/filter pred lst)` → matches kept | `curator-web/src/scheme/base.js:754` | **yes** (pure) |
| `list/take` | `(list/take lst n)` → first n | `curator-web/src/scheme/base.js:756` | **yes** (pure) |
| `list/realize` | `(list/realize stream-or-window)` → forced list | `curator-web/src/scheme/base.js:758` | **yes** (pure) |

1. _(novice)_ keep the positives:
   ```scheme
   (list/filter (lambda (x) (> x 0)) '(-1 2 -3 4))   ; => (2 4)
   ```
2. _(intermediate)_ the first three of a forced window:
   ```scheme
   (list/take (list/realize window) 3)
   ```
3. _(expert)_ force a lazy window, drop blanks, keep the recent, take three:
   ```scheme
   (define forced  (list/realize window))
   (define present (list/filter has-text? forced))
   (define fresh   (list/filter recent? present))
   (define top     (list/take fresh 3))
   ```

### 21.3 `stream/unfold` · `stream/take` — lazy sequences

A stream is *described, not run*. `stream/unfold` names a generator + a seed
cursor; `stream/take` marks how far we're willing to walk; nothing executes
until `list/realize` forces it. The generator is called with the current
cursor and returns a `(value . next-cursor)` pair, or a non-pair (null /
honest-null escalate) to end. A hard realize cap (`STREAM_CAP = 4096`)
guarantees a forced stream can never spin forever.

| Verb | Signature → result | Backing | Wired |
|---|---|---|---|
| `stream/unfold` | `(stream/unfold gen seed)` → lazy stream | `curator-web/src/scheme/base.js:767` | **yes** (pure) |
| `stream/take` | `(stream/take stream n)` → capped lazy window | `curator-web/src/scheme/base.js:768` | **yes** (pure) |

1. _(novice)_ describe (don't run) a countdown stream:
   ```scheme
   (stream/unfold (lambda (n) (if (< n 0) '() (cons n (- n 1)))) 5)
   ```
2. _(intermediate)_ mark a 12-wide window — still not run:
   ```scheme
   (define window (stream/take chats 12))
   ```
3. _(expert)_ an unbounded newest-first stream over the chat graph:
   ```scheme
   (define chats
     (stream/unfold
       (lambda (cur) (cortex/recall-next :topic 'chats :cursor cur))
       (cortex/cursor :topic 'chats)))
   ```

### 21.4 `memo-text` · `memo-time` — memo accessors

A "memo" is whatever `cortex/recall` returns with `:with-time #t`. These read
its text and stamp structurally, tolerant of the several shapes the memory
layer may hand back (`text|value`, `time|ts|at`). Honest null when the field
is absent — never a fabricated stamp.

| Verb | Signature → result | Backing | Wired |
|---|---|---|---|
| `memo-text` | `(memo-text m)` → text \| value \| null | `curator-web/src/scheme/base.js:777` | **yes** (pure) |
| `memo-time` | `(memo-time m)` → time \| ts \| at \| null | `curator-web/src/scheme/base.js:780` | **yes** (pure) |

1. _(novice)_ read a memo's text:
   ```scheme
   (memo-text memo)                      ; => "ship the ladder cards" | null
   ```
2. _(intermediate)_ guard against a blank slot:
   ```scheme
   (define (has-text? m) (if (null? (memo-text m)) #f #t))
   ```
3. _(expert)_ fold a stamped memo into a friendly line:
   ```scheme
   (define (recap m)
     (string-append (time/relative (memo-time m)) ": " (memo-text m)))
   ```

### 21.5 `surface/say` · `cortex/cursor` · `cortex/recall-next` — ladder sinks/sources (honest-null)

The rung-2/3 sink and the lazy-recall cursor pair the rung-3 stream walks.
The ladder resolves these as *real verbs* so its programs parse and typecheck,
but their backends (a spoken surface, a Cortex cursor-stream) are not yet
wired — so each returns the honest `'service-not-yet-wired` escalation. A
program built on them degrades gracefully (an empty recall → "nothing recent"
line), never a fluent-wrong success.

| Verb | Signature | Backing | Wired |
|---|---|---|---|
| `surface/say` | `(surface/say text)` | `curator-web/src/scheme/base.js:806` | **no (honest escalator)** |
| `cortex/cursor` | `(cortex/cursor :topic X)` | `curator-web/src/scheme/base.js:807` | **no (honest escalator)** |
| `cortex/recall-next` | `(cortex/recall-next :topic X :cursor c)` | `curator-web/src/scheme/base.js:808` | **no (honest escalator)** |

1. _(novice)_ speak one line (returns escalate until the surface lands):
   ```scheme
   (surface/say "here's where we left off:")
   ```
2. _(intermediate)_ open a cursor and pull the next memo:
   ```scheme
   (cortex/recall-next :topic 'chats :cursor (cortex/cursor :topic 'chats))
   ```
3. _(expert)_ speak each of the top memos, degrade honestly on empty:
   ```scheme
   (for-each (lambda (m) (surface/say (recap m))) top)
   (if (null? top)
       (surface/say "…nothing recent. we're starting fresh.")
       (surface/say "anyway — back to it."))
   ```

---

## Approval

- **Soo-Jin** (author, Scheme composition lead): _signed 2026-06-15_
- **Architect** (approver): [vetoes any verb whose Backing claim is wrong]

Approval procedure: the Architect spot-checks 20 random entries; if
any of the 20 has a wrong file:line citation or a Source example that
no longer matches the cart, the Architect NACKs. Soo-Jin re-cites,
re-runs the lint pass, and re-submits.


---

# §META — Meta-Verbs (added 2026-07-11)

> Folded from `doc-expansion-staging/scheme-ref-metaverbs.md`.

Meta-verbs are verbs about verbs: `verb-help`, `verb-signature`, `verb-cost`, `verb-doc`, `verb-search`, `verb-list-by-tag`, `verb-owner`. They power Sakura's self-enumeration (`self_enumeration_scheme_spirit` memory) — the smart-language layer written as native homoiconic Scheme (metacircular/SICP lineage), not a bolted-on dashboard.

## The 11 artifact/* verbs (called out by Alfred)

- `artifact/open` — instantiate a clean-surface artifact
- `artifact/paint` — render content onto an open artifact
- `artifact/hitch` — bind the artifact to a service (see cards-hitch-services doctrine)
- `artifact/close` — dismiss an artifact (camera pulls back)
- `artifact/embed` — nest artifact-inside-artifact (frosted overlay)
- `artifact/frost` — apply watercolor frosting layer
- `artifact/handoff` — pass an artifact from one lane to another
- `artifact/query` — query the current artifact content
- `artifact/list` — enumerate open artifacts
- `artifact/style` — apply a clean-surface style profile
- `artifact/state` — read/write artifact-local state

Full artifact-verb ontology detail lives in `docs/artifact-verbs.md`. See also `HELLO-SURFACE-1.0.ENG.md` §ARTIFACT for the doctrine.

## Cross-reference to THE-BOOK

Every verb in this REF cross-references to its Row 4/5 chapter in THE-BOOK (`~/code/sakura-preservation-2026-07-11/THE-BOOK/`). REF is short-form 3-tier N/I/E; THE-BOOK is long-form Proof/Essence + Composition/Emergence. Zain flagged the drift-risk (Flag C in the consolidation plan); Alfred resolved 2026-07-11 that both survive with clear scope boundary.

---

# APPENDIX ERROR-TAXONOMY (folded from SCHEME-ERROR-TAXONOMY-2026-07-05.md)

> Full 45KB error taxonomy lives at `docs/SCHEME-ERROR-TAXONOMY-2026-07-05.md`. Cross-linked here; will be inlined in next revision.

# APPENDIX PRIM-COVERAGE (folded from primitive-coverage-2026-07-10.md)

> Primitive coverage matrix; full source `docs/primitive-coverage-2026-07-10.md`. Cross-linked.

---

# §SLAT — SLAT reader / writer / crypto verbs (added 2026-07-12)

> **Canonical wire spec.** `research/lacuna-docs/specs/SLAT-1.0.SPEC.md`.
> **Runtime doctrine.** `docs/engineering/SAKURA-SCHEME-1.0.ENG.md §SLAT`.
> **Voice.** N/I/E per-verb entries. Every verb ships with signature,
> contract, one runnable example, and the common error mode.
> **Backing.** JS reference at `bindings/js/slat.js`; Python parity at
> `bindings/python/slat/{reader,writer,jsonl,canonical,sign,merkle}.py`.

## §SLAT.0 — Verb roster

Thirteen verbs ship with SLAT 1.0. Six read/write, three canonical,
two signing, two attestation. Registered under the `slat/` namespace.

| Verb | Purpose |
|---|---|
| `slat/read` | Parse one slat text → runtime value. |
| `slat/write` | Serialize one value → slat text (default form). |
| `slat/load-doc` | Load one whole-document `.slat` from a path. |
| `slat/load` | Load a line-delimited `.slatl` as a stream. |
| `slat/append` | Append one record to a `.slatl` file. |
| `slat/tail` | Read the last N lines of a `.slatl` file. |
| `slat/canonical` | Canonicalize a value to its byte-stable form. |
| `slat/hash` | SHA-256 of the canonical bytes. |
| `slat/check` | Validate a record against a registered type. |
| `slat/sign` | Wrap a body in a `(signed …)` envelope. |
| `slat/verify` | Verify a `(signed …)` envelope. |
| `slat/merkle-root` | Merkle root over a set of slats. |
| `slat/merkle-verify` | Verify a Merkle attestation. |

---

## §SLAT.1 — `(slat/read text)`

**Returns:** the parsed runtime value; the shape matches SLAT SPEC
§3.1. Round-trips: `(equal? v (slat/read (slat/write v)))` for every
in-range `v`.
**Backing:** `bindings/js/slat.js:parseSlat` (JS reference).
**Side effects:** none. Does NOT execute.
**Wired:** yes (base primitives per SPEC §3.1; ten new primitives
land per SLAT SPEC §10.4 Weeks 1-2).

Contract: input MUST be a UTF-8 string containing exactly one slat
form (whole-document mode). Newlines permitted. Comments captured
into `_comment`. Bounds enforced (SLAT SPEC §5.3).

#### Novice
```scheme
(slat/read "(event :ts 1751500000 :kind \"card.opened\")")
;; → { _form: "event", ts: 1751500000, kind: "card.opened" }
```

#### Intermediate
```scheme
;; parse an incident narrative
(define nar
  (slat/read (file/read "docs/atoms/incident-narratives/in-1-042.slat")))
(car (assq :philosopher nar))
;; → 'freud
```

#### Expert
```scheme
;; strict-mode read: throw on bad line, do not recover
(catch 'slat-syntax-error
  (lambda () (slat/read raw :strict #t))
  (lambda (err) (escalate 'slat-parse-error err)))
```

**Common errors.**
- `slat-syntax-error :max-depth-exceeded` — nesting > 128.
- `slat-syntax-error :max-string-length` — one string > 1 MiB.
- `slat-syntax-error :fuel-exhausted` — total tokens > 10 million.

---

## §SLAT.2 — `(slat/write value [:canonical? #t])`

**Returns:** a UTF-8 string, one slat form.
**Backing:** `bindings/js/slat.js:writeSlat`.
**Side effects:** none.
**Wired:** yes.

Contract: `value` MUST be a value read by `slat/read` or built via
data constructors. Procedures, ports, continuations refuse (SLAT
SPEC §2.4). If `:canonical? #t`, output matches SLAT SPEC §6.1 byte
for byte.

#### Novice
```scheme
(slat/write '(event :ts 1751500000 :kind "card.opened"))
;; → "(event :kind \"card.opened\" :ts 1751500000)"    (canonical: keys sorted)
```

#### Intermediate
```scheme
;; write, then hash — content ID
(define bytes (slat/write my-event :canonical? #t))
(slat/hash bytes)
;; → #b64 "kx8f…"
```

#### Expert
```scheme
;; write a record with a bignum + instant + uuid
(slat/write
  `(measurement
    :id      #uuid "550e8400-e29b-41d4-a716-446655440000"
    :ts      #inst "2026-07-11T18:22:00Z"
    :counter 999999999999999999n
    :value   3.1415M))
```

**Common errors.**
- `slat-write-refused :type procedure` — cannot serialize.
- `slat-write-refused :type port` — cannot serialize.

---

## §SLAT.3 — `(slat/load-doc path)`

**Returns:** the whole-document parsed value.
**Backing:** `bindings/js/slat.js:loadDoc`.
**Side effects:** reads the file (I/O — permission-gated).
**Wired:** yes.

Contract: file MUST be `.slat` (whole-document); MUST contain zero
or one top-level record. Multi-line forms permitted. `_bad-line` NOT
applicable (whole-document mode fails hard).

#### Novice
```scheme
(slat/load-doc "docs/atoms/card-insides/chat/hello.slat")
```

#### Intermediate
```scheme
;; read + destructure
(let ((doc (slat/load-doc "docs/atoms/incident-narratives/in-1-042.slat")))
  (list (assq :philosopher doc) (assq :lesson doc)))
```

#### Expert
```scheme
;; walk a batch of incident narratives
(for-each
  (lambda (path)
    (let ((nar (slat/load-doc path)))
      (when (eq? (assq :philosopher nar) 'freud)
        (envelope-queue (list 'freud-lesson :lesson (assq :lesson nar))))))
  (glob "docs/atoms/incident-narratives/*.slat"))
```

**Common errors.**
- `slat-syntax-error :multi-top` — more than one top-level record.
- `file-not-found` — path missing.

---

## §SLAT.4 — `(slat/load path [:tolerant? #f])`

**Returns:** a lazy stream of parsed values (one per line).
**Backing:** `bindings/js/slat.js:loadStream`.
**Side effects:** reads the file lazily.
**Wired:** yes.

Contract: file MUST be `.slatl`. If `:tolerant? #t`, malformed lines
yield `_bad-line` sentinels; otherwise `slat-syntax-error`.

#### Novice
```scheme
;; grab the first 10 lines
(take (slat/load "~/.lacuna/logs/dispatch-2026-07-11.slatl") 10)
```

#### Intermediate
```scheme
;; filter for one caller-tier
(filter
  (lambda (line) (eq? (assq :caller-tier line) 'operator-gesture))
  (slat/load "~/.lacuna/logs/dispatch-2026-07-11.slatl"))
```

#### Expert
```scheme
;; tolerant read + track bad lines
(let-values (((good bad) (partition (lambda (v) (not (eq? (slat-head v) '_bad-line)))
                                    (slat/load path :tolerant? #t))))
  (when (> (length bad) 0)
    (envelope-queue `(system/slat-parse-errors :count ,(length bad) :path ,path)))
  good)
```

**Common errors.**
- `slat-syntax-error :multi-line-in-slatl` — strict mode + multi-line form.

---

## §SLAT.5 — `(slat/append path record)`

**Returns:** `#t` on success.
**Backing:** `bindings/js/slat.js:appendSlatl`.
**Side effects:** appends to the file. **`perm: state-change`**.
**Wired:** yes.

Contract: `record` MUST serialize to a single line (no newlines). File
MUST be `.slatl`. Append is atomic (POSIX write-through-hold).

#### Novice
```scheme
(slat/append "~/.lacuna/audits/inbox-opens.slatl"
             '(inbox-opened :ts 1751500000 :operator "shopkeeper-42"))
```

#### Intermediate
```scheme
;; append a chip-emit shape
(slat/append "~/.lacuna/logs/dispatch-today.slatl"
             `(event :ts ,(now-ms) :kind "card.opened"
                     :id ,(ctx-get 'card-id ctx)
                     :caller-tier operator-gesture))
```

#### Expert
```scheme
;; guarded append with a signature
(slat/append path (slat/sign record :as 'sakura))
```

**Common errors.**
- `slat-write-refused :multiline` — record contains a newline.
- `permission-denied` — caller lacks state-change perm.

---

## §SLAT.6 — `(slat/tail path n)`

**Returns:** a list of the last `n` parsed records.
**Backing:** `bindings/js/slat.js:tailSlatl`.
**Side effects:** reads the file.
**Wired:** yes.

Contract: bounded read from EOF backward; efficient for long log
files. `n` MUST be positive.

#### Novice
```scheme
(slat/tail "~/.lacuna/logs/dispatch-today.slatl" 5)
```

#### Intermediate
```scheme
;; last 20 errors only
(filter (lambda (r) (eq? (assq :status r) 'error))
        (slat/tail path 20))
```

#### Expert
```scheme
;; report the last minute of activity from a mailbox
(let* ((now  (now-ms))
       (last (slat/tail box 500))
       (recent (filter (lambda (r) (< (- now (assq :ts r)) 60000)) last)))
  (surface/say (list "in the last minute:" (length recent) "messages")))
```

---

## §SLAT.7 — `(slat/canonical value)`

**Returns:** the canonical UTF-8 byte string per SLAT SPEC §6.1.
**Backing:** `bindings/js/slat.js:canonicalize`.
**Side effects:** none.
**Wired:** yes.

Contract: bit-stable across JS and Python bindings (CI-gated at
`sakura-scheme/tests/vectors.slat`).

#### Novice
```scheme
(slat/canonical '(event :b 2 :a 1))
;; → "(event :a 1 :b 2)"   ; keys sorted
```

#### Intermediate
```scheme
;; canonical + hash — the content ID
(let ((c (slat/canonical rec)))
  (list :cid (slat/hash c) :size (bytes-length c)))
```

#### Expert
```scheme
;; verify two records deep-equal-under-canonical
(equal? (slat/canonical a) (slat/canonical b))
```

---

## §SLAT.8 — `(slat/hash value-or-bytes)`

**Returns:** SHA-256 digest as `#b64 "…"`.
**Backing:** `bindings/js/slat.js:contentHash`.
**Side effects:** none.
**Wired:** yes.

Contract: if the input is a Scheme value, canonicalize first; if it's
already bytes, hash directly.

#### Novice
```scheme
(slat/hash '(event :kind "card.opened"))
;; → #b64 "kx8f…"
```

#### Intermediate
```scheme
;; dedup a batch by content ID
(delete-duplicates records (lambda (a b) (equal? (slat/hash a) (slat/hash b))))
```

#### Expert
```scheme
;; cache lookup keyed by content ID
(define (cortex-cache-get rec)
  (cortex/recall :topic 'slat-cache :key (slat/hash rec)))
```

---

## §SLAT.9 — `(slat/check :type type-sym record)`

**Returns:** a `(check-result :pass ? :missing (…) :type-errors (…)
:extras (…))` slat-record.
**Backing:** `bindings/js/slat.js:checkRecord`.
**Side effects:** none.
**Wired:** yes.

Contract: `type-sym` MUST be a registered slat-type per SLAT SPEC
§7.4. Returns structured errors; consumers pattern-match.

#### Novice
```scheme
(slat/check :type 'event my-record)
;; → (check-result :pass #t :missing () :type-errors () :extras ())
```

#### Intermediate
```scheme
(let ((r (slat/check :type 'automation my-cart-header)))
  (if (assq :pass r)
      (next 'proceed ctx)
      (escalate 'invalid-cart-header r)))
```

#### Expert
```scheme
;; validate all incident narratives at boot
(for-each
  (lambda (path)
    (let ((r (slat/check :type 'incident-narrative (slat/load-doc path))))
      (unless (assq :pass r)
        (emit `(system/invalid-narrative :path ,path :errors ,r)))))
  (glob "docs/atoms/incident-narratives/*.slat"))
```

---

## §SLAT.10 — `(slat/sign body :as principal)`

**Returns:** a `(signed :body … :signed-by … :signature #b64 "…"
:cid #b64 "…" :nonce #b64 "…" :ts-signed #inst "…")` wrapper record.
**Backing:** `bindings/js/slat.js:signSlat` (ed25519 default).
**Side effects:** reads the principal's private key (permission-gated).
**Wired:** yes for `sakura` and `system` principals; other principals
land honest-null `'service-not-yet-wired` until Priya lands them.

Contract: `body` is any slat value; `principal` MUST be a known
signing identity. Signature covers canonical CID + nonce + ts-signed
+ signed-by.

#### Novice
```scheme
(slat/sign my-event :as 'sakura)
;; → (signed :body … :signed-by "sakura@lacuna" :signature #b64 "…" …)
```

#### Intermediate
```scheme
;; sign an incident narrative before landing in the corpus
(let ((wrapped (slat/sign narrative :as 'sakura)))
  (slat/append "docs/atoms/incident-narratives/pending.slatl" wrapped))
```

#### Expert
```scheme
;; sign a batch and Merkle-attest as a set
(let* ((signed  (map (lambda (r) (slat/sign r :as 'sakura)) records))
       (root    (slat/merkle-root signed)))
  (emit `(slat-set :root ,root :count ,(length signed))))
```

**Common errors.**
- `'service-not-yet-wired` — principal not yet configured.
- `permission-denied` — caller lacks signing perm for principal.

---

## §SLAT.11 — `(slat/verify signed-record)`

**Returns:** `#t` on valid signature; a structured `(:reason …)`
record on failure.
**Backing:** `bindings/js/slat.js:verifySlat`.
**Side effects:** none.
**Wired:** yes.

#### Novice
```scheme
(slat/verify my-signed-record)
;; → #t
```

#### Intermediate
```scheme
(let ((r (slat/verify wrapped)))
  (if (eq? r #t) (next 'accept ctx) (escalate 'signature-invalid r)))
```

#### Expert
```scheme
;; verify + check freshness (< 1 hour old)
(and (eq? (slat/verify wrapped) #t)
     (< (- (now-ms) (assq :ts-signed wrapped)) 3600000))
```

---

## §SLAT.12 — `(slat/merkle-root records)`

**Returns:** a `#b64` root of the Merkle tree over the input records.
**Backing:** `bindings/js/slat.js:merkleRoot`.
**Side effects:** none.
**Wired:** yes.

Contract: input MUST be a non-empty list of slat values.
Merkle-scheme = `"slat-merkle-v1"` per SLAT SPEC §6.7. Leaf =
`sha256(canonical_bytes)`. Node = `sha256(left || right)`.

#### Novice
```scheme
(slat/merkle-root (list rec-a rec-b rec-c))
```

#### Intermediate
```scheme
;; attest a manifest before Weave
(let ((root (slat/merkle-root corpus-manifest)))
  (emit `(slat-set :root ,root :count ,(length corpus-manifest)
                   :merkle-scheme "slat-merkle-v1")))
```

#### Expert
```scheme
;; roll a fresh root every minute for a live projection
(let loop ((last (now-ms)))
  (when (> (- (now-ms) last) 60000)
    (let ((root (slat/merkle-root (slat/tail path 1000))))
      (emit `(system/projection-attest :root ,root))))
  (after 5 loop (now-ms)))
```

---

## §SLAT.13 — `(slat/merkle-verify root records)`

**Returns:** `#t` on match, `(:reason …)` on mismatch.
**Backing:** `bindings/js/slat.js:merkleVerify`.
**Side effects:** none.
**Wired:** yes.

#### Novice
```scheme
(slat/merkle-verify root the-batch)
;; → #t
```

#### Intermediate
```scheme
(if (eq? (slat/merkle-verify root batch) #t)
    (next 'train ctx)
    (escalate 'corpus-attestation-failed))
```

#### Expert
```scheme
;; guard training: refuse to run on unverified corpus
(unless (eq? (slat/merkle-verify (corpus-manifest-root) corpus) #t)
  (escalate 'corpus-unverified '(:action 'weave-refuse)))
```

---

## §SLAT.14 — Registry helper: `(define-slat-type name (fields …))`

Registers a user-defined slat-type per SLAT SPEC §7.4. Runtime effect
only; no code-gen. See SLAT SPEC §7.4 for the full form.

```scheme
(define-slat-type my-shape
  (fields
    (id      :type string   :required)
    (ts      :type instant  :required)
    (payload :type record   :optional))
  (positional ())
  (builder (lambda (rec) (make-my-shape rec))))
```

After registration, `(my-shape :id "x" :ts #inst "…" :payload rec)`
reads as a native `my-shape` value; `slat/check :type 'my-shape …`
validates.

---

## §SLAT.15 — Cross-reference

- **SLAT-1.0.SPEC.md** — wire-format canonical.
- **SLAT-1.0.WALKTHROUGH-2026-07-11.md** — 22k-word narrative.
- **SAKURA-SCHEME-1.0.ENG.md §SLAT** — runtime substrate integration.
- **LOAM-1.0.ENG.md §SLAT** — Loam projection wire.
- **SAKURA-AUTOMATIONS-1.0.ENG.md §SLAT** — automation triggers/actions.
- **TUTORIAL.html §L** — the 11-year-old's guide to slats.


