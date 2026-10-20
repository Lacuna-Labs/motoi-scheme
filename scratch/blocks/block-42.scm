;; Spawn coins in a specific pattern and get the world hash.
(world/reset!)
(world/spawn 'coin-a '((x . 100) (y . 200) (sprite . "coin")))
(world/spawn 'coin-b '((x . 300) (y . 300) (sprite . "coin")))
(world/spawn 'coin-c '((x . 500) (y . 400) (sprite . "coin")))
(world/step)

(world/hash)  ;; => a deterministic integer
