# Motoi 0.90 — Release Plan & Living Checklist

**Persistent driver file.** Survives context compaction. Update the checkboxes as each
step lands. Working file (scratch/, ephemeral). Owner: Claude (main session), with ≤4
full-Claude book lanes.

Started 2026-07-24. Governing directives (Alfred, verbatim intent):
- Fully **compliant** AND **expressive** language. Add full expressions so the AI learns
  the lang. **Dotted pairs.** Idioms all over. **Every verb used** in an example.
- Anything broken → **fix into compliance AND keep the bad example**, labelled with its
  **provenance** in a slat file, so broken/fixed pairs can be linked for **broken-cart
  repair CPT/SFT**.
- No half-finished work. Validate everything, intelligently. Loops OK for mechanical bulk.
- Audit + edit ALL scheme + eng + SRE books; add the new paradigms (parts / separation-of-
  concerns / conformance-ladder / dotted-pairs) into the CORE lang docs, each book's voice.
- Each SRFI complies with its SRFI spec.
- Validate every training-data source runs.
- End state: **Motoi 0.90 released.**

Standing constraints: No deletes (archive under dated `_archive/`). No fabrication
(`:status "needs-alfred"` and stop). No `--force`/`--no-verify`. Never commit without
Alfred's go. Reference IS the language. "Wired" = `echo <v> | ./bin/motoi run /dev/stdin`
passes. Keep-broken-lane: preserve authentic broken artifact before fixing.

---

## Validation harness (run after every phase — never trust a lane report)

- `node bin/motoi lib validate` → all 5 parts PASS (3-verbs + 5-runs live, not skipped)
- `node scratch/smoke-reference-examples.mjs` → every reference example runs, no unbound
- `node bin/motoi lib list` → verb counts as expected
- `node scratch/verb-coverage.mjs` (NEW) → every wired verb appears in ≥1 runnable example
- `node scratch/pair-tests.mjs` (NEW) → R7RS pair/dotted-pair semantics green
- `node scratch/conformance-audit.mjs` (NEW) → zero divergent wired names; manifest == registry

---

## PHASE A — Conformance foundation (finish what's in flight)  [main session]

- [ ] A1. Broken-example teaching cases for the 4 dropped names, each with provenance
      label + link-anchor for CPT/SFT broken-cart repair:
      - [ ] `hash-ref` → hash-table-ref/default  (from scheme/reference/32-hash.slat)
      - [ ] `hash-set!` → hash-table-set!         (from 32-hash.slat)
      - [ ] `hash-table-exists?` → hash-table-contains? (SRFI-69→125)
      - [ ] `error?` → error-object?              (from scheme/reference/52-predicate.slat)
- [ ] A2. Conform incidental CODE across reference + books (run conform-rewrite.py on the
      ~17 files) AND structurally convert the verb DEFINITIONS (32-hash: hash-ref, hash-set!;
      52-predicate: error?) into broken-example cross-refs. Verify each touched program runs.
- [ ] A3. `reduce` — relabel `std: motoi` honestly (acc-first, not SRFI-1). Broken-example
      already exists (reduce-arg-order.slatl); confirm provenance link.
- [ ] A4. Regenerate provenance manifest `scratch/std-tag-map.json` from live registry
      (srfi-69→srfi-125, drop the 4 names, reduce→motoi). Triage the 121 needs-review.

## PHASE B — SRFI complies with SRFI  [main session]

- [ ] B1. SRFI-125 `hash-table-ref`: today uses value-default (SRFI-69 shape). SRFI-125 spec
      = optional **failure THUNK** + optional success proc. DECISION + fix or documented
      divergence-with-broken-example. (`ref/default` is the value-default form — correct.)
- [ ] B2. SRFI-1 (25) — signature/semantics spot-check vs spec (fold elem-first, etc.)
- [ ] B3. SRFI-13 (15) — spot-check vs spec.
- [ ] B4. SRFI-27 (4) — spot-check vs spec.
- [ ] B5. R7RS-small (115) — spot-check the surface that examples exercise.
- [ ] B6. `lib validate` green after any fix.

