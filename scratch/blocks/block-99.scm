; Stretch a circle 1.3x wide and 0.6x tall.
(image-width (scale/xy 1.3 0.6 (img/circle 10 'solid 12)))

; A tiny scene: a triangle, a star, and an ellipse in a row.
(image? (beside (img/triangle 18 'solid 6)
                (img/star 12 'solid 2)
                (img/ellipse 20 12 'solid 'white)))
