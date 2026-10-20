# Corpus poison audit — 2026-08-02

Read-only measurement. Nothing in the tree was changed.

**Question:** which corpus statements are now FALSE, either because the language
CHANGED under them (commit `626e9ee`, 2026-08-02) or because they assert a
known-buggy behaviour as if it were correct (the 48 divergences in
`scratch/R7RS-CONFORMANCE-FINDINGS-2026-08-02.md`)?

**Headline: 16 genuinely-wrong claims, in 5 files.** 13 from the contract
change, 3 from the conformance findings. Plus 3 executable snippets that now
raise, 1 latent landmine in a cart, and ~20 latent under-tests that are not
false but under-check. The 48 `needs-alfred` divergence records are **clean** —
every one of them names the bug rather than asserting it.

---

## 0. Method, and what the numbers mean

Four different quantities get conflated in audits of this kind. They are kept
apart here:

| quantity | how obtained | trustworthiness |
|---|---|---|
| **files-containing** | `grep -l` | upper bound only, never a site count |
| **occurrences** | `grep -o` | upper bound only |
| **call sites** | balanced-s-expression parse with string-literal awareness, after a single-pass unescape of `\n` / `\"` | exact for `(verb …)` forms |
| **wrong claims** | a human reading the surrounding `:note` / `:claim` / `:caveats` / prose, plus live execution against `./bin/motoi` | the number reported as "wrong" |

Corpus scanned: **1,262 files** across `scheme/`, `scheme-books/`,
`word-books/`, `carts/`, `graphs/`, `training-data/`, `training/`, `modules/`,
`rosetta/`, `site/`, `engineering/`, `Spec/`, `words/` (empty),
`scratch/sft-plans/`. `~/code/scheme-carts` is measured separately in §5 and was
not modified.

Execution evidence:

- `python3 scratch/verify-reference-records.py` — **24,302 snippets executed,
  23,950 passing, 352 FAILING.** That reproduces the stated 352 baseline.
  Failure dump: `/tmp/ref-failures.tsv`.
- A targeted re-run of only the 153 reference snippets that mention
  `substring` / `cons*` / `delete-duplicates`.
- 117 fenced code blocks from `scheme-books/*/*.book.slatl` + `word-books/`
  that mention those verbs, executed individually.
- 3 carts run end-to-end; ~20 one-off expressions run directly.

Every "Motoi answers X" statement below was executed, not recalled.

---

## 1. The table

Verb/behaviour × where × how many × prose-or-executable × confidence.

### Cause A — the contract change (`626e9ee`)

| behaviour | file | wrong claims | prose / executable | confidence | note |
|---|---|---|---:|---|---|
| `cons*` no longer flattens a non-list tail | `scheme/reference/39-list.slat` — the `cons*` verb record (lines 945–997) | **9** | 7 prose, 2 executable | **high** — every claim read; both programs executed | The whole record is built around a divergence that no longer exists |
| `substring` no longer clamps | `scratch/sft-plans/pairs-dotted-and-srfi-2026-08-02.jsonl` record 5 (shape `V2`) | **3** | prose (a generated SFT pair) | **high** — record read in full; `(substring "ab" 0 3)` executed | Shows `(substring "ab" 0 3) ;=> "ab"` and calls the clamp a portability hazard elsewhere. It is a hazard *here*. |
| `delete-duplicates` now honours its `=` argument | `scheme/reference/01-core.slat:3576` (`:caveats`) | **1** (two assertions in one string) | prose | **high** — executed: `(delete-duplicates '("a" "b" "a") eq?)` → `(a b)` | Claims the argument is "ignored" and that the call "collapses distinct sources to one". Neither is true now. |
| `substring` — everything else | 247 call sites in 68 files | **0** | — | high | See §2 |

### Cause B — asserting a known R7RS divergence as correct

