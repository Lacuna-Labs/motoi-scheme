;; Spawn coins approximating a Sierpiński triangle (3 levels).
(world/reset!)
(define (draw-triangle cx cy size level)
  (when (> level 0)
    (let* ((half-size (/ size 2))
           (h (* size 0.866)))
      (world/spawn (string->symbol (string-append "t-" (number->string level) "-" (number->string cx) "-" (number->string cy)))
                   `((x . ,cx) (y . ,cy) (sprite . "coin")))
      (draw-triangle cx (- cy (/ h 2)) half-size (- level 1))
      (draw-triangle (- cx (/ size 4)) (+ cy (/ h 4)) half-size (- level 1))
      (draw-triangle (+ cx (/ size 4)) (+ cy (/ h 4)) half-size (- level 1)))))

(draw-triangle 400 300 200 3)
(world/step)
