;; Scene: Astronaut in Space
;; Author: Motoi Cart Maker 1 (Scenes) · 2026-07-19
;; What it draws: An astronaut floating in space — round helmet with a reflective visor, white spacesuit with life-support box, backpack, a distant ringed planet, a small moon, and a scatter of stars.
;; Verbs used: set-mode, clear, set-color, rect-fill, filled-rectangle, rectangle, draw-rect, disc, circle, line, pset, pixel, begin-frame, end-frame, render

;; Space is easy — mostly it's just black with dots. The astronaut
;; is where the work goes. Helmet first, then suit, then details.
;; The visor gets a highlight so it looks like glass, not paint.

(set-mode 80 80)
(begin-frame)

;; --- space (deep black background) ------------------------------
(set-color 'black)
(rect-fill 0 0 80 80)

;; --- distant stars (a hundred pixels wouldn't fit; twenty will) --
(set-color 'white)
(pset 4 6)
(pset 12 3)
(pset 22 10)
(pset 30 4)
(pset 44 14)
(pset 58 5)
(pset 66 12)
(pset 76 7)
(pset 8 22)
(pset 72 24)
(pset 6 55)
(pset 78 60)
(pset 14 70)
(pset 68 74)
;; brighter stars — two adjacent pixels
(pixel 34 22)
(pixel 34 23)
(pixel 74 40)
(pixel 74 41)
(pixel 4 40)
(pixel 4 41)

;; --- distant planet (Saturn-ish, upper right) -------------------
(set-color 'sienna)
(disc 62 22 8)
(set-color 'coral)
(disc 62 22 6)
(set-color 'gold)
(disc 62 22 3)
;; rings — draw two thin horizontal ellipses via lines. A ring
;; that circles a planet in 2D reads as an oval-ish line across.
(set-color 'peachpuff)
(line 50 22 74 22)
(line 51 20 73 20)
(line 51 24 73 24)
;; planet occludes the middle of the ring — redraw the planet on top
(set-color 'sienna)
(disc 62 22 8)
(set-color 'coral)
(disc 62 22 6)
(set-color 'gold)
(disc 62 22 3)
;; ring parts in front of planet, above and below
(set-color 'peachpuff)
(pset 60 22)
(pset 64 22)

;; --- small moon (lower left) ------------------------------------
(set-color 'slategray)
(disc 12 60 4)
(set-color 'white)
(disc 11 59 2)
;; craters
(set-color 'slategray)
(pset 13 60)
(pset 12 62)

;; --- astronaut ---------------------------------------------------
;; The astronaut hangs center-frame, tilted slightly.
;; center of body ~ (40, 44)

;; Backpack — draw first so suit overlaps it
(set-color 'slategray)
(filled-rectangle 32 44 4 14)   ; left backpack strap side
(filled-rectangle 44 44 4 14)   ; right side
(set-color 'saddlebrown)
(rect-fill 34 42 12 4)          ; top of backpack peeking above shoulders

;; Suit body — a rounded torso
(set-color 'white)
(disc 40 50 10)
(rect-fill 32 44 16 12)

;; Arms — two segments each
(set-color 'white)
(line 32 46 26 52)
(line 33 47 27 53)
(line 26 52 24 60)
(line 27 53 25 61)
(line 48 46 54 52)
(line 47 47 53 53)
(line 54 52 56 60)
(line 53 53 55 61)

;; Gloves
(set-color 'crimson)
(disc 24 61 3)
(disc 56 61 3)

;; Legs
(set-color 'white)
(rect-fill 34 56 4 12)
(rect-fill 42 56 4 12)
;; boots
(set-color 'saddlebrown)
(rect-fill 33 66 6 3)
(rect-fill 41 66 6 3)

;; Helmet — big white ring
(set-color 'white)
(disc 40 32 9)
;; Visor — dark gold reflection
(set-color 'navy)
(disc 40 32 6)
;; Visor highlight — a bright arc suggests glass
(set-color 'skyblue)
(disc 38 30 2)
(set-color 'white)
(pixel 37 29)
(pixel 42 34)

;; Helmet rim
(set-color 'slategray)
(circle 40 32 9)
(circle 40 32 8)

;; Life-support box on the chest — a small rect with two lights
(set-color 'slategray)
(draw-rect 37 48 6 5)
(set-color 'crimson)
(pset 38 50)
(set-color 'mediumseagreen)
(pset 41 50)
;; a small antenna coming off the helmet
(set-color 'gold)
(line 44 24 46 20)
(pset 46 19)

;; Tether — a thin line going off the top-left of the frame,
;; suggesting a mothership just out of view.
(set-color 'white)
(line 32 48 8 0)

(end-frame)
(render)
(display "Astronaut in Space — drawn.")
(newline)
