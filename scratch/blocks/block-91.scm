(define (frame t)
  (world
    (background 'black)
    ; building silhouette
    (entity 'rect (at 200 200) (width 120) (height 200) (fill 'darkslategray))
    ; window
    (entity 'rect (at 200 180) (width 40) (height 50) (fill 'yellow) (opacity 0.9))
    ; stars
    (entity 'circle (at 80 60) (radius 2) (fill 'white))
    (entity 'circle (at 140 50) (radius 2) (fill 'white))
    (entity 'circle (at 300 70) (radius 2) (fill 'white))))

(render-at 0.0)
