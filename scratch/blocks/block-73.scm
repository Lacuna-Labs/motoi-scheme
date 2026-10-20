(define (frame t)
  (world
    (background 'lightgreen)
    ; water
    (entity 'circle (at 180 180) (radius 70) (fill 'steelblue) (opacity 0.7))
    (entity 'circle (at 220 180) (radius 70) (fill 'steelblue) (opacity 0.7))))

(render-at 0.0)
