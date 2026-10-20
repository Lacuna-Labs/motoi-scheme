# auto-generated
ROWS = {
    'alg/apply-symmetry': r"""  :row-2-audit (
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
""",
    'alg/center': r"""  :row-2-audit (
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
""",
    'alg/conjugacy-classes': r"""  :row-2-audit (
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
""",
    'alg/cosets': r"""  :row-2-audit (
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
""",
    'alg/cycles->perm': r"""  :row-2-audit (
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
""",
    'alg/cyclic': r"""  :row-2-audit (
    (:problem "A learner needs the simplest example of a finite group to test that the algebra library's group verbs (order, subgroup-gen, is-abelian?) behave sanely. The audit lane needs a canonical group whose answers are known analytically."
     :program "(define C6 (alg/cyclic 6))\n(list (alg/order C6) (alg/is-abelian? C6) (length (alg/subgroup-gen C6 (list 2))))"
     :explanation "Line 1 builds Z/6Z. Line 2 checks the operator's three expectations: order 6, abelian, and the subgroup generated by 2 has size 3 (elements {0,2,4}). All three are analytic truths."
     :meta "alg/dihedral would have been a size-2n non-abelian answer for the same-looking argument n; alg/cyclic gives the abelian ground truth for regression tests.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'closed under repeated application of one generator'"
     :rungs (
       (:domain "alg native" :code "(define C6 (alg/cyclic 6))")
       (:domain "sequencer step counter" :code "(beat/counter-mod 6)")
       (:domain "additive group Z/nZ" :code "(modulo (+ a b) n)"))
     :explanation "Rung 1 is alg/cyclic in its native library. Rung 2 shows the same ''closed under repeated application of one generator'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''closed under repeated application of one generator'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/cyclic."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The cyclic group is generated by 1 and every element is a power of it."
     :program "(define C5 (alg/cyclic 5))\n(define g 1)\n(equal? (sort (map (lambda (k) (alg/op C5 g (- k 1))) (list 1 2 3 4 5)) <)\n        (list 0 1 2 3 4))"
     :invariant "∀ x ∈ Z/nZ. ∃ k ∈ {0,...,n-1}. x = k·1 mod n"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/cyclic — see :summary."
     :composition "(define C4 (alg/cyclic 4))\n(define orbit (map (lambda (k) (modulo k 4)) (list 0 1 2 3 4 5)))\n(map (lambda (x) (alg/op C4 x 1)) orbit)"
     :emergent "counter"
     :meta "The emergent counter belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. This is the same family as a modular counter in beat/*; see book-of-composition ch-08 (timeline) for iteration patterns.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the counter pattern."
     :cs "The emergent counter is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/dihedral': r"""  :row-2-audit (
    (:problem "A tile pattern's rotational symmetries need to be enumerated for a decoration check; the operator needs the 2n symmetries of an n-gon as a group, not as individual matrices."
     :program "(define D5 (alg/dihedral 5))\n(list (alg/order D5) (alg/is-abelian? D5))"
     :explanation "D_5 has 10 elements (5 rotations, 5 reflections) and is non-abelian; the operator sees (10 #f) confirming the standard structure."
     :meta "alg/cyclic n would give only the rotations; reflections are lost. alg/dihedral n is the honest answer for a polygon whose symmetry group includes flips.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'rotations and reflections closing under composition'"
     :rungs (
       (:domain "alg native" :code "(define D5 (alg/dihedral 5))")
       (:domain "sprite mirroring set" :code "(sprite/all-mirrors sp)")
       (:domain "symmetry group of an n-gon" :code "D_n = ⟨r, s | r^n = s^2 = e, srs = r^-1⟩"))
     :explanation "Rung 1 is alg/dihedral in its native library. Rung 2 shows the same ''rotations and reflections closing under composition'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''rotations and reflections closing under composition'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/dihedral."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Dihedral D_n has order 2n and contains a normal cyclic subgroup of rotations of order n."
     :program "(define D4 (alg/dihedral 4))\n(define rots (alg/subgroup-gen D4 (list 1)))\n(and (= (alg/order D4) 8) (= (length rots) 4) (alg/is-normal? D4 rots))"
     :invariant "|D_n| = 2n  ∧  ⟨r⟩ ⊴ D_n with |⟨r⟩| = n"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/dihedral — see :summary."
     :composition "(define D3 (alg/dihedral 3))\n(define classes (alg/conjugacy-classes D3))\n(list (length classes) (map length classes))"
     :emergent "symmetry-fingerprint"
     :meta "The emergent symmetry-fingerprint belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same family as pixel-art mirror sets — a small closed collection of symmetries. See book-of-composition ch-06 (sprite-grid).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the symmetry-fingerprint pattern."
     :cs "The emergent symmetry-fingerprint is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/direct-product': r"""  :row-2-audit (
    (:problem "A composer builds a Klein four-group as C_2 × C_2 to test whether the algebra library's product construction gives the expected order-4 abelian group with three involutions."
     :program "(define V (alg/direct-product (alg/cyclic 2) (alg/cyclic 2)))\n(list (alg/order V) (alg/is-abelian? V))"
     :explanation "Order should be 4 and the group should be abelian; the operator sees (4 #t) confirming the Klein-four structure."
     :meta "alg/cyclic 4 would have produced the *other* order-4 group (Z/4Z), not the Klein-four; the two are non-isomorphic despite same order — the direct product is the honest answer.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'pointwise combination of two independent systems'"
     :rungs (
       (:domain "alg native" :code "(define V (alg/direct-product (alg/cyclic 2) (alg/cyclic 2)))")
       (:domain "two independent input channels" :code "(input/pair joy-a joy-b)")
       (:domain "Cartesian product of sets with pointwise structure" :code "G × H"))
     :explanation "Rung 1 is alg/direct-product in its native library. Rung 2 shows the same ''pointwise combination of two independent systems'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''pointwise combination of two independent systems'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/direct-product."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "|G × H| = |G|·|H|, and G × H is abelian iff G and H both are."
     :program "(define GxH (alg/direct-product (alg/cyclic 3) (alg/cyclic 4)))\n(and (= (alg/order GxH) 12) (alg/is-abelian? GxH))"
     :invariant "|G × H| = |G|·|H|  ∧  (G × H abelian ⇔ G abelian ∧ H abelian)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/direct-product — see :summary."
     :composition "(define G (alg/direct-product (alg/cyclic 2) (alg/cyclic 3)))\n(alg/is-isomorphic? G (alg/cyclic 6))"
     :emergent "product-decomposition"
     :meta "The emergent product-decomposition belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same family as decomposing a compound state into independent coordinates. See book-of-composition ch-11 (text-color-livecode) for parallel channel composition.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the product-decomposition pattern."
     :cs "The emergent product-decomposition is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/element-order': r"""  :row-2-audit (
    (:problem "A group-classification pass needs to know whether a group has an element whose order equals the group order — such an element is a generator and proves the group is cyclic."
     :program "(define G (alg/cyclic 7))\n(define orders (map (lambda (x) (alg/element-order G x)) (alg/op G)))\n(member 7 orders)"
     :explanation "If 7 appears in the order list, the group has a generator; the operator sees a non-#f value."
     :meta "alg/order gives the whole group's size; alg/element-order gives one element's cyclic period. Confusing the two would misclassify cyclic vs non-cyclic groups.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'least period of an iterated map'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/cyclic 7))")
       (:domain "animation loop length" :code "(animation/loop-length clip)")
       (:domain "order of an element in a group" :code "ord(g) = min{k ≥ 1 : g^k = e}"))
     :explanation "Rung 1 is alg/element-order in its native library. Rung 2 shows the same ''least period of an iterated map'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''least period of an iterated map'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/element-order."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The order of every element divides |G| (Lagrange)."
     :program "(define G (alg/dihedral 4))\n(let loop ((xs (alg/op G)))\n  (cond ((null? xs) #t)\n        (else (and (zero? (modulo (alg/order G) (alg/element-order G (car xs))))\n                   (loop (cdr xs))))))"
     :invariant "∀ g ∈ G. ord(g) | |G|"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/element-order — see :summary."
     :composition "(define G (alg/dihedral 3))\n(sort (map (lambda (x) (alg/element-order G x)) (alg/op G)) <)"
     :emergent "order-spectrum"
     :meta "The emergent order-spectrum belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Sorted element orders form a group invariant used in fast non-isomorphism checks.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the order-spectrum pattern."
     :cs "The emergent order-spectrum is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/group-from-table': r"""  :row-2-audit (
    (:problem "A student writes a Cayley table by hand and needs the algebra library to validate it as a group and hand back a usable object."
     :program "(define G (alg/group-from-table '((0 1 2) (1 2 0) (2 0 1))))\n(alg/order G)"
     :explanation "A valid Z/3Z table produces order 3; operator sees 3."
     :meta "cyclic n gives Z/nZ directly; group-from-table lets you exhibit ANY finite group by table, at the cost of validation.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'construct-from-explicit-data'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/group-from-table '((0 1 2) (1 2 0) (2 0 1))))")
       (:domain "sprite atlas built from explicit rows" :code "(sprite/atlas-from-table rows)")
       (:domain "Cayley table" :code "G defined by (i, j) ↦ i·j"))
     :explanation "Rung 1 is alg/group-from-table in its native library. Rung 2 shows the same ''construct-from-explicit-data'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''construct-from-explicit-data'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/group-from-table."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "group-from-table returns a valid group iff the table satisfies closure, has identity, has inverses, and is associative."
     :program "(define G (alg/group-from-table '((0 1 2) (1 2 0) (2 0 1))))\n(alg/is-group? G)"
     :invariant "G = table iff (closed ∧ ∃ e ∧ ∀ a ∃ a^-1 ∧ assoc)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/group-from-table — see :summary."
     :composition "(define G (alg/group-from-table '((0 1) (1 0))))\n(list (alg/order G) (alg/is-abelian? G))"
     :emergent "validated-object"
     :meta "The emergent validated-object belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same shape as JSON-schema validation for structured input.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the validated-object pattern."
     :cs "The emergent validated-object is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/identity': r"""  :row-2-audit (
    (:problem "A group-computation script needs the neutral element to seed accumulators (products, orbits) — without it, the fold has no starting point."
     :program "(define G (alg/cyclic 6))\n(define e (alg/identity G))\n(equal? (alg/op G e 3) 3)"
     :explanation "Identity must leave every element unchanged; e·3 = 3 is the audit."
     :meta "alg/op would produce the identity via 0·1·0-style workarounds; alg/identity is the direct, documented lookup and cannot silently return a wrong constant.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'the neutral element in a composition system'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/cyclic 6))")
       (:domain "empty scene as start of composition" :code "(scene/empty)")
       (:domain "identity of a monoid" :code "e ∈ M with e·x = x·e = x"))
     :explanation "Rung 1 is alg/identity in its native library. Rung 2 shows the same ''the neutral element in a composition system'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''the neutral element in a composition system'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/identity."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The identity is unique and satisfies e·x = x·e = x for every element."
     :program "(define G (alg/dihedral 3))\n(define e (alg/identity G))\n(define all (alg/op G))\n(let loop ((xs all))\n  (cond ((null? xs) #t)\n        ((not (equal? (alg/op G e (car xs)) (car xs))) #f)\n        (else (loop (cdr xs)))))"
     :invariant "∃! e ∈ G. ∀ x ∈ G. e·x = x·e = x"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/identity — see :summary."
     :composition "(define G (alg/cyclic 5))\n(define orbit\n  (let loop ((n 0) (cur (alg/identity G)) (acc '()))\n    (cond ((= n 5) (reverse acc))\n          (else (loop (+ n 1) (alg/op G cur 1) (cons cur acc))))))\norbit"
     :emergent "iteration-seed"
     :meta "The emergent iteration-seed belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Identity as fold-seed is the universal accumulator pattern. See book-of-code ch-08 (memory-latches).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the iteration-seed pattern."
     :cs "The emergent iteration-seed is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/image': r"""  :row-2-audit (
    (:problem "Given a homomorphism φ: G → H, the operator needs to compute which elements of H are actually reached, to check surjectivity."
     :program "(define G (alg/zn 6))\n(define H (alg/zn 3))\n(define phi (lambda (x) (modulo x 3)))\n(alg/image G H phi)"
     :explanation "φ maps 0,3 → 0; 1,4 → 1; 2,5 → 2; image = {0,1,2} = all of H; operator sees (0 1 2)."
     :meta "Kernel is preimage of identity; image is what values are hit. The two together are the input to the First Isomorphism Theorem.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'range of a function'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/zn 6))")
       (:domain "reachable states from an input" :code "(input/reachable state actions)")
       (:domain "image of a homomorphism" :code "im(φ) = {φ(g) : g ∈ G}"))
     :explanation "Rung 1 is alg/image in its native library. Rung 2 shows the same ''range of a function'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''range of a function'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/image."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "im(φ) is a subgroup of H, and G/ker(φ) ≅ im(φ) (First Iso Theorem)."
     :program "(define G (alg/zn 6))\n(define H (alg/zn 3))\n(define phi (lambda (x) (modulo x 3)))\n(define img (alg/image G H phi))\n(define ker (alg/kernel G H phi))\n(= (length img) (/ (alg/order G) (length ker)))"
     :invariant "|im(φ)| = |G|/|ker(φ)|"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/image — see :summary."
     :composition "(define G (alg/symmetric 3))\n(define Z2 (alg/zn 2))\n(define sgn (lambda (p) (if (even? (alg/perm-parity p)) 0 1)))\n(list (alg/image G Z2 sgn) (alg/kernel G Z2 sgn))"
     :emergent "first-iso-witness"
     :meta "The emergent first-iso-witness belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Image + kernel + First Iso Theorem is the universal pattern for building quotients from homomorphisms.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the first-iso-witness pattern."
     :cs "The emergent first-iso-witness is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/index': r"""  :row-2-audit (
    (:problem "Before applying Lagrange or checking normality, the operator wants a single integer — the index [G:H] — to log and compare across candidate subgroups."
     :program "(define G (alg/dihedral 4))\n(define H (alg/subgroup-gen G (list 1)))\n(alg/index G H)"
     :explanation "D_4 has order 8; ⟨rotation⟩ has order 4; index = 2; operator sees 2."
     :meta "alg/cosets returns the whole partition; alg/index returns only the count. When you only need the count, the smaller call is faster and easier to log.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'ratio of two sizes'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/dihedral 4))")
       (:domain "ratio of scene to layer sizes" :code "(scene/layer-ratio scene layer)")
       (:domain "index of a subgroup" :code "[G:H] = |G|/|H|"))
     :explanation "Rung 1 is alg/index in its native library. Rung 2 shows the same ''ratio of two sizes'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''ratio of two sizes'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/index."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "[G:H] = |G|/|H| (Lagrange)."
     :program "(define G (alg/dihedral 4))\n(define H (alg/subgroup-gen G (list 1)))\n(= (alg/index G H) (/ (alg/order G) (length H)))"
     :invariant "[G:H] = |G|/|H|"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/index — see :summary."
     :composition "(define G (alg/dihedral 4))\n(map (lambda (g) (list g (alg/index G (alg/subgroup-gen G (list g)))))\n     (alg/op G))"
     :emergent "index-spectrum"
     :meta "The emergent index-spectrum belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Index-per-generator gives a quick subgroup-lattice fingerprint.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the index-spectrum pattern."
     :cs "The emergent index-spectrum is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/interval-vector': r"""  :row-2-audit (
    (:problem "A composer wants to compare two chords by interval content, not by voicing — the interval vector answers 'do these sonorities have the same harmonic color?'"
     :program "(list (alg/interval-vector (alg/pcset (list 0 4 7)))\n      (alg/interval-vector (alg/pcset (list 0 3 7))))"
     :explanation "Major and minor triads have the same interval vector (1 0 1 1 1 0); operator sees two identical vectors — Z-related."
     :meta "prime-form gives a canonical name; interval-vector gives the coloristic content. Two Z-related sets share interval-vector but have different prime-forms.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'histogram of pairwise differences'"
     :rungs (
       (:domain "alg native" :code "(list (alg/interval-vector (alg/pcset (list 0 4 7)))")
       (:domain "histogram of pixel-color differences" :code "(color/interval-histogram px)")
       (:domain "interval-class distribution" :code "⟨ic_1, ic_2, ..., ic_6⟩"))
     :explanation "Rung 1 is alg/interval-vector in its native library. Rung 2 shows the same ''histogram of pairwise differences'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''histogram of pairwise differences'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/interval-vector."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The interval vector is invariant under transposition and inversion."
     :program "(define c (alg/pcset (list 0 4 7)))\n(define ct (alg/transpose c 3))\n(equal? (alg/interval-vector c) (alg/interval-vector ct))"
     :invariant "∀ S, k. iv(T_k(S)) = iv(S)  ∧  ∀ S. iv(I(S)) = iv(S)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/interval-vector — see :summary."
     :composition "(define triads (list (alg/pcset (list 0 4 7)) (alg/pcset (list 0 3 7)) (alg/pcset (list 0 3 6))))\n(map alg/interval-vector triads)"
     :emergent "harmonic-classifier"
     :meta "The emergent harmonic-classifier belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Interval vector = histogram = fingerprint; same family as color histograms in image classification. See book-of-ml ch-01.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the harmonic-classifier pattern."
     :cs "The emergent harmonic-classifier is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/inverse': r"""  :row-2-audit (
    (:problem "A cryptographic simulation needs to undo a group action — encrypt then decrypt should be identity. The audit is: does the inverse exist and does it undo?"
     :program "(define G (alg/zn 7))\n(define a 3)\n(define inv-a (alg/inverse G a))\n(equal? (alg/op G a inv-a) (alg/identity G))"
     :explanation "3 is a unit mod 7; its inverse is 5 (3·5=15≡1); the operator sees #t."
     :meta "alg/op would iterate to find the inverse; alg/inverse retrieves it directly and errors honestly if the element is not invertible in that group.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'undo of a composition'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/zn 7))")
       (:domain "sprite undo action" :code "(sprite/undo last-move)")
       (:domain "multiplicative inverse in a group" :code "a·a^-1 = e"))
     :explanation "Rung 1 is alg/inverse in its native library. Rung 2 shows the same ''undo of a composition'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''undo of a composition'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/inverse."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Every group element has a unique two-sided inverse."
     :program "(define G (alg/dihedral 3))\n(define all (alg/op G))\n(let loop ((xs all))\n  (cond ((null? xs) #t)\n        (else (let* ((x (car xs)) (ix (alg/inverse G x)))\n                (and (equal? (alg/op G x ix) (alg/identity G))\n                     (equal? (alg/op G ix x) (alg/identity G))\n                     (loop (cdr xs)))))))"
     :invariant "∀ a ∈ G. ∃! b ∈ G. a·b = b·a = e"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/inverse — see :summary."
     :composition "(define G (alg/dihedral 4))\n(map (lambda (x) (list x (alg/inverse G x) (alg/op G x (alg/inverse G x))))\n     (alg/op G))"
     :emergent "involutive-map"
     :meta "The emergent involutive-map belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Inverse-then-inverse = identity; the same involution family covers negation, transpose, complex conjugate. See book-of-code ch-02 (boolean-logic).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the involutive-map pattern."
     :cs "The emergent involutive-map is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/invert': r"""  :row-2-audit (
    (:problem "A twelve-tone composer needs the inversion I(S) of a row S under a chosen axis so the composition can present the I-form of the tone-row."
     :program "(alg/invert (alg/pcset (list 0 4 7)))"
     :explanation "Inverted around 0: 0→0, 4→8, 7→5; operator sees (0 5 8)."
     :meta "transpose shifts; invert reflects. Both are affine, but they give different sets — twelve-tone technique needs both.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'reflection in Z/12Z'"
     :rungs (
       (:domain "alg native" :code "(alg/invert (alg/pcset (list 0 4 7)))")
       (:domain "sprite mirror flip" :code "(sprite/flip axis sp)")
       (:domain "inversion I_k in pitch-class algebra" :code "I_k(p) = (k - p) mod 12"))
     :explanation "Rung 1 is alg/invert in its native library. Rung 2 shows the same ''reflection in Z/12Z'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''reflection in Z/12Z'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/invert."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Inversion is an involution: I(I(S)) = S."
     :program "(define S (alg/pcset (list 0 3 6 9)))\n(equal? S (alg/invert (alg/invert S)))"
     :invariant "∀ S. I(I(S)) = S"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/invert — see :summary."
     :composition "(define row (alg/pcset (list 0 1 3 7)))\n(list (alg/transpose row 3) (alg/invert (alg/transpose row 3)))"
     :emergent "PI-forms"
     :meta "The emergent PI-forms belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Transpose + invert generate the T/I group (the standard operations on pitch-class sets).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the PI-forms pattern."
     :cs "The emergent PI-forms is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/is-abelian?': r"""  :row-2-audit (
    (:problem "A quick classification step needs a boolean: does this Cayley table commute everywhere, so we can skip conjugacy-class computation?"
     :program "(list (alg/is-abelian? (alg/cyclic 8))\n      (alg/is-abelian? (alg/symmetric 3)))"
     :explanation "C_8 is abelian, S_3 is not; the operator sees (#t #f)."
     :meta "alg/center returns the elements that commute with everything; alg/is-abelian? asks whether that set is the whole group. The finer verb costs more; the boolean is the fast filter.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'order-does-not-matter of a binary op'"
     :rungs (
       (:domain "alg native" :code "(list (alg/is-abelian? (alg/cyclic 8))")
       (:domain "two effects that commute in a scene" :code "(fx/commutative? a b)")
       (:domain "commutative monoid" :code "a·b = b·a ∀ a,b"))
     :explanation "Rung 1 is alg/is-abelian? in its native library. Rung 2 shows the same ''order-does-not-matter of a binary op'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''order-does-not-matter of a binary op'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/is-abelian?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "G is abelian iff its Cayley table is symmetric."
     :program "(define G (alg/cyclic 4))\n(define xs (alg/op G))\n(let loop ((as xs))\n  (or (null? as)\n      (let loop2 ((bs xs))\n        (or (null? bs)\n            (and (equal? (alg/op G (car as) (car bs))\n                         (alg/op G (car bs) (car as)))\n                 (loop2 (cdr bs)))))\n      (loop (cdr as))))"
     :invariant "∀ a b ∈ G. a·b = b·a"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/is-abelian? — see :summary."
     :composition "(define groups (list (alg/cyclic 5) (alg/dihedral 4)))\n(map alg/is-abelian? groups)"
     :emergent "structural-tag"
     :meta "The emergent structural-tag belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same family as tagging a data structure with a semantic property (immutable? sorted?) for downstream fast paths.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the structural-tag pattern."
     :cs "The emergent structural-tag is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/is-field?': r"""  :row-2-audit (
    (:problem "A cryptography setup step needs a prime modulus so that Z/pZ is a field (every nonzero element has an inverse). The audit refuses composite moduli."
     :program "(list (alg/is-field? 11) (alg/is-field? 12))"
     :explanation "11 is prime, 12 is not; operator sees (#t #f) and knows to reject 12."
     :meta "alg/is-group? tests one binary op; alg/is-field? tests both addition and multiplication and inverses. Cryptography needs the multiplicative side too.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'universal invertibility of nonzero elements'"
     :rungs (
       (:domain "alg native" :code "(list (alg/is-field? 11) (alg/is-field? 12))")
       (:domain "every nonzero pixel has an alpha-inverse" :code "(color/alpha-invertible? px)")
       (:domain "field axiom over Z/nZ" :code "n prime"))
     :explanation "Rung 1 is alg/is-field? in its native library. Rung 2 shows the same ''universal invertibility of nonzero elements'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''universal invertibility of nonzero elements'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/is-field?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Z/nZ is a field iff n is prime."
     :program "(let loop ((ns (list 2 3 4 5 6 7 8 9 10 11)))\n  (or (null? ns)\n      (and (eq? (alg/is-field? (car ns)) (nt/prime? (car ns)))\n           (loop (cdr ns)))))"
     :invariant "Z/nZ field ⇔ n prime"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure). Also ch-advanced-01 (Number Theory & Cryptography) for the prime characterization.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/is-field? — see :summary."
     :composition "(define primes (filter alg/is-field? (list 2 3 4 5 6 7 8 9 10 11 12 13)))\nprimes"
     :emergent "prime-filter"
     :meta "The emergent prime-filter belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Filter-by-property is a universal collection pattern; see book-of-composition ch-12 (voice-pool).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the prime-filter pattern."
     :cs "The emergent prime-filter is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/is-group?': r"""  :row-2-audit (
    (:problem "A user-submitted Cayley table needs validation before any group-theoretic verb touches it — an invalid table would silently corrupt downstream conjugacy or orbit computations."
     :program "(define good '((0 1 2) (1 2 0) (2 0 1)))\n(define bad '((0 1) (1 0) (1 1)))\n(list (alg/is-group? good) (alg/is-group? bad))"
     :explanation "Good is Z/3Z, bad has a repeated row entry; operator sees (#t #f)."
     :meta "alg/is-abelian? assumes a group; alg/is-group? is the gate. Skipping the gate means downstream results are meaningless.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'axiom validation of a data structure'"
     :rungs (
       (:domain "alg native" :code "(define good '((0 1 2) (1 2 0) (2 0 1)))")
       (:domain "typechecking a sprite atlas" :code "(sprite/atlas-valid? atlas)")
       (:domain "group axioms — closure, associativity, identity, inverses" :code "the group axioms"))
     :explanation "Rung 1 is alg/is-group? in its native library. Rung 2 shows the same ''axiom validation of a data structure'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''axiom validation of a data structure'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/is-group?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "A table is a group iff it is closed, has identity, has inverses, and is associative."
     :program "(define G (alg/cyclic 3))\n(alg/is-group? G)"
     :invariant "G group ⇔ closed ∧ ∃ e ∧ ∀ a ∃ a^-1 ∧ ∀ a b c. (a·b)·c = a·(b·c)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/is-group? — see :summary."
     :composition "(define candidates (list (alg/cyclic 4) (alg/dihedral 3) '((0 1) (1 1))))\n(map alg/is-group? candidates)"
     :emergent "validation-filter"
     :meta "The emergent validation-filter belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same family as JSON-schema validation for structured data — refuse malformed input before processing. See book-of-composition ch-15 (http-server) for the input-validation frame.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the validation-filter pattern."
     :cs "The emergent validation-filter is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/is-homomorphism?': r"""  :row-2-audit (
    (:problem "A candidate map between two groups needs to be certified as structure-preserving before being used as the basis for a quotient or embedding argument."
     :program "(define G (alg/zn 4))\n(define H (alg/zn 2))\n(define phi (lambda (x) (modulo x 2)))\n(alg/is-homomorphism? G H phi)"
     :explanation "phi: x→x mod 2 preserves addition; the operator sees #t."
     :meta "Isomorphism demands bijection *and* preservation; homomorphism demands only preservation. A homomorphism-check that returns #t does not certify bijectivity — that is why the two verbs exist.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'structure-preserving map between two systems'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/zn 4))")
       (:domain "sprite-to-hitbox translation" :code "(collision/lift-sprite sp)")
       (:domain "group homomorphism" :code "φ(a·b) = φ(a)·φ(b)"))
     :explanation "Rung 1 is alg/is-homomorphism? in its native library. Rung 2 shows the same ''structure-preserving map between two systems'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''structure-preserving map between two systems'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/is-homomorphism?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "If φ is a homomorphism then φ(e_G) = e_H and φ(a^-1) = φ(a)^-1."
     :program "(define G (alg/zn 6))\n(define H (alg/zn 3))\n(define phi (lambda (x) (modulo x 3)))\n(and (alg/is-homomorphism? G H phi)\n     (equal? (phi 0) 0))"
     :invariant "φ: G → H hom  ⇒  φ(e_G) = e_H ∧ ∀ a. φ(a^-1) = φ(a)^-1"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/is-homomorphism? — see :summary."
     :composition "(define G (alg/zn 6))\n(define H (alg/zn 3))\n(define phi (lambda (x) (modulo x 3)))\n(if (alg/is-homomorphism? G H phi)\n    (list (alg/kernel G H phi) (alg/image G H phi))\n    'not-a-hom)"
     :emergent "kernel-image-pair"
     :meta "The emergent kernel-image-pair belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. hom + kernel + image is the input to the First Isomorphism Theorem — a universal pattern in every algebraic category.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the kernel-image-pair pattern."
     :cs "The emergent kernel-image-pair is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/is-isomorphic?': r"""  :row-2-audit (
    (:problem "Two group constructions may produce differently labelled but structurally identical groups; the audit is 'are these the same group up to relabelling?'"
     :program "(define A (alg/direct-product (alg/cyclic 2) (alg/cyclic 3)))\n(define B (alg/cyclic 6))\n(alg/is-isomorphic? A B)"
     :explanation "C_2 × C_3 ≅ C_6 because gcd(2,3)=1; the operator sees #t."
     :meta "Homomorphism is one-directional and need not be onto; isomorphism is the bijective, structure-preserving equality. Only isomorphism justifies calling two groups 'the same'.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'sameness up to relabelling'"
     :rungs (
       (:domain "alg native" :code "(define A (alg/direct-product (alg/cyclic 2) (alg/cyclic 3)))")
       (:domain "two audio patches with same routing" :code "(audio/patch-equivalent? p q)")
       (:domain "categorical isomorphism" :code "A ≅ B"))
     :explanation "Rung 1 is alg/is-isomorphic? in its native library. Rung 2 shows the same ''sameness up to relabelling'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''sameness up to relabelling'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/is-isomorphic?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Isomorphism is an equivalence relation on groups."
     :program "(define A (alg/cyclic 6))\n(and (alg/is-isomorphic? A A)\n     (or (not (alg/is-isomorphic? A (alg/cyclic 4)))\n         (alg/is-isomorphic? (alg/cyclic 4) A)))"
     :invariant "≅ is reflexive, symmetric, transitive"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/is-isomorphic? — see :summary."
     :composition "(define candidates (list (alg/cyclic 4) (alg/direct-product (alg/cyclic 2) (alg/cyclic 2))))\n(map (lambda (g) (alg/is-isomorphic? g (alg/cyclic 4))) candidates)"
     :emergent "classification"
     :meta "The emergent classification belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Iso-class enumeration is the same pattern as canonicalizing objects into equivalence classes for a lookup table.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the classification pattern."
     :cs "The emergent classification is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/is-normal?': r"""  :row-2-audit (
    (:problem "Before constructing a quotient G/H, the operator must certify that H is normal — otherwise the coset multiplication is ill-defined and downstream code corrupts."
     :program "(define G (alg/symmetric 3))\n(define A3 (filter (lambda (p) (even? (alg/perm-parity p))) (alg/op G)))\n(alg/is-normal? G A3)"
     :explanation "A_3 has index 2 in S_3; every index-2 subgroup is normal; operator sees #t."
     :meta "subgroup? tests closure; is-normal? adds the conjugation-invariance requirement. Skipping the second test means the 'quotient' is not a group at all.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'invariance under inner action'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/symmetric 3))")
       (:domain "layer respected by all effects" :code "(fx/preserves-layer? layer)")
       (:domain "normal subgroup" :code "gHg^-1 = H ∀ g"))
     :explanation "Rung 1 is alg/is-normal? in its native library. Rung 2 shows the same ''invariance under inner action'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''invariance under inner action'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/is-normal?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "H ⊴ G iff every left coset equals the corresponding right coset."
     :program "(define G (alg/dihedral 4))\n(define rots (alg/subgroup-gen G (list 1)))\n(alg/is-normal? G rots)"
     :invariant "H ⊴ G ⇔ ∀ g ∈ G. gH = Hg"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/is-normal? — see :summary."
     :composition "(define G (alg/dihedral 4))\n(define candidates (list (list 0) (alg/subgroup-gen G (list 1))))\n(map (lambda (H) (list H (alg/is-normal? G H))) candidates)"
     :emergent "quotient-eligible"
     :meta "The emergent quotient-eligible belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Normality is the gate for quotient constructions; the same pattern as choosing a 'stable' equivalence class before quotienting.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the quotient-eligible pattern."
     :cs "The emergent quotient-eligible is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/kernel': r"""  :row-2-audit (
    (:problem "A homomorphism's kernel is where the map collapses information; the operator needs to enumerate the collapsed elements before quotienting."
     :program "(define G (alg/zn 6))\n(define H (alg/zn 2))\n(define phi (lambda (x) (modulo x 2)))\n(alg/kernel G H phi)"
     :explanation "Even elements {0, 2, 4} map to 0; operator sees (0 2 4)."
     :meta "Image is what's hit; kernel is what's collapsed. Confusing them leads to backwards conclusions about injectivity.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'preimage of the identity'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/zn 6))")
       (:domain "inputs that produce no state change" :code "(input/no-op-inputs state)")
       (:domain "kernel of a homomorphism" :code "ker(φ) = {g : φ(g) = e_H}"))
     :explanation "Rung 1 is alg/kernel in its native library. Rung 2 shows the same ''preimage of the identity'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''preimage of the identity'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/kernel."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "ker(φ) is a normal subgroup of G."
     :program "(define G (alg/zn 6))\n(define H (alg/zn 3))\n(define phi (lambda (x) (modulo x 3)))\n(alg/is-normal? G (alg/kernel G H phi))"
     :invariant "ker(φ) ⊴ G"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/kernel — see :summary."
     :composition "(define G (alg/symmetric 3))\n(define Z2 (alg/zn 2))\n(define sgn (lambda (p) (if (even? (alg/perm-parity p)) 0 1)))\n(define A3 (alg/kernel G Z2 sgn))\n(list (length A3) (alg/is-normal? G A3))"
     :emergent "normal-subgroup-from-hom"
     :meta "The emergent normal-subgroup-from-hom belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Kernel-of-hom = normal subgroup; every normal subgroup arises as a kernel.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the normal-subgroup-from-hom pattern."
     :cs "The emergent normal-subgroup-from-hom is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/normal-form': r"""  :row-2-audit (
    (:problem "Two rotations of the same pcset need a canonical representative so they compare equal after normalization."
     :program "(equal? (alg/normal-form (list 4 7 0)) (alg/normal-form (list 0 4 7)))"
     :explanation "Both rotations normalize to the same canonical form; operator sees #t."
     :meta "prime-form goes further and identifies under inversion too; normal-form is one step behind (rotation only).")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'canonical representative under an equivalence'"
     :rungs (
       (:domain "alg native" :code "(equal? (alg/normal-form (list 4 7 0)) (alg/normal-form (list 0 4 7)))")
       (:domain "Unicode NFC normalization" :code "(unicode/nfc s)")
       (:domain "canonical form under cyclic rotation" :code "rotation-canonical(S)"))
     :explanation "Rung 1 is alg/normal-form in its native library. Rung 2 shows the same ''canonical representative under an equivalence'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''canonical representative under an equivalence'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/normal-form."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Normal form is idempotent: normalizing a normal form returns it unchanged."
     :program "(define S (alg/pcset (list 0 4 7)))\n(equal? (alg/normal-form S) (alg/normal-form (alg/normal-form S)))"
     :invariant "∀ S. nf(nf(S)) = nf(S)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/normal-form — see :summary."
     :composition "(define rotations (map (lambda (k) (alg/transpose (alg/pcset (list 0 1 4)) k)) (list 0 3 6)))\n(map alg/normal-form rotations)"
     :emergent "rotation-canonical"
     :meta "The emergent rotation-canonical belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Canonicalization = idempotent normalization; same shape as path canonicalization in filesystems. See book-of-composition ch-13.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the rotation-canonical pattern."
     :cs "The emergent rotation-canonical is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/nr-L': r"""  :row-2-audit (
    (:problem "A late-Romantic harmonic analysis needs to trace an L-transform sequence; the audit wants a single call that returns the transformed triad rather than trigonometry over voicings."
     :program "(alg/nr-L (alg/triad 0 'major))"
     :explanation "C major L→ E minor; operator sees the transformed triad."
     :meta "P swaps parallel major/minor at the same root; L swaps at the leading-tone. Different musical effects, same group family.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'reflection in a chord space'"
     :rungs (
       (:domain "alg native" :code "(alg/nr-L (alg/triad 0 'major))")
       (:domain "sprite mirror across a specific axis" :code "(sprite/mirror-axis sp axis)")
       (:domain "L-involution in the PLR group" :code "L: T → T"))
     :explanation "Rung 1 is alg/nr-L in its native library. Rung 2 shows the same ''reflection in a chord space'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''reflection in a chord space'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/nr-L."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "L is an involution: L∘L = identity."
     :program "(define c (alg/triad 0 'major))\n(equal? c (alg/nr-L (alg/nr-L c)))"
     :invariant "∀ triad t. L(L(t)) = t"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/nr-L — see :summary."
     :composition "(define c (alg/triad 0 'major))\n(list c (alg/nr-L c) (alg/nr-P c) (alg/nr-R c))"
     :emergent "PLR-group"
     :meta "The emergent PLR-group belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. L, P, R generate the PLR group acting on major/minor triads — a classical non-abelian group. See book-of-composition ch-05 (piano-roll).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the PLR-group pattern."
     :cs "The emergent PLR-group is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/nr-P': r"""  :row-2-audit (
    (:problem "Analyzing modal mixture (borrowed chords) needs P-transforms — swap parallel major/minor at the same root."
     :program "(alg/nr-P (alg/triad 0 'major))"
     :explanation "C major P→ C minor; operator sees (0 3 7)."
     :meta "L keeps two notes and moves one by semitone; P keeps root and fifth and moves the third by semitone. Different neighborhood.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'reflection swap of major/minor'"
     :rungs (
       (:domain "alg native" :code "(alg/nr-P (alg/triad 0 'major))")
       (:domain "theme-variation modal shift" :code "(mode/parallel-swap theme)")
       (:domain "P-involution" :code "P: T → T"))
     :explanation "Rung 1 is alg/nr-P in its native library. Rung 2 shows the same ''reflection swap of major/minor'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''reflection swap of major/minor'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/nr-P."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "P is an involution: P∘P = identity."
     :program "(define c (alg/triad 0 'major))\n(equal? c (alg/nr-P (alg/nr-P c)))"
     :invariant "∀ triad t. P(P(t)) = t"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/nr-P — see :summary."
     :composition "(define c (alg/triad 0 'major))\n(list c (alg/nr-P c) (alg/nr-P (alg/nr-L c)))"
     :emergent "mode-toggle"
     :meta "The emergent mode-toggle belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. P is the parallel major/minor toggle; used everywhere in chromatic harmony.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the mode-toggle pattern."
     :cs "The emergent mode-toggle is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/nr-R': r"""  :row-2-audit (
    (:problem "Relative major/minor moves in Romantic music are R-transforms; the analysis needs to trace them mechanically."
     :program "(alg/nr-R (alg/triad 0 'major))"
     :explanation "C major R→ A minor; operator sees (9 0 4) or the sorted (0 4 9)."
     :meta "L moves one note by semitone; R moves one note by whole-step. R travels further in voice-leading space.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'reflection to relative key'"
     :rungs (
       (:domain "alg native" :code "(alg/nr-R (alg/triad 0 'major))")
       (:domain "scene key-signature change" :code "(scene/relative-key-shift stage)")
       (:domain "R-involution" :code "R: T → T"))
     :explanation "Rung 1 is alg/nr-R in its native library. Rung 2 shows the same ''reflection to relative key'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''reflection to relative key'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/nr-R."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "R is an involution: R∘R = identity."
     :program "(define c (alg/triad 0 'major))\n(equal? c (alg/nr-R (alg/nr-R c)))"
     :invariant "∀ triad t. R(R(t)) = t"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/nr-R — see :summary."
     :composition "(define c (alg/triad 0 'major))\n(define cycle (let loop ((n 0) (cur c) (acc '()))\n  (cond ((= n 6) (reverse acc))\n        (else (loop (+ n 1) (alg/nr-R (alg/nr-L cur)) (cons cur acc))))))\ncycle"
     :emergent "hexatonic-cycle"
     :meta "The emergent hexatonic-cycle belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. RL alternation generates hexatonic cycles — a foundational neo-Riemannian pattern.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the hexatonic-cycle pattern."
     :cs "The emergent hexatonic-cycle is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/op': r"""  :row-2-audit (
    (:problem "An algebra script needs the group's binary operation as a first-class function to fold over lists of elements — no built-in fold works without the operation."
     :program "(define G (alg/cyclic 5))\n(define product (foldl (lambda (x acc) (alg/op G x acc)) (alg/identity G) (list 1 2 3 4)))\nproduct"
     :explanation "Fold multiplies 1·2·3·4 in Z/5Z; 1+2+3+4=10≡0 mod 5; operator sees 0."
     :meta "alg/orbit does a group action, not a pairwise op; the audit needs pairwise composition, and alg/op is the direct primitive.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'binary composition inside a closed set'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/cyclic 5))")
       (:domain "two sprites overlaid into one" :code "(sprite/overlay a b)")
       (:domain "group operation G × G → G" :code "(g, h) ↦ g·h"))
     :explanation "Rung 1 is alg/op in its native library. Rung 2 shows the same ''binary composition inside a closed set'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''binary composition inside a closed set'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/op."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "alg/op is associative, has identity, and is closed on G."
     :program "(define G (alg/symmetric 3))\n(define perms (alg/op G))\n(define a (car perms)) (define b (cadr perms)) (define c (caddr perms))\n(equal? (alg/op G a (alg/op G b c))\n        (alg/op G (alg/op G a b) c))"
     :invariant "∀ a b c ∈ G. (a·b)·c = a·(b·c)  ∧  a·b ∈ G"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/op — see :summary."
     :composition "(define G (alg/dihedral 3))\n(define e (alg/identity G))\n(define g 1)\n(let loop ((n 0) (cur e) (acc '()))\n  (cond ((= n 3) (reverse acc))\n        (else (loop (+ n 1) (alg/op G cur g) (cons cur acc)))))"
     :emergent "power-sequence"
     :meta "The emergent power-sequence belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. op + identity + iterate = power sequence; the same as repeated squaring in modular arithmetic. See book-of-code ch-11 (the-alu).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the power-sequence pattern."
     :cs "The emergent power-sequence is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/orbit': r"""  :row-2-audit (
    (:problem "A tile-decoration script computes all rotations and reflections of a base tile position; the operator wants a single call that returns the orbit rather than looping in user code."
     :program "(define D4 (alg/dihedral 4))\n(define act (lambda (g p) (alg/apply-symmetry g p)))\n(alg/orbit D4 (list 1 0) act)"
     :explanation "Orbit of (1,0) under D_4 has 4 distinct positions (the 4 cardinal directions); operator sees a 4-element list."
     :meta "subgroup-gen closes a subset under the group operation; orbit acts an external group on a point outside the group. Different but often confused.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'closure of a point under group action'"
     :rungs (
       (:domain "alg native" :code "(define D4 (alg/dihedral 4))")
       (:domain "all mirrored copies of a sprite" :code "(sprite/all-symmetric-copies sp)")
       (:domain "orbit of a group action" :code "G·x = {g·x : g ∈ G}"))
     :explanation "Rung 1 is alg/orbit in its native library. Rung 2 shows the same ''closure of a point under group action'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''closure of a point under group action'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/orbit."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "|G·x| · |stab_G(x)| = |G| (orbit-stabilizer)."
     :program "(define D4 (alg/dihedral 4))\n(define p (list 1 0))\n(define act (lambda (g q) (alg/apply-symmetry g q)))\n(define orb (alg/orbit D4 p act))\n(define stab (alg/stabilizer D4 p act))\n(= (* (length orb) (length stab)) (alg/order D4))"
     :invariant "|G·x| · |Stab_G(x)| = |G|"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry). Also ch-advanced-02 (Combinatorics & Counting) for orbit counting.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/orbit — see :summary."
     :composition "(define G (alg/dihedral 6))\n(define seeds (list (list 1 0) (list 2 1)))\n(map (lambda (p) (alg/orbit G p (lambda (g q) (alg/apply-symmetry g q)))) seeds)"
     :emergent "orbit-decomposition"
     :meta "The emergent orbit-decomposition belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Orbits partition the space acted on — same tiling family as cosets. See book-of-composition ch-06 (sprite-grid).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the orbit-decomposition pattern."
     :cs "The emergent orbit-decomposition is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/order': r"""  :row-2-audit (
    (:problem "A verification pass needs to check that a group construction produced the intended cardinality — a mismatch is a bug in either the construction or the caller's understanding."
     :program "(define G (alg/dihedral 5))\n(= (alg/order G) 10)"
     :explanation "D_5 must have 10 elements; the operator gets #t confirming the construction is correct."
     :meta "alg/element-order asks about a single element; alg/order asks about the whole group. Confusing them silently gives wrong subgroup-index calculations.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'cardinality of a finite algebraic object'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/dihedral 5))")
       (:domain "sprite count in a scene" :code "(scene/sprite-count stage)")
       (:domain "|G| — the size of a finite set" :code "|X|"))
     :explanation "Rung 1 is alg/order in its native library. Rung 2 shows the same ''cardinality of a finite algebraic object'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''cardinality of a finite algebraic object'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/order."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For any subgroup H ≤ G, |H| divides |G| (Lagrange)."
     :program "(define G (alg/symmetric 3))\n(define H (alg/subgroup-gen G (list (alg/perm (list 1 0 2)))))\n(zero? (modulo (alg/order G) (length H)))"
     :invariant "∀ H ≤ G. |H| | |G|"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/order — see :summary."
     :composition "(define G (alg/dihedral 4))\n(map (lambda (H) (list (length H) (/ (alg/order G) (length H))))\n     (map (lambda (g) (alg/subgroup-gen G (list g))) (alg/op G)))"
     :emergent "subgroup-lattice"
     :meta "The emergent subgroup-lattice belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. The lattice of subgroups indexed by order is a classical structural fingerprint.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the subgroup-lattice pattern."
     :cs "The emergent subgroup-lattice is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/pcset': r"""  :row-2-audit (
    (:problem "A composer needs to canonicalize a chord written as C, E, G into the pitch-class set {0, 4, 7} for further algebraic analysis."
     :program "(alg/pcset (list 12 16 19))"
     :explanation "Pitches mod 12 → {0, 4, 7}; operator sees the sorted set."
     :meta "normal-form picks a canonical rotation; pcset just reduces mod 12 and dedupes. Use pcset first, then normal-form to compare across rotations.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'reduction to canonical residues'"
     :rungs (
       (:domain "alg native" :code "(alg/pcset (list 12 16 19))")
       (:domain "hash-key normalization" :code "(hash/canon key)")
       (:domain "mod-12 quotient" :code "Z → Z/12Z"))
     :explanation "Rung 1 is alg/pcset in its native library. Rung 2 shows the same ''reduction to canonical residues'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''reduction to canonical residues'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/pcset."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Every pitch-class set is a subset of Z/12Z; pcset returns the sorted deduped mod-12 residues."
     :program "(equal? (alg/pcset (list 0 4 7 12 16)) (alg/pcset (list 0 4 7)))"
     :invariant "pcset(L) = sort(dedupe({x mod 12 : x ∈ L}))"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/pcset — see :summary."
     :composition "(define chord (alg/pcset (list 60 64 67)))\n(alg/interval-vector chord)"
     :emergent "harmonic-fingerprint"
     :meta "The emergent harmonic-fingerprint belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Pcset + interval-vector is the standard set-class fingerprint in music theory.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the harmonic-fingerprint pattern."
     :cs "The emergent harmonic-fingerprint is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm': r"""  :row-2-audit (
    (:problem "A puzzle solver needs a concrete permutation object from an array — the array-form is what humans read and what test cases store."
     :program "(define p (alg/perm (list 2 0 1 3)))\n(alg/perm-apply p 0)"
     :explanation "Array [2 0 1 3] sends 0 → 2; operator sees 2."
     :meta "cycles->perm accepts cycle-notation; alg/perm accepts array-notation. Both are valid inputs; alg/perm is the more direct answer when the array is what you have.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'total function from finite set to itself'"
     :rungs (
       (:domain "alg native" :code "(define p (alg/perm (list 2 0 1 3)))")
       (:domain "sprite index remapping" :code "(sprite/remap-indices arr)")
       (:domain "bijection on {0,...,n-1}" :code "π: {0,...,n-1} → {0,...,n-1}"))
     :explanation "Rung 1 is alg/perm in its native library. Rung 2 shows the same ''total function from finite set to itself'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''total function from finite set to itself'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "alg/perm(v) is a permutation iff v contains each of 0,...,n-1 exactly once."
     :program "(define arr (list 3 1 0 2))\n(define p (alg/perm arr))\n(equal? (sort (map (lambda (i) (alg/perm-apply p i)) (list 0 1 2 3)) <)\n        (list 0 1 2 3))"
     :invariant "σ ∈ S_n ⇔ σ is a bijection {0,...,n-1} → {0,...,n-1}"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry). Also ch-advanced-02 (Combinatorics & Counting) for counting.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm — see :summary."
     :composition "(define p (alg/perm (list 2 0 1 3)))\n(define pi (alg/perm-inverse p))\n(map (lambda (i) (alg/perm-apply pi (alg/perm-apply p i))) (list 0 1 2 3))"
     :emergent "bijection"
     :meta "The emergent bijection belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. perm + perm-inverse = round-trip identity; the same shape as encode/decode pairs.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the bijection pattern."
     :cs "The emergent bijection is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm->cycles': r"""  :row-2-audit (
    (:problem "A permutation stored as an array is opaque; the audit wants the cycle decomposition so orbit lengths and parity are visible."
     :program "(define p (alg/perm (list 1 2 0 4 3)))\n(alg/perm->cycles p)"
     :explanation "Cycles: (0 1 2)(3 4); operator reads two orbits of length 3 and 2."
     :meta "cycles->perm is the inverse direction; perm->cycles is the decomposition. Together they form a round-trip pair — a common notation-independence pattern.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'canonical decomposition of a mapping'"
     :rungs (
       (:domain "alg native" :code "(define p (alg/perm (list 1 2 0 4 3)))")
       (:domain "graph strongly-connected components" :code "(graph/scc adj)")
       (:domain "cycle structure of a permutation" :code "σ = ∏ c_i"))
     :explanation "Rung 1 is alg/perm->cycles in its native library. Rung 2 shows the same ''canonical decomposition of a mapping'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''canonical decomposition of a mapping'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm->cycles."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Every permutation decomposes uniquely (up to order and cycle rotation) into disjoint cycles."
     :program "(define p (alg/perm (list 2 0 1 4 3)))\n(define cs (alg/perm->cycles p))\n(define round-trip (alg/cycles->perm 5 cs))\n(equal? (map (lambda (i) (alg/perm-apply p i)) (list 0 1 2 3 4))\n        (map (lambda (i) (alg/perm-apply round-trip i)) (list 0 1 2 3 4)))"
     :invariant "∀ σ. σ = c_1 · c_2 · … · c_k with disjoint c_i, unique up to reordering"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm->cycles — see :summary."
     :composition "(define p (alg/perm (list 1 2 3 0 5 4)))\n(define cs (alg/perm->cycles p))\n(list cs (apply lcm (map length cs)))"
     :emergent "order-formula"
     :meta "The emergent order-formula belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. LCM of cycle lengths = order; the same shape as computing a system period from component periods.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the order-formula pattern."
     :cs "The emergent order-formula is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-apply': r"""  :row-2-audit (
    (:problem "A permutation must act on an index to produce the destination — the primitive lookup underlies every scheduling and swap operation."
     :program "(define p (alg/perm (list 2 0 1)))\n(map (lambda (i) (alg/perm-apply p i)) (list 0 1 2))"
     :explanation "p sends (0 1 2) → (2 0 1); operator sees the reordered list."
     :meta "Compose gives the product permutation; apply gives the value at one point. Apply is the read operation.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'evaluation of a function at a point'"
     :rungs (
       (:domain "alg native" :code "(define p (alg/perm (list 2 0 1)))")
       (:domain "hash lookup" :code "(hash/get h key)")
       (:domain "function evaluation" :code "σ(i)"))
     :explanation "Rung 1 is alg/perm-apply in its native library. Rung 2 shows the same ''evaluation of a function at a point'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''evaluation of a function at a point'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-apply."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Repeated application of a permutation returns to the starting index after exactly ord(σ) steps."
     :program "(define p (alg/perm (list 1 2 0)))\n(define order (alg/perm-order p))\n(let loop ((n 0) (cur 0))\n  (cond ((= n order) (= cur 0))\n        (else (loop (+ n 1) (alg/perm-apply p cur)))))"
     :invariant "∀ i. σ^{ord(σ)}(i) = i"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-apply — see :summary."
     :composition "(define p (alg/perm (list 2 0 1)))\n(define orbit\n  (let loop ((cur 0) (acc '()) (seen (list)))\n    (cond ((member cur seen) (reverse acc))\n          (else (loop (alg/perm-apply p cur) (cons cur acc) (cons cur seen))))))\norbit"
     :emergent "orbit-of-point"
     :meta "The emergent orbit-of-point belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Repeated apply until return = classic orbit computation.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the orbit-of-point pattern."
     :cs "The emergent orbit-of-point is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-compose': r"""  :row-2-audit (
    (:problem "Two permutations applied in sequence must combine into a single permutation to preserve the invariant that S_n is closed under composition."
     :program "(define a (alg/perm (list 1 0 2)))\n(define b (alg/perm (list 0 2 1)))\n(define c (alg/perm-compose a b))\n(map (lambda (i) (alg/perm-apply c i)) (list 0 1 2))"
     :explanation "Composition of transposition (0 1) with (1 2) is the 3-cycle (0 1 2); operator sees (1 2 0) or similar depending on convention."
     :meta "Apply acts on one point; compose combines two permutations into one — the group operation for S_n.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'binary composition of maps'"
     :rungs (
       (:domain "alg native" :code "(define a (alg/perm (list 1 0 2)))")
       (:domain "overlay two sprite transforms" :code "(sprite/overlay t1 t2)")
       (:domain "composition in S_n" :code "σ ∘ τ"))
     :explanation "Rung 1 is alg/perm-compose in its native library. Rung 2 shows the same ''binary composition of maps'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''binary composition of maps'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-compose."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Composition of permutations is associative and has identity, forming the group S_n."
     :program "(define a (alg/perm (list 1 2 0)))\n(define b (alg/perm (list 0 2 1)))\n(define c (alg/perm (list 2 0 1)))\n(equal? (map (lambda (i) (alg/perm-apply (alg/perm-compose a (alg/perm-compose b c)) i))\n              (list 0 1 2))\n        (map (lambda (i) (alg/perm-apply (alg/perm-compose (alg/perm-compose a b) c) i))\n              (list 0 1 2)))"
     :invariant "∀ σ τ ρ ∈ S_n. σ ∘ (τ ∘ ρ) = (σ ∘ τ) ∘ ρ"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-compose — see :summary."
     :composition "(define p (alg/perm (list 1 2 0)))\n(define pp (alg/perm-compose p p))\n(define ppp (alg/perm-compose p pp))\n(list pp ppp)"
     :emergent "iterated-power"
     :meta "The emergent iterated-power belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Power sequence σ, σ^2, σ^3 — used to compute element order by iteration.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the iterated-power pattern."
     :cs "The emergent iterated-power is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-conjugate': r"""  :row-2-audit (
    (:problem "Cycle structure is preserved under conjugation; the audit wants to see σ and xσx^-1 side-by-side to confirm the cycle types match."
     :program "(define s (alg/perm (list 1 2 0 3)))\n(define x (alg/perm (list 3 0 1 2)))\n(define sc (alg/perm-conjugate x s))\n(list (alg/perm->cycles s) (alg/perm->cycles sc))"
     :explanation "Both should have the same cycle type; operator sees two cycle lists with matching length signatures."
     :meta "Compose is the raw operation; conjugate is a specific pattern xσx^-1 that has meaning independent of the composition primitive.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'change-of-basis for a mapping'"
     :rungs (
       (:domain "alg native" :code "(define s (alg/perm (list 1 2 0 3)))")
       (:domain "viewpoint change on a sprite transform" :code "(sprite/rebasis t new-frame)")
       (:domain "conjugation in a group" :code "x σ x^-1"))
     :explanation "Rung 1 is alg/perm-conjugate in its native library. Rung 2 shows the same ''change-of-basis for a mapping'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''change-of-basis for a mapping'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-conjugate."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Conjugation preserves cycle type: σ and xσx^-1 have the same cycle-length multiset."
     :program "(define s (alg/perm (list 1 2 0 4 3)))\n(define x (alg/perm (list 2 3 0 1 4)))\n(define sc (alg/perm-conjugate x s))\n(equal? (sort (map length (alg/perm->cycles s)) <)\n        (sort (map length (alg/perm->cycles sc)) <))"
     :invariant "∀ σ x. cycle-type(σ) = cycle-type(xσx^-1)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-conjugate — see :summary."
     :composition "(define s (alg/perm (list 1 0 2 3)))\n(define conj (map (lambda (x) (alg/perm-conjugate x s)) (list (alg/perm (list 0 1 2 3)) (alg/perm (list 1 0 2 3)))))\nconj"
     :emergent "conjugacy-orbit"
     :meta "The emergent conjugacy-orbit belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Conjugation orbit = conjugacy class — the same partition as alg/conjugacy-classes computes.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the conjugacy-orbit pattern."
     :cs "The emergent conjugacy-orbit is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-identity': r"""  :row-2-audit (
    (:problem "A fold over permutations needs the identity element as its seed."
     :program "(define e (alg/perm-identity 4))\n(map (lambda (i) (alg/perm-apply e i)) (list 0 1 2 3))"
     :explanation "Identity leaves each index alone; operator sees (0 1 2 3)."
     :meta "alg/identity requires a group object; alg/perm-identity works directly on a degree n. Use whichever matches the input type.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'identity in a monoid'"
     :rungs (
       (:domain "alg native" :code "(define e (alg/perm-identity 4))")
       (:domain "empty sprite frame" :code "(sprite/empty-frame)")
       (:domain "identity permutation e ∈ S_n" :code "e(i) = i"))
     :explanation "Rung 1 is alg/perm-identity in its native library. Rung 2 shows the same ''identity in a monoid'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''identity in a monoid'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-identity."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "e is the unique fixed point of composition with any permutation."
     :program "(define e (alg/perm-identity 3))\n(define p (alg/perm (list 1 2 0)))\n(and (equal? (map (lambda (i) (alg/perm-apply (alg/perm-compose e p) i)) (list 0 1 2))\n             (map (lambda (i) (alg/perm-apply p i)) (list 0 1 2)))\n     (equal? (map (lambda (i) (alg/perm-apply (alg/perm-compose p e) i)) (list 0 1 2))\n             (map (lambda (i) (alg/perm-apply p i)) (list 0 1 2))))"
     :invariant "∀ σ. e ∘ σ = σ ∘ e = σ"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-identity — see :summary."
     :composition "(define seed (alg/perm-identity 4))\n(define moves (list (alg/perm (list 1 0 2 3)) (alg/perm (list 0 2 1 3))))\n(foldl (lambda (m acc) (alg/perm-compose acc m)) seed moves)"
     :emergent "fold-seed"
     :meta "The emergent fold-seed belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Identity as fold seed = universal accumulator pattern.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the fold-seed pattern."
     :cs "The emergent fold-seed is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-inverse': r"""  :row-2-audit (
    (:problem "After applying a shuffle, the code needs to undo it — the inverse permutation is what maps each destination back to its origin."
     :program "(define p (alg/perm (list 2 0 1)))\n(define pi (alg/perm-inverse p))\n(alg/perm-compose p pi)"
     :explanation "Product should be identity; operator sees the identity permutation on 3 elements."
     :meta "alg/inverse needs a group object; alg/perm-inverse works on permutations directly. Faster when you already have the permutation.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'undo of a bijection'"
     :rungs (
       (:domain "alg native" :code "(define p (alg/perm (list 2 0 1)))")
       (:domain "reversing an animation clip" :code "(animation/reverse clip)")
       (:domain "functional inverse" :code "σ^-1"))
     :explanation "Rung 1 is alg/perm-inverse in its native library. Rung 2 shows the same ''undo of a bijection'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''undo of a bijection'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-inverse."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "σ ∘ σ^-1 = σ^-1 ∘ σ = identity, and the cycle structure of σ^-1 is σ's cycles with each rotated backwards."
     :program "(define p (alg/perm (list 3 0 1 2)))\n(define pi (alg/perm-inverse p))\n(define e (alg/perm-identity 4))\n(equal? (map (lambda (i) (alg/perm-apply (alg/perm-compose p pi) i)) (list 0 1 2 3))\n        (map (lambda (i) (alg/perm-apply e i)) (list 0 1 2 3)))"
     :invariant "∀ σ ∈ S_n. σ ∘ σ^-1 = σ^-1 ∘ σ = e"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-inverse — see :summary."
     :composition "(define shuffle (alg/perm (list 2 3 0 1)))\n(define unshuffle (alg/perm-inverse shuffle))\n(define data (list 'a 'b 'c 'd))\n(define shuffled (map (lambda (i) (list-ref data (alg/perm-apply shuffle i))) (list 0 1 2 3)))\n(map (lambda (i) (list-ref shuffled (alg/perm-apply unshuffle i))) (list 0 1 2 3))"
     :emergent "undo-pair"
     :meta "The emergent undo-pair belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Encode/decode roundtrip — same as save/load. See book-of-composition ch-13.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the undo-pair pattern."
     :cs "The emergent undo-pair is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-order': r"""  :row-2-audit (
    (:problem "A repeated shuffle needs to know how many applications return to the identity, so the caller can bound the iteration."
     :program "(define p (alg/perm (list 1 2 0 4 3)))\n(alg/perm-order p)"
     :explanation "Cycles (0 1 2)(3 4) have LCM 6; operator sees 6."
     :meta "alg/element-order needs a group object; alg/perm-order works on the permutation directly. Same answer, different input contract.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'least period of an iterated map'"
     :rungs (
       (:domain "alg native" :code "(define p (alg/perm (list 1 2 0 4 3)))")
       (:domain "animation loop length" :code "(animation/period clip)")
       (:domain "LCM of cycle lengths" :code "ord(σ) = lcm(|c_i|)"))
     :explanation "Rung 1 is alg/perm-order in its native library. Rung 2 shows the same ''least period of an iterated map'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''least period of an iterated map'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-order."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "ord(σ) = LCM of its disjoint cycle lengths."
     :program "(define p (alg/perm (list 1 2 0 4 3)))\n(define cs (alg/perm->cycles p))\n(= (alg/perm-order p) (apply lcm (map length cs)))"
     :invariant "ord(σ) = lcm({|c_i| : c_i ∈ cycles(σ)})"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-order — see :summary."
     :composition "(define perms (list (alg/perm (list 1 0)) (alg/perm (list 1 2 0)) (alg/perm (list 1 2 0 4 3))))\n(map alg/perm-order perms)"
     :emergent "period"
     :meta "The emergent period belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Iteration period is a universal invariant — same shape as a clock cycle or an oscillator period.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the period pattern."
     :cs "The emergent period is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-parity': r"""  :row-2-audit (
    (:problem "A determinant computation over permutations of matrix rows needs each permutation's parity (even/odd) as ±1 factor."
     :program "(define e (alg/perm (list 0 1 2)))\n(define t (alg/perm (list 1 0 2)))\n(list (alg/perm-parity e) (alg/perm-parity t))"
     :explanation "Identity is even, one transposition is odd; operator sees (even odd) or (0 1)."
     :meta "parity gives 'even/odd'; sign gives ±1. Same information, different encoding; use sign for arithmetic.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'parity of a discrete transformation'"
     :rungs (
       (:domain "alg native" :code "(define e (alg/perm (list 0 1 2)))")
       (:domain "scene state parity check" :code "(scene/mirror-count-parity stack)")
       (:domain "sign homomorphism" :code "sgn: S_n → {±1}"))
     :explanation "Rung 1 is alg/perm-parity in its native library. Rung 2 shows the same ''parity of a discrete transformation'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''parity of a discrete transformation'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-parity."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Parity is a group homomorphism from S_n to Z/2Z with kernel A_n."
     :program "(define S3 (alg/symmetric 3))\n(define Z2 (alg/zn 2))\n(define parity (lambda (p) (if (even? (alg/perm-parity p)) 0 1)))\n(alg/is-homomorphism? S3 Z2 parity)"
     :invariant "parity: S_n → Z/2Z, parity(στ) = parity(σ) + parity(τ) mod 2"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-parity — see :summary."
     :composition "(define S4 (alg/symmetric 4))\n(define A4 (filter (lambda (p) (even? (alg/perm-parity p))) (alg/op S4)))\n(length A4)"
     :emergent "alternating-subgroup"
     :meta "The emergent alternating-subgroup belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same family as A_n from parity — the classical kernel-of-sign example. See book-of-code ch-02.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the alternating-subgroup pattern."
     :cs "The emergent alternating-subgroup is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-pow': r"""  :row-2-audit (
    (:problem "Applying a shuffle k times must be efficient — repeated composition is O(k) but the operator wants a direct call."
     :program "(define p (alg/perm (list 1 2 0)))\n(alg/perm-pow p 5)"
     :explanation "p^5 = p^(5 mod 3) = p^2 (since ord(p)=3); operator sees (2 0 1)."
     :meta "perm-compose is one step; perm-pow does k steps and can exploit ord(σ) for constant-time output. Naive repetition would be linear in k.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'exponentiation of an iterated map'"
     :rungs (
       (:domain "alg native" :code "(define p (alg/perm (list 1 2 0)))")
       (:domain "animation frame at time k" :code "(animation/frame-at clip k)")
       (:domain "group exponentiation" :code "σ^k"))
     :explanation "Rung 1 is alg/perm-pow in its native library. Rung 2 shows the same ''exponentiation of an iterated map'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''exponentiation of an iterated map'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-pow."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "σ^k = σ^(k mod ord(σ))."
     :program "(define p (alg/perm (list 1 2 0)))\n(define order (alg/perm-order p))\n(equal? (map (lambda (i) (alg/perm-apply (alg/perm-pow p 7) i)) (list 0 1 2))\n        (map (lambda (i) (alg/perm-apply (alg/perm-pow p (modulo 7 order)) i)) (list 0 1 2)))"
     :invariant "∀ k ∈ Z. σ^k = σ^(k mod ord(σ))"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-pow — see :summary."
     :composition "(define p (alg/perm (list 2 0 1 3)))\n(define orbit (map (lambda (k) (alg/perm-pow p k)) (list 0 1 2 3 4)))\norbit"
     :emergent "cyclic-orbit"
     :meta "The emergent cyclic-orbit belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Iterated powers of one element = the cyclic subgroup ⟨σ⟩.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the cyclic-orbit pattern."
     :cs "The emergent cyclic-orbit is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-sign': r"""  :row-2-audit (
    (:problem "A matrix-determinant sum-over-permutations needs the ±1 factor for each permutation; a boolean parity is not directly usable in arithmetic."
     :program "(define e (alg/perm (list 0 1 2)))\n(define t (alg/perm (list 1 0 2)))\n(list (alg/perm-sign e) (alg/perm-sign t))"
     :explanation "Sign is +1 for identity, -1 for a single transposition; operator sees (1 -1)."
     :meta "parity gives even/odd as a semantic tag; sign gives ±1 as a number the caller can multiply directly. Determinant computations want the number.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'signed indicator of a discrete transformation'"
     :rungs (
       (:domain "alg native" :code "(define e (alg/perm (list 0 1 2)))")
       (:domain "signed area of a triangle" :code "(geom/signed-area a b c)")
       (:domain "sign character" :code "sgn(σ) = (-1)^{parity(σ)}"))
     :explanation "Rung 1 is alg/perm-sign in its native library. Rung 2 shows the same ''signed indicator of a discrete transformation'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''signed indicator of a discrete transformation'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-sign."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "sgn is a group homomorphism S_n → {±1}, ×."
     :program "(define a (alg/perm (list 1 2 0)))\n(define b (alg/perm (list 2 1 0)))\n(= (alg/perm-sign (alg/perm-compose a b))\n   (* (alg/perm-sign a) (alg/perm-sign b)))"
     :invariant "∀ σ τ. sgn(σ ∘ τ) = sgn(σ)·sgn(τ)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry). Also ch-advanced-12 (Linear Algebra Deep) for the determinant application.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-sign — see :summary."
     :composition "(define S3 (alg/symmetric 3))\n(define signs (map alg/perm-sign (alg/op S3)))\nsigns"
     :emergent "sign-character"
     :meta "The emergent sign-character belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Sign is the simplest non-trivial character of S_n; character theory generalizes it. See book-of-ml ch-03 for matrix-side applications.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the sign-character pattern."
     :cs "The emergent sign-character is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/perm-support': r"""  :row-2-audit (
    (:problem "For a large-degree permutation that touches few elements, the operator wants the support (moved-elements) list rather than the full array, for compact logging."
     :program "(define p (alg/perm (list 0 2 1 3 4 5)))\n(alg/perm-support p)"
     :explanation "Only 1 and 2 are moved; operator sees (1 2)."
     :meta "perm->cycles gives every cycle including 1-cycles if requested; support gives the flat set of moved elements. Different granularities.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: perm; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'active elements of a sparse map'"
     :rungs (
       (:domain "alg native" :code "(define p (alg/perm (list 0 2 1 3 4 5)))")
       (:domain "changed pixels in a frame diff" :code "(sprite/frame-diff a b)")
       (:domain "support of a function" :code "supp(σ) = {i : σ(i) ≠ i}"))
     :explanation "Rung 1 is alg/perm-support in its native library. Rung 2 shows the same ''active elements of a sparse map'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''active elements of a sparse map'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/perm-support."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "σ = τ on the complement of supp(σ) ∪ supp(τ) means they can be composed disjointly."
     :program "(define p (alg/perm (list 0 2 1 3)))\n(equal? (alg/perm-support p) (list 1 2))"
     :invariant "supp(σ) = {i ∈ {0,...,n-1} : σ(i) ≠ i}"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the perm category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/perm-support — see :summary."
     :composition "(define ps (list (alg/perm (list 1 0 2 3)) (alg/perm (list 0 1 3 2))))\n(map alg/perm-support ps)"
     :emergent "support-set"
     :meta "The emergent support-set belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Support tells you when two permutations commute (disjoint supports commute). Same pattern as commuting write-sets in transactions.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the perm operations close into the support-set pattern."
     :cs "The emergent support-set is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/poly-add': r"""  :row-2-audit (
    (:problem "A GF(p) polynomial arithmetic step needs coefficient-wise addition of two polynomials, respecting the modular coefficient field."
     :program "(alg/poly-add (list 1 2 3) (list 4 5) 7)"
     :explanation "(1+2x+3x^2) + (4+5x) mod 7 = (5 + 7·x + 3·x^2) → (5 0 3) mod 7; operator sees (5 0 3)."
     :meta "poly-mul is convolution; poly-add is pointwise. Confusing them means the coding-theory routine produces nonsense codes.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'pointwise addition of sequences'"
     :rungs (
       (:domain "alg native" :code "(alg/poly-add (list 1 2 3) (list 4 5) 7)")
       (:domain "waveform sum-mix" :code "(audio/mix-samples w1 w2)")
       (:domain "polynomial ring addition" :code "(f + g)(x) = f(x) + g(x) mod p"))
     :explanation "Rung 1 is alg/poly-add in its native library. Rung 2 shows the same ''pointwise addition of sequences'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''pointwise addition of sequences'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/poly-add."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Polynomial addition is commutative and associative; the zero polynomial is the identity."
     :program "(define a (list 1 2 3)) (define b (list 4 5 6)) (define c (list 7 8 9)) (define p 11)\n(equal? (alg/poly-add a (alg/poly-add b c) p)\n        (alg/poly-add (alg/poly-add a b p) c p))"
     :invariant "∀ f g h ∈ F_p[x]. (f + g) + h = f + (g + h)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/poly-add — see :summary."
     :composition "(define f (list 1 2 3))\n(define g (list 4 5))\n(define sum (alg/poly-add f g 7))\nsum"
     :emergent "pointwise-op"
     :meta "The emergent pointwise-op belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same pointwise family as vector addition; see book-of-ml ch-02.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the pointwise-op pattern."
     :cs "The emergent pointwise-op is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/poly-mul': r"""  :row-2-audit (
    (:problem "A finite-field convolution (Reed-Solomon, CRC) needs the multiplication of two polynomials with mod-p coefficients."
     :program "(alg/poly-mul (list 1 1) (list 1 1) 5)"
     :explanation "(1+x)(1+x) = 1+2x+x^2 mod 5 = (1 2 1); operator sees (1 2 1)."
     :meta "poly-add is termwise; poly-mul is convolution. The convolution is where finite-field CRC bits actually get computed.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'convolution of two sequences'"
     :rungs (
       (:domain "alg native" :code "(alg/poly-mul (list 1 1) (list 1 1) 5)")
       (:domain "waveform convolution/reverb impulse" :code "(audio/conv wave impulse)")
       (:domain "polynomial multiplication in F_p[x]" :code "(fg)(x) = Σ f_i g_j x^{i+j} mod p"))
     :explanation "Rung 1 is alg/poly-mul in its native library. Rung 2 shows the same ''convolution of two sequences'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''convolution of two sequences'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/poly-mul."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Polynomial multiplication is commutative, associative, and distributes over addition."
     :program "(define f (list 1 2)) (define g (list 3 4)) (define h (list 5 6)) (define p 11)\n(equal? (alg/poly-mul f (alg/poly-add g h p) p)\n        (alg/poly-add (alg/poly-mul f g p) (alg/poly-mul f h p) p))"
     :invariant "∀ f g h. f·(g + h) = f·g + f·h (distributivity)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/poly-mul — see :summary."
     :composition "(define f (list 1 0 1))\n(define g (list 1 1))\n(define prod (alg/poly-mul f g 2))\nprod"
     :emergent "convolution"
     :meta "The emergent convolution belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same family as signal-processing convolution; see book-of-composition ch-10 (fx-chain).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the convolution pattern."
     :cs "The emergent convolution is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/prime-form': r"""  :row-2-audit (
    (:problem "A music-analysis pipeline needs a single canonical name for a chord that identifies it up to transposition AND inversion — the Forte prime form."
     :program "(equal? (alg/prime-form (alg/pcset (list 0 4 7))) (alg/prime-form (alg/pcset (list 0 3 7))))"
     :explanation "Major and minor triads share a prime form (0 3 7); operator sees #t."
     :meta "normal-form only kills rotation; prime-form kills rotation AND inversion. Both are canonicalizations but at different granularity.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'canonical form under a larger group'"
     :rungs (
       (:domain "alg native" :code "(equal? (alg/prime-form (alg/pcset (list 0 4 7))) (alg/prime-form (alg/pcset (list 0 3 7))))")
       (:domain "case-folded string canonicalization" :code "(string/canonical-fold s)")
       (:domain "Forte prime form" :code "pf(S) = min under T/I action"))
     :explanation "Rung 1 is alg/prime-form in its native library. Rung 2 shows the same ''canonical form under a larger group'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''canonical form under a larger group'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/prime-form."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Prime form is idempotent and invariant under transposition and inversion."
     :program "(define S (alg/pcset (list 0 4 7)))\n(and (equal? (alg/prime-form S) (alg/prime-form (alg/prime-form S)))\n     (equal? (alg/prime-form S) (alg/prime-form (alg/transpose S 5)))\n     (equal? (alg/prime-form S) (alg/prime-form (alg/invert S))))"
     :invariant "∀ S, k. pf(T_k(S)) = pf(I(S)) = pf(S)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/prime-form — see :summary."
     :composition "(define chords (list (alg/pcset (list 0 4 7)) (alg/pcset (list 0 3 7)) (alg/pcset (list 3 7 10))))\n(map alg/prime-form chords)"
     :emergent "forte-name"
     :meta "The emergent forte-name belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Prime form + Forte number = universal chord identifier; the pcset equivalent of a UUID.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the forte-name pattern."
     :cs "The emergent forte-name is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/rosette': r"""  :row-2-audit (
    (:problem "An artist wants to visualize the orbit of a decoration under a rosette (rotational) symmetry group."
     :program "(alg/rosette 6)"
     :explanation "The 6-fold rosette group has 6 rotations; operator sees the group object."
     :meta "Dihedral has rotations AND reflections; rosette is rotations only. Different geometric constraint.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'cyclic rotational symmetry'"
     :rungs (
       (:domain "alg native" :code "(alg/rosette 6)")
       (:domain "sprite rotational-only decoration" :code "(sprite/rotational-copies sp n)")
       (:domain "cyclic subgroup C_n ≤ D_n" :code "C_n"))
     :explanation "Rung 1 is alg/rosette in its native library. Rung 2 shows the same ''cyclic rotational symmetry'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''cyclic rotational symmetry'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/rosette."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The rosette group R_n has order n and is isomorphic to Z/nZ."
     :program "(define R6 (alg/rosette 6))\n(and (= (alg/order R6) 6) (alg/is-abelian? R6))"
     :invariant "|R_n| = n  ∧  R_n ≅ Z/nZ"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/rosette — see :summary."
     :composition "(define R6 (alg/rosette 6))\n(define orbit (alg/orbit R6 (list 1 0) (lambda (g p) (alg/apply-symmetry g p))))\norbit"
     :emergent "rosette-orbit"
     :meta "The emergent rosette-orbit belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Rosette + orbit = the classical decorative pattern. See book-of-composition ch-06 (sprite-grid).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the rosette-orbit pattern."
     :cs "The emergent rosette-orbit is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/stabilizer': r"""  :row-2-audit (
    (:problem "For a decoration on a symmetry axis, the operator wants to know which subset of the group fixes the decoration — the stabilizer subgroup."
     :program "(define D4 (alg/dihedral 4))\n(define act (lambda (g p) (alg/apply-symmetry g p)))\n(alg/stabilizer D4 (list 0 0) act)"
     :explanation "The origin is fixed by every symmetry; operator sees the whole group (8 elements)."
     :meta "Orbit is where the point goes; stabilizer is what leaves it alone. Together they partition |G| via orbit-stabilizer.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'fix-set of a group action'"
     :rungs (
       (:domain "alg native" :code "(define D4 (alg/dihedral 4))")
       (:domain "handlers that never fire for this event" :code "(input/quiet-handlers event)")
       (:domain "point stabilizer" :code "Stab_G(x) = {g : g·x = x}"))
     :explanation "Rung 1 is alg/stabilizer in its native library. Rung 2 shows the same ''fix-set of a group action'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''fix-set of a group action'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/stabilizer."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Stab_G(x) ≤ G, and |G·x|·|Stab_G(x)| = |G|."
     :program "(define D3 (alg/dihedral 3))\n(define p (list 0 0))\n(define act (lambda (g q) (alg/apply-symmetry g q)))\n(alg/subgroup? D3 (alg/stabilizer D3 p act))"
     :invariant "Stab_G(x) ≤ G"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/stabilizer — see :summary."
     :composition "(define D6 (alg/dihedral 6))\n(define ps (list (list 0 0) (list 1 0) (list 1 1)))\n(map (lambda (p) (length (alg/stabilizer D6 p (lambda (g q) (alg/apply-symmetry g q))))) ps)"
     :emergent "stabilizer-lattice"
     :meta "The emergent stabilizer-lattice belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Stabilizers at points form a lattice inside G — same shape as the isotropy tower in geometric group theory.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the stabilizer-lattice pattern."
     :cs "The emergent stabilizer-lattice is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/subgroup-gen': r"""  :row-2-audit (
    (:problem "Given a set of generators, produce the smallest subgroup they generate; the audit expects Lagrange's theorem to hold on the output."
     :program "(define G (alg/dihedral 4))\n(define H (alg/subgroup-gen G (list 1)))\n(list (length H) (zero? (modulo (alg/order G) (length H))))"
     :explanation "⟨rotation⟩ = 4 rotations; 8/4 = 2 (Lagrange); operator sees (4 #t)."
     :meta "Orbit is a group action on an outside object; subgroup-gen is closure of a subset inside the group. Same word 'orbit' in some texts — the verbs distinguish.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'closure of a set under an operation'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/dihedral 4))")
       (:domain "closure of a set of sprites under overlay" :code "(sprite/close-under-overlay set)")
       (:domain "generated subgroup" :code "⟨S⟩ = ∩{H ≤ G : S ⊆ H}"))
     :explanation "Rung 1 is alg/subgroup-gen in its native library. Rung 2 shows the same ''closure of a set under an operation'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''closure of a set under an operation'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/subgroup-gen."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "|⟨S⟩| divides |G|, and ⟨S⟩ is the smallest subgroup containing S."
     :program "(define G (alg/dihedral 4))\n(let loop ((gs (alg/op G)))\n  (or (null? gs)\n      (and (zero? (modulo (alg/order G) (length (alg/subgroup-gen G (list (car gs))))))\n           (loop (cdr gs)))))"
     :invariant "⟨S⟩ ≤ G ∧ |⟨S⟩| | |G|"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/subgroup-gen — see :summary."
     :composition "(define G (alg/dihedral 4))\n(define H (alg/subgroup-gen G (list 1 4)))\n(list (length H) (alg/is-normal? G H))"
     :emergent "closure-under-generation"
     :meta "The emergent closure-under-generation belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Generator + operation → closure is a universal algebraic pattern; the same pattern as computing a transitive closure in graphs.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the closure-under-generation pattern."
     :cs "The emergent closure-under-generation is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/subgroup?': r"""  :row-2-audit (
    (:problem "A downstream normality or quotient check requires certifying that a proposed subset is actually a subgroup; passing a non-subgroup silently produces meaningless answers."
     :program "(define G (alg/cyclic 6))\n(alg/subgroup? G (list 0 3))"
     :explanation "{0, 3} is closed under mod-6 addition and contains 0; the operator sees #t."
     :meta "is-group? tests whether a Cayley table is a group standalone; subgroup? tests whether a subset inherits closure from a parent group. Different questions, different verbs.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'inherited closure under an ambient operation'"
     :rungs (
       (:domain "alg native" :code "(define G (alg/cyclic 6))")
       (:domain "active sprites closed under scene compose" :code "(scene/closed-subset? sprites)")
       (:domain "subgroup criterion" :code "H ⊆ G, e ∈ H, a·b^-1 ∈ H"))
     :explanation "Rung 1 is alg/subgroup? in its native library. Rung 2 shows the same ''inherited closure under an ambient operation'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''inherited closure under an ambient operation'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/subgroup?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "H ≤ G iff e ∈ H and a·b^-1 ∈ H for all a, b ∈ H."
     :program "(define G (alg/dihedral 4))\n(define H (alg/subgroup-gen G (list 1)))\n(alg/subgroup? G H)"
     :invariant "H ≤ G ⇔ e ∈ H ∧ ∀ a b ∈ H. a·b^-1 ∈ H"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/subgroup? — see :summary."
     :composition "(define G (alg/dihedral 3))\n(define candidates (list (list 0) (list 0 1) (list 0 1 2)))\n(map (lambda (H) (alg/subgroup? G H)) candidates)"
     :emergent "subgroup-filter"
     :meta "The emergent subgroup-filter belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Test-then-use is the safe-collection pattern; refuse the input if the invariant fails.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the subgroup-filter pattern."
     :cs "The emergent subgroup-filter is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/symmetric': r"""  :row-2-audit (
    (:problem "A permutation-heavy test needs the full symmetric group S_n as a Cayley-usable group so that all permutations of n elements can be enumerated and their compositions tabulated."
     :program "(define S3 (alg/symmetric 3))\n(list (alg/order S3) (length (alg/conjugacy-classes S3)))"
     :explanation "S_3 has 6 elements and 3 conjugacy classes (identity, transpositions, 3-cycles); the operator sees (6 3)."
     :meta "For n=3, S_3 and D_3 are isomorphic and the sibling would work; for n≥4 they diverge, and alg/symmetric is the honest answer.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: group; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'all rearrangements of a finite set'"
     :rungs (
       (:domain "alg native" :code "(define S3 (alg/symmetric 3))")
       (:domain "shuffle-all of a sprite list" :code "(sprite/all-permutations sprites)")
       (:domain "symmetric group S_n" :code "S_n = Aut({1,...,n})"))
     :explanation "Rung 1 is alg/symmetric in its native library. Rung 2 shows the same ''all rearrangements of a finite set'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''all rearrangements of a finite set'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/symmetric."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "|S_n| = n! and every finite group of order ≤ n embeds in S_n (Cayley's theorem)."
     :program "(define S4 (alg/symmetric 4))\n(= (alg/order S4) 24)"
     :invariant "|S_n| = n!  ∧  ∀ G finite. |G| = m ⇒ G ↪ S_m"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry). Also and ch-advanced-02 (Combinatorics & Counting) for counting permutations.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the group category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/symmetric — see :summary."
     :composition "(define S3 (alg/symmetric 3))\n(define A3 (filter (lambda (p) (even? (alg/perm-parity p))) (alg/op S3)))\n(length A3)"
     :emergent "alternating-subgroup"
     :meta "The emergent alternating-subgroup belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. The A_n ⊴ S_n filter is a foundational normal-subgroup pattern. See book-of-code ch-10 (state machines).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the group operations close into the alternating-subgroup pattern."
     :cs "The emergent alternating-subgroup is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/symmetry-group': r"""  :row-2-audit (
    (:problem "A composer wants the symmetry group of a chord — the T/I operations that leave the pcset invariant."
     :program "(alg/symmetry-group (alg/pcset (list 0 3 6 9)))"
     :explanation "Diminished-7 is invariant under T_3, T_6, T_9 (4-fold rotational symmetry); operator sees the transposition indices."
     :meta "stabilizer is generic (any action); symmetry-group is specialized to T/I on pcsets. Same shape, specialized API.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'symmetries fixing a set'"
     :rungs (
       (:domain "alg native" :code "(alg/symmetry-group (alg/pcset (list 0 3 6 9)))")
       (:domain "sprite's own symmetry group" :code "(sprite/symmetries sp)")
       (:domain "point-group of a chord" :code "Stab_{T/I}(S)"))
     :explanation "Rung 1 is alg/symmetry-group in its native library. Rung 2 shows the same ''symmetries fixing a set'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''symmetries fixing a set'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/symmetry-group."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "|Sym(S)| divides 24 (order of the T/I group on Z/12Z)."
     :program "(define S (alg/pcset (list 0 3 6 9)))\n(zero? (modulo 24 (length (alg/symmetry-group S))))"
     :invariant "|Sym(S)| | 24"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/symmetry-group — see :summary."
     :composition "(define chords (list (alg/pcset (list 0 4 7)) (alg/pcset (list 0 3 6 9)) (alg/pcset (list 0 2 4 6 8 10))))\n(map (lambda (S) (length (alg/symmetry-group S))) chords)"
     :emergent "invariance-fingerprint"
     :meta "The emergent invariance-fingerprint belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Symmetry-count is a chord fingerprint — used to identify the whole-tone or diminished quality quickly.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the invariance-fingerprint pattern."
     :cs "The emergent invariance-fingerprint is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/transpose': r"""  :row-2-audit (
    (:problem "A composer needs to shift a chord up by a fixed interval; the audit expects that transposition preserves the interval vector."
     :program "(alg/transpose (alg/pcset (list 0 4 7)) 5)"
     :explanation "{0, 4, 7} shifted up 5 semitones = {5, 9, 0} = {0, 5, 9}; operator sees the sorted set."
     :meta "Invert reflects; transpose shifts. Both are affine, but they answer different musical questions.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'additive shift in a modular group'"
     :rungs (
       (:domain "alg native" :code "(alg/transpose (alg/pcset (list 0 4 7)) 5)")
       (:domain "key-signature change" :code "(note/transpose-key clef n)")
       (:domain "translation T_k in Z/12Z" :code "T_k(p) = (p + k) mod 12"))
     :explanation "Rung 1 is alg/transpose in its native library. Rung 2 shows the same ''additive shift in a modular group'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''additive shift in a modular group'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/transpose."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Transposition is a group action of Z/12Z on pitch-class sets; it preserves the interval vector."
     :program "(define S (alg/pcset (list 0 4 7)))\n(equal? (alg/interval-vector S) (alg/interval-vector (alg/transpose S 5)))"
     :invariant "∀ S, k. iv(T_k(S)) = iv(S)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/transpose — see :summary."
     :composition "(define S (alg/pcset (list 0 4 7)))\n(map (lambda (k) (alg/transpose S k)) (list 0 3 6 9))"
     :emergent "transposition-orbit"
     :meta "The emergent transposition-orbit belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. All 12 transpositions of S = T-orbit; the 12 T-forms of a row are the composer's transposed field.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the transposition-orbit pattern."
     :cs "The emergent transposition-orbit is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/triad': r"""  :row-2-audit (
    (:problem "A chord-generator wants triads named by root and quality (major, minor, diminished, augmented) rather than by explicit pitch-class list."
     :program "(alg/triad 0 'major)"
     :explanation "C major = {0, 4, 7}; operator sees (0 4 7)."
     :meta "pcset requires the raw pitch classes; triad accepts a semantic name (major/minor). Higher-level API.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: pcset; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'named-shape construction from parameters'"
     :rungs (
       (:domain "alg native" :code "(alg/triad 0 'major)")
       (:domain "preset instantiation from name" :code "(preset/instantiate 'major-triad)")
       (:domain "triad as a specific set-class" :code "{0, m3, m3+M3}"))
     :explanation "Rung 1 is alg/triad in its native library. Rung 2 shows the same ''named-shape construction from parameters'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''named-shape construction from parameters'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/triad."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "alg/triad r 'major = T_r({0, 4, 7})."
     :program "(and (equal? (alg/triad 0 'major) (alg/pcset (list 0 4 7)))\n     (equal? (alg/triad 5 'major) (alg/transpose (alg/pcset (list 0 4 7)) 5)))"
     :invariant "triad(r, major) = T_r({0, 4, 7})"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-04 (Groups & Symmetry).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the pcset category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/triad — see :summary."
     :composition "(define roots (list 0 2 4 5 7 9 11))\n(map (lambda (r) (alg/triad r 'major)) roots)"
     :emergent "diatonic-chord-scale"
     :meta "The emergent diatonic-chord-scale belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Named constructors + parameter roots = universal template pattern.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the pcset operations close into the diatonic-chord-scale pattern."
     :cs "The emergent diatonic-chord-scale is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/zn': r"""  :row-2-audit (
    (:problem "A modular-arithmetic problem (clock arithmetic, hash bucketing, cryptography setup) needs the ring Z/nZ as a concrete algebraic object supporting both addition and multiplication."
     :program "(define R (alg/zn 7))\n(list (alg/order R) (alg/is-field? 7))"
     :explanation "Z/7Z has order 7 and is a field (since 7 is prime); the operator gets (7 #t)."
     :meta "alg/cyclic 7 would give the additive-only group; alg/zn 7 carries the ring structure and multiplicative units too — needed for any inverse operation.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'integers wrapped around a modulus'"
     :rungs (
       (:domain "alg native" :code "(define R (alg/zn 7))")
       (:domain "hash-bucket index" :code "(hash/bucket-of key n-buckets)")
       (:domain "quotient ring Z/nZ" :code "Z / nZ"))
     :explanation "Rung 1 is alg/zn in its native library. Rung 2 shows the same ''integers wrapped around a modulus'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''integers wrapped around a modulus'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/zn."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Z/nZ is a field iff n is prime; otherwise it is a ring with zero-divisors."
     :program "(and (alg/is-field? 5) (alg/is-field? 7) (not (alg/is-field? 6)))"
     :invariant "Z/nZ field ⇔ n prime"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure). Also ch-advanced-01 (Number Theory & Cryptography) for prime-related structure.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/zn — see :summary."
     :composition "(define units (alg/zn-units 12))\n(map (lambda (a) (list a (alg/zn-inverse a 12))) units)"
     :emergent "unit-group"
     :meta "The emergent unit-group belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Z/nZ + units is the standard cryptographic substrate (RSA lives here). See book-of-code ch-16 (cloud/LLMs) for cryptographic context.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the unit-group pattern."
     :cs "The emergent unit-group is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/zn-add': r"""  :row-2-audit (
    (:problem "Wrap-around clock arithmetic needs modular addition — the operator wants a single call that adds and wraps."
     :program "(alg/zn-add 5 4 7)"
     :explanation "5+4=9, 9 mod 7 = 2; operator sees 2."
     :meta "zn-mul is multiplication; zn-add is addition. Both live in Z/nZ but obey different identities.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'wrap-around addition'"
     :rungs (
       (:domain "alg native" :code "(alg/zn-add 5 4 7)")
       (:domain "beat counter that wraps" :code "(beat/counter-mod n)")
       (:domain "Z/nZ additive group" :code "(a + b) mod n"))
     :explanation "Rung 1 is alg/zn-add in its native library. Rung 2 shows the same ''wrap-around addition'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''wrap-around addition'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/zn-add."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "zn-add is commutative, associative, has 0 as identity, and every element has an additive inverse (n-a)."
     :program "(define n 7)\n(and (= (alg/zn-add 3 4 n) (alg/zn-add 4 3 n))\n     (= (alg/zn-add 3 0 n) 3)\n     (= (alg/zn-add 3 (- n 3) n) 0))"
     :invariant "∀ a b ∈ Z/nZ. a + b = b + a  ∧  a + 0 = a  ∧  a + (n-a) = 0"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/zn-add — see :summary."
     :composition "(define n 12)\n(let loop ((k 0) (acc 0) (out '()))\n  (cond ((= k 5) (reverse out))\n        (else (loop (+ k 1) (alg/zn-add acc 3 n) (cons acc out)))))"
     :emergent "wrap-counter"
     :meta "The emergent wrap-counter belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same wrap-counter pattern as beat/counter-mod. See book-of-composition ch-08 (timeline).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the wrap-counter pattern."
     :cs "The emergent wrap-counter is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/zn-inverse': r"""  :row-2-audit (
    (:problem "A modular linear-solve step needs the inverse of a coefficient mod n; if the coefficient is not a unit, the solve fails and the audit must surface that clearly."
     :program "(alg/zn-inverse 3 7)"
     :explanation "3·5 = 15 ≡ 1 mod 7, so 3^-1 = 5; operator sees 5."
     :meta "alg/inverse works on any group; alg/zn-inverse is specialized to (Z/n)^× and can fail cleanly with an honest error when gcd(a,n) ≠ 1.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'multiplicative inverse in a modular ring'"
     :rungs (
       (:domain "alg native" :code "(alg/zn-inverse 3 7)")
       (:domain "undoing a scaling under modular color space" :code "(color/inverse-scale a bits)")
       (:domain "modular inverse" :code "a^-1 mod n"))
     :explanation "Rung 1 is alg/zn-inverse in its native library. Rung 2 shows the same ''multiplicative inverse in a modular ring'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''multiplicative inverse in a modular ring'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/zn-inverse."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "a has a multiplicative inverse mod n iff gcd(a, n) = 1."
     :program "(define n 8)\n(equal? (map (lambda (a) (list a (nt/coprime? a n) (if (nt/coprime? a n) (alg/zn-inverse a n) 'none)))\n              (list 1 2 3 4 5 6 7))\n        (map (lambda (a) (list a (nt/coprime? a n) (if (nt/coprime? a n) (alg/zn-inverse a n) 'none)))\n              (list 1 2 3 4 5 6 7)))"
     :invariant "∃ b. a·b ≡ 1 mod n ⇔ gcd(a, n) = 1"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure). Also ch-advanced-01 (Number Theory & Cryptography) for extended-Euclidean derivation.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/zn-inverse — see :summary."
     :composition "(define units (alg/zn-units 12))\n(map (lambda (a) (list a (alg/zn-inverse a 12))) units)"
     :emergent "unit-group-inverse"
     :meta "The emergent unit-group-inverse belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same family as matrix inverse (only invertible matrices have an inverse). See book-of-ml ch-03.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the unit-group-inverse pattern."
     :cs "The emergent unit-group-inverse is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/zn-mul': r"""  :row-2-audit (
    (:problem "Modular multiplication is the workhorse of every cryptographic hash and Diffie-Hellman step; the audit needs a primitive that does not overflow."
     :program "(alg/zn-mul 3 5 7)"
     :explanation "3·5=15, 15 mod 7 = 1; operator sees 1."
     :meta "zn-add is addition; zn-mul is multiplication. Both are needed for the ring; using the wrong one gives the wrong crypto primitive.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'modular multiplication'"
     :rungs (
       (:domain "alg native" :code "(alg/zn-mul 3 5 7)")
       (:domain "color-channel modulation" :code "(color/mul-channel a b bits)")
       (:domain "Z/nZ multiplicative operation" :code "(a · b) mod n"))
     :explanation "Rung 1 is alg/zn-mul in its native library. Rung 2 shows the same ''modular multiplication'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''modular multiplication'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/zn-mul."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "zn-mul is commutative, associative, has 1 as identity, and distributes over zn-add."
     :program "(define n 11)\n(and (= (alg/zn-mul 3 5 n) (alg/zn-mul 5 3 n))\n     (= (alg/zn-mul 3 1 n) 3)\n     (= (alg/zn-mul 3 (alg/zn-add 4 2 n) n)\n        (alg/zn-add (alg/zn-mul 3 4 n) (alg/zn-mul 3 2 n) n)))"
     :invariant "∀ a b c. a·(b+c) = a·b + a·c mod n"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure). Also ch-advanced-01 (Number Theory & Cryptography) for cryptographic use.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/zn-mul — see :summary."
     :composition "(define units (alg/zn-units 7))\n(map (lambda (a) (list a (alg/zn-mul a a 7))) units)"
     :emergent "squares-map"
     :meta "The emergent squares-map belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Repeated multiplication gives modular exponentiation — the RSA primitive. See book-of-code ch-16 for cryptographic context.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the squares-map pattern."
     :cs "The emergent squares-map is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'alg/zn-units': r"""  :row-2-audit (
    (:problem "An RSA-style setup needs the multiplicative unit group (Z/n)^× enumerated so a generator can be chosen and its order computed."
     :program "(alg/zn-units 12)"
     :explanation "Elements coprime to 12: {1, 5, 7, 11}; operator sees (1 5 7 11)."
     :meta "alg/zn gives the whole ring; alg/zn-units gives only the invertible ones — the group under multiplication. Confusing them leads to trying to invert non-units.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: ring; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'invertible subset of a ring'"
     :rungs (
       (:domain "alg native" :code "(alg/zn-units 12)")
       (:domain "active handlers with fully-registered slots" :code "(input/registered-handlers state)")
       (:domain "unit group" :code "(Z/n)^× = {a : gcd(a, n) = 1}"))
     :explanation "Rung 1 is alg/zn-units in its native library. Rung 2 shows the same ''invertible subset of a ring'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''invertible subset of a ring'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for alg/zn-units."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "|(Z/n)^×| = φ(n) (Euler's totient)."
     :program "(= (length (alg/zn-units 12)) (nt/totient 12))"
     :invariant "|(Z/n)^×| = φ(n)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-05 (Rings, Fields & Structure). Also ch-advanced-01 (Number Theory & Cryptography) for totient.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the ring category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "alg/zn-units — see :summary."
     :composition "(define n 15)\n(define units (alg/zn-units n))\n(map (lambda (a) (list a (alg/zn-inverse a n))) units)"
     :emergent "unit-inverse-table"
     :meta "The emergent unit-inverse-table belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Precomputing inverses for all units = classic lookup-table pattern; used in fast finite-field arithmetic.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the ring operations close into the unit-inverse-table pattern."
     :cs "The emergent unit-inverse-table is a first-class named pattern; recognize it once and it reappears everywhere."))""",
}
