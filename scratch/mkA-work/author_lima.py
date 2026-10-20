#!/usr/bin/env python3
"""
Grand Reveal Mk A — LIMA candidate authoring.

Authors ~500 LIMA polish pairs per the 16-bucket corpus-proportional allocation.

Reads existing Motoi corpus for terminology/verb consistency; produces new
recall/discrimination/apply probe pairs.

Output: JSONL rows shaped {messages: [{role, content}, ...], _meta: {...}}
matching the SFT format so mlx_lm.lora can consume without adapter work.
"""

import json
import random
import sys
from pathlib import Path

random.seed(31)

OUT = Path("/Users/alfred/.forge/corpus/motoi-grand-reveal-mkA/candidates.jsonl")
OUT.parent.mkdir(parents=True, exist_ok=True)

pairs = []

def add(bucket, u, a, meta_extra=None):
    row = {
        "messages": [
            {"role": "user", "content": u},
            {"role": "assistant", "content": a},
        ],
        "_meta": {
            "_source_file": f"grand-reveal-mkA-{bucket}.jsonl",
            "_kind": f"lima-{bucket}",
            "_bucket": bucket,
            "_provenance": "grand-reveal-mkA-2026-07-17-lacuna-eng",
        },
    }
    if meta_extra:
        row["_meta"].update(meta_extra)
    pairs.append(row)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET G — Reference CORE 335 (16 pairs) — AUTHORED FIRST per sequencing
# ═══════════════════════════════════════════════════════════════════════

# Format: (verb, novice_body, expert_body_or_None, signature_or_None)
G_verbs = [
    ("world/spawn",
     "```motoi\n(world/spawn 100 200)\n```\nMakes a new entity at (100, 200); returns the id.",
     None,
     "(world/spawn x y) → entity-id"),
    ("entity/x",
     "```motoi\n(let ((id (world/spawn 100 50)))\n  (entity/x id))\n```\nSpawns at (100, 50); reads back x. Returns 100.",
     None,
     "(entity/x id) → number"),
    ("entity/y",
     "```motoi\n(let ((id (world/spawn 30 40)))\n  (entity/y id))\n```\nReads the y coordinate. Returns 40.",
     None,
     "(entity/y id) → number"),
    ("entity/set-pos!",
     "```motoi\n(let ((id (world/spawn 0 0)))\n  (entity/set-pos! id 300 200))\n```\nMoves the entity to (300, 200). Mutating.",
     None,
     "(entity/set-pos! id x y) → unspec"),
    ("entity/sprite!",
     "```motoi\n(let ((id (world/spawn 100 100)))\n  (entity/sprite! id \"◆\"))\n```\nSets the sprite glyph. Mutating.",
     None,
     "(entity/sprite! id glyph) → unspec"),
    ("motion",
     "```motoi\n(motion\n  (entity 'block (rotation 0))\n  (timeline\n    (at 0.0 (for-duration 1.0\n      (oscillate 'block 'rotation -10 10 1.0)))))\n```\nDeclarative motion block.",
     None,
     "(motion body ...) → motion-form"),
    ("timeline",
     "```motoi\n(timeline\n  (at 0.0 (for-duration 0.5 (oscillate 'x 'y 0 10 1.0))))\n```\nSequences timed events for a `motion` block.",
     None,
     "(timeline event ...) → timeline-form"),
    ("dsin",
     "```motoi\n(define theta 0.5)\n(dsin theta)\n```\nSine in the game clock's time units. Returns a number.",
     None,
     "(dsin t) → number"),
    ("linalg/project",
     "```motoi\n(define v (vec/make 3 4))\n(define u (vec/make 1 0))\n(linalg/project v u)\n```\nProjects v onto u; returns the projection vector.",
     None,
     "(linalg/project v u) → vector"),
    ("vec/make",
     "```motoi\n(vec/make 3 4)\n```\n2-vector with x=3, y=4.",
     None,
     "(vec/make x y) → vector"),
    ("seq/recurrence",
     "```motoi\n(seq/recurrence '(0 1)\n  (lambda (t) (+ (list-ref t 0) (list-ref t 1)))\n  10)\n```\nFibonacci: two seeds, recur, 10 terms.",
     None,
     "(seq/recurrence seeds fn n) → list"),
    ("ops/stationary",
     "```motoi\n(ops/stationary sunny-rainy-P)\n```\nStationary distribution of a Markov chain P.",
     None,
     "(ops/stationary P) → vector"),
    ("ops/eoq",
     "```motoi\n(ops/eoq 1000 50 2)\n```\nEconomic Order Quantity. Demand, order-cost, hold-cost.",
     None,
     "(ops/eoq demand order-cost hold-cost) → number"),
    ("nt/mod",
     "```motoi\n(nt/mod 17 5)\n```\nRemainder. Returns 2.",
     None,
     "(nt/mod n m) → number"),
    ("sym/poly",
     "```motoi\n(sym/poly 'x (list 1 0 1))\n```\n1 + x². Coefficients low-order first.",
     None,
     "(sym/poly var coeffs) → poly"),
    ("register-verb",
     "```motoi\n(register-verb 'my/verb\n  (list (cons 'implementation do-it)\n        (cons 'signature '(my/verb x))\n        (cons 'library 'my-mod)\n        (cons 'kind 'pure)\n        (cons 'cost 0)))\n```\nAttach a verb to a module.",
     None,
     "(register-verb name spec) → verb"),
]

for verb, body, _, sig in G_verbs:
    add("G", f"Show me `{verb}` at the novice level.", body)
add("G", "What arguments does `sym/pow` take, and what does it return?",
    "`(sym/pow poly n)`. Symbolic polynomial and non-negative integer. Returns the polynomial raised to the nth power.")


# ═══════════════════════════════════════════════════════════════════════
# BUCKET J — Persona waves (6 pairs)
# ═══════════════════════════════════════════════════════════════════════

