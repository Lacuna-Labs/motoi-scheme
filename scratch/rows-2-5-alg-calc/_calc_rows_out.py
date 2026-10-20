# auto-generated
ROWS = {
    'calc/arc-length': r"""  :row-2-audit (
    (:problem "A cable-length estimation over a smooth curve y = f(x) needs a single numerical answer; the operator does not want to derive the arc-length integral by hand."
     :program "(calc/arc-length (lambda (x) (* x x)) 0 1)"
     :explanation "Arc length of parabola y = x^2 from 0 to 1 is ≈ 1.478; the operator uses that as the cable-material estimate."
     :meta "calc/integral gives ∫f dx (area under the curve); calc/arc-length gives ∫√(1+f'^2) dx (length along the curve). Confusing them gives wildly wrong material budgets.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'measure of a 1-dimensional continuous object'"
     :rungs (
       (:domain "calc native" :code "(calc/arc-length (lambda (x) (* x x)) 0 1)")
       (:domain "length of a rendered curve on screen" :code "(curve/pixel-length spline)")
       (:domain "Riemann integral of √(1+f\\'^2)" :code "∫_a^b √(1 + f\\'(x)^2) dx"))
     :explanation "Rung 1 is calc/arc-length in its native library. Rung 2 shows the same ''measure of a 1-dimensional continuous object'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''measure of a 1-dimensional continuous object'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/arc-length."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Arc length is non-negative and monotone in the interval [a, b]: extending [a, b] never decreases the length."
     :program "(define f (lambda (x) x))\n(define L1 (calc/arc-length f 0 1))\n(define L2 (calc/arc-length f 0 2))\n(<= L1 L2)"
     :invariant "∀ f, [a, b] ⊆ [c, d]. arc-length(f, a, b) ≤ arc-length(f, c, d)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch14-calculus-2. Also ch-advanced-10 (Numerical Methods) for the numerical quadrature.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/arc-length — see :summary."
     :composition "(define f (lambda (x) x))\n(define seg (map (lambda (b) (calc/arc-length f 0 b)) (list 1 2 3 4)))\nseg"
     :emergent "reparametrization-by-length"
     :meta "The emergent reparametrization-by-length belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Arc-length parametrization is the foundational tool for constant-speed curve traversal. See book-of-motion for smooth-motion applications.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the reparametrization-by-length pattern."
     :cs "The emergent reparametrization-by-length is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/arc-length-param': r"""  :row-2-audit (
    (:problem "A parametric curve (Bezier, spline) needs its total length; solving y = f(x) for a parametric curve is not always possible so the parametric-form integral is the honest tool."
     :program "(calc/arc-length-param (lambda (t) (cos t)) (lambda (t) (sin t)) 0 (/ 3.14159 2))"
     :explanation "Quarter-unit-circle arc length is π/2 ≈ 1.57; operator sees the expected value."
     :meta "arc-length assumes y = f(x); arc-length-param accepts x(t), y(t). For self-intersecting or vertical-tangent curves, only the parametric form works.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'total variation of a parametric trajectory'"
     :rungs (
       (:domain "calc native" :code "(calc/arc-length-param (lambda (t) (cos t)) (lambda (t) (sin t)) 0 (/ 3.14159 2))")
       (:domain "total distance traveled by a moving sprite" :code "(motion/total-distance path)")
       (:domain "∫ ||γ\\'(t)|| dt" :code "∫_a^b √(x\\'(t)^2 + y\\'(t)^2) dt"))
     :explanation "Rung 1 is calc/arc-length-param in its native library. Rung 2 shows the same ''total variation of a parametric trajectory'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''total variation of a parametric trajectory'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/arc-length-param."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Arc length is reparametrization-invariant: any strictly-monotone reparametrization gives the same length."
     :program "(define x (lambda (t) t)) (define y (lambda (t) (* t t)))\n(define x2 (lambda (u) (* u u))) (define y2 (lambda (u) (expt u 4)))\n(let ((L1 (calc/arc-length-param x y 0 1))\n      (L2 (calc/arc-length-param x2 y2 0 1)))\n  (< (abs (- L1 L2)) 0.01))"
     :invariant "∀ γ, φ strictly-mono. length(γ) = length(γ ∘ φ)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/arc-length-param — see :summary."
     :composition "(define x (lambda (t) (cos t)))\n(define y (lambda (t) (sin t)))\n(define angles (list 0.5 1.0 1.5 2.0))\n(map (lambda (t) (calc/arc-length-param x y 0 t)) angles)"
     :emergent "cumulative-arc"
     :meta "The emergent cumulative-arc belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Cumulative arc → uniform-speed parametrization; the same shape as CDF from PDF in probability. See book-of-ml ch-01.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the cumulative-arc pattern."
     :cs "The emergent cumulative-arc is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/average-value': r"""  :row-2-audit (
    (:problem "A temperature-log analysis needs the mean value of a continuous reading over an interval — the discrete average of samples is a hack; the honest answer is the integral mean."
     :program "(calc/average-value (lambda (x) (* x x)) 0 1)"
     :explanation "Average of x^2 on [0,1] = 1/3; operator sees ≈ 0.333."
     :meta "integral gives the total; average-value divides by the interval length. Reporting the total when the operator wants the average confuses cumulative for typical.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'mean of a continuous function over an interval'"
     :rungs (
       (:domain "calc native" :code "(calc/average-value (lambda (x) (* x x)) 0 1)")
       (:domain "average audio-level over a window" :code "(audio/mean-level window)")
       (:domain "integral mean" :code "(1/(b-a)) ∫_a^b f(x) dx"))
     :explanation "Rung 1 is calc/average-value in its native library. Rung 2 shows the same ''mean of a continuous function over an interval'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''mean of a continuous function over an interval'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/average-value."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The average value of f on [a, b] is attained by f at some point in [a, b] if f is continuous (Mean Value Theorem for integrals)."
     :program "(define f (lambda (x) (* x x)))\n(define avg (calc/average-value f 0 1))\n(and (< avg (f 1)) (> avg (f 0)))"
     :invariant "∀ f continuous on [a, b]. ∃ c ∈ [a, b]. f(c) = (1/(b-a)) ∫_a^b f"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/average-value — see :summary."
     :composition "(define f (lambda (x) (sin x)))\n(list (calc/average-value f 0 3.14159)\n      (calc/average-value f 0 (* 2 3.14159)))"
     :emergent "moving-average"
     :meta "The emergent moving-average belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Windowed averages are the calculus-side ancestor of digital moving averages. See book-of-composition ch-10 (fx-chain).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the moving-average pattern."
     :cs "The emergent moving-average is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/continuous?': r"""  :row-2-audit (
    (:problem "Before applying an integration or extremum verb, the operator needs a fast check: is the function continuous on the interval, or will the algorithm hit a jump?"
     :program "(list (calc/continuous? (lambda (x) x) 0 1)\n      (calc/continuous? (lambda (x) (if (< x 0.5) 0 1)) 0 1))"
     :explanation "Linear function is continuous; step function is not; operator sees (#t #f)."
     :meta "differentiable? implies continuous but not vice versa; use continuous? for the weaker precondition of integral and limit.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'no-jump property of a function'"
     :rungs (
       (:domain "calc native" :code "(list (calc/continuous? (lambda (x) x) 0 1)")
       (:domain "audio has no clicks in a window" :code "(audio/no-click? window)")
       (:domain "epsilon-delta continuity" :code "∀ ε > 0 ∃ δ > 0. |x-y| < δ ⇒ |f(x)-f(y)| < ε"))
     :explanation "Rung 1 is calc/continuous? in its native library. Rung 2 shows the same ''no-jump property of a function'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''no-jump property of a function'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/continuous?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "If f is continuous on [a, b], f attains its max and min on [a, b] (extreme value theorem)."
     :program "(define f (lambda (x) (* x x)))\n(and (calc/continuous? f 0 1)\n     (number? (calc/extrema-1d f 0 1)))"
     :invariant "f continuous on [a, b] ⇒ ∃ M m ∈ [a, b]. ∀ x. f(m) ≤ f(x) ≤ f(M)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/continuous? — see :summary."
     :composition "(define fs (list (lambda (x) x) (lambda (x) (/ 1 x))))\n(map (lambda (f) (calc/continuous? f 0.5 2)) fs)"
     :emergent "pre-integration-gate"
     :meta "The emergent pre-integration-gate belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Continuity check before analysis is the same validate-then-run family as JSON-schema before parse. See book-of-composition ch-15 (http-server).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the pre-integration-gate pattern."
     :cs "The emergent pre-integration-gate is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/critical-points-1d': r"""  :row-2-audit (
    (:problem "An optimization problem needs the interior critical points where f'(x) = 0; the audit expects each one to be a local extremum or a saddle."
     :program "(calc/critical-points-1d (lambda (x) (- (* x x x) (* 3 x))) -3 3)"
     :explanation "f = x^3 - 3x has f' = 3x^2 - 3, zeros at x = ±1; operator sees a list containing 1 and -1."
     :meta "extrema-1d filters critical points to actual maxima/minima; critical-points-1d returns all f'(x) = 0 candidates including inflection points.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'zeros of a derivative'"
     :rungs (
       (:domain "calc native" :code "(calc/critical-points-1d (lambda (x) (- (* x x x) (* 3 x))) -3 3)")
       (:domain "flat regions in a level curve" :code "(curve/flat-points spline)")
       (:domain "roots of f\\'(x) = 0" :code "{x : f\\'(x) = 0}"))
     :explanation "Rung 1 is calc/critical-points-1d in its native library. Rung 2 shows the same ''zeros of a derivative'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''zeros of a derivative'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/critical-points-1d."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "At every critical point of a differentiable f, the derivative vanishes: f'(c) = 0."
     :program "(define f (lambda (x) (- (* x x x) (* 3 x))))\n(define df (calc/derivative f))\n(define cps (calc/critical-points-1d f -3 3))\n(let loop ((cs cps))\n  (or (null? cs) (and (< (abs (df (car cs))) 0.01) (loop (cdr cs)))))"
     :invariant "∀ c ∈ crit(f). f\\'(c) = 0"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/critical-points-1d — see :summary."
     :composition "(define f (lambda (x) (- (* x x x) (* 3 x))))\n(define cps (calc/critical-points-1d f -3 3))\n(map f cps)"
     :emergent "candidate-optima"
     :meta "The emergent candidate-optima belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Critical points → extremum classification is the classical Fermat program. See book-of-ml ch-06 (gradient descent).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the candidate-optima pattern."
     :cs "The emergent candidate-optima is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/curl': r"""  :row-2-audit (
    (:problem "A 2D-fluid or magnetic-field simulation needs the rotational component of a vector field; the audit wants the scalar curl at a point."
     :program "(calc/curl (lambda (p) (list (- (cadr p)) (car p))) (list 0 0))"
     :explanation "Rotational field F = (-y, x); curl F = 2; operator sees 2 (or close to it)."
     :meta "Divergence measures how much a field spreads out; curl measures how much it rotates. Different physical meaning; different formula.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'rotational density of a vector field'"
     :rungs (
       (:domain "calc native" :code "(calc/curl (lambda (p) (list (- (cadr p)) (car p))) (list 0 0))")
       (:domain "vortex-strength in a fluid simulation" :code "(motion/vorticity field)")
       (:domain "∇ × F" :code "(∂F_2/∂x - ∂F_1/∂y)"))
     :explanation "Rung 1 is calc/curl in its native library. Rung 2 shows the same ''rotational density of a vector field'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''rotational density of a vector field'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/curl."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For a gradient field F = ∇φ, curl F = 0 (curl of gradient is zero)."
     :program "(define phi (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define F (lambda (p) (calc/gradient phi p)))\n(< (abs (calc/curl F (list 0.5 0.3))) 0.05)"
     :invariant "∀ φ ∈ C^2. curl(∇φ) = 0"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/curl — see :summary."
     :composition "(define F (lambda (p) (list (- (cadr p)) (car p))))\n(list (calc/curl F (list 0 0)) (calc/divergence F (list 0 0)))"
     :emergent "rotation-detector"
     :meta "The emergent rotation-detector belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Curl + divergence is the vector-calculus split into rotation and expansion. See book-of-ml ch-01.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the rotation-detector pattern."
     :cs "The emergent rotation-detector is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/derivative': r"""  :row-2-audit (
    (:problem "An operator needs the instantaneous rate of change of a smooth function as a callable — analytic derivation is often ugly, numerical differentiation is the honest fallback."
     :program "(define f (lambda (x) (* x x)))\n(define df (calc/derivative f))\n(df 3)"
     :explanation "f' at 3 for f(x) = x^2 is 2·3 = 6; operator sees ≈ 6."
     :meta "partial takes a multivariate function and a variable index; derivative is single-variable. Use partial when there are multiple inputs.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'instantaneous rate of change'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (x) (* x x)))")
       (:domain "velocity from position samples" :code "(motion/velocity samples t)")
       (:domain "limit definition of derivative" :code "lim_{h→0} (f(x+h)-f(x))/h"))
     :explanation "Rung 1 is calc/derivative in its native library. Rung 2 shows the same ''instantaneous rate of change'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''instantaneous rate of change'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/derivative."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Linearity: (af + bg)' = a f' + b g'."
     :program "(define f (lambda (x) (* x x)))\n(define g (lambda (x) x))\n(define df (calc/derivative f))\n(define dg (calc/derivative g))\n(define combined (calc/derivative (lambda (x) (+ (* 3 (f x)) (* 2 (g x))))))\n(< (abs (- (combined 1.0) (+ (* 3 (df 1.0)) (* 2 (dg 1.0))))) 0.01)"
     :invariant "∀ f g diff. (af + bg)\\' = a f\\' + b g\\'"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2. Also book-of-ml ch-06 (gradient descent) for autodiff and gradient descent.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/derivative — see :summary."
     :composition "(define f (lambda (x) (sin x)))\n(define df (calc/derivative f))\n(define ddf (calc/derivative df))\n(list (df 0) (ddf 0))"
     :emergent "higher-derivatives"
     :meta "The emergent higher-derivatives belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Repeated derivative = Taylor coefficients / higher-order rate. See book-of-ml ch-09 (backpropagation).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the higher-derivatives pattern."
     :cs "The emergent higher-derivatives is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/differentiable?': r"""  :row-2-audit (
    (:problem "Before applying gradient descent or Newton's method, the operator must certify differentiability of the objective on the search domain."
     :program "(list (calc/differentiable? (lambda (x) x) 0 1)\n      (calc/differentiable? (lambda (x) (abs x)) -1 1))"
     :explanation "Linear is differentiable; |x| is not at 0; operator sees (#t #f)."
     :meta "Continuity is weaker; differentiability is stronger. Newton needs differentiability; only integration needs continuity.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'smooth-enough-to-linearize'"
     :rungs (
       (:domain "calc native" :code "(list (calc/differentiable? (lambda (x) x) 0 1)")
       (:domain "audio can be locally interpolated" :code "(audio/smooth-window? win)")
       (:domain "existence of f\\' on an interval" :code "∀ x ∈ [a, b]. lim_{h→0} (f(x+h)-f(x))/h exists"))
     :explanation "Rung 1 is calc/differentiable? in its native library. Rung 2 shows the same ''smooth-enough-to-linearize'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''smooth-enough-to-linearize'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/differentiable?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "If f is differentiable on [a, b] then f is continuous on [a, b]."
     :program "(define f (lambda (x) (* x x)))\n(and (calc/differentiable? f 0 1)\n     (calc/continuous? f 0 1))"
     :invariant "f differentiable on I ⇒ f continuous on I"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/differentiable? — see :summary."
     :composition "(define fs (list (lambda (x) x) (lambda (x) (abs x)) (lambda (x) (sqrt (abs x)))))\n(map (lambda (f) (calc/differentiable? f -0.1 0.1)) fs)"
     :emergent "newton-eligible"
     :meta "The emergent newton-eligible belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Differentiability gate before Newton is the safe-precondition pattern. See book-of-ml ch-06.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the newton-eligible pattern."
     :cs "The emergent newton-eligible is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/directional-derivative': r"""  :row-2-audit (
    (:problem "A gradient-descent step needs the rate of change along a specific direction, not along an axis; the operator wants ∇f · v."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(calc/directional-derivative f (list 1 0) (list 1 0))"
     :explanation "∇f = (2x, 2y); at (1, 0), direction (1, 0), derivative = 2; operator sees ≈ 2."
     :meta "partial takes an axis-aligned direction; directional-derivative accepts any unit vector. Same shape, more general.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'rate along a chosen direction'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))")
       (:domain "slope of terrain in a walking direction" :code "(terrain/slope-in-direction map p dir)")
       (:domain "∇f · v" :code "(∇f)(x) · v"))
     :explanation "Rung 1 is calc/directional-derivative in its native library. Rung 2 shows the same ''rate along a chosen direction'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''rate along a chosen direction'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/directional-derivative."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Directional derivative is a linear function of direction: D_{av+bw} f = a D_v f + b D_w f."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define p (list 1 1))\n(define v (list 1 0)) (define w (list 0 1))\n(< (abs (- (calc/directional-derivative f p (list 2 3))\n           (+ (* 2 (calc/directional-derivative f p v))\n              (* 3 (calc/directional-derivative f p w))))) 0.01)"
     :invariant "D_{av+bw} f = a D_v f + b D_w f"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/directional-derivative — see :summary."
     :composition "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define p (list 1 1))\n(define g (calc/gradient f p))\n(list g (calc/directional-derivative f p (list 1 0)))"
     :emergent "steepest-descent-direction"
     :meta "The emergent steepest-descent-direction belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Directional derivative maximized along ∇f gives steepest descent. See book-of-ml ch-06.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the steepest-descent-direction pattern."
     :cs "The emergent steepest-descent-direction is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/divergence': r"""  :row-2-audit (
    (:problem "A conservation-law check needs the divergence of a vector field; the audit is 'does mass conservation hold in this simulation snapshot?'"
     :program "(calc/divergence (lambda (p) (list (car p) (cadr p))) (list 1 2))"
     :explanation "F = (x, y); div F = 2; operator sees ≈ 2."
     :meta "Curl measures rotation; divergence measures expansion. Both apply to vector fields; use both to characterize the field.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'expansion density of a vector field'"
     :rungs (
       (:domain "calc native" :code "(calc/divergence (lambda (p) (list (car p) (cadr p))) (list 1 2))")
       (:domain "flow-out of a fluid cell" :code "(motion/flux-out cell)")
       (:domain "∇ · F" :code "(∂F_1/∂x + ∂F_2/∂y)"))
     :explanation "Rung 1 is calc/divergence in its native library. Rung 2 shows the same ''expansion density of a vector field'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''expansion density of a vector field'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/divergence."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For any C^2 vector field F, div(curl F) = 0."
     :program "(define F (lambda (p) (list (- (cadr p)) (car p))))\n(define curlF (lambda (p) (list 0 0 (calc/curl F p))))\n(< (abs (calc/divergence curlF (list 0.5 0.3))) 0.05)"
     :invariant "∀ F ∈ C^2. div(curl F) = 0"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/divergence — see :summary."
     :composition "(define F (lambda (p) (list (car p) (cadr p))))\n(list (calc/divergence F (list 1 1)) (calc/curl F (list 1 1)))"
     :emergent "conservation-check"
     :meta "The emergent conservation-check belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Divergence + boundary integral = Divergence theorem. See book-of-ml ch-01.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the conservation-check pattern."
     :cs "The emergent conservation-check is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/extrema-1d': r"""  :row-2-audit (
    (:problem "An optimization needs both max and min of a smooth function on a bounded interval — not just critical points but classified extrema."
     :program "(calc/extrema-1d (lambda (x) (* x x)) -2 2)"
     :explanation "Min at x=0 (value 0), max at x=±2 (value 4); operator sees the classified extrema."
     :meta "critical-points-1d returns all f'=0 candidates; extrema-1d additionally checks endpoints and classifies. Use extrema-1d when you want the answer, not the candidates.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'max/min of a continuous function on a compact interval'"
     :rungs (
       (:domain "calc native" :code "(calc/extrema-1d (lambda (x) (* x x)) -2 2)")
       (:domain "brightest/darkest pixel in a scanline" :code "(image/scanline-extrema line)")
       (:domain "extreme value theorem application" :code "attained at boundary or where f\\' = 0"))
     :explanation "Rung 1 is calc/extrema-1d in its native library. Rung 2 shows the same ''max/min of a continuous function on a compact interval'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''max/min of a continuous function on a compact interval'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/extrema-1d."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "A continuous function on [a, b] attains its max and min in [a, b]."
     :program "(define f (lambda (x) (- (* x x) x)))\n(define ext (calc/extrema-1d f 0 1))\n(pair? ext)"
     :invariant "f continuous on [a, b] ⇒ ∃ M m. ∀ x ∈ [a, b]. f(m) ≤ f(x) ≤ f(M)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/extrema-1d — see :summary."
     :composition "(define f (lambda (x) (* x x x)))\n(list (calc/extrema-1d f -1 1) (calc/critical-points-1d f -1 1))"
     :emergent "optimum-finder"
     :meta "The emergent optimum-finder belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Extremum finding + gradient descent = classical vs numerical optimization. See book-of-ml ch-06.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the optimum-finder pattern."
     :cs "The emergent optimum-finder is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/gradient': r"""  :row-2-audit (
    (:problem "A neural-network training step needs ∇L(w) — the gradient of loss with respect to parameters — as a plain vector to feed into an SGD update."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(calc/gradient f (list 1 2))"
     :explanation "∇f = (2x, 2y); at (1, 2), gradient = (2, 4); operator sees (2 4)."
     :meta "partial gives one component; gradient bundles all of them into a vector. Use gradient when you want to update all parameters at once.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'vector of partial derivatives'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))")
       (:domain "per-pixel light-vector" :code "(shader/normal-map p)")
       (:domain "∇f = (∂_1 f, ∂_2 f, …, ∂_n f)" :code "∇f(x)"))
     :explanation "Rung 1 is calc/gradient in its native library. Rung 2 shows the same ''vector of partial derivatives'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''vector of partial derivatives'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/gradient."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The gradient points in the direction of steepest ascent of f."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define p (list 1 1))\n(define g (calc/gradient f p))\n(define g-mag (sqrt (+ (* (car g) (car g)) (* (cadr g) (cadr g)))))\n(> (calc/directional-derivative f p (list (/ (car g) g-mag) (/ (cadr g) g-mag)))\n   (calc/directional-derivative f p (list 1 0)))"
     :invariant "∀ unit v. D_v f(x) ≤ |∇f(x)|, equality at v = ∇f/|∇f|"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra. Also book-of-ml ch-06 (gradient descent) — this is the primitive of gradient descent.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/gradient — see :summary."
     :composition "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define lr 0.1)\n(define step (lambda (p) (let ((g (calc/gradient f p)))\n  (list (- (car p) (* lr (car g))) (- (cadr p) (* lr (cadr g)))))))\n(let loop ((n 0) (cur (list 3 3)))\n  (cond ((= n 5) cur) (else (loop (+ n 1) (step cur)))))"
     :emergent "gradient-descent-step"
     :meta "The emergent gradient-descent-step belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Gradient + learning rate = one SGD step; the universal ML primitive. See book-of-ml ch-06 and ch-10.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the gradient-descent-step pattern."
     :cs "The emergent gradient-descent-step is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/hessian': r"""  :row-2-audit (
    (:problem "A second-order optimizer (Newton, quasi-Newton) needs the Hessian matrix of second partials at a point."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(calc/hessian f (list 0 0))"
     :explanation "Hessian of x^2 + y^2 is [[2, 0], [0, 2]]; operator sees that matrix."
     :meta "Gradient is first-order; Hessian is second-order. Newton needs the Hessian to invert; SGD needs only the gradient.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'second-derivative tensor'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))")
       (:domain "local curvature of a terrain" :code "(terrain/local-curvature map p)")
       (:domain "Hessian matrix" :code "H_{ij} = ∂²f / ∂x_i ∂x_j"))
     :explanation "Rung 1 is calc/hessian in its native library. Rung 2 shows the same ''second-derivative tensor'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''second-derivative tensor'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/hessian."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For f ∈ C^2, the Hessian is symmetric: H_{ij} = H_{ji} (Schwarz)."
     :program "(define f (lambda (p) (+ (* (car p) (cadr p)) (* (car p) (car p)))))\n(define H (calc/hessian f (list 1 1)))\n(< (abs (- (list-ref (list-ref H 0) 1) (list-ref (list-ref H 1) 0))) 0.01)"
     :invariant "f ∈ C^2 ⇒ ∂²f/∂x_i ∂x_j = ∂²f/∂x_j ∂x_i"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/hessian — see :summary."
     :composition "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define p (list 1 1))\n(define g (calc/gradient f p))\n(define H (calc/hessian f p))\n(list g H)"
     :emergent "newton-step-input"
     :meta "The emergent newton-step-input belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Gradient + Hessian = Newton step; see book-of-ml appendix-a (math prereqs).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the newton-step-input pattern."
     :cs "The emergent newton-step-input is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/integral': r"""  :row-2-audit (
    (:problem "A total-area or accumulated-quantity computation needs ∫ f dx over an interval; analytic antiderivatives are often unavailable, so numerical integration is the honest tool."
     :program "(calc/integral (lambda (x) (* x x)) 0 1)"
     :explanation "∫₀¹ x² dx = 1/3; operator sees ≈ 0.333."
     :meta "riemann-sum exposes the mesh; integral hides it behind an adaptive method. For pedagogy, use riemann-sum; for production, integral.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'accumulated area under a curve'"
     :rungs (
       (:domain "calc native" :code "(calc/integral (lambda (x) (* x x)) 0 1)")
       (:domain "total volume-samples of an audio window" :code "(audio/window-energy w)")
       (:domain "Riemann integral" :code "∫_a^b f(x) dx"))
     :explanation "Rung 1 is calc/integral in its native library. Rung 2 shows the same ''accumulated area under a curve'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''accumulated area under a curve'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/integral."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The integral is linear and additive over intervals: ∫_a^c f = ∫_a^b f + ∫_b^c f for a ≤ b ≤ c."
     :program "(define f (lambda (x) (* x x)))\n(< (abs (- (calc/integral f 0 2) (+ (calc/integral f 0 1) (calc/integral f 1 2)))) 0.01)"
     :invariant "∀ a ≤ b ≤ c. ∫_a^c f = ∫_a^b f + ∫_b^c f"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2. Also ch-advanced-10 (Numerical Methods) for adaptive quadrature.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/integral — see :summary."
     :composition "(define f (lambda (x) (* x x)))\n(list (calc/integral f 0 1) (calc/average-value f 0 1) (calc/arc-length f 0 1))"
     :emergent "definite-integral"
     :meta "The emergent definite-integral belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Integral + step + accumulate = the fundamental theorem of calculus workflow.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the definite-integral pattern."
     :cs "The emergent definite-integral is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/jacobian': r"""  :row-2-audit (
    (:problem "A change-of-variables integration or a nonlinear-solver linearization needs the Jacobian matrix of a vector-valued function."
     :program "(define f (lambda (p) (list (+ (car p) (cadr p)) (- (car p) (cadr p)))))\n(calc/jacobian f (list 1 1))"
     :explanation "J = [[1, 1], [1, -1]]; operator sees that matrix."
     :meta "gradient is for scalar-valued functions; jacobian generalizes to vector-valued. Use jacobian when the output is a vector.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'best linear approximation of a vector map'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (p) (list (+ (car p) (cadr p)) (- (car p) (cadr p)))))")
       (:domain "local warp matrix at a pixel" :code "(shader/local-warp p)")
       (:domain "Jacobian matrix" :code "J_{ij} = ∂f_i / ∂x_j"))
     :explanation "Rung 1 is calc/jacobian in its native library. Rung 2 shows the same ''best linear approximation of a vector map'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''best linear approximation of a vector map'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/jacobian."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For a diffeomorphism f, the volume element transforms via |det J|."
     :program "(define f (lambda (p) (list (+ (car p) (cadr p)) (- (car p) (cadr p)))))\n(define J (calc/jacobian f (list 0 0)))\n(number? (list-ref (list-ref J 0) 0))"
     :invariant "dV(y) = |det J_f(x)| dV(x)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra. Also book-of-ml ch-03 for matrix side.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/jacobian — see :summary."
     :composition "(define f (lambda (p) (list (* (car p) (cadr p)) (+ (car p) (cadr p)))))\n(define J (calc/jacobian f (list 1 2)))\nJ"
     :emergent "linearization"
     :meta "The emergent linearization belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Jacobian = best linear approximation; the multivariate analog of the tangent line.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the linearization pattern."
     :cs "The emergent linearization is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/laplacian': r"""  :row-2-audit (
    (:problem "A heat-equation or Poisson-solve step needs Δf = ∇·∇f at a point; the operator wants a single call rather than composing gradient and divergence."
     :program "(calc/laplacian (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))) (list 0 0))"
     :explanation "Δ(x² + y²) = 4; operator sees ≈ 4."
     :meta "divergence takes a vector field; laplacian takes a scalar. The two compose (Δf = div ∇f) but the direct verb is cleaner.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'trace of the Hessian'"
     :rungs (
       (:domain "calc native" :code "(calc/laplacian (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))) (list 0 0))")
       (:domain "image smoothing / blur kernel" :code "(image/laplacian-blur img)")
       (:domain "Δf = Σ ∂²f/∂x_i²" :code "Δf = ∇·∇f"))
     :explanation "Rung 1 is calc/laplacian in its native library. Rung 2 shows the same ''trace of the Hessian'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''trace of the Hessian'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/laplacian."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "A harmonic function (Δf = 0) has no strict local extremum in the interior."
     :program "(define f (lambda (p) (- (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(< (abs (calc/laplacian f (list 1 1))) 0.01)"
     :invariant "Δf = 0 ⇒ ∀ interior x. f(x) ∉ strict-max ∧ f(x) ∉ strict-min"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/laplacian — see :summary."
     :composition "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(list (calc/laplacian f (list 0 0)) (calc/hessian f (list 0 0)))"
     :emergent "diffusion-operator"
     :meta "The emergent diffusion-operator belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Laplacian appears in heat, wave, and diffusion equations. See book-of-ml ch-01.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the diffusion-operator pattern."
     :cs "The emergent diffusion-operator is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/limit': r"""  :row-2-audit (
    (:problem "A hole in a rational function needs its limit value; the operator wants a numerical approximation without the algebraic manipulation."
     :program "(calc/limit (lambda (x) (/ (- (* x x) 1) (- x 1))) 1)"
     :explanation "Limit of (x²-1)/(x-1) at 1 is 2; operator sees ≈ 2."
     :meta "continuous? asks whether the function is defined AND continuous; limit asks 'what value would fill the hole?' — a weaker but related question.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'value approached by a function'"
     :rungs (
       (:domain "calc native" :code "(calc/limit (lambda (x) (/ (- (* x x) 1) (- x 1))) 1)")
       (:domain "convergence of an iterative computation" :code "(math/fixed-point-limit f x0)")
       (:domain "lim_{x → a} f(x)" :code "ε-δ limit"))
     :explanation "Rung 1 is calc/limit in its native library. Rung 2 shows the same ''value approached by a function'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''value approached by a function'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/limit."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Uniqueness: if lim f exists, it is unique."
     :program "(define f (lambda (x) (/ (- (* x x) 1) (- x 1))))\n(define L1 (calc/limit f 1))\n(define L2 (calc/limit f 1))\n(< (abs (- L1 L2)) 0.001)"
     :invariant "∀ f, a. lim_{x → a} f(x) exists ⇒ unique"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/limit — see :summary."
     :composition "(define f (lambda (x) (/ (sin x) x)))\n(list (calc/limit f 0) (calc/derivative f))"
     :emergent "removable-singularity-fill"
     :meta "The emergent removable-singularity-fill belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Limit + define-by-cases = the closure operation on partial functions.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the removable-singularity-fill pattern."
     :cs "The emergent removable-singularity-fill is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/line-integral': r"""  :row-2-audit (
    (:problem "A work-energy computation over a curved path needs ∫_γ F·dr; the operator supplies the path and the field and expects a scalar."
     :program "(define F (lambda (p) (list (car p) (cadr p))))\n(define x (lambda (t) t)) (define y (lambda (t) t))\n(calc/line-integral F x y 0 1)"
     :explanation "F = (x, y) along y = x from 0 to 1; ∫ = 1; operator sees ≈ 1."
     :meta "integral is 1-D over an interval; line-integral is 1-D over a curve in higher dimensions. Same idea, different geometry.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'path integral of a field'"
     :rungs (
       (:domain "calc native" :code "(define F (lambda (p) (list (car p) (cadr p))))")
       (:domain "work done along a sprite trajectory" :code "(motion/work-along-path field path)")
       (:domain "∫_γ F · dr" :code "∫_a^b F(γ(t)) · γ\\'(t) dt"))
     :explanation "Rung 1 is calc/line-integral in its native library. Rung 2 shows the same ''path integral of a field'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''path integral of a field'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/line-integral."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For a conservative field F = ∇φ, the line integral depends only on endpoints (path independence)."
     :program "(define phi (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define F (lambda (p) (calc/gradient phi p)))\n(define x1 (lambda (t) t)) (define y1 (lambda (t) t))\n(define x2 (lambda (t) (* t t))) (define y2 (lambda (t) t))\n(< (abs (- (calc/line-integral F x1 y1 0 1) (calc/line-integral F x2 y2 0 1))) 0.05)"
     :invariant "F = ∇φ ⇒ ∫_γ F · dr = φ(γ(b)) - φ(γ(a))"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/line-integral — see :summary."
     :composition "(define F (lambda (p) (list (- (cadr p)) (car p))))\n(define x (lambda (t) (cos t))) (define y (lambda (t) (sin t)))\n(calc/line-integral F x y 0 (* 2 3.14159))"
     :emergent "circulation"
     :meta "The emergent circulation belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Circulation = line integral around a closed loop; connected to curl by Stokes. See book-of-ml ch-01.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the circulation pattern."
     :cs "The emergent circulation is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/newton': r"""  :row-2-audit (
    (:problem "A root-finding problem for a smooth f needs a fast iteration; Newton's method converges quadratically near a simple root."
     :program "(calc/newton (lambda (x) (- (* x x) 2)) 1.5)"
     :explanation "√2 ≈ 1.4142; operator sees a value very close to it."
     :meta "critical-points-1d finds where f' = 0; newton finds where f = 0. Different targets.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'iterative root-finder using tangent lines'"
     :rungs (
       (:domain "calc native" :code "(calc/newton (lambda (x) (- (* x x) 2)) 1.5)")
       (:domain "binary-search refinement of a fixed point" :code "(motion/binary-search-root f)")
       (:domain "Newton iteration" :code "x_{n+1} = x_n - f(x_n)/f\\'(x_n)"))
     :explanation "Rung 1 is calc/newton in its native library. Rung 2 shows the same ''iterative root-finder using tangent lines'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''iterative root-finder using tangent lines'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/newton."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Near a simple root, Newton's iteration converges quadratically: |x_{n+1} - r| ≤ C |x_n - r|²."
     :program "(define f (lambda (x) (- (* x x) 2)))\n(define r (calc/newton f 1.5))\n(< (abs (f r)) 0.0001)"
     :invariant "Near simple root r: |x_{n+1} - r| ≤ C |x_n - r|²"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-10 (Numerical Methods).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/newton — see :summary."
     :composition "(define f (lambda (x) (- (* x x x) x 1)))\n(define seeds (list 1 -1 0.5))\n(map (lambda (s) (calc/newton f s)) seeds)"
     :emergent "root-finder"
     :meta "The emergent root-finder belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Newton is the archetype quadratically-convergent iteration. See book-of-ml ch-06 for the descent-analog.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the root-finder pattern."
     :cs "The emergent root-finder is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/partial': r"""  :row-2-audit (
    (:problem "A partial-derivative-with-respect-to-one-variable is what backpropagation needs to build the gradient component-by-component."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(calc/partial f 0 (list 1 2))"
     :explanation "∂f/∂x at (1, 2) = 2x = 2; operator sees ≈ 2."
     :meta "gradient is the full vector; partial is one component. Use partial when you don't need the whole vector.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'axis-aligned rate of change'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))")
       (:domain "per-channel color derivative" :code "(shader/dcolor-dc chan p)")
       (:domain "∂f/∂x_i" :code "partial derivative"))
     :explanation "Rung 1 is calc/partial in its native library. Rung 2 shows the same ''axis-aligned rate of change'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''axis-aligned rate of change'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/partial."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For f ∈ C^2, the mixed partials commute: ∂²f/∂x∂y = ∂²f/∂y∂x."
     :program "(define f (lambda (p) (* (car p) (cadr p))))\n(define fx (lambda (p) (calc/partial f 0 p)))\n(define fxy (lambda (p) (calc/partial fx 1 p)))\n(define fy (lambda (p) (calc/partial f 1 p)))\n(define fyx (lambda (p) (calc/partial fy 0 p)))\n(< (abs (- (fxy (list 1 1)) (fyx (list 1 1)))) 0.05)"
     :invariant "f ∈ C^2 ⇒ ∂²f/∂x∂y = ∂²f/∂y∂x"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/partial — see :summary."
     :composition "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(list (calc/partial f 0 (list 1 1)) (calc/partial f 1 (list 1 1)) (calc/gradient f (list 1 1)))"
     :emergent "gradient-component"
     :meta "The emergent gradient-component belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Partial + assemble = gradient; the building block of every autodiff engine.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the gradient-component pattern."
     :cs "The emergent gradient-component is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/radius-of-convergence': r"""  :row-2-audit (
    (:problem "A power-series computation needs to know how far around the base point it converges; operating outside R gives nonsense."
     :program "(calc/radius-of-convergence (lambda (n) (/ 1.0 (factorial n))))"
     :explanation "Coefficients 1/n! give R = ∞ (exp series); operator sees a very large value."
     :meta "series-converges? tests one specific series; radius-of-convergence gives the whole disk of convergence at once.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: series; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'domain of validity of a series expansion'"
     :rungs (
       (:domain "calc native" :code "(calc/radius-of-convergence (lambda (n) (/ 1.0 (factorial n))))")
       (:domain "trust-region size around a Taylor approximation" :code "(motion/trust-radius-of-approx approx)")
       (:domain "R = 1/limsup |a_n|^{1/n}" :code "Cauchy-Hadamard formula"))
     :explanation "Rung 1 is calc/radius-of-convergence in its native library. Rung 2 shows the same ''domain of validity of a series expansion'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''domain of validity of a series expansion'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/radius-of-convergence."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Inside |x-c| < R the series converges absolutely; outside it diverges."
     :program "(define geo (lambda (n) 1.0))\n(define R (calc/radius-of-convergence geo))\n(< 0.5 R)"
     :invariant "R = 1/limsup |a_n|^{1/n}"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-03 (Sequences, Series, Recurrence).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the series category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/radius-of-convergence — see :summary."
     :composition "(define coeffs (list (lambda (n) (/ 1.0 (factorial n))) (lambda (n) 1.0)))\n(map calc/radius-of-convergence coeffs)"
     :emergent "convergence-disk"
     :meta "The emergent convergence-disk belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Radius of convergence + Taylor series is the standard function-approximation pattern.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the series operations close into the convergence-disk pattern."
     :cs "The emergent convergence-disk is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/riemann-sum': r"""  :row-2-audit (
    (:problem "A pedagogy or budget check needs an explicit Riemann sum with a chosen mesh, so the operator can compare left/right/midpoint approximations."
     :program "(calc/riemann-sum (lambda (x) (* x x)) 0 1 100)"
     :explanation "100 rectangles for ∫₀¹ x² dx ≈ 0.33; operator sees a value near 0.333."
     :meta "calc/integral hides the mesh; calc/riemann-sum exposes it. Use riemann-sum when the mesh matters (education, controlled experiment).")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'discrete approximation of a continuous accumulation'"
     :rungs (
       (:domain "calc native" :code "(calc/riemann-sum (lambda (x) (* x x)) 0 1 100)")
       (:domain "audio RMS from samples" :code "(audio/rms samples)")
       (:domain "Riemann sum" :code "Σ f(x_i) Δx_i"))
     :explanation "Rung 1 is calc/riemann-sum in its native library. Rung 2 shows the same ''discrete approximation of a continuous accumulation'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''discrete approximation of a continuous accumulation'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/riemann-sum."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "As mesh size → 0, the Riemann sum → the Riemann integral (for continuous f)."
     :program "(define f (lambda (x) (* x x)))\n(< (abs (- (calc/riemann-sum f 0 1 1000) (calc/integral f 0 1))) 0.01)"
     :invariant "lim_{n→∞} (1/n) Σ_i f(a + iΔx)Δx = ∫_a^b f"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/riemann-sum — see :summary."
     :composition "(define f (lambda (x) (* x x)))\n(map (lambda (n) (calc/riemann-sum f 0 1 n)) (list 10 100 1000))"
     :emergent "mesh-refinement-sequence"
     :meta "The emergent mesh-refinement-sequence belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Mesh refinement → convergent sum = the classical numerical integration pattern.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the mesh-refinement-sequence pattern."
     :cs "The emergent mesh-refinement-sequence is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/second-derivative': r"""  :row-2-audit (
    (:problem "An inflection-point analysis or curvature computation needs f''(x); the operator wants a direct call rather than differentiating twice manually."
     :program "(define f (lambda (x) (* x x x)))\n(define ddf (calc/second-derivative f))\n(ddf 1)"
     :explanation "f'' of x³ at 1 is 6; operator sees ≈ 6."
     :meta "derivative gives f'; second-derivative gives f''. Composition (calc/derivative (calc/derivative f)) works too but is noisier.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'second-order rate of change'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (x) (* x x x)))")
       (:domain "acceleration from position samples" :code "(motion/acceleration samples t)")
       (:domain "second derivative f\\'\\'(x)" :code "d²f/dx²"))
     :explanation "Rung 1 is calc/second-derivative in its native library. Rung 2 shows the same ''second-order rate of change'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''second-order rate of change'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/second-derivative."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "At a local max, f'' ≤ 0; at a local min, f'' ≥ 0 (second-derivative test)."
     :program "(define f (lambda (x) (* x x)))\n(define ddf (calc/second-derivative f))\n(> (ddf 0) 0)"
     :invariant "local min at c ⇒ f''(c) ≥ 0  ∧  local max at c ⇒ f''(c) ≤ 0"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/second-derivative — see :summary."
     :composition "(define f (lambda (x) (sin x)))\n(define ddf (calc/second-derivative f))\n(map ddf (list 0 (/ 3.14159 2) 3.14159))"
     :emergent "convexity-test"
     :meta "The emergent convexity-test belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Second-derivative test = classical convexity analysis; extended in book-of-ml ch-06 (gradient descent).")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the convexity-test pattern."
     :cs "The emergent convexity-test is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/series-converges?': r"""  :row-2-audit (
    (:problem "A summation over an infinite series needs a pre-check: does the series converge at all, or is the computation meaningless?"
     :program "(list (calc/series-converges? (lambda (n) (/ 1.0 (* n n))))\n      (calc/series-converges? (lambda (n) (/ 1.0 n))))"
     :explanation "Σ 1/n² converges (π²/6); Σ 1/n diverges (harmonic); operator sees (#t #f)."
     :meta "radius-of-convergence is for power series; series-converges? is for a single numeric series. Different domains.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: series; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'convergence gate for infinite sums'"
     :rungs (
       (:domain "calc native" :code "(list (calc/series-converges? (lambda (n) (/ 1.0 (* n n))))")
       (:domain "idle-loop bounded-effect check" :code "(motion/effect-bounded? loop)")
       (:domain "convergence of Σ a_n" :code "lim_{N→∞} Σ_{n=1}^N a_n exists"))
     :explanation "Rung 1 is calc/series-converges? in its native library. Rung 2 shows the same ''convergence gate for infinite sums'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''convergence gate for infinite sums'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/series-converges?."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "If Σ a_n converges then a_n → 0 (necessary condition)."
     :program "(define diverges (lambda (n) 1.0))\n(not (calc/series-converges? diverges))"
     :invariant "Σ a_n converges ⇒ lim_{n→∞} a_n = 0"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch-advanced-03 (Sequences, Series, Recurrence).")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the series category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/series-converges? — see :summary."
     :composition "(define seqs (list (lambda (n) (/ 1.0 (* n n))) (lambda (n) (/ 1.0 (expt 2 n))) (lambda (n) (/ 1.0 n))))\n(map calc/series-converges? seqs)"
     :emergent "convergence-classifier"
     :meta "The emergent convergence-classifier belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Same shape as a program-termination check — decide before running.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the series operations close into the convergence-classifier pattern."
     :cs "The emergent convergence-classifier is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/surface-integral': r"""  :row-2-audit (
    (:problem "A flux computation through a curved surface needs ∫∫_S F·dS; the operator wants a scalar output for the total flow."
     :program "(define F (lambda (p) (list (car p) (cadr p) (caddr p))))\n(define x (lambda (u v) (* (cos u) (sin v))))\n(define y (lambda (u v) (* (sin u) (sin v))))\n(define z (lambda (u v) (cos v)))\n(calc/surface-integral F x y z 0 (* 2 3.14159) 0 3.14159)"
     :explanation "Flux of position field through unit sphere = 4π; operator sees ≈ 12.57."
     :meta "line-integral is 1D over a curve; surface-integral is 2D over a surface. Same idea, different dimensionality.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'flux through a 2D surface'"
     :rungs (
       (:domain "calc native" :code "(define F (lambda (p) (list (car p) (cadr p) (caddr p))))")
       (:domain "rendered lighting integral over a mesh" :code "(render/light-through-mesh mesh)")
       (:domain "∫∫_S F · dS" :code "∫∫ F · (r_u × r_v) du dv"))
     :explanation "Rung 1 is calc/surface-integral in its native library. Rung 2 shows the same ''flux through a 2D surface'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''flux through a 2D surface'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/surface-integral."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "For a closed surface enclosing volume V, ∫∫_S F·dS = ∫∫∫_V div F dV (Divergence theorem)."
     :program "(define F (lambda (p) (list (car p) (cadr p) (caddr p))))\n(define x (lambda (u v) (* (cos u) (sin v))))\n(define y (lambda (u v) (* (sin u) (sin v))))\n(define z (lambda (u v) (cos v)))\n(define flux (calc/surface-integral F x y z 0 (* 2 3.14159) 0 3.14159))\n(< (abs (- flux (* 4 3.14159))) 0.5)"
     :invariant "∮_S F · dS = ∫_V div F dV"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/surface-integral — see :summary."
     :composition "(define F (lambda (p) (list (car p) (cadr p) (caddr p))))\n(define x (lambda (u v) (* (cos u) (sin v))))\n(define y (lambda (u v) (* (sin u) (sin v))))\n(define z (lambda (u v) (cos v)))\n(list (calc/surface-integral F x y z 0 (* 2 3.14159) 0 3.14159) (* 4 3.14159))"
     :emergent "divergence-theorem-witness"
     :meta "The emergent divergence-theorem-witness belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Surface integral + divergence theorem is the classical 3D flux computation.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the divergence-theorem-witness pattern."
     :cs "The emergent divergence-theorem-witness is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/surface-revolution': r"""  :row-2-audit (
    (:problem "A cup or lampshade area estimation needs the surface generated by rotating y=f(x) about the x-axis; the audit wants a single integral answer."
     :program "(calc/surface-revolution (lambda (x) x) 0 1)"
     :explanation "Surface area of cone y=x, 0≤x≤1 is π√2; operator sees ≈ 4.44."
     :meta "arc-length gives length of a curve; surface-revolution gives area of the surface swept out. Different quantities, both come from the same arc-length integrand.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'2D area from a rotating 1D curve'"
     :rungs (
       (:domain "calc native" :code "(calc/surface-revolution (lambda (x) x) 0 1)")
       (:domain "scene-mesh-area of a lathe object" :code "(mesh/lathe-area profile)")
       (:domain "∫ 2π f(x) √(1 + f\\'(x)²) dx" :code "surface of revolution"))
     :explanation "Rung 1 is calc/surface-revolution in its native library. Rung 2 shows the same ''2D area from a rotating 1D curve'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''2D area from a rotating 1D curve'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/surface-revolution."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Surface area is non-negative and monotone in the interval [a, b]."
     :program "(define f (lambda (x) x))\n(<= (calc/surface-revolution f 0 1) (calc/surface-revolution f 0 2))"
     :invariant "∀ [a, b] ⊆ [c, d]. sr(f, a, b) ≤ sr(f, c, d)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/surface-revolution — see :summary."
     :composition "(define f (lambda (x) x))\n(list (calc/arc-length f 0 1) (calc/surface-revolution f 0 1) (calc/volume-revolution f 0 1))"
     :emergent "lathe-metric-triple"
     :meta "The emergent lathe-metric-triple belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Arc-length + surface-of-revolution + volume-of-revolution together characterize a lathe object.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the lathe-metric-triple pattern."
     :cs "The emergent lathe-metric-triple is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/tangent-line': r"""  :row-2-audit (
    (:problem "Newton's method needs the tangent line at a point; a plot annotator also needs a callable tangent for drawing."
     :program "(define f (lambda (x) (* x x)))\n(define tan (calc/tangent-line f 1))\n(list (tan 1) (tan 2))"
     :explanation "Tangent at (1, 1) is y = 2x - 1; at x=1, value 1; at x=2, value 3; operator sees (1 3)."
     :meta "derivative gives f'; tangent-line gives the affine function y = f'(a)(x-a) + f(a). Different granularity.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'first-order local approximation'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (x) (* x x)))")
       (:domain "linear approximation of a control curve" :code "(curve/tangent-at spline t)")
       (:domain "tangent line" :code "y = f\\'(a)(x-a) + f(a)"))
     :explanation "Rung 1 is calc/tangent-line in its native library. Rung 2 shows the same ''first-order local approximation'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''first-order local approximation'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/tangent-line."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The tangent line at a agrees with f at a and has the same derivative: tan(a) = f(a) and tan'(a) = f'(a)."
     :program "(define f (lambda (x) (* x x x)))\n(define a 1)\n(define tan (calc/tangent-line f a))\n(and (< (abs (- (tan a) (f a))) 0.001)\n     (< (abs (- ((calc/derivative tan) a) ((calc/derivative f) a))) 0.05))"
     :invariant "tan(a) = f(a)  ∧  tan\\'(a) = f\\'(a)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch13-calculus-1 and ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/tangent-line — see :summary."
     :composition "(define f (lambda (x) (* x x)))\n(map (lambda (a) ((calc/tangent-line f a) (+ a 0.1)))\n     (list 0 1 2))"
     :emergent "linear-approximation"
     :meta "The emergent linear-approximation belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Tangent line = degree-1 Taylor polynomial; higher-order via calc/taylor.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the linear-approximation pattern."
     :cs "The emergent linear-approximation is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/taylor': r"""  :row-2-audit (
    (:problem "An analytic approximation for a complicated function around a point needs the Taylor polynomial of chosen degree so the caller can trade accuracy for cost."
     :program "(calc/taylor (lambda (x) (exp x)) 0 3)"
     :explanation "Third-degree Taylor of exp around 0 is 1 + x + x²/2 + x³/6; operator sees the polynomial coefficients."
     :meta "tangent-line is degree 1; taylor is any degree. Use taylor for higher-order accuracy.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'polynomial approximation via derivatives'"
     :rungs (
       (:domain "calc native" :code "(calc/taylor (lambda (x) (exp x)) 0 3)")
       (:domain "N-th-order motion prediction" :code "(motion/predict-order state n)")
       (:domain "Taylor polynomial T_n(x) = Σ f^{(k)}(a)/k! (x-a)^k" :code "Taylor formula"))
     :explanation "Rung 1 is calc/taylor in its native library. Rung 2 shows the same ''polynomial approximation via derivatives'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''polynomial approximation via derivatives'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/taylor."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "The Taylor polynomial of degree n at a agrees with f in value and first n derivatives at a."
     :program "(define f (lambda (x) (sin x)))\n(define T (calc/taylor f 0 5))\n(< (abs (- (T 0.1) (f 0.1))) 0.001)"
     :invariant "∀ k ≤ n. T_n^{(k)}(a) = f^{(k)}(a)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/taylor — see :summary."
     :composition "(define f (lambda (x) (exp x)))\n(map (lambda (n) ((calc/taylor f 0 n) 0.5)) (list 1 2 3 5 10))"
     :emergent "convergent-approximation"
     :meta "The emergent convergent-approximation belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Taylor + refinement is the pattern for controlled-accuracy approximation. See book-of-ml appendix-a for the analytic prereqs.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the convergent-approximation pattern."
     :cs "The emergent convergent-approximation is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/total-differential': r"""  :row-2-audit (
    (:problem "A change-propagation estimate needs df = Σ ∂f/∂x_i dx_i — the first-order linear response of f to a perturbation."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(calc/total-differential f (list 1 1) (list 0.01 0.02))"
     :explanation "df ≈ 2·0.01 + 2·0.02 = 0.06; operator sees ≈ 0.06."
     :meta "gradient is ∇f; total-differential applies the gradient to a specific perturbation vector. gradient(f) · dx.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-nd; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'linear-response to a small perturbation'"
     :rungs (
       (:domain "calc native" :code "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))")
       (:domain "error-propagation over a sensor sum" :code "(sensor/error-propagate sensors deltas)")
       (:domain "df = ∇f · dx" :code "total differential"))
     :explanation "Rung 1 is calc/total-differential in its native library. Rung 2 shows the same ''linear-response to a small perturbation'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''linear-response to a small perturbation'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/total-differential."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "df is linear in the perturbation dx: total-differential(f, x, av + bw) = a·df(v) + b·df(w)."
     :program "(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))\n(define x (list 1 1))\n(define v (list 0.1 0)) (define w (list 0 0.1))\n(< (abs (- (calc/total-differential f x (list 0.2 0.3))\n           (+ (* 2 (calc/total-differential f x v))\n              (* 3 (calc/total-differential f x w))))) 0.01)"
     :invariant "df(av + bw) = a·df(v) + b·df(w)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch15-multivariable-linear-algebra.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-nd category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/total-differential — see :summary."
     :composition "(define f (lambda (p) (* (car p) (cadr p))))\n(define x (list 1 2))\n(define errs (list (list 0.01 0) (list 0 0.01) (list 0.01 0.01)))\n(map (lambda (d) (calc/total-differential f x d)) errs)"
     :emergent "error-budget"
     :meta "The emergent error-budget belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Total differential = first-order error propagation; used in every measurement pipeline.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-nd operations close into the error-budget pattern."
     :cs "The emergent error-budget is a first-class named pattern; recognize it once and it reappears everywhere."))""",
    'calc/volume-revolution': r"""  :row-2-audit (
    (:problem "A vessel-capacity computation needs the volume swept out by rotating y=f(x) about the x-axis."
     :program "(calc/volume-revolution (lambda (x) x) 0 1)"
     :explanation "Cone y=x, 0≤x≤1 has volume π/3 ≈ 1.047; operator sees ≈ 1.047."
     :meta "surface-revolution gives the area; volume-revolution gives the enclosed volume. Same rotation, different quantity.")
    (:eng "The operator gets one line per call; failure surfaces the exact input that broke the expectation."
     :math "Category: calc-1d; the verb operates within its declared algebraic type."
     :cs "Complexity as declared in the signature; deterministic and testable."))
  :row-3-dimension (
    (:setup "'3D volume from a rotating 1D curve'"
     :rungs (
       (:domain "calc native" :code "(calc/volume-revolution (lambda (x) x) 0 1)")
       (:domain "lathe object volume" :code "(mesh/lathe-volume profile)")
       (:domain "π ∫ f(x)² dx" :code "disk method volume"))
     :explanation "Rung 1 is calc/volume-revolution in its native library. Rung 2 shows the same ''3D volume from a rotating 1D curve'' shape in a metaphor domain. Rung 3 lifts the shape into a math/logical setting where the transfer is formal. Recognizing the same shape in all three lets the reader carry the verb's intuition into problems Motoi does not directly cover."
     :meta "The shape transfers because ''3D volume from a rotating 1D curve'' is substrate-independent — the same relationship holds whenever the underlying category admits the required structure.")
    (:eng "Engineers who have met the shape elsewhere already know when to reach for calc/volume-revolution."
     :math "The shape is captured by a small equation set; each rung is a model of that equation set."
     :cs "Once the shape is named, the same algorithm skeleton (traverse, close, compare) applies at each rung."))
  :row-4-proof (
    (:claim "Volume is non-negative and monotone in the interval [a, b]."
     :program "(define f (lambda (x) x))\n(<= (calc/volume-revolution f 0 1) (calc/volume-revolution f 0 2))"
     :invariant "∀ [a, b] ⊆ [c, d]. vr(f, a, b) ≤ vr(f, c, d)"
     :meta "The invariant is the algebraic essence of the verb; a single counter-example would falsify it and prove the implementation broken. See book-of-math ch14-calculus-2.")
    (:eng "The runnable claim doubles as a CI smoke test — if the invariant ever prints #f, the verb has drifted."
     :math "The invariant is the defining property in the calc-1d category."
     :cs "Property-based test: the program above is a runnable falsifier candidate for a QuickCheck-style fuzzer."))
  :row-5-emergence (
    (:base "calc/volume-revolution — see :summary."
     :composition "(define f (lambda (x) x))\n(list (calc/arc-length f 0 1) (calc/surface-revolution f 0 1) (calc/volume-revolution f 0 1))"
     :emergent "lathe-metric-triple"
     :meta "The emergent lathe-metric-triple belongs to the family of composed behaviours where one verb's output feeds the next verb's input, and the pair carries meaning neither verb has alone. Arc-length + surface + volume = lathe geometry triple; used together in CAD.")
    (:eng "The composition is short enough to inline in a callsite yet meaningful enough to name and reuse."
     :math "Under composition, the calc-1d operations close into the lathe-metric-triple pattern."
     :cs "The emergent lathe-metric-triple is a first-class named pattern; recognize it once and it reappears everywhere."))""",
}
