(define (frame t)
  (world
    (background 'white)
    ; face
    (entity 'circle (at 200 150) (radius 80) (fill 'none) (stroke 'black) (stroke-width 2))
    ; 12 o'clock tick
    (entity 'rect (at 200 75) (width 3) (height 10) (fill 'black))
    ; 3 o'clock tick
    (entity 'rect (at 275 150) (width 10) (height 3) (fill 'black))
    ; 6 o'clock tick
    (entity 'rect (at 200 225) (width 3) (height 10) (fill 'black))
    ; 9 o'clock tick
    (entity 'rect (at 125 150) (width 10) (height 3) (fill 'black))
    ; hour hand (pointing ~3)
    (entity 'rect (at 235 150) (width 30) (height 4) (fill 'black))
    ; minute hand (pointing ~12)
    (entity 'rect (at 200 110) (width 4) (height 40) (fill 'black))))

(render-at 0.0)
