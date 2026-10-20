# 88-verb authoring — ground truth + honest-representation matrix (2026-07-29)

Probed live via `./bin/motoi run`. This is the DRIFT-RECONCILE + real-signature
record that every authoring lane MUST obey. **Floor doctrine: the reference
cannot lie.** Only document a verb with inputs where its output is
mathematically correct. Where the impl is buggy on all natural inputs, author a
short `:status "needs-alfred"` stub and STOP — do not paper over it.

## alg (03-alg.slat) — 28 gap verbs

### Group representation is load-bearing
- `alg/cyclic n` → **Cayley table** (list of rows). Real group object.
  Predicates CORRECT on it.
- `alg/dihedral n` → tagged element list `((rot k)... (ref k)...)`. Real group;
  `alg/op` dispatches correctly. Predicates CORRECT (except is-simple?, see bugs).
  Note `alg/dihedral 3` ≅ S3 — use it for the honest non-abelian example.
- `alg/zn n` → **bare element list** `(0 1 2 3 4 5)`. NOT a full group object
  (`alg/is-group?` → #f). Group predicates give WRONG answers on it. Use zn only
  for the zn-ring verbs, never for group-theory predicates.
- `alg/symmetric n` → **bare permutation list**. Group predicates give WRONG
  answers (exponent S3→1, is-simple S3→#t, is-solvable S3→#f, derived mixes a
  stray `0`). Feed alg/symmetric output ONLY to per-permutation verbs
  (perm-cycles, perm-fixed-points, permutation-compose), never to group predicates.

### Signatures (from lib/base/alg.js def() lines) + verified honest behavior
- `(alg/action G x act)` — act is `(lambda (g x) ...)`; returns image. VERIFIED.
- `(alg/alternating n)` → A_n as perm list. `(alg/alternating 3)` →
  `((0 1 2)(2 0 1)(1 2 0))`. n>8 → 'use-backend. VERIFIED.
- `(alg/centralizer G x)` → element list. On D3, centralizer of identity = whole
  group (6). VERIFIED.
- `(alg/commutator G a b)` = a·b·a⁻¹·b⁻¹. VERIFIED on D3.
- `(alg/derived-subgroup G)` — CORRECT on Cayley/dihedral: derived-C6 → `(0)`,
  derived-D3 → the 3 rotations `((rot 0)(rot 2)(rot 1))`. WRONG on alg/symmetric.
- `(alg/exponent G)` = lcm of element orders. exponent-C6→6, exponent-D3→6.
  CORRECT on Cayley/dihedral; WRONG (→1) on alg/symmetric.
- `(alg/generate G generators)` → subgroup element list. generate C6 {1} → all 6.
- `(alg/generators G)` → a generating set. generators C6 → `(1)`.
- `(alg/homomorphism G H phi)` → homomorphism record (phi prints as
  `[object Object]` — display artifact only; don't put the raw display in a :note,
  describe it instead).
- `(alg/is-cyclic? G)` — CORRECT: C6→#t, D3→#f, C5→#t. WRONG on zn/symmetric.
- `(alg/is-simple? G)` — CORRECT for CYCLIC only: C5→#t (prime), C6→#f. **BUG:
  D3→#t (should be #f).** Document is-simple? using cyclic prime-vs-composite
  ONLY. Flag the D3 bug as needs-alfred; do NOT show the non-abelian case.
- `(alg/is-solvable? G)` — CORRECT on Cayley/dihedral: C6→#t, D3→#t, D4→#t.
  WRONG on alg/symmetric (S3→#f). Use dihedral for the non-abelian solvable example.
- `(alg/is-subgroup? G H)` — H a sublist of G's elements; checks closure+inverses+id.
- `(alg/isomorphism? G H phi)` — C6→C6 identity → #t. VERIFIED.
- `(alg/left-cosets G H)` / `(alg/right-cosets G H)` → list of cosets. VERIFIED on D3.
- `(alg/normalizer G H)` → element list. VERIFIED.
- `(alg/perm-cycles p)` = `(alg/permutation-cycles p)` — ALIAS. `(1 2 0)` →
  `((0 1 2))`. permutation-cycles is the long-form alias.
- `(alg/perm-fixed? p i)` → bool. `(0 2 1) 0` → #t.
- `(alg/perm-fixed-points p)` → list. `(0 2 1)` → `(0)`.
- `(alg/permutation-compose p q)` = `(alg/perm-compose p q)` — ALIAS (long-form).
- `(alg/quotient G H)` → coset group. quotient C6 by subgroup{1-gen} → VERIFIED.
- `(alg/random-element G)` → element (NONDETERMINISTIC — never put its output in a
  runnable :program that asserts a value; use it only inside a shape that checks
  membership, e.g. `(member? (alg/random-element G) (elements G))`, or seed-free
  display in a novice example marked as illustrative).
- `(alg/rank G)` — **documented approximation**: cyclic→1, else ceil(log2|G|)
  upper bound (rank-D3→3, true rank 2). Document HONESTLY as an upper-bound
  estimate, not exact. impl comment says so.
- `(alg/subgroup G generators)` → subgroup element list.
- `(alg/subgroups G)` → list of all subgroups. subgroups C6 → 4. VERIFIED.
- `(alg/torsion G)` — in a finite group = whole group (all elements have finite
  order). torsion-D3 → 6 elements. Honest, but document the "finite ⇒ all torsion"
  reasoning in the :note.

### Aliases (author as SHORT alias records pointing to canonical, not full duplicates)
- `alg/permutation-compose` → canonical `alg/perm-compose`
- `alg/permutation-cycles`  → canonical `alg/perm-cycles`
(Both canonicals are already documented? verify in 03-alg.slat; if perm-compose /
perm-cycles are themselves undocumented, author the canonical fully + alias the long form.)

## topo (67-topo.slat) — 23 gap verbs

Representations (from lib/base/topo.js header):
- Complex: `(topo/complex '((a b c)))` — list of maximal simplices.
- Graph: `(topo/graph nverts edge-list)` — but note nodes/edges probed empty on a
  graph object; edges/vertices work on a COMPLEX. Prefer complex inputs.

### Verified behavior (triangle `(topo/complex '((a b c)))` unless noted)
- `topo/euler-characteristic` == `topo/euler-char` — **ALIAS** (both →1 on filled
  triangle). Author as a short alias record → canonical `topo/euler-char`
  (already documented).
- `(topo/dimension c)` → 2 for a triangle. VERIFIED.
- `(topo/faces c)` → all faces `((a)(b)(a b)(c)(a c)(b c)(a b c))`. VERIFIED.
- `(topo/vertices c)` → `(a b c)`. VERIFIED.
- `(topo/edges c)` → 1-simplices `((a b)(a c)(b c))`. VERIFIED.
- `(topo/nodes c)` → on a complex-of-edges returns edge keys; behaves oddly on
  graph objects (empty). Document on a complex where output is sensible; verify
  each program.
- `(topo/boundary c)` → boundary chain `((b c)(a c)(a b))`. VERIFIED.
- `(topo/simplex '(a b c))` → canonical simplex `(a,b,c)`. VERIFIED.
- `(topo/simplicial '((a b c)))` → complex object `(complex ((a b c)) 7)`. VERIFIED.
- `(topo/closed? c)` → #f for open triangle; `(topo/open? c)` → #t;
  `(topo/interior c)` → `((a)(b)(c)(a b c))`. VERIFIED (point-set on a complex).
- `(topo/sphere 2)` → tetra-boundary complex; euler-char → 2. VERIFIED.
- `(topo/torus)` → 7-vertex triangulation (14 faces); `(topo/genus torus)` → 1. VERIFIED.
- `(topo/klein-bottle)` → 8-vertex triangulation. VERIFIED (value only; euler=0).
- `(topo/mobius)` → 5-face triangulation. VERIFIED.
- `(topo/genus x)` → genus. torus→1. VERIFIED.
- `(topo/is-manifold? x)` → sphere2→#t. VERIFIED.
- `(topo/simply-connected? x)` → sphere2→#t. VERIFIED.
- `(topo/homology c)` → `((H 0 rank 1)(H 1 rank 0)(H 2 rank 0))` for a filled
  triangle (contractible). VERIFIED.
- `(topo/homotopy x)` → sphere2 → the symbol `unknown-beyond-graph` for higher
  cases; only report homotopy where it returns a real value, else note the limit
  honestly (this is a genuine honest-null the impl already emits).
- `(topo/chain c k)` → k-chains. `(topo/chain tri 1)` → `(() (a,b,c) ())`. VERIFIED.
- `(topo/adjacent? g u v)` → needs a proper graph; probed #f on complexes. Verify
  the exact graph constructor before documenting; if it can't be made to answer
  correctly, needs-alfred.

## Honest authoring rules for these verbs
1. Every runnable key MUST pass `./bin/motoi run` clean (no unbound/NaN/error).
2. Use ONLY representations where the answer is mathematically correct (matrix above).
3. Never assert a value produced by `alg/random-element` (nondeterministic).
4. is-simple? → cyclic examples only (D3 bug). rank → label as upper-bound estimate.
5. Aliases → short records, not full 15-grid duplicates.
6. Bugs found → append to scratch/sft-plans/88-verb-bugs.md as needs-alfred, keep going.
