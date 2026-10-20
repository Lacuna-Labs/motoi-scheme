# spec-pack — where the authority actually came from

Priya, 2026-08-03. Read this before you trust any file in this directory.

## The headline

**The normative SRFI-1 document is not in this repo.** Neither is the R7RS-small
report text. CLAUDE.md's library gate #2 ("Spec kept alongside. The part's actual
spec (SRFI text / R7RS section) lives in a `.slatl` **with** the part") is
**not satisfied** for SRFI-1 or for R7RS-small. What we have instead:

| File | What it actually is | Covers our 21 verbs? |
|---|---|---|
| `spec/srfi-1.slatl` | 102 lines, **generated** by `scratch/gen-std-specs.mjs` from the `META` table in `lib/std/srfi-1.js`. Its own header says "derived from the authored META in lib/std/". It is the repo describing itself. | **No.** 27 verbs, one of which (`last-pair`) is on our list — and its entry is wrong (see below). |
| `spec/r7rs-small.slatl` | Same generator, same provenance. 115 verbs. | `list-copy` only. `set-car!`/`set-cdr!` absent. |
| `spec/R7RS-SMALL-PRIMITIVE-FLOOR.slat` | A floor manifest. One line per primitive with an R7RS section number and a one-clause summary. | `set-car!` (:192), `set-cdr!` (:193), `list-copy` (:214) — section citations only, no behaviour. |
| `scratch/r7rs-conformance/larceny/list.sld` | 707 lines. The **SRFI-1 conformance test suite**, "Adapted from srfi-1-test.sps" (:183). Executable, not prose. | 17 of 21. |

So the strongest in-repo authority for these verbs is a **test suite**, not a
specification. Every `(contract …)` form in this pack is labelled **DERIVED**
and every file carries `:status "needs-alfred"`. Nothing here is quoted from
SRFI-1 or from the R7RS report, because neither document is on disk and the
network is off limits.

### What is needed to close this

Vendor the SRFI-1 document and R7RS-small §6.4 into `spec/` as real `.slatl`
spec companions, the way the gate requires. Until then the 21 records drafted in
`../drafts/` rest on derivation, and they say so.

## Four verbs have NO in-repo behavioural evidence at all

Named in the larceny suite header but with no test body, and absent from the
generated part summaries:

- `reverse!` (list.sld:84)
- `last-pair` (list.sld:75)
- `set-car!` (list.sld:162)
- `split-at!` — has a test body (list.sld:326-332), but see below: it is **not
  bound in the engine**, so it is the one verb on the list that is missing
  rather than wrong.

`set-cdr!` (list.sld:163) has no test of its own either; the only in-repo
exercise of it is inside the `pair-fold` test at list.sld:402-410, which is
actually a strong one — it relinks the argument's own cells and therefore
requires the write to land on the caller's cell with the new tail **shared**.

## The suite's own caveat, and why it matters

`list.sld:171-173`:

> FIXME: Some of these tests are not portable because they require the
> procedures designated as "linear update" variants in the spec (eg append!)
> to side-effect their arguments.

Read that carefully, because it cuts against the framing of this work. SRFI-1
**permits** a `!` procedure to reuse its argument's storage; whether it
**requires** it is exactly what we cannot settle from in-repo material. The
larceny suite tests the strong reading and flags itself as non-portable for
doing so. `lib/std/srfi-1.js:845-849` asserts the weak reading:

> SRFI-1 permits a `!` procedure to reuse its argument's storage but does NOT
> require it, and explicitly forbids callers from relying on either behaviour.
> Motoi's lists are arrays, so the pure version already satisfies the contract;
> binding the names keeps portable code running.

**Neither claim can be checked against the standard from inside this repo.**
That is a real, load-bearing gap: if the weak reading is right, the 15 `!` verbs
are conforming-but-useless; if the strong reading is right, they are wrong. The
drafts in `../drafts/` are written to the **strong** reading — that a `!` verb
may destroy its argument and the return value is the only thing a caller may
rely on — because that is the reading under which the caveat is safe either way.
Flag for Alfred.

Independent of that argument, three of the 21 are **not** discretionary:

- `last-pair` must return the argument's own last cell (SRFI-1 structure, and
  the existing reference record already flags Motoi's answer as a divergence).
- `set-cdr!` must share the new tail, not copy it (R7RS §6.4).
- `list-copy` must produce a fresh cell at **every** spine position
  (list.sld:218-232 walks both lists and asserts `(not (eq? c cp))` at each cdr).

