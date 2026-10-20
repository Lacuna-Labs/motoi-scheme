(define (frame t)
  (world
    ; sky
    (entity 'rect (at 200 100) (width 400) (height 200) (fill 'skyblue))
    ; ground
    (entity 'rect (at 200 250) (width 400) (height 100) (fill 'tan))))

(render-at 0.0)
