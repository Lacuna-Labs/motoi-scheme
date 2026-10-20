(define (frame t)
  (world
    (entity 'circle (at 150 150) (radius 60) (fill 'lightblue))
    (entity 'circle (at 270 150) (radius 40) (fill 'lightblue))
    (entity 'circle (at 360 150) (radius 25) (fill 'lightblue))))

(render-at 0.0)
