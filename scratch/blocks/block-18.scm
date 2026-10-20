;; Spawn two coins diagonally and measure the distance.
(world/reset!)
(define coin-a (world/spawn 'coin-a '((x . 100) (y . 100) (sprite . "coin"))))
(define coin-b (world/spawn 'coin-b '((x . 400) (y . 400) (sprite . "coin"))))
(world/step)

(entity/distance coin-a coin-b)  ;; => ~424.26 (sqrt of 300^2 + 300^2)
