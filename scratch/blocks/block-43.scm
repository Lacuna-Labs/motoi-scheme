;; Spawn coins, take a snapshot, change the world, restore.
(world/reset!)
(define coin-a (world/spawn 'coin-a '((x . 200) (y . 300) (sprite . "coin"))))
(world/step)

(define snapshot (world/snapshot))

(entity/set-pos! coin-a 600 300)
(world/step)

(world/restore! snapshot)
(world/step)