| behaviour | file | wrong claims | prose / executable | confidence |
|---|---|---|---:|---|
| `assoc` ignores a 3rd comparator argument | `scheme-books/book-of-your-own-dialect/ch06-do-you-have-verb-x.book.slatl:662` | **1** prose + **1** executable | "Yes… uses the supplied comparator" — false; the example at :666 **crashes live** (`cadr: expected a pair …, got #f`) | **high** — executed |
| `assoc` ignores a 3rd comparator argument | `scheme/reference/29-geom.slat:2742` + `:emergent` at :2745 | **1** | executable, runs silently wrong | **medium** — the claim is of intent ("equivalence-class partition"), not a stated output |
| `= < > <= >=` truncate to 2 args | 40-math / 60-string `needs-alfred` records | **0** | — | high — all read; each states the R7RS answer and marks itself a bug |
| `(exact? 0.5)` / `(inexact? 0.5)` | `scheme-books/book-of-r7rs-recipes/08-numeric-tower.book.slatl:60-63` | **0** | executable | **high** — executed. The book's `#f` / `#t` are CORRECT; the bug only affects *integral* floats such as `2.0` |
| `(eqv? 1 1.0)` "may be `#f`" | `scheme-books/book-of-jesse/appendix-f-common-gotchas.book.slatl:188` | **0 wrong, 1 cosmetic** | prose, hedged | high — Motoi answers `#t` |
| `vector-ref`/`list-ref` out of range | 70-vector `needs-alfred` (2 sites) | **0** | — | high |
| `(round 9/10)` | 40-math `needs-alfred` (1 site) | **0** | — | high |
| `string->number "12abc"` | 60-string `needs-alfred` (3 sites) | **0** | — | high. The other 169 `string->number` sites use fully-non-numeric or valid literals and are correct |
| `(eq? '() '())` | 52-predicate (4 sites) | **0** | — | high — the record says "the departure from R7RS" outright |
| `log` with a base | 40-math (5 sites) + `book-of-your-own-dialect/appendix-a:237` | **0** | — | high — the book says the 2-arg form "may need to be computed as `(/ (log n) (log base))`" |
| `member` 3-arg | 39-list `needs-alfred` (7 sites) | **0** | — | high |
| `sort` on a vector | 33-higher-order `needs-alfred` (1 site) | **0** | — | high |
| `vector-copy!` / `bytevector-copy!` overlap | 70-vector (8) / 10-bytevector (4) | **0** | — | high |
| `list-index`, `rationalize`, `vector-append`, `vector->string`, `string->vector` | 40-math / 70-vector / 33-higher-order `needs-alfred` | **0** | — | high |

**The 48 `needs-alfred` records are not poison.** Each states the current
behaviour under an explicit `IN MOTOI TODAY` clause, cites the R7RS section, and
gives the answer the standard requires. A model trained on them learns *"Motoi
has a bug here and the standard says X"*, which is true. That was the design
intent and it held.

---

## 2. `substring` — the 247 call sites, resolved

The grep-level numbers, labelled as what they are:

- files containing the token `substring`: **99** (UPPER BOUND, not sites)
- raw occurrences of the token: **449** (UPPER BOUND)
- raw occurrences of `(substring`: **248** (UPPER BOUND)
- **balanced-parsed call sites: 247, in 68 files** (exact)

Resolution:

| class | count | verdict |
|---|---:|---|
| all arguments literal | 19 | **all 19 read.** 13 in range. 6 out of range: 2 in `60-string.slat` `:caveats` that *say* they are errors (correct), 2 in `70-vector.slat` wrapped in `guard` asserting `'raised` (correct), **2 in the poisoned SFT record** |
| `end` is `(min …)`-guarded | 12 | safe by construction |
| `end` is a literal integer | 69 | safe (short slices on longer literals) |
| `end` is a `(string-length …)` expression | 37 | 19 are prefix-test-shaped; see below |
| `end` computed (`(+ i 1)`, `(- n 1)`, …) | 110 | executed where runnable; see below |
| 2-arg (`(substring s k)`) | 5 | safe |

**Prefix-test idiom** — `(substring s 0 (string-length p))` is the shape that
depended on the clamp. 19 such sites. 16 carry an explicit length guard
(`(>= (string-length s) (string-length p))` or `(<= …)`). **3 do not**, and
those 3 are exactly the 3 snippets the verifier reports as now raising:

```
00b-introspection.slat : describe          :eng-composition   (deterministic)
19-cortex.slat         : cortex/query      :code              (state-dependent)
19-cortex.slat         : cortex/query      :cs-program        (state-dependent)
```

The two `19-cortex` ones pass in isolation and fail in a full-suite run, because
`(cortex/keys)` returns keys written by other snippets and some are shorter than
the prefix. Error text in all three: `substring: end N is past the end of a
string of length 1`. All three are inside the 352 baseline.

**Books and word-books: a clean null.** 117 fenced code blocks mentioning a
target verb were executed. 16 fail — every one for an unrelated pre-existing
reason (`unbound symbol: pipe`, `route/recall`, `cortex/scan`, apostrophe-in-
identifier, prose mistaken for code). **Zero** fail because of `substring`,
`cons*` or `delete-duplicates`.

