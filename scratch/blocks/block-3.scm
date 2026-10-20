;; Spawn a single entity at the origin.
(world/reset!)
(world/spawn 'coin '((x . 400) (y . 300) (sprite . "coin")))
(world/step)
