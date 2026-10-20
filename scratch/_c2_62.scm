(define (f x) (* x x))

(define a 0)
(define b 2)
(define n 4)
(define dx (/ (- b a) n))

(define (left-sum i acc)
  (if (>= i n)
      acc
      (let* ((xi (+ a (* i dx)))
             (height (f xi))
             (area (* height dx)))
        (left-sum (+ i 1) (+ acc area)))))

(define result (left-sum 0 0))

(display "Left Riemann sum, n=4: ")
(display result)
(newline)

(define (f x) (* x x))

(define a 0)
(define b 2)
(define n 4)
(define dx (/ (- b a) n))

(define (right-sum i acc)
  (if (>= i n)
      acc
      (let* ((xi (+ a (* (+ i 1) dx)))
             (height (f xi))
             (area (* height dx)))
        (right-sum (+ i 1) (+ acc area)))))

(define result (right-sum 0 0))

(display "Right Riemann sum, n=4: ")
(display result)
(newline)

(define (f x) (* x x))

(define a 0)
(define b 2)
(define n 4)
(define dx (/ (- b a) n))

(define (midpoint-sum i acc)
  (if (>= i n)
      acc
      (let* ((xi (+ a (* (+ i 0.5) dx)))
             (height (f xi))
             (area (* height dx)))
        (midpoint-sum (+ i 1) (+ acc area)))))

(define result (midpoint-sum 0 0))

(display "Midpoint Riemann sum, n=4: ")
(display result)
(newline)

(define (f x) (* x x))

