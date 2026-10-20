(define (posts-varied x heights)
  (if (null? heights)
      '()
      (cons (entity 'rect
                    (at x 200)
                    (width 10)
                    (height (car heights))
                    (fill 'sienna))
            (posts-varied (+ x 30) (cdr heights)))))

(define (frame t)
  (apply world
         (cons (background 'lightyellow)
               (posts-varied 80 '(60 70 65 80 75 70 85)))))

(render-at 0.0)
