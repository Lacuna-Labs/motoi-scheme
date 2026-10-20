# -*- coding: utf-8 -*-
"""Row 2-5 content for alg/* verbs — batch A (group theory core, A-K)."""

ROWS = {}

ROWS["alg/apply-symmetry"] = r'''  :row-2-audit (
    (:problem "A sprite artist places a decoration at (3, 1) on a hex tile and needs every rotational and reflected copy for the six-fold pattern. The audit question: is the placement stable — that is, does the emitted set of positions actually respect the D_6 group we declared, or did we drift into ad-hoc trigonometry that would fail a symmetry check?"
     :program "(define hex (alg/dihedral 6))\n(define seed (list 3 1))\n(define orbit (map (lambda (s) (alg/apply-symmetry s seed)) (alg/op hex)))\n(list (length orbit) (car orbit))"
     :explanation "Line 1 builds the dihedral group of the hexagon. Line 2 fixes the seed point. Line 3 maps every group element over the seed via alg/apply-symmetry. The count on line 4 tells the operator whether all 12 symmetries produced distinct points (generic position) or fewer (point on a symmetry axis). The verb answers the audit because the group element drives the transform — no hand-rolled sin/cos to drift."
     :meta "geom/rotate would have taken an angle in radians and quietly produced 12 different floats for what should be one canonical action. alg/apply-symmetry takes the group element itself, so equality of symmetries is equality of integers.")
    (:eng "The operator sees one function call per symmetry; the log shows the enum, not a float — easier to grep."
     :math "The verb realizes the action D_n × R^2 → R^2 as a homomorphism from the abstract group to the affine group of the plane."
     :cs "Group element is an int; dispatch is O(1); no floating-point equality on the group side."))
  :row-3-dimension (
    (:setup "A finite group acting on an ambient set — the shape is 'element carries object to object'."
     :rungs (
       (:domain "alg action on a point"    :code "(alg/apply-symmetry 1 (list 1 0))")
       (:domain "framebuffer scene rotate" :code "(scene/rotate stage (quarter-turn))")
       (:domain "matrix action on a vector":code "(matrix/mul-vec R v)"))
     :explanation "Rung 1 is our verb: a group element applied to a 2-D point. Rung 2 is the same shape at the scene level — the framebuffer rotates a whole layer under one quarter-turn action. Rung 3 is the linear-algebra crystal: a matrix R times a vector v. All three read 'act g on x', and all three respect composition: (act g (act h x)) = (act (compose g h) x)."
     :meta "The shape transfers because 'group acts on set' is one of the oldest abstractions in mathematics; any concrete rotation, permutation, or matrix multiplication is an instance.")
    (:eng "The same shape shows up in the sprite pipeline, the scene rotate call, and the linear-algebra layer, so an engineer who learns one carries the other two."
     :math "Group action: G × X → X with g·(h·x) = (gh)·x and e·x = x."
     :cs "The action is a two-argument function; encoding the group element as an int lets us memoize compositions."))
  :row-4-proof (
    (:claim "Applying the identity element leaves the point unchanged; applying a symmetry then its inverse returns the original point."
     :program "(define D4 (alg/dihedral 4))\n(define p (list 3 5))\n(define g 2)\n(define inv-g (alg/inverse D4 g))\n(define round-trip (alg/apply-symmetry inv-g (alg/apply-symmetry g p)))\n(and (equal? p (alg/apply-symmetry 0 p))\n     (equal? p round-trip))"
     :invariant "∀ x ∈ R^2. e · x = x   ∧   ∀ g ∈ D_n, x ∈ R^2. g^{-1} · (g · x) = x"
     :meta "Identity + inverses are the group-action axioms. A counter-example — any point p and any group element g for which round-trip differs from p — would prove the encoding is broken and the group is not acting. This is the algebraic-invariant frame; see book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The test is one line and prints #t; SRE can add it to a smoke check for the geometry pipeline."
     :math "The two axioms above define an action; every symmetry group acting on a plane obeys them."
     :cs "The invariant is a property test; use it as a fuzzer seed by drawing random p and g."))
  :row-5-emergence (
    (:base "alg/apply-symmetry takes a group element and a point and returns the transformed point."
     :composition "(define hex (alg/dihedral 6))\n(define seed (list 4 0))\n(define orbit\n  (let loop ((gs (alg/op hex)) (acc '()))\n    (cond ((null? gs) (reverse acc))\n          (else (loop (cdr gs)\n                      (cons (alg/apply-symmetry (car gs) seed) acc))))))\norbit"
     :emergent "An orbit — the closed set of all images of one point under the whole group."
     :meta "Chaining apply-symmetry with a fold over the group elements produces the classical 'orbit' pattern; the same family shows up in Burnside counting, in graphics tile enumeration, in molecular chemistry symmetry classes. See book-of-composition ch-16 (composing games) for tile-map applications.")
    (:eng "The emergent orbit is exactly what a tile decorator ships to the sprite grid — one code path, one set of positions."
     :math "Orbit-stabilizer theorem: |orbit(x)| · |stab(x)| = |G|."
     :cs "Fold over group elements = O(|G|); cache the orbit once per seed, reuse across frames."))
'''

