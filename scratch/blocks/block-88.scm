(define (row x y n color1 color2)
  (if (zero? n)
      '()
      (cons (entity 'rect (at x y) (width 25) (height 25) (fill color1))
            (row (+ x 25) y (- n 1) color2 color1))))

(define (board x y cols rows)
  (if (zero? rows)
      '()
      (append (row x y cols (if (even? rows) 'black 'white)
                            (if (even? rows) 'white 'black))
              (board x (+ y 25) cols (- rows 1)))))

(define (frame t)
  (apply world
         (cons (background 'beige)
               (board 80 80 8 8))))

(render-at 0.0)
