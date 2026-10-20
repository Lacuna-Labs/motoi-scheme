# R7RS compliance — where Motoi stands, 2026-08-03

Every number below was produced by a run finishing minutes before this file was
written, against the working tree as it stands.

| gate | command | result |
|---|---|---|
| repo suite | `node --test --test-reporter=tap tests/*.test.mjs tests/**/*.test.mjs` | **768 / 768** |
| chibi | `scratch/r7rs-conformance/run_chibi3.py` → `score.py` | **1186 / 1204** (18 fail) |
| larceny | `scratch/r7rs-conformance/run_larceny.py` → `score_larceny.py` | **2027 / 2074** (47 fail) |
| reference notes | `scratch/verify-reference-notes.py` | **969 / 969**, 0 mismatch, 0 error |

The reference-note gate is the one that matters for the corpus: it checks what a
snippet PRINTS against what its note CLAIMS. It is at zero for the first time.

---

## The 18 chibi failures

| bucket | n | status |
|---|---|---|
| pair identity / `set-cdr!` / circular lists | 8 | **open — needs a decision, see below** |
| file ports (`file-exists?`, `open-input-file`, `delete-file`) | 4 | decision-010, deliberate |
| macro variable capture | 4 | open, small — Abel's two standing DIFFs in `scratch/abel/` |
| `dynamic-wind` re-entered by a stored continuation | 1 | decision-004, deliberate |
| `(make-polar 1 1)` | 1 | not a bug — chibi's own test literal is rounded to 14 digits; Motoi's answer is byte-identical to `chibi-scheme -p` |

## The 47 larceny failures

| suite | n | what they are |
|---|---|---|
| `list.sld` | 23 | **every one is pair identity** — `eq?` on a sublist, the SRFI-1 destructive verbs (`take!` `drop-right!` `split-at!` `append!` `map!` `filter!` `remove!` `take-while!` `span!` `break!` `delete!`), `pair-fold`, `circular-list` |
| `base.sld` | 14 | 3 `include` (file ports) · 3 pair identity · 2 call/cc re-entry · 2 macro hygiene · 2 `vector-copy!` where larceny is LENIENT and Motoi agrees with chibi · 1 `dynamic-wind` · 1 harness output-capture artifact |
| `vector.sld` | 5 | SRFI-133 — **not in the 2026-07-24 stdlib lock**, out of scope |
| `write.sld` + `read.sld` | 3 | datum labels / shared structure = pair identity |
| `inexact.sld` | 2 | `(/ 1.0 0)` and `(/ 0.0 0)` — larceny wants `+inf.0` / `+nan.0`; **chibi errors and answers `0.0` respectively**. The oracles disagree with each other; Motoi sides with chibi. |

---

## The one open decision: pair identity (task #49)

**Motoi represents a proper list as a flat JavaScript array.** An improper list
is a `Pair` object (`src/reader.js:51`), but a proper one is not built out of
cells. So `(cdr x)` ALLOCATES a new array rather than returning an interior
pointer, and three things follow:

- `(eq? (cdddr x) (drop x 3))` is `#f` — there is no shared tail to be `eq?` to.
- `set-cdr!` on a proper list has nowhere to write.
- `circular-list` cannot be constructed at all, so neither can a datum label.

**That single representation choice accounts for 30 of the 65 remaining failures
across both oracles** — 8 chibi + 22 larceny.

Fixing it means replacing the core list representation across the interpreter,
the printer, the reader, every library, and every cart. It is not a bug fix.

**My recommendation: record it as an explicit decision, the way decision-010
records "no file ports", rather than build it.** Nothing in `scheme/reference/`
and nothing in the carts depends on interior mutation. But it is a language
decision, not an engineering one, so it is yours.

---

## What landed today

Engine:
- complex `+ − × ÷` written over the exact fold, so `(/ 1+2i 3+4i)` is `11/25+2/25i`
- `sqrt` and `log` closed over the tower — `(sqrt -1)` is `+i`, `(log -1)` is `0.0+3.141592653589793i`
- `exact` / `inexact` now convert componentwise
- `magnitude` exactness fixed twice: it was deciding exactness from the complex
  OBJECT (so `(magnitude (make-rectangular 3.0 4.0))` was `5` where §6.2.2 and
  chibi say `5.0`), and it was flattening an exact real through a double (so
  `(magnitude 1/2)` was `0.5`)
- `write` string escapes rewritten to §7.1.1 — Motoi was emitting ``,
  a JavaScript escape it could not read back
- mutable strings: `string-set!`, `string-fill!`, `string-copy!`
- macro hygiene: a lexical binding shadows a syntactic keyword, and a
  macro-INTRODUCED keyword is not shadowed (Abel's REQ-1 + REQ-2)
- `last-error` unset slot no longer leaks a JavaScript null; it is plain `#f`

Reference:
- 278 snippets moved from `with-exception-handler` to `guard` (Priya)
- `40-math.slat` `log` record repaired, `needs-alfred` cleared
- `17-complex.slat` — `make-polar` inexactness, the unit imaginary spelled `0+i`
  not `i`, the orbit spelled `(1 0+i -1 0-i 1)`
- `26-exception.slat` — the whole `last-error` record rewritten to the fixed
  engine, `needs-alfred` cleared
- `02-ai.slat` — six notes were claiming the VERB's return value while the
  snippet printed a fallback string; rescoped to what actually prints

Harness:
- `verify-reference-notes.py` learned the numeric grammar. It was reading
  `1.0+0.0i — modulus 1` as a claim of `1`, and would have read
  `-2+2.449e-16i` as a claim of `-2`. Two correct records were being reported
  as mismatches, which is the failure mode that matters most in a gate.
