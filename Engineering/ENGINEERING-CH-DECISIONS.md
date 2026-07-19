---
title: Decisions and Conventions
author: Alfred
source-slat: ENGINEERING-CH-DECISIONS.slat
generated: do not hand-edit — rendered from SLAT
---

# Decisions and Conventions

> **Dialect:** `motoi`, `sakura` — Default: applies to both dialects. When a split exists between Motoi and Sakura, add sibling records in the same doc, each tagged with a per-record :dialect override.

## Id

22

## Companion Of

docs/ENGINEERING.md §22

## Points At

- - docs/ENGINEERING-DECISIONS.slat
- The log of deliberate deviations from R7RS-small, with the WHY.

- - docs/CONVENTION.slat
- The positive statement of what our conventions ARE.

## Chapter

22

## Id

22.1

## Body

Motoi Scheme is a small R7RS-flavored Scheme with a handful of deliberate deviations. Every place we depart from R7RS-small is logged in the decisions file. Every positive convention is logged in the conventions file. Read them together. When a rule in the conventions file breaks from R7RS, you can find the WHY under the decision-id it cross-references.

## Doctrine

- Alfred: 'Stay as close to Scheme convention as you can within Scheme so that it is Scheme.'
- Alfred: 'They've tried things and talked about it longer than I have, so I trust their judgment.'
- Alfred: 'The minute people start using it, we lock it in.'

## Chapter

22

## Id

22.2

## Body

Every entry in ENGINEERING-DECISIONS.slat is a single (decision ...) record. Only :id, :what, :why, :date, and :status are required. The rest are strongly encouraged — the point of :alternatives-rejected is that a future maintainer who wonders 'why didn't we just do X' will find the entry naming X and the reason we didn't.

## Fields

- **id:** stable, monotonic, string "NNN"
- **what:** one-sentence summary
- **why:** one-paragraph reasoning
- **date:** ISO-8601 YYYY-MM-DD
- **status:** active | superseded | reversed
- **alternatives-rejected:** list of (name reason) pairs
- **convention:** what we do instead
- **examples:** (:pre ...) (:post-* ...) code samples
- **affects:** scope of the deviation
- **author:** who made the call
- **cross-refs:** R7RS sections, SRFI numbers, doc anchors
- **supersedes:** id of an old decision this reverses (optional)
- **superseded-by:** id of a later decision that reverses this (optional)

## Chapter

22

## Id

22.3

## Body

When we change our minds: (1) add a new decision entry with a fresh monotonic :id; (2) name the id it replaces via :supersedes 'NNN'; (3) edit the old entry to add :status 'superseded' and :superseded-by 'MMM' pointing at the new one; (4) do NOT delete, do NOT renumber. The history of the reasoning IS the point.

## Example In Log

- - decision-008
- no hash tables / vectors / records — the austere v1 stance

- - decision-009
- adopted SRFI-9 records, SRFI-69 hash tables, R7RS vectors — reverses 008

- - outcome
- A reader in 2028 wondering why we started austere and expanded finds the whole arc.

## Chapter

22

## Id

22.4

## Body

If you find yourself about to deviate from R7RS-small — or you find an existing deviation that isn't logged — the workflow is: (1) write the entry in ENGINEERING-DECISIONS.slat with the next :id, listing alternatives-rejected honestly; (2) add the positive rule to CONVENTION.slat cross-referencing the new decision-id; (3) open a PR, discuss, land. If the deviation is not yet blessed, do not merge the code. Un-logged deviations are bugs, not features.

## Smell

If you can't name a rejected alternative, that's a smell. Every real decision has losers.

## Chapter

22

## Id

22.5

## Body

Stay close to Scheme. Break only when the implementation demands it. When we break, log what we did and why.

## Author

Alfred

## Date

2026-07-14

<!-- warning: unknown record type "seeded-decisions" — rendered raw -->
```lisp
(seeded-decisions :count 16 :file "docs/ENGINEERING-DECISIONS.slat" :list (("001" "Positional args, no keyword-arg syntax in interp") ("002" "No polymorphic `get` verb") ("003" "Lisp-1 namespace") ("004" "No call/cc") ("005" "No eval, no read-from-string") ("006" "Immutable pair cells") ("007" "One-level quasiquote nesting") ("008" "No hash tables / vectors / records at v1 (SUPERSEDED by 009)") ("009" "Adopt SRFI-9 records, SRFI-69 hash tables, R7RS vectors") ("010" "No ports; all I/O verb-gated") ("011" "No numerical tower — JS Number for everything") ("012" "Practical hygiene, not full R7RS hygiene") ("013" "Kebab-case, `/` namespace, `!` mutation, `?` predicate") ("014" "Return values match :signature") ("015" "Tail-call optimization via trampolined sentinels") ("016" "R7RS §6.7 string-escape reader")))
```

<!-- warning: unknown record type "seeded-conventions" — rendered raw -->
```lisp
(seeded-conventions :count 12 :file "docs/CONVENTION.slat" :areas ("signatures" "accessors" "records" "collections" "error handling" "immutability" "control flow" "macros" "documentation" "IO" "numbers" "naming"))
```
