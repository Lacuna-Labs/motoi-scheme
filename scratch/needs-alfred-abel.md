# needs-alfred — Abel Sussman, book-claim repair (2026-08-04)

Things I found while repairing the 13 assigned book files that I did **not**
act on, because acting would have meant guessing. Each entry says what is
grounded, what is not, and what would settle it.

---

## 1. The reference contradicts itself on the "missing metadata" value

**Status: I changed the engine. The change is grounded. A second question it
raises is not, and that one is yours.**

### What was broken

`type-of`, `doc-of`, `source-of`, `arity-of` and `help` returned JS `null` for
a name they had no record of. `toScheme` passes non-arrays through unchanged,
so that `null` crossed into Scheme as a value satisfying *nothing*: it was
truthy, `null?` said `#f`, `string?` said `#f`, and `write` printed zero
characters. An answer-shaped nothing that never raises — the run-only gate saw
green.

### How I grounded the fix

The reference's own runnable example, `00b-introspection.slat:1018`:

```scheme
(define (contract-shape? v) (let ((t (type-of v))) (or (null? t) (string? t))))
```

It answered `#f` for `car`, against `:signature "(type-of symbol-or-string) ->
string-or-null"` (:996) and `:invariant "∀ v ∈ Sym. type(type-of(v)) ∈ {String,
Null}."` (:1040). `arity-of` carries the same `-> integer-or-pair-or-null`
(:916). Fix: return `NIL` instead of JS `null` (`lib/system/introspection.js`).
The reference's example now answers `#t`.

### The part I could not settle

The same reference chapter contains *other* runnable examples that require the
miss value to be **falsey**, which `NIL` is not (empty list is truthy in
Scheme):

- `(or (type-of 'map) 'no-contract)` — `:cs-program`
- `(filter (lambda (v) (type-of v)) (all-verbs))` — keeps all 1865 either way
- `(define (well-typed-vocabulary) ...)` — `:eng-program`

The normative fields (`:signature`, `:invariant`, `:math`) say null. The
incidental example bodies assume falsey. Both cannot hold. I took the normative
fields, per "the reference IS the language," and left the three examples wrong.

**Decision needed:** either (a) the examples are the defect and get rewritten
to test with `null?`, or (b) the miss value should be `#f` and the normative
`-> ...-or-null` wording is the defect. I did not pick.

---

## 2. The registry has no doc strings for most of what the manual documents

**Status: measured, not a book defect, not fixed.**

Measured on a fresh runtime, two independent extractors agreeing:

| metric | count |
|---|---|
| total verbs | 1865 |
| perm `read` | 1542 |
| tier `base` | 326 |
| **no doc string at all** | **1446** |

`(help 'cortex/remember)` → `((:name "cortex/remember") (:doc "") (:examples ())
(:perm "paint"))` while `scheme/reference/19-cortex.slat:240-249` carries a full
entry with `:signature "(cortex/remember key value) -> #t"` and `:arity "2"`.
The whole `time/*` and `cortex/*` surface is like this. The manual knows and the
runtime does not.

This is a registration-time metadata gap, not a book error and not a language
error, and populating it is a bulk job with a real risk of fabrication if done
by hand. I wrote the measured numbers into `11-the-registry` §11.18 as a finding
rather than inventing the missing docs.

---

## 3. `help` does not project `deprecated` / `aliasFor`

**Status: book fixed to match the engine. Flagging in case the engine is what
you consider wrong.**

`src/verbRegistry.js:196-200` stores `deprecated` and `aliasFor`.
`src/introspect.js::help()` does not return them. The reference's `help` record
(`00b-introspection.slat:772-790`) lists the projection as exactly `:name, :doc,
:arity, :examples, :namespace, :tier, :perm, :source, :since` — no alias fields.

So the engine matches the reference and `02-verb-metadata` §2.37 was the thing
that was wrong (it claimed `help` surfaced both, and separately claimed
`cortex/remember` is a deprecated alias — the reference documents it as
first-class). I repaired the book.

But an alias field that nothing can read is close to dead weight. If the intent
was for introspection to surface deprecation, the reference needs the two fields
added to `help`'s `:explanation` first, and then the engine follows. Reference
first, per doctrine — so I did not touch either.

---

## 4. Shared-file edit other agents are running against

`scratch/audit-ref.py::run_one` now gives **every run its own empty
`MOTOI_HOME`** (temp dir, torn down after). `BOOK_AUDIT_HOME=shared` restores
the previous behavior.

Why: cortex writes persist to `$MOTOI_HOME/copilot/cortex.slatl`
(`src/paths.js:18,33`) and verb-stats to the same root
(`lib/system/verb-stats.js:56`). With no isolation the gate was writing into the
developer's real store and reading it back, so every cortex and stats claim in
the corpus measured "however many times this gate has ever run on this machine."
Watched live:

```
(length (cortex/query :subject 'reader :predicate 'preferred-color))
book claims 1; gate said 12, then 34, then 45 — same code, same day.
```

Fresh-home reruns gave 1, 2, 3 as expected.

**Other agents should know:** this changes measured values for every
cortex/stats-touching block, in both directions. Anything spliced from a
pre-change measurement of those verbs is suspect. Gate self-test PASS (11
cases) after the change.

---

## 5. Not a defect, but the next reader will trip on it

`current-fuel`, `gc-info`, `allocated-bytes`, `with-fuel` and `current-time-ms`
are **modelled stubs defined in the chapter setup** of
`15-performance-introspection`, not real verbs. The modelled `current-fuel`
decrements by exactly 1 per call, so the "measure what this expression burns"
idiom reports `1` regardless of what it wraps. I left the model alone and
rewrote the prose to name the hazard, because building real probes is a language
decision, not a book repair.

Same shape in `14-composer-introspection`: `runtime-shape` is a two-line chapter
helper that cannot distinguish a canvas from a widget (neither is a pair, both
fall to `'record`). Left as-is, prose now says so and shows a real discriminator.

`substrate-power-tier` (used in `appendix-g-debuggers`) is **not a verb** — the
substrate tier is read internally by `src/dispatch.js` and never exposed to
Scheme. `play-sound` is not a verb either. I rewrote that walkthrough around
real verbs and named the gap rather than inventing a getter.
