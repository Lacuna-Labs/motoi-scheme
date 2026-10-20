(define (frame t)
  (world
    (background 'white)
    (entity 'rect (at 100 100) (width 80) (height 80) (fill 'red))
    (entity 'circle (at 200 150) (radius 60) (fill 'blue) (opacity 0.7))
    (entity 'rect (at 300 200) (width 100) (height 60) (fill 'yellow))
    (entity 'circle (at 150 220) (radius 40) (fill 'green) (opacity 0.8))))

(render-at 0.0)