**Prose asserting the clamp:** the whole corpus was grepped for `clamp` near
`substring`. 5 hits. 4 are in `60-string.slat` / `70-vector.slat` and are
already CORRECT post-change (`"It raises rather than clamps"`, and a `:cs` note
comparing Python/Java/JavaScript). The 5th is the poisoned SFT record.

**Carts:** 74 `.sks` + `.scm` in `carts/`; 3 use `substring`
(`match-three-jewels`, `block-drop`, `sokoban-boxes`) plus
`cart-maker-6-zelda/level-1.scm`. All three run to completion today.

One landmine: `carts/match-three-jewels.sks:34-40`, `(define (blank-row) …
(substring COLORS (randint 0 NCOLORS) (+ (randint 0 NCOLORS) 1)))` calls
`randint` **twice**, so `start > end` is possible. Measured live: **49 raises in
200 trials (~24.5 %)**. It is dead code — `make-board` calls `random-row`, which
uses the correct single-`k` form — so the cart runs. It is still a broken
definition sitting in a corpus that teaches people to read cart code.

---

## 3. `cons*` — the one bad record

- balanced-parsed call sites: **31 in 5 files** (grep-level: 61 occurrences in 6
  files — UPPER BOUND).
- 4 of the 5 files (`book-of-scheme/05-lists-and-shapes`,
  `book-of-scheme/ch-rampup-07-lists`, `Spec/srfi-1.slatl`, and SFT record 7 of
  `pairs-dotted-and-srfi-2026-08-02.jsonl`) use only a **proper-list tail**.
  Unaffected. **Zero** poison.
- `scheme/reference/39-list.slat`, the `cons*` verb record, holds all 24
  remaining sites and **9 false claims**:

| # | line | field | the false claim |
|---|---|---|---|
| 1 | 952 | `:explanation` | "In Motoi a non-list tail is folded in as a single element, which is a divergence from SRFI-1" |
| 2 | 958 | `:caveats[0]` | "it makes one because of the divergence below" |
| 3 | 958 | `:caveats[1]` | "Motoi returns the proper list `(1 2 3)` instead. To get the dotted result in Motoi, nest cons explicitly" |
| 4 | 966 | `:cs-program` | label `'motoi-divergence (cons* 1 2 3)` — **executable** |
| 5 | 968 | `:explanation` (cs clause) | "a non-list tail is where Motoi diverges from SRFI-1" |
| 6 | 990 | `:cs-program` | labels `'srfi-1-would-be-dotted` / `'motoi-gives` / `'motoi-proper?` — **executable** |
| 7 | 991 | `:claim` | "Motoi appends it as one more element instead of building the SRFI-1 improper list" |
| 8 | 993 | `:meta` | "documents a KNOWN divergence from SRFI-1 … the dotted form must be built with nested cons in Motoi" |
| 9 | 996 | `:cs` | "The non-list tail is the one place where a program written against another Scheme will behave differently under Motoi" |

Both programs still *run*, so the verifier does not catch them — but their
output now refutes their own labels. Executed:

```
(one-arg 5 one-list (1 2) len 3 motoi-divergence (1 2 . 3))
(srfi-1-would-be-dotted (1 2 . 3) motoi-gives (1 2 . 3) motoi-proper? #f)
```

`srfi-1-would-be-dotted` and `motoi-gives` are now identical, which is the
record disproving its own thesis in its own output.

---

## 4. `delete-duplicates`

- grep-level: 260 occurrences in 57 files (UPPER BOUND).
- balanced-parsed call sites **with a comparator argument**: **1 in the entire
  corpus** — `scheme/reference/01-core.slat`. Everything else is the 1-argument
  form, whose behaviour did not change.
- `01-core.slat:3576`, a `:caveats` entry, asserts:
  > "BUG BOUNDARY, reported not fixed: `(delete-duplicates srcs eq?)` collapses
  > distinct sources to one, because delete-duplicates keys on a JSON
  > serialization and **ignores its optional equality argument**."

  Executed today: `(delete-duplicates '("a" "b" "a") eq?)` → `(a b)`. The
  argument is honoured and nothing collapses. Both halves of the caveat are
  false. The workaround it prescribes (an explicit `memq` walk) is now
  unnecessary, though harmless.

---

## 5. `~/code/scheme-carts` — separate corpus, NOT TOUCHED

A different product (Curator automations). Reported separately, nothing modified.

