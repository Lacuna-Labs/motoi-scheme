(define (frame t)
  (world
    (entity 'rect
            (at 200 150)
            (width 120)
            (height 120)
            (fill 'midnightblue))
    (entity 'circle
            (at 200 150)
            (radius 40)
            (fill 'gold))))

(render-at 0.0)