ROWS["alg/center"] = r'''  :row-2-audit (
    (:problem "A cryptography learner has a small group and wants to know 'how commutative is this'. The audit demands a single answer, not a table of pair-checks. The operator needs one number: the size of the center."
     :program "(define S4 (alg/symmetric 4))\n(define Z (alg/center S4))\n(list (length Z) (alg/order S4))"
     :explanation "Line 1 constructs S_4 (24 elements). Line 2 asks for the center. Line 3 prints (|Z(G)|, |G|). For S_n with n≥3 the center is trivial (size 1), so the operator sees (1 24) and knows S_4 is 'as non-abelian as it gets'."
     :meta "alg/is-abelian? answers a boolean; that would collapse the question. alg/center returns the actual central elements, so the ratio |Z|/|G| gives a graded 'commutativity index' the operator can log.")
    (:eng "The center appears in every group audit because it either is the whole group (abelian, boring) or a tight subgroup (structural information)."
     :math "Z(G) = {g : gx = xg ∀ x ∈ G}."
     :cs "Result is a list; length is the invariant we log."))
  :row-3-dimension (
    (:setup "The 'commuting core' shape — the subset of elements that leave everything else alone under interaction."
     :rungs (
       (:domain "alg group center"        :code "(alg/center (alg/dihedral 4))")
       (:domain "input handler priority"  :code "(input/quiet-listeners handlers)")
       (:domain "matrix commutant"        :code "(matrix/commutant M)"))
     :explanation "Rung 1 is the group center. Rung 2 is an input-handler bus where the 'quiet' listeners are those that never fight for any event — they compose with every other handler. Rung 3 is the classic commutant: the matrices that commute with a given M. All three name the same shape: 'the elements that do not disturb anything else'."
     :meta "The shape transfers because commutativity — 'order does not matter' — is a substrate-free notion; any composition system has a distinguished sub-system of order-free elements.")
    (:eng "In every system with composition, the 'quiet core' is the safest place to plug in extensions."
     :math "The center is the kernel of the conjugation representation ρ: G → Aut(G)."
     :cs "Computing the commuting subset is O(n^2) in the naive case; parallelizable trivially."))
  :row-4-proof (
    (:claim "The center is a subgroup: closed under the group operation and under inversion, and contains the identity."
     :program "(define G (alg/dihedral 4))\n(define Z (alg/center G))\n(define e (alg/identity G))\n(define closed?\n  (let loop ((xs Z))\n    (cond ((null? xs) #t)\n          (else (and (member (alg/inverse G (car xs)) Z)\n                     (loop (cdr xs)))))))\n(and (member e Z) closed?)"
     :invariant "∀ a, b ∈ Z(G). ab ∈ Z(G) ∧ a^{-1} ∈ Z(G) ∧ e ∈ Z(G)"
     :meta "Subgroup axioms tested by the code; a counter-example would be an element of Z whose inverse is not central, which would falsify the very definition of center. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The property test doubles as a validation of the computation itself: if Z fails subgroup closure, the implementation is wrong, not the group."
     :math "Z(G) ≤ G; furthermore, Z(G) is normal because it is invariant under all inner automorphisms."
     :cs "Closure check is O(|Z|·|G|); inversion lookup is a table read."))
  :row-5-emergence (
    (:base "alg/center returns the central subgroup Z(G)."
     :composition "(define G (alg/dihedral 4))\n(define Z (alg/center G))\n(define classes (alg/conjugacy-classes G))\n(list (length Z) (length classes))"
     :emergent "A first-cut structural fingerprint of the group: (center-size, class-count)."
     :meta "Center + conjugacy classes together are the input to character theory — the family of representations of the group. See book-of-math ch-advanced-04 (Groups & Symmetry) and book-of-ml ch-03 (matrices) for the matrix side of representations.")
    (:eng "The (|Z|, #classes) tuple is small enough to fit in a log line and unique enough to distinguish most small groups."
     :math "Class equation: |G| = |Z| + Σ [G:C_G(x_i)] over non-central conjugacy class representatives."
     :cs "Two API calls give a compact isomorphism-invariant signature; cache it per group."))
'''

