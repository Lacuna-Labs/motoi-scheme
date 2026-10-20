;; Spawn three coins, then despawn the middle one.
(world/reset!)
(define coin-a (world/spawn 'coin-a '((x . 200) (y . 300) (sprite . "coin"))))
(define coin-b (world/spawn 'coin-b '((x . 400) (y . 300) (sprite . "coin"))))
(define coin-c (world/spawn 'coin-c '((x . 600) (y . 300) (sprite . "coin"))))
(world/step)

(entity/despawn! coin-b)
(world/step)
