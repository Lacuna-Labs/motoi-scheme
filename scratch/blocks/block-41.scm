;; Spawn coins, then despawn any with x > 500.
(world/reset!)
(world/spawn 'coin-a '((x . 200) (y . 300) (sprite . "coin")))
(world/spawn 'coin-b '((x . 400) (y . 300) (sprite . "coin")))
(world/spawn 'coin-c '((x . 600) (y . 300) (sprite . "coin")))
(world/spawn 'coin-d '((x . 700) (y . 300) (sprite . "coin")))
(world/step)

(world/each
  (lambda (e)
    (when (> (entity/x e) 500)
      (entity/despawn! e))))
(world/step)