ROWS["alg/conjugacy-classes"] = r'''  :row-2-audit (
    (:problem "Two Cayley tables land in the reference; the auditor must decide whether they are the same group with elements relabelled or genuinely different. Comparing element-by-element is fragile; comparing conjugacy-class sizes is a fast, honest fingerprint."
     :program "(define A (alg/dihedral 4))\n(define B (alg/direct-product (alg/cyclic 2) (alg/cyclic 4)))\n(define ca (sort (map length (alg/conjugacy-classes A)) <))\n(define cb (sort (map length (alg/conjugacy-classes B)) <))\n(list ca cb (equal? ca cb))"
     :explanation "Lines 1-2 build two groups of order 8. Lines 3-4 compute the sorted class-size lists — the class equation up to permutation. Line 5 reports both plus whether they match. D_4 gives (1 1 2 2 2); C_2 × C_4 gives (1 1 1 1 1 1 1 1). Different lists prove the groups are non-isomorphic before we even try to find a bijection."
     :meta "alg/is-isomorphic? would eventually give the same answer, but it is exponential in the worst case; conjugacy-class comparison is polynomial and rules out 90% of cases up front.")
    (:eng "In the CI lane for group tables, class-size comparison is the cheap first filter; only survivors go to full isomorphism search."
     :math "Isomorphic groups have equal multisets of conjugacy-class sizes."
     :cs "Sort and compare — O(|G|^2) worst case for the class computation, O(n log n) for the sort."))
  :row-3-dimension (
    (:setup "'Equivalence under an inner action' — partition a set by a symmetry acting on it from within."
     :rungs (
       (:domain "alg conjugacy in a group"  :code "(alg/conjugacy-classes (alg/symmetric 4))")
       (:domain "collision hash bucketing"  :code "(collision/buckets space)")
       (:domain "topological equivalence"   :code "(geom/homotopy-classes shape)"))
     :explanation "Rung 1: conjugacy partitions a group into orbits under g → xgx^{-1}. Rung 2: a collision grid partitions space into buckets that collide only within themselves. Rung 3: homotopy classes partition continuous maps by 'can be deformed into each other'. All three share the shape: 'a relation of the form R(a, b) = ∃ x. a = x·b·x^{-1}-like'."
     :meta "The shape transfers because every action-partition is a colouring where 'same colour' means 'reachable by an inner move' — an equivalence relation implicit in any action.")
    (:eng "Learning to think in equivalence classes shows up in bucketing collisions, deduplicating hash entries, and identifying redundant chords in music theory."
     :math "Conjugation is an inner automorphism; classes are orbits of Inn(G) on G."
     :cs "The pattern is 'partition by a group action', a template usable wherever an action is defined."))
  :row-4-proof (
    (:claim "Conjugacy is an equivalence relation: reflexive, symmetric, transitive."
     :program "(define G (alg/symmetric 3))\n(define (conj? x y)\n  (let loop ((zs (alg/op G)))\n    (cond ((null? zs) #f)\n          (else (or (equal? y (alg/op G (car zs) (alg/op G x (alg/inverse G (car zs)))))\n                    (loop (cdr zs)))))))\n(define xs (alg/op G))\n(and\n  (let loop ((as xs)) (or (null? as) (and (conj? (car as) (car as)) (loop (cdr as)))))\n  (let loop ((as xs))\n    (or (null? as)\n        (let loop2 ((bs xs))\n          (or (null? bs)\n              (and (or (not (conj? (car as) (car bs))) (conj? (car bs) (car as)))\n                   (loop2 (cdr bs))))))))"
     :invariant "∀ a. a ~ a  ∧  ∀ a b. a ~ b ⇒ b ~ a  ∧  ∀ a b c. a ~ b ∧ b ~ c ⇒ a ~ c"
     :meta "Equivalence-relation axioms are testable per pair; a single non-symmetric pair falsifies the invariant. See book-of-math ch-advanced-04 (Groups & Symmetry) for the algebraic proof.")
    (:eng "If any of the three fails, the partition is broken and every downstream analysis (character tables, quotients) is contaminated."
     :math "Reflexivity: a = e·a·e^{-1}. Symmetry: if a = x·b·x^{-1} then b = x^{-1}·a·x. Transitivity: compose the conjugators."
     :cs "Three property tests, checkable independently; parallelizable."))
  :row-5-emergence (
    (:base "alg/conjugacy-classes partitions the group into orbits under conjugation."
     :composition "(define G (alg/dihedral 4))\n(define cs (alg/conjugacy-classes G))\n(define sizes (sort (map length cs) <))\n(define signature (list (alg/order G) sizes))\nsignature"
     :emergent "A canonical fingerprint (order, sorted class-sizes) that can be used as a hash key for groups."
     :meta "Fingerprinting via invariants is the same family as content-hashing a file (md5, sha256); the invariant is chosen so isomorphic objects share it. See book-of-composition ch-13 (save-load) for the deduplication frame.")
    (:eng "Store groups by fingerprint; two Cayley tables with the same fingerprint are candidates for isomorphism, the rest are dismissed for free."
     :math "The class equation is one invariant among a family (order, exponent, derived series, …) that together identify most small groups."
     :cs "Compact key + fast comparison = classic 'hash before you diff' pattern."))
'''

