;; Spawn three coins in a row.
(world/reset!)
(world/spawn 'coin-left   '((x . 200) (y . 300) (sprite . "coin")))
(world/spawn 'coin-center '((x . 400) (y . 300) (sprite . "coin")))
(world/spawn 'coin-right  '((x . 600) (y . 300) (sprite . "coin")))
(world/step)