(define approx (calc/riemann-sum f 0 2 10 'left))

(display "Left Riemann sum, n=10: ")
(display approx)
(newline)

(define (f x) (* x x))

(define approx (calc/riemann-sum f 0 2 10 'right))

(display "Right Riemann sum, n=10: ")
(display approx)
(newline)

(define (f x) (* x x))

(define approx (calc/riemann-sum f 0 2 10 'midpoint))

(display "Midpoint Riemann sum, n=10: ")
(display approx)
(newline)

(define (f x) (* x x))

(define approx (calc/riemann-sum f 0 2 20 'midpoint))

(display "Midpoint Riemann sum, n=20: ")
(display approx)
(newline)

(define (f x) (* x x))

(define approx (calc/riemann-sum f 0 2 50 'midpoint))

(display "Midpoint Riemann sum, n=50: ")
(display approx)
(newline)

(define (f x) (* x x))

(define exact (calc/integral f 0 2))

(display "Exact integral of x^2 from 0 to 2: ")
(display exact)
(newline)

(define (f x) (* x x))

(define bars
  (let* ((a 0)
         (b 2)
         (n 8)
         (dx (/ (- b a) n)))
    (map (lambda (i)
           (let* ((xi (+ a (* (+ i 0.5) dx)))
                  (height (f xi)))
             (list xi height dx)))
         (iota n))))

(define pts
  (apply append
         (map (lambda (bar)
                (let ((x (car bar))
                      (h (cadr bar))
                      (w (caddr bar)))
                  (let ((x0 (- x (/ w 2)))
                        (x1 (+ x (/ w 2))))
                    (list (list x0 0)
                          (list x0 h)
                          (list x1 h)
                          (list x1 0)))))
              bars)))

(define p (plot/scatter pts))

(plot/render-svg p)

(define (f x) (* x x))

(define bars
  (let* ((a 0)
         (b 2)
         (n 20)
         (dx (/ (- b a) n)))
    (map (lambda (i)
           (let* ((xi (+ a (* (+ i 0.5) dx)))
                  (height (f xi)))
             (list xi height dx)))
         (iota n))))

(define pts
  (apply append
         (map (lambda (bar)
                (let ((x (car bar))
                      (h (cadr bar))
                      (w (caddr bar)))
                  (let ((x0 (- x (/ w 2)))
                        (x1 (+ x (/ w 2))))
                    (list (list x0 0)
                          (list x0 h)
                          (list x1 h)
                          (list x1 0)))))
              bars)))

(define p (plot/scatter pts))

(plot/render-svg p)

(define (f x) (geom/sin x))

(define approx (calc/riemann-sum f 0 3.14159 10 'midpoint))

(display "Riemann sum for sin(x) on [0,π], n=10: ")
(display approx)
(newline)

(define (f x) (geom/sin x))

(define bars
  (let* ((a 0)
         (b 3.14159)
         (n 10)
         (dx (/ (- b a) n)))
    (map (lambda (i)
           (let* ((xi (+ a (* (+ i 0.5) dx)))
                  (height (f xi)))
             (list xi height dx)))
         (iota n))))

(define pts
  (apply append
         (map (lambda (bar)
                (let ((x (car bar))
                      (h (cadr bar))
                      (w (caddr bar)))
                  (let ((x0 (- x (/ w 2)))
                        (x1 (+ x (/ w 2))))
                    (list (list x0 0)
                          (list x0 h)
                          (list x1 h)
                          (list x1 0)))))
              bars)))

(define p (plot/scatter pts))

(plot/render-svg p)

(define (f x) (- x 2))

(define approx (calc/riemann-sum f 0 3 10 'midpoint))

(display "Riemann sum for (x-2) on [0,3], n=10: ")
(display approx)
(newline)

(define (v t) (- (* 2 t) 4))

(define displacement (calc/integral v 0 4))

(display "Displacement (signed area): ")
(display displacement)
(newline)

(define (f x) (* x x))

(define (F x) (/ (* x x x) 3))

(define a 0)
(define b 2)

(define by-antiderivative (- (F b) (F a)))

(display "By FTC: F(2) - F(0) = ")
(display by-antiderivative)
(newline)

(define by-integral (calc/integral f a b))

(display "By calc/integral: ")
(display by-integral)
(newline)

(define (f x) (geom/cos x))

(define (F x) (geom/sin x))

(define a 0)
(define b 1.5708)

(define result (- (F b) (F a)))

(display "Integral of cos(x) from 0 to π/2: ")
(display result)
(newline)

(define (f t) (* t t))

(define (A x)
  (calc/integral f 0 x))

(define x0 2)

(define derivative-of-A (calc/derivative A x0))

(define f-at-x0 (f x0))

(display "d/dx ∫₀ˣ t² dt at x=2: ")
(display derivative-of-A)
(newline)

(display "f(2) = 2² = ")
(display f-at-x0)
(newline)

(define (v t) (+ 3 (* -2 t)))

(define (s t)
  (calc/integral v 0 t))

(display "Position at t=0: ")
(display (s 0))
(newline)

(display "Position at t=1: ")
(display (s 1))
(newline)

(display "Position at t=2: ")
(display (s 2))
(newline)

(define (f x) (geom/sin x))

(define (A x) (calc/integral f 0 x))

(define xs (map (lambda (i) (* i 0.314159)) (iota 20)))

(define ys (map A xs))

(define pts (map list xs ys))

(define p (plot/scatter pts))

(plot/render-svg p)

(define (f x)
  (* 2 x (expt (+ (* x x) 1) 5)))

(define approx (calc/integral f 0 1))

(display "Integral by numeric method: ")
(display approx)
(newline)

(define (f x) (geom/cos (* 3 x)))

(define integral (calc/integral f 0 0.5236))

(display "Integral of cos(3x) from 0 to π/6: ")
(display integral)
(newline)

(define (f x)
  (/ x (+ (* x x) 1)))

(define integral (calc/integral f 0 1))

(display "Integral of x/(x²+1) from 0 to 1: ")
(display integral)
(newline)

(define (f x) (exp (* 2 x)))

(define integral (calc/integral f 0 1))

(display "Integral of e^(2x) from 0 to 1: ")
(display integral)
(newline)

(define (f x)
  (* (geom/sin x) (geom/cos x)))

(define integral (calc/integral f 0 1.5708))

(display "Integral of sin(x)cos(x) from 0 to π/2: ")
(display integral)
(newline)

(define (f x)
  (* x (exp x)))

(define integral (calc/integral f 0 1))

(display "Integral of x e^x from 0 to 1: ")
(display integral)
(newline)

(define (f x)
  (* x (geom/sin x)))

(define integral (calc/integral f 0 3.14159))

(display "Integral of x sin(x) from 0 to π: ")
(display integral)
(newline)

(define (f x) (log x))

(define integral (calc/integral f 1 2.71828))

(display "Integral of ln(x) from 1 to e: ")
(display integral)
(newline)

(define (f x)
  (* x x (exp x)))

(define integral (calc/integral f 0 1))

(display "Integral of x² e^x from 0 to 1: ")
(display integral)
(newline)

(define (f x) x)
(define (g x) (* x x))

(define area (calc/integral (lambda (x) (- (f x) (g x))) 0 1))

(display "Area between y=x and y=x² on [0,1]: ")
(display area)
(newline)

(define xs (map (lambda (i) (* i 0.05)) (iota 21)))

(define ys-line (map (lambda (x) x) xs))
(define ys-parabola (map (lambda (x) (* x x)) xs))

(define p (plot/with
            (plot/line xs ys-line)
            (plot/line xs ys-parabola)))

(plot/render-svg p)

(define (f x) (geom/sin x))
(define (g x) (geom/cos x))

(define area (calc/integral (lambda (x) (- (g x) (f x))) 0 0.7854))

(display "Area between cos and sin on [0,π/4]: ")
(display area)
(newline)

(define (f x) (- 4 (* x x)))
(define (g x) (+ (* x x) 2))

(define area (calc/integral (lambda (x) (- (f x) (g x))) -1 1))

(display "Area between 4-x² and x²+2 on [-1,1]: ")
(display area)
(newline)

(define (R x) x)

(define volume (* 3.14159 (calc/integral (lambda (x) (* (R x) (R x))) 0 1)))

(display "Volume of cone (y=x, [0,1]): ")
(display volume)
(newline)

(define (R x) (sqrt x))

(define volume (* 3.14159 (calc/integral (lambda (x) (* (R x) (R x))) 0 4)))

(display "Volume of paraboloid (y=√x, [0,4]): ")
(display volume)
(newline)

(define (R-outer x) x)
(define (R-inner x) (* x x))

(define volume
  (* 3.14159
     (calc/integral
       (lambda (x)
         (- (* (R-outer x) (R-outer x))
            (* (R-inner x) (R-inner x))))
       0 1)))

(display "Washer volume: ")
(display volume)
(newline)

(define (R x) (sqrt (- 1 (* x x))))

(define volume (* 3.14159 (calc/integral (lambda (x) (* (R x) (R x))) -1 1)))

(display "Volume of hemisphere: ")
(display volume)
(newline)

(define (f x) (* x x))

(define (integrand x)
  (let ((dydx (* 2 x)))
    (sqrt (+ 1 (* dydx dydx)))))

(define arc-length (calc/integral integrand 0 1))

(display "Arc length of y=x² on [0,1]: ")
(display arc-length)
(newline)

(define (f x) (geom/sin x))

(define (integrand x)
  (let ((dydx (geom/cos x)))
    (sqrt (+ 1 (* dydx dydx)))))

(define arc-length (calc/integral integrand 0 3.14159))

(display "Arc length of sine wave on [0,π]: ")
(display arc-length)
(newline)

(define (y x) x)

(define (integrand x)
  (let ((dydx 1))
    (* 2 3.14159 (y x) (sqrt (+ 1 (* dydx dydx))))))

(define surface-area (calc/integral integrand 0 1))

(display "Surface area of cone: ")
(display surface-area)
(newline)

(define (f x) (/ 1 (* x x)))

(define (approx-integral b)
  (calc/integral f 1 b))

(display "∫₁¹⁰ 1/x²: ")
(display (approx-integral 10))
(newline)

(display "∫₁¹⁰⁰ 1/x²: ")
(display (approx-integral 100))
(newline)

(display "∫₁¹⁰⁰⁰ 1/x²: ")
(display (approx-integral 1000))
(newline)

(define (f x) (/ 1 x))

(define (approx-integral b)
  (calc/integral f 1 b))

(display "∫₁¹⁰ 1/x: ")
(display (approx-integral 10))
(newline)

(display "∫₁¹⁰⁰ 1/x: ")
(display (approx-integral 100))
(newline)

(display "∫₁¹⁰⁰⁰ 1/x: ")
(display (approx-integral 1000))
(newline)

(define (f x) (/ 1 (sqrt x)))

(define integral (calc/integral f 0.0001 1))

(display "∫₀¹ 1/√x ≈ ")
(display integral)
(newline)

(define (f x) (exp (- (* x x))))

(define integral (calc/integral f -5 5))

(display "∫₋₅⁵ e^(-x²) ≈ ")
(display integral)
(newline)

(define (a n) (/ 1.0 n))

(display "a(1) = ") (display (a 1)) (newline)
(display "a(10) = ") (display (a 10)) (newline)
(display "a(100) = ") (display (a 100)) (newline)
(display "a(1000) = ") (display (a 1000)) (newline)

(define (a n) (expt (+ 1 (/ 1.0 n)) n))

(display "a(10) = ") (display (a 10)) (newline)
(display "a(100) = ") (display (a 100)) (newline)
(display "a(1000) = ") (display (a 1000)) (newline)

(define (a n) (expt 0.5 n))

(display "a(1) = ") (display (a 1)) (newline)
(display "a(5) = ") (display (a 5)) (newline)
(display "a(10) = ") (display (a 10)) (newline)

(define (a n) (expt -1 n))

(display "a(1) = ") (display (a 1)) (newline)
(display "a(2) = ") (display (a 2)) (newline)
(display "a(3) = ") (display (a 3)) (newline)

(define (a n) (/ n (+ n 1.0)))

(display "a(10) = ") (display (a 10)) (newline)
(display "a(100) = ") (display (a 100)) (newline)
(display "a(1000) = ") (display (a 1000)) (newline)

(define terms (map (lambda (n) (list n (/ 1.0 n))) (iota 20 1)))

(define p (plot/scatter terms))

(plot/render-svg p)

(define (partial-sum n)
  (fold + 0 (map (lambda (k) (expt 0.5 k)) (iota n 1))))

(display "S₅ = ") (display (partial-sum 5)) (newline)
(display "S₁₀ = ") (display (partial-sum 10)) (newline)
(display "S₂₀ = ") (display (partial-sum 20)) (newline)

(define (partial-sum n)
  (fold + 0 (map (lambda (k) (/ 1.0 k)) (iota n 1))))

(display "S₁₀ = ") (display (partial-sum 10)) (newline)
(display "S₁₀₀ = ") (display (partial-sum 100)) (newline)
(display "S₁₀₀₀ = ") (display (partial-sum 1000)) (newline)

(define (partial-sum n)
  (fold + 0 (map (lambda (k) (/ (expt -1 (+ k 1)) k)) (iota n 1))))

(display "S₁₀ = ") (display (partial-sum 10)) (newline)
(display "S₁₀₀ = ") (display (partial-sum 100)) (newline)
(display "S₁₀₀₀ = ") (display (partial-sum 1000)) (newline)

(define (partial-sum n)
  (fold + 0 (map (lambda (k) (/ 1.0 (* k k))) (iota n 1))))

(display "S₁₀ = ") (display (partial-sum 10)) (newline)
(display "S₁₀₀ = ") (display (partial-sum 100)) (newline)
(display "S₁₀₀₀ = ") (display (partial-sum 1000)) (newline)

(define (term n)
  (/ (fold * 1 (iota n 1)) (expt n n)))

(display "a₁ = ") (display (term 1)) (newline)
(display "a₅ = ") (display (term 5)) (newline)
(display "a₁₀ = ") (display (term 10)) (newline)

(define (partial-sum n)
  (fold + 0 (map (lambda (k) (expt 0.5 k)) (iota n 1))))

(define pts (map (lambda (n) (list n (partial-sum n))) (iota 20 1)))

(define p (plot/scatter pts))

(plot/render-svg p)

(define (factorial n)
  (if (<= n 1) 1 (* n (factorial (- n 1)))))

(define (taylor-exp x n)
  (fold + 0
        (map (lambda (k) (/ (expt x k) (factorial k)))
             (iota n 0))))

(define x 1.0)

(display "e^1, 5 terms: ") (display (taylor-exp x 5)) (newline)
(display "e^1, 10 terms: ") (display (taylor-exp x 10)) (newline)
(display "e^1, exact: ") (display (exp x)) (newline)

(define (factorial n)
  (if (<= n 1) 1 (* n (factorial (- n 1)))))

(define (taylor-sin x n)
  (fold + 0
        (map (lambda (k)
               (let ((sign (expt -1 k))
                     (pow (expt x (+ (* 2 k) 1)))
                     (fact (factorial (+ (* 2 k) 1))))
                 (/ (* sign pow) fact)))
             (iota n 0))))

(define x 1.0)

(display "sin(1), 3 terms: ") (display (taylor-sin x 3)) (newline)
(display "sin(1), 5 terms: ") (display (taylor-sin x 5)) (newline)
(display "sin(1), exact: ") (display (geom/sin x)) (newline)

(define (factorial n)
  (if (<= n 1) 1 (* n (factorial (- n 1)))))

(define (taylor-cos x n)
  (fold + 0
        (map (lambda (k)
               (let ((sign (expt -1 k))
                     (pow (expt x (* 2 k)))
                     (fact (factorial (* 2 k))))
                 (/ (* sign pow) fact)))
             (iota n 0))))

(define x 1.5708)

(display "cos(π/2), 5 terms: ") (display (taylor-cos x 5)) (newline)
(display "cos(π/2), exact: ") (display (geom/cos x)) (newline)

(define (factorial n)
  (if (<= n 1) 1 (* n (factorial (- n 1)))))

(define (taylor-sin x n)
  (fold + 0
        (map (lambda (k)
               (let ((sign (expt -1 k))
                     (pow (expt x (+ (* 2 k) 1)))
                     (fact (factorial (+ (* 2 k) 1))))
                 (/ (* sign pow) fact)))
             (iota n 0))))

(define xs (map (lambda (i) (* i 0.1)) (iota 61 -30)))

(define ys-exact (map geom/sin xs))
(define ys-3 (map (lambda (x) (taylor-sin x 3)) xs))
(define ys-5 (map (lambda (x) (taylor-sin x 5)) xs))

(define p (plot/with
            (plot/line xs ys-exact)
            (plot/line xs ys-3)
            (plot/line xs ys-5)))

(plot/render-svg p)

(define (taylor-ln x n)
  (fold + 0
        (map (lambda (k)
               (let ((sign (expt -1 (+ k 1)))
                     (pow (expt x k)))
                 (/ (* sign pow) k)))
             (iota n 1))))

(define x 0.5)

(display "ln(1.5), 5 terms: ") (display (taylor-ln x 5)) (newline)
(display "ln(1.5), 10 terms: ") (display (taylor-ln x 10)) (newline)
(display "ln(1.5), exact: ") (display (log 1.5)) (newline)

(define (taylor-ln x n)
  (fold + 0
        (map (lambda (k)
               (let ((sign (expt -1 (+ k 1)))
                     (pow (expt x k)))
                 (/ (* sign pow) k)))
             (iota n 1))))

(define x 1.5)

(display "ln(2.5), 10 terms: ") (display (taylor-ln x 10)) (newline)
(display "ln(2.5), 20 terms: ") (display (taylor-ln x 20)) (newline)
