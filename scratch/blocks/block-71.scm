(define (frame t)
  (world
    (background 'white)
    ; shadow
    (entity 'circle (at 210 240) (radius 40) (fill 'black) (opacity 0.2))
    ; ball
    (entity 'circle (at 200 180) (radius 40) (fill 'coral))))

(render-at 0.0)
