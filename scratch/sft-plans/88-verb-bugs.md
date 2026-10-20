# 88-verb authoring — impl bugs found (needs-alfred)

Bugs surfaced while authoring reference records for the 27 alg gap verbs
(2026-07-29). Each was probed live via `./bin/motoi run`. Per the floor
doctrine, the reference does not document the buggy case; these are logged here
for Alfred and the affected records either use only honest inputs or are stubbed
`:impl-status "needs-alfred"`.

## alg/is-simple? — WRONG on non-abelian (D3)
- `(alg/is-simple? (alg/dihedral 3))` returns `#t`. D3 (isomorphic to S3) is NOT
  simple: its rotation subgroup C3 is a proper nontrivial normal subgroup, so the
  correct answer is `#f`.
- Correct on cyclic groups: `(alg/is-simple? (alg/cyclic 5))` -> `#t` (prime
  order, genuinely simple), `(alg/is-simple? (alg/cyclic 6))` -> `#f` (composite).
- ACTION: record documents is-simple? using cyclic prime-vs-composite ONLY; the
  buggy D3 case is not shown. impl at lib/base/alg.js — the simplicity test does
  not detect the normal rotation subgroup of a dihedral group.

## alg/normalizer — WRONG on dihedral literal subgroups
- `(alg/normalizer (alg/dihedral 3) '((rot 0) (rot 1) (rot 2)))` returns `()`.
  The rotation subgroup IS normal in D3, so the normalizer should be the whole
  group (all 6 elements). Also `(alg/normalizer (alg/dihedral 3) '((rot 0)))`
  (trivial subgroup) returns `()` when it should be all 6.
- Correct on cyclic (abelian) groups: every subgroup is normal, and the impl
  returns the whole group, e.g. `(alg/normalizer (alg/cyclic 6) '(0 3))` ->
  `(0 1 2 3 4 5)`.
- ACTION: record documents normalizer on cyclic groups only, where it is
  reliably correct. impl at lib/base/alg.js — conjugation/membership check
  mishandles tagged dihedral elements.

## alg/subgroups — returns () on dihedral
- `(alg/subgroups (alg/dihedral 3))` returns `()` — D3 has 6 subgroups. Correct
  on cyclic: `(alg/subgroups (alg/cyclic 6))` -> `((0)(0 3)(0 2 4)(0 1 2 3 4 5))`
  (the 4 subgroups of C6, correct).
- ACTION: record documents subgroups on cyclic groups only. impl at
  lib/base/alg.js — subgroup enumeration fails to find subgroups in a tagged
  dihedral element list.

## alg/is-subgroup? — WRONG (#f) on the dihedral rotation subgroup
- `(alg/is-subgroup? (alg/dihedral 3) '((rot 0) (rot 1) (rot 2)))` returns `#f`.
  The rotations form a genuine subgroup C3, so the answer should be `#t`.
- Correct on cyclic: `(alg/is-subgroup? (alg/cyclic 6) '(0 2 4))` -> `#t`,
  `(alg/is-subgroup? (alg/cyclic 6) '(1 2))` -> `#f` (correctly rejected).
- ACTION: record documents is-subgroup? on cyclic groups only. impl at
  lib/base/alg.js — closure/inverse check mishandles tagged dihedral elements.

## alg/subgroup and alg/generate — duplicate elements on dihedral
- `(alg/subgroup (alg/dihedral 3) '((rot 1)))` ->
  `((rot 0) (rot 1) (rot 1) (rot 2))` — `(rot 1)` appears twice; the generated
  subgroup should be the 3 distinct rotations `((rot 0)(rot 1)(rot 2))`.
- `(alg/generate (alg/dihedral 3) '((rot 1)))` has the same duplicate.
- Correct on cyclic: `(alg/subgroup (alg/cyclic 6) '(2))` -> `(0 2 4)` (clean),
  `(alg/generate (alg/cyclic 6) '(1))` -> `(0 1 2 3 4 5)` (clean).
- ACTION: both records document subgroup/generate on cyclic groups only, where
  the closure is deduplicated correctly. impl at lib/base/alg.js — the closure
  loop for tagged dihedral elements does not deduplicate on the element tag.
