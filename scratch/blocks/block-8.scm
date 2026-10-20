;; Spawn coins along a diagonal.
(world/reset!)
(world/spawn 'coin-a '((x . 100) (y . 100) (sprite . "coin")))
(world/spawn 'coin-b '((x . 250) (y . 200) (sprite . "coin")))
(world/spawn 'coin-c '((x . 400) (y . 300) (sprite . "coin")))
(world/spawn 'coin-d '((x . 550) (y . 400) (sprite . "coin")))
(world/spawn 'coin-e '((x . 700) (y . 500) (sprite . "coin")))
(world/step)
