(define (dots x y n)
  (if (zero? n)
      '()
      (cons (entity 'circle (at x y) (radius 6) (fill 'teal))
            (dots (+ x 25) y (- n 1)))))

(define (frame t)
  (apply world (dots 80 120 8)))

(render-at 0.0)
