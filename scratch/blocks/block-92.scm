(define (frame t)
  (world
    (background 'linen)
    ; table
    (entity 'rect (at 200 240) (width 300) (height 80) (fill 'saddlebrown))
    ; bowl
    (entity 'circle (at 150 220) (radius 30) (fill 'white) (stroke 'black) (stroke-width 1))
    ; fruit
    (entity 'circle (at 150 210) (radius 12) (fill 'red))
    ; bottle
    (entity 'rect (at 250 215) (width 20) (height 50) (fill 'darkgreen))
    (entity 'circle (at 250 192) (radius 8) (fill 'darkgreen))))

(render-at 0.0)
