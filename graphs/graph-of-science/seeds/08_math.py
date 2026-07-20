"""Mathematical objects, theorems, structures, and concepts. Target ~500 nodes.

Follows the Mathematics Subject Classification (MSC 2020) top-level organization
but names concepts by their canonical everyday names, not MSC codes.
"""

from _helpers import S, PERSON


def W(name):
    return [{"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"}]


def WD(qid, name=None):
    p = [{"source": "wikidata", "qid": qid}]
    if name:
        p.append({"source": "wikipedia", "url": f"https://en.wikipedia.org/wiki/{name}"})
    return p


def M(name, slug, kind, narr, subarea, everyday=None, extras=None,
      formula=None, described_by=None, described_year=None, related=None,
      wp=None, wd=None, status=None):
    prov = WD(wd, wp) if wd else W(wp or name.replace(" ", "_"))
    return S(name, "math", kind,
             id_slug=slug, extras=extras or [], narrative=narr, everyday=everyday,
             formula=formula, applies=[":theoretical-only"] if kind in ("axiom", "theorem", "conjecture") else None,
             described_by=described_by, described_year=described_year,
             subsumed_by=subarea,
             related=[(r, w) for r, w in (related or [])],
             status=status,
             provenance=prov)


SCIENCES = []

# ---- NUMBER TYPES ----
NUMBERS = [
    ("Natural Number", "natural-number", "The counting numbers 0, 1, 2, 3, ... (or 1, 2, 3, ... depending on convention).",
     ["N", "counting number", "whole number"], [("integer", 1.0)], "Natural_number", "Q21199"),
    ("Integer", "integer", "The whole numbers, positive, negative, and zero: ..., −2, −1, 0, 1, 2, ...",
     ["Z", "whole number"], [("rational-number", 1.0)], "Integer", "Q12503"),
    ("Rational Number", "rational-number", "A number expressible as a ratio p/q of integers with q ≠ 0.",
     ["Q", "fraction"], [("real-number", 1.0), ("integer", 1.0)], "Rational_number", "Q1244890"),
    ("Irrational Number", "irrational-number", "A real number that cannot be expressed as a ratio of integers — e.g. √2, π, e.",
     [], [("real-number", 1.0)], "Irrational_number", "Q41755"),
    ("Real Number", "real-number", "The complete ordered field including rationals and irrationals — every point on the number line.",
     ["R"], [("complex-number", 1.0)], "Real_number", "Q12916"),
    ("Complex Number", "complex-number", "A number of the form a + bi with i² = −1; the algebraic closure of the reals.",
     ["C"], [("real-number", 1.0)], "Complex_number", "Q11567"),
    ("Prime Number", "prime-number", "A natural number greater than 1 with no positive divisors other than 1 and itself.",
     ["prime"], [("integer", 0.95), ("fundamental-theorem-of-arithmetic", 0.95)], "Prime_number", "Q49008"),
    ("Composite Number", "composite-number", "A positive integer with a divisor other than 1 and itself — every integer > 1 is either prime or composite.",
     [], [("prime-number", 0.9)], "Composite_number", "Q207481"),
    ("Perfect Number", "perfect-number", "A positive integer equal to the sum of its proper divisors — 6, 28, 496, 8128, ...",
     [], [("mersenne-prime", 0.9)], "Perfect_number", "Q184754"),
    ("Mersenne Prime", "mersenne-prime", "A prime of the form 2ⁿ − 1; associated one-to-one with even perfect numbers.",
     [], [("prime-number", 0.9)], "Mersenne_prime", "Q638983"),
    ("Fibonacci Number", "fibonacci-number", "A term of the sequence 1, 1, 2, 3, 5, 8, 13, ... where each is the sum of the previous two.",
     [], [("golden-ratio", 0.9)], "Fibonacci_sequence", "Q47577"),
    ("Golden Ratio", "golden-ratio", "The irrational number φ = (1+√5)/2 ≈ 1.618; appears throughout art, architecture, and biology.",
     ["φ", "phi"], [("fibonacci-number", 0.9)], "Golden_ratio", "Q41576"),
    ("Pi", "pi-constant", "The ratio of a circle's circumference to its diameter, π ≈ 3.14159; irrational and transcendental.",
     ["π", "circle constant"], [("euler-identity", 0.9)], "Pi", "Q167"),
    ("Euler's Number", "euler-number-e", "The base of the natural logarithm, e ≈ 2.71828; the derivative of eˣ is eˣ.",
     ["e"], [("natural-logarithm", 0.95)], "E_(mathematical_constant)", "Q82435"),
    ("Imaginary Unit", "imaginary-unit", "The complex number i satisfying i² = −1.",
     ["i", "√−1"], [("complex-number", 1.0)], "Imaginary_unit", "Q193796"),
    ("Zero", "zero", "The additive identity — the number with the property x + 0 = x for all x.",
     ["0", "nought"], [("integer", 0.9)], "0", "Q204"),
    ("One", "one", "The multiplicative identity — the number with the property x·1 = x for all x.",
     ["1", "unity"], [("integer", 0.9)], "1", "Q199"),
    ("Infinity", "infinity", "The concept of a quantity without bound; formalized in different ways in different mathematical contexts.",
     ["∞"], [], "Infinity", "Q205"),
    ("Transcendental Number", "transcendental-number", "A real or complex number that is not a root of any non-zero polynomial with rational coefficients — e.g. π, e.",
     [], [("irrational-number", 1.0)], "Transcendental_number", "Q194192"),
    ("Algebraic Number", "algebraic-number", "A complex number that is a root of a non-zero polynomial with integer coefficients — e.g. √2 or i.",
     [], [("complex-number", 0.95)], "Algebraic_number", "Q191203"),
    ("Quaternion", "quaternion", "A number system extending the complex numbers to four dimensions, with three imaginary units i, j, k.",
     [], [("complex-number", 0.9)], "Quaternion", "Q189946"),
    ("P-adic Number", "p-adic-number", "A number system that extends the rationals in a way emphasizing divisibility by a fixed prime p.",
     [], [("rational-number", 0.7)], "P-adic_number", "Q319118"),
    ("Cardinal Number", "cardinal-number", "A number describing the size of a set — extends naturally to transfinite cardinals like ℵ₀ (aleph-nought).",
     [], [], "Cardinal_number", "Q1500023"),
    ("Ordinal Number", "ordinal-number", "A number describing the position in an ordering — extends to transfinite ordinals like ω.",
     [], [], "Ordinal_number", "Q191779"),
]
for row in NUMBERS:
    name, slug, narr, extras, rel, wp, wd = row
    SCIENCES.append(M(name, slug, "object", narr, "number-theory",
                     extras=extras, related=rel, wp=wp, wd=wd))

