(define (row x y n)
  (if (zero? n)
      '()
      (cons (entity 'circle (at x y) (radius 5) (fill 'slateblue))
            (row (+ x 20) y (- n 1)))))

(define (grid x y cols rows)
  (if (zero? rows)
      '()
      (append (row x y cols)
              (grid x (+ y 20) cols (- rows 1)))))

(define (frame t)
  (apply world (grid 100 80 10 6)))

(render-at 0.0)
