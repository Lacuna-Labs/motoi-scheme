;; Spawn two coins and compute the distance between them.
(world/reset!)
(define coin-a (world/spawn 'coin-a '((x . 200) (y . 300) (sprite . "coin"))))
(define coin-b (world/spawn 'coin-b '((x . 600) (y . 300) (sprite . "coin"))))
(world/step)

(entity/distance coin-a coin-b)  ;; => 400.0
