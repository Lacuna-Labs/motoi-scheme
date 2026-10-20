(define (frame t)
  (world
    (background 'lightyellow)
    (entity 'circle (at 160 150) (radius 40) (fill 'orange))
    (entity 'circle (at 200 150) (radius 40) (fill 'red))
    (entity 'circle (at 240 150) (radius 40) (fill 'purple))))

(render-at 0.0)
