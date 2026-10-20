;; Spawn coins, then visit each and print its position.
(world/reset!)
(world/spawn 'coin-a '((x . 100) (y . 200) (sprite . "coin")))
(world/spawn 'coin-b '((x . 300) (y . 250) (sprite . "coin")))
(world/spawn 'coin-c '((x . 500) (y . 300) (sprite . "coin")))
(world/step)

(world/each
  (lambda (e)
    (let ((x (entity/x e))
          (y (entity/y e)))
      (list x y))))
;; => ((100 200) (300 250) (500 300))
