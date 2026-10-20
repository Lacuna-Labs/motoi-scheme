;; Spawn coins with custom "value" property, then read it.
(world/reset!)
(define coin-small (world/spawn 'coin-small '((x . 200) (y . 300) (sprite . "coin") (value . 1))))
(define coin-large (world/spawn 'coin-large '((x . 600) (y . 300) (sprite . "coin") (value . 10))))
(world/step)

(entity/get coin-small 'value)  ;; => 1
(entity/get coin-large 'value)  ;; => 10
