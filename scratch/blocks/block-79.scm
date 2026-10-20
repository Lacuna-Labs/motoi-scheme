(define (frame t)
  (world
    (entity 'rect (at 60 150) (width 40) (height 300) (fill 'darkblue))
    (entity 'rect (at 100 150) (width 40) (height 300) (fill 'blue))
    (entity 'rect (at 140 150) (width 40) (height 300) (fill 'steelblue))
    (entity 'rect (at 180 150) (width 40) (height 300) (fill 'skyblue))
    (entity 'rect (at 220 150) (width 40) (height 300) (fill 'lightblue))
    (entity 'rect (at 260 150) (width 40) (height 300) (fill 'lightcyan))
    (entity 'rect (at 300 150) (width 40) (height 300) (fill 'white))))

(render-at 0.0)
