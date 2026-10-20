(define (dot x y)
  (entity 'circle
          (at x y)
          (radius 8)
          (fill 'gold)))

(define (frame t)
  (world
    (dot 100 100)
    (dot 120 100)
    (dot 140 100)
    (dot 160 100)
    (dot 180 100)))

(render-at 0.0)