# ---- FAMOUS THEOREMS ----
THEOREMS = [
    ("Pythagorean Theorem", "pythagorean-theorem", "In a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides.",
     "a² + b² = c²", "pythagoras", None, "geometry", "Pythagorean_theorem", "Q11518", "The 3-4-5 triangle used in construction demonstrates this."),
    ("Fundamental Theorem of Arithmetic", "fundamental-theorem-of-arithmetic", "Every integer greater than 1 factors uniquely into primes.",
     None, "euclid", -300, "number-theory", "Fundamental_theorem_of_arithmetic", "Q193035", None),
    ("Fundamental Theorem of Algebra", "fundamental-theorem-of-algebra", "Every non-constant polynomial with complex coefficients has a complex root.",
     None, "gauss-carl", 1799, "algebra", "Fundamental_theorem_of_algebra", "Q192760", None),
    ("Fundamental Theorem of Calculus", "fundamental-theorem-of-calculus", "Differentiation and integration are inverse operations — the definite integral of f' equals f evaluated at the endpoints.",
     "∫[a,b] f'(x) dx = f(b) − f(a)", "newton-isaac", 1670, "calculus", "Fundamental_theorem_of_calculus", "Q207502", None),
    ("Euclid's Theorem", "euclids-theorem", "There are infinitely many prime numbers.",
     None, "euclid", -300, "number-theory", "Euclid%27s_theorem", "Q211110", None),
    ("Fermat's Last Theorem", "fermats-last-theorem", "No three positive integers a, b, c satisfy aⁿ + bⁿ = cⁿ for any integer n > 2. Proven by Wiles in 1994 after being open for 350 years.",
     "aⁿ + bⁿ ≠ cⁿ (n > 2)", "wiles-andrew", 1994, "number-theory", "Fermat%27s_Last_Theorem", "Q160639", None),
    ("Gödel's Incompleteness Theorems", "godels-incompleteness-theorems", "Any consistent formal system rich enough to encode arithmetic contains true statements that cannot be proven within the system.",
     None, "godel-kurt", 1931, "logic", "G%C3%B6del%27s_incompleteness_theorems", "Q193373", None),
    ("Central Limit Theorem", "central-limit-theorem", "The sum of many independent random variables tends toward a normal distribution regardless of their individual shapes.",
     None, "de-moivre-abraham", 1733, "statistics", "Central_limit_theorem", "Q192505", "Why so many measurements form a bell curve."),
    ("Bayes' Theorem", "bayes-theorem", "The probability of A given B equals the probability of B given A times the probability of A, divided by the probability of B.",
     "P(A|B) = P(B|A)·P(A) / P(B)", "bayes-thomas", 1763, "statistics", "Bayes%27_theorem", "Q131538", "How doctors update their belief that a test result indicates disease."),
    ("Law of Large Numbers", "law-of-large-numbers", "As the sample size grows, the sample mean converges to the true expected value.",
     None, "bernoulli-jacob", 1713, "statistics", "Law_of_large_numbers", "Q184073", "Why casinos always win over enough games."),
    ("Prime Number Theorem", "prime-number-theorem", "The number of primes less than n is approximately n / ln(n).",
     "π(n) ~ n / ln(n)", "hadamard-jacques", 1896, "number-theory", "Prime_number_theorem", "Q207431", None),
    ("Riemann Hypothesis", "riemann-hypothesis", "All non-trivial zeros of the Riemann zeta function lie on the critical line Re(s) = 1/2. Unproven; one of the seven Millennium Prize Problems.",
     None, "riemann-bernhard", 1859, "number-theory", "Riemann_hypothesis", "Q193712", None),
    ("Four Color Theorem", "four-color-theorem", "Any planar map can be colored with at most four colors so that no two adjacent regions share a color.",
     None, "appel-kenneth", 1976, "graph-theory", "Four_color_theorem", "Q188882", None),
    ("Pigeonhole Principle", "pigeonhole-principle", "If n items are put into m containers with n > m, then at least one container has more than one item.",
     None, "dirichlet-peter", 1834, "combinatorics", "Pigeonhole_principle", "Q191979", None),
    ("Cauchy-Schwarz Inequality", "cauchy-schwarz-inequality", "|⟨u,v⟩| ≤ ‖u‖·‖v‖ — a fundamental inequality in inner-product spaces.",
     "|⟨u,v⟩| ≤ ‖u‖·‖v‖", "cauchy-augustin", 1821, "linear-algebra", "Cauchy%E2%80%93Schwarz_inequality", "Q190109", None),
    ("Taylor's Theorem", "taylors-theorem", "A smooth function equals its Taylor series near a point up to a remainder that shrinks as more terms are added.",
     None, "taylor-brook", 1715, "calculus", "Taylor%27s_theorem", "Q188548", None),
    ("Chinese Remainder Theorem", "chinese-remainder-theorem", "A system of congruences with pairwise coprime moduli has a unique solution modulo the product.",
     None, None, 300, "number-theory", "Chinese_remainder_theorem", "Q193878", None),
    ("Euler's Formula", "eulers-formula", "e^(iθ) = cos θ + i sin θ — connects exponentials to trigonometry.",
     "e^(iθ) = cos θ + i sin θ", "euler-leonhard", 1748, "complex-analysis", "Euler%27s_formula", "Q193075", None),
    ("Euler's Identity", "euler-identity", "e^(iπ) + 1 = 0 — often called the most beautiful equation in mathematics.",
     "e^(iπ) + 1 = 0", "euler-leonhard", 1748, "complex-analysis", "Euler%27s_identity", "Q189093", None),
    ("Green's Theorem", "greens-theorem", "Relates a line integral around a simple closed curve to a double integral over the plane region it bounds.",
     None, "green-george", 1828, "vector-calculus", "Green%27s_theorem", "Q207115", None),
    ("Stokes' Theorem", "stokes-theorem", "A generalization of the fundamental theorem of calculus to higher dimensions — the integral of a form's exterior derivative over a manifold equals the integral of the form over its boundary.",
     None, "stokes-george", 1854, "vector-calculus", "Stokes%27_theorem", "Q192628", None),
    ("Divergence Theorem", "divergence-theorem", "Relates the flux of a vector field through a closed surface to the volume integral of its divergence.",
     None, "gauss-carl", 1813, "vector-calculus", "Divergence_theorem", "Q189562", None),
    ("Banach Fixed Point Theorem", "banach-fixed-point-theorem", "A contraction mapping on a complete metric space has a unique fixed point, found by iteration.",
     None, "banach-stefan", 1922, "analysis", "Banach_fixed-point_theorem", "Q217966", None),
    ("Cantor's Theorem", "cantors-theorem", "The power set of any set S has strictly greater cardinality than S — implies there are infinitely many sizes of infinity.",
     None, "cantor-georg", 1891, "set-theory", "Cantor%27s_theorem", "Q194117", None),
    ("Halting Problem", "halting-problem", "There is no general algorithm that decides whether a given program halts on a given input.",
     None, "turing-alan", 1936, "computability", "Halting_problem", "Q188739", None),
]
for row in THEOREMS:
    name, slug, narr, formula, disc_who, year, subarea, wp, wd, everyday = row
    SCIENCES.append(M(name, slug, "theorem", narr, subarea,
                     everyday=everyday, formula=formula,
                     described_by=[f"person-{disc_who}"] if disc_who else None,
                     described_year=year, wp=wp, wd=wd))

