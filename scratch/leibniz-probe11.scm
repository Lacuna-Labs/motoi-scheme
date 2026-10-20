;; --- directional derivative: linearity + every documented value ---
(define f (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))))
(define pt (list 1 1))
(define v (list 1 0)) (define w (list 0 1))
(display (list 'Dv (calc/directional-derivative f pt v)
               'Dw (calc/directional-derivative f pt w)
               'D2v3w (calc/directional-derivative f pt (list 2 3))
               'claim 10)) (newline)
(display (list 'doc-2.828 (calc/directional-derivative f (list 1 1) (list (/ 1 (sqrt 2)) (/ 1 (sqrt 2)))))) (newline)
(display (list 'doc-2.0 (calc/directional-derivative f (list 1 0) (list 1 0)))) (newline)
(define g (lambda (p) (* (car p) (cadr p))))
(display (list 'doc-1-1-1.414
  (calc/directional-derivative g (list 1 1) (list 1 0))
  (calc/directional-derivative g (list 1 1) (list 0 1))
  (calc/directional-derivative g (list 1 1) (list (/ 1 (sqrt 2)) (/ 1 (sqrt 2)))))) (newline)
(display (list 'doc-novice-1 (calc/directional-derivative (lambda (p) (+ (car p) (cadr p))) (list 0 0) (list 1 0)))) (newline)
(display (list 'doc-2-4-4.243
  (calc/directional-derivative f (list 1 2) (list 1 0))
  (calc/directional-derivative f (list 1 2) (list 0 1))
  (calc/directional-derivative f (list 1 2) (list (/ 1 (sqrt 2)) (/ 1 (sqrt 2)))))) (newline)
;; --- div(curl F) = 0 ---
(define F (lambda (p) (list (- (cadr p)) (car p))))
(define curlF (lambda (p) (list 0 0 (calc/curl F p))))
(display (list 'div-curl (calc/divergence curlF (list 0.5 0.3)) 'claim 0)) (newline)
(display (list 'div-curl2 (calc/divergence curlF (list 1 1)) 'claim 0)) (newline)
(display (list 'div-doc-0 (calc/divergence (lambda (p) (list (car p) (- (cadr p)))) (list 1 1)))) (newline)
(display (list 'div-doc-2 (calc/divergence (lambda (p) (list (car p) (cadr p))) (list 1 2)))) (newline)
(display (list 'div-doc-0b (calc/divergence (lambda (p) (list (- (cadr p)) (car p))) (list 1 2)))) (newline)
;; --- series ---
(display (list 'harmonic (calc/series-converges? (lambda (n) (/ 1.0 (+ n 1)))) 'claim 'inconclusive)) (newline)
(display (list 'harmonic2 (calc/series-converges? (lambda (n) (/ 1 (+ n 1)))))) (newline)
(display (list 'const1 (calc/series-converges? (lambda (n) 1.0)) 'claim 'diverges)) (newline)
(display (list 'geo (calc/series-converges? (lambda (n) (expt 0.5 n))) 'claim 'converges)) (newline)
(display (list 'inv2n (calc/series-converges? (lambda (n) (/ 1 (* 2 n)))))) (newline)
(display (list 'invnsq (calc/series-converges? (lambda (n) (/ 1.0 (* n n)))))) (newline)
(display (list 'invn (calc/series-converges? (lambda (n) (/ 1.0 n))))) (newline)
;; --- taylor ---
(display (list 'taylor-x2 (calc/taylor (lambda (x) (* x x)) 0 3))) (newline)
(display (list 'taylor-exp (calc/taylor (lambda (x) (exp x)) 0 3))) (newline)
;; --- extrema-1d shape ---
(display (list 'extrema (calc/extrema-1d (lambda (x) (* x x)) 0 1))) (newline)
;; --- riemann with kind ---
(define sq (lambda (x) (* x x)))
(display (list 'riemann (calc/riemann-sum sq 0 1 'mid 1000) 'integral (calc/integral sq 0 1))) (newline)
