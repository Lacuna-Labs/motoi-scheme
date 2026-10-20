(define (star x y)
  (entity 'circle (at x y) (radius 2) (fill 'white)))

(define (frame t)
  (world
    (background 'navy)
    (star 80 60)
    (star 130 80)
    (star 200 50)
    (star 250 90)
    (star 300 70)
    (star 340 55)
    (star 370 85)))

(render-at 0.0)
