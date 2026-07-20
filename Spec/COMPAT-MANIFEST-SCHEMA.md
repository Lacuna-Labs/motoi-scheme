---
title: Compat Manifest Schema
version: 1.0
date: 2026-07-19
status: draft (awaiting Alfred review)
canonical: COMPAT-MANIFEST-SCHEMA.slat
---

# Compat Manifest Schema

## What this document is

The output format Rosetta produces after reading a Motoi identity SLAT + a variant's primitive registry + policy. Variants load compat manifests at startup to know how to bind each Motoi verb.

## The four bindings

Per doctrine (`[[identity-slat-rosetta-compat-architecture-2026-07-19]]`), Rosetta emits one of four bindings per verb:

| Kind | Meaning | Additional fields |
|------|---------|-------------------|
| `:native` | Variant provides the verb natively | `:variant-symbol` |
| `:reduced` | Variant lacks native but reduction chain bottoms out in its primitives | `:reduction`, `:primitives-required` |
| `:virtual` | Reduction can't bottom out; emit shape-conformant stub | `:virtual-shape`, `:sentinel-generator`, `:missing-primitives` |
| `:break` | Variant policy refuses virtualization | `:reason`, `:missing-primitives`, `:policy-rule-id` |

## Header

Each manifest starts with `(manifest-header ...)` carrying:

- Source hashes: `:source-identity-slat-sha`, `:source-primitive-registry-sha`, `:source-policy-sha`
- Compilation metadata: `:ts-compiled`, `:rosetta-version`, `:target-variant`, `:target-variant-version`
- Summary: `:binding-count`, `:counts-by-kind`

The three source SHAs pin exactly what went into this manifest. Any change to inputs produces a different manifest.

## Determinism contract

**Given the same `(identity-slat, primitive-registry, policy)`, Rosetta MUST produce the same manifest bit-for-bit.**

This is enforced by:

- No wall-clock timestamps in binding records (`:ts-compiled` in header is informational only)
- Bindings sorted lexicographically by `:name` before emit
- Rosetta's algorithm is total — no random tiebreaking
- `:manifest-hash` computed with `:ts-compiled` zeroed, so identical inputs → identical hash across time

## Rosetta compilation algorithm

1. Verify identity SLAT header hashes match locally cached floor + vocab SLATs. Refuse on mismatch.
2. Run identity SLAT validators V01–V09 (fatal). Abort on failure.
3. Build name-to-verb-record map.
4. Topologically sort verbs by reduction dependencies. Cycles fatal.
5. For each verb V in **reverse-topological order** (leaves first):
   - If V's name is in the variant's primitive registry → `:native`
   - Else if V's reduction resolves entirely to floor + previously-bound verbs → `:reduced`
   - Else consult policy:
     - If policy permits virtualization → `:virtual` (with sentinel generated from `:virtual-shape` per vocabulary rules)
     - Else → `:break`
6. Sort bindings lexicographically.
7. Compute counts.
8. Emit header, bindings, footer with `:manifest-hash` (with `:ts-compiled` zeroed).

## Guarantees

- **Deterministic:** same inputs, same `:manifest-hash`
- **Total:** every verb receives exactly one binding
- **Traceable:** `:missing-primitives` on `:virtual`/`:break` show exactly why
- **Auditable:** manifest is human-readable Scheme data

## Validator rules

**Fatal (M01–M08):**

- M01: every source-SLAT verb appears exactly once
- M02: every `:reduced` binding's identifiers resolve in variant environment
- M03: every `:virtual` binding's `:kind` is in the vocab
- M04: every `:break` binding has non-empty `:missing-primitives`
- M05: header `:binding-count` == footer `:binding-count-actual`
- M06: header `:counts-by-kind` == footer `:recomputed-counts-by-kind`
- M07: `:manifest-hash` matches recomputed hash
- M08: bindings sorted lexicographically by `:name`

**Warn (M09–M10):**

- M09: `:break` count < 5% of total (else variant should extend registry or loosen policy)
- M10: variant version matches registry version

## Loader contract (variant runtime side)

The variant's Motoi-compat loader is a ~50-line Scheme routine that reads the manifest at startup and installs bindings into the variant's evaluation environment. Canonical implementation:

```scheme
(define (motoi/install-compat-manifest env manifest-path)
  (let* ((raw       (slat/read-file manifest-path))
         (header    (slat/find raw 'manifest-header))
         (bindings  (slat/find-all raw 'binding))
         (footer    (slat/find raw 'manifest-footer)))
    (unless (slat/hash-verified? raw)
      (error 'motoi/manifest-tampered manifest-path))
    (for-each
      (lambda (b)
        (let ((name (slat/get b :name))
              (kind (slat/get b :binding-kind)))
          (case kind
            ((:native)
             (env-alias! env name (slat/get b :variant-symbol)))
            ((:reduced)
             (env-define! env name (slat/get b :reduction)))
            ((:virtual)
             (env-define! env name (slat/get b :sentinel-generator)))
            ((:break)
             (env-define! env name
               (lambda args
                 (error 'motoi/verb-broken
                        name
                        (slat/get b :reason)
                        (slat/get b :missing-primitives))))))))
      bindings)
    (log/info 'motoi/manifest-installed
              :verbs (length bindings)
              :variant (slat/get header :target-variant)
              :hash (slat/get footer :manifest-hash))))
```

The loader trusts the manifest — validation is Rosetta's compile-time job, not the loader's load-time job. The loader verifies `:manifest-hash` on load but does not re-run V01–V07.

## Composes with

- `IDENTITY-SLAT-V1.slat` — the input format Rosetta consumes
- `R7RS-SMALL-PRIMITIVE-FLOOR.slat` — the guaranteed floor
- `VIRTUAL-SHAPE-VOCABULARY.slat` — where virtual sentinel shapes come from
- `[[identity-slat-rosetta-compat-architecture-2026-07-19]]` — doctrine
- `[[variant-not-dialect-terminology-2026-07-19]]` — terminology
- `[[no-contaminants-provenance-rule-2026-07-17]]` — every binding traces to a source-SLAT verb

## Cosign / status

- **Author:** Claude
- **Reviewer:** Alfred (pending)
- **Status:** draft; awaiting review before Rosetta v0.1 prototype begins
