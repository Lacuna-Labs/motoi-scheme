(define (frame t)
  (world
    (background 'lightcyan)
    ; far mountain
    (entity 'circle (at 200 160) (radius 100) (fill 'gray) (opacity 0.4))
    ; mid mountain
    (entity 'circle (at 200 180) (radius 90) (fill 'slategray) (opacity 0.6))
    ; near mountain
    (entity 'circle (at 200 200) (radius 80) (fill 'darkslategray) (opacity 0.9))))

(render-at 0.0)
