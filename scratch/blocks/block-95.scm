(define (frame t)
  (world
    (background 'aliceblue)
    ; juggler (simplified)
    (entity 'circle (at 200 230) (radius 15) (fill 'peachpuff))
    (entity 'rect (at 200 260) (width 30) (height 40) (fill 'blue))
    ; balls in air
    (entity 'circle (at 160 120) (radius 10) (fill 'red))
    (entity 'circle (at 200 80) (radius 10) (fill 'green))
    (entity 'circle (at 240 110) (radius 10) (fill 'yellow))))

(render-at 0.0)
