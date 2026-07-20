---
title: Identity SLAT v1 — Format Spec
version: 1.0
date: 2026-07-19
status: draft (awaiting Alfred review)
canonical: IDENTITY-SLAT-V1.slat
---

# Identity SLAT v1 — Format Spec

## What this document is

The format that Motoi uses for its per-release **identity artifact**: `MOTOI-IDENTITY-<version>.slat`.

**This spec is the format only.** It does not contain the 459 Motoi verb records — that authoring is a separate (large) lane, held for post-Motoi-ship. This document defines the schema so that lane can proceed against a stable target.

## Why the identity SLAT exists

Per doctrine (`[[identity-slat-rosetta-compat-architecture-2026-07-19]]`), Motoi's compat contract with downstream variants is held by a **runtime translation layer** (Rosetta), not by cross-training language models. Rosetta consumes Motoi's identity SLAT and emits a compat manifest for each variant. For this to work:

1. The identity SLAT must carry **executable operational semantics** per verb, not just prose.
2. It must be **deterministic** — no LLM in the loop.
3. It must be **homoiconic Scheme** — code is data.

## Header

Every identity SLAT starts with one `(identity-header ...)` record carrying:

- **Required:** `:motoi-version`, `:ts-published`, `:source-git-sha`, `:floor-slat-sha`, `:vocab-slat-sha`, `:hash-algorithm`, `:verb-count`
- **Optional:** `:previous-identity-slat-sha`, `:changelog-ref`, `:cosigners`, `:notes`

The header pins the exact versions of `R7RS-SMALL-PRIMITIVE-FLOOR.slat` and `VIRTUAL-SHAPE-VOCABULARY.slat` this identity SLAT was built against. Rosetta refuses to consume an identity SLAT whose floor/vocab SHAs don't match its local copies — version drift is a bug, not a merge.

## Per-verb record — four load-bearing fields

Every `(verb ...)` record extends the legacy `MOTOI-SCHEME-REFERENCE-SCHEMA` with **four required identity fields**:

### 1. `:signature-data`

The verb's contract as machine-readable data (not prose):

```scheme
(:args ((path (:kind string :encoding utf8)))
 :returns (:kind port :direction in :closable #t :binary #f)
 :variadic? #f)
```

Each shape uses the `:kind` vocabulary from `VIRTUAL-SHAPE-VOCABULARY.slat`.

### 2. `:contract`

Executable Scheme predicates over inputs and returned value:

```scheme
(:precondition  (lambda (args)          ...)   ; returns #t/#f
 :postcondition (lambda (args returned) ...))  ; returns #t/#f
```

Predicates must reference only names from `R7RS-SMALL-PRIMITIVE-FLOOR.slat` or from other verb records in this identity SLAT.

### 3. `:reduction`

Executable Scheme code — a lambda that composes this verb from more primitive verbs:

```scheme
(lambda (path)
  (call-with-input-file path
    (lambda (port)
      (letrec ((loop ...))
        (loop '())))))
```

Every name reference in the reduction body must resolve to (a) another verb in this identity SLAT, or (b) a name in `R7RS-SMALL-PRIMITIVE-FLOOR.slat`. Reduction chains must terminate — Rosetta walks the DAG and refuses cycles.

### 4. `:virtual-shape`

A single shape declaration from `VIRTUAL-SHAPE-VOCABULARY.slat`. Rosetta uses this to synthesize a virtual sentinel when the verb cannot be reduced:

```scheme
(:kind list-of :element-kind (:kind string) :length-hint :unbounded)
```

### Bonus: `:primitives-required`

Redundant with `:reduction` (a walker could derive it), but explicit for fast validation and human review. The validator re-derives it and errors on disagreement.

## Legacy fields still apply

Every field from `MOTOI-SCHEME-REFERENCE-SCHEMA` — `:name`, `:library`, `:signature` (prose), `:summary`, `:examples`, `:impl-status`, `:pure`, `:complexity`, `:raises`, etc. — remains valid. Identity SLAT is a **strict superset** of the legacy reference schema.

## Validator rules

**Fatal (V01–V09):**

- V01: `:name` globally unique
- V02: `:primitives-required` names resolve to floor or another verb in this SLAT
- V03: `:virtual-shape :kind` is one of the 14 kinds
- V04: reduction free-identifier set equals `:primitives-required`
- V05: reduction evaluates to a lambda of the declared arity
- V06: contract predicates only reference floor + this-SLAT verbs
- V07: reduction chain terminates in the floor (no cycles)
- V08: header `:verb-count` equals footer `:verb-count-actual`
- V09: footer `:identity-hash` matches recomputed hash

**Warn (V10–V12):**

- V10: `:kind any` appears in <10% of verbs (vocabulary-gap indicator)
- V11: prose `:signature` and structured `:signature-data` agree
- V12: every verb has at least one example (legacy)

## Worked examples

The SLAT contains five worked examples, tiered by complexity:

1. **Simple** — `safe-divide` (arithmetic; reduction uses only floor primitives)
2. **Medium** — `list/take-safely` (list op; still floor-only)
3. **Complex** — `file/read-lines` (I/O; floor port operations)
4. **Complex-cascading** — `file/count-lines` (uses `file/read-lines`; reduction chain 2-deep before hitting floor)
5. **Control** — `motoi/quit` (`:kind never` with variadic args)

## Footer

Every identity SLAT ends with one `(identity-footer ...)` record carrying:

- `:verb-count-actual` (must match header)
- `:floor-refs-count` (distinct floor primitives referenced)
- `:virtual-shape-kinds-used`
- `:identity-hash` (SHA-256 of all normalized records)

## Producer guidance (Motoi maintainers)

- Author incrementally as you extend Motoi.
- Reductions that terminate in the floor are easier for Rosetta to virtualize partially than reductions that cascade through many verbs.
- When a verb is a floor primitive re-export, still declare its identity record explicitly.
- Extensions that add verbs without adding floor dependencies are backward-compatible. Adding a floor dependency = MAJOR version bump.
- Every verb traces to a book paragraph or graph node (`[[no-contaminants-provenance-rule-2026-07-17]]`).

## Consumer guidance (Rosetta)

- Verify `:floor-slat-sha` and `:vocab-slat-sha` against local copies. Refuse on mismatch.
- Run fatal validators first. Emit warns but proceed.
- Topologically sort verbs by reduction dependencies.
- For each verb, given a target variant's primitive registry + policy, decide binding kind (see `COMPAT-MANIFEST-SCHEMA.slat`).

## What this spec is NOT

- NOT the 459 verb records themselves. That's a separate authoring lane (held).
- NOT a Rosetta implementation. That's a separate build lane (see A-5).
- NOT a runtime — the identity SLAT is data. Rosetta reads it. Variants load compat manifests derived from it.

## Composes with

- `R7RS-SMALL-PRIMITIVE-FLOOR.slat` — the bottom-most name set
- `VIRTUAL-SHAPE-VOCABULARY.slat` — the closed set of `:kind` values
- `COMPAT-MANIFEST-SCHEMA.slat` — Rosetta's output format
- `MOTOI-SCHEME-REFERENCE.slat` — the legacy schema this extends
- `[[identity-slat-rosetta-compat-architecture-2026-07-19]]` — doctrine
- `[[no-contaminants-provenance-rule-2026-07-17]]` — every verb has provenance
- `[[variant-not-dialect-terminology-2026-07-19]]` — terminology

## Cosign / status

- **Author:** Claude
- **Reviewer:** Alfred (pending)
- **Status:** draft; awaiting review before A-1 retroactive-reduction lane begins
