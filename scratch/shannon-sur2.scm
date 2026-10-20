(define (distributivity-check a b c)
  ;; a · (b + c) = a·b + a·c
  (game/surreal-eq? (game/surreal-mul a (game/surreal-add b c))
                    (game/surreal-add (game/surreal-mul a b) (game/surreal-mul a c))))
(distributivity-check (game/surreal-lit 2) (game/surreal-lit 3) (game/surreal-lit 4))
