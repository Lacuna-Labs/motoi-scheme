;; Scene: House on a Hill
;; Author: Motoi Cart Maker 1 (Scenes) · 2026-07-19
;; What it draws: A cozy little cottage with a red roof, yellow-lit window, chimney with smoke, sitting on a green hill under a blue sky.
;; Verbs used: set-mode, clear, set-color, rect-fill, filled-rectangle, rect, rectangle, disc, line, pixel, begin-frame, end-frame, render, pixels-wide, pixels-tall

;; A house has a few honest parts: walls, a roof, a door, windows,
;; a chimney, maybe smoke if the fire's going. We draw them in
;; back-to-front order — sky, hill, house body, roof, details.
;; Painters do this too. The last thing you paint is the thing
;; closest to you.

(set-mode 80 80)
(begin-frame)

;; --- sky ---------------------------------------------------------
(set-color 'skyblue)
(rect-fill 0 0 (pixels-wide) (pixels-tall))

;; --- sun ---------------------------------------------------------
(set-color 'gold)
(disc 14 14 6)

;; --- hill (rounded green mound) ---------------------------------
;; We stack discs and a fill-rect. Two overlapping discs plus a base
;; rectangle make a soft mound without needing curves.
(set-color 'mediumseagreen)
(disc 20 70 22)
(disc 60 72 24)
(filled-rectangle 0 68 80 12)

;; --- house body (walls) ------------------------------------------
;; The wall is a filled square. Alias: filled-rectangle == rect-fill.
;; Kids sometimes type "filled-rectangle" first — it works.
(set-color 'peachpuff)
(filled-rectangle 26 42 28 24)

;; --- roof (two lines making a triangle) -------------------------
;; A triangle from three lines: left-slope, right-slope, base.
(set-color 'crimson)
;; Fill the roof interior row by row so it's a real triangle, not
;; just an outline. Slope goes from x=22 at bottom to x=40 at peak,
;; and x=58 at bottom on the other side.
(define (fill-roof y)
  (if (>= y 32)
      (begin
        (line (- 40 (- 42 y)) y (+ 40 (- 42 y)) y)
        (fill-roof (- y 1)))
      #f))
(fill-roof 42)

;; --- door --------------------------------------------------------
(set-color 'saddlebrown)
(rect-fill 36 52 8 14)
;; door knob — a single pixel of gold. Aliases: pixel = pset.
(set-color 'gold)
(pixel 42 59)

;; --- window (lit up warm — someone's home) ----------------------
(set-color 'gold)
(rect-fill 46 46 6 6)
;; window frame + cross-bars
(set-color 'black)
(rectangle 46 46 6 6)
(line 46 49 51 49)
(line 49 46 49 51)

;; --- chimney -----------------------------------------------------
(set-color 'sienna)
(rect-fill 48 30 4 8)
(set-color 'black)
(rect 48 30 4 8)

;; --- smoke (three little puffs rising) --------------------------
(set-color 'slategray)
(disc 50 26 2)
(disc 52 22 2)
(disc 51 18 3)

;; --- ground line + door outline for definition -----------------
(set-color 'black)
(rectangle 26 42 28 24)
(rectangle 36 52 8 14)

(end-frame)
(render)
(display "House on a Hill — drawn.")
(newline)