ROWS["alg/cosets"] = r'''  :row-2-audit (
    (:problem "An operator wants to check whether a subgroup H of G is a candidate for building the quotient G/H. Before any quotient work, the audit requires that left and right cosets coincide (normality)."
     :program "(define G (alg/dihedral 4))\n(define H (alg/subgroup-gen G (list 1)))\n(define L (alg/cosets G H))\n(define R (map (lambda (c) (map (lambda (h) (alg/op G h (car c))) H)) L))\n(equal? (map (lambda (c) (list->set c)) L)\n        (map (lambda (c) (list->set c)) R))"
     :explanation "Line 1 builds D_4. Line 2 picks the rotation-subgroup. Line 3 computes left cosets. Line 4 rebuilds them from the right side. Line 5 compares as sets. Any mismatch means the subgroup is not normal, and the quotient G/H is not well-defined."
     :meta "alg/is-normal? gives a boolean; alg/cosets gives the actual partition, so the operator can log which coset differs — a diagnosis, not just a verdict.")
    (:eng "In an audit, showing the offending coset is far more useful than a bare #f."
     :math "H ⊴ G ⇔ gH = Hg for all g."
     :cs "Coset equality is set equality; use sorted lists or hash-sets."))
  :row-3-dimension (
    (:setup "'Partition of a whole into equal-sized tiles' — a decomposition where each tile is a translate of one anchor."
     :rungs (
       (:domain "alg cosets in a group"     :code "(alg/cosets G H)")
       (:domain "grid tile decomposition"   :code "(grid/tile-plane tile-shape)")
       (:domain "coset-space of a lattice"  :code "(lattice/fundamental-domain L)"))
     :explanation "Rung 1: cosets tile the group with copies of H. Rung 2: a grid decomposition tiles the plane with translated copies of one tile. Rung 3: the fundamental domain of a lattice is one coset representative for R^n / L. The shape 'anchor + translates' is the same in all three."
     :meta "The shape transfers because 'quotient by a subgroup' is the algebraic name for 'tile the space by an equivalence'.")
    (:eng "Anyone who has drawn a grid understands cosets: pick a tile, translate it everywhere, cover the plane."
     :math "Cosets partition G into |G|/|H| equal-sized sets."
     :cs "Storing coset representatives is the standard trick for compact quotient representation."))
  :row-4-proof (
    (:claim "Distinct cosets are disjoint, and every element belongs to exactly one coset."
     :program "(define G (alg/dihedral 3))\n(define H (alg/subgroup-gen G (list 1)))\n(define cs (alg/cosets G H))\n(define all-elts (alg/op G))\n(define union-size (apply + (map length cs)))\n(define pairwise-disjoint?\n  (let loop ((cs cs))\n    (cond ((null? cs) #t)\n          ((null? (cdr cs)) #t)\n          (else (and (null? (filter (lambda (x) (member x (cadr cs))) (car cs)))\n                     (loop (cdr cs)))))))\n(and (= union-size (alg/order G)) pairwise-disjoint?)"
     :invariant "∀ g ∈ G. ∃! coset C. g ∈ C  (partition property)"
     :meta "The partition axiom: covers and disjointness. A counter-example would be any element appearing in two cosets, which would falsify the coset relation itself. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "Partition tests are cheap and catch bugs where the coset algorithm silently double-counts."
     :math "This is Lagrange's theorem's setup: |G| = [G:H] · |H|."
     :cs "Union-find style datastructures embody the same partition invariant."))
  :row-5-emergence (
    (:base "alg/cosets partitions G into left cosets of H."
     :composition "(define G (alg/cyclic 12))\n(define H (alg/subgroup-gen G (list 4)))\n(define cs (alg/cosets G H))\n(define quotient-rep (map car cs))\nquotient-rep"
     :emergent "A quotient-representative list — one canonical name per coset, which is the element set of G/H."
     :meta "The pattern is 'quotient by choosing representatives', which is the same shape as picking canonical strings in a normalization step (Unicode NFC, path canonicalization). See book-of-composition ch-13 (save-load).")
    (:eng "Representatives are how you store an element of a quotient without storing the entire coset."
     :math "G/H is a group iff H is normal; the operation on representatives is well-defined."
     :cs "Representative selection is idempotent (canonicalization); compose with hashing for fast equality."))
'''

