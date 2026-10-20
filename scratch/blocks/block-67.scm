(define (stars n)
  (if (zero? n)
      '()
      (cons (entity 'circle
                    (at (+ 50 (* n 40)) (+ 60 (* (modulo n 3) 20)))
                    (radius 2)
                    (fill 'white))
            (stars (- n 1)))))

(define (frame t)
  (apply world
         (cons (background 'midnightblue)
               (stars 10))))

(render-at 0.0)
