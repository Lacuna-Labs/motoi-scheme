;; Spawn coins and count them.
(world/reset!)
(let loop ((i 0))
  (when (< i 7)
    (world/spawn (string->symbol (string-append "coin-" (number->string i)))
                 `((x . ,(+ 100 (* i 100))) (y . 300) (sprite . "coin")))
    (loop (+ i 1))))
(world/step)

(world/count)  ;; => 7
