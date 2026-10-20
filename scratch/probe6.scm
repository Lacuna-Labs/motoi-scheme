(display (list 'interior-tri (topo/interior (topo/complex '((a b c)))))) (newline)
(display (list 'interior-disc (topo/interior (topo/complex '((a b c) (a c d)))))) (newline)
(display (list 'interior-edge (topo/interior (topo/complex '((a b)))))) (newline)
(display (list 'interior-sphere (topo/interior (topo/sphere 2)))) (newline)
