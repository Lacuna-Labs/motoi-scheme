(define (posts x n)
  (if (zero? n)
      '()
      (cons (entity 'rect (at x 200) (width 10) (height 70) (fill 'brown))
            (posts (+ x 35) (- n 1)))))

(define (frame t)
  (apply world
         (cons (background 'skyblue)
               (posts 60 10))))

(render-at 0.0)
