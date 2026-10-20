(define (tree x y)
  (list
    (entity 'rect (at x (+ y 40)) (width 12) (height 50) (fill 'saddlebrown))
    (entity 'circle (at x y) (radius 30) (fill 'darkgreen))))

(define (cloud x y)
  (list
    (entity 'circle (at (- x 15) y) (radius 18) (fill 'white) (opacity 0.8))
    (entity 'circle (at x y) (radius 22) (fill 'white) (opacity 0.8))
    (entity 'circle (at (+ x 15) y) (radius 18) (fill 'white) (opacity 0.8))))

(define (frame t)
  (apply world
         (append
           (list (background 'skyblue))
           ; sky layer
           (cloud 100 60)
           (cloud 280 50)
           ; distant mountains
           (list (entity 'circle (at 150 170) (radius 70) (fill 'gray) (opacity 0.5))
                 (entity 'circle (at 250 165) (radius 80) (fill 'slategray) (opacity 0.6)))
           ; ground
           (list (entity 'rect (at 200 250) (width 400) (height 100) (fill 'green)))
           ; trees
           (tree 120 210)
           (tree 180 215)
           (tree 310 205)
           ; house
           (list (entity 'rect (at 240 230) (width 60) (height 50) (fill 'beige))
                 (entity 'circle (at 240 205) (radius 35) (fill 'darkred))
                 (entity 'rect (at 240 245) (width 18) (height 30) (fill 'brown))))))

(render-at 0.0)