# ---- STRUCTURES + SPACES ----
STRUCTURES = [
    ("Set", "set", "A collection of distinct objects considered as an object in its own right.", "set-theory", ["collection"], "Set_(mathematics)", "Q36161"),
    ("Function", "function", "A relation that assigns each input exactly one output.", "analysis", ["map", "mapping"], "Function_(mathematics)", "Q11348"),
    ("Group", "group", "A set with an associative binary operation, an identity, and inverses — the algebraic structure of symmetry.", "abstract-algebra", [], "Group_(mathematics)", "Q83478"),
    ("Ring", "ring", "A set with two binary operations (addition and multiplication) satisfying certain axioms — generalizes the integers.", "abstract-algebra", [], "Ring_(mathematics)", "Q161172"),
    ("Field", "field", "A ring where every nonzero element has a multiplicative inverse — generalizes the rationals, reals, complex numbers.", "abstract-algebra", ["field of arithmetic"], "Field_(mathematics)", "Q190109"),
    ("Vector Space", "vector-space", "A set closed under vector addition and scalar multiplication satisfying the vector space axioms.", "linear-algebra", ["linear space"], "Vector_space", "Q125977"),
    ("Metric Space", "metric-space", "A set together with a distance function satisfying non-negativity, identity, symmetry, and triangle inequality.", "topology", [], "Metric_space", "Q180953"),
    ("Topological Space", "topological-space", "A set with a collection of open subsets satisfying axioms about union, intersection, and containing empty/whole.", "topology", [], "Topological_space", "Q179899"),
    ("Manifold", "manifold", "A space that locally resembles Euclidean space near each point — enables calculus on curved surfaces.", "differential-geometry", [], "Manifold", "Q1058"),
    ("Hilbert Space", "hilbert-space", "A complete inner-product space; the natural setting for quantum mechanics.", "functional-analysis", [], "Hilbert_space", "Q190056"),
    ("Banach Space", "banach-space", "A complete normed vector space.", "functional-analysis", [], "Banach_space", "Q194397"),
    ("Euclidean Space", "euclidean-space", "The space Rⁿ with the usual dot product and distance formula.", "geometry", [], "Euclidean_space", "Q1936640"),
    ("Riemannian Manifold", "riemannian-manifold", "A smooth manifold equipped with an inner product on each tangent space, allowing length, angle, and curvature to be defined.", "differential-geometry", [], "Riemannian_manifold", "Q1493767"),
    ("Lie Group", "lie-group", "A group that is also a smooth manifold, with continuous group operations — the mathematical framework for continuous symmetries.", "differential-geometry", [], "Lie_group", "Q288338"),
    ("Category", "category", "A collection of objects and morphisms between them, with composition satisfying identity and associativity — the object of study in category theory.", "category-theory", [], "Category_(mathematics)", "Q719395"),
    ("Graph", "graph", "A collection of vertices and edges — the fundamental object of graph theory.", "graph-theory", ["network"], "Graph_(discrete_mathematics)", "Q141488"),
    ("Tree", "tree-graph", "A connected acyclic graph — the fundamental data structure in computer science.", "graph-theory", ["tree structure"], "Tree_(graph_theory)", "Q192864"),
    ("Matrix", "matrix", "A rectangular array of numbers, representing linear maps between finite-dimensional vector spaces.", "linear-algebra", [], "Matrix_(mathematics)", "Q44337"),
    ("Vector", "vector", "An element of a vector space; often a directed magnitude in geometry.", "linear-algebra", [], "Vector_(mathematics_and_physics)", "Q9159"),
    ("Tensor", "tensor", "A generalization of vectors and matrices to arbitrary rank; central to differential geometry and modern physics.", "linear-algebra", [], "Tensor", "Q188524"),
    ("Polynomial", "polynomial", "An expression consisting of variables and coefficients under addition and multiplication.", "algebra", [], "Polynomial", "Q43260"),
    ("Series (infinite)", "infinite-series", "The sum of a sequence's terms; may converge to a finite value or diverge.", "analysis", ["sum of series"], "Series_(mathematics)", "Q170406"),
    ("Sequence", "sequence", "An ordered list of numbers, often indexed by natural numbers.", "analysis", [], "Sequence", "Q127700"),
    ("Limit", "limit", "The value a function or sequence approaches as its input approaches a given value.", "analysis", [], "Limit_(mathematics)", "Q186475"),
    ("Derivative", "derivative", "The instantaneous rate of change of a function with respect to its input.", "calculus", ["rate of change"], "Derivative", "Q11563"),
    ("Integral", "integral", "The 'area under the curve' — the accumulation of a function over an interval.", "calculus", ["antiderivative"], "Integral", "Q80091"),
    ("Differential Equation", "differential-equation", "An equation involving derivatives — models change in physics, biology, engineering.", "differential-equations", ["ODE", "PDE"], "Differential_equation", "Q11214"),
    ("Ordinary Differential Equation", "ordinary-differential-equation", "A differential equation involving derivatives with respect to one variable.", "differential-equations", ["ODE"], "Ordinary_differential_equation", "Q465274"),
    ("Partial Differential Equation", "partial-differential-equation", "A differential equation involving partial derivatives with respect to several variables.", "differential-equations", ["PDE"], "Partial_differential_equation", "Q188818"),
    ("Fourier Series", "fourier-series", "The decomposition of a periodic function into a sum of sines and cosines.", "analysis", [], "Fourier_series", "Q179467"),
    ("Fourier Transform", "fourier-transform", "The decomposition of a function into its frequency components.", "analysis", ["FT"], "Fourier_transform", "Q6520159"),
    ("Laplace Transform", "laplace-transform", "An integral transform converting a function of time into a function of complex frequency, useful for solving ODEs.", "analysis", [], "Laplace_transform", "Q211567"),
    ("Probability Distribution", "probability-distribution", "A function describing the likelihood of outcomes for a random variable.", "probability", [], "Probability_distribution", "Q200726"),
    ("Normal Distribution", "normal-distribution", "The bell-shaped continuous probability distribution; parameterized by mean and standard deviation.", "probability", ["Gaussian distribution", "bell curve"], "Normal_distribution", "Q133871"),
    ("Poisson Distribution", "poisson-distribution", "Discrete distribution for the number of events in a fixed interval when events happen at constant average rate.", "probability", [], "Poisson_distribution", "Q184113"),
    ("Binomial Distribution", "binomial-distribution", "Discrete distribution for the number of successes in n independent yes/no trials.", "probability", [], "Binomial_distribution", "Q207934"),
    ("Exponential Distribution", "exponential-distribution", "Continuous distribution for the waiting time between events in a Poisson process.", "probability", [], "Exponential_distribution", "Q208051"),
    ("Uniform Distribution", "uniform-distribution", "Distribution where every outcome in a range is equally likely.", "probability", [], "Uniform_distribution_(continuous)", "Q207436"),
    ("Random Variable", "random-variable", "A variable whose value is a numerical outcome of a random phenomenon.", "probability", [], "Random_variable", "Q191299"),
    ("Expected Value", "expected-value", "The long-run average value of a random variable; the sum of outcomes weighted by their probabilities.", "probability", ["mean", "expectation"], "Expected_value", "Q200125"),
    ("Variance", "variance", "The expected value of the squared deviation of a random variable from its mean; measures spread.", "probability", [], "Variance", "Q41697"),
    ("Standard Deviation", "standard-deviation", "The square root of variance; measures spread in the original units.", "probability", ["SD", "σ"], "Standard_deviation", "Q159375"),
    ("Correlation", "correlation", "Statistical measure of the linear relationship between two variables, from −1 to +1.", "statistics", ["Pearson correlation"], "Correlation", "Q29175"),
    ("Regression", "regression", "Statistical method for estimating relationships between a dependent variable and independent variables.", "statistics", ["linear regression"], "Regression_analysis", "Q208042"),
    ("Hypothesis Test", "hypothesis-test", "A statistical procedure for deciding between two hypotheses based on sample data.", "statistics", ["significance test"], "Statistical_hypothesis_testing", "Q214628"),
    ("P-value", "p-value", "The probability of observing data at least as extreme as the sample assuming the null hypothesis is true.", "statistics", [], "P-value", "Q265936"),
    ("Confidence Interval", "confidence-interval", "A range of values likely to contain a population parameter with a specified confidence level.", "statistics", ["CI"], "Confidence_interval", "Q186559"),
    ("Bayesian Inference", "bayesian-inference", "Statistical inference in which Bayes' theorem is used to update the probability of a hypothesis as evidence accumulates.", "statistics", [], "Bayesian_inference", "Q820096"),
    ("Markov Chain", "markov-chain", "A stochastic process where the future depends only on the present state, not the past.", "probability", [], "Markov_chain", "Q176645"),
    ("Random Walk", "random-walk", "A path formed by successive random steps; models diffusion, gambling, stock prices.", "probability", [], "Random_walk", "Q212108"),
]
for row in STRUCTURES:
    name, slug, narr, subarea, extras, wp, wd = row
    SCIENCES.append(M(name, slug, "space-math" if slug in ("metric-space", "topological-space", "manifold", "hilbert-space", "banach-space", "euclidean-space", "riemannian-manifold") else "object",
                     narr, subarea, extras=extras, wp=wp, wd=wd))

