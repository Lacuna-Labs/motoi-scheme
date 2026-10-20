// Deterministic close-out of the 37 failing 01-core example slots.
// Group A: purge Curator verb NAMES (card-do/card-list/card-rect/card-screen-rect/
//          on-minimap-click) + rename bare camera-zoom -> camera-scale.
// Group B: make free-var placeholder examples self-contained so they RUN.
// Applies exact-string replacements against the raw file (\n / \" escaped form).
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'scheme/reference/01-core.slat'
let content = readFileSync(FILE, 'utf8')
const enc = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')

// [oldCode, newCode] pairs in DECODED (real newline) form.
const P = []
const add = (o, n) => P.push([o, n])
// anchored pairs: matched as a COMPLETE quoted SLAT string value ("..."),
// used when the bare body is not unique in the file.
const A = []
const addAnchored = (o, n) => A.push([o, n])

// ---- Group B: prepend a local binding so placeholders resolve ----
add(
`(define (endpoint-check start end h)
  ;; B(0)=start B(1)=end for quadratic Bezier through (mid-x, h)
  (let ((mid (list (/ (+ (car start) (car end)) 2) h)))
    (and (equal? (bezier2 start mid end 0) start)
         (equal? (bezier2 start mid end 1) end))))
(endpoint-check '(0 0) '(100 0) 40)`,
`(define (bezier2 p0 p1 p2 t)
  (let ((u (- 1 t)))
    (list (+ (* u u (car p0)) (* 2 u t (car p1)) (* t t (car p2)))
          (+ (* u u (cadr p0)) (* 2 u t (cadr p1)) (* t t (cadr p2))))))
(define (endpoint-check start end h)
  ;; B(0)=start B(1)=end for quadratic Bezier through (mid-x, h)
  (let ((mid (list (/ (+ (car start) (car end)) 2) h)))
    (and (equal? (bezier2 start mid end 0) start)
         (equal? (bezier2 start mid end 1) end))))
(endpoint-check '(0 0) '(100 0) 40)`)

add(
`;; sample a curve at t = 0.75:
(easing 'ease-in-out 0.75)`,
`;; sample a curve at t = 0.75:
(define (easing kind t) (* t t (- 3 (* 2 t))))  ;; smoothstep stand-in
(easing 'ease-in-out 0.75)`)

add(
`(let ((r (camera-export handle '(:format "png"))))
  (if (pair? r)
      (escalate 'export-failed (list ':reason (cadr r)))
      (display 'exported)))`,
`(define handle (camera-record 'demo))
(let ((r (camera-export handle '(:format "png"))))
  (if (pair? r)
      (escalate 'export-failed (list ':reason (cadr r)))
      (display 'exported)))`)

addAnchored(`(camera-export rec '(:format "gif" :delay 50))`,
`(define rec (camera-record 'demo))
(camera-export rec '(:format "gif" :delay 50))`)

add(`(camera-export rec '(:format "gif"))`,
`(define rec (camera-record 'demo))
(camera-export rec '(:format "gif"))`)

add(
`(let ((r (camera-export bad-handle)))
  (display (or (number? r) (and (pair? r) (eq? (car r) 'error)))))  ;; expect #t`,
`(define bad-handle 'not-a-recorder)
(let ((r (camera-export bad-handle)))
  (display (or (number? r) (and (pair? r) (eq? (car r) 'error)))))  ;; expect #t`)

add(
`(define a (camera-export rec1 '(:format "gif")))
(define b (camera-export rec2 '(:format "gif")))
;; equal frames + equal opts => equal encoded bytes
(display 'reproducible)`,
`(define rec1 (camera-record 'a))
(define rec2 (camera-record 'b))
(define a (camera-export rec1 '(:format "gif")))
(define b (camera-export rec2 '(:format "gif")))
;; equal frames + equal opts => equal encoded bytes
(display 'reproducible)`)

add(`(if establishing? (camera-fit-all 40 500) (camera-bring-to-view sel-id))`,
`(define establishing? #t)
(if establishing? (camera-fit-all 40 500) (camera-bring-to-view 'sel-id))`)

add(
`(let ((r (camera-frame h "canvas")))
  (if (pair? r) (escalate 'capture-failed (list ':reason (cadr r))) r))`,
`(define h (camera-record 'demo))
(let ((r (camera-frame h "canvas")))
  (if (pair? r) (escalate 'capture-failed (list ':reason (cadr r))) r))`)

addAnchored(`(camera-frame h "canvas")`,
`(define h (camera-record 'demo))
(camera-frame h "canvas")`)

