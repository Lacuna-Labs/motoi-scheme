(define (frame t)
  (world
    (entity 'circle
            (at 200 150)
            (radius 50)
            (fill 'none)
            (stroke 'crimson)
            (stroke-width 2))))

(render-at 0.0)
