(define (frame t)
  (world
    (background 'lightgray)
    (entity 'rect (at 200 220) (width 160) (height 80) (fill 'saddlebrown))
    (entity 'circle (at 200 180) (radius 30) (fill 'peachpuff))
    (entity 'circle (at 185 175) (radius 5) (fill 'black))
    (entity 'circle (at 215 175) (radius 5) (fill 'black))))

(render-at 0.0)
