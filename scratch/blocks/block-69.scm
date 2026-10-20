(define (frame t)
  (world
    (background 'lightblue)
    ; walls
    (entity 'rect (at 200 180) (width 100) (height 80) (fill 'beige))
    ; roof
    (entity 'circle (at 200 140) (radius 60) (fill 'darkred) (opacity 1.0))
    ; door
    (entity 'rect (at 200 210) (width 30) (height 50) (fill 'brown))))

(render-at 0.0)
