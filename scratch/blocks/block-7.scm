;; Spawn three coins stacked vertically.
(world/reset!)
(world/spawn 'coin-top    '((x . 400) (y . 150) (sprite . "coin")))
(world/spawn 'coin-middle '((x . 400) (y . 300) (sprite . "coin")))
(world/spawn 'coin-bottom '((x . 400) (y . 450) (sprite . "coin")))
(world/step)