## PHASE C — Dotted pairs (the expressive-core change)  [main session, high blast radius]

Approach: **hybrid**. Proper lists stay JS arrays (fast, minimal churn). Improper lists use
a new `Pair` class. `cons(a,b)`: array/[] tail → proper; else → `Pair(a,b)`.

- [ ] C1. Add `Pair` class (car/cdr, iterable to detect improper tail).
- [ ] C2. Reader: parse `(a . b)` and `(a b . c)` in src/reader.js list loop.
- [ ] C3. Printer: `_displayFormat` + write + inspect emit `(a . b)` / `(a b . c)`.
- [ ] C4. Primitives: cons, car, cdr, pair?, null?, list?, cadr…, length (error on improper),
      append (improper tail), reverse, map/for-each (proper only), assoc, and the SRFI-1
      last-pair/cons* family. `hash-table->alist` → true `(k . v)` dotted pairs.
- [ ] C5. `scratch/pair-tests.mjs` — R7RS §6.4 pair semantics; green.
- [ ] C6. Re-run full validation harness; nothing regressed.

## PHASE D — Expressive: idioms + every verb used  [4 lanes, file-disjoint]

- [ ] D1. `scratch/verb-coverage.mjs` — enumerate all 1,650 wired verbs; cross-ref against
      example code harvested from reference; emit the never-used list.
- [ ] D2. Fill coverage gaps — every verb gets ≥1 runnable example (honest-null-aware; do not
      double-null verbs already at spec). Full expressions, not stubs.
- [ ] D3. Idiom collection — dotted pairs, quasiquote, named-let, fold idioms, tail-recursion,
      higher-order, hash-table patterns — spread across reference + books. Each idiom runs.
- [ ] D4. `smoke-reference-examples.mjs` green over the whole reference.

## PHASE E — Books audit + edit (scheme + eng + SRE)  [4 full-Claude lanes + coms]

Add the new paradigms to CORE lang docs, each in the book's own voice. No phrase-lock
(full-Claude lanes, not templates). Lanes file-disjoint; coms via scratch/lane-coms.md.
- [ ] E1. Lane 1 — scheme narrative books (MOTOI-SCHEME-BOOK, BOOK-OF-SCHEME, STYLE-GUIDE).
- [ ] E2. Lane 2 — scheme reference intro chapters (00-intro, 00e, 01-core, 32-hash, 52-pred).
- [ ] E3. Lane 3 — engineering (LANG-ENGINEERING .md — never slat-render it).
- [ ] E4. Lane 4 — SRE-MANUAL chapters (00, 06 standard-library-ops; add dotted-pairs note).
- [ ] E5. Cross-book contradiction check (reference wins on *what*).

## PHASE F — Training-data source validation

- [ ] F1. Every reference example parses + runs (D4 covers reference).
- [ ] F2. Graphs (4 Jung axis SLAT) parse.
- [ ] F3. Broken-examples slatl parse + their fix-code runs + broken-code fails as claimed.
- [ ] F4. Provenance links resolve (broken→source→fix) for CPT/SFT.

## PHASE G — Release Motoi 0.90

- [ ] G1. Version bump to 0.90 (package.json + VERSION surface).
- [ ] G2. CHANGELOG entry (parts separation, dropped aliases→broken-examples, dotted pairs,
      full verb coverage, book edits).
- [ ] G3. Final harness: all green.
- [ ] G4. Ping Alfred (PushNotification).

---

## Broken-example provenance format (for CPT/SFT broken-cart repair linkage)

Every broken-example .slatl carries:
`:from-file "<path>"` `:from-verb "<name>"` `:std-rejected (...)` `:std-target "<name>"`
`:repair-link "<stable-anchor>"` so a later pass can pair (broken-code, fix-code) with the
exact source site for repair training.

## Lane coms protocol

`scratch/lane-coms.md` — each lane appends a dated line on claim / handoff / blocker. Main
session reconciles. No lane edits another lane's files.
