(define (frame t)
  (world
    (background 'lightgreen)
    ; petals
    (entity 'circle (at 200 130) (radius 20) (fill 'pink))
    (entity 'circle (at 220 145) (radius 20) (fill 'pink))
    (entity 'circle (at 215 165) (radius 20) (fill 'pink))
    (entity 'circle (at 185 165) (radius 20) (fill 'pink))
    (entity 'circle (at 180 145) (radius 20) (fill 'pink))
    ; center
    (entity 'circle (at 200 150) (radius 15) (fill 'gold))))

(render-at 0.0)