# ---- GEOMETRIC SHAPES ----
SHAPES = [
    ("Triangle", "triangle", "A polygon with three edges and three vertices.", ["3-gon", "trigon"]),
    ("Square", "square-shape", "A regular quadrilateral — four equal sides and four right angles.", ["4-gon regular"]),
    ("Rectangle", "rectangle", "A quadrilateral with four right angles.", []),
    ("Circle", "circle", "The set of all points in a plane at a fixed distance from a center point.", ["disk boundary"]),
    ("Ellipse", "ellipse", "The set of points where the sum of distances to two fixed foci is constant.", []),
    ("Parabola", "parabola", "The set of points equidistant from a point (focus) and a line (directrix).", []),
    ("Hyperbola", "hyperbola", "The set of points where the absolute difference of distances to two foci is constant.", []),
    ("Sphere", "sphere", "The set of points in 3D space at a fixed distance from a center point.", ["2-sphere"]),
    ("Cube", "cube", "A 3D solid with six square faces, twelve edges, and eight vertices.", ["hexahedron"]),
    ("Tetrahedron", "tetrahedron", "A 3D solid with four triangular faces — the simplest polyhedron.", ["triangular pyramid"]),
    ("Octahedron", "octahedron", "A 3D solid with eight triangular faces.", []),
    ("Dodecahedron", "dodecahedron", "A 3D solid with twelve pentagonal faces.", []),
    ("Icosahedron", "icosahedron", "A 3D solid with twenty triangular faces.", []),
    ("Cylinder", "cylinder", "A 3D solid with two parallel circular bases connected by a curved lateral surface.", []),
    ("Cone", "cone", "A 3D solid tapering smoothly from a circular base to a point (the apex).", []),
    ("Torus", "torus", "A donut-shaped surface generated by revolving a circle about an axis in its plane.", ["donut shape"]),
    ("Polygon", "polygon", "A closed plane figure bounded by straight sides.", []),
    ("Polyhedron", "polyhedron", "A 3D solid bounded by flat polygonal faces.", []),
    ("Fractal", "fractal", "A geometric object exhibiting self-similarity at different scales.", []),
    ("Mandelbrot Set", "mandelbrot-set", "The set of complex numbers c for which the iteration z ↦ z² + c stays bounded starting from z = 0.", []),
]
for name, slug, narr, extras in SHAPES:
    SCIENCES.append(M(name, slug, "object", narr, "geometry",
                     extras=extras, wp=name.replace(" ", "_")))

