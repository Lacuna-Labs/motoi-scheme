(define (frame t)
  (world
    (entity 'circle
            (at 200 150)
            (radius 50)
            (fill 'white)
            (stroke 'black)
            (stroke-width 3))))

(render-at 0.0)
