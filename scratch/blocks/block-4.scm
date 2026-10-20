;; Spawn a coin and read its position.
(world/reset!)
(define coin (world/spawn 'coin '((x . 400) (y . 300) (sprite . "coin"))))
(world/step)

(entity/pos coin)  ;; => (400 . 300)
(entity/x coin)    ;; => 400
(entity/y coin)    ;; => 300
