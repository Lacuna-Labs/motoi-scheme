(define (frame t)
  (world
    (entity 'circle (at 160 140) (radius 20) (fill 'orchid))
    (entity 'circle (at 200 140) (radius 20) (fill 'orchid))
    (entity 'circle (at 240 140) (radius 20) (fill 'orchid))
    (entity 'circle (at 180 170) (radius 20) (fill 'orchid))
    (entity 'circle (at 220 170) (radius 20) (fill 'orchid))))

(render-at 0.0)
