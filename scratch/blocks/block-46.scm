(define (frame t)
  (world
    (entity 'circle
            (at 100 100)
            (radius 30)
            (fill 'gold))
    (entity 'circle
            (at 220 100)
            (radius 30)
            (fill 'tomato))))

(render-at 0.0)
