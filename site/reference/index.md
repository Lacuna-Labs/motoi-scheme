---
title: Reference
---

# Motoi Scheme Reference

The canonical reference is `Scheme/MOTOI-SCHEME-REFERENCE.slat` in
the repo. It ships as a single SLAT file — one record per verb, one
record per core form — with fields for signature, dialect, provenance,
and training eligibility.

**Reference IS the language.** When code and reference disagree, reference wins.

## Contents

- **Core forms** — special forms, syntax, macro system.
- **Base library** — arithmetic, lists, strings, vectors, records.
- **Dialect surface** — verbs tagged by dialect (`base`, `sakura`, `curator`, `lacuna`).

## How to read it

The SLAT file is the source of truth. Per-verb pages will be
auto-generated into `site/reference/<verb>.md` by a future
`scripts/build-reference.mjs` — that generator is not yet built.
Until it lands, read the source directly:

```
Scheme/MOTOI-SCHEME-REFERENCE.slat
```

Or use the REPL's introspection:

```scheme
(introspect 'car)
(introspect 'artifact/close)
```

## Generator status

- [ ] `scripts/build-reference.mjs` — parse SLAT, emit one MD per verb
- [ ] Sidebar auto-generation from verb list
- [ ] Cross-links between verbs

Blockers: none — the SLAT parser exists at `src/slat.js`. When Alfred
says go, the generator can be written in a single pass.
