(define (tree x y)
  (list
    (entity 'rect (at x (+ y 50)) (width 15) (height 60) (fill 'saddlebrown))
    (entity 'circle (at x y) (radius 40) (fill 'green))))

(define (frame t)
  (apply world
         (cons (background 'lightcyan)
               (append (tree 120 140)
                       (tree 200 150)
                       (tree 280 145)))))

(render-at 0.0)
