# Tag Audit — the slat tag set the fold needs

**Date:** 2026-07-29 · **Scope:** `scheme/ scheme-books/ word-books/ graphs/`
**Method:** grounded `grep -rhoE` counts on disk (commands below). Task #437.

## The two tag TIERS

Fold records carry tags from two sources:

1. **SOURCE tags** — already on the corpus records (authored). Must be present +
   consistent BEFORE the fold reads them.
2. **FOLD-TIME tags** — added by the pair GENERATOR at emit (they describe the
   pair, not the source). The generator must GUARANTEE these on every emitted pair.

## SOURCE-TAG census (grounded)

```
$ for k in :doc :section :audience :dialect :provenance :training-eligible :confidentiality; do
    grep -rhoE "$k" scheme/ scheme-books/ word-books/ graphs/ | wc -l; done
```
| tag | count | status |
|---|---|---|
| `:dialect` | 33,942 | ✅ ubiquitous |
| `:provenance` | 26,375 | ✅ |
| `:training-eligible` | 26,371 | ✅ (value nits, below) |
| `:doc` | 25,495 | ✅ |
| `:audience` | 18,850 | ⚠️ ~7.5k records short of the :doc population |
| `:confidentiality` | 18,842 | ⚠️ same ~7.5k gap + format-inconsistent |
| `:section` | **72** | ❌ **effectively UNTAGGED** — big gap |

### Value-consistency problems (ADD-only fixes)
- **`:training-eligible`** — 26,356 clean `#t`; a handful malformed
  (`true`, `to`, `#t"`, `(#t`). Normalize to `#t`.
- **`:confidentiality`** — mixed encodings: `:public` (17,964) vs `"public"`
  (449) vs bare `public` (419). Normalize to the keyword `:public`. **Three
  non-public values exist** (`"internal"`, `"restricted"`, `'personal-data`) —
  MUST be excluded from the fold by the training-eligible gate; review each.

## FOLD-TIME tags — added by the generator (NOT on source)

| tag | source count | note |
|---|---|---|
| `:bloom` | **0** | ❌ NOT on source at all — generator MUST add per pair (target bands 13–19% each of remember→create, per Mk2 ISB) |
| `:shape` | 15 | overlay; generator adds the pair-shape (R1/R2/…/C9/M/A/copilot) |
| `:philosopher` | 67 | overlay; generator adds the lens (all 16 must appear) |
| `:register` | 830 | overlay; kid-seed / layperson / PhD |
| `:lens` | 5 | overlay |
| `:axis` | 26,153 | ✅ present on graph nodes (the 4 Jung axes) |

## GRAPH relation keys
Deep census is in `graph-keys-audit.md` (the perennially-missed keys). From this
sweep the populated relation keys include `:appears-in-corpus` (21,632),
`:surrounding-words` (20,170), `:neighbor` (12,187), `:ppmi` (12,152),
`:tf-idf` (5,054), `:idf` (4,716), `:relations` (4,093), `:context-of-use`
(4,092). Cross-reference against the graph-keys audit for the complete set +
the honest-null vs unfilled split.

## THE REQUIRED TAG CONTRACT (every fold record)

Per CLAUDE.md: `:doc :section :audience :dialect :provenance :training-eligible
:confidentiality` — PLUS fold-time `:bloom :shape :philosopher :register` and,
where the pair derives from a graph node, the traversed graph key(s).

## Prep actions (ADD-only)
1. **Backfill `:section`** across all corpus records (72 → ~26k). Biggest gap.
2. **Backfill `:audience` + `:confidentiality`** on the ~7.5k short records.
3. **Normalize** `:training-eligible` → `#t` and `:confidentiality` → `:public`
   keyword; quarantine the 3 non-public records from the fold.
4. **Generator contract:** emit `:bloom :shape :philosopher :register` on EVERY
   pair; hard-fail any pair missing one (Step 3 gate, §11 of 00-BIG-FOLD-PLAN).
5. **Training-eligible gate:** the fold reader includes a record ONLY if
   `:training-eligible #t` AND `:confidentiality :public`. Enforces the
   secret-sauce holdback + scrub wall at read time.

## Commands used
```
grep -rhoE ':[a-z][a-z0-9-]+' scheme/ scheme-books/ word-books/ graphs/ | sort | uniq -c | sort -rn
grep -rhoE ':training-eligible +[^ )]+' ... | awk '{print $2}' | sort | uniq -c
grep -rhoE ':confidentiality +[^ )]+' ... | awk '{print $2}' | sort | uniq -c
```
