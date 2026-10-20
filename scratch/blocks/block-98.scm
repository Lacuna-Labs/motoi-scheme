; A regular hexagon of radius 20.
(image-width (img/regular-polygon 20 6 'solid 'green))

; A 5-pointed star: its bounding box is 2r + 1.
(= (image-width (img/star 15 'solid 2)) (+ (* 2 15) 1))   ; => #t

; A star-polygon with an explicit spoke count.
(image-width (img/star-poly 10 5 'solid 'white))
