(define (frame t)
  (world
    (entity 'circle (at 180 150) (radius 50) (fill 'red) (opacity 0.6))
    (entity 'circle (at 220 150) (radius 50) (fill 'blue) (opacity 0.6))))

(render-at 0.0)
