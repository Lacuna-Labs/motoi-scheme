---
title: Virtual Shape Vocabulary
version: 1.0
date: 2026-07-19
status: draft (awaiting Alfred review)
canonical: VIRTUAL-SHAPE-VOCABULARY.slat
---

# Virtual Shape Vocabulary

## Purpose

When a variant lacks the primitives to satisfy a Motoi verb's `:reduction`, Rosetta emits a `:virtual` binding. The virtual binding is a shape-conformant **stub** — a lambda that returns a structurally-correct sentinel value declared by the verb's `:virtual-shape`.

This document defines the closed set of `:kind`s a verb author may use in `:virtual-shape`. **Small vocabulary is a feature:** the more kinds, the harder the virtualization contract is to reason about.

## The 14 shape kinds

| # | :kind | Purpose |
|---|-------|---------|
| 1 | `port` | Textual/binary I/O port |
| 2 | `record` | Structured record with fields |
| 3 | `list-of` | Proper list of a declared element shape |
| 4 | `number` | Numeric value with optional range/exactness/domain |
| 5 | `string` | Textual string with optional length/encoding |
| 6 | `symbol` | Symbolic name, optionally from a declared set |
| 7 | `boolean` | Scheme `#t`/`#f` with declarable virtual default |
| 8 | `procedure` | Callable with declared signature |
| 9 | `promise` | Delayed computation (R7RS §4.2.5) |
| 10 | `hash-table` | Key-value hash-table (SRFI-69 shape) |
| 11 | `bytevector` | Byte vector (R7RS §6.9) |
| 12 | `effect-channel` | Long-lived side-effect resource (fb, audio, sensor, remote) |
| 13 | `never` | The verb does not return (exit, error, infinite loop) |
| 14 | `any` | Dynamic type — escape hatch |

## Sentinel design principle

A virtual sentinel must satisfy the type predicates a caller might apply to a real value of the shape. E.g., a virtualized port sentinel satisfies `(port?)` and `(input-port?)` so that downstream code branching on those predicates does not crash. Reads/writes on the sentinel return declared defaults (EOF for reads, void for writes) so that downstream code proceeds without propagating an error.

## Extension policy

New shape kinds require:

1. A doctrine memory documenting the shape's motivation
2. Alfred cosign
3. An update to `IDENTITY-SLAT-V1.slat` referencing the new shape
4. An update to Rosetta's sentinel generator

**Do not grow this vocabulary casually.** If a verb's return can be captured by an existing shape (even with a hint slot), use the existing shape.

## When `:kind any` is used

`:kind any` is the escape hatch when the return type is truly dynamic (e.g., `eval` returns whatever the evaluated form returns). If more than 10% of Motoi verbs use `:kind any`, we have a vocabulary gap.

## When `:kind never` is used

For verbs that do not return normally (exit, error, infinite loops). The virtual stub performs a control effect (raise), not a value return. This is the only shape whose sentinel is not a value.

## Consumed by

- `IDENTITY-SLAT-V1.slat` — verb `:virtual-shape` field declares a shape from this file
- `COMPAT-MANIFEST-SCHEMA.slat` — Rosetta emits sentinels matching these shapes

## Composes with

- `[[identity-slat-rosetta-compat-architecture-2026-07-19]]` — architecture doctrine
- `[[variant-not-dialect-terminology-2026-07-19]]` — terminology
- `[[no-contaminants-provenance-rule-2026-07-17]]` — vocabulary derives from R7RS + verb-authoring practice

## Cosign / status

- **Author:** Claude (as Motoi architecture support)
- **Reviewer:** Alfred (pending)
- **Status:** draft; awaiting review