- `.sks` files: **10,850**
- files containing `substring`: **516** (UPPER BOUND)
- **balanced-parsed `(substring …)` call sites: 661 in 439 files**
  - `min`-guarded: **332** — consistent with the migration `626e9ee` describes
  - `end` a literal: 105 · 2-arg: 103 · `(string-length …)` expr: 64 · computed: 57
- `cons*` call sites: **22**, **none** with a literal non-list tail → unaffected
- `delete-duplicates` **with a comparator**: **32 sites in 19 files**
  (`string=?` ×16, `eq?` ×6, `equal?` ×1, 4 inline lambdas, 5 named predicates).
  These are the ones whose behaviour changed under `626e9ee`. Most pass a
  comparator that agrees with the old structural default, so the answer is
  probably unchanged — **but I did not execute any of them**, so this is
  UNVERIFIED. Flagged for the owner of that repo.

---

## 6. Prioritised: what must be fixed before a training run

**BLOCKER — a model trained on these learns a false language.**

1. `scratch/sft-plans/pairs-dotted-and-srfi-2026-08-02.jsonl` **record 5**. The
   only generated SFT pair in 11,153 lines that teaches the clamp, and it
   teaches it three times in one answer including a worked `;=>`. Either drop
   the record or rewrite it around the raise. Highest poison-per-token in the
   tree.
