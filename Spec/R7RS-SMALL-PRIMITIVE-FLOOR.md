---
title: R7RS-small Primitive Floor
version: 1.0
date: 2026-07-19
status: draft (awaiting Alfred review)
canonical: R7RS-SMALL-PRIMITIVE-FLOOR.slat
---

# R7RS-small Primitive Floor

## Purpose

Declares the canonical list of verbs every Motoi **variant** must guarantee. This is the bottom of every reduction chain in the identity SLAT: each Motoi verb's `:reduction` lambda must terminate in verbs declared here (or in verbs elsewhere in the identity SLAT that themselves terminate here).

**Alfred (2026-07-19):** "R7RS-small pure. Not R7RS-small plus a few conveniences."

## What "floor-eligible" means

A primitive is on the floor when a conforming R7RS-small implementation must ship it. That's the case whether or not the R7RS-small standard itself defines the primitive as a reduction of other primitives (e.g., `map` in terms of `car`/`cdr`/`null?`). The floor is what an implementation ships; Rosetta trusts that shipping.

## Source of authority

R7RS-small standard, Alex Shinn et al., 2013. Section citations in the SLAT reference the standard's numbering (e.g., `R7RS §6.4` for pairs and lists).

## Scope

- **In scope:** 299 R7RS-small primitive records — special forms, procedures, and the small standard libraries `(scheme char)`, `(scheme inexact)`, `(scheme complex)`, `(scheme load)`, `(scheme file)`, `(scheme process-context)`, `(scheme time)`, `(scheme read)`, `(scheme write)`, `(scheme repl)`. (Note: the count includes some R7RS-declared aliases like `quotient`/`remainder`/`modulo` alongside their `floor-*`/`truncate-*` equivalents.)
- **Out of scope:** Motoi extensions. Every framebuffer/sprite/sound/motion/ai/cortex/artifact verb lives in the identity SLAT (per `IDENTITY-SLAT-V1.slat`) with a `:reduction` that composes back to the floor. Adding a verb here would leak Motoi convenience into the compat contract.

## How Rosetta uses this file

For each verb in Motoi's identity SLAT:

1. Rosetta walks the `:reduction` lambda.
2. Every name reference must resolve to (a) another verb in the identity SLAT with its own reduction, or (b) a `:name` declared in this file.
3. If a verb's reduction transitively terminates only in names from this file, and the target variant provides bindings for all such names, Rosetta emits `:reduced`.
4. If a name in the reduction chain is NOT in this file AND not in the identity SLAT, the identity SLAT is malformed and validation fails.

## How a variant satisfies the floor

The variant runtime must provide a name binding for every `:name` recorded here, honoring the R7RS-small semantics cited by section. If a variant cannot provide a given primitive, Rosetta cannot emit a `:reduced` binding that terminates through it — the verb falls to `:virtual` (or `:break` per policy).

## Structure of the SLAT

Each primitive is one line:

```
(primitive
  :name <symbol>
  :section "<R7RS section number and title>"
  :kind <procedure | syntax>
  :summary "<one line>"
  :floor-eligible-because "<why this is bottom-of-reduction, not further reducible>")
```

## Composes with

- `IDENTITY-SLAT-V1.slat` — verbs use this floor as their bottom-most reference set
- `COMPAT-MANIFEST-SCHEMA.slat` — Rosetta cross-checks reductions against this file
- `VIRTUAL-SHAPE-VOCABULARY.slat` — the return shapes many of these primitives produce
- `[[identity-slat-rosetta-compat-architecture-2026-07-19]]` doctrine
- `[[no-contaminants-provenance-rule-2026-07-17]]` — every entry cites its R7RS section
- `[[variant-not-dialect-terminology-2026-07-19]]`

## Cosign / status

- **Author:** Claude (as Motoi architecture support)
- **Reviewer:** Alfred (pending)
- **Status:** draft; awaiting review before Rosetta v0.1 depends on it
