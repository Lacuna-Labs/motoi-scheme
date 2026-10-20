#!/usr/bin/env python3
"""
p0-new-examples-2026-07-16.py — Hand-authored additional :examples entries
for the 137 P0 STARVED verbs from architect-scheme-doc-edit-plan-2026-07-16.slat.

Each entry adds 2 examples (1 novice + 1 intermediate) to the verb's existing
[novice, intermediate, expert] triple, lifting to a full 5-example tier
(2 novice + 2 intermediate + 1 expert).

Doctrine:
  * All code is runnable Motoi Scheme (no Sakura verbs, no philosopher-drops).
  * No fabrication: signatures + summaries pulled from MOTOI-SCHEME-REFERENCE.slat.
  * Notes are publishable prose in Sakura's teaching voice: brief, concrete,
    kid-readable, no training-data smell.

Format:
  NEW_EXAMPLES: dict verb-name -> list of {tier, code, note} dicts (length 2).

Consumed by: scratch/p0-example-injector-2026-07-16.py
"""

# Each verb: 2 new examples (1 novice, 1 intermediate).
# Keep code short and self-contained.
NEW_EXAMPLES = {

    # ===================================================================
    # B-01 CORE (76 verbs) — audio / camera / grid / note / random / on /
    #                        cancel / frame / pixels / random / etc.
    # ===================================================================

    # ---- audio-* (14) ----
    "audio-band": [
        {"tier": "novice", "code": "(if (> (audio-band 2) 0.4)\n    (display \"kick!\")\n    (display \".\"))",
         "note": "The lowest bands carry the drum. Print a mark when the kick pushes past 0.4."},
        {"tier": "intermediate", "code": "(define (spring-height)\n  (+ 20 (* 100 (audio-band 3))))\n(on-frame\n  (lambda ()\n    (grid-cell-set! 5 5 (spring-height))))",
         "note": "Bind a cell's height to a bass band so the grid bounces with the song."},
    ],
    "audio-bands": [
        {"tier": "novice", "code": "(display (length (audio-bands)))",
         "note": "See how many bands the engine offers before you decide how many to draw."},
        {"tier": "intermediate", "code": "(define (loudest)\n  (let loop ((bands (audio-bands)) (i 0) (best 0) (best-i 0))\n    (if (null? bands)\n        best-i\n        (if (> (car bands) best)\n            (loop (cdr bands) (+ i 1) (car bands) i)\n            (loop (cdr bands) (+ i 1) best best-i)))))",
         "note": "Walk the spectrum and remember which band shouted loudest this frame."},
    ],
    "audio-bar-clock": [
        {"tier": "novice", "code": "(define clk (audio-bar-clock (audio-play 'loop)))\n(display (clk 'phase))",
         "note": "The clock hands back its phase as a number between 0 and 1 across one bar."},
        {"tier": "intermediate", "code": "(define clk (audio-bar-clock (audio-play 'song) 4))\n(on-frame\n  (lambda ()\n    (let ((r (clk 'radians)))\n      (display r))))",
         "note": "A 4-bar clock cycles once every four bars; radians are handy for rotating shapes."},
    ],
    "audio-beat?": [
        {"tier": "novice", "code": "(on-frame\n  (lambda ()\n    (when (audio-beat?)\n      (grid-cell-set! 0 0 1))))",
         "note": "Blink cell (0,0) each time the engine hears a beat."},
        {"tier": "intermediate", "code": "(define count 0)\n(on-frame\n  (lambda ()\n    (when (audio-beat?)\n      (set! count (+ count 1))\n      (when (= (modulo count 4) 0)\n        (display \"downbeat\")))))",
         "note": "Count beats and mark every fourth one as a downbeat."},
    ],
    "audio-bpm": [
        {"tier": "novice", "code": "(let ((bpm (audio-bpm)))\n  (if bpm (display bpm) (display \"no tempo yet\")))",
         "note": "Ask the engine for the song's tempo; it may not know yet."},
        {"tier": "intermediate", "code": "(define (beat-length-ms)\n  (let ((bpm (audio-bpm)))\n    (if bpm (/ 60000 bpm) 500)))\n(display (beat-length-ms))",
         "note": "Turn a tempo into the length of one beat in milliseconds. Fall back to 500 ms."},
    ],
    "audio-halt": [
        {"tier": "novice", "code": "(define h (audio-play 'chime))\n(audio-halt h)",
         "note": "Play a chime, then cut it off. Handles are how you talk to sounds already playing."},
        {"tier": "intermediate", "code": "(define bg (audio-play 'ambient))\n(on-key\n  (lambda (k)\n    (when (eq? k 'q)\n      (audio-halt bg))))",
         "note": "Press Q to quiet the ambient loop. Useful when a boss battle starts."},
    ],
    "audio-master-volume": [
        {"tier": "novice", "code": "(audio-master-volume 0.25)",
         "note": "Cut the overall volume to a quarter. Ranges 0.0 (silent) to 1.0 (full)."},
        {"tier": "intermediate", "code": "(define (fade-out steps)\n  (let loop ((i steps))\n    (when (> i 0)\n      (audio-master-volume (/ i steps))\n      (wait 50)\n      (loop (- i 1)))))",
         "note": "Step the master volume down to zero for a slow fade at the end of a scene."},
    ],
    "audio-peak": [
        {"tier": "novice", "code": "(display (audio-peak))",
         "note": "One number that tells you how loud the loudest sample is this frame."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (let ((p (audio-peak)))\n      (grid-cell-set! 0 0 (if (> p 0.9) 1 0)))))",
         "note": "Light up a cell whenever the audio is near clipping."},
    ],
    "audio-perceptual-bands": [
        {"tier": "novice", "code": "(display (length (audio-perceptual-bands)))",
         "note": "Perceptual bands weight the spectrum the way our ears actually hear it."},
        {"tier": "intermediate", "code": "(define (bar-heights)\n  (map (lambda (b) (* 10 b)) (audio-perceptual-bands)))\n(display (bar-heights))",
         "note": "Turn the perceptual spectrum into a list of bar heights for a fair-looking visualizer."},
    ],
    "audio-play": [
        {"tier": "novice", "code": "(audio-play 'ping)",
         "note": "Start a sample. The engine returns a handle you can keep if you want to stop it later."},
        {"tier": "intermediate", "code": "(define song (audio-play 'song))\n(on-key\n  (lambda (k)\n    (when (eq? k 'space)\n      (if (audio-playing?)\n          (audio-halt song)\n          (audio-play 'song)))))",
         "note": "Space bar toggles the song. If it's playing, stop it; otherwise start it again."},
    ],
    "audio-playing?": [
        {"tier": "novice", "code": "(if (audio-playing?)\n    (display \"sound on\")\n    (display \"silence\"))",
         "note": "Ask the engine whether anything is actually making noise right now."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (not (audio-playing?))\n      (audio-play 'restart-cue))))",
         "note": "If the sound stops for any reason, kick it back on with a cue."},
    ],
    "audio-rms": [
        {"tier": "novice", "code": "(display (audio-rms))",
         "note": "RMS reads the average loudness — steadier than peak, better for slow visuals."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (let ((energy (audio-rms)))\n      (camera-scale (+ 1.0 (* 0.2 energy))))))",
         "note": "Breathe the camera in and out with the music's overall loudness."},
    ],
    "audio-tempo": [
        {"tier": "novice", "code": "(audio-tempo 90)",
         "note": "Set playback tempo to 90 beats per minute — a walking pace."},
        {"tier": "intermediate", "code": "(define (double-time)\n  (audio-tempo (* 2 (or (audio-bpm) 120))))\n(on-key\n  (lambda (k)\n    (when (eq? k 'd) (double-time))))",
         "note": "Press D to double whatever tempo the song is at right now."},
    ],
    "audio-time": [
        {"tier": "novice", "code": "(display (audio-time))",
         "note": "How long has the audio been playing? A single number in seconds."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (let ((t (audio-time)))\n      (when (> t 30)\n        (display \"30 seconds in\")))))",
         "note": "Trigger a moment once the song has been rolling for half a minute."},
    ],

    # ---- camera-* (17) ----
    "camera-bring-to-view": [
        {"tier": "novice", "code": "(define hero (entity/make 'player))\n(camera-bring-to-view hero)",
         "note": "Move the camera so the hero is on screen with a bit of padding."},
        {"tier": "intermediate", "code": "(define boss (entity/make 'boss))\n(camera-bring-to-view boss 40 600)",
         "note": "Pan to the boss over 600 ms with 40 px of breathing room around them."},
    ],
    "camera-center-on": [
        {"tier": "novice", "code": "(camera-center-on 100 200)",
         "note": "Slide the camera so world point (100, 200) sits at the middle of the screen."},
        {"tier": "intermediate", "code": "(camera-center-on 0 0 2 400)",
         "note": "Center on the origin at 2x zoom, taking 400 ms to get there smoothly."},
    ],
    "camera-export": [
        {"tier": "novice", "code": "(define rec (camera-record))\n(camera-export rec)",
         "note": "Turn a camera recording into a shareable GIF or image."},
        {"tier": "intermediate", "code": "(define rec (camera-record))\n(camera-frame rec 'screen)\n(camera-export rec '(kind gif fps 15))",
         "note": "Grab one screen frame, then export the whole recording as a 15-fps GIF."},
    ],
    "camera-fit-all": [
        {"tier": "novice", "code": "(camera-fit-all 10)",
         "note": "Zoom out to fit everything with a 10 px margin around the group."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (when (eq? k 'f)\n      (camera-fit-all 20 800))))",
         "note": "Press F to fit every entity on screen over 800 ms, with 20 px padding."},
    ],
    "camera-frame": [
        {"tier": "novice", "code": "(define rec (camera-record))\n(camera-frame rec 'screen)",
         "note": "Snap the current screen into the recording as one frame."},
        {"tier": "intermediate", "code": "(define rec (camera-record))\n(on-frame\n  (lambda ()\n    (camera-frame rec 'screen)))",
         "note": "Grab every animation frame into the recording — good for making a smooth GIF."},
    ],
    "camera-home": [
        {"tier": "novice", "code": "(camera-home 200)",
         "note": "Glide the camera back to (0, 0) over 200 ms."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (when (eq? k 'h)\n      (camera-home 500))))",
         "note": "Press H and glide back home over half a second."},
    ],
    "camera-pan": [
        {"tier": "novice", "code": "(camera-pan 50 0)",
         "note": "Shift the camera 50 units to the right without changing zoom."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (cond ((eq? k 'left)  (camera-pan -20 0))\n          ((eq? k 'right) (camera-pan 20 0))\n          ((eq? k 'up)    (camera-pan 0 -20))\n          ((eq? k 'down)  (camera-pan 0 20)))))",
         "note": "Arrow keys nudge the camera around. Classic level-editor controls."},
    ],
    "camera-pan-to": [
        {"tier": "novice", "code": "(camera-pan-to 200 100)",
         "note": "Slide the camera to an exact world position — the destination, not a delta."},
        {"tier": "intermediate", "code": "(camera-pan-to 300 300 400)",
         "note": "Pan to (300, 300) over 400 ms. Good for cinematic reveals."},
    ],
    "camera-record": [
        {"tier": "novice", "code": "(define rec (camera-record))",
         "note": "Start a fresh recording. Feed it frames with camera-frame, then export."},
        {"tier": "intermediate", "code": "(define rec (camera-record))\n(let loop ((i 0))\n  (when (< i 30)\n    (camera-frame rec 'screen)\n    (wait 33)\n    (loop (+ i 1))))",
         "note": "Grab 30 frames roughly one per 33 ms — about a second of footage."},
    ],
    "camera-scale": [
        {"tier": "novice", "code": "(camera-scale 2)",
         "note": "Zoom the camera to 2x. Everything looks twice as big."},
        {"tier": "intermediate", "code": "(define (breathe)\n  (on-frame\n    (lambda ()\n      (let ((t (audio-time)))\n        (camera-scale (+ 1 (* 0.1 (sin t))))))))",
         "note": "Rock the zoom gently with a sine wave — a subtle living-scene effect."},
    ],
    "camera-set!": [
        {"tier": "novice", "code": "(camera-set! 100 100 1.5)",
         "note": "Place the camera at (100, 100) at 1.5x zoom in one step."},
        {"tier": "intermediate", "code": "(define (snap-to hero)\n  (let ((p (entity/pos hero)))\n    (camera-set! (car p) (cadr p) 1)))",
         "note": "Snap the camera onto the hero without any smoothing — feels arcade-tight."},
    ],
    "camera-state": [
        {"tier": "novice", "code": "(display (camera-state))",
         "note": "Peek at where the camera is and how far it's zoomed."},
        {"tier": "intermediate", "code": "(define saved (camera-state))\n(camera-fit-all)\n(wait 1000)\n(camera-set! (car saved) (cadr saved) (caddr saved))",
         "note": "Save the current view, take a wide-angle look for a second, then restore it."},
    ],
    "camera-tilt": [
        {"tier": "novice", "code": "(camera-tilt 0.1)",
         "note": "Rock the camera by a small angle. Just enough to feel a rumble."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (camera-tilt (* 0.05 (sin (audio-time))))))",
         "note": "Give the frame a soft rocking motion tied to the audio clock."},
    ],
    "camera-trace": [
        {"tier": "novice", "code": "(camera-trace 'on)",
         "note": "Turn on the trace overlay so you can see where the camera has been."},
        {"tier": "intermediate", "code": "(camera-trace 'clear)\n(camera-pan-to 200 0 500)\n(camera-pan-to 0 200 500)",
         "note": "Clear the trace, then pan through two points. The trace shows the path."},
    ],
    "camera-x": [
        {"tier": "novice", "code": "(display (camera-x))",
         "note": "Read the camera's current world-x. Handy for saving positions."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (> (camera-x) 500)\n      (camera-home))))",
         "note": "Snap home if the camera drifts past x=500. A gentle edge stop."},
    ],
    "camera-y": [
        {"tier": "novice", "code": "(display (camera-y))",
         "note": "Read the camera's current world-y."},
        {"tier": "intermediate", "code": "(define (below? y)\n  (< (camera-y) y))\n(if (below? 0) (display \"upper\") (display \"lower\"))",
         "note": "Decide whether the camera is looking at the upper half of the world."},
    ],
    "camera-zoom-to": [
        {"tier": "novice", "code": "(camera-zoom-to 3)",
         "note": "Zoom in to 3x. The scene fills more of the screen."},
        {"tier": "intermediate", "code": "(camera-zoom-to 0.5 600)",
         "note": "Zoom out to half-size over 600 ms for a slow reveal."},
    ],

    # ---- grid-* (13) ----
    "grid-cell-age": [
        {"tier": "novice", "code": "(display (grid-cell-age 3 4))",
         "note": "How many steps has cell (3, 4) been alive? Useful for coloring by age."},
        {"tier": "intermediate", "code": "(define (old? cx cy)\n  (> (grid-cell-age cx cy) 20))\n(when (old? 5 5) (display \"veteran cell\"))",
         "note": "Flag cells that have been alive for a long time."},
    ],
    "grid-cell-set!": [
        {"tier": "novice", "code": "(grid-cell-set! 2 2 1)",
         "note": "Bring cell (2, 2) to life. The 1 means alive; 0 means dead."},
        {"tier": "intermediate", "code": "(define (paint-line cy)\n  (let loop ((cx 0))\n    (when (< cx (grid-cols))\n      (grid-cell-set! cx cy 1)\n      (loop (+ cx 1)))))\n(paint-line 3)",
         "note": "Fill an entire row of the grid by walking across every column."},
    ],
    "grid-cell-state": [
        {"tier": "novice", "code": "(display (grid-cell-state 0 0))",
         "note": "Ask a cell what state it's in right now."},
        {"tier": "intermediate", "code": "(define (alive? cx cy)\n  (= (grid-cell-state cx cy) 1))\n(display (alive? 2 3))",
         "note": "Wrap the state check in a friendlier predicate for readability."},
    ],
    "grid-cell?": [
        {"tier": "novice", "code": "(display (grid-cell? 0 0))",
         "note": "Is (0, 0) actually inside the grid? A gentle bounds check."},
        {"tier": "intermediate", "code": "(define (safe-set! cx cy v)\n  (when (grid-cell? cx cy)\n    (grid-cell-set! cx cy v)))",
         "note": "Only touch cells that exist. Never write past the edge."},
    ],
    "grid-cols": [
        {"tier": "novice", "code": "(let ((w (grid-cols))) (display w))",
         "note": "How many columns wide is the grid? Bind it to a name first."},
        {"tier": "intermediate", "code": "(define (rightmost) (- (grid-cols) 1))\n(grid-cell-set! (rightmost) 0 1)",
         "note": "Light up the rightmost cell in row 0 without hardcoding a number."},
    ],
    "grid-init": [
        {"tier": "novice", "code": "(grid-init 16 16)",
         "note": "Make a fresh 16 by 16 grid. Every cell starts empty."},
        {"tier": "intermediate", "code": "(grid-init 32 32)\n(grid-cell-set! 15 15 1)",
         "note": "Rebuild a bigger grid and drop a single lit cell at the middle."},
    ],
    "grid-live-count": [
        {"tier": "novice", "code": "(let ((n (grid-live-count))) (display n))",
         "note": "Bind the live-count to a name before printing. Same result, easier to reuse."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (= (grid-live-count) 0)\n      (display \"extinction\"))))",
         "note": "Notice the moment every last cell has died."},
    ],
    "grid-neighbors": [
        {"tier": "novice", "code": "(display (grid-neighbors 2 2))",
         "note": "How many live neighbors does cell (2, 2) have?"},
        {"tier": "intermediate", "code": "(define (crowded? cx cy)\n  (> (grid-neighbors cx cy) 3))\n(display (crowded? 5 5))",
         "note": "In Conway's Life, more than 3 neighbors is crowded — the cell dies next step."},
    ],
    "grid-origin": [
        {"tier": "novice", "code": "(display (grid-origin))",
         "note": "Where does the grid begin in world space? Returns two numbers."},
        {"tier": "intermediate", "code": "(let ((o (grid-origin)))\n  (camera-center-on (car o) (cadr o)))",
         "note": "Aim the camera at the grid's top-left corner."},
    ],
    "grid-rows": [
        {"tier": "novice", "code": "(let ((h (grid-rows))) (display h))",
         "note": "Grab the row count into h before you use it."},
        {"tier": "intermediate", "code": "(define (bottom-row) (- (grid-rows) 1))\n(grid-cell-set! 0 (bottom-row) 1)",
         "note": "Light the bottom-left cell without knowing the grid size ahead of time."},
    ],
    "grid-step": [
        {"tier": "novice", "code": "(grid-step)",
         "note": "Run one tick of Conway's Life. Every cell decides who lives and who dies."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (grid-step)))",
         "note": "Advance the world one Life step per animation frame — an endless cellular movie."},
    ],
    "grid-step-3state": [
        {"tier": "novice", "code": "(grid-step-3state)",
         "note": "Three-state Life. Cells can be alive, dying, or dead."},
        {"tier": "intermediate", "code": "(let loop ((i 0))\n  (when (< i 10)\n    (grid-step-3state)\n    (loop (+ i 1))))",
         "note": "Run 10 three-state steps back to back and see what patterns settle."},
    ],
    "grid-step-4state": [
        {"tier": "novice", "code": "(grid-step-4state)",
         "note": "Four-state Life with an extra 'refractory' phase before rebirth."},
        {"tier": "intermediate", "code": "(define (four-state-run n)\n  (let loop ((i 0))\n    (when (< i n)\n      (grid-step-4state)\n      (loop (+ i 1)))))\n(four-state-run 5)",
         "note": "Run five four-state steps and study how waves ripple across the grid."},
    ],
    "grid-step-aged": [
        {"tier": "novice", "code": "(grid-step-aged)",
         "note": "Age-tracked Life: cells remember how long they've been alive."},
        {"tier": "intermediate", "code": "(grid-step-aged)\n(when (> (grid-cell-age 5 5) 3)\n  (display \"cell 5,5 is a veteran\"))",
         "note": "Step and then check whether a particular cell has passed the age of 3."},
    ],
    "grid-step-count": [
        {"tier": "novice", "code": "(display (grid-step-count))",
         "note": "How many steps has the grid taken since it was initialized?"},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (> (grid-step-count) 100)\n      (grid-init 16 16))))",
         "note": "After 100 steps, wipe the board and start over."},
    ],

    # ---- note-* (5) ----
    "note-dots": [
        {"tier": "novice", "code": "(note-dots '(1 3 5))",
         "note": "Play three tones together — a simple chord written as pitch numbers."},
        {"tier": "intermediate", "code": "(define chord '(60 64 67))\n(note-dots chord)",
         "note": "Middle C major chord. MIDI-style pitch numbers work here."},
    ],
    "note-place": [
        {"tier": "novice", "code": "(note-place 60)",
         "note": "Place middle C on the current step of the sequencer."},
        {"tier": "intermediate", "code": "(for-each note-place '(60 62 64 65 67))",
         "note": "Lay down the first five notes of a C-major scale in order."},
    ],
    "note-place-at": [
        {"tier": "novice", "code": "(note-place-at 60 0)",
         "note": "Put middle C on step 0 of the pattern grid."},
        {"tier": "intermediate", "code": "(let loop ((i 0))\n  (when (< i 4)\n    (note-place-at 60 (* i 4))\n    (loop (+ i 1))))",
         "note": "Drop a kick-like note on every fourth step for a straight-ahead beat."},
    ],
    "note-release": [
        {"tier": "novice", "code": "(note-release 60)",
         "note": "Let go of middle C. Notes hang until you release them."},
        {"tier": "intermediate", "code": "(note-strike 60)\n(wait 500)\n(note-release 60)",
         "note": "Hold C for half a second, then release. A simple sustained tone."},
    ],
    "note-strike": [
        {"tier": "novice", "code": "(note-strike 60)",
         "note": "Play middle C. Strike starts a note; you'll want to release it later."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (when (eq? k 'a)\n      (note-strike 60))))",
         "note": "Play middle C every time you press A. A tiny keyboard."},
    ],

    # ---- random-* (3) ----
    "random-int": [
        {"tier": "novice", "code": "(display (random-int 6))",
         "note": "A random whole number from 0 up to 5. Handy for dice."},
        {"tier": "intermediate", "code": "(define (roll)\n  (+ 1 (random-int 6)))\n(display (roll))",
         "note": "Wrap random-int in a helper to roll a proper 1-to-6 die."},
    ],
    "random-pick": [
        {"tier": "novice", "code": "(display (random-pick '(red green blue)))",
         "note": "Pick one item at random from a list. Each has equal weight."},
        {"tier": "intermediate", "code": "(define hats '(top bowler fedora))\n(on-key\n  (lambda (k)\n    (when (eq? k 'h)\n      (display (random-pick hats)))))",
         "note": "Press H to draw a hat at random from the wardrobe."},
    ],
    "random-range": [
        {"tier": "novice", "code": "(display (random-range 10 20))",
         "note": "A random number between 10 and 20. Lets you set both edges."},
        {"tier": "intermediate", "code": "(define (jitter x)\n  (+ x (random-range -3 3)))\n(display (jitter 100))",
         "note": "Wiggle a value by a few units either way. Handy for hand-drawn-looking placement."},
    ],

    # ---- on-* (4) ----
    "on-canvas-trace": [
        {"tier": "novice", "code": "(on-canvas-trace\n  (lambda (event)\n    (display event)))",
         "note": "Listen for every trace event the canvas emits and print it."},
        {"tier": "intermediate", "code": "(on-canvas-trace\n  (lambda (e)\n    (when (eq? (car e) 'draw)\n      (display \"a draw happened\"))))",
         "note": "React only to draw events. Ignore everything else the canvas reports."},
    ],
    "on-frame": [
        {"tier": "novice", "code": "(on-frame\n  (lambda ()\n    (display \"tick\")))",
         "note": "Run this every animation frame. The screen refreshes about 60 times a second."},
        {"tier": "intermediate", "code": "(define count 0)\n(on-frame\n  (lambda ()\n    (set! count (+ count 1))\n    (when (= (modulo count 60) 0)\n      (display \"one second\"))))",
         "note": "Count frames and mark each second that passes."},
    ],
    "on-key": [
        {"tier": "novice", "code": "(on-key\n  (lambda (k)\n    (display k)))",
         "note": "Print whichever key was pressed. Learn what your keyboard sends."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (cond ((eq? k 'space) (display \"jump\"))\n          ((eq? k 'esc)   (display \"pause\")))))",
         "note": "Space jumps, Escape pauses. A tiny game-input router."},
    ],
    "on-tick": [
        {"tier": "novice", "code": "(on-tick\n  (lambda ()\n    (display \"beat\")))",
         "note": "Fire every audio beat. Different from on-frame, which fires every screen frame."},
        {"tier": "intermediate", "code": "(define beats 0)\n(on-tick\n  (lambda ()\n    (set! beats (+ beats 1))\n    (when (= (modulo beats 8) 0)\n      (display \"measure\"))))",
         "note": "Count beats and announce every 8-beat measure. Useful for phrase-aware music."},
    ],

    # ---- cancel-* (1) ----
    "cancel-tick": [
        {"tier": "novice", "code": "(define t (on-tick (lambda () (display \".\"))))\n(cancel-tick t)",
         "note": "Register a tick handler, then quiet it back down with cancel-tick."},
        {"tier": "intermediate", "code": "(define counter 0)\n(define t #f)\n(set! t\n  (on-tick\n    (lambda ()\n      (set! counter (+ counter 1))\n      (when (>= counter 4)\n        (cancel-tick t)))))",
         "note": "Self-cancelling ticker: prints four times then removes itself."},
    ],

    # ---- frame lifecycle (3) ----
    "begin-frame": [
        {"tier": "novice", "code": "(begin-frame 'main)",
         "note": "Start drawing on the surface called 'main. Pair with end-frame to publish."},
        {"tier": "intermediate", "code": "(begin-frame 'card-a)\n(grid-cell-set! 0 0 1)\n(end-frame 'card-a)",
         "note": "Frame a small edit into card-a. Nothing shows on screen until end-frame."},
    ],
    "end-frame": [
        {"tier": "novice", "code": "(end-frame 'main)",
         "note": "Finish the current frame on the 'main surface. Now the world can see it."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (begin-frame 'main)\n    (grid-cell-set! 5 5 1)\n    (end-frame 'main)))",
         "note": "A full render loop: open a frame, paint, close a frame."},
    ],
    "after-frame": [
        {"tier": "novice", "code": "(after-frame\n  (lambda ()\n    (display \"paint settled\")))",
         "note": "Runs once, after the browser has actually painted the frame you just built."},
        {"tier": "intermediate", "code": "(begin-frame 'main)\n(grid-cell-set! 3 3 1)\n(end-frame 'main)\n(after-frame\n  (lambda ()\n    (display (grid-live-count))))",
         "note": "Paint a cell, then measure the live count only after paint has finished."},
    ],

    # ---- pixels-* (2) ----
    "pixels-tall": [
        {"tier": "novice", "code": "(display (pixels-tall))",
         "note": "How many pixels tall is the current surface?"},
        {"tier": "intermediate", "code": "(define middle (/ (pixels-tall) 2))\n(camera-center-on (/ (pixels-wide) 2) middle)",
         "note": "Aim the camera at the exact middle of the screen without hardcoding a size."},
    ],
    "pixels-wide": [
        {"tier": "novice", "code": "(display (pixels-wide))",
         "note": "How many pixels wide is the current surface?"},
        {"tier": "intermediate", "code": "(define right-edge (- (pixels-wide) 20))\n(display right-edge)",
         "note": "Compute a safe right-edge coordinate that stays 20 px away from the screen edge."},
    ],

    # ---- misc core (7) ----
    "viewport": [
        {"tier": "novice", "code": "(display (viewport))",
         "note": "Ask what part of the world is currently visible. Returns bounds."},
        {"tier": "intermediate", "code": "(let ((v (viewport)))\n  (display (list 'left (car v) 'top (cadr v))))",
         "note": "Peel apart the viewport tuple to see the top-left corner."},
    ],
    "cols": [
        {"tier": "novice", "code": "(display (cols))",
         "note": "How many columns wide is the current logical surface?"},
        {"tier": "intermediate", "code": "(define (last-col) (- (cols) 1))\n(display (last-col))",
         "note": "Compute the rightmost column index without hardcoding the width."},
    ],
    "rows": [
        {"tier": "novice", "code": "(let ((h (rows))) (display h))",
         "note": "Bind the row count to a name first, then print. Easier to reuse."},
        {"tier": "intermediate", "code": "(define (last-row) (- (rows) 1))\n(display (last-row))",
         "note": "Compute the bottom row index. Now your code survives a resize."},
    ],
    "key?": [
        {"tier": "novice", "code": "(if (key? 'space)\n    (display \"held\")\n    (display \"free\"))",
         "note": "Ask right now whether space is being held down. Different from on-key, which reacts to a press."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (key? 'right)\n      (camera-pan 5 0))))",
         "note": "As long as right-arrow is held, keep panning the camera. Smooth movement, no repeat lag."},
    ],
    "touch": [
        {"tier": "novice", "code": "(display (touch))",
         "note": "Where is the finger or mouse right now? Returns coordinates or #f."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (let ((t (touch)))\n      (when t\n        (camera-center-on (car t) (cadr t))))))",
         "note": "Follow the finger with the camera. Feels like drag-panning a map."},
    ],
    "sub-position-per-beat": [
        {"tier": "novice", "code": "(display (sub-position-per-beat 0.5))",
         "note": "Convert a half-beat offset into a sub-position for smooth interpolation."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (let ((p (sub-position-per-beat 0.25)))\n      (grid-cell-set! p 0 1))))",
         "note": "Move a cell one quarter of a beat at a time — a tight sequencer step."},
    ],
    "land-on-downbeat": [
        {"tier": "novice", "code": "(land-on-downbeat\n  (lambda ()\n    (display \"boom\")))",
         "note": "Run the given thunk exactly on the next downbeat. Waits for it."},
        {"tier": "intermediate", "code": "(define (drop-in)\n  (land-on-downbeat\n    (lambda ()\n      (audio-play 'bass-hit))))\n(drop-in)",
         "note": "Wait for the next downbeat, then drop a bass hit right on it. Tight."},
    ],
    "across-beats": [
        {"tier": "novice", "code": "(across-beats 'line)",
         "note": "Make a formation descriptor. Later choreography will use it to place entities."},
        {"tier": "intermediate", "code": "(define row (across-beats 'staggered))\n(display row)",
         "note": "A staggered formation feels more human than a strict grid. Hand-off row to a mover."},
    ],
    "arc-between": [
        {"tier": "novice", "code": "(define path (arc-between '(0 0) '(100 0)))\n(display path)",
         "note": "A curved path from the origin to (100, 0). Not a straight line."},
        {"tier": "intermediate", "code": "(define swoop (arc-between '(0 0) '(100 100) '(height 40)))\n(display swoop)",
         "note": "Same arc but 40 units of vertical lift. Reads as a graceful swoop."},
    ],
    "measure-content": [
        {"tier": "novice", "code": "(display (measure-content \"hello\"))",
         "note": "How wide and tall would this string be if drawn?"},
        {"tier": "intermediate", "code": "(let ((m (measure-content \"world\")))\n  (display (car m)))",
         "note": "Grab just the width of the measured content. Handy for centering text."},
    ],
    "with-spacing": [
        {"tier": "novice", "code": "(with-spacing 10\n  (display \"padded\"))",
         "note": "Pad everything inside the block by 10 units."},
        {"tier": "intermediate", "code": "(with-spacing 20\n  (display \"one\")\n  (display \"two\"))",
         "note": "The spacing applies to every draw inside the body. Two labels appear 20 units apart."},
    ],
    "with-seed": [
        {"tier": "novice", "code": "(with-seed 42\n  (display (random-int 10)))",
         "note": "Freeze the random generator to seed 42 so you get the same number every time."},
        {"tier": "intermediate", "code": "(with-seed 7\n  (list (random-int 100) (random-int 100) (random-int 100)))",
         "note": "Deterministic three-number sequence. Good for reproducible tests."},
    ],

    # ===================================================================
    # B-02 ENTITY (21 verbs)
    # ===================================================================

    "entity/all": [
        {"tier": "novice", "code": "(display (entity/all))",
         "note": "Show every entity id in the world right now."},
        {"tier": "intermediate", "code": "(for-each\n  (lambda (id)\n    (display (entity/pos id)))\n  (entity/all))",
         "note": "Walk every entity and print its position. Handy for a debug tick."},
    ],
    "entity/apply-force!": [
        {"tier": "novice", "code": "(define p (entity/make 'pebble))\n(entity/apply-force! p 5 0)",
         "note": "Give the pebble a small nudge to the right."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (when (eq? k 'up)\n      (entity/apply-force! 'hero 0 -12))))",
         "note": "Up arrow gives the hero an upward impulse. Multiple presses stack — the force is additive."},
    ],
    "entity/collisions": [
        {"tier": "novice", "code": "(display (entity/collisions 'hero))",
         "note": "Which other entities bumped into the hero on the last step?"},
        {"tier": "intermediate", "code": "(for-each\n  (lambda (other)\n    (entity/damage! 'hero 1))\n  (entity/collisions 'hero))",
         "note": "Take 1 damage per collider that touched the hero this step."},
    ],
    "entity/count": [
        {"tier": "novice", "code": "(display (entity/count))",
         "note": "How many entities are alive in the world?"},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (> (entity/count) 100)\n      (display \"too crowded\"))))",
         "note": "Notice when the world gets too dense and print a warning."},
    ],
    "entity/damage!": [
        {"tier": "novice", "code": "(entity/damage! 'enemy 5)",
         "note": "Take 5 hp off the enemy. If that puts them at or below zero, they die."},
        {"tier": "intermediate", "code": "(define (sword-hit target)\n  (entity/damage! target 10))\n(sword-hit 'goblin)",
         "note": "Wrap the damage call in a named attack for readability."},
    ],
    "entity/hp!": [
        {"tier": "novice", "code": "(entity/hp! 'hero 100)",
         "note": "Set the hero's health to 100. Overwrites whatever it was before."},
        {"tier": "intermediate", "code": "(define (revive id)\n  (entity/hp! id 100))\n(on-key\n  (lambda (k)\n    (when (eq? k 'r) (revive 'hero))))",
         "note": "Press R to revive the hero with a full bar."},
    ],
    "entity/layer!": [
        {"tier": "novice", "code": "(entity/layer! 'hero 'player)",
         "note": "Tell the physics engine that this entity belongs to the 'player layer."},
        {"tier": "intermediate", "code": "(entity/layer! 'arrow '(projectile hostile))",
         "note": "An arrow can belong to multiple layers at once — projectile AND hostile."},
    ],
    "entity/mask!": [
        {"tier": "novice", "code": "(entity/mask! 'hero 'enemy)",
         "note": "The hero only scans for collisions with entities on the 'enemy layer."},
        {"tier": "intermediate", "code": "(entity/mask! 'radar '(hostile boss))",
         "note": "A radar entity looks for both hostile things and bosses, ignoring everything else."},
    ],
    "entity/parent!": [
        {"tier": "novice", "code": "(entity/parent! 'sword 'hero)",
         "note": "Attach the sword to the hero. Where the hero goes, the sword follows."},
        {"tier": "intermediate", "code": "(entity/parent! 'sword 'hero)\n(wait 2000)\n(entity/parent! 'sword '())",
         "note": "Hold the sword for two seconds, then drop it by passing '() as the parent."},
    ],
    "entity/pose!": [
        {"tier": "novice", "code": "(entity/pose! 'hero 45)",
         "note": "Rotate the hero to 45 degrees. Just the spin — scale stays at 1."},
        {"tier": "intermediate", "code": "(entity/pose! 'hero 0 -1 1)",
         "note": "Flip the hero horizontally without rotating. sx=-1 mirrors left/right."},
    ],
    "entity/ref": [
        {"tier": "novice", "code": "(display (entity/ref 'hero 'combo))",
         "note": "Read a per-entity scratch value. If nothing was stored, you get 'nan."},
        {"tier": "intermediate", "code": "(let ((score (entity/ref 'hero 'score)))\n  (if (eq? score 'nan)\n      (display \"no score yet\")\n      (display score)))",
         "note": "Guard against the 'nan sentinel so a missing key doesn't crash your logic."},
    ],
    "entity/remove!": [
        {"tier": "novice", "code": "(entity/remove! 'debris)",
         "note": "Delete the debris entity from the world."},
        {"tier": "intermediate", "code": "(for-each entity/remove! (entity/all))",
         "note": "Wipe every entity in one sweep. Useful when a level ends."},
    ],
    "entity/rotate!": [
        {"tier": "novice", "code": "(entity/rotate! 'wheel 90)",
         "note": "Snap the wheel to 90 degrees instantly."},
        {"tier": "intermediate", "code": "(entity/rotate! 'wheel 360 ':duration 1000)",
         "note": "Spin the wheel one full turn over one second, smoothly animated."},
    ],
    "entity/sensor!": [
        {"tier": "novice", "code": "(entity/sensor! 'door-zone #t)",
         "note": "Mark the door zone as a sensor — it detects overlaps but doesn't push things."},
        {"tier": "intermediate", "code": "(entity/sensor! 'pressure-plate #t)\n(on-frame\n  (lambda ()\n    (when (pair? (entity/collisions 'pressure-plate))\n      (display \"plate triggered\"))))",
         "note": "A pressure plate is a sensor: things step on it, but nobody bounces off."},
    ],
    "entity/shape!": [
        {"tier": "novice", "code": "(entity/shape! 'pixel '((0 0)))",
         "note": "Give this entity a one-cell shape. The tiniest possible collision."},
        {"tier": "intermediate", "code": "(entity/shape! 'block '((0 0) (1 0) (0 1) (1 1)))",
         "note": "A 2 by 2 square shape — four cells in an L pattern would look different."},
    ],
    "entity/shape-flower!": [
        {"tier": "novice", "code": "(entity/shape-flower! 'bloom 5)",
         "note": "Set the entity's collision shape to a 5-petal flower."},
        {"tier": "intermediate", "code": "(entity/shape-flower! 'gear 8)\n(entity/rotate! 'gear 360 ':duration 2000)",
         "note": "An 8-petal flower shape spins like a gear over 2 seconds."},
    ],
    "entity/team!": [
        {"tier": "novice", "code": "(entity/team! 'hero 'blue)",
         "note": "Put the hero on the blue team. Collision logic can respect friendly fire."},
        {"tier": "intermediate", "code": "(for-each\n  (lambda (id)\n    (entity/team! id 'red))\n  '(enemy1 enemy2 enemy3))",
         "note": "Assign three enemies to the red team in one pass."},
    ],
    "entity/untag!": [
        {"tier": "novice", "code": "(entity/untag! 'hero 'invincible)",
         "note": "Remove the 'invincible tag from the hero. Whatever it granted is gone."},
        {"tier": "intermediate", "code": "(entity/tag! 'hero 'wet)\n(wait 3000)\n(entity/untag! 'hero 'wet)",
         "note": "Get the hero wet for three seconds, then dry them off."},
    ],
    "entity/overlaps?": [
        {"tier": "novice", "code": "(display (entity/overlaps? 'hero 'coin))",
         "note": "Are the hero and the coin touching right now? True or false."},
        {"tier": "intermediate", "code": "(when (entity/overlaps? 'hero 'coin)\n  (entity/remove! 'coin))",
         "note": "Pick up the coin the instant the hero walks over it."},
    ],
    "entity/state": [
        {"tier": "novice", "code": "(display (entity/state 'hero))",
         "note": "What FSM state is the hero in? Returns a symbol like 'idle or 'jump."},
        {"tier": "intermediate", "code": "(when (eq? (entity/state 'hero) 'idle)\n  (display \"can act\"))",
         "note": "Only allow an action when the hero is in the idle state."},
    ],
    "entity/solid!": [
        {"tier": "novice", "code": "(entity/solid! 'wall #t)",
         "note": "Mark the wall as solid. Things will bounce off it instead of passing through."},
        {"tier": "intermediate", "code": "(entity/solid! 'ghost #f)\n(entity/sensor! 'ghost #t)",
         "note": "A ghost is not solid but is a sensor — you know when someone walks through it, but they don't stop."},
    ],

    # ===================================================================
    # B-03 AI (16 verbs)
    # ===================================================================

    "ai/bt-invert": [
        {"tier": "novice", "code": "(define not-hungry (ai/bt-invert 'hungry?))\n(display not-hungry)",
         "note": "Wrap a check to flip its meaning. Now the node succeeds when the child fails."},
        {"tier": "intermediate", "code": "(define at-rest\n  (ai/bt-invert (ai/bt-condition 'moving?)))\n(display at-rest)",
         "note": "Build 'not-moving' from a 'moving?' check without writing a new condition."},
    ],
    "ai/bt-parallel": [
        {"tier": "novice", "code": "(define both\n  (ai/bt-parallel 2 'walk 'chew-gum))\n(display both)",
         "note": "A quorum of 2 out of 2. Both children must succeed for the parallel to succeed."},
        {"tier": "intermediate", "code": "(define any-two\n  (ai/bt-parallel 2 'see 'hear 'smell))\n(display any-two)",
         "note": "Three senses run in parallel. As long as any two report success, the parallel wins."},
    ],
    "ai/waypoints": [
        {"tier": "novice", "code": "(define grid (ai/grid 16 16))\n(define wps (ai/waypoints grid '((0 0) (1 0) (2 0))))\n(display wps)",
         "note": "Turn a three-cell path into world-space waypoints at cell centers."},
        {"tier": "intermediate", "code": "(define grid (ai/grid 32 32))\n(define path (ai/path grid '(0 0) '(10 10)))\n(define wps (ai/waypoints grid path))\n(display wps)",
         "note": "Run A* on the grid, then convert the cell path into waypoints an entity can steer through."},
    ],
    "ai/clear!": [
        {"tier": "novice", "code": "(define grid (ai/grid 8 8))\n(ai/wall! grid 3 3)\n(ai/clear! grid 3 3)",
         "note": "Put a wall on a cell, then take it back down. Passable again."},
        {"tier": "intermediate", "code": "(define grid (ai/grid 16 16))\n(for-each\n  (lambda (cell)\n    (ai/clear! grid (car cell) (cadr cell)))\n  '((0 0) (0 1) (0 2)))",
         "note": "Clear a small door out of a wall by opening three adjacent cells."},
    ],
    "ai/bt-force": [
        {"tier": "novice", "code": "(define always-ok\n  (ai/bt-force 'success 'try-attack))\n(display always-ok)",
         "note": "Force the child to look successful. Useful when you want the parent tree to keep going."},
        {"tier": "intermediate", "code": "(define keep-trying\n  (ai/bt-force 'running 'search))\n(display keep-trying)",
         "note": "Pin a slow action in running state so higher-level logic knows it's still busy."},
    ],
    "ai/decide": [
        {"tier": "novice", "code": "(display (ai/decide 'hero '((attack 0.8) (flee 0.3))))",
         "note": "Score each option. The higher score wins. The chosen action fires."},
        {"tier": "intermediate", "code": "(define (choose hero-id hp-frac)\n  (ai/decide hero-id\n    (list (list 'attack (- 1 hp-frac))\n          (list 'flee   hp-frac))))\n(display (choose 'hero 0.2))",
         "note": "As health falls, fleeing scores higher. The hero decides for themselves."},
    ],
    "ai/evade": [
        {"tier": "novice", "code": "(ai/evade 'mouse 'cat)",
         "note": "The mouse steers away from where the cat is heading. Not just where the cat is."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (ai/evade 'ship 'meteor 5)))",
         "note": "Every frame, the ship steers away from the meteor with a force of 5."},
    ],
    "ai/flow-at": [
        {"tier": "novice", "code": "(define field (ai/flow-field 8 8 '(4 4)))\n(display (ai/flow-at field 0 0))",
         "note": "Read the flow direction at cell (0, 0). Returns a small vector."},
        {"tier": "intermediate", "code": "(define field (ai/flow-field 16 16 '(8 8)))\n(let ((dir (ai/flow-at field 2 2)))\n  (display dir))",
         "note": "Ask a 16 by 16 flow field, aiming at (8, 8), where to go from (2, 2)."},
    ],
    "ai/passable?": [
        {"tier": "novice", "code": "(define grid (ai/grid 8 8))\n(display (ai/passable? grid 0 0))",
         "note": "Fresh grid — every cell is passable. Returns true."},
        {"tier": "intermediate", "code": "(define grid (ai/grid 8 8))\n(ai/wall! grid 2 2)\n(display (ai/passable? grid 2 2))",
         "note": "Wall a cell, then ask if it's passable. Now false."},
    ],
    "ai/bb-del!": [
        {"tier": "novice", "code": "(ai/bb-set! 'hero 'goal 'chest)\n(ai/bb-del! 'hero 'goal)",
         "note": "Store a goal, then forget it. The delete returns #t because the key existed."},
        {"tier": "intermediate", "code": "(when (ai/bb-has? 'hero 'temp)\n  (ai/bb-del! 'hero 'temp))",
         "note": "Only try to delete a key that's actually there. Defensive tidy-up."},
    ],
    "ai/bb-get": [
        {"tier": "novice", "code": "(ai/bb-set! 'hero 'goal 'chest)\n(display (ai/bb-get 'hero 'goal))",
         "note": "Store a goal in the blackboard, then read it back."},
        {"tier": "intermediate", "code": "(display (ai/bb-get 'hero 'mood 'neutral))",
         "note": "If mood isn't set, fall back to 'neutral. Default protects against missing keys."},
    ],
    "ai/bb-has?": [
        {"tier": "novice", "code": "(display (ai/bb-has? 'hero 'goal))",
         "note": "Does the hero have a 'goal on the blackboard? True or false."},
        {"tier": "intermediate", "code": "(when (not (ai/bb-has? 'hero 'goal))\n  (ai/bb-set! 'hero 'goal 'wander))",
         "note": "Only assign a goal if the hero doesn't already have one."},
    ],
    "ai/bb-set!": [
        {"tier": "novice", "code": "(ai/bb-set! 'hero 'goal 'chest)",
         "note": "Write 'goal = chest into the hero's blackboard."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (ai/bb-set! 'hero 'last-pos (entity/pos 'hero))))",
         "note": "Remember the hero's last position each frame. Handy for undo or trailing effects."},
    ],
    "ai/utility": [
        {"tier": "novice", "code": "(display (ai/utility 'hero '((sleep 0.2) (eat 0.7))))",
         "note": "Two options, two scores. The winner comes back as a tag. Here: 'eat."},
        {"tier": "intermediate", "code": "(define (score hunger tired)\n  (list (list 'eat hunger) (list 'sleep tired)))\n(display (ai/utility 'hero (score 0.9 0.4)))",
         "note": "Build the scores from actual needs. Hungry beats tired — 'eat wins."},
    ],
    "ai/arrive": [
        {"tier": "novice", "code": "(ai/arrive 'hero 100 100)",
         "note": "Steer the hero to (100, 100). Slows down as it gets close so it doesn't overshoot."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (ai/arrive 'hero 200 50 30 4)))",
         "note": "Arrive with a 30-unit slow radius and a steering force of 4. Feels smooth."},
    ],
    "ai/cohere": [
        {"tier": "novice", "code": "(ai/cohere 'bird 'flock 50)",
         "note": "Steer this bird toward the middle of nearby flockmates within 50 units."},
        {"tier": "intermediate", "code": "(for-each\n  (lambda (id)\n    (ai/cohere id 'flock 40 2))\n  (entity/all))",
         "note": "Apply the cohesion rule to every entity in the flock each step. Force of 2 keeps it gentle."},
    ],

    # ===================================================================
    # B-04 CORTEX (8 verbs)
    # ===================================================================

    "cortex/query": [
        {"tier": "novice", "code": "(display (cortex/query '(hero *)))",
         "note": "Find every stored fact whose key looks like ('hero anything). * matches any tail."},
        {"tier": "intermediate", "code": "(cortex/remember '(hero location) 'forest)\n(cortex/remember '(hero mood) 'brave)\n(display (cortex/query '(hero *)))",
         "note": "Store two facts about the hero, then query for both at once."},
    ],
    "cortex/forget": [
        {"tier": "novice", "code": "(cortex/remember 'temp 42)\n(cortex/forget 'temp)",
         "note": "Store a value, then delete it. Cortex is quieter now."},
        {"tier": "intermediate", "code": "(for-each cortex/forget (cortex/keys))",
         "note": "Wipe every stored fact. A hard reset for a fresh session."},
    ],
    "cortex/keys": [
        {"tier": "novice", "code": "(display (cortex/keys))",
         "note": "List every key Cortex is currently holding."},
        {"tier": "intermediate", "code": "(cortex/remember 'a 1)\n(cortex/remember 'b 2)\n(display (length (cortex/keys)))",
         "note": "Store two facts, then check that the key count matches."},
    ],
    "cortex/read": [
        {"tier": "novice", "code": "(cortex/remember 'hero-name \"Nova\")\n(display (cortex/read 'hero-name))",
         "note": "Store a name, then read it back."},
        {"tier": "intermediate", "code": "(let ((val (cortex/read 'missing)))\n  (if (null? val)\n      (display \"not stored\")\n      (display val)))",
         "note": "cortex/read returns nil for missing keys. Guard against it."},
    ],
    "cortex/recall": [
        {"tier": "novice", "code": "(cortex/remember 'last-score 800)\n(display (cortex/recall 'last-score))",
         "note": "Save a high score, then recall it later."},
        {"tier": "intermediate", "code": "(define (greet)\n  (let ((name (cortex/recall 'player-name)))\n    (if name\n        (display (string-append \"hi \" name))\n        (display \"hi friend\"))))",
         "note": "Recall a name if we've seen this player before. Otherwise use a friendly default."},
    ],
    "cortex/remember": [
        {"tier": "novice", "code": "(cortex/remember 'favorite-color 'blue)",
         "note": "Save a fact under the key 'favorite-color. It sticks between sessions."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (when (eq? k 's)\n      (cortex/remember 'last-save (audio-time)))))",
         "note": "Press S and remember the current time as a save point."},
    ],
    "cortex/size": [
        {"tier": "novice", "code": "(display (cortex/size))",
         "note": "Count of stored facts."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (> (cortex/size) 100)\n      (display \"cortex getting full\"))))",
         "note": "Warn when Cortex holds a lot of facts. You might want to forget some."},
    ],
    "cortex/topk": [
        {"tier": "novice", "code": "(display (cortex/topk '(hero *)))",
         "note": "Best 10 matches for the pattern, ranked by relevance."},
        {"tier": "intermediate", "code": "(display (cortex/topk '(item *) 3))",
         "note": "Just the top 3 item matches. Bounded results for tight UIs."},
    ],

    # ===================================================================
    # B-05 GRID (12 verbs) — dialect grid/*
    # ===================================================================

    "grid/card-center": [
        {"tier": "novice", "code": "(display (grid/card-center 'card-a))",
         "note": "Where's the middle of card-a? Returns a pair or #f if no such card."},
        {"tier": "intermediate", "code": "(let ((c (grid/card-center 'card-a)))\n  (when c\n    (grid/dot (car c) (cdr c) 'red)))",
         "note": "Drop a red dot at the exact center of card-a."},
    ],
    "grid/clear": [
        {"tier": "novice", "code": "(begin (grid/clear) (display \"cleared\"))",
         "note": "Clear the grid, then print a note so you know it happened."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (grid/clear)\n    (grid/dot 4 4 'green)))",
         "note": "Clear first, then draw one dot. Nothing stale lingers between frames."},
    ],
    "grid/dot": [
        {"tier": "novice", "code": "(grid/dot 3 3 'red)",
         "note": "Put a red dot at column 3, row 3. Simple and immediate."},
        {"tier": "intermediate", "code": "(let loop ((i 0))\n  (when (< i 8)\n    (grid/dot i i 'blue)\n    (loop (+ i 1))))",
         "note": "Draw a blue diagonal from the top-left corner."},
    ],
    "grid/flower-clear!": [
        {"tier": "novice", "code": "(begin (grid/flower-clear!) (display \"garden reset\"))",
         "note": "Reset the flower map and announce that the garden is empty."},
        {"tier": "intermediate", "code": "(grid/flower-spawn! 'rose 'red 2 2)\n(wait 500)\n(grid/flower-clear!)",
         "note": "Bloom a rose for half a second, then clear the whole flower map."},
    ],
    "grid/flower-go-to!": [
        {"tier": "novice", "code": "(grid/flower-go-to! 'rose 'card-a)",
         "note": "Send the rose to the center of card-a."},
        {"tier": "intermediate", "code": "(grid/flower-spawn! 'daisy 'yellow 0 0)\n(grid/flower-go-to! 'daisy 'card-b)",
         "note": "Spawn a daisy at the origin, then command it to travel toward card-b."},
    ],
    "grid/flower-list": [
        {"tier": "novice", "code": "(display (grid/flower-list))",
         "note": "Show every flower id currently on the grid."},
        {"tier": "intermediate", "code": "(for-each\n  (lambda (id)\n    (display (grid/flower-pos id)))\n  (grid/flower-list))",
         "note": "Print the position of every flower. A tiny bloom census."},
    ],
    "grid/flower-move-to!": [
        {"tier": "novice", "code": "(grid/flower-move-to! 'rose 5 5)",
         "note": "Send the rose to grid cell (5, 5). Absolute coordinates."},
        {"tier": "intermediate", "code": "(grid/flower-move-to! 'rose 10 10)\n(on-frame\n  (lambda ()\n    (when (grid/flower-settled? 'rose)\n      (display \"arrived\"))))",
         "note": "Move a flower and print a message the moment it settles."},
    ],
    "grid/flower-pos": [
        {"tier": "novice", "code": "(display (grid/flower-pos 'rose))",
         "note": "Where is the rose right now? Returns (x . y) or #f."},
        {"tier": "intermediate", "code": "(let ((p (grid/flower-pos 'rose)))\n  (when p\n    (display (car p))))",
         "note": "Pull just the x coordinate out of the position pair, guarded against #f."},
    ],
    "grid/flower-settled?": [
        {"tier": "novice", "code": "(display (grid/flower-settled? 'rose))",
         "note": "Has the rose stopped moving?"},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (when (grid/flower-settled? 'rose)\n      (grid/flower-move-to! 'rose (random-int 16) (random-int 16)))))",
         "note": "Whenever the rose settles, pick a new random spot and send it there. A wandering bloom."},
    ],
    "grid/flower-spawn!": [
        {"tier": "novice", "code": "(grid/flower-spawn! 'rose 'red 3 3)",
         "note": "Grow a red rose at (3, 3)."},
        {"tier": "intermediate", "code": "(for-each\n  (lambda (spec)\n    (grid/flower-spawn! (car spec) (cadr spec) (caddr spec) (cadddr spec)))\n  '((r red 0 0) (b blue 4 4) (y yellow 8 8)))",
         "note": "Plant three flowers of different colors in one loop."},
    ],
    "grid/flower-state!": [
        {"tier": "novice", "code": "(grid/flower-state! 'rose 'sway 5 2)",
         "note": "Make the rose sway with amplitude 5 at rate 2."},
        {"tier": "intermediate", "code": "(grid/flower-spawn! 'daisy 'white 4 4)\n(grid/flower-state! 'daisy 'pulse 3 1.5)",
         "note": "Spawn a daisy, then set it pulsing at a gentle rate."},
    ],
    "grid/glow": [
        {"tier": "novice", "code": "(grid/glow 100 100 20 'yellow 0.6)",
         "note": "A soft yellow halo of radius 20 at screen (100, 100), 60% opacity."},
        {"tier": "intermediate", "code": "(on-frame\n  (lambda ()\n    (grid/glow (pixels-wide) 0 30 'white 0.4)))",
         "note": "A steady white glow in the top-right corner, refreshed every frame."},
    ],

    # ===================================================================
    # B-06 PART (4 verbs)
    # ===================================================================

    "part/grasp": [
        {"tier": "novice", "code": "(begin (part/grasp) (display \"holding\"))",
         "note": "Mime a grasp, then log it so you can trace the sequence."},
        {"tier": "intermediate", "code": "(part/grasp 'hero 'firm 'lantern)",
         "note": "The hero grips a lantern firmly. The animation aims the hands at the target."},
    ],
    "part/shake": [
        {"tier": "novice", "code": "(begin (part/shake) (display \"nope\"))",
         "note": "Shake the head and print 'nope' so the log matches the gesture."},
        {"tier": "intermediate", "code": "(on-key\n  (lambda (k)\n    (when (eq? k 'n) (part/shake))))",
         "note": "Press N and the character shakes their head. Try it after a wrong answer."},
    ],
    "part/shrug": [
        {"tier": "novice", "code": "(begin (part/shrug) (display \"who knows\"))",
         "note": "A shrug plus a spoken 'who knows'. Body language and words agree."},
        {"tier": "intermediate", "code": "(when (not (ai/bb-has? 'hero 'plan))\n  (part/shrug))",
         "note": "If the hero has no plan on the blackboard, they shrug."},
    ],
    "part/twist": [
        {"tier": "novice", "code": "(part/twist 'hero)",
         "note": "Twist the hero's torso. Shoulders turn while the hips stay still."},
        {"tier": "intermediate", "code": "(part/twist 'hero '(angle 30 duration 400))",
         "note": "Twist 30 degrees over 400 ms. A wringing or evasive motion."},
    ],
}