## Contradictions found in the existing reference

1. **`spec/srfi-1.slatl:64-66`** — `last-pair` is documented as *"the last pair;
   in Motoi a one-element list"*, with `(last-pair (list 1 2 3)) => (3)`. A
   one-element list is not the last pair. The generated part summary has
   promoted an implementation artifact to spec.
2. **`scheme/reference/39-list.slat`** `last-pair` — honest and already flagged:
   its caveats name both divergences (no shared cell, and empty list returned
   for improper arguments). It carries no `:status`, though; it should.
3. **`scheme/reference/39-list.slat`** `set-car!` / `set-cdr!` — both already
   `:status "needs-alfred"` and both already document the flat-array
   divergences in detail. **These two records go stale the moment the cons-cell
   engine lands**, and their examples currently assert the wrong behaviour as
   correct. They are the highest-priority rewrite in the chapter.
4. **`spec/srfi-1.slatl:73-75`** — `unzip` is listed as SRFI-1. SRFI-1 has
   `unzip1`…`unzip5` returning multiple values (list.sld:88-92, 364-374); a
   single `unzip` returning a list of lists is Motoi-own and is mis-cited.
5. **`lib/std/srfi-1.js:53-58`** binds five `!` names that do not appear
   anywhere in the larceny suite's SRFI-1 index (list.sld:3-163):
   `drop-while!`, `find-tail!`, `filter-map!`, `pair-for-each!`,
   `lset-adjoin!`. If the index is complete, these are invented names wearing a
   `:std "SRFI-1"` label. `split-at!` is the mirror-image error: it **is** in the
   index (list.sld:73) and has a test, and it is **not bound**.
6. **`lib/std/srfi-1.js:858-880`** — the 15 linear-update verbs are not subtly
   wrong, they are **deliberately aliased to their pure twins**. The loop at
   :863-876 does `def(bang, env.get(pure))`: `take!` and `take` are the same
   function object. The comment at :859-862 gives the reason, and it is an
   argument about the spec, not an oversight:

   > SRFI-1 permits a `!` procedure to reuse its argument's storage but does
   > NOT require it, and explicitly forbids callers from relying on either
   > behaviour. Motoi's lists are arrays, so the pure version already satisfies
   > the contract; binding the names keeps portable code running.

   **This is the weak reading of linear update, and it is the open question.**
   The conformance suite tests the *strong* reading — `list.sld:308-313`
   asserts `(eq? x y)` and `(eq? (cddr x) (cddr y))` after `take!`. Under the
   weak reading those assertions are testing something SRFI-1 does not
   promise; under the strong reading the aliasing is a defect. The two readings
   cannot both be right, and **all 23 `list.sld` failures sit exactly on this
   disagreement.** The 21 drafts here are written to the strong reading,
   because that is what the suite tests and what the cons-cell work implies —
   but the engine comment is a considered position, not a bug, and Alfred
   should overrule it explicitly rather than have it quietly reversed.
7. **The divergence is documented in the engine and nowhere else.** The
   generated help text at `lib/std/srfi-1.js:979` says of every `!` verb:
   *"Motoi's lists are arrays with no shared tail, so it is exactly `<pure>`."*
   That sentence is correct and it is the whole finding — but it lives only in
   a runtime doc string. No reference chapter carries it, which is why the
   verbs read as conformant to anyone who does not open the engine.
8. **20 SRFI-1 verbs are bound but undocumented.** Comparing `def('…')` in
   `lib/std/srfi-1.js` (62 names) against every name documented in
   `scheme/reference/`: `alist-cons`, `alist-copy`, `alist-delete`, `car+cdr`,
   `circular-list`, `circular-list?`, `dotted-list?`, `find-tail`, `length+`,
   `list=`, `lset-diff+intersection`, `lset-xor`, `map-in-order`, `not-pair?`,
   `null-list?`, `pair-fold`, `pair-fold-right`, `pair-for-each`,
   `unfold-right`, `unzip1`. The drafts here close two of them (`circular-list`,
   `pair-fold`); **18 remain**. This is the same implemented-but-undocumented
   state that let the aliasing ship unnoticed, so it is listed as a finding
   rather than left as a to-do.

## File naming

`!` → `-bang` in filenames. `take!` → `take-bang.slatl`.
