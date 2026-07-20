;; Scene: Friendly Face
;; Author: Motoi Cart Maker 1 (Scenes) · 2026-07-19
;; What it draws: A friendly round face — peach skin, brown hair on top, two big eyes with pupils and highlights, a small nose, and a smiling mouth.
;; Verbs used: set-mode, clear, set-color, disc, circle, rect-fill, fill-rect, put-pixel, line, begin-frame, end-frame, render

;; A face is a stack of circles, mostly. If you get the eyes right,
;; everything else can be off and the face still looks like a face.
;; If you get the eyes wrong, no amount of nose-fussing will save it.
;; That's the whole trick.

(set-mode 80 80)
(begin-frame)

;; --- background (soft plum sky) ---------------------------------
(set-color 'plum)
(rect-fill 0 0 80 80)

;; --- hair backdrop (rounded top) --------------------------------
;; Two brown discs make the hair silhouette, sitting slightly above
;; where the face will land. Draw hair BEFORE face so the face
;; overlaps it — that gives us a nice forehead edge.
(set-color 'saddlebrown)
(disc 40 22 22)
(disc 26 30 8)
(disc 54 30 8)

;; --- face (peach skin) ------------------------------------------
(set-color 'peachpuff)
(disc 40 42 22)

;; --- ears --------------------------------------------------------
(set-color 'peachpuff)
(disc 18 44 4)
(disc 62 44 4)
;; ear inner shadow
(set-color 'coral)
(disc 18 44 2)
(disc 62 44 2)

;; --- eyes: white sclera, dark pupil, tiny highlight -------------
;; The highlight is what makes cartoon eyes look "alive."
(set-color 'white)
(disc 32 40 5)
(disc 48 40 5)
(set-color 'navy)
(disc 32 40 2)
(disc 48 40 2)
;; Highlights — a single bright pixel on each pupil.
;; Alias: put-pixel is the same as pset.
(set-color 'white)
(put-pixel 33 39)
(put-pixel 49 39)

;; --- eyebrows (short lines above each eye) ----------------------
(set-color 'saddlebrown)
(line 28 33 36 32)
(line 44 32 52 33)

;; --- nose (a small filled rect + a highlight pixel) -------------
(set-color 'sienna)
(fill-rect 39 44 3 5)
(set-color 'white)
(put-pixel 40 45)

;; --- cheeks (rosy circles) --------------------------------------
(set-color 'pink)
(disc 26 50 3)
(disc 54 50 3)

;; --- mouth (smile — an arc built from a few points) -------------
;; A curve made from lines between hand-picked points reads better
;; than a math-generated arc at 80x80. Six points, five lines.
(set-color 'crimson)
(line 32 54 35 57)
(line 35 57 40 58)
(line 40 58 45 57)
(line 45 57 48 54)

;; --- chin dimple + a small heart on the cheek for delight ------
(set-color 'coral)
(put-pixel 40 61)

(end-frame)
(render)
(display "Friendly Face — drawn.")
(newline)