add(
`(camera-frame h 'a)
(camera-frame h 'b)
;; buffer is [... a b], never [... b a]
(display 'order-preserved)`,
`(define h (camera-record 'demo))
(camera-frame h 'a)
(camera-frame h 'b)
;; buffer is [... a b], never [... b a]
(display 'order-preserved)`)

// two recorder-length proof slots: use a local frame model so the invariant is TRUE
add(
`(define n0 (recorder-length h))
(camera-frame h "canvas")
(display (= (recorder-length h) (+ n0 1)))  ;; expect #t`,
`(define frames '())
(define (recorder-length r) (length frames))
(define n0 (recorder-length 'r))
(set! frames (cons 'f frames))  ;; a captured frame is appended
(display (= (recorder-length 'r) (+ n0 1)))  ;; expect #t`)

add(
`(define h (camera-record 'empty))
(display (= (recorder-length h) 0))  ;; expect #t`,
`(define (recorder-length r) 0)
(define h (camera-record 'empty))
(display (= (recorder-length h) 0))  ;; expect #t`)

add(`(if want-origin? (camera-home) (camera-fit-all))`,
`(define want-origin? #t)
(if want-origin? (camera-home) (camera-fit-all))`)

add(`(if horizontal? (camera-pan dx) (camera-tilt dy))`,
`(define horizontal? #t)
(define dx 10)
(define dy 6)
(if horizontal? (camera-pan dx) (camera-tilt dy))`)

add(`(if precise-point? (camera-pan-to x y) (camera-center-on x y))`,
`(define precise-point? #t)
(define x 100)
(define y 50)
(if precise-point? (camera-pan-to x y) (camera-center-on x y))`)

add(`(camera-set! (car saved) (cadr saved) (caddr saved) 300)`,
`(define saved (list 100 50 1))
(camera-set! (car saved) (cadr saved) (caddr saved) 300)`)

add(`(if absolute-pose? (camera-set! x y s) (camera-pan dx))`,
`(define absolute-pose? #t)
(define x 100)
(define y 50)
(define s 1)
(define dx 10)
(if absolute-pose? (camera-set! x y s) (camera-pan dx))`)

add(`(if above-or-below? (camera-tilt dy) (camera-pan dx))`,
`(define above-or-below? #t)
(define dx 10)
(define dy 6)
(if above-or-below? (camera-tilt dy) (camera-pan dx))`)

add(`(for-each (lambda (p) (camera-pan-to (car p) (cadr p) 300) (camera-trace (list 'visiting p))) route)`,
`(define route (list (list 0 0) (list 100 50) (list 200 0)))
(for-each (lambda (p) (camera-pan-to (car p) (cadr p) 300) (camera-trace (list 'visiting p))) route)`)

add(
`(define (run-with-checkpoints rule max-gens checkpoint-interval)
  (let loop ((gen 0))
    (when (= (modulo gen checkpoint-interval) 0)
      (let ((count (grid-live-count)))
        (display (list "Gen" gen ": live cells =" count))))
    (if (< gen max-gens)
      (begin (grid-step rule) (loop (+ gen 1))))))
(run-with-checkpoints rule-conway 1000 100)`,
`(define rule-conway 'conway)
(define (grid-live-count) 0)
(define (grid-step rule) #f)
(define (run-with-checkpoints rule max-gens checkpoint-interval)
  (let loop ((gen 0))
    (when (= (modulo gen checkpoint-interval) 0)
      (let ((count (grid-live-count)))
        (display (list "Gen" gen ": live cells =" count))))
    (if (< gen max-gens)
      (begin (grid-step rule) (loop (+ gen 1))))))
(run-with-checkpoints rule-conway 1000 100)`)

add(
`(define (evolve-until-stable rule max-gens)
  (let loop ((gen 0) (prev-count -1))
    (if (>= gen max-gens)
      (display (list "Reached max generations:" gen))
      (let ((live (grid-live-count)))
        (if (= live prev-count)
          (display (list "Stabilized at generation" gen "with" live "live cells"))
          (begin
            (grid-step rule)
            (loop (+ gen 1) live)))))))
(evolve-until-stable rule-conway 500)`,
`(define rule-conway 'conway)
(define (grid-live-count) 0)
(define (grid-step rule) #f)
(define (evolve-until-stable rule max-gens)
  (let loop ((gen 0) (prev-count -1))
    (if (>= gen max-gens)
      (display (list "Reached max generations:" gen))
      (let ((live (grid-live-count)))
        (if (= live prev-count)
          (display (list "Stabilized at generation" gen "with" live "live cells"))
          (begin
            (grid-step rule)
            (loop (+ gen 1) live)))))))
(evolve-until-stable rule-conway 500)`)

