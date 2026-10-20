(define (frame t)
  (world
    (entity 'rect
            (at 180 140)
            (width 100)
            (height 100)
            (fill 'darkslategray))
    (entity 'circle
            (at 210 160)
            (radius 35)
            (fill 'wheat))))

(render-at 0.0)
