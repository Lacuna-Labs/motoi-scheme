(define (frame t)
  (world
    (background 'lightblue)
    ; background: distant mountains
    (entity 'circle (at 200 160) (radius 90) (fill 'gray) (opacity 0.5))
    ; midground: tree
    (entity 'rect (at 280 200) (width 10) (height 50) (fill 'saddlebrown))
    (entity 'circle (at 280 175) (radius 25) (fill 'green))
    ; foreground: large rock
    (entity 'circle (at 120 230) (radius 40) (fill 'darkslategray))))

(render-at 0.0)
