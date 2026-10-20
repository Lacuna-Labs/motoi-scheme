;; Spawn several coins and find the nearest to a point.
(world/reset!)
(world/spawn 'coin-a '((x . 100) (y . 100) (sprite . "coin")))
(world/spawn 'coin-b '((x . 400) (y . 300) (sprite . "coin")))
(world/spawn 'coin-c '((x . 700) (y . 500) (sprite . "coin")))
(world/step)

(world/nearest 350 280)  ;; => coin-b