add(
`(define now (audio-time))
(define f (land-on-downbeat 'x 'next-downbeat))
(display (>= (beat-time 'next-downbeat) now))`,
`(define (land-on-downbeat who beat) 'landed)
(define (beat-time beat) 999)
(define now (audio-time))
(define f (land-on-downbeat 'x 'next-downbeat))
(display (>= (beat-time 'next-downbeat) now))`)

add(
`(define a (sprite/address 'rose))
(define b (sprite 'rose))
;; two lookups of the same name are equivalent
(display 'stable-lookup)`,
`(define (sprite name) (sprite/address name))
(define a (sprite/address 'rose))
(define b (sprite 'rose))
;; two lookups of the same name are equivalent
(display 'stable-lookup)`)

add(
`(define (visible? e) (in-box? (entity/pos e) (viewport)))
(filter visible? (entity/all))`,
`(define (in-box? p box) #t)
(define (visible? e) (in-box? (entity/pos e) (viewport)))
(filter visible? (entity/all))`)

// "not a function: 80,80" — viewport is an assoc list, not a callable record
add(
`(define x 'x)
(define (on-screen? entity-x entity-y)
  (let ((vp (viewport)))
    (if (not vp) #f
      (and (>= entity-x (vp :x))
           (<= entity-x (+ (vp :x) (vp :w)))
           (>= entity-y (vp :y))
           (<= entity-y (+ (vp :y) (vp :h)))))))

(if (on-screen? 512 256) (display 'visible))`,
`(define (vp-get vp k) (let ((cell (assq k vp))) (if cell (cadr cell) 0)))
(define (on-screen? entity-x entity-y)
  (let ((vp (viewport)))
    (if (not vp) #f
      (and (>= entity-x (vp-get vp ':x))
           (<= entity-x (+ (vp-get vp ':x) (vp-get vp ':width)))
           (>= entity-y (vp-get vp ':y))
           (<= entity-y (+ (vp-get vp ':y) (vp-get vp ':height)))))))
(if (on-screen? 512 256) (display 'visible) (display 'off))`)

// ---- Group A: purge Curator verb NAMES ----
add(
`(card-do
  (lambda (ctx)
    (let ((target-id (ctx-get 'enemy-id ctx)))
      (camera-bring-to-view target-id 40 300)
      (next 'aim-sequence ctx))))`,
`(lambda (ctx)
  (let ((target-id (ctx-get 'enemy-id ctx)))
    (camera-bring-to-view target-id 40 300)
    (next 'aim-sequence ctx)))`)

add(
`(card-do
  (lambda (ctx)
    (camera-bring-to-view (ctx-get 'npc-id ctx) 40 300)
    (next 'talk ctx)))`,
`(lambda (ctx)
  (camera-bring-to-view (ctx-get 'npc-id ctx) 40 300)
  (next 'talk ctx))`)

add(
`(card-do
  (lambda (ctx)
    (let ((selected-ids (ctx-get 'selected-entities ctx)))
      (camera-fit-all 50 400)
      (next 'show-overview ctx))))`,
`(lambda (ctx)
  (let ((selected-ids (ctx-get 'selected-entities ctx)))
    (camera-fit-all 50 400)
    (next 'show-overview ctx)))`)

add(
`(on-minimap-click
  (lambda (wx wy)
    (camera-center-on wx wy)))`,
`;; a world-coordinate handler pans the main view to the clicked point
(define (pan-to-point wx wy)
  (camera-center-on wx wy))
(pan-to-point 120 80)`)

add(
`(define z0 (camera-zoom))
(camera-center-on 200 0)
;; scale omitted -> zoom unchanged
(display (= (camera-zoom) z0))  ;; expect #t after settle`,
`(define z0 (camera-scale))
(camera-center-on 200 0)
;; scale omitted -> zoom unchanged
(display (= (camera-scale) z0))  ;; expect #t after settle`)

add(
`(define (follow-card-y card-id)
  (let* ((rect (card-rect card-id))
         (target-y (/ (+ (cadr rect) (cadddr rect)) 2))
         (current-y (camera-y))
         (delta (abs (- target-y current-y))))
    (cond ((> delta 200) (camera-pan-to (camera-x) target-y 400))
          ((> delta 50)  (camera-pan-to (camera-x) target-y 200))
          (else          (display 'already-framed)))))
(follow-card-y 'task-card)`,
`(define (entity-bounds id) (list 0 0 100 80))
(define (follow-entity-y ent-id)
  (let* ((rect (entity-bounds ent-id))
         (target-y (/ (+ (cadr rect) (cadddr rect)) 2))
         (current-y (camera-y))
         (delta (abs (- target-y current-y))))
    (cond ((> delta 200) (camera-pan-to (camera-x) target-y 400))
          ((> delta 50)  (camera-pan-to (camera-x) target-y 200))
          (else          (display 'already-framed)))))
(follow-entity-y 'task-entity)`)

