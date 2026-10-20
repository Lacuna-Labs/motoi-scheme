(define (frame t)
  (world
    (background 'aliceblue)
    ; trunk
    (entity 'rect (at 200 200) (width 20) (height 80) (fill 'saddlebrown))
    ; foliage
    (entity 'circle (at 200 150) (radius 50) (fill 'forestgreen))))

(render-at 0.0)