# ---- LOGIC + PROOFS ----
LOGIC = [
    ("Axiom", "axiom", "A statement taken as self-evidently true, from which other statements are derived.", ["postulate"]),
    ("Theorem", "theorem-general", "A statement proven from axioms and previously established theorems.", []),
    ("Lemma", "lemma", "A minor theorem proved as a stepping stone toward a larger result.", []),
    ("Corollary", "corollary", "A statement following almost immediately from a theorem.", []),
    ("Proof by Induction", "proof-by-induction", "A method for proving a statement true for all natural numbers by showing base case and inductive step.", ["mathematical induction"]),
    ("Proof by Contradiction", "proof-by-contradiction", "A method that assumes the negation of what is to be proved and derives a contradiction.", ["reductio ad absurdum"]),
    ("Proof by Contrapositive", "proof-by-contrapositive", "A method that proves 'if P then Q' by proving 'if not-Q then not-P' instead.", []),
    ("Direct Proof", "direct-proof", "A proof that proceeds by logical deduction from premises to conclusion.", []),
    ("Peano Axioms", "peano-axioms", "The five axioms characterizing the natural numbers, formulated by Peano in 1889.", []),
    ("Zermelo-Fraenkel Axioms", "zfc-axioms", "The standard axiomatization of set theory, augmented by the Axiom of Choice (ZFC).", ["ZFC"]),
    ("Axiom of Choice", "axiom-of-choice", "The set-theoretic axiom that for any collection of non-empty sets a choice function exists that picks one element from each.", ["AC"]),
    ("Boolean Algebra", "boolean-algebra", "The algebra of two-valued logic — the mathematical foundation of digital electronics.", []),
    ("Propositional Logic", "propositional-logic", "The branch of logic dealing with propositions and their combinations by connectives.", ["sentential logic"]),
    ("Predicate Logic", "predicate-logic", "The branch of logic that includes quantifiers over individuals — first-order logic.", ["first-order logic", "FOL"]),
    ("Turing Machine", "turing-machine", "An abstract computing machine that manipulates symbols on a tape; the theoretical foundation of computation.", []),
]
for name, slug, narr, extras in LOGIC:
    SCIENCES.append(M(name, slug, "principle" if slug in ("axiom-of-choice", "peano-axioms", "zfc-axioms") else "method",
                     narr, "logic", extras=extras, wp=name.replace(" ", "_")))

