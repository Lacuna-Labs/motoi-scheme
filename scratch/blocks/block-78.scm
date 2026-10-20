(define (frame t)
  (world
    (background 'beige)
    ; row of plants
    (entity 'circle (at 100 180) (radius 15) (fill 'green))
    (entity 'circle (at 140 180) (radius 15) (fill 'green))
    (entity 'circle (at 180 180) (radius 15) (fill 'green))
    (entity 'circle (at 220 180) (radius 15) (fill 'green))
    (entity 'circle (at 260 180) (radius 15) (fill 'green))
    ; flowers on top
    (entity 'circle (at 100 165) (radius 6) (fill 'red))
    (entity 'circle (at 140 165) (radius 6) (fill 'yellow))
    (entity 'circle (at 180 165) (radius 6) (fill 'pink))
    (entity 'circle (at 220 165) (radius 6) (fill 'orange))
    (entity 'circle (at 260 165) (radius 6) (fill 'violet))))

(render-at 0.0)
