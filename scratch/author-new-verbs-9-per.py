#!/usr/bin/env python3
"""
Author 9 executable examples per new verb (19 verbs × 9 = 171 pairs).

Structure per verb: 3 novice (bare use) · 3 intermediate (composed w/ 1-2 verbs)
· 3 expert (composed into a scene/pattern).

EVERY code snippet is tested via `./bin/motoi run`. Pairs only enter the JSONL
after their code exits 0. Failures are logged, not fabricated around.
"""

import json
import subprocess
import tempfile
from pathlib import Path

MOTOI = Path.home() / "code/motoi-scheme"
OUT = Path.home() / ".forge/corpus/motoi-v8-partial/motoi-new-verbs-9-per-2026-07-19.jsonl"
FAIL_LOG = Path("/tmp/verify-fails.txt")

# ── the verb specifications ──────────────────────────────────────────
# Each entry: (verb, source_ref, [9 (prompt, response_with_code) tuples])
# tier order: 3 novice, 3 intermediate, 3 expert
VERBS = [
    # ── sleep-ms ─────────────────────────────────────────────────
    ("sleep-ms", "lib/media/media.js:540", [
        # NOVICE — bare use
        ("Pause for 250 ms.",
         "```\n(sleep-ms 250)\n```\nBlocks for a quarter second, then returns."),
        ("Pause for half a second.",
         "```\n(sleep-ms 500)\n```"),
        ("Shortest useful sleep.",
         "```\n(sleep-ms 10)\n```\nAbout one frame at 100 fps."),
        # INTERMEDIATE — composed
        ("Print then pause then print.",
         "```\n(println \"first\")\n(sleep-ms 200)\n(println \"second\")\n```"),
        ("Two kicks a beat apart at 120 BPM.",
         "```\n(kick)\n(sleep-ms 500)\n(kick)\n```"),
        ("Draw then wait then clear.",
         "```\n(begin-frame) (circle 40 40 10) (end-frame)\n(sleep-ms 300)\n(clear)\n```"),
        # EXPERT — scene/pattern
        ("Four-on-the-floor bar at 120 BPM.",
         "```\n(for-each\n  (lambda (_)\n    (kick)\n    (sleep-ms 500))\n  (list 0 1 2 3))\n```"),
        ("Blink a pixel three times.",
         "```\n(for-each\n  (lambda (_)\n    (begin-frame) (pixel 40 40) (end-frame)\n    (sleep-ms 200)\n    (clear)\n    (sleep-ms 200))\n  (list 0 1 2))\n```"),
        ("Countdown with drum on each tick.",
         "```\n(for-each\n  (lambda (n)\n    (println n)\n    (kick)\n    (sleep-ms 400))\n  (list 3 2 1))\n(println \"go\")\n```"),
    ]),

    # ── print ─────────────────────────────────────────────────────
    ("print", "lib/media/media.js:552", [
        ("Print a number.",
         "```\n(print 5)\n```\nWrites `5` to stdout with no newline."),
        ("Print a string.",
         "```\n(print \"hi\")\n```"),
        ("Print a symbol.",
         "```\n(print 'ok)\n```"),
        ("Print two values on one line.",
         "```\n(print \"score: \") (print 42)\n```"),
        ("Print with a newline after.",
         "```\n(print \"loading...\") (newline)\n```"),
        ("Print then act.",
         "```\n(print \"drawing\") (newline)\n(begin-frame) (circle 5 5 3) (end-frame)\n```"),
        ("Log each element of a list.",
         "```\n(for-each print (list 1 2 3))\n(newline)\n```\nWrites `123` then a newline."),
        ("Progress bar in prints.",
         "```\n(for-each\n  (lambda (_) (print \".\"))\n  (list 0 1 2 3 4))\n(newline)\n(print \"done\")\n```"),
        ("Print a labeled value.",
         "```\n(define x 10)\n(print \"x = \") (print x) (newline)\n```"),
    ]),

    # ── println ───────────────────────────────────────────────────
    ("println", "lib/media/media.js:555", [
        ("Print a line.",
         "```\n(println \"hello\")\n```\nWrites `hello\\n`."),
        ("Print a number on its own line.",
         "```\n(println 42)\n```"),
        ("Blank line.",
         "```\n(println)\n```\nJust a newline."),
        ("Two labeled lines.",
         "```\n(println \"score:\")\n(println 42)\n```"),
        ("Message then draw.",
         "```\n(println \"drawing a circle\")\n(begin-frame) (circle 40 40 10) (end-frame)\n```"),
        ("Log then pause.",
         "```\n(println \"ready\")\n(sleep-ms 200)\n(println \"go\")\n```"),
        ("Log each iteration.",
         "```\n(for-each\n  (lambda (n) (println n))\n  (list 1 2 3))\n```"),
        ("Countdown printout.",
         "```\n(for-each\n  (lambda (n) (println n) (sleep-ms 300))\n  (list 3 2 1))\n(println \"go\")\n```"),
        ("Print result of a computation.",
         "```\n(define (square x) (* x x))\n(println (square 7))\n```"),
    ]),

    # ── background ────────────────────────────────────────────────
    ("background", "lib/media/media.js:277", [
        ("Clear to color 0.",
         "```\n(background 0)\n```"),
        ("Fill with black.",
         "```\n(background 'black)\n```"),
        ("Fill with pink.",
         "```\n(background 'pink)\n```"),
        ("Background then draw a shape.",
         "```\n(background 'black)\n(circle 40 40 10)\n```"),
        ("Background then text.",
         "```\n(background 'pink) (set-color 'white) (draw-text \"HI\" 20 20)\n```"),
        ("Background inside a frame.",
         "```\n(begin-frame) (background 'blue) (circle 40 40 20) (end-frame)\n```"),
        ("Alternate backgrounds each frame.",
         "```\n(for-each\n  (lambda (c) (background c) (sleep-ms 200))\n  (list 'black 'white 'black))\n```"),
        ("Background then draw sprite scene.",
         "```\n(begin-frame)\n(background 'black)\n(set-color 'yellow) (circle 70 10 5)   ;; sun\n(set-color 'green) (rect-fill 0 60 80 20)  ;; ground\n(end-frame)\n```"),
        ("Reset background between draws.",
         "```\n(background 'black) (circle 20 20 10)\n(sleep-ms 200)\n(background 'black) (circle 60 60 10)\n```"),
    ]),

    # ── bg-clear ──────────────────────────────────────────────────
    ("bg-clear", "lib/media/media.js:278", [
        ("Wipe the screen.",
         "```\n(bg-clear)\n```"),
        ("Wipe to a color.",
         "```\n(bg-clear 3)\n```"),
        ("Wipe to a named color.",
         "```\n(bg-clear 'pink)\n```"),
        ("Wipe then draw.",
         "```\n(bg-clear)\n(circle 40 40 10)\n```"),
        ("Wipe then text.",
         "```\n(bg-clear 'black) (set-color 'white) (draw-text \"OK\" 5 5)\n```"),
        ("Wipe inside frame.",
         "```\n(begin-frame) (bg-clear 'blue) (disc 40 40 15) (end-frame)\n```"),
        ("Wipe-draw-wait loop.",
         "```\n(for-each\n  (lambda (x)\n    (bg-clear 'black)\n    (circle x 40 8)\n    (sleep-ms 200))\n  (list 20 40 60))\n```"),
        ("Wipe then multi-draw.",
         "```\n(bg-clear 'cream)\n(set-color 'cedar) (rectangle 20 40 40 20)  ;; wall\n(set-color 'cedar) (line 20 40 40 20)         ;; roof\n(set-color 'pink) (disc 40 25 5)              ;; window\n```"),
        ("Wipe then draw score.",
         "```\n(bg-clear)\n(define score 12)\n(set-color 'white) (draw-text \"SCORE\" 5 5)\n(println score)\n```"),
    ]),

    # ── draw-text ─────────────────────────────────────────────────
    ("draw-text", "lib/graphics/framebuffer-verbs.js:170", [
        ("Draw HI at (5,5).",
         "```\n(begin-frame) (draw-text \"HI\" 5 5) (end-frame)\n```"),
        ("Draw a title.",
         "```\n(begin-frame) (draw-text \"MOTOI\" 20 30) (end-frame)\n```"),
        ("Draw a score value.",
         "```\n(begin-frame) (draw-text \"SCORE 100\" 5 5) (end-frame)\n```"),
        ("Colored text.",
         "```\n(begin-frame) (set-color 'pink) (draw-text \"HELLO\" 10 10) (end-frame)\n```"),
        ("Text over a background.",
         "```\n(begin-frame) (background 'black) (set-color 'white) (draw-text \"OK\" 5 5) (end-frame)\n```"),
        ("Two labeled lines.",
         "```\n(begin-frame)\n(draw-text \"HP\"    5 5)\n(draw-text \"MANA\" 5 15)\n(end-frame)\n```"),
        ("Title screen with text.",
         "```\n(begin-frame)\n(background 'black)\n(set-color 'pink)  (draw-text \"MOTOI\"  20 30)\n(set-color 'white) (draw-text \"press key\" 15 50)\n(end-frame)\n```"),
        ("Text with a bordering rectangle.",
         "```\n(begin-frame)\n(background 'cream)\n(set-color 'cedar) (rectangle 4 4 60 12)\n(set-color 'cedar) (draw-text \"MENU\" 10 8)\n(end-frame)\n```"),
        ("Frame counter overlay.",
         "```\n(define fno 0)\n(begin-frame)\n(background 'black)\n(set-color 'white) (draw-text \"F 0\" 5 5)\n(end-frame)\n```"),
    ]),

    # ── kick ──────────────────────────────────────────────────────
    ("kick", "lib/audio/audio-verbs.js:170", [
        ("One kick.",
         "```\n(kick)\n```"),
        ("Kick at step 0.",
         "```\n(kick 0)\n```"),
        ("Two kicks in a row.",
         "```\n(kick) (kick)\n```"),
        ("Kick then pause then kick.",
         "```\n(kick) (sleep-ms 500) (kick)\n```"),
        ("Kick with a snare after.",
         "```\n(kick) (sleep-ms 250) (snare)\n```"),
        ("Kick pattern using a list.",
         "```\n(for-each (lambda (_) (kick) (sleep-ms 300)) (list 0 1 2))\n```"),
        ("Four-on-the-floor bar.",
         "```\n(for-each\n  (lambda (_) (kick) (sleep-ms 500))\n  (list 0 1 2 3))\n```"),
        ("Kick-snare-kick-snare.",
         "```\n(kick) (sleep-ms 250) (snare) (sleep-ms 250)\n(kick) (sleep-ms 250) (snare)\n```"),
        ("Countdown with kicks.",
         "```\n(for-each\n  (lambda (n) (println n) (kick) (sleep-ms 400))\n  (list 3 2 1))\n```"),
    ]),

    # ── snare ─────────────────────────────────────────────────────
    ("snare", "lib/audio/audio-verbs.js:171", [
        ("One snare.",
         "```\n(snare)\n```"),
        ("Snare at step 4.",
         "```\n(snare 4)\n```"),
        ("Two snares.",
         "```\n(snare) (snare)\n```"),
        ("Kick then snare.",
         "```\n(kick) (sleep-ms 250) (snare)\n```"),
        ("Snare offset from a kick.",
         "```\n(kick) (sleep-ms 500) (snare)\n```"),
        ("Kick-snare bar.",
         "```\n(kick) (sleep-ms 500) (snare) (sleep-ms 500)\n(kick) (sleep-ms 500) (snare)\n```"),
        ("Backbeat: snare on 2 and 4.",
         "```\n(for-each\n  (lambda (step)\n    (kick)\n    (sleep-ms 250)\n    (when (odd? step) (snare))\n    (sleep-ms 250))\n  (list 0 1 2 3))\n```"),
        ("Snare rolls.",
         "```\n(for-each\n  (lambda (_) (snare) (sleep-ms 80))\n  (list 0 1 2 3 4 5))\n```"),
        ("Fill: snare snare snare kick.",
         "```\n(snare) (sleep-ms 150) (snare) (sleep-ms 150)\n(snare) (sleep-ms 150) (kick)\n```"),
    ]),

    # ── hat ───────────────────────────────────────────────────────
    ("hat", "lib/audio/audio-verbs.js:172", [
        ("One hi-hat.",
         "```\n(hat)\n```"),
        ("Hat at step 2.",
         "```\n(hat 2)\n```"),
        ("Four hats.",
         "```\n(hat) (hat) (hat) (hat)\n```"),
        ("Hat between kicks.",
         "```\n(kick) (sleep-ms 250) (hat) (sleep-ms 250) (kick)\n```"),
        ("Eighth-note hi-hats.",
         "```\n(for-each\n  (lambda (_) (hat) (sleep-ms 125))\n  (list 0 1 2 3 4 5 6 7))\n```"),
        ("Hat with a beat.",
         "```\n(kick) (sleep-ms 125) (hat) (sleep-ms 125)\n(snare) (sleep-ms 125) (hat)\n```"),
        ("Hats over kick-snare pattern.",
         "```\n(for-each\n  (lambda (step)\n    (kick)\n    (sleep-ms 125)\n    (hat)\n    (sleep-ms 125))\n  (list 0 1 2 3))\n```"),
        ("Ghost hats fill.",
         "```\n(for-each\n  (lambda (_) (hat) (sleep-ms 60))\n  (list 0 1 2 3 4 5 6 7 8 9))\n```"),
        ("Hi-hat on offbeat.",
         "```\n(for-each\n  (lambda (step)\n    (kick)\n    (sleep-ms 250)\n    (hat)\n    (sleep-ms 250))\n  (list 0 1 2 3))\n```"),
    ]),

    # ── crash ─────────────────────────────────────────────────────
    ("crash", "lib/audio/audio-verbs.js:173", [
        ("One crash.",
         "```\n(crash)\n```"),
        ("Crash at step 0.",
         "```\n(crash 0)\n```"),
        ("Crash then pause.",
         "```\n(crash) (sleep-ms 500)\n```"),
        ("Crash on the downbeat.",
         "```\n(crash) (sleep-ms 250) (kick) (sleep-ms 250) (snare)\n```"),
        ("Kick + crash together.",
         "```\n(kick) (crash)\n```"),
        ("Crash at bar boundary.",
         "```\n(for-each\n  (lambda (_) (kick) (sleep-ms 500))\n  (list 0 1 2))\n(crash)\n```"),
        ("Fill ending in crash.",
         "```\n(snare) (sleep-ms 125) (snare) (sleep-ms 125)\n(snare) (sleep-ms 125) (crash)\n```"),
        ("Two-bar loop crash on the 1.",
         "```\n(for-each\n  (lambda (bar)\n    (when (= bar 0) (crash))\n    (kick) (sleep-ms 500)\n    (snare) (sleep-ms 500))\n  (list 0 1))\n```"),
        ("Chord change accent: crash under a note.",
         "```\n(crash) (note 'A4 0.4)\n```"),
    ]),

    # ── clap ──────────────────────────────────────────────────────
    ("clap", "lib/audio/audio-verbs.js:174", [
        ("One clap.",
         "```\n(clap)\n```"),
        ("Clap at step 4.",
         "```\n(clap 4)\n```"),
        ("Clap on the offbeat.",
         "```\n(sleep-ms 250) (clap)\n```"),
        ("Kick then clap.",
         "```\n(kick) (sleep-ms 250) (clap)\n```"),
        ("Clap as backbeat.",
         "```\n(kick) (sleep-ms 500) (clap)\n(sleep-ms 500) (kick) (sleep-ms 500) (clap)\n```"),
        ("Doubled claps.",
         "```\n(clap) (sleep-ms 60) (clap)\n```"),
        ("Hip-hop pattern.",
         "```\n(kick) (sleep-ms 250) (hat)\n(sleep-ms 250) (clap) (sleep-ms 250) (hat)\n```"),
        ("Alternating clap and snare.",
         "```\n(for-each\n  (lambda (step)\n    (kick)\n    (sleep-ms 250)\n    (if (even? step) (snare) (clap))\n    (sleep-ms 250))\n  (list 0 1 2 3))\n```"),
        ("Clap fill.",
         "```\n(for-each\n  (lambda (_) (clap) (sleep-ms 100))\n  (list 0 1 2))\n```"),
    ]),

    # ── motoi/stack ──────────────────────────────────────────────
    ("motoi/stack", "lib/system/stack.js", [
        ("Read the stack right now.",
         "```\n(motoi/stack)\n```"),
        ("Print current stack.",
         "```\n(println (motoi/stack))\n```"),
        ("Save stack to a variable.",
         "```\n(define frames (motoi/stack))\n(println frames)\n```"),
        ("Stack after a clear.",
         "```\n(motoi/stack-clear!)\n(println (motoi/stack))\n```"),
        ("Stack inside a computation.",
         "```\n(define (peek) (motoi/stack))\n(println (peek))\n```"),
        ("Compare stacks before and after a call.",
         "```\n(define a (motoi/stack))\n(println (list? a))\n(define b (motoi/stack))\n(println (equal? a b))\n```"),
        ("Debug depth of a recursive call.",
         "```\n(motoi/stack-clear!)\n(define (deep n)\n  (if (zero? n) (motoi/stack) (deep (- n 1))))\n(println (deep 5))\n```"),
        ("Log frames each iteration.",
         "```\n(for-each\n  (lambda (n)\n    (println (list n (motoi/stack))))\n  (list 1 2 3))\n```"),
        ("Save then compare.",
         "```\n(motoi/stack-clear!)\n(define s1 (motoi/stack))\n(kick)\n(define s2 (motoi/stack))\n(println (equal? s1 s2))\n```"),
    ]),

    # ── motoi/stack-peak ─────────────────────────────────────────
    ("motoi/stack-peak", "lib/system/stack.js", [
        ("Read the peak stack.",
         "```\n(motoi/stack-peak)\n```"),
        ("Print peak stack after clearing.",
         "```\n(motoi/stack-clear!)\n(println (motoi/stack-peak))\n```"),
        ("Peak after one call.",
         "```\n(motoi/stack-clear!)\n(kick)\n(println (motoi/stack-peak))\n```"),
        ("Compare peak and live.",
         "```\n(motoi/stack-clear!)\n(println (motoi/stack))\n(println (motoi/stack-peak))\n```"),
        ("Peak during recursion.",
         "```\n(motoi/stack-clear!)\n(define (deep n) (if (zero? n) 0 (deep (- n 1))))\n(deep 10)\n(println (motoi/stack-peak))\n```"),
        ("Reset then measure.",
         "```\n(motoi/stack-clear!)\n(for-each (lambda (_) (println \"tick\")) (list 0 1 2))\n(println (motoi/stack-peak))\n```"),
        ("Peak across two runs.",
         "```\n(motoi/stack-clear!)\n(println 1)\n(define first (motoi/stack-peak))\n(motoi/stack-clear!)\n(println 2)\n(define second (motoi/stack-peak))\n(println (list first second))\n```"),
        ("Profile a helper.",
         "```\n(define (fact n) (if (zero? n) 1 (* n (fact (- n 1)))))\n(motoi/stack-clear!)\n(fact 5)\n(println (motoi/stack-peak))\n```"),
        ("Log peak after each of several calls.",
         "```\n(for-each\n  (lambda (n)\n    (motoi/stack-clear!)\n    (kick)\n    (println (list n (motoi/stack-peak))))\n  (list 1 2 3))\n```"),
    ]),

    # ── motoi/stack-depth ────────────────────────────────────────
    ("motoi/stack-depth", "lib/system/stack.js", [
        ("Current depth.",
         "```\n(motoi/stack-depth)\n```"),
        ("Print current depth.",
         "```\n(println (motoi/stack-depth))\n```"),
        ("Depth after clear.",
         "```\n(motoi/stack-clear!)\n(println (motoi/stack-depth))\n```"),
        ("Depth inside a function.",
         "```\n(define (report) (motoi/stack-depth))\n(println (report))\n```"),
        ("Depth grows with recursion.",
         "```\n(define (deep n)\n  (if (zero? n) (motoi/stack-depth) (deep (- n 1))))\n(println (deep 5))\n```"),
        ("Depth on each recursion step.",
         "```\n(define (steps n)\n  (println (motoi/stack-depth))\n  (if (zero? n) 'done (steps (- n 1))))\n(steps 3)\n```"),
        ("Depth is an integer.",
         "```\n(println (number? (motoi/stack-depth)))\n```"),
        ("Depth doubled.",
         "```\n(println (* 2 (motoi/stack-depth)))\n```"),
        ("Depth trends across iterations.",
         "```\n(for-each\n  (lambda (n) (println (list n (motoi/stack-depth))))\n  (list 1 2 3))\n```"),
    ]),

    # ── motoi/stack-clear! ───────────────────────────────────────
    ("motoi/stack-clear!", "lib/system/stack.js", [
        ("Reset the peak.",
         "```\n(motoi/stack-clear!)\n```"),
        ("Clear then measure.",
         "```\n(motoi/stack-clear!)\n(println (motoi/stack-peak))\n```"),
        ("Clear returns nothing useful.",
         "```\n(println (motoi/stack-clear!))\n```"),
        ("Clear before profiling.",
         "```\n(motoi/stack-clear!)\n(kick) (kick)\n(println (motoi/stack-peak))\n```"),
        ("Clear inside a function.",
         "```\n(define (profile)\n  (motoi/stack-clear!)\n  (println (motoi/stack-depth)))\n(profile)\n```"),
        ("Clear each time in a loop.",
         "```\n(for-each\n  (lambda (n)\n    (motoi/stack-clear!)\n    (println (list n (motoi/stack-depth))))\n  (list 1 2 3))\n```"),
        ("Clear before recursion.",
         "```\n(motoi/stack-clear!)\n(define (fact n) (if (zero? n) 1 (* n (fact (- n 1)))))\n(fact 6)\n(println (motoi/stack-peak))\n```"),
        ("Clear at start of benchmark.",
         "```\n(motoi/stack-clear!)\n(for-each kick (list 0 1 2 3))\n(println (motoi/stack-peak))\n```"),
        ("Clear then compare to non-clear.",
         "```\n(kick)\n(define a (motoi/stack-peak))\n(motoi/stack-clear!)\n(define b (motoi/stack-peak))\n(println (list a b))\n```"),
    ]),

    # ── composer/cart-emit ───────────────────────────────────────
    ("composer/cart-emit", "lib/composer/composer.js", [
        ("Emit an empty cart.",
         "```\n(composer/cart-emit (composer/cart-empty))\n```"),
        ("Print the emit result.",
         "```\n(println (composer/cart-emit (composer/cart-empty)))\n```"),
        ("Save emit result to a variable.",
         "```\n(define bundle (composer/cart-emit (composer/cart-empty)))\n(println bundle)\n```"),
        ("Emit is a list of alist entries.",
         "```\n(println (list? (composer/cart-emit (composer/cart-empty))))\n```"),
        ("Emit twice, same result.",
         "```\n(define a (composer/cart-emit (composer/cart-empty)))\n(define b (composer/cart-emit (composer/cart-empty)))\n(println (equal? a b))\n```"),
        ("Emit and inspect count.",
         "```\n(define bundle (composer/cart-emit (composer/cart-empty)))\n(println (length bundle))\n```"),
        ("Emit and pluck a section.",
         "```\n(define bundle (composer/cart-emit (composer/cart-empty)))\n(println (assq ':meta bundle))\n```"),
        ("Emit-apply-emit round trip.",
         "```\n(define c1 (composer/cart-empty))\n(define t  (composer/cart-emit c1))\n(println (equal? t (composer/cart-emit c1)))\n```"),
        ("Emit and count non-empty sections.",
         "```\n(define bundle (composer/cart-emit (composer/cart-empty)))\n(println (length bundle))\n```"),
    ]),

    # ── composer/cart-apply ──────────────────────────────────────
    ("composer/cart-apply", "lib/composer/composer.js", [
        ("Apply an empty template to a cart.",
         "```\n(composer/cart-apply (composer/cart-empty) (composer/cart-empty))\n```"),
        ("Print the applied result.",
         "```\n(println (composer/cart-apply (composer/cart-empty) (composer/cart-empty)))\n```"),
        ("Apply preserves shape.",
         "```\n(define c (composer/cart-empty))\n(println (equal? c (composer/cart-apply c (composer/cart-emit c))))\n```"),
        ("Round-trip contract.",
         "```\n(define c (composer/cart-empty))\n(println (equal? c (composer/cart-apply c (composer/cart-emit c))))\n```"),
        ("Apply returns a cart record.",
         "```\n(println (list? (composer/cart-apply (composer/cart-empty) (composer/cart-empty))))\n```"),
        ("Apply twice = idempotent for empty.",
         "```\n(define c (composer/cart-empty))\n(define t (composer/cart-emit c))\n(println (equal? (composer/cart-apply c t) (composer/cart-apply c t)))\n```"),
        ("Emit result feeds apply.",
         "```\n(define c (composer/cart-empty))\n(define bundle (composer/cart-emit c))\n(println (composer/cart-apply c bundle))\n```"),
        ("Verify emit then apply reproduces.",
         "```\n(define c1 (composer/cart-empty))\n(define t  (composer/cart-emit c1))\n(define c2 (composer/cart-apply c1 t))\n(println (equal? c1 c2))\n```"),
        ("Apply an emit is the identity.",
         "```\n(define c (composer/cart-empty))\n(println (equal? c (composer/cart-apply c (composer/cart-emit c))))\n```"),
    ]),

    # ── composer/cart-empty ──────────────────────────────────────
    ("composer/cart-empty", "lib/composer/composer.js", [
        ("Get an empty cart.",
         "```\n(composer/cart-empty)\n```"),
        ("Print an empty cart.",
         "```\n(println (composer/cart-empty))\n```"),
        ("Save an empty cart.",
         "```\n(define c (composer/cart-empty))\n(println c)\n```"),
        ("Empty carts are equal.",
         "```\n(println (equal? (composer/cart-empty) (composer/cart-empty)))\n```"),
        ("Empty cart has :meta section.",
         "```\n(define c (composer/cart-empty))\n(println (assq ':meta c))\n```"),
        ("Empty cart has :code section.",
         "```\n(define c (composer/cart-empty))\n(println (assq ':code c))\n```"),
        ("Empty cart round-trips.",
         "```\n(define c (composer/cart-empty))\n(println (equal? c (composer/cart-apply c (composer/cart-emit c))))\n```"),
        ("Empty cart is a list.",
         "```\n(println (list? (composer/cart-empty)))\n```"),
        ("Empty cart has 7 sections.",
         "```\n(println (length (composer/cart-empty)))\n```"),
    ]),

    # ── motoi/hacker-mode-on! ────────────────────────────────────
    ("motoi/hacker-mode-on!", "lib/system/hacker-mode.js", [
        ("Turn on hacker mode.",
         "```\n(motoi/hacker-mode-on!)\n```"),
        ("Then print in the new mode.",
         "```\n(motoi/hacker-mode-on!) (println \"in hacker mode\")\n```"),
        ("Turn it back off.",
         "```\n(motoi/hacker-mode-on!) (motoi/hacker-mode-off!)\n```"),
        ("Hacker mode then draw.",
         "```\n(motoi/hacker-mode-on!)\n(begin-frame) (background 'black) (set-color 'green) (draw-text \"ok\" 5 5) (end-frame)\n```"),
        ("Toggle sequence.",
         "```\n(motoi/hacker-mode-on!)\n(println \"green\")\n(motoi/hacker-mode-off!)\n(println \"cherry\")\n```"),
        ("Hacker mode with a beat.",
         "```\n(motoi/hacker-mode-on!)\n(kick) (sleep-ms 200) (snare)\n```"),
        ("Wrap a block in hacker mode.",
         "```\n(motoi/hacker-mode-on!)\n(for-each println (list 1 2 3))\n(motoi/hacker-mode-off!)\n```"),
        ("Hacker mode inside a define.",
         "```\n(define (silent-run body)\n  (motoi/hacker-mode-on!)\n  (body)\n  (motoi/hacker-mode-off!))\n(silent-run (lambda () (println \"hi\")))\n```"),
        ("Confirm hacker mode is on.",
         "```\n(motoi/hacker-mode-on!)\n(println \"i should still print because you asked\")\n```"),
    ]),
]


