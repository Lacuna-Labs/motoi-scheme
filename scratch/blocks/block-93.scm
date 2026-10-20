(define (frame t)
  (world
    (background 'white)
    ; far (soft)
    (entity 'circle (at 120 150) (radius 50) (fill 'lightgray) (opacity 0.4))
    ; mid
    (entity 'circle (at 200 150) (radius 50) (fill 'gray) (opacity 0.7))
    ; near (sharp)
    (entity 'circle (at 280 150) (radius 50) (fill 'black) (opacity 1.0))))

(render-at 0.0)
