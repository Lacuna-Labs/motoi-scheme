# Abel — changes needed OUTSIDE src/macro.js

2026-08-03. Filed rather than made, because `src/macro.js` is my only owned file.

---

## REQ-1 — `src/interp.js`: a lexical binding must shadow a syntactic keyword

**Worth:** 1 chibi assertion (L413) + 1 larceny assertion (base.sld). Both are
the R7RS §4.3.1 `letrec-syntax`/`my-or` test.

**This is NOT a macro bug.** I verified the expander handles the form
correctly: `expandProgram` on the test below produces the right tree, with
`temp` hygienically renamed to `temp~1`/`temp~2`/`temp~3`. The failure is
entirely in evaluation.

**Repro (no macros involved):**

```scheme
(let ((let odd?) (if even?)) (list (let 3) (if 4)))
```

- chibi: `(#t #f)`
- Motoi: `error: form[1] is not iterable`

The full conformance case that this blocks:

```scheme
(letrec-syntax
  ((my-or (syntax-rules ()
            ((my-or) #f)
            ((my-or e) e)
            ((my-or e1 e2 ...)
             (let ((temp e1)) (if temp temp (my-or e2 ...)))))))
  (let ((x #f) (y 7) (temp 8) (let odd?) (if even?))
    (my-or x (let temp) (if y) y)))
```

- chibi: `7`
- Motoi: `error: Cannot read properties of undefined (reading 'map')`

**Cause.** `src/interp.js` `evalStep`, line 468:

```js
  const head = form[0]
  if (head instanceof Sym && SPECIAL_FORMS.has(head.name)) {
    switch (head.name) {
```

`SPECIAL_FORMS` is consulted by NAME only. `let` and `if` are treated as
syntax even when the current environment has a *variable* by that name, so
`(let temp)` is parsed as a malformed `let` instead of a call to the
procedure in `let`. R7RS §4.3.1: "the binding of a variable shadows the
syntactic keyword of the same name."

**Requested change** (`src/interp.js`, in `evalStep`):

current

```js
  const head = form[0]
  if (head instanceof Sym && SPECIAL_FORMS.has(head.name)) {
    switch (head.name) {
```

replacement

```js
  const head = form[0]
  // R7RS §4.3.1: a lexical variable of the same name shadows the syntactic
  // keyword, so `(let ((if even?)) (if 4))` is a procedure call.
  if (head instanceof Sym && SPECIAL_FORMS.has(head.name) && !env.hasLexical(head.name)) {
    switch (head.name) {
```

This needs an `Env` predicate that reports whether the name is bound in a
*lexical* (non-global) frame — the global frame must not count, or every
`define`d name that collides with a keyword would stop being syntax. I did
not write it because `Env` is not mine; whoever owns interp.js should pick
the shape. If `Env` already exposes a frame chain, the predicate is a walk
that stops before the global frame.

**Risk note.** This puts one extra lookup on the hot path of every special
form. If that is unacceptable, an equivalent cheaper gate is to set a flag on
the environment the first time any binder shadows a `SPECIAL_FORMS` name, and
only pay for the lookup when the flag is set. Programs that never shadow a
keyword — i.e. all 19,326 reference programs — then pay nothing.

**Not urgent.** Two assertions, and nothing in `scheme/reference/` shadows a
keyword.

---

## REQ-2 — `src/interp.js`: a MACRO-INTRODUCED keyword is not shadowed

**Status of REQ-1:** applied, verified, thank you. `(let ((let odd?) (if
even?)) (list (let 3) (if 4)))` → `(#t #t)`, and I confirm chibi says `(#t
#t)` too — my earlier `(#t #f)` was wrong.

**Worth (measured, not estimated): +2 chibi assertions and +2 larceny
assertions, 0 regressions, 0 change to the node suite.** REQ-1 and REQ-2 are
the two halves of one rule and only pay off together — the tree as it stands
gains nothing until this line lands.

| back-to-back, same tree | chibi pass/fail | larceny pass/fail | node suite |
|---|---|---|---|
| without this line | 1161 / 43 | 2018 / 53 | 758 / 10 |
| with this line    | **1163 / 41** | **2020 / 51** | 758 / 10 |

Both larceny gains are in `base.sld` (16 fail → 14). No suite moves in either
direction. (The absolute numbers are from `/tmp/abel-verify`, described at the
bottom — it omits `scheme-books/`, `Scheme/`, `site/`, `graphs/`, which is why
its suite baseline is 758/10 rather than 768/0 and its chibi baseline sits
above the live tree's. The DELTA is what this table is for: the two rows are
the same tree, minutes apart, differing only in this line.)

