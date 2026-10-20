(define (frame t)
  (world
    (background 'midnightblue)
    ; pole
    (entity 'rect (at 200 200) (width 8) (height 120) (fill 'gray))
    ; base
    (entity 'rect (at 200 260) (width 40) (height 10) (fill 'dimgray))
    ; bulb
    (entity 'circle (at 200 145) (radius 20) (fill 'yellow) (opacity 0.9))))

(render-at 0.0)
