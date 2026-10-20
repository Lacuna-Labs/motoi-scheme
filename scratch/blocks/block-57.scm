(define (frame t)
  (world
    (entity 'rect
            (at 200 150)
            (width 80)
            (height 40)
            (fill 'coral)
            (rotate 0.25)))) ; radians

(render-at 0.0)