**Why REQ-1 alone is not enough.** REQ-1 is right, and it exposed the other
half. In

```scheme
(letrec-syntax ((my-or (syntax-rules () … ((my-or e1 e2 ...)
                 (let ((temp e1)) (if temp temp (my-or e2 ...)))))))
  (let ((x #f) (y 7) (temp 8) (let odd?) (if even?))
    (my-or x (let temp) (if y) y)))
```

the expansion contains BOTH kinds of `let`: the one the use site wrote (a
call to `odd?`) and the one the macro's template emitted (the keyword). The
name is identical, so `hasLexical` cannot tell them apart and currently
demotes both — `error: unbound symbol: temp~1`. R7RS §4.3.1: a template
identifier means what it meant at the macro's DEFINITION site, where `let`
was syntax.

**What `src/macro.js` now does.** `introducedSym` emits template-contributed
OPERATORS as a fresh, UNINTERNED `Sym` carrying `introduced = true`. It is
decided structurally — "the template contributed this name and the definition
site had no lexical variable by it" — so there is no keyword list on my side
and adding a special form needs no change here. Use-site subtrees arrive
through pattern variables and are never flagged, so they still shadow
normally. `eq?` compares symbols by name (`src/base.js:638`), so an
uninterned `Sym` is interchangeable everywhere else.

**Requested change** (`src/interp.js`, in `evalStep`, currently lines
488–490) — one added conjunct:

current

```js
  if (head instanceof Sym && SPECIAL_FORMS.has(head.name) &&
      !(SHADOWED_KEYWORDS.size !== 0 &&
        SHADOWED_KEYWORDS.has(head.name) && env.hasLexical(head.name))) {
```

replacement

```js
  if (head instanceof Sym && SPECIAL_FORMS.has(head.name) &&
      !(SHADOWED_KEYWORDS.size !== 0 && head.introduced !== true &&
        SHADOWED_KEYWORDS.has(head.name) && env.hasLexical(head.name))) {
```

**Cost.** None on any path that matters. The new conjunct sits INSIDE the
`SHADOWED_KEYWORDS.size !== 0` guard you added, so a program that never
shadows a keyword never evaluates it; and it is a property read on an object
the line already touched.

**Safe to sit on.** `src/macro.js` as it now stands in the tree is INERT
without this line — I measured the live tree before and after my macro.js
edit and got the identical 1149/55 chibi, 1977/94 larceny, 768/0 suite. The
flagged `Sym` has exactly one reader, and it is the line above. So there is
no half-landed state: the tree is either where it was, or +2/+2.

**Verified before filing.** I could not edit `src/interp.js`, so I built
`/tmp/abel-verify` — an `rsync -a` copy of the repo (excluding `.git`,
`node_modules`, `scratch`, `graphs`, `Scheme`, `scheme-books`, `site`; with
`scratch/r7rs-conformance` copied back in and its `MOTOI_HOME` repointed to
`/tmp/abel-mx` so it could not collide with anyone else's run) — applied the
patch above there only, and ran everything against it. The real
`src/interp.js` was never touched.

A first attempt at that sandbox symlinked `lib/` and copied only `src/`. Do
not do that: node resolves the symlink to the real path, `lib/base/*.js`
imports `../../src/reader.js` from the REAL tree, and you end up with two
`Sym` classes and `instanceof` failures everywhere. It looked like 183 test
failures and a broken conformance run; it was the sandbox. Copy `src/` and
`lib/` together or not at all.

**With the line, matching `chibi-scheme -p` exactly:**

```
(letrec-syntax ((my-or (syntax-rules () ((my-or) #f) ((my-or e) e)
    ((my-or e1 e2 ...) (let ((temp e1)) (if temp temp (my-or e2 ...)))))))
  (let ((x #f) (y 7) (temp 8) (let odd?) (if even?))
    (my-or x (let temp) (if y) y)))              → 7    (was: unbound temp~1)
```

It also fixes the same shape for a TOP-LEVEL `define-syntax`, which is the
commoner case and which REQ-1 alone leaves broken:

```
(define-syntax my-if (syntax-rules () ((_ c t e) (if c t e))))
(let ((if list)) (list (my-if #t 'yes 'no) (if 1 2 3)))
                                    → (yes (1 2 3))   (was: ((#t yes no) (1 2 3)))
```

20 hand-checked cases against chibi live in `scratch/abel/` (`tk-cases.txt` +
`tk-compare.sh <motoi-root>`); 5 of them turn on this line, the rest are
guards against it firing when it should not. Two known DIFFs in that file are
older and unrelated (see `scratch/abel/README.md`).
