(define (frame t)
  (world
    (background 'lightblue)
    ; walls
    (entity 'rect (at 200 180) (width 100) (height 80) (fill 'wheat))
    ; roof
    (entity 'circle (at 200 135) (radius 65) (fill 'maroon))
    ; window
    (entity 'rect (at 170 170) (width 20) (height 20) (fill 'lightyellow) (stroke 'black) (stroke-width 1))
    ; door
    (entity 'rect (at 220 200) (width 25) (height 40) (fill 'saddlebrown))))

(render-at 0.0)
