(define (frame t)
  (world
    (background 'skyblue)
    ; far hill
    (entity 'circle (at 200 180) (radius 80) (fill 'green) (opacity 0.7))
    ; near hill
    (entity 'circle (at 200 220) (radius 100) (fill 'darkgreen))))

(render-at 0.0)