# ---- OPEN CONJECTURES ----
CONJECTURES = [
    ("Goldbach Conjecture", "goldbach-conjecture", "Every even integer greater than 2 can be written as the sum of two primes. Unproven since 1742.",
     "goldbach-christian", 1742, [], "Goldbach%27s_conjecture", "Q205405", ":contested"),
    ("Twin Prime Conjecture", "twin-prime-conjecture", "There are infinitely many pairs of primes differing by 2 (like 11 and 13, 17 and 19). Unproven.",
     None, None, [], "Twin_prime", "Q13188"),
    ("Collatz Conjecture", "collatz-conjecture", "Iterating 'if n is even, halve it; if odd, triple and add 1' always eventually reaches 1. Unproven for all n.",
     "collatz-lothar", 1937, ["3n+1 conjecture"], "Collatz_conjecture", "Q188931"),
    ("P vs NP Problem", "p-vs-np-problem", "Are all problems whose solutions can be verified in polynomial time also solvable in polynomial time? One of the seven Millennium Prize Problems.",
     "cook-stephen", 1971, ["P = NP", "P versus NP"], "P_versus_NP_problem", "Q188784"),
    ("Hodge Conjecture", "hodge-conjecture", "Statement about the structure of certain classes in the cohomology of complex algebraic varieties. Millennium Prize Problem.",
     "hodge-w-v-d", 1950, [], "Hodge_conjecture", "Q203411"),
    ("Yang-Mills Existence and Mass Gap", "yang-mills-mass-gap", "A rigorous mathematical formulation of Yang-Mills theory in 4D with a mass gap. Millennium Prize Problem.",
     None, 2000, [], "Yang%E2%80%93Mills_existence_and_mass_gap", "Q1128115"),
    ("Navier-Stokes Existence and Smoothness", "navier-stokes-existence", "Whether solutions to the Navier-Stokes equations always exist and are smooth in 3D. Millennium Prize Problem.",
     None, 2000, [], "Navier%E2%80%93Stokes_existence_and_smoothness", "Q210930"),
    ("Birch and Swinnerton-Dyer Conjecture", "bsd-conjecture", "Predicts the rank of an elliptic curve from the behavior of an associated L-function. Millennium Prize Problem.",
     "birch-bryan", 1965, ["BSD conjecture"], "Birch_and_Swinnerton-Dyer_conjecture", "Q213144"),
]
for row in CONJECTURES:
    if len(row) == 8:
        name, slug, narr, disc_who, year, extras, wp, wd = row
        status = ":emerging"
    else:
        name, slug, narr, disc_who, year, extras, wp, wd, status = row
    SCIENCES.append(M(name, slug, "conjecture", narr, "unsolved-problems",
                     extras=extras, described_by=[f"person-{disc_who}"] if disc_who else None,
                     described_year=year, status=status, wp=wp, wd=wd))

