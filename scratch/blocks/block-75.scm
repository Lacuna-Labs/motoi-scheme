(define (post x)
  (entity 'rect (at x 200) (width 8) (height 60) (fill 'saddlebrown)))

(define (frame t)
  (world
    (background 'lightblue)
    (post 80)
    (post 120)
    (post 160)
    (post 200)
    (post 240)
    (post 280)
    (post 320)))

(render-at 0.0)