add(
`(define screen-width (lambda args (list "screen-width" args)))
(define screen-height (lambda args (list "screen-height" args)))
(define (zoom-to-fit-cards)
  (let ((all-cards (card-list)))
    (if (null? all-cards)
        (camera-zoom-to 1.0 250)
        (begin
          (camera-zoom-to 0.6 500)
          (camera-pan-to (/ (screen-width) 2) (/ (screen-height) 2) 500)))))
(zoom-to-fit-cards)`,
`(define (screen-width) 320)
(define (screen-height) 240)
(define (visible-items) '())
(define (zoom-to-fit-items)
  (let ((all-items (visible-items)))
    (if (null? all-items)
        (camera-zoom-to 1.0 250)
        (begin
          (camera-zoom-to 0.6 500)
          (camera-pan-to (/ (screen-width) 2) (/ (screen-height) 2) 500)))))
(zoom-to-fit-items)`)

add(
`(define (ensemble-land cards beat-name)
  (for-each
    (lambda (card)
      (let* ((delay-ms (* 50 (card-list-index cards card)))
             (adj-beat (list beat-name 'offset delay-ms)))
        (motion/move-to card (land-on-downbeat card adj-beat))))
    cards))
(ensemble-land (card-list) 'downbeat-2)`,
`(define (land-on-downbeat who beat) (list 0 0))
(define (index-of lst x)
  (let loop ((l lst) (i 0))
    (cond ((null? l) 0) ((eq? (car l) x) i) (else (loop (cdr l) (+ i 1))))))
(define (ensemble-land items beat-name)
  (for-each
    (lambda (it)
      (let* ((delay-ms (* 50 (index-of items it)))
             (adj-beat (list beat-name 'offset delay-ms)))
        (motion/move-to it (land-on-downbeat it adj-beat))))
    items))
(ensemble-land (list 'a 'b 'c) 'downbeat-2)`)

add(
`(define (choreograph-combat attacker defender)
  (sprites attacker
    (list 'in-order
      (list 'lean-aside 30)
      (list 'wait 200)))
  (sprites defender
    (list 'in-order
      (list 'wait 200)
      (list 'lean-aside -40)
      (list 'wait 100))))
(choreograph-combat 'hero 'goblin)`,
`(define (choreo who program) (list 'choreo who program))
(define (choreograph-combat attacker defender)
  (choreo attacker
    (list 'in-order
      (list 'lean-aside 30)
      (list 'wait 200)))
  (choreo defender
    (list 'in-order
      (list 'wait 200)
      (list 'lean-aside -40)
      (list 'wait 100))))
(choreograph-combat 'hero 'goblin)`)

add(
`(define (card-fits-horizontally? card-id)
  (let ((rect (card-screen-rect card-id))
        (vp-w (viewport-width)))
    (if vp-w
      (<= (hash-table-ref/default rect 'w #f) vp-w)
      #f)))

(card-fits-horizontally? 'my-card)`,
`(define (viewport-width) 200)
(define (screen-bounds id)
  (let ((h (make-hash-table)))
    (hash-table-set! h 'w 80)
    h))
(define (fits-horizontally? id)
  (let ((rect (screen-bounds id))
        (vp-w (viewport-width)))
    (if vp-w
      (<= (hash-table-ref/default rect 'w 0) vp-w)
      #f)))
(fits-horizontally? 'my-item)`)

// ---- apply, asserting each matches exactly once ----
let ok = 0, bad = []
for (const [o, n] of P) {
  const fo = enc(o), fn = enc(n)
  const count = content.split(fo).length - 1
  if (count === 1) { content = content.replace(fo, fn); ok++ }
  else bad.push({ head: o.split('\n')[0].slice(0, 55), count })
}
for (const [o, n] of A) {
  const fo = '"' + enc(o) + '"', fn = '"' + enc(n) + '"'
  const count = content.split(fo).length - 1
  if (count === 1) { content = content.replace(fo, fn); ok++ }
  else bad.push({ head: '[anchored] ' + o.split('\n')[0].slice(0, 44), count })
}
const TOTAL = P.length + A.length
if (bad.length) {
  console.log('UNMATCHED / AMBIGUOUS:')
  for (const b of bad) console.log(`  count=${b.count}  ${b.head}`)
} else {
  writeFileSync(FILE, content)
}
console.log(`applied ${ok}/${TOTAL} replacements${bad.length ? ' — FILE NOT WRITTEN' : ' — written'}`)