# ---- MATHEMATICS SUB-AREAS as parent nodes ----
SUBAREAS = [
    ("Algebra", "algebra", "The study of symbols and rules for manipulating them — from elementary to abstract algebra."),
    ("Abstract Algebra", "abstract-algebra", "The study of algebraic structures: groups, rings, fields, modules, vector spaces."),
    ("Linear Algebra", "linear-algebra", "The study of vectors, vector spaces, linear maps, and systems of linear equations."),
    ("Geometry", "geometry", "The study of shape, size, position, and properties of space."),
    ("Differential Geometry", "differential-geometry", "The application of calculus to geometry — curves, surfaces, manifolds."),
    ("Topology", "topology", "The study of properties preserved through continuous deformations — 'rubber-sheet geometry'."),
    ("Calculus", "calculus", "The mathematics of change and accumulation — differentiation and integration."),
    ("Analysis", "analysis", "The rigorous study of limits, continuity, differentiation, integration, and infinite series."),
    ("Real Analysis", "real-analysis", "Analysis of functions on the real line — sequences, series, continuity, differentiability, integrability."),
    ("Complex Analysis", "complex-analysis", "The calculus of complex-valued functions."),
    ("Functional Analysis", "functional-analysis", "The study of infinite-dimensional vector spaces and operators on them."),
    ("Number Theory", "number-theory", "The study of integers and their properties."),
    ("Combinatorics", "combinatorics", "The study of counting, arrangement, and combination of discrete objects."),
    ("Graph Theory", "graph-theory", "The study of graphs — mathematical structures modeling pairwise relations."),
    ("Probability", "probability", "The mathematical study of randomness and uncertainty."),
    ("Statistics", "statistics-math", "The mathematical framework for collecting, analyzing, and interpreting data."),
    ("Logic", "logic", "The formal study of valid reasoning."),
    ("Set Theory", "set-theory", "The mathematical study of collections of objects — the foundation of modern mathematics."),
    ("Category Theory", "category-theory", "The abstract framework of mathematical structures and their relationships via morphisms."),
    ("Differential Equations", "differential-equations", "The study of equations involving derivatives, modeling dynamical systems."),
    ("Vector Calculus", "vector-calculus", "The calculus of vector fields in 3D space — grad, div, curl."),
    ("Computability", "computability", "The study of what can and cannot be computed by algorithms."),
    ("Unsolved Problems", "unsolved-problems", "Famous open problems in mathematics — Millennium Prize Problems and other frontiers."),
]
for name, slug, narr in SUBAREAS:
    SCIENCES.append(S(name, "math", "classification",
                     id_slug=slug, narrative=narr,
                     subsumed_by="math",
                     provenance=W(name.replace(" ", "_"))))

# Add Mathematics as root
SCIENCES.append(S(
    "Mathematics", "math", "classification",
    id_slug="mathematics",
    extras=["math", "maths"],
    narrative="The abstract science of number, quantity, space, and structure; the language in which scientific laws are written.",
    provenance=W("Mathematics"),
))
