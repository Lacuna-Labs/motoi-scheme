(define (frame t)
  (world
    (background 'ivory)
    (entity 'circle
            (at 200 150)
            (radius 50)
            (fill 'darkgreen))))

(render-at 0.0)