2. `scheme/reference/39-list.slat`, the `cons*` record — 9 claims. The reference
   is canonical (`CLAUDE.md`: "when code and reference disagree, reference
   wins"), so leaving it stale is worse here than anywhere else: it instructs a
   reader to nest `cons` to get a result `cons*` now produces directly.
3. `scheme/reference/01-core.slat:3576` — the `delete-duplicates` caveat.
   One string, records a bug that is fixed.

**SHOULD FIX — broken, will train a crashing idiom.**

4. The 3 unguarded prefix tests: `00b-introspection.slat` (`describe`,
   `:eng-composition`) and `19-cortex.slat` (`cortex/query`, `:code` and
   `:cs-program`). The engine's own error text names the fix
   (`string-prefix?`, or `(substring s 0 (min n (string-length s)))`), and the
   sibling snippets in the same records already use the guarded form — so this
   is a 3-line consistency fix, and it takes the baseline from 352 to 349.
5. `scheme-books/book-of-your-own-dialect/ch06-do-you-have-verb-x.book.slatl:662`
   — prose says `assoc` honours a comparator; the example beside it crashes.
   Either fix `assoc` (findings-doc priority list does not rank it) or mark the
   passage `needs-alfred` the way the reference chapters do.
6. `carts/match-three-jewels.sks:34-40` — dead `blank-row` with a ~24.5 % raise
   rate. Delete-and-archive per no-deletes doctrine, or give it the single-`k`
   form its live sibling `random-row` already uses.

**COSMETIC — will not mislead a model materially.**

7. `scheme/reference/29-geom.slat:2742` — an `assoc` comparator that is silently
   ignored. Nothing states a wrong output; only the `:emergent` label overclaims.
8. `scheme-books/book-of-jesse/appendix-f-common-gotchas.book.slatl:188` —
   "`(eqv? 1 1.0)` may be `#f`". Hedged, and about Scheme generally rather than
   about Motoi. Motoi answers `#t`.
9. ~20 range-check call sites of the `(<= lo x hi)` shape across 12 files
   (`01-core`, `09-beat` ×2, `10-bytevector`, `11-calc` ×2, `20-curve` ×2,
   `24-entity` ×5, `26-exception`, `36-juggle`, `55-scene`, `65-tick`,
   `70-vector`, `book-of-values/appendix-x` ×2). These **under-check** today —
   Motoi evaluates only the first pair — but the invariant each one asserts is
   TRUE, and they will start checking correctly the moment the n-ary comparison
   bug is fixed. They are not false claims. They are the reason that fix is
   ranked #1 in the findings doc.

---

## 7. Clean nulls — categories where the honest answer is zero

Stated plainly so nobody re-derives an inflated number later:

- **`substring` prose in the reference: 0 wrong.** `60-string.slat` and
  `70-vector.slat` were already updated in `626e9ee`'s vicinity and now describe
  the raise correctly, including a three-language comparison note.
- **Books and word-books, executable: 0 failures** attributable to any of the
  three changed verbs, out of 117 blocks run.
- **`cons*` outside `39-list.slat`: 0 wrong** across 4 files.
- **`delete-duplicates` with a comparator outside `01-core.slat`: 0 sites** in
  the whole Motoi corpus.
- **The 48 `needs-alfred` divergence records: 0 wrong.** They assert the bug as
  a bug.
- **`(exact? 0.5)` in `book-of-r7rs-recipes`: 0 wrong.** Executed. The
  exactness bug only bites *integral* floats (`2.0`), which no book asserts.
- **`string=?` with 3+ arguments outside `60-string.slat`: 0.** The 3
  `graph-of-intuition.slat` hits are prose fragments, not calls.
- **`vector-ref` / `list-ref` with an out-of-range literal index outside the
  `needs-alfred` records: 0.**
- **`scratch/sft-plans/` (11,153 generated pairs across 5 files): 1 poisoned
  record.** `mk-ultra-reversals.jsonl` (10,000 lines),
  `10th-seam-reversals-sample.jsonl` (660), `delock-variants-2026-07-30.jsonl`
  (462) and `prototype-shapes-0-5.jsonl` (15) contain **zero** mentions of any
  of the three changed verbs.
- **`graphs/`: 0.** The 18 `substring` hits in `graph-of-sensation.slat` are
  bare verb-name tags, not behavioural claims.

---

## 8. What I could NOT determine

Stated so the confidence figures above are usable.

1. **I did not hand-read all 247 `substring` sites.** I read **~60** of them:
   all 19 literal-argument sites, all 19 prefix-test-shaped sites, both
   `70-vector` guard sites, one representative of the 30-way repeated
   `(substring s (- n 1) n)` idiom in `book-of-music` (the same two lines
   copied across 30 chapters), and every site in a snippet that failed
   execution. The other ~187 were resolved **structurally** (argument shape) and
   **by execution** (153 reference snippets + 117 book blocks run). A site that
   is dynamically safe today but sits under a wrong prose sentence I did not
   read would be missed. I judge that unlikely given the `clamp` grep came back
   with only 5 hits corpus-wide.

2. **Prose detection is keyword-driven, so paraphrase can hide.** I grepped
   `clamp`, `diverge`, `ignores`, `optional`, `comparator`, `equality`. A
   sentence that asserts the old behaviour without using any of those words —
   "asking for more characters than there are just gives you what is there" —
   would not be caught. This is the single largest residual risk in the audit
   and it cannot be closed by execution, only by reading.

3. **State-dependent failures are not fully enumerated.** The two `19-cortex`
   failures appear only when the shared cortex store already holds a short key.
   There may be other snippets whose pass/fail depends on suite ordering. The
   352 baseline is one sample of that ordering, not a fixed point.

4. **`scheme-carts`: 32 `delete-duplicates` comparator sites were parsed but
   not executed.** Whether their answers changed under `626e9ee` is
   **unverified**. It is a different repo and out of scope to run.

5. **Carts beyond the 3 that use `substring` were not executed.** 74 files in
   `carts/`; I ran 3.

6. **I did not audit for the *other* direction on the 48 findings** — corpus
   that asserts the R7RS-correct answer while Motoi today answers wrongly. Those
   are not poison for a corpus meant to teach the fixed language, and the two I
   met by accident (`book-of-r7rs-recipes` `exact?`, `book-of-jesse` `eqv?`) are
   in §1. A systematic sweep would need the fixes to land first, then a re-run
   of `verify-reference-records.py`.

7. **`words/` is empty** (0 files). The vocabulary corpus named in the brief
   lives in `word-books/` (52 files), which was scanned.

---

## Appendix — scripts used

All read-only, all left in `scratch/`:

- `scratch/_audit_scan.py` — files-containing vs occurrences, 30 patterns
- `scratch/_audit_lib.py` — corpus walker, single-pass unescape, balanced-sexp
  reader, top-level argument splitter
- `scratch/_audit_substring.py`, `scratch/_audit_substring2.py` — `substring`
  site extraction and risk classification
- `scratch/_audit_nary.py` — genuine n-ary comparison sites
- `scratch/_audit_refrun.py` — targeted execution of reference snippets
  mentioning a changed verb (reuses `verify-reference-records.py`'s extractor)
- `scratch/_audit_runbooks.py` — execution of book/word-book fenced blocks

Existing gates used: `scratch/verify-reference-records.py` (352/24,302),
`scratch/substring-conformance-check.py` (0 failures, but only 67 programs —
its extractor is narrower than `_audit_refrun.py`'s, which is why it missed the
three real ones).