def extract_code(response):
    """Pull the ```...``` code block out of a response body."""
    start = response.find("```")
    if start < 0:
        return None
    end = response.find("```", start + 3)
    if end < 0:
        return None
    return response[start + 3:end].strip()


def verify(code):
    """Run the code through ./bin/motoi run; return (ok, tail)."""
    with tempfile.NamedTemporaryFile("w", suffix=".scm", delete=False) as f:
        f.write(code + "\n")
        path = f.name
    try:
        r = subprocess.run(
            [str(MOTOI / "bin/motoi"), "run", path],
            capture_output=True, text=True, timeout=15,
            cwd=str(MOTOI),
        )
        # Motoi's "error:" is on stderr and also the exit code is non-zero
        tail = (r.stdout + r.stderr).strip().splitlines()[-3:] if (r.stdout + r.stderr).strip() else []
        return r.returncode == 0 and "error:" not in (r.stdout + r.stderr), "\n".join(tail)
    except subprocess.TimeoutExpired:
        return False, "timeout"


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fails = []
    written = 0
    total = 0
    with open(OUT, "w") as out:
        for verb, source, examples in VERBS:
            assert len(examples) == 9, f"{verb}: expected 9 examples, got {len(examples)}"
            for i, (prompt, response) in enumerate(examples):
                total += 1
                tier = "novice" if i < 3 else ("intermediate" if i < 6 else "expert")
                code = extract_code(response)
                if not code:
                    fails.append((verb, i, tier, "no code block", ""))
                    continue
                ok, tail = verify(code)
                if not ok:
                    fails.append((verb, i, tier, "run failed", tail))
                    continue
                pair = {
                    "messages": [
                        {"role": "user", "content": prompt},
                        {"role": "assistant", "content": response},
                    ],
                    "_meta": {
                        "bucket": f"new-verb-teaching-{tier}",
                        "source": source,
                        "tier": tier,
                        "verb": verb,
                        "provenance": "authored + verified 2026-07-19",
                    },
                }
                out.write(json.dumps(pair, ensure_ascii=False) + "\n")
                written += 1
    print(f"total examples: {total}")
    print(f"written: {written}")
    print(f"failed:  {len(fails)}")
    if fails:
        with open(FAIL_LOG, "w") as f:
            for verb, i, tier, kind, tail in fails:
                f.write(f"{verb}[{i} · {tier}] :: {kind}\n{tail}\n\n")
        print(f"fail-log at {FAIL_LOG}")
        for verb, i, tier, kind, tail in fails[:8]:
            print(f"  FAIL {verb}[{i} · {tier}] :: {kind} :: {tail!r}")


if __name__ == "__main__":
    main()
