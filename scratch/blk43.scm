(define mul-F8
  (lambda (u v)
    ;; (a₀ + a₁α + a₂α²)(b₀ + b₁α + b₂α²)
    ;; Expand, collect terms, reduce using α³ = α + 1
    ;; (Implementation uses convolution + reduction; here we show a case)
    (let ((a0 (car u)) (a1 (cadr u)) (a2 (caddr u))
          (b0 (car v)) (b1 (cadr v)) (b2 (caddr v)))
      ;; Compute product coefficients for degrees 0..5, then reduce
      ;; This is complex; showing the idea:
      (let ((c0 (nt/mod (* a0 b0) 2))
            (c1 (nt/mod (+ (* a0 b1) (* a1 b0)) 2))
            (c2 (nt/mod (+ (* a0 b2) (* a1 b1) (* a2 b0)) 2))
            (c3 (nt/mod (+ (* a1 b2) (* a2 b1)) 2))
            (c4 (nt/mod (* a2 b2) 2)))
        ;; Reduce: α³ = α + 1, α⁴ = α² + α, α⁵ = α³ + α² = α + 1 + α² = α² + α + 1
        (let ((r0 (nt/mod (+ c0 c3 c4) 2))
              (r1 (nt/mod (+ c1 c3 c4) 2))
              (r2 (nt/mod (+ c2 c4) 2)))
          (list r0 r1 r2)))))

(define prod (mul-F8 (list 0 1 0) (list 0 1 0)))

prod

