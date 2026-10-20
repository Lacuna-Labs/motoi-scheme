(define (frame t)
  (world
    (background 'ivory)
    (entity 'circle (at 200 150) (radius 6) (fill 'black))
    (entity 'circle (at 260 150) (radius 6) (fill 'black))
    (entity 'circle (at 140 150) (radius 6) (fill 'black))
    (entity 'circle (at 200 90) (radius 6) (fill 'black))
    (entity 'circle (at 200 210) (radius 6) (fill 'black))))

(render-at 0.0)
