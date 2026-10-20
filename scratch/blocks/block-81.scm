(define (frame t)
  (world
    (background 'white)
    (entity 'circle (at 200 150) (radius 90) (fill 'black))
    (entity 'circle (at 200 150) (radius 70) (fill 'white))
    (entity 'circle (at 200 150) (radius 50) (fill 'black))
    (entity 'circle (at 200 150) (radius 30) (fill 'white))
    (entity 'circle (at 200 150) (radius 10) (fill 'black))))

(render-at 0.0)
