(define (frame t)
  (world
    (background 'skyblue)
    ; sky ball
    (entity 'circle (at 200 120) (radius 30) (fill 'white))
    ; horizon
    (entity 'rect (at 200 180) (width 400) (height 4) (fill 'navy))
    ; water ball (reflection)
    (entity 'circle (at 200 240) (radius 30) (fill 'white) (opacity 0.5))))

(render-at 0.0)
