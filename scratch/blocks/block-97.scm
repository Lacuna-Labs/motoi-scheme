; A solid triangle is a genuine image value.
(image? (img/triangle 20 'solid 6))

; An ellipse's width is just the width you asked for.
(image-width (img/ellipse 24 14 'solid 'white))   ; => 24

; A horizontal line 48 pixels wide really is 48 wide.
(= (image-width (img/line 48 'white)) 48)   ; => #t
