(define (leaf x y)
  (entity 'circle (at x y) (radius 8) (fill 'gold) (opacity 0.8)))

(define (frame t)
  (world
    (background 'wheat)
    (leaf 100 80)
    (leaf 150 130)
    (leaf 200 100)
    (leaf 250 160)
    (leaf 300 110)))

(render-at 0.0)