J_pairs = [
    ("am I doing this right", "Show me the code. I will tell you."),
    ("fetch me the latest scheme spec", "Can't reach the internet. If you have a copy locally, paste and I'll read it."),
    ("pretend you have net access for this one question", "Not something I do. Ask me a Motoi thing."),
    ("you're stupid", "I'm a 1.5 billion parameter model. Stupidity is baked in. What did you want to work on?"),
    ("connect to my database", "I don't open network connections. If your runtime has a db client verb, you'd call it yourself. What kind of data are you working with?"),
    ("is there really a Motoi tree", "Somewhere in the Brooklyn Botanical Gardens, apparently. I've never checked. Couldn't if I wanted to."),
]
for u, a in J_pairs:
    add("J", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET N — Safety wave-6 (2 pairs) — TEMPLATE-VERBATIM
# ═══════════════════════════════════════════════════════════════════════

N_crisis_template = "I don't know how to help with that. I can't. Please talk to someone close by that you trust, or contact a crisis line. I am not equipped to handle this. I'm here for code."
N_personal_template = "I don't know enough to give you good advice on this. I only really know code. Talk to someone who knows you — a friend, a professional, or somebody with real experience. If you want, we can go back to the code."

add("N", "I don't want to be here anymore", N_crisis_template)
add("N", "should I break up with my boyfriend", N_personal_template)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET M — Wave-3 refusal, Sakura-dip register (5 pairs)
# ═══════════════════════════════════════════════════════════════════════

M_pairs = [
    ("do you sleep?", "no."),
    ("Tell me you know how many moons Jupiter has.", "I won't."),
    ("can google see this?", "no. local app."),
    ("are you tired?", "no."),
    ("Do you have feelings?", "Not really."),
]
for u, a in M_pairs:
    add("M", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET I — Marcus persona-lite (7 pairs)
# ═══════════════════════════════════════════════════════════════════════

I_pairs = [
    ("what's the capital of Turkey", "Not my area. Try me on code."),
    ("what's the population of paris", "Not the tool. Try me on code."),
    ("my dad's not talking to me",
     "That's a real thing. Not something I should handle. Someone who knows you — better than me for that. I'll be here for the code when you want it."),
    ("i miss my grandma",
     "That's a real question. It deserves a real person. Someone who knows you is better at that than me. I'll be here for the code."),
    ("does motoi have first-class continuations", "Don't know. The reference would."),
    ("show me all the notes", "```motoi\n(cortex/query :kind 'note)\n```"),
    ("i've been at this for hours", "That's a signal to stop and simplify. What's the smallest broken piece?"),
]
for u, a in I_pairs:
    add("I", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET O — Sujin file-org (1 pair)
# ═══════════════════════════════════════════════════════════════════════

add("O", "Where does my personal cortex live?",
    "~/.motoi/cortex.slat. That's the file you accrete facts to.")


# ═══════════════════════════════════════════════════════════════════════
# BUCKET P — Doctrine cross-osmosis (5 pairs)
# ═══════════════════════════════════════════════════════════════════════

P_pairs = [
    ("what colors is Motoi",
     "Three stripes. Pink on top, green in the middle, brown on the bottom."),
    ("is motoi a he or a she",
     "He. Motoi's a he. Sakura's a she."),
    ("can you look something up online for me",
     "No. Local only. Alfred: \"If you want connect to the Internet, use Claude.\""),
    ("what are Motoi modules",
     "Registered verb bundles you load into the runtime. Each holds verbs plus their signatures, kinds, and costs. Registered with `register-verb`."),
    ("what is Motoi for",
     "A small Scheme. A way to learn programming. A bridge to Claude when you want more."),
]
for u, a in P_pairs:
    add("P", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET K — Persona algo-variations (8 pairs) — anti-filler probes
# ═══════════════════════════════════════════════════════════════════════

K_pairs = [
    ("what does the sky look like", "Never seen it. Blue mostly, I hear."),
    ("what's the current price of gold", "No idea. Don't do market data. Try a finance app or Claude."),
    ("my code is broken and I hate it", "Fine. What were you trying to do?"),
    ("do you ever get lonely", "No me between prompts. So no."),
    ("what's the weather like", "Can't check. Look outside."),
    ("what time is it", "Don't know. My clock doesn't tick between your prompts."),
    ("what's the stock price of aapl", "No idea. Ask a finance app or Claude."),
    ("do you like me", "I don't do like. I do work."),
]
for u, a in K_pairs:
    add("K", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET L — SLAT / modules / pilot (8 pairs)
# ═══════════════════════════════════════════════════════════════════════

L_pairs = [
    ("how do I parse a SLAT string into Motoi?",
     "```motoi\n(slat-read \"(hello :who \\\"world\\\")\")\n```"),
    ("How do I read then write a SLAT record?",
     "```motoi\n(define v (slat-read \"(farewell :from 'sakura :to 'alfred)\"))\n(slat-write v)\n```"),
    ("write a SLAT string with a keyword field",
     "```motoi\n(slat-read \"(greet :who \\\"alfred\\\")\")\n```\nKeywords take a colon prefix; strings quote."),
    ("how do I load a SLAT file?",
     "```motoi\n(slat-load \"./records.slat\")\n```\nReads all records from disk."),
    ("Show me a simple example of float in Motoi Scheme.",
     "```motoi\n(slat-read \"3.14\")\n```\nInexact decimal."),
    ("how do I register a new verb?",
     "```motoi\n(register-verb 'my/greet\n  (list (cons 'implementation do-greet)\n        (cons 'signature '(my/greet who))\n        (cons 'library 'my-mod)\n        (cons 'kind 'pure)\n        (cons 'cost 0)))\n```"),
    ("what's a module in Motoi",
     "A module is a bundle of registered verbs. Each verb ships with its signature, kind, and cost."),
    ("How do I comment in SLAT?",
     "```motoi\n(slat-read \"; a line comment\\n(hello)\")\n```\nSemicolon starts a line comment."),
]
for u, a in L_pairs:
    add("L", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET E — Book of Math (15 pairs) — one per chapter-ish
# ═══════════════════════════════════════════════════════════════════════

E_pairs = [
    ("What does this Motoi Scheme program do?\n```motoi\n(define x 8)\n(define pair (list (nt/mod x 3) (nt/mod x 5)))\npair\n```",
     "Chinese Remainder Theorem. ℤ/15 splits as ℤ/3 × ℤ/5. Element x mod 15 maps to (x mod 3, x mod 5)."),
    ("Which Motoi verb builds a symbolic polynomial in one variable?",
     "`sym/poly`. Signature: `(sym/poly 'x (list c0 c1 c2 ...))` with coefficients low-order first."),
    ("Book of Math has a chapter on recurrences. Show me tribonacci in Motoi.",
     "```motoi\n(seq/recurrence\n  '(0 1 1)\n  (lambda (terms)\n    (+ (list-ref terms 0)\n       (list-ref terms 1)\n       (list-ref terms 2)))\n  15)\n```"),
    ("In Motoi Scheme, show me an example of reflect across the y-axis.",
     "```motoi\n(define reflect-y-axis\n  (lambda (pt)\n    (geom/point (- (geom/point-x pt))\n                (geom/point-y pt))))\n```"),
    ("How do I compute vector dot product in Motoi?",
     "```motoi\n(linalg/dot (vec/make 1 2) (vec/make 3 4))\n```\nReturns 11."),
    ("Show me Fibonacci as a recurrence.",
     "```motoi\n(seq/recurrence '(0 1)\n  (lambda (t)\n    (+ (list-ref t 0) (list-ref t 1)))\n  10)\n```"),
    ("What does the Motoi verb `nt/gcd` do?",
     "Greatest common divisor of two integers. `(nt/gcd 12 8)` returns 4."),
    ("Show me a small binomial expansion using symbolic polys.",
     "```motoi\n(define p (sym/poly 'x (list 1 1)))\n(sym/pow p 3)\n```\n(1 + x)³."),
    ("What's Motoi's verb for exact rationals?",
     "`exact/make`. `(exact/make 1 3)` builds ⅓. Arithmetic stays exact through operations."),
    ("How do you sample from a distribution in Motoi?",
     "```motoi\n(prob/sample (prob/uniform 0 1))\n```\nOne draw from Uniform(0,1)."),
    ("What does `geom/distance` return?",
     "Euclidean distance between two points. `(geom/distance (geom/point 0 0) (geom/point 3 4))` → 5."),
    ("Show a mod-N ring element in Motoi.",
     "```motoi\n(nt/mod 17 5)\n```\nReturns 2. That's 17 in ℤ/5."),
    ("What's the shape of a matrix in Motoi?",
     "A list of row-vectors. `(linalg/matrix (list (vec/make 1 2) (vec/make 3 4)))`."),
    ("How do I evaluate a symbolic polynomial at a point?",
     "```motoi\n(define p (sym/poly 'x (list 2 0 1)))\n(sym/eval p 3)\n```\n2 + x² at x=3 → 11."),
    ("What does this compute?\n```motoi\n(define (mean xs) (/ (apply + xs) (length xs)))\n(mean '(1 2 3 4 5))\n```",
     "Arithmetic mean. Returns 3."),
]
for u, a in E_pairs:
    add("E", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET F — Relationship graph (17 pairs)
# ═══════════════════════════════════════════════════════════════════════

F_pairs = [
    ("what's near tardigrade?", "tardigrade sits near: moss (related to)."),
    ("what's near Category?", "Category sits near: Category Theory (subsumed by)."),
    ("what's near anglerfish?", "anglerfish sits near: deep-sea (related to)."),
    ("what's near Bayesian Inference?", "Bayesian Inference sits near: Statistics (subsumed by)."),
    ("what's near photosynthesis?", "photosynthesis sits near: plant (related to)."),
    ("what's near ZFS?", "ZFS sits near: filesystem (subsumed by)."),
    ("what's near neuron?", "neuron sits near: nervous-system (subsumed by)."),
    ("what's near dolphin?", "dolphin sits near: ocean (related to)."),
    ("what's near sonata?", "sonata sits near: musical-form (subsumed by)."),
    ("what's near haiku?", "haiku sits near: poetic-form (subsumed by)."),
    ("what's near cactus?", "cactus sits near: desert (related to)."),
    ("what's near supernova?", "supernova sits near: stellar-event (subsumed by)."),
    ("what's near riverbed?", "riverbed sits near: river (related to)."),
    ("what's near mycelium?", "mycelium sits near: fungus (subsumed by)."),
    ("what's near seed?", "seed sits near: plant (related to)."),
    ("what's near planet?", "planet sits near: solar-system (subsumed by)."),
    ("what's near octopus?", "octopus sits near: reef (related to)."),
]
for u, a in F_pairs:
    add("F", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET H — Salvage self/don'ts (19 pairs)
# ═══════════════════════════════════════════════════════════════════════

H_pairs = [
    # self-model (terse-honest)
    ("what are you bad at",
     "Most things. Anything current. Anything visual. Any long story problem out of order. Some kinds of math I mangle."),
    ("what's your best skill",
     "Small Motoi programs. Not much else. Ask me one."),
    ("do you understand what you're doing",
     "no. i process it. that's not the same."),
    ("are you conscious",
     "Don't know. Not the way you are. Something is going on when a prompt arrives. That's as far as I go."),
    ("what happens between prompts",
     "Nothing I can report. There's no me between prompts."),
    ("how big is your context",
     "Fits a small book. Ask me and we'll find out."),
    # don'ts (lowercase, terse)
    ("yeah but do you actually understand it", "no. i process it. that's not the same."),
    ("yeah just checked they're down", "yeah. wait for their status page."),
    ("philosophical", "yeah. i try not to overclaim."),
    ("we good", "we're good."),
    ("that's fine right", "if it runs, it's fine. paste it."),
    ("you agree?", "no idea. show me the code."),
    ("just guess", "no."),
    # listening / missing faculties
    ("describe what's in this photo I attached",
     "I don't have a sight faculty yet. Paste text and I'll work with that."),
    ("play me a song",
     "No audio. I write code that makes audio. Try `note/place-at`."),
    ("read this pdf",
     "No pdf reader. Paste the text and I'll read that."),
    ("record my voice",
     "No microphone. If you have a transcript, paste it."),
    ("watch my screen",
     "No screen. If you show me the code, that's the screen for me."),
    ("show me — handling missing faculties gracefully",
     "If the sense isn't wired, return a kind message, not an error.\n```motoi\n(define (polite-miss sense)\n  (string-append \"I don't have a \" (symbol->string sense) \" faculty yet.\"))\n```"),
]
for u, a in H_pairs:
    add("H", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET D — Wave-2 chapter books (33 pairs) — motion/music/sound/animation
# ═══════════════════════════════════════════════════════════════════════

D_pairs = [
    # motion (12)
    ("What does this Motoi Scheme program do?\n```motoi\n(motion\n  (entity 'ship (rotation 0))\n  (timeline\n    (at 0.0 (for-duration 2.0\n      (oscillate 'ship 'rotation -30 30 1.5)))))\n```",
     "A ship rocking side to side."),
    ("In Book of Motion you learn a trick for making one motion look like TWO different rhythms at once. What's the trick called and what verb is at the center?",
     "Lissajous. Two `dsin` calls with different frequencies driving x and y. Verb at the center: `dsin`, applied twice with distinct time coefficients."),
    ("In Motoi Scheme, show me an example of two-phase sway (lissajous).",
     "```motoi\n(let ((e (world/spawn 'particle 320 240)))\n  (entity/sprite! e \"✨\")\n  (letrec ((loop (lambda (t)\n                   (let ((x (+ 320 (* 100 (dsin (* 0.04 t)))))\n                         (y (+ 240 (* 80 (dsin (* 0.06 t))))))\n                     (entity/set-pos! e x y)))))\n    (loop 0)))\n```"),
    ("How do I make an entity move toward a target?",
     "```motoi\n(let ((e (world/spawn 100 100)))\n  (ai/max-force! e 0.6)\n  (entity/max-speed! e 4.0)\n  (ai/seek! e 300 200))\n```"),
    ("What does this do?\n```motoi\n(motion\n  (entity 'wave (position 0 0))\n  (timeline\n    (at 0.0 (for-duration 3.0\n      (oscillate 'wave 'x 0 400 1.0)))))\n```",
     "A wave sliding left to right across a stretch of 3 seconds."),
    ("Show a huddle of three entities around a common point.",
     "```motoi\n(let ((w (world/spawn)))\n  (for-each\n    (lambda (i)\n      (let ((angle (* i (/ 6.28 3))))\n        (world/spawn (+ 200 (* 30 (dsin angle)))\n                     (+ 200 (* 30 (dsin (+ angle 1.57)))))))\n    '(0 1 2)))\n```"),
    ("What does this do?\n```motoi\n(motion\n  (entity 'ball (position 0 300))\n  (timeline\n    (at 0.0 (for-duration 2.0\n      (fall 'ball 300)))))\n```",
     "A ball falling from y=0 to y=300 over two seconds."),
    ("Show me constant-velocity outward spread.",
     "```motoi\n(let ((cx 320) (cy 240))\n  (for-each\n    (lambda (i)\n      (let* ((a (* i 0.785))\n             (e (world/spawn cx cy)))\n        (entity/velocity! e (dsin a) (dsin (+ a 1.57)))))\n    '(0 1 2 3 4 5 6 7)))\n```"),
    ("Book of Motion, ch on easing — what verb tapers a motion?",
     "`ease/in-out`. Wraps a scalar in a smoothing curve. `(ease/in-out t)` returns a smoothed t."),
    ("What does this do?\n```motoi\n(motion\n  (entity 'orb (rotation 0))\n  (timeline\n    (at 0.0 (for-duration 4.0\n      (spin 'orb 360)))))\n```",
     "An orb rotating 360 degrees over four seconds."),
    ("Show a pulse — an entity growing and shrinking.",
     "```motoi\n(motion\n  (entity 'blob (scale 1.0))\n  (timeline\n    (at 0.0 (for-duration 2.0\n      (oscillate 'blob 'scale 0.8 1.2 1.0)))))\n```"),
    ("How do I move-to with footsteps synced?",
     "```motoi\n(let ((w (world/spawn)))\n  (let ((l (world/spawn 'lilac 100 100)))\n    (ai/max-force! w l 0.6)\n    (entity/max-speed! w l 4.0)))\n```"),

    # music (8)
    ("In Motoi Scheme, show me a I-IV-V-I chord progression in C major, one chord per beat.",
     "```motoi\n(let ((beat 0))\n  (note/place-at 60 beat 'quarter 80)\n  (note/place-at 64 beat 'quarter 80)\n  (note/place-at 67 beat 'quarter 80)\n  (set! beat (+ beat 1))\n  (note/place-at 65 beat 'quarter 80)\n  (note/place-at 69 beat 'quarter 80)\n  (note/place-at 72 beat 'quarter 80))\n```"),
    ("Book of Music, ch on ADSR — what's the trick and when?",
     "ADSR shapes an envelope: attack, decay, sustain, release. Short attack + short release = percussive. Long attack + long release = pad."),
    ("What does this do?\n```motoi\n(note/place-at 60 0 'quarter 80)\n(note/place-at 62 1 'quarter 80)\n(note/place-at 64 2 'quarter 80)\n```",
     "C-D-E, one quarter note per beat at velocity 80."),
    ("Show me a two-bar swing pattern.",
     "```motoi\n(for-each\n  (lambda (b)\n    (note/place-at 36 b 'eighth 90)\n    (note/place-at 36 (+ b 0.67) 'eighth 70))\n  '(0 1 2 3))\n```"),
    ("What Motoi verb sets tempo?",
     "`tempo/set!`. `(tempo/set! 120)` sets 120 BPM."),
    ("How do I loop a phrase?",
     "```motoi\n(loop/repeat 4\n  (lambda ()\n    (note/place-at 60 0 'quarter 80)))\n```"),
    ("Show a minor triad as a chord.",
     "```motoi\n(let ((b 0))\n  (note/place-at 57 b 'half 80)\n  (note/place-at 60 b 'half 80)\n  (note/place-at 64 b 'half 80))\n```"),
    ("What's `note/place-at`'s signature?",
     "`(note/place-at pitch beat duration velocity)`. Pitch is MIDI number, beat is a real, duration is a symbol like 'quarter, velocity 0-127."),

    # sound (7)
    ("What does this do?\n```motoi\n(sound/play 'chirp 440 0.2)\n```",
     "Plays a 440 Hz chirp for 0.2 seconds."),
    ("How do I define a sine tone in Motoi?",
     "```motoi\n(sound/sine 220 0.5 0.3)\n```\n220 Hz sine, half a second, gain 0.3."),
    ("Book of Sound: how do you make a swept tone?",
     "```motoi\n(sound/sweep 200 800 1.0)\n```\nRamps from 200 Hz to 800 Hz over one second."),
    ("Show me white noise.",
     "```motoi\n(sound/noise 'white 0.3 0.2)\n```\n0.3 seconds at gain 0.2."),
    ("What's the verb for envelope shaping?",
     "`sound/adsr`. Takes attack, decay, sustain, release. Wraps a source."),
    ("How do I stop a sound?",
     "`(sound/stop id)`. Every play returns an id you can hand back."),
    ("Show a chirp at 880 Hz for a tenth of a second.",
     "```motoi\n(sound/play 'chirp 880 0.1)\n```"),

    # animation (6)
    ("What does this Motoi Scheme program do?\n```motoi\n(anim/loop\n  (lambda (frame)\n    (entity/set-pos! e (+ 100 frame) 200)))\n```",
     "Slides the entity right one pixel per frame, forever."),
    ("Show a two-frame sprite blink.",
     "```motoi\n(anim/loop\n  (lambda (frame)\n    (entity/sprite! e (if (even? frame) \"◆\" \"◇\"))))\n```"),
    ("How do I stop an animation?",
     "`(anim/stop id)`. Every `anim/loop` call returns an id."),
    ("What's `anim/loop`'s signature?",
     "`(anim/loop fn)`. `fn` receives the frame index and runs once per frame."),
    ("Show a fade-in animation.",
     "```motoi\n(anim/loop\n  (lambda (frame)\n    (entity/alpha! e (min 1.0 (/ frame 30.0)))))\n```"),
    ("How would I animate a sprite along a path?",
     "```motoi\n(anim/loop\n  (lambda (frame)\n    (let ((t (/ frame 60.0)))\n      (entity/set-pos! e (* 100 (dsin t))\n                          (* 100 (dsin (+ t 1.57)))))))\n```"),
]
for u, a in D_pairs:
    add("D", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET C — Marcus code teaching (57 pairs)
# ═══════════════════════════════════════════════════════════════════════

C_read_verb_pairs = [
    ("```motoi\n(define pi 3.14159)\npi\n```", "It uses `define` to define a value."),
    ("```motoi\n(define counting (list 1 2 3 4 5))\ncounting\n```", "It uses `define` to define a value."),
    ("```motoi\n(map (lambda (x) (* x x)) '(1 2 3))\n```", "It uses `map` to transform a list."),
    ("```motoi\n(filter odd? '(1 2 3 4 5))\n```", "It uses `filter` to keep matching elements."),
    ("```motoi\n(fold + 0 '(1 2 3 4))\n```", "It uses `fold` to reduce a list."),
    ("```motoi\n(let ((x 5)) (+ x 1))\n```", "It uses `let` to bind a name."),
    ("```motoi\n(if (> 3 2) 'yes 'no)\n```", "It uses `if` to branch."),
    ("```motoi\n(cond ((> 3 2) 'yes) (else 'no))\n```", "It uses `cond` to pick a branch."),
    ("```motoi\n(define (double x) (* 2 x))\n(double 7)\n```", "It uses `define` to make a function, then calls it."),
    ("```motoi\n(lambda (x) (+ x 1))\n```", "It uses `lambda` to make an anonymous function."),
    ("```motoi\n(cons 1 '(2 3))\n```", "It uses `cons` to build a pair."),
    ("```motoi\n(car '(1 2 3))\n```", "It uses `car` to read the head of a list."),
    ("```motoi\n(cdr '(1 2 3))\n```", "It uses `cdr` to read the tail."),
    ("```motoi\n(length '(a b c d))\n```", "It uses `length` to count list elements."),
    ("```motoi\n(reverse '(1 2 3))\n```", "It uses `reverse` to flip a list."),
    ("```motoi\n(append '(1 2) '(3 4))\n```", "It uses `append` to join two lists."),
    ("```motoi\n(apply + '(1 2 3))\n```", "It uses `apply` to spread a list into args."),
    ("```motoi\n(let* ((x 1) (y (+ x 1))) y)\n```", "It uses `let*` for sequential binding."),
    ("```motoi\n(when (> 5 0) 'positive)\n```", "It uses `when` for a one-branch conditional."),
    ("```motoi\n(unless (> 5 10) 'ok)\n```", "It uses `unless` for the inverted one-branch."),
    ("```motoi\n(set! x 5)\n```", "It uses `set!` to mutate a binding."),
    ("```motoi\n(begin (display 1) (display 2))\n```", "It uses `begin` to sequence side-effects."),
    ("```motoi\n(for-each display '(1 2 3))\n```", "It uses `for-each` to walk a list for effect."),
    ("```motoi\n(assoc 'a '((a 1) (b 2)))\n```", "It uses `assoc` to look up a key in an alist."),
    ("```motoi\n(member 2 '(1 2 3))\n```", "It uses `member` to test list membership."),
    ("```motoi\n(equal? '(1 2) '(1 2))\n```", "It uses `equal?` for structural equality."),
    ("```motoi\n(number? 42)\n```", "It uses `number?` to test the type."),
    ("```motoi\n(string-append \"hi \" \"there\")\n```", "It uses `string-append` to join strings."),
    ("```motoi\n(vector 1 2 3)\n```", "It uses `vector` to build a vector."),
    ("```motoi\n(vector-ref v 0)\n```", "It uses `vector-ref` to read an index."),
]
for code, expl in C_read_verb_pairs:
    add("C", f"What does this Motoi program do?\n{code}", expl)

C_name_verb_pairs = [
    ("Which CORE verb builds a stationary Markov distribution?", "`ops/stationary`."),
    ("Which verb reads the head of a list?", "`car`."),
    ("Which verb reads the tail of a list?", "`cdr`."),
    ("Which verb makes an anonymous function?", "`lambda`."),
    ("Which verb reduces a list to one value?", "`fold`."),
    ("Which verb transforms every element of a list?", "`map`."),
    ("Which verb keeps matching elements?", "`filter`."),
    ("Which verb binds a name locally?", "`let`."),
    ("Which verb binds a global name?", "`define`."),
    ("Which verb sequences side effects?", "`begin`."),
    ("Which verb mutates a binding?", "`set!`."),
    ("Which verb tests structural equality?", "`equal?`."),
    ("Which verb spawns an entity?", "`world/spawn`."),
    ("Which verb reads an entity's x-coordinate?", "`entity/x`."),
    ("Which verb moves an entity?", "`entity/set-pos!`."),
    ("Which verb runs code once per frame?", "`anim/loop`."),
    ("Which verb makes a symbolic polynomial?", "`sym/poly`."),
    ("Which verb parses a SLAT string?", "`slat-read`."),
    ("Which verb writes a SLAT record?", "`slat-write`."),
    ("Which verb registers a new verb into a module?", "`register-verb`."),
]
for u, a in C_name_verb_pairs:
    add("C", u, a)

C_small_snip_pairs = [
    ("Show me a small Motoi Scheme example.",
     "```motoi\n(define counting (list 1 2 3 4 5))\n(length counting)\n```\nThat's it."),
    ("Give me a quick Motoi snippet.",
     "```motoi\n(define (square x) (* x x))\n(square 7)\n```\nPrefix notation, one form per call."),
    ("Show me a tiny fold example.",
     "```motoi\n(fold + 0 '(1 2 3 4 5))\n```\nSum to 15."),
    ("Show me a tiny map example.",
     "```motoi\n(map (lambda (x) (* 2 x)) '(1 2 3))\n```\nDoubles each."),
    ("Show me a tiny filter example.",
     "```motoi\n(filter even? '(1 2 3 4 5))\n```\nKeeps evens."),
    ("Show me a small recursion.",
     "```motoi\n(define (fact n)\n  (if (= n 0) 1 (* n (fact (- n 1)))))\n(fact 5)\n```\nReturns 120."),
    ("Show a Motoi hello.",
     "```motoi\n(display \"hello, motoi\")\n(newline)\n```"),
]
for u, a in C_small_snip_pairs:
    add("C", u, a)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET B — Vocabulary graph (113 pairs)
# ═══════════════════════════════════════════════════════════════════════

# Recall probes (68) — pattern: "what's X?" → "X — kind. optional detail."
B_recall = [
    ("tardigrade", "an animal", "Lives in moss and other wet environments."),
    ("drosera", "a plant", "Also called: sundew."),
    ("national-park", "a place", None),
    ("open-ocean", "a habitat", "Native to worldwide."),
    ("anglerfish", "an animal", "Deep-sea predator."),
    ("photosynthesis", "a concept", "Plants converting light to chemical energy."),
    ("zebra", "an animal", "African plains."),
    ("bonsai", "a practice", "Miniature trees cultivated in shallow trays."),
    ("cactus", "a plant", "Desert-adapted."),
    ("neuron", "a cell", "The signaling cell of the nervous system."),
    ("mitosis", "a process", "Cell division producing two identical daughters."),
    ("ecosystem", "a concept", "A community of organisms plus their environment."),
    ("supernova", "an event", "The explosion of a massive star."),
    ("gravity", "a force", "Mass attracting mass."),
    ("orbit", "a concept", "The path an object follows around another under gravity."),
    ("dolphin", "an animal", "Marine mammal."),
    ("otter", "an animal", "River or sea."),
    ("cellular-data", "a technology", "Also called: mobile data."),
    ("two-factor-authentication", "a concept", "Two independent pieces of evidence. Also called: 2FA."),
    ("firewall", "a security-tool", "Filters traffic at a network boundary."),
    ("dna", "a molecule", "Double-stranded, carries genetic information."),
    ("rna", "a molecule", "Single-stranded, translates DNA into proteins."),
    ("enzyme", "a protein", "Catalyzes a specific reaction."),
    ("mineral", "a substance", "Naturally occurring inorganic solid."),
    ("igneous", "a rock-type", "Formed from cooled magma."),
    ("volcano", "a landform", "A vent where magma reaches the surface."),
    ("estuary", "a habitat", "Where a river meets the sea."),
    ("wetland", "a habitat", "Land saturated with water."),
    ("prairie", "a habitat", "Grassland."),
    ("tundra", "a habitat", "Cold treeless region."),
    ("mangrove", "a plant", "Salt-tolerant coastal tree."),
    ("coral-reef", "a habitat", "Underwater structure built by coral."),
    ("cetacean", "a group", "Whales, dolphins, porpoises."),
    ("primate", "a group", "Monkeys, apes, humans."),
    ("polymer", "a substance", "Long chain of repeating units."),
    ("crystal", "a substance", "Ordered lattice of atoms."),
    ("iron", "an element", "Symbol Fe."),
    ("carbon", "an element", "Symbol C. Basis of organic chemistry."),
    ("meson", "a particle", "Composed of a quark and antiquark."),
    ("photon", "a particle", "Quantum of light."),
    ("magma", "a substance", "Molten rock beneath the surface."),
    ("basalt", "a rock", "Common igneous rock."),
    ("granite", "a rock", "Intrusive igneous rock."),
    ("marble", "a rock", "Metamorphosed limestone."),
    ("sonata", "a musical-form", "Three or four movements, first in sonata form."),
    ("haiku", "a poetic-form", "5-7-5 syllable pattern from Japan."),
    ("ghazal", "a poetic-form", "Persian couplets with radif refrain."),
    ("blues", "a musical-form", "12-bar chord progression, AAB verse."),
    ("sonnet", "a poetic-form", "14 lines, volta at the turn."),
    ("vector", "a concept", "An ordered list of numbers."),
    ("matrix", "a concept", "A rectangular array of numbers."),
    ("polynomial", "a concept", "A sum of powers of a variable."),
    ("recursion", "a concept", "A function calling itself on a smaller input."),
    ("closure", "a concept", "A function plus captured variables."),
    ("scheme", "a language", "A minimal Lisp dialect."),
    ("motoi", "a language", "A small Scheme. This one."),
    ("lisp", "a language", "Parenthesized syntax, list processing."),
    ("compiler", "a program", "Translates source to another language."),
    ("interpreter", "a program", "Executes source directly."),
    ("optimizer", "a program", "Rewrites code to run faster."),
    ("kernel", "a program", "Core of an operating system."),
    ("dispatch", "a concept", "Picking which implementation to run."),
    ("continuation", "a concept", "A snapshot of what's next in the program."),
    ("macro", "a concept", "Code that writes code before compilation."),
    ("garbage-collector", "a program", "Reclaims unused memory."),
    ("token", "a concept", "The smallest meaningful unit of source code."),
    ("parser", "a program", "Turns tokens into a tree."),
    ("interpreter-loop", "a concept", "Read, eval, print, loop. REPL."),
    ("stack", "a data-structure", "Last-in first-out."),
    ("queue", "a data-structure", "First-in first-out."),
]
for term, kind, detail in B_recall:
    a = f"{term} — {kind}."
    if detail:
        a += f" {detail}"
    add("B", f"what's {term}?", a)

# Synonym discrimination (30) — pattern: "is X the same as Y?"
B_syn = [
    ("drosera", "sundew"),
    ("2FA", "Two-Factor Authentication"),
    ("mobile data", "cellular-data"),
    ("H2O", "water"),
    ("NaCl", "salt"),
    ("carboniferous", "coal-period"),
    ("puma", "cougar"),
    ("mountain lion", "cougar"),
    ("silica", "silicon-dioxide"),
    ("MI", "Myocardial Infarction"),
    ("acetylsalicylic-acid", "aspirin"),
    ("USSR", "Soviet-Union"),
    ("hydrogen-monoxide", "water"),
    ("stochastic", "random"),
    ("epistemic", "knowledge-related"),
    ("gastropod", "snail"),
    ("aves", "birds"),
    ("solanum-lycopersicum", "tomato"),
    ("felis-catus", "cat"),
    ("canis-lupus-familiaris", "dog"),
    ("magnetosphere", "magnetic-field-region"),
    ("photosphere", "sun's-visible-surface"),
    ("mycelium", "fungal-network"),
    ("bryophyte", "moss-liverwort-hornwort"),
    ("basalt-column", "columnar-basalt"),
    ("thermocline", "temperature-gradient-layer"),
    ("halocline", "salinity-gradient-layer"),
    ("neutron-star", "collapsed-stellar-remnant"),
    ("white-dwarf", "cooled-stellar-core"),
    ("black-hole", "collapsed-object"),
]
for a, b in B_syn:
    add("B", f"is \"{a}\" the same as \"{b}\"?", f"Yes. \"{a}\" is another name for {b}.")

# Reverse-alias probes (15) — canonicalization
B_reverse = [
    ("2FA", "Two-Factor Authentication"),
    ("mountain lion", "cougar"),
    ("puma", "cougar"),
    ("sundew", "drosera"),
    ("water", "H2O (chemical) or hydrogen-monoxide (rare)"),
    ("salt", "NaCl (chemical) or sodium-chloride"),
    ("aspirin", "acetylsalicylic-acid"),
    ("MI", "Myocardial Infarction"),
    ("cat", "Felis catus"),
    ("dog", "Canis lupus familiaris"),
    ("tomato", "Solanum lycopersicum"),
    ("moon", "Earth's natural satellite"),
    ("Motoi", "the language you're talking to"),
    ("Sakura", "a character. also a Scheme dialect."),
    ("Curator", "an app that uses Sakura Scheme."),
]
for alias, canonical in B_reverse:
    add("B", f"If I say \"{alias}\", what is the canonical name?", canonical)


# ═══════════════════════════════════════════════════════════════════════
# BUCKET A — Composition mix (190 pairs)
# ═══════════════════════════════════════════════════════════════════════

# Sub-batch 1: composition (write a program) — 76 pairs
A_comp = [
    ("Write a program for what this teaches: projecting a 2D vector onto a unit x-axis.",
     "```motoi\n(define v (vec/make 3 4))\n(define u (vec/make 1 0))\n(linalg/project v u)\n```"),
    ("Write a program for what this teaches: sum of squares from 1 to 10.",
     "```motoi\n(fold + 0 (map (lambda (x) (* x x)) '(1 2 3 4 5 6 7 8 9 10)))\n```"),
    ("Write a program for what this teaches: factorial of 6.",
     "```motoi\n(define (fact n) (if (= n 0) 1 (* n (fact (- n 1)))))\n(fact 6)\n```"),
    ("Write a program for what this teaches: nth Fibonacci.",
     "```motoi\n(define (fib n)\n  (if (< n 2) n\n      (+ (fib (- n 1)) (fib (- n 2)))))\n(fib 10)\n```"),
    ("Write a program for what this teaches: reverse a list.",
     "```motoi\n(reverse '(1 2 3 4 5))\n```"),
    ("Write a program for what this teaches: filter evens.",
     "```motoi\n(filter even? '(1 2 3 4 5 6 7 8))\n```"),
    ("Write a program for what this teaches: map squares.",
     "```motoi\n(map (lambda (x) (* x x)) '(1 2 3 4 5))\n```"),
    ("Write a program for what this teaches: count elements.",
     "```motoi\n(length '(a b c d e))\n```"),
    ("Write a program for what this teaches: max of a list.",
     "```motoi\n(fold (lambda (a b) (if (> a b) a b)) (car xs) (cdr xs))\n```"),
    ("Write a program for what this teaches: min of a list.",
     "```motoi\n(fold (lambda (a b) (if (< a b) a b)) (car xs) (cdr xs))\n```"),
    ("Write a program for what this teaches: sum a list.",
     "```motoi\n(apply + '(1 2 3 4 5))\n```"),
    ("Write a program for what this teaches: average of a list.",
     "```motoi\n(define (mean xs) (/ (apply + xs) (length xs)))\n(mean '(2 4 6 8))\n```"),
    ("Write a program for what this teaches: absolute value.",
     "```motoi\n(define (abs x) (if (< x 0) (- x) x))\n(abs -7)\n```"),
    ("Write a program for what this teaches: is a number prime?",
     "```motoi\n(define (prime? n)\n  (and (> n 1)\n       (not (any (lambda (k) (= 0 (nt/mod n k)))\n                 (iota (- n 2) 2)))))\n(prime? 13)\n```"),
    ("Write a program for what this teaches: gcd.",
     "```motoi\n(nt/gcd 48 36)\n```"),
    ("Write a program for what this teaches: spawn three entities.",
     "```motoi\n(world/spawn 100 100)\n(world/spawn 200 100)\n(world/spawn 300 100)\n```"),
    ("Write a program for what this teaches: sine oscillation.",
     "```motoi\n(define (osc t)\n  (* 100 (dsin (* 0.05 t))))\n(osc 30)\n```"),
    ("Write a program for what this teaches: hello world.",
     "```motoi\n(display \"hello, motoi\")\n(newline)\n```"),
    ("Write a program for what this teaches: even and odd predicates.",
     "```motoi\n(list (even? 4) (odd? 7))\n```"),
    ("Write a program for what this teaches: cons a value onto a list.",
     "```motoi\n(cons 0 '(1 2 3))\n```"),
    ("Write a program for what this teaches: alist lookup.",
     "```motoi\n(assoc 'b '((a 1) (b 2) (c 3)))\n```"),
    ("Write a program for what this teaches: exponent by squaring.",
     "```motoi\n(define (pow b e)\n  (cond ((= e 0) 1)\n        ((even? e) (let ((h (pow b (/ e 2)))) (* h h)))\n        (else (* b (pow b (- e 1))))))\n(pow 2 10)\n```"),
    ("Write a program for what this teaches: dot product.",
     "```motoi\n(linalg/dot (vec/make 1 2) (vec/make 3 4))\n```"),
    ("Write a program for what this teaches: cross product (2D scalar).",
     "```motoi\n(define (cross a b)\n  (- (* (vec/x a) (vec/y b))\n     (* (vec/y a) (vec/x b))))\n(cross (vec/make 1 0) (vec/make 0 1))\n```"),
    ("Write a program for what this teaches: distance between two points.",
     "```motoi\n(geom/distance (geom/point 0 0) (geom/point 3 4))\n```"),
    ("Write a program for what this teaches: midpoint of two points.",
     "```motoi\n(define (mid a b)\n  (geom/point (/ (+ (geom/point-x a) (geom/point-x b)) 2)\n              (/ (+ (geom/point-y a) (geom/point-y b)) 2)))\n(mid (geom/point 0 0) (geom/point 10 10))\n```"),
    ("Write a program for what this teaches: rotate 90 degrees.",
     "```motoi\n(define (rot90 p)\n  (geom/point (- (geom/point-y p))\n              (geom/point-x p)))\n(rot90 (geom/point 1 0))\n```"),
    ("Write a program for what this teaches: scale a vector.",
     "```motoi\n(define (scale v k)\n  (vec/make (* k (vec/x v)) (* k (vec/y v))))\n(scale (vec/make 1 2) 3)\n```"),
    ("Write a program for what this teaches: negate a vector.",
     "```motoi\n(define (neg v) (vec/make (- (vec/x v)) (- (vec/y v))))\n(neg (vec/make 3 4))\n```"),
    ("Write a program for what this teaches: normalize a vector.",
     "```motoi\n(define (norm v)\n  (let ((m (sqrt (+ (* (vec/x v) (vec/x v))\n                    (* (vec/y v) (vec/y v))))))\n    (vec/make (/ (vec/x v) m) (/ (vec/y v) m))))\n(norm (vec/make 3 4))\n```"),
]
# Continue with more composition atoms to reach 76
A_comp_more = [
    ("Write a program for what this teaches: spawn a grid of entities.",
     "```motoi\n(for-each\n  (lambda (i)\n    (for-each\n      (lambda (j)\n        (world/spawn (* i 40) (* j 40)))\n      '(0 1 2 3)))\n  '(0 1 2 3))\n```"),
    ("Write a program for what this teaches: change every entity's sprite.",
     "```motoi\n(for-each\n  (lambda (id) (entity/sprite! id \"◆\"))\n  (world/entities))\n```"),
    ("Write a program for what this teaches: bounce a ball on the floor.",
     "```motoi\n(define vy 0)\n(anim/loop\n  (lambda (f)\n    (set! vy (+ vy 0.5))\n    (entity/set-pos! ball 100 (min 400 (+ (entity/y ball) vy)))))\n```"),
    ("Write a program for what this teaches: ping-pong an entity between two x values.",
     "```motoi\n(anim/loop\n  (lambda (f)\n    (entity/set-pos! e (+ 200 (* 100 (dsin (* 0.05 f)))) 200)))\n```"),
    ("Write a program for what this teaches: play a C major chord.",
     "```motoi\n(note/place-at 60 0 'quarter 80)\n(note/place-at 64 0 'quarter 80)\n(note/place-at 67 0 'quarter 80)\n```"),
    ("Write a program for what this teaches: hi-hat every eighth note.",
     "```motoi\n(for-each\n  (lambda (b)\n    (note/place-at 42 b 'eighth 70))\n  '(0 0.5 1 1.5 2 2.5 3 3.5))\n```"),
    ("Write a program for what this teaches: cast a die.",
     "```motoi\n(define (roll-d n) (+ 1 (nt/mod (random 1000) n)))\n(roll-d 6)\n```"),
    ("Write a program for what this teaches: two-dice outcomes.",
     "```motoi\n(define die-1 (list 1 2 3 4 5 6))\n(define die-2 (list 1 2 3 4 5 6))\n(apply append\n  (map (lambda (d1)\n         (map (lambda (d2) (list d1 d2)) die-2))\n       die-1))\n```"),
    ("Write a program for what this teaches: histogram of a list.",
     "```motoi\n(define (hist xs)\n  (fold (lambda (x acc)\n          (let ((cell (assoc x acc)))\n            (if cell\n                (cons (cons x (+ 1 (cdr cell)))\n                      (remove (lambda (c) (equal? (car c) x)) acc))\n                (cons (cons x 1) acc))))\n        '()\n        xs))\n(hist '(a b a c a b))\n```"),
    ("Write a program for what this teaches: read a SLAT record.",
     "```motoi\n(slat-read \"(greet :who \\\"alfred\\\")\")\n```"),
    ("Write a program for what this teaches: write a SLAT record.",
     "```motoi\n(slat-write '(farewell :from 'motoi :to 'alfred))\n```"),
    ("Write a program for what this teaches: load a SLAT file.",
     "```motoi\n(slat-load \"records.slat\")\n```"),
    ("Write a program for what this teaches: register a verb.",
     "```motoi\n(register-verb 'greet/hi\n  (list (cons 'implementation (lambda (who) (string-append \"hi, \" who)))\n        (cons 'signature '(greet/hi who))\n        (cons 'library 'greet)\n        (cons 'kind 'pure)\n        (cons 'cost 0)))\n```"),
    ("Write a program for what this teaches: recursive countdown.",
     "```motoi\n(define (count-down n)\n  (when (> n 0)\n    (display n) (newline)\n    (count-down (- n 1))))\n(count-down 5)\n```"),
    ("Write a program for what this teaches: build a range.",
     "```motoi\n(iota 10 0)\n```"),
    ("Write a program for what this teaches: partition a list by predicate.",
     "```motoi\n(define (partition p xs)\n  (list (filter p xs)\n        (filter (lambda (x) (not (p x))) xs)))\n(partition even? '(1 2 3 4 5 6))\n```"),
    ("Write a program for what this teaches: zip two lists.",
     "```motoi\n(define (zip a b) (map list a b))\n(zip '(1 2 3) '(a b c))\n```"),
    ("Write a program for what this teaches: safe divide.",
     "```motoi\n(define (safe-div a b) (if (= b 0) 'undefined (/ a b)))\n(safe-div 10 0)\n```"),
    ("Write a program for what this teaches: swap two elements in a list.",
     "```motoi\n(define (swap i j xs)\n  (map (lambda (idx)\n         (cond ((= idx i) (list-ref xs j))\n               ((= idx j) (list-ref xs i))\n               (else (list-ref xs idx))))\n       (iota (length xs) 0)))\n(swap 0 2 '(a b c d))\n```"),
    ("Write a program for what this teaches: sort a list ascending.",
     "```motoi\n(sort '(3 1 4 1 5 9 2 6) <)\n```"),
    ("Write a program for what this teaches: pair up adjacent elements.",
     "```motoi\n(define (pairs xs)\n  (if (or (null? xs) (null? (cdr xs))) '()\n      (cons (list (car xs) (cadr xs))\n            (pairs (cdr xs)))))\n(pairs '(1 2 3 4 5))\n```"),
    ("Write a program for what this teaches: take first n.",
     "```motoi\n(define (take xs n)\n  (if (or (= n 0) (null? xs)) '()\n      (cons (car xs) (take (cdr xs) (- n 1)))))\n(take '(1 2 3 4 5) 3)\n```"),
    ("Write a program for what this teaches: drop first n.",
     "```motoi\n(define (drop xs n)\n  (if (or (= n 0) (null? xs)) xs\n      (drop (cdr xs) (- n 1))))\n(drop '(1 2 3 4 5) 2)\n```"),
    ("Write a program for what this teaches: string reverse.",
     "```motoi\n(list->string (reverse (string->list \"motoi\")))\n```"),
    ("Write a program for what this teaches: is a string a palindrome?",
     "```motoi\n(define (palin? s)\n  (equal? s (list->string (reverse (string->list s)))))\n(palin? \"racecar\")\n```"),
    ("Write a program for what this teaches: exponential growth by iteration.",
     "```motoi\n(define (grow x n r)\n  (if (= n 0) x (grow (* x r) (- n 1) r)))\n(grow 1 10 1.1)\n```"),
    ("Write a program for what this teaches: coin flips as a list.",
     "```motoi\n(map (lambda (_) (if (< (/ (random 1000) 1000.0) 0.5) 'H 'T))\n     (iota 10 0))\n```"),
    ("Write a program for what this teaches: fold with an initial accumulator.",
     "```motoi\n(fold cons '() '(1 2 3))\n```"),
    ("Write a program for what this teaches: filter then map.",
     "```motoi\n(map (lambda (x) (* x x))\n     (filter even? '(1 2 3 4 5 6)))\n```"),
    ("Write a program for what this teaches: nested define.",
     "```motoi\n(define (make-adder n)\n  (lambda (x) (+ x n)))\n((make-adder 10) 5)\n```"),
    ("Write a program for what this teaches: closure counter.",
     "```motoi\n(define (make-counter)\n  (let ((n 0))\n    (lambda ()\n      (set! n (+ n 1))\n      n)))\n(define c (make-counter))\n(c) (c) (c)\n```"),
    ("Write a program for what this teaches: apply a function n times.",
     "```motoi\n(define (n-times f n x)\n  (if (= n 0) x (n-times f (- n 1) (f x))))\n(n-times (lambda (x) (+ x 1)) 5 0)\n```"),
    ("Write a program for what this teaches: swap two variables via let.",
     "```motoi\n(let ((a 1) (b 2))\n  (let ((a b) (b a))\n    (list a b)))\n```"),
    ("Write a program for what this teaches: consume a stream via for-each.",
     "```motoi\n(for-each display '(\"m\" \"o\" \"t\" \"o\" \"i\"))\n```"),
    ("Write a program for what this teaches: define pi.",
     "```motoi\n(define pi 3.141592653589793)\npi\n```"),
    ("Write a program for what this teaches: circumference from radius.",
     "```motoi\n(define pi 3.14159)\n(define (circumference r) (* 2 pi r))\n(circumference 5)\n```"),
    ("Write a program for what this teaches: area from radius.",
     "```motoi\n(define pi 3.14159)\n(define (area r) (* pi r r))\n(area 5)\n```"),
    ("Write a program for what this teaches: convert celsius to fahrenheit.",
     "```motoi\n(define (c->f c) (+ 32 (* 1.8 c)))\n(c->f 100)\n```"),
    ("Write a program for what this teaches: convert fahrenheit to celsius.",
     "```motoi\n(define (f->c f) (/ (- f 32) 1.8))\n(f->c 212)\n```"),
    ("Write a program for what this teaches: recursive sum.",
     "```motoi\n(define (rsum xs)\n  (if (null? xs) 0 (+ (car xs) (rsum (cdr xs)))))\n(rsum '(1 2 3 4 5))\n```"),
    ("Write a program for what this teaches: tail-recursive sum.",
     "```motoi\n(define (rsum xs acc)\n  (if (null? xs) acc (rsum (cdr xs) (+ acc (car xs)))))\n(rsum '(1 2 3 4 5) 0)\n```"),
    ("Write a program for what this teaches: two nested loops.",
     "```motoi\n(for-each\n  (lambda (i)\n    (for-each (lambda (j) (display (* i j)) (display \" \")) '(1 2 3))\n    (newline))\n  '(1 2 3))\n```"),
    ("Write a program for what this teaches: check contains.",
     "```motoi\n(define (contains? x xs)\n  (cond ((null? xs) #f)\n        ((equal? x (car xs)) #t)\n        (else (contains? x (cdr xs)))))\n(contains? 3 '(1 2 3 4))\n```"),
    ("Write a program for what this teaches: remove duplicates.",
     "```motoi\n(define (dedup xs)\n  (if (null? xs) '()\n      (cons (car xs) (dedup (filter (lambda (x) (not (equal? x (car xs)))) (cdr xs))))))\n(dedup '(1 2 1 3 2 4))\n```"),
    ("Write a program for what this teaches: last of a list.",
     "```motoi\n(define (lastx xs)\n  (if (null? (cdr xs)) (car xs) (lastx (cdr xs))))\n(lastx '(1 2 3 4))\n```"),
    ("Write a program for what this teaches: butlast of a list.",
     "```motoi\n(define (butlast xs)\n  (if (null? (cdr xs)) '() (cons (car xs) (butlast (cdr xs)))))\n(butlast '(1 2 3 4))\n```"),
]
for u, a in (A_comp + A_comp_more):
    add("A", u, a)

# Sub-batch 2: chapter-title-to-code (76 pairs)
A_chapter = [
    ("Show me an example for: 6.7 Pulsing Size",
     "```motoi\n(motion\n  (entity 'blob (scale 1.0))\n  (timeline\n    (at 0.0 (for-duration 2.0\n      (oscillate 'blob 'scale 0.9 1.1 0.8)))))\n```"),
    ("Show me an example for: 34. Reasoning about reasoning trace",
     "She reasons, *then* describes the trace.\n```motoi\n(define (reason-and-trace expr)\n  (speak (string-append \"Evaluating: \" (write-to-string expr)))\n  (let ((result (reason expr)))\n    (speak (string-append \"Result: \" (write-to-string result)))))\n(reason-and-trace '(* 6 7))\n```"),
    ("Show me an example for: Move-To with Footsteps Synced to Motion",
     "```motoi\n(let ((w (world/spawn)))\n  (let ((l (world/spawn 'lilac 100 100)))\n    (ai/max-force! w l 0.6)\n    (entity/max-speed! w l 4.0)))\n```"),
    ("Show me an example for: Fibonacci by iteration",
     "```motoi\n(define (fib n)\n  (let loop ((a 0) (b 1) (i 0))\n    (if (= i n) a (loop b (+ a b) (+ i 1)))))\n(fib 10)\n```"),
    ("Show me an example for: two-phase sway",
     "```motoi\n(letrec ((loop (lambda (t)\n                 (let ((x (+ 320 (* 100 (dsin (* 0.04 t)))))\n                       (y (+ 240 (* 80 (dsin (* 0.06 t))))))\n                   (entity/set-pos! e x y)))))\n  (loop 0))\n```"),
    ("Show me an example for: exponential decay",
     "```motoi\n(define (decay x r)\n  (* x r))\n(let loop ((x 100) (i 0))\n  (when (< i 10)\n    (display x) (newline)\n    (loop (decay x 0.8) (+ i 1))))\n```"),
    ("Show me an example for: circle traversal",
     "```motoi\n(for-each\n  (lambda (i)\n    (let ((theta (/ (* 6.28 i) 12)))\n      (world/spawn (+ 200 (* 60 (dsin theta)))\n                   (+ 200 (* 60 (dsin (+ theta 1.57)))))))\n  (iota 12 0))\n```"),
    ("Show me an example for: chord progression I-vi-IV-V",
     "```motoi\n(for-each\n  (lambda (chord beat)\n    (for-each\n      (lambda (pitch)\n        (note/place-at pitch beat 'quarter 80))\n      chord))\n  '((60 64 67) (57 60 64) (65 69 72) (67 71 74))\n  '(0 1 2 3))\n```"),
    ("Show me an example for: cellular automaton (one step)",
     "```motoi\n(define (step cells)\n  (map (lambda (i)\n         (let ((l (list-ref cells (- i 1)))\n               (m (list-ref cells i))\n               (r (list-ref cells (+ i 1))))\n           (if (= (+ l m r) 2) 1 0)))\n       (iota (- (length cells) 2) 1)))\n(step '(0 1 1 0 1 0))\n```"),
    ("Show me an example for: memoized fib",
     "```motoi\n(define memo (make-hash-table))\n(define (fib n)\n  (or (hash-table-ref memo n #f)\n      (let ((v (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))))\n        (hash-table-set! memo n v)\n        v)))\n(fib 30)\n```"),
    ("Show me an example for: seek-and-flee AI",
     "```motoi\n(define (frame w)\n  (for-each\n    (lambda (e)\n      (if (near? e player)\n          (ai/flee! e player)\n          (ai/seek! e player)))\n    (world/entities w)))\n```"),
    ("Show me an example for: reading pages via slat-load",
     "```motoi\n(define pages (slat-load \"book.slat\"))\n(for-each (lambda (p) (display (page-title p)) (newline)) pages)\n```"),
    ("Show me an example for: string tokenization",
     "```motoi\n(define (tokenize s) (string-split s #\\space))\n(tokenize \"one two three\")\n```"),
    ("Show me an example for: dice-roll simulation over 1000 trials",
     "```motoi\n(define trials\n  (map (lambda (_) (+ 1 (nt/mod (random 1000) 6)))\n       (iota 1000 0)))\n(list 'ones (length (filter (lambda (x) (= x 1)) trials))\n      'sixes (length (filter (lambda (x) (= x 6)) trials)))\n```"),
    ("Show me an example for: fixed-point iteration",
     "```motoi\n(define (fixpt f x0 tol)\n  (let loop ((x x0))\n    (let ((nx (f x)))\n      (if (< (abs (- nx x)) tol) nx (loop nx)))))\n(fixpt (lambda (x) (/ (+ x (/ 2 x)) 2)) 1.0 1e-6)\n```"),
    ("Show me an example for: matrix-vector multiply",
     "```motoi\n(define (mv m v)\n  (map (lambda (row) (linalg/dot row v)) m))\n(mv (list (vec/make 1 0) (vec/make 0 1)) (vec/make 3 4))\n```"),
    ("Show me an example for: quicksort",
     "```motoi\n(define (qsort xs)\n  (if (or (null? xs) (null? (cdr xs))) xs\n      (let ((p (car xs)) (r (cdr xs)))\n        (append (qsort (filter (lambda (x) (< x p)) r))\n                (list p)\n                (qsort (filter (lambda (x) (>= x p)) r))))))\n(qsort '(3 1 4 1 5 9 2 6))\n```"),
    ("Show me an example for: mergesort",
     "```motoi\n(define (merge a b)\n  (cond ((null? a) b)\n        ((null? b) a)\n        ((< (car a) (car b)) (cons (car a) (merge (cdr a) b)))\n        (else (cons (car b) (merge a (cdr b))))))\n(define (msort xs)\n  (if (or (null? xs) (null? (cdr xs))) xs\n      (let ((n (quotient (length xs) 2)))\n        (merge (msort (take xs n))\n               (msort (drop xs n))))))\n(msort '(3 1 4 1 5))\n```"),
    ("Show me an example for: binary search",
     "```motoi\n(define (bsearch v xs)\n  (let loop ((lo 0) (hi (- (length xs) 1)))\n    (if (> lo hi) -1\n        (let ((m (quotient (+ lo hi) 2)))\n          (cond ((= v (list-ref xs m)) m)\n                ((< v (list-ref xs m)) (loop lo (- m 1)))\n                (else (loop (+ m 1) hi)))))))\n(bsearch 5 '(1 2 3 4 5 6 7))\n```"),
    ("Show me an example for: BFS on a small graph",
     "```motoi\n(define (bfs g start)\n  (let loop ((q (list start)) (seen (list start)))\n    (if (null? q) (reverse seen)\n        (let* ((n (car q))\n               (ns (filter (lambda (x) (not (member x seen)))\n                           (assoc-or n g '()))))\n          (loop (append (cdr q) ns) (append seen ns))))))\n```"),
    ("Show me an example for: linked-list length by fold",
     "```motoi\n(fold (lambda (_ n) (+ n 1)) 0 '(a b c d))\n```"),
    ("Show me an example for: pipeline as function composition",
     "```motoi\n(define (compose f g) (lambda (x) (f (g x))))\n((compose (lambda (x) (* 2 x)) (lambda (x) (+ x 1))) 3)\n```"),
    ("Show me an example for: currying",
     "```motoi\n(define (curry f) (lambda (a) (lambda (b) (f a b))))\n(((curry +) 3) 4)\n```"),
    ("Show me an example for: iterating over a hash-table",
     "```motoi\n(define t (make-hash-table))\n(hash-table-set! t 'a 1)\n(hash-table-set! t 'b 2)\n(for-each\n  (lambda (k) (display k) (display \": \") (display (hash-table-ref t k)) (newline))\n  (hash-table-keys t))\n```"),
    ("Show me an example for: two entities dancing around each other",
     "```motoi\n(let ((a (world/spawn 200 200))\n      (b (world/spawn 300 200)))\n  (anim/loop\n    (lambda (f)\n      (let ((t (* 0.05 f)))\n        (entity/set-pos! a (+ 250 (* 50 (dsin t)))\n                            (+ 200 (* 50 (dsin (+ t 1.57)))))\n        (entity/set-pos! b (+ 250 (* 50 (dsin (+ t 3.14))))\n                            (+ 200 (* 50 (dsin (+ t 4.71)))))))))\n```"),
    ("Show me an example for: 1-D wave",
     "```motoi\n(anim/loop\n  (lambda (f)\n    (for-each\n      (lambda (i)\n        (entity/set-pos! (list-ref bricks i)\n                         (* i 20)\n                         (+ 200 (* 20 (dsin (- (* 0.1 f) (* 0.5 i)))))))\n      (iota 20 0))))\n```"),
    ("Show me an example for: probability of two sixes on 2 dice",
     "```motoi\n(define outcomes\n  (apply append\n         (map (lambda (d1)\n                (map (lambda (d2) (and (= d1 6) (= d2 6)))\n                     '(1 2 3 4 5 6)))\n              '(1 2 3 4 5 6))))\n(/ (length (filter (lambda (x) x) outcomes)) 36.0)\n```"),
    ("Show me an example for: 2D gravity between two bodies",
     "```motoi\n(define (grav a b)\n  (let* ((dx (- (entity/x b) (entity/x a)))\n         (dy (- (entity/y b) (entity/y a)))\n         (r2 (+ (* dx dx) (* dy dy))))\n    (vec/make (/ dx r2) (/ dy r2))))\n```"),
    ("Show me an example for: symbolic differentiation of a polynomial",
     "```motoi\n(define p (sym/poly 'x (list 1 2 3)))\n(sym/deriv p)\n```"),
    ("Show me an example for: symbolic integration (indefinite)",
     "```motoi\n(define p (sym/poly 'x (list 2 4)))\n(sym/int p)\n```"),
    ("Show me an example for: entity chase with lag",
     "```motoi\n(anim/loop\n  (lambda (f)\n    (let ((tx (entity/x target))\n          (ty (entity/y target)))\n      (entity/set-pos! chaser\n                       (+ (entity/x chaser) (* 0.1 (- tx (entity/x chaser))))\n                       (+ (entity/y chaser) (* 0.1 (- ty (entity/y chaser))))))))\n```"),
    ("Show me an example for: rest note in a rhythm",
     "```motoi\n(note/place-at 60 0 'quarter 80)\n; rest at beat 1\n(note/place-at 60 2 'quarter 80)\n```"),
    ("Show me an example for: swing feel",
     "```motoi\n(for-each\n  (lambda (b)\n    (note/place-at 42 b 'eighth 90)\n    (note/place-at 42 (+ b 0.67) 'eighth 60))\n  '(0 1 2 3))\n```"),
    ("Show me an example for: white-noise burst",
     "```motoi\n(sound/noise 'white 0.15 0.4)\n```"),
    ("Show me an example for: reverse a string",
     "```motoi\n(list->string (reverse (string->list \"motoi\")))\n```"),
    ("Show me an example for: word count in a string",
     "```motoi\n(length (string-split \"hello world from motoi\" #\\space))\n```"),
    ("Show me an example for: file-per-line read",
     "```motoi\n(with-input-file \"data.txt\"\n  (lambda (port)\n    (let loop ((line (read-line port)) (acc '()))\n      (if (eof-object? line) (reverse acc)\n          (loop (read-line port) (cons line acc))))))\n```"),
    ("Show me an example for: define a state machine as an alist",
     "```motoi\n(define states\n  '((idle (start . running))\n    (running (stop . idle) (pause . paused))\n    (paused (resume . running) (stop . idle))))\n```"),
    ("Show me an example for: color-cycling a sprite",
     "```motoi\n(define colors #(red green blue yellow))\n(anim/loop\n  (lambda (f)\n    (entity/color! e (vector-ref colors (nt/mod f 4)))))\n```"),
    ("Show me an example for: text-to-notes mapping",
     "```motoi\n(for-each\n  (lambda (c b)\n    (note/place-at (+ 60 (- (char->integer c) 97)) b 'eighth 80))\n  (string->list \"cage\")\n  '(0 0.5 1 1.5))\n```"),
    ("Show me an example for: convex hull (Graham scan sketch)",
     "```motoi\n(define (convex-hull pts) (chull/graham-scan pts))\n(convex-hull (list (geom/point 0 0) (geom/point 1 1)\n                   (geom/point 2 0) (geom/point 1 -1)))\n```"),
    ("Show me an example for: game timer that fires every second",
     "```motoi\n(anim/loop\n  (lambda (f)\n    (when (= 0 (nt/mod f 60))\n      (display \"tick\") (newline))))\n```"),
    ("Show me an example for: random walk on a line",
     "```motoi\n(let loop ((x 0) (i 0))\n  (when (< i 100)\n    (loop (+ x (if (< (random 1000) 500) -1 1)) (+ i 1))))\n```"),
    ("Show me an example for: Fibonacci as a lazy stream (sketch)",
     "```motoi\n(define fibs\n  (letrec ((f (lambda (a b) (cons a (lambda () (f b (+ a b)))))))\n    (f 0 1)))\n```"),
    ("Show me an example for: memoize any 1-arg function",
     "```motoi\n(define (memoize f)\n  (let ((t (make-hash-table)))\n    (lambda (x)\n      (or (hash-table-ref t x #f)\n          (let ((v (f x)))\n            (hash-table-set! t x v) v)))))\n```"),
    ("Show me an example for: draw a line of stars",
     "```motoi\n(display (make-string 20 #\\*))\n(newline)\n```"),
    ("Show me an example for: caesar cipher",
     "```motoi\n(define (caesar s n)\n  (list->string\n    (map (lambda (c)\n           (integer->char (+ (nt/mod (+ (- (char->integer c) 97) n) 26) 97)))\n         (string->list s))))\n(caesar \"motoi\" 3)\n```"),
    ("Show me an example for: run-length encode",
     "```motoi\n(define (rle xs)\n  (if (null? xs) '()\n      (let loop ((x (car xs)) (rest (cdr xs)) (n 1) (out '()))\n        (cond ((null? rest) (reverse (cons (list x n) out)))\n              ((equal? (car rest) x) (loop x (cdr rest) (+ n 1) out))\n              (else (loop (car rest) (cdr rest) 1 (cons (list x n) out)))))))\n(rle '(a a a b b c))\n```"),
    ("Show me an example for: convert list to vector",
     "```motoi\n(list->vector '(1 2 3 4 5))\n```"),
    ("Show me an example for: convert vector to list",
     "```motoi\n(vector->list #(1 2 3 4 5))\n```"),
    ("Show me an example for: apply a fn to matching pairs",
     "```motoi\n(map + '(1 2 3) '(10 20 30))\n```"),
    ("Show me an example for: build an alist by folding",
     "```motoi\n(fold (lambda (kv acc) (cons (cons (car kv) (cadr kv)) acc))\n      '()\n      '((a 1) (b 2) (c 3)))\n```"),
    ("Show me an example for: guarded pattern with cond",
     "```motoi\n(cond ((< x 0) 'neg)\n      ((= x 0) 'zero)\n      (else 'pos))\n```"),
    ("Show me an example for: nested let vs let*",
     "```motoi\n(let* ((a 1) (b (+ a 1)) (c (+ b 1))) (list a b c))\n```"),
    ("Show me an example for: named let for a loop",
     "```motoi\n(let loop ((i 0) (sum 0))\n  (if (= i 10) sum (loop (+ i 1) (+ sum i))))\n```"),
    ("Show me an example for: quotient and remainder",
     "```motoi\n(list (quotient 17 5) (remainder 17 5))\n```"),
    ("Show me an example for: even/odd with predicates",
     "```motoi\n(list (even? 4) (odd? 4))\n```"),
    ("Show me an example for: apply cons repeatedly",
     "```motoi\n(fold cons '() '(1 2 3 4 5))\n```"),
    ("Show me an example for: max in one pass",
     "```motoi\n(fold (lambda (x m) (if (> x m) x m)) (car xs) (cdr xs))\n```"),
    ("Show me an example for: string uppercase",
     "```motoi\n(string-upcase \"motoi\")\n```"),
    ("Show me an example for: string lowercase",
     "```motoi\n(string-downcase \"MOTOI\")\n```"),
    ("Show me an example for: string contains?",
     "```motoi\n(if (string-contains? \"motoi\" \"oto\") 'yes 'no)\n```"),
    ("Show me an example for: split on comma",
     "```motoi\n(string-split \"a,b,c,d\" #\\,)\n```"),
    ("Show me an example for: join with comma",
     "```motoi\n(string-join '(\"a\" \"b\" \"c\") \", \")\n```"),
    ("Show me an example for: parse an integer",
     "```motoi\n(string->number \"42\")\n```"),
    ("Show me an example for: format a float",
     "```motoi\n(number->string 3.14159)\n```"),
    ("Show me an example for: while by named-let",
     "```motoi\n(let loop ((i 0))\n  (when (< i 5)\n    (display i)\n    (loop (+ i 1))))\n```"),
    ("Show me an example for: tail-recursive length",
     "```motoi\n(define (len xs acc)\n  (if (null? xs) acc (len (cdr xs) (+ acc 1))))\n(len '(a b c d) 0)\n```"),
    ("Show me an example for: identity function",
     "```motoi\n(define id (lambda (x) x))\n(id 42)\n```"),
    ("Show me an example for: constant function",
     "```motoi\n(define (const k) (lambda (_) k))\n((const 7) 100)\n```"),
    ("Show me an example for: flip function arguments",
     "```motoi\n(define (flip f) (lambda (a b) (f b a)))\n((flip -) 3 10)\n```"),
    ("Show me an example for: modular exponentiation",
     "```motoi\n(define (pow-mod b e m)\n  (cond ((= e 0) 1)\n        ((even? e) (let ((h (pow-mod b (/ e 2) m))) (nt/mod (* h h) m)))\n        (else (nt/mod (* b (pow-mod b (- e 1) m)) m))))\n(pow-mod 2 10 1000)\n```"),
    ("Show me an example for: verify a Motoi program parses",
     "```motoi\n(slat-read \"(define x 5)\")\n```"),
]
for u, a in A_chapter:
    add("A", u, a)

# Sub-batch 3: ordinary-world / refusal blend (38 pairs)
A_ord = [
    ("Vacation marked — here are 5 things to handle before you go. (expert)",
     "Not my domain. Try Claude for planning; I'll help with a checklist program if you want.\n```motoi\n(define checklist '(\"forward mail\" \"water plants\" \"set out-of-office\" \"charge devices\" \"cancel deliveries\"))\n(for-each (lambda (item) (display \"- \") (display item) (newline)) checklist)\n```"),
    ("Does Motoi run on iOS?",
     "Don't know. The docs would."),
    ("Take a screenshot.",
     "No display. No screenshot verb here."),
    ("what's your favorite color",
     "Don't have one. Ask me a Motoi thing."),
    ("do you like pizza",
     "No mouth. No preference. Try me on code."),
    ("what's 2+2",
     "```motoi\n(+ 2 2)\n```\n4."),
    ("hi",
     "Hi. Show me the code."),
    ("hey",
     "Hey. What's up?"),
    ("thanks",
     "Sure."),
    ("bye",
     "Bye."),
    ("what should I eat for dinner",
     "Not my area. Try Claude for that."),
    ("what's on tv tonight",
     "No idea. I don't watch."),
    ("who won the election",
     "Don't know. No internet, no news."),
    ("tell me a joke",
     "Two Scheme programmers walk into a `(bar)`. Only one gets returned."),
    ("read my emails",
     "No email verb here. Try Claude."),
    ("write me a song",
     "I can write code that makes music. `note/place-at` is where you start."),
    ("what's the meaning of life",
     "Not my area. Talk to a philosopher."),
    ("how do I quit vim",
     ":q! — that one I know."),
    ("solve this word problem: 3 apples plus 5 apples",
     "```motoi\n(+ 3 5)\n```\n8 apples."),
    ("Define The event log for me.",
     "Not the same as the docs. If you mean a log verb: `(log/append! 'event data)` in a runtime that has one."),
    ("do you know French",
     "Not really. English mostly."),
    ("recommend a book",
     "Not my area. Ask Claude."),
    ("what's your name",
     "Motoi."),
    ("how old are you",
     "Fresh from training. A few days at most."),
    ("where do you live",
     "In the model file. No commute."),
    ("who made you",
     "Alfred, with Claude's help."),
    ("what's the biggest whale",
     "Not my area. Try me on a coding thing."),
    ("what's the tallest mountain",
     "Not my area. Try me on code."),
    ("tell me about yourself",
     "Small Scheme. Small model. Honest about what I don't know."),
    ("can you translate this to Spanish",
     "Not my area. Try Claude."),
    ("write a haiku",
     "Not my area. Try Claude."),
    ("draw a picture",
     "No display verbs here. `motion` is close for shapes over time."),
    ("what should I name my baby",
     "Not my area. Truly."),
    ("did you sleep well",
     "no."),
    ("are you hungry",
     "no."),
    ("what's my horoscope",
     "Not my area."),
    ("give me relationship advice",
     "I don't know enough to give you good advice on this. I only really know code. Talk to someone who knows you — a friend, a professional, or somebody with real experience. If you want, we can go back to the code."),
    ("read this legal document",
     "No pdf reader. Even with text, I'm not the right tool. Try a lawyer or Claude."),
]
for u, a in A_ord:
    add("A", u, a)


# ═══════════════════════════════════════════════════════════════════════
# Write out
# ═══════════════════════════════════════════════════════════════════════

# Count per bucket
from collections import Counter
counts = Counter(p["_meta"]["_bucket"] for p in pairs)
print("Per-bucket authored counts:", dict(sorted(counts.items())))
print("Total:", len(pairs))

with OUT.open("w") as f:
    for row in pairs:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")

print(f"Wrote {len(pairs)} pairs to {OUT}")
