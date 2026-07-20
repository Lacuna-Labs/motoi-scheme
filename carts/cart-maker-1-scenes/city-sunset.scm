;; Scene: City Skyline at Sunset
;; Author: Motoi Cart Maker 1 (Scenes) · 2026-07-19
;; What it draws: A city skyline silhouetted against a peach-and-coral sunset sky, with a gold sun sinking behind the buildings, lit windows in the towers, and stars starting to come out overhead.
;; Verbs used: set-mode, clear, set-color, rect-fill, fill-rect, rectangle, disc, put-pixel, set-pixel!, line, begin-frame, end-frame, render

;; A skyline is boxes of different heights, dark against a bright sky.
;; The trick to sunset is the gradient — sky isn't one color, it's a
;; band of colors stacked. We fake a gradient with three horizontal
;; strips instead of one big fill: navy up top, plum middle,
;; peachpuff+coral near the horizon.

(set-mode 80 80)
(begin-frame)

;; --- sky gradient (bands, top to bottom) ------------------------
(set-color 'navy)
(rect-fill 0 0 80 12)
(set-color 'plum)
(rect-fill 0 12 80 12)
(set-color 'coral)
(rect-fill 0 24 80 10)
(set-color 'peachpuff)
(rect-fill 0 34 80 14)

;; --- sun (a big gold disc halfway behind the skyline) -----------
(set-color 'gold)
(disc 40 42 10)

;; --- stars (single pixels in the upper sky) ---------------------
;; Alias: set-pixel! is the same as pset. Kids from Scheme dialects
;; often reach for set-pixel! first because of the ! naming pattern.
(set-color 'white)
(set-pixel! 6 4)
(set-pixel! 18 8)
(set-pixel! 25 3)
(set-pixel! 44 6)
(set-pixel! 58 9)
(set-pixel! 72 4)
(set-pixel! 66 15)
(set-pixel! 12 15)
;; Some stars are two pixels — a little brighter.
(put-pixel 45 7)
(put-pixel 33 10)

;; --- ground (dark strip along the bottom) -----------------------
(set-color 'black)
(rect-fill 0 62 80 18)

;; --- buildings (silhouettes) ------------------------------------
;; Left-to-right: apartment, tall tower, wide block, spire, short.
(set-color 'saddlebrown)
(fill-rect 2 48 10 20)
(set-color 'black)
(fill-rect 14 32 8 36)      ; tall tower
(fill-rect 24 44 14 24)     ; wide block
(fill-rect 40 40 8 28)      ; another mid tower
(fill-rect 50 28 10 40)     ; tallest tower (crosses the sun!)
(fill-rect 62 46 8 22)      ; smaller
(fill-rect 72 50 6 18)      ; short shed

;; --- spire on the tallest tower ---------------------------------
(set-color 'black)
(line 55 28 55 22)
(put-pixel 55 21)

;; --- windows (lit rooms) — small gold rects on the dark towers --
(set-color 'gold)
;; tall tower windows (3 rows x 2 cols)
(rectangle 15 36 1 1)
(rectangle 18 36 1 1)
(rectangle 15 40 1 1)
(rectangle 18 40 1 1)
(rectangle 15 44 1 1)
(rectangle 18 44 1 1)

;; wide block windows (grid)
(fill-rect 26 46 1 1)
(fill-rect 29 46 1 1)
(fill-rect 32 46 1 1)
(fill-rect 35 46 1 1)
(fill-rect 26 50 1 1)
(fill-rect 29 50 1 1)
(fill-rect 32 50 1 1)
(fill-rect 35 50 1 1)
(fill-rect 26 54 1 1)
(fill-rect 32 54 1 1)
(fill-rect 35 54 1 1)

;; tallest tower windows
(fill-rect 52 34 1 1)
(fill-rect 55 34 1 1)
(fill-rect 58 34 1 1)
(fill-rect 52 40 1 1)
(fill-rect 58 40 1 1)
(fill-rect 52 46 1 1)
(fill-rect 55 46 1 1)
(fill-rect 58 46 1 1)
(fill-rect 52 52 1 1)
(fill-rect 58 52 1 1)

;; small tower on far right
(fill-rect 64 50 1 1)
(fill-rect 67 50 1 1)
(fill-rect 64 55 1 1)
(fill-rect 67 55 1 1)

;; --- a couple of birds silhouetted against the sunset ----------
;; Each bird is a small V — two lines meeting at a point.
(set-color 'black)
(line 20 20 22 19)
(line 22 19 24 20)
(line 28 25 30 24)
(line 30 24 32 25)

(end-frame)
(render)
(display "City Skyline at Sunset — drawn.")
(newline)
