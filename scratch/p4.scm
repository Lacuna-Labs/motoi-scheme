(display "norm D3 {id}: ") (display (alg/normalizer (alg/dihedral 3) '((rot 0)))) (newline)
(display "norm D3 rotsub: ") (display (alg/normalizer (alg/dihedral 3) (alg/subgroup (alg/dihedral 3) '((rot 1))))) (newline)
(display "action single: ") (display (alg/action (alg/cyclic 6) 2 (lambda (g x) (modulo (+ g x) 6)))) (newline)
