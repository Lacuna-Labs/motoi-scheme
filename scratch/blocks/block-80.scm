(define (frame t)
  (world
    (background 'black)
    (entity 'circle (at 200 150) (radius 100) (fill 'darkred))
    (entity 'circle (at 200 150) (radius 75) (fill 'red))
    (entity 'circle (at 200 150) (radius 50) (fill 'orange))
    (entity 'circle (at 200 150) (radius 25) (fill 'yellow))))

(render-at 0.0)
