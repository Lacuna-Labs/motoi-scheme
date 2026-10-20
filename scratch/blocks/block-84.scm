(define (frame t)
  (world
    ; sky gradient (approximated)
    (entity 'rect (at 200 80) (width 400) (height 160) (fill 'orange))
    (entity 'rect (at 200 200) (width 400) (height 160) (fill 'coral))
    ; sun
    (entity 'circle (at 200 160) (radius 50) (fill 'yellow) (opacity 0.9))
    ; ground
    (entity 'rect (at 200 270) (width 400) (height 60) (fill 'saddlebrown))
    ; tree silhouette
    (entity 'rect (at 320 240) (width 12) (height 60) (fill 'black))
    (entity 'circle (at 320 210) (radius 30) (fill 'black))))

(render-at 0.0)
