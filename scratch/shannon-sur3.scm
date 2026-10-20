(define (dc a b c) (game/surreal-eq? (game/surreal-mul a (game/surreal-add b c)) (game/surreal-add (game/surreal-mul a b) (game/surreal-mul a c))))
(display (dc (game/surreal-lit 2) (game/surreal-lit 3) (game/surreal-lit 4)))
(newline)
