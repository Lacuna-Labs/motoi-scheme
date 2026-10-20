;; Spawn a coin, then move it to the right.
(world/reset!)
(define coin (world/spawn 'coin '((x . 200) (y . 300) (sprite . "coin"))))
(world/step)

(entity/set-pos! coin 600 300)
(world/step)