ROWS["alg/cycles->perm"] = r'''  :row-2-audit (
    (:problem "A puzzle game emits piece swaps as cycle lists. The audit lane needs to verify that a sequence of cycles, when parsed, becomes a valid permutation and matches the intended piece arrangement."
     :program "(define swap (alg/cycles->perm 6 (list (list 0 1) (list 2 5))))\n(define expected (list 1 0 5 3 4 2))\n(equal? expected (map (lambda (i) (alg/perm-apply swap i))\n                       (list 0 1 2 3 4 5)))"
     :explanation "Line 1 parses two disjoint transpositions on 6 elements. Line 2 lists the intended positional outcome. Line 3 rebuilds the permutation as a function of position and compares. Auditor sees #t or a specific position where the parse diverged."
     :meta "alg/perm would demand a full one-line array; alg/cycles->perm accepts the compact cycle notation puzzle designers actually write. Two-way traceability with alg/perm->cycles closes the audit.")
    (:eng "The cycle syntax matches how humans document moves; the verb makes the human notation directly executable."
     :math "Every permutation decomposes uniquely into disjoint cycles."
     :cs "The parser assumes disjointness; caller must ensure — no runtime check for overlap."))
  :row-3-dimension (
    (:setup "'Compact code for a mapping' — a sparse notation that expands to a dense function."
     :rungs (
       (:domain "alg cycle notation"        :code "(alg/cycles->perm 5 '((0 3) (1 2 4)))")
       (:domain "sprite frame keyframes"    :code "(animation/from-keys frames)")
       (:domain "sparse matrix triples"     :code "(matrix/from-coo triples)"))
     :explanation "Rung 1: cycles list only the moving elements; fixed points are implicit. Rung 2: keyframes list only the times where the value changes; the rest is interpolated. Rung 3: coordinate-list matrices store only non-zero entries. All three trade compactness of writing for a small parse step at load."
     :meta "The shape transfers because sparsity is a universal storage trick: encode only the interesting changes; the identity is free.")
    (:eng "Compact notation is easier to review in a pull request; the parse step is a one-time cost."
     :math "Cycle decomposition is unique up to cycle rotation and cycle ordering."
     :cs "Sparse representations save space linearly in the density of non-identity actions."))
  :row-4-proof (
    (:claim "cycles->perm and perm->cycles are inverse up to cycle rotation and disjoint-cycle ordering; converting a permutation to cycles and back yields the same permutation."
     :program "(define p (alg/perm (list 2 0 1 4 3)))\n(define round-trip (alg/cycles->perm 5 (alg/perm->cycles p)))\n(equal? (map (lambda (i) (alg/perm-apply p i)) (list 0 1 2 3 4))\n        (map (lambda (i) (alg/perm-apply round-trip i)) (list 0 1 2 3 4)))"
     :invariant "∀ π ∈ S_n. cycles->perm(perm->cycles(π)) = π"
     :meta "Round-trip identity; a counter-example is any permutation whose cycle-and-back differs — such a permutation would prove the representation lossy. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The round-trip test is standard for any serialization pair; it belongs in the CI smoke suite."
     :math "The uniqueness-of-cycle-decomposition theorem grounds the round-trip."
     :cs "Round-trip identity is the definition of a lossless codec; equally applicable to save/load pairs."))
  :row-5-emergence (
    (:base "alg/cycles->perm builds a permutation from a cycle list."
     :composition "(define shuffle (alg/cycles->perm 8 '((0 2 4 6) (1 3 5 7))))\n(define order (alg/perm-order shuffle))\n(define orbit\n  (let loop ((n 0) (acc '()) (cur shuffle))\n    (cond ((= n order) (reverse acc))\n          (else (loop (+ n 1)\n                      (cons cur acc)\n                      (alg/perm-compose cur shuffle))))))\n(length orbit)"
     :emergent "A cyclic subgroup — the powers of one permutation form a group under composition."
     :meta "cycles->perm + perm-compose + perm-order generate a cyclic subgroup; the family pattern is 'iterate a step until you close the loop', same as a game state machine that cycles through modes. See book-of-composition ch-08 (timeline) for iteration patterns.")
    (:eng "The iteration closes at perm-order — a natural loop termination that is safe to log."
     :math "⟨π⟩ = {π^k : 0 ≤ k < ord(π)}."
     :cs "Iterate + memoize = orbit computation; O(ord(π)) time."))
'''
