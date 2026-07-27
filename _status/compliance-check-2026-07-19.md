# Motoi Reference Compliance Check — code runnability

Total code blocks checked: 14809
Passes: 14326
Failures: 483
Skipped (marked :runs "spec-only"): 3

Pass rate: 96.7%

## Failures — grouped by verb


### `all-verbs` — file `00b-introspection.slat`

- **row-2-audit** :program
  ```scheme
  (filter (lambda (v) (equal? (substring v 0 6) 'audio/')) (all-verbs))
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 54)

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define (namespace-census)
  (define (ns v) (let ((s (if (symbol? v) (symbol->string v) v)))
                   (let loop ((i 0))
                     (cond ((>= i (string-length s)) 'core)
                           ((char=? (string-ref s i) #\/) (substring s 0 i))
                           (else 
  ```
  Error:
  ```
  error: Cannot use 'in' operator to search for 'name' in ai

  ```

### `arity-of` — file `00b-introspection.slat`

- **row-2-audit** :program
  ```scheme
  (let ((a (arity-of 'my-verb)))
  (if (and (number? a) (= a (length args)))
      (apply 'my-verb args)
      'wrong-arity))
  ```
  Error:
  ```
  error: unbound symbol: args

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define (call-if-compatible v args)
  (let ((a (arity-of v)))
    (cond ((null? a) (list 'unknown v))
          ((number? a) (if (= a (length args)) (apply v args) (list 'arg-mismatch 'need a 'got (length args))))
          (else (let ((mn (car a)) (mx (cadr a)) (n (length args)))
                  
  ```
  Error:
  ```
  error: not a function: car

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (dispatch-table entries args)
  ;; Table of (name . verb); pick first whose arity matches args.
  (let loop ((es entries))
    (cond ((null? es) 'no-match)
          ((let ((a (arity-of (cdr (car es)))))
             (and (number? a) (= a (length args))))
           (apply (cdr (car es)) arg
  ```
  Error:
  ```
  error: introspect: expected symbol or string, got object

  ```

### `describe` — file `00b-introspection.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (defensive? v)
  ;; even a bare symbol never breaks the caller
  (with-handler (lambda (e) #f)
    (lambda () (string? (describe v)))))
(defensive? 'utterly-undefined-name)
  ```
  Error:
  ```
  error: unbound symbol: with-handler

  ```

### `help` — file `00b-introspection.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (registry-tabulate keys)
  ;; Build one column per key, one row per verb.
  (let* ((all (all-verbs))
         (rows (map (lambda (v)
                      (let ((m (help v)))
                        (cons v (map (lambda (k)
                                       (if (null? m) '- (cdr (or (as
  ```
  Error:
  ```
  error: Cannot read properties of null (reading 'find')

  ```

### `stats/verb-calls` — file `00b-introspection.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (namespace-heat)
  ;; Aggregate top-100 by namespace prefix.
  (let ((by-ns '()))
    (for-each (lambda (row)
                (let* ((v (symbol->string (car row)))
                       (slash (and (> (string-length v) 0)
                                   (let loop ((i 0))
                
  ```
  Error:
  ```
  error: Cannot use 'in' operator to search for 'name' in :tick

  ```

### `across-beats` — file `01-core.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (formation-size name)
  ;; formations are finite maps: slot-index -> (x y); size = entity count
  (length (descriptor-slots (across-beats name))))
(formation-size 'circle)
  ```
  Error:
  ```
  error: unbound symbol: descriptor-slots

  ```

### `after` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (cooldown-gate ctx action)
  (if (> (- (time 'now) (ctx-get 'last-fire ctx)) 2)
      (begin (action) (ctx-set 'last-fire (time 'now) ctx))
      (after 0.2 'retry-action ctx)))
(cooldown-gate (ctx) (lambda () (world/spawn 'effect 0 0)))
  ```
  Error:
  ```
  error: unbound symbol: ctx

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (retry-with-backoff ctx attempt)
  (let ((delay (* 0.5 (expt 2 attempt))))
    (if (< attempt 4)
        (after delay 'retry (ctx-set 'attempt (+ attempt 1) ctx))
        (next 'failed ctx))))
(retry-with-backoff (ctx) 0)
  ```
  Error:
  ```
  error: unbound symbol: ctx

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (send-request req) req)
(define (timeout-race send-fn ctx)
  ;; fire request + arm timeout simultaneously
  (send-fn (ctx-get 'req ctx))
  (after 5 'timeout ctx))
(timeout-race send-request (ctx))
  ```
  Error:
  ```
  error: unbound symbol: ctx

  ```

### `after-frame` — file `01-core.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (idempotent-measure key)
  ;; guard: skip if already measured this key
  (unless (assoc key (measured-cache))
    (after-frame
      (lambda ()
        (cache-set! key (card-rows))))))
(idempotent-measure 'main-panel)
  ```
  Error:
  ```
  error: unbound symbol: measured-cache

  ```

### `arc-between` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (define swoop (arc-between '(0 0) '(100 0) '(height 40)))
(in-formation swoop (list 'boss))
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define entry-arc (arc-between '(0 0) '(80 40) '(height 30)))
(in-formation entry-arc (list 'boss))
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (endpoint-check start end h)
  ;; B(0)=start B(1)=end for quadratic Bezier through (mid-x, h)
  (let ((mid (list (/ (+ (car start) (car end)) 2) h)))
    (and (equal? (bezier2 start mid end 0) start)
         (equal? (bezier2 start mid end 1) end))))
(endpoint-check '(0 0) '(100 0) 40)
  ```
  Error:
  ```
  error: unbound symbol: bezier2

  ```
- **row-5-emergence** :composition
  ```scheme
  (define path (arc-between (entity/pos 'leader) (entity/pos 'target)))
(in-formation path (list 'follower1 'follower2 'follower3))
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (arc-length-approx start end h steps)
  ;; numeric arc-length by Riemann sum on Bezier
  (let ((mid (list (/ (+ (car start) (car end)) 2) h)))
    (let loop ((i 0) (acc 0))
      (if (= i steps) acc
          (let* ((t1 (/ i steps))
                 (t2 (/ (+ i 1) steps))
                 (p
  ```
  Error:
  ```
  error: unbound symbol: bezier2

  ```

### `at-beat` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  ;; sample a curve at t = 0.75:
(easing 'ease-in-out 0.75)
  ```
  Error:
  ```
  error: unbound symbol: easing

  ```

### `audio-bands` — file `01-core.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (snapshot-isolated?)
  (let ((a (audio-bands)))
    (set-car! a 999)
    (let ((b (audio-bands)))
      (not (= (car b) 999)))))
(display (snapshot-isolated?))
  ```
  Error:
  ```
  error: unbound symbol: set-car!

  ```
- **row-4-proof** :program
  ```scheme
  (define a (audio-bands))
(set-car! a 999)
(define b (audio-bands))
(display (= (car b) 999))  ;; expect #f
  ```
  Error:
  ```
  error: unbound symbol: set-car!

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define a (audio-bands))
(set-car! a 999)
(define b (audio-bands))
(display (= (car b) 999))  ;; #f — copy-on-read confirmed
  ```
  Error:
  ```
  error: unbound symbol: set-car!

  ```

### `audio-halt` — file `01-core.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (resource-pool size factory)
  ;; pool of audio handles; halt all on teardown
  (let ((handles (map (lambda (_) (factory)) (iota size))))
    (lambda (op)
      (case op
        ((teardown) (for-each audio-halt handles))
        ((get)      handles)))))
(define pool (resource-pool 3 (lambda 
  ```
  Error:
  ```
  error: not a function: undefined

  ```

### `audio-master-volume` — file `01-core.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (scene-transition-out ctx)
  (let loop ((v 1.0))
    (audio-master-volume v)
    (if (> v 0)
        (after 0.05 'fade-step (ctx-set 'vol (- v 0.05) ctx))
        (begin (audio-halt (ctx-get 'handle ctx))
               (next 'scene-black ctx)))))
(scene-transition-out (ctx))
  ```
  Error:
  ```
  error: unbound symbol: ctx

  ```

### `audio-perceptual-bands` — file `01-core.slat`

- **row-4-proof** :program
  ```scheme
  (display (for-all (lambda (b) (>= b 0)) (audio-perceptual-bands)))  ;; expect #t
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```

### `audio-tempo` — file `01-core.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define plan '((0 . 90) (16 . 120) (32 . 140) (48 . 90)))
(on-frame
  (lambda ()
    (let ((bar (quotient (frame) 240)))
      (let ((hit (assv bar plan)))
        (when hit (audio-tempo (cdr hit))))))
  ```
  Error:
  ```
  error: missing ) (line 2, col 1)

  ```

### `begin-frame` — file `01-core.slat`

- **row-4-proof** :program
  ```scheme
  (let ((ok (begin-frame 'main)))
  (display (or (eq? ok #t) (eq? ok #f))))  ;; expect #t
  ```
  Error:
  ```
  error: Cannot use 'in' operator to search for 'name' in true

  ```

### `camera-bring-to-view` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (camera-bring-to-view (player-id))
  ```
  Error:
  ```
  error: unbound symbol: player-id

  ```
- **row-2-audit** :program
  ```scheme
  (card-do
  (lambda (ctx)
    (camera-bring-to-view (ctx-get 'npc-id ctx) 40 300)
    (next 'talk ctx)))
  ```
  Error:
  ```
  error: unbound symbol: card-do

  ```
- **row-4-proof** :program
  ```scheme
  (camera-bring-to-view (player-id) 24)
;; once settled: player bounds ⊆ (viewport shrunk by 24px on every side)
(display 'framed)
  ```
  Error:
  ```
  error: unbound symbol: player-id

  ```
- **row-4-proof** :program
  ```scheme
  (display (eq? (camera-bring-to-view (player-id)) '()))  ;; null, tween runs later
  ```
  Error:
  ```
  error: unbound symbol: player-id

  ```
- **row-4-proof** :program
  ```scheme
  (camera-bring-to-view (player-id) 20)
(camera-bring-to-view (player-id) 60)
;; the 60px call leaves at least as much margin as the 20px call
(display 'more-pad-more-margin)
  ```
  Error:
  ```
  error: unbound symbol: player-id

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (focus-tour ids)
  (fold
    (lambda (id delay)
      (after delay 'focus (list 'id id))
      (+ delay 800))
    0 ids))
(focus-tour (list (player-id) (boss-id) (exit-id)))
  ```
  Error:
  ```
  error: unbound symbol: player-id

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define rec (camera-record 'highlight))
(camera-bring-to-view (boss-id) 50 600)
(on-frame (lambda () (camera-frame rec 'screen)))
  ```
  Error:
  ```
  error: unbound symbol: boss-id

  ```

### `camera-center-on` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (on-minimap-click
  (lambda (wx wy)
    (camera-center-on wx wy)))
  ```
  Error:
  ```
  error: unbound symbol: on-minimap-click

  ```
- **row-4-proof** :program
  ```scheme
  (define z0 (camera-zoom))
(camera-center-on 200 0)
;; scale omitted -> zoom unchanged
(display (= (camera-zoom) z0))  ;; expect #t after settle
  ```
  Error:
  ```
  error: unbound symbol: camera-zoom

  ```

### `camera-export` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (let ((r (camera-export handle '(:format "png"))))
  (if (pair? r)
      (escalate 'export-failed (list ':reason (cadr r)))
      (display 'exported)))
  ```
  Error:
  ```
  error: unbound symbol: handle

  ```
- **row-2-audit** :program
  ```scheme
  (camera-export rec '(:format "gif" :delay 50))
  ```
  Error:
  ```
  error: unbound symbol: rec

  ```
- **row-3-dimension** :code
  ```scheme
  (camera-export rec '(:format "gif"))
  ```
  Error:
  ```
  error: unbound symbol: rec

  ```
- **row-4-proof** :program
  ```scheme
  (let ((r (camera-export bad-handle)))
  (display (or (number? r) (and (pair? r) (eq? (car r) 'error)))))  ;; expect #t
  ```
  Error:
  ```
  error: unbound symbol: bad-handle

  ```
- **row-4-proof** :program
  ```scheme
  (define a (camera-export rec1 '(:format "gif")))
(define b (camera-export rec2 '(:format "gif")))
;; equal frames + equal opts => equal encoded bytes
(display 'reproducible)
  ```
  Error:
  ```
  error: unbound symbol: rec1

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (record-and-export name draw frames)
  (let ((rec (camera-record name)))
    (for-each (lambda (_) (draw) (camera-frame rec 'screen)) (iota frames))
    (camera-export rec '(:format "gif" :delay 50))))
(record-and-export 'replay redraw-scene 30)
  ```
  Error:
  ```
  error: unbound symbol: redraw-scene

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (export-with-retry handle opts tries)
  (let loop ((n tries))
    (let ((r (camera-export handle opts)))
      (if (and (pair? r) (> n 1))
          (loop (- n 1))
          r))))
(export-with-retry rec '(:format "gif") 3)
  ```
  Error:
  ```
  error: unbound symbol: rec

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (on-event 'boss-defeated
  (lambda ()
    (let ((r (camera-export current-recorder '(:format "gif"))))
      (unless (pair? r) (card-emit 'highlight-saved r)))))
  ```
  Error:
  ```
  error: unbound symbol: on-event

  ```

### `camera-fit-all` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (if establishing? (camera-fit-all 40 500) (camera-bring-to-view sel-id))
  ```
  Error:
  ```
  error: unbound symbol: establishing?

  ```
- **row-4-proof** :program
  ```scheme
  (camera-fit-all 24 0)
;; once settled: for each entity e, (in-viewport? (entity/pos e)) => #t
(display (for-all (world/entities) (lambda (e) (in-viewport? (entity/pos e)))))
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (overview-around thunk)
  (camera-fit-all 40 300)
  (thunk)
  (camera-fit-all 40 300))
(overview-around (lambda () (run-turn)))
  ```
  Error:
  ```
  error: unbound symbol: run-turn

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (on-event 'entity-spawned
  (lambda () (camera-fit-all 40 300)))
  ```
  Error:
  ```
  error: unbound symbol: on-event

  ```

### `camera-frame` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (let ((r (camera-frame h "canvas")))
  (if (pair? r) (escalate 'capture-failed (list ':reason (cadr r))) r))
  ```
  Error:
  ```
  error: unbound symbol: h

  ```
- **row-3-dimension** :code
  ```scheme
  (camera-frame h "canvas")
  ```
  Error:
  ```
  error: unbound symbol: h

  ```
- **row-4-proof** :program
  ```scheme
  (define n0 (recorder-length h))
(camera-frame h "canvas")
(display (= (recorder-length h) (+ n0 1)))  ;; expect #t
  ```
  Error:
  ```
  error: unbound symbol: recorder-length

  ```
- **row-4-proof** :program
  ```scheme
  (camera-frame h 'a)
(camera-frame h 'b)
;; buffer is [... a b], never [... b a]
(display 'order-preserved)
  ```
  Error:
  ```
  error: unbound symbol: h

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (record-loop h draw n)
  (let loop ((i 0))
    (when (< i n) (draw) (camera-frame h 'screen) (wait 33) (loop (+ i 1)))))
(record-loop (camera-record 'anim) redraw 30)
  ```
  Error:
  ```
  error: unbound symbol: redraw

  ```

### `camera-home` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (if want-origin? (camera-home) (camera-fit-all))
  ```
  Error:
  ```
  error: unbound symbol: want-origin?

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (cutscene body)
  (camera-home 0)
  (body)
  (camera-home 500))
(cutscene play-boss-intro)
  ```
  Error:
  ```
  error: unbound symbol: play-boss-intro

  ```

### `camera-pan` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (if horizontal? (camera-pan dx) (camera-tilt dy))
  ```
  Error:
  ```
  error: unbound symbol: horizontal?

  ```

### `camera-pan-to` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (if precise-point? (camera-pan-to x y) (camera-center-on x y))
  ```
  Error:
  ```
  error: unbound symbol: precise-point?

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (let ((e (world/find (lambda (x) (eq? (entity/kind x) 'quest)))))
  (when e (camera-pan-to (entity-x e) (entity-y e) 400)))
  ```
  Error:
  ```
  error: unbound symbol: entity-x

  ```

### `camera-record` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (let ((r (camera-record 'my-scene)))
  (if (pair? r) (escalate 'record-open-failed (list ':reason (cadr r))) r))
  ```
  Error:
  ```
  error: escalate: record-open-failed :reason,0

  ```
- **row-4-proof** :program
  ```scheme
  (define h (camera-record 'empty))
(display (= (recorder-length h) 0))  ;; expect #t
  ```
  Error:
  ```
  error: unbound symbol: recorder-length

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (on-event 'level-start
  (lambda ()
    (set! current-rec (camera-record (level-name)))))
  ```
  Error:
  ```
  error: unbound symbol: on-event

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (with-recording name body)
  (let ((h (camera-record name)))
    (if (pair? h) h
        (begin (body h) (camera-export h '(:format "gif"))))))
(with-recording 'run capture-a-run)
  ```
  Error:
  ```
  error: unbound symbol: capture-a-run

  ```

### `camera-scale` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (if (< (camera-scale) 0.5) (draw-detail) (draw-coarse))
  ```
  Error:
  ```
  error: unbound symbol: draw-coarse

  ```
- **row-2-audit** :program
  ```scheme
  (define screen-px (/ world-length (camera-scale)))
  ```
  Error:
  ```
  error: unbound symbol: world-length

  ```

### `camera-set!` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (camera-set! (car saved) (cadr saved) (caddr saved) 300)
  ```
  Error:
  ```
  error: unbound symbol: saved

  ```
- **row-2-audit** :program
  ```scheme
  (if absolute-pose? (camera-set! x y s) (camera-pan dx))
  ```
  Error:
  ```
  error: unbound symbol: absolute-pose?

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (with-saved-camera body)
  (let ((s (camera-state)))
    (body)
    (camera-set! (hash-table-ref/default s 'x #f) (hash-table-ref/default s 'y #f) (hash-table-ref/default s 'k #f) 300)))
(with-saved-camera peek-around)
  ```
  Error:
  ```
  error: unbound symbol: peek-around

  ```

### `camera-state` — file `01-core.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (rewind history n)
  (let ((old (list-ref history (min n (- (length history) 1)))))
    (camera-set! (hash-table-ref/default old 'x #f) (hash-table-ref/default old 'y #f) (hash-table-ref/default old 'k #f) 300)))
(rewind camera-history 30)
  ```
  Error:
  ```
  error: unbound symbol: camera-history

  ```

### `camera-tilt` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (if above-or-below? (camera-tilt dy) (camera-pan dx))
  ```
  Error:
  ```
  error: unbound symbol: above-or-below?

  ```

### `camera-trace` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (for-each (lambda (p) (camera-pan-to (car p) (cadr p) 300) (camera-trace (list 'visiting p))) route)
  ```
  Error:
  ```
  error: unbound symbol: route

  ```

### `camera-x` — file `01-core.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (center-on-card card)
  (let* ((rect (card-rect card))
         (target-x (/ (+ (car rect) (caddr rect)) 2)))
    (when (> (abs (- target-x (camera-x))) 50)
      (camera-pan-to target-x (camera-y) 300))))
(center-on-card 'task)
  ```
  Error:
  ```
  error: unbound symbol: card-rect

  ```

### `camera-zoom-to` — file `01-core.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (zoom-if-legible s)
  (when (zoom-legible? s)
    (camera-zoom-to s 300)))
(zoom-if-legible 3.5)
  ```
  Error:
  ```
  error: unbound symbol: zoom-legible?

  ```

### `cancel-tick` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (register-tick 'status-check (lambda () (display 'checking)))
;; operator dismisses the panel this timer belonged to:
(cancel-tick 'status-check)
  ```
  Error:
  ```
  error: unbound symbol: register-tick

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define fired 0)
(register-tick 'once (lambda () (set! fired (+ fired 1))))
(cancel-tick 'once)
;; no further increments after cancel
(display fired)
  ```
  Error:
  ```
  error: unbound symbol: register-tick

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define n 0)
(register-tick 'countdown
  (lambda ()
    (set! n (+ n 1))
    (when (>= n 5) (cancel-tick 'countdown))))
  ```
  Error:
  ```
  error: unbound symbol: register-tick

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (register-tick 'search (lambda () (display 'polling)))
(after 30000 (lambda () (cancel-tick 'search)))
  ```
  Error:
  ```
  error: unbound symbol: register-tick

  ```

### `clear-surface-layer` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (redraw-hud msg)
  (clear-surface-layer 'hud 'text)
  (surface-paint-text 'hud 'text msg 10 10))
(redraw-hud "Score: 42")
  ```
  Error:
  ```
  error: unbound symbol: surface-paint-text

  ```
- **row-4-proof** :eng-program
  ```scheme
  (surface-paint-text 'main 'overlay "stale" 0 0)
(clear-surface-layer 'main 'overlay)
;; overlay now holds nothing; safe to repaint
(display 'wiped)
  ```
  Error:
  ```
  error: unbound symbol: surface-paint-text

  ```

### `eval` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (define ops (list (cons 'add +) (cons 'mul *)))
(define (run name args)
  (let ((fn (cdr (assq name ops))))
    (if fn (apply fn args) (escalate 'unknown-op name))))
(display (run 'add (list 1 2 3)))
  ```
  Error:
  ```
  error: not a function: (...a) => _hasRat(a) ? _numFold(a, _ratAdd, (x, y) => x + y, _ZERO) : a.reduce((x, y) => x + y, 0)

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define (attempt-eval form)
  ;; a cart reaching for eval must escalate, not run
  (escalate 'eval-forbidden (list :form form :decision 'engineering-005 :try 'apply-or-dispatch)))
(attempt-eval '(+ 1 2))
  ```
  Error:
  ```
  error: escalate: eval-forbidden :form,+,1,2,:decision,engineering-005,:try,apply-or-dispatch

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define ops (list (cons 'add +) (cons 'sub -)))
(define (dispatch op args)
  (let ((fn (assq op ops)))
    (if fn (apply (cdr fn) args) (escalate 'unknown-op op))))
(display (dispatch 'sub (list 10 3)))
  ```
  Error:
  ```
  error: not a function: (...a) => _hasRat(a) ? _numFold(a, _ratSub, (x, y) => x - y, _ZERO) : (a.length === 1 ? -a[0] : a.reduce((x, y) => x - y))

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define ops (list (cons 'inc (lambda (x) (+ x 1)))))
(define (call name x)
  (apply (cdr (assq name ops)) (list x)))
(display (= (call 'inc 5) (call 'inc 5)))
  ```
  Error:
  ```
  error: not a function: [object Object]

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define cmds
  (list (cons 'inc (lambda () (+ 1 1)))
        (cons 'dec (lambda () (- 1 1)))))
(define (run-cmd name)
  (let ((c (assq name cmds)))
    (if c ((cdr c)) (escalate 'unknown-cmd name))))
(display (run-cmd 'inc))
  ```
  Error:
  ```
  error: not a function: [object Object]

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (guarded-eval form trusted?)
  (if trusted?
      (escalate 'eval-still-forbidden form)
      (escalate 'untrusted-eval form)))
(guarded-eval '(delete-all) #f)
  ```
  Error:
  ```
  error: escalate: untrusted-eval delete-all

  ```

### `grid-cell-set!` — file `01-core.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (conway-step)
  (let loop-y ((y 0))
    (when (< y (rows))
      (let loop-x ((x 0))
        (when (< x (cols))
          (let ((n (grid-neighbors x y)) (s (grid-cell-state x y)))
            (grid-cell-set! x y
              (if (or (and (= s 1) (or (= n 2) (= n 3)))
                      (
  ```
  Error:
  ```
  error: fuel exhausted

  ```

### `grid-live-count` — file `01-core.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (run-until-dead rule max-gens)
  (let loop ((g 0))
    (cond ((= 0 (grid-live-count)) (list 'extinct g))
          ((>= g max-gens) (list 'timeout g))
          (else (grid-step rule) (loop (+ g 1))))))
(display (run-until-dead rule-conway 100))
  ```
  Error:
  ```
  error: unbound symbol: rule-conway

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (stable? rule)
  (let ((before (grid-live-count)))
    (grid-step rule)
    (= before (grid-live-count))))
(display (stable? rule-conway))
  ```
  Error:
  ```
  error: unbound symbol: rule-conway

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (peak-population rule n)
  (let loop ((g 0) (peak 0))
    (if (< g n)
      (begin (grid-step rule)
             (loop (+ g 1) (max peak (grid-live-count))))
      peak)))
(display (peak-population rule-conway 20))
  ```
  Error:
  ```
  error: unbound symbol: rule-conway

  ```

### `grid-step` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (grid-step rule-conway)
  ```
  Error:
  ```
  error: unbound symbol: rule-conway

  ```

### `grid-step-aged` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (grid-step-aged conway-rule)
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```
- **row-2-audit** :eng-program
  ```scheme
  (grid-init 32 32)
(conway-spawn-blinker 16 16)
(grid-step-aged conway-rule)
(display (grid-cell-age 16 16))
  ```
  Error:
  ```
  error: unbound symbol: conway-spawn-blinker

  ```
- **row-2-audit** :math-program
  ```scheme
  (grid-init 8 8)
(grid-cell-set! 3 3 1)
(grid-step-aged conway-rule)
(display (>= (grid-cell-age 3 3) 0))
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```
- **row-2-audit** :cs-program
  ```scheme
  (grid-step-aged conway-rule)
(display (<= (grid-cell-age 0 0) 65535))
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```
- **row-3-dimension** :code
  ```scheme
  (grid-step-aged conway-rule)
(display (grid-cell-age 5 5))
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```
- **row-4-proof** :program
  ```scheme
  (grid-init 8 8)
(grid-cell-set! 2 2 1)
(grid-cell-set! 2 3 1)
(grid-cell-set! 2 4 1)
(grid-step-aged conway-rule)
(display (or (not (grid-cell? 2 2)) (>= (grid-cell-age 2 2) 0)))
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```
- **row-4-proof** :eng-program
  ```scheme
  (grid-init 5 5)
(grid-cell-set! 2 2 1)
(grid-step-aged conway-rule)
(display (if (grid-cell? 2 2) (>= (grid-cell-age 2 2) 1) (= (grid-cell-age 2 2) 0)))
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```
- **row-4-proof** :cs-program
  ```scheme
  (grid-init 6 6)
(grid-cell-set! 3 3 1)
(grid-step-aged conway-rule)
(display (integer? (grid-cell-age 3 3)))
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```
- **row-5-emergence** :composition
  ```scheme
  (grid-init 40 40)
(conway-spawn-blinker 20 20)
(on-tick
  (lambda ()
    (grid-step-aged conway-rule)
    (paint-grid-with-age 'surface
      (list "#000" "#0f0" "#0a0" "#050")
      (lambda (age) (min 3 (quotient age 10))))))
  ```
  Error:
  ```
  error: unbound symbol: conway-spawn-blinker

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (bucket a) (cond ((< a 3) 0) ((< a 20) 1) ((< a 100) 2) (else 3)))
(grid-step-aged conway-rule)
(display (bucket (grid-cell-age 20 20)))
  ```
  Error:
  ```
  error: unbound symbol: conway-rule

  ```

### `grid-step-count` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (grid-step rule-conway)
(display (list "generation" (grid-step-count)))
  ```
  Error:
  ```
  error: unbound symbol: rule-conway

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define schedule '(10 50 100))
(grid-step rule-conway)
(display (memv (grid-step-count) schedule))
  ```
  Error:
  ```
  error: unbound symbol: rule-conway

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (monitor)
  (list 'gen (grid-step-count) 'live (grid-live-count)))
(grid-step rule-conway)
(display (monitor))
  ```
  Error:
  ```
  error: unbound symbol: rule-conway

  ```

### `key?` — file `01-core.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (any-of? . keys)
  (memf key? keys))
(when (any-of? 'w 'a 's 'd) (display 'moving))
  ```
  Error:
  ```
  error: unbound symbol: memf

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (all-of? keys)
  (andmap key? keys))
(display (all-of? '(shift w)))
  ```
  Error:
  ```
  error: unbound symbol: andmap

  ```

### `land-on-downbeat` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (let ((land-fn (land-on-downbeat 'hero-card 'next-downbeat)))
  (motion/move-to 'hero-card (land-fn)))
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-2-audit** :cs-program
  ```scheme
  (for-each
  (lambda (c)
    (motion/move-to c (land-on-downbeat c 'downbeat-2)))
  (card-list))
  ```
  Error:
  ```
  error: unbound symbol: card-list

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define now (audio-time))
(define f (land-on-downbeat 'x 'next-downbeat))
(display (>= (beat-time 'next-downbeat) now))
  ```
  Error:
  ```
  error: unbound symbol: beat-time

  ```

### `measure-content` — file `01-core.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (valid-dims? id)
  (let ((d (measure-content id)))
    (if (eq? d 'error)
        #f
        (andmap (lambda (kv) (>= (cadr kv) 0)) d))))
(display (valid-dims? 'my-card))
  ```
  Error:
  ```
  error: unbound symbol: andmap

  ```

### `note` — file `01-core.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (bad-pitch? p)
  (eq? (car (note p 'quarter 0.8)) 'error))
(display (bad-pitch? 'not-a-pitch))
  ```
  Error:
  ```
  error: unrecognized pitch: not-a-pitch

  ```

### `sprite` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (sprite 'hero '(turn 45) '(tint red))
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define turn (lambda args (list "turn" args)))
;; fetch and rotate in one construction
(sprite 'rose (turn 90))
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-2-audit** :math-program
  ```scheme
  (define turn (lambda args (list "turn" args)))
;; forms apply in order: composition is left-to-right
(sprite 'rose (turn 30) (turn 60))
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-2-audit** :cs-program
  ```scheme
  (sprite 'no-such-sprite)
;; unknown name yields an error tuple, not an exception
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-4-proof** :program
  ```scheme
  (define a (sprite 'x))
(define b (sprite 'x))
(display 'stable-lookup)
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define a (sprite 'rose))
(define b (sprite 'rose))
;; two lookups of the same name are equivalent
(display 'stable-lookup)
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-4-proof** :math-program
  ```scheme
  (define upper (sprite 'ROSE))
(define lower (sprite 'rose))
;; name is case-normalized: ROSE and rose denote the same sprite
(display 'case-insensitive)
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define plain (sprite 'rose))
;; no forms = identity transform: the sprite in default state
(display 'default-state)
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (sprite 'hero (list 'turn (* 45 (audio-band 3))))
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define turn (lambda args (list "turn" args)))
(define (ring n)
  ;; n copies of a sprite, each rotated by 360/n degrees
  (map (lambda (i) (sprite 'rose (turn (* i (/ 360 n)))))
       (iota n)))
(display (ring 6))
  ```
  Error:
  ```
  error: unbound symbol: sprite

  ```

### `sprites` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (sprites (list 'hero 'sidekick) (list 'anim 'walk))
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-2-audit** :eng-program
  ```scheme
  (sprites 'goblin (list 'rotate 45))
;; a single name is accepted as well as a list
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-2-audit** :math-program
  ```scheme
  (sprites (list 'a 'b 'c) (list 'tint 'red))
;; one form broadcast uniformly across the target set
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-2-audit** :cs-program
  ```scheme
  (sprites (list 'knight 'squire)
  (list 'in-order
    (list 'move-to 100 200)
    (list 'rotate 90)))
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-4-proof** :program
  ```scheme
  (sprites (list 'a 'b 'c) (list 'tint 'red))
(display 'consistent-across-targets)
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-4-proof** :eng-program
  ```scheme
  (sprites (list 'a 'b 'c) (list 'tint 'red))
;; every listed sprite receives the identical tint form
(display 'uniform-tint)
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-4-proof** :math-program
  ```scheme
  (sprites (list 'x) (list 'rotate 90))
;; a singleton target set degenerates to the single-sprite case
(display 'singleton-ok)
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-4-proof** :cs-program
  ```scheme
  (sprites (list 'a 'b) (list 'bad-form))
;; an invalid form emits no event -- validation guards the batch
(display 'validated)
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (sprites (list 'a 'b 'c) (list 'anim 'idle))
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (choreograph attacker defender)
  (sprites attacker
    (list 'in-order (list 'lean-aside 30) (list 'wait 200)))
  (sprites defender
    (list 'in-order (list 'wait 200) (list 'lean-aside -40))))
(choreograph 'hero 'goblin)
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define roster (map (lambda (i) (string->symbol (string-append "npc" (number->string i)))) (iota 8)))
(sprites roster (list 'anim 'wander))
  ```
  Error:
  ```
  error: unbound symbol: sprites

  ```

### `stop` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (when (game-over?) (stop))
  ```
  Error:
  ```
  error: unbound symbol: game-over?

  ```

### `touch` — file `01-core.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (press-the-button ctx)
  (let ((b (card-find-by-kind 'button)))
    (when (pair? b) (touch 'hand (card-id-of b)))))
(press-the-button 'ctx)
  ```
  Error:
  ```
  error: unbound symbol: card-find-by-kind

  ```

### `wait` — file `01-core.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (poll-then-wait ctx)
  (if (null? (ctx-result ctx))
      (wait 'retry-signal 5000)
      (next 'done ctx)))
(poll-then-wait 'ctx)
  ```
  Error:
  ```
  error: unbound symbol: ctx-result

  ```

### `with-spacing` — file `01-core.slat`

- **row-2-audit** :program
  ```scheme
  (with-spacing 10
  (in-formation 'row (list 'a 'b 'c)))
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define (troupe members gap)
  (with-spacing gap
    (in-formation 'row members)))
(troupe '(a b c d) 40)
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (spaced-or-default members)
  (if (pair? members)
      (with-spacing 16 (in-formation 'row members))
      '()))
(spaced-or-default '(a b))
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-4-proof** :program
  ```scheme
  (with-spacing 10 (in-formation 'row '(a b)))
(display 'scoped-spacing)
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-4-proof** :eng-program
  ```scheme
  (with-spacing 10 (in-formation 'row '(a b)))
(in-formation 'row '(c d))  ;; this second call uses the default spacing, not 10
(display 'scope-ended)
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```
- **row-5-emergence** :composition
  ```scheme
  (with-spacing 20 (in-formation 'row (entity/all)))
  ```
  Error:
  ```
  error: unbound symbol: in-formation

  ```

### `ai/bt-action` — file `02-ai.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define registry (list (cons 'attack (lambda (npc) (list 'strike npc)))
                       (cons 'flee   (lambda (npc) (list 'run   npc)))))
(define (resolve-leaf leaf reg)
  (let* ((tag (cadr leaf)) (h (assv tag reg)))
    (if h ((cdr h) 'npc-7) (list 'no-handler tag))))
(display (resolve-leaf 
  ```
  Error:
  ```
  error: not a function: [object Object]

  ```

### `ai/bt-invert` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (define (invert cmd) (list 'shell '! cmd))
(display (invert 'ping-succeeds)))
  ```
  Error:
  ```
  error: unexpected ) (line 2, col 34)

  ```

### `ai/bt-selector` — file `02-ai.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (chain-of-responsibility handlers msg)
  (let loop ((rest handlers))
    (cond ((null? rest) 'unhandled)
          (((car rest) msg) => (lambda (r) r))
          (else (loop (cdr rest))))))
(display (chain-of-responsibility
            (list (lambda (m) (if (eq? m 'critical) 'panic-heal #f))
  ```
  Error:
  ```
  error: unbound symbol: =>

  ```

### `ai/decide` — file `02-ai.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (scored-dispatch choices npc-id)
  (let ((scored (map (lambda (c) (cons (car c) ((cdr c) npc-id))) choices)))
    (display (list 'scores scored))
    (newline)
    (car (fold (lambda (p acc) (if (> (cdr p) (cdr acc)) p acc)) (car scored) (cdr scored)))))
(define (fold f init xs) (if (null? x
  ```
  Error:
  ```
  error: not a function: [object Object]

  ```

### `ai/flock` — file `02-ai.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (fly-all birds)
  (for-each (lambda (b) (ai/flock b 'bird 80 4.0)) birds))
(fly-all (list 'b1 'b2 'b3))
  ```
  Error:
  ```
  error: posns is not iterable

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (mixed-behavior birds threat)
  (for-each
    (lambda (b)
      (ai/flock b 'flock 80 4.0)
      (ai/evade b threat 2.0))
    birds))
(mixed-behavior (list 'b1 'b2) 'hawk)
  ```
  Error:
  ```
  error: posns is not iterable

  ```

### `ai/flow-field` — file `02-ai.slat`

- **row-2-audit** :program
  ```scheme
  (define field (ai/flow-field grid 50 50))
(display 'field-computed)
  ```
  Error:
  ```
  error: unbound symbol: grid

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define field (ai/flow-field grid 50 50))
(display 'field-computed)
  ```
  Error:
  ```
  error: unbound symbol: grid

  ```

### `ai/follow-path` — file `02-ai.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (patrol-then-idle guard route idle-after)
  (ai/follow-path guard route 2.0 4.0)
  (if (path-complete? guard route)
    (ai/wander guard 1.0)))
(patrol-then-idle 'g '((0 0) (10 10)) 100)
  ```
  Error:
  ```
  error: unbound symbol: path-complete?

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (patrol-then-idle guard route idle-after)
  (ai/follow-path guard route 2.0 4.0)
  (if (path-complete? guard route)
    (ai/wander guard 1.0)))
(patrol-then-idle 'g '((0 0) (10 10)) 100)
  ```
  Error:
  ```
  error: unbound symbol: path-complete?

  ```

### `ai/path` — file `02-ai.slat`

- **row-2-audit** :program
  ```scheme
  (define route (ai/path grid 0 0 20 20))
(display route)
  ```
  Error:
  ```
  error: unbound symbol: grid

  ```

### `ai/pursue` — file `02-ai.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (pursue-force self self-pos target-pos target-vel max-force)
  (let* ((la (predict-look-ahead 50 20))
         (fp (lead-position target-pos target-vel la))
         (dx (- (car fp) (car self-pos))) (dy (- (cadr fp) (cadr self-pos)))
         (m (sqrt (+ (* dx dx) (* dy dy)))))
    (if (< m 
  ```
  Error:
  ```
  error: unbound symbol: lead-position

  ```

### `ai/wall!` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (define (drop rule) (list 'iptables 'add 'drop rule))
(display (drop 'from-hostile-ip)))
  ```
  Error:
  ```
  error: unexpected ) (line 2, col 34)

  ```
- **row-3-dimension** :code
  ```scheme
  (define (add-constraint lp c) (list 'lp lp 'plus c))
(display (add-constraint 'model 'x-plus-y<=5)))
  ```
  Error:
  ```
  error: unexpected ) (line 2, col 47)

  ```

### `ai/wander` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (define (build-lock crates) (list 'cargo 'build 'with 'cargo.lock))
(display (build-lock 'my-app)))
  ```
  Error:
  ```
  error: unexpected ) (line 2, col 31)

  ```

### `ai/waypoints` — file `02-ai.slat`

- **row-2-audit** :program
  ```scheme
  (define waypoints (ai/waypoints grid path))
(ai/follow-path 'unit waypoints 2.0 4.0)
  ```
  Error:
  ```
  error: unbound symbol: grid

  ```

### `alg/cosets` — file `03-alg.slat`

- **row-2-audit** :program
  ```scheme
  (define G (alg/dihedral 4))
(define H (alg/subgroup-gen G (list 1)))
(define L (alg/cosets G H))
(define R (map (lambda (c) (map (lambda (h) (alg/op G h (car c))) H)) L))
(equal? (map (lambda (c) (list->set c)) L)
        (map (lambda (c) (list->set c)) R))
  ```
  Error:
  ```
  error: unbound symbol: list->set

  ```

### `alg/inverse` — file `03-alg.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define G (alg/dihedral 3))
(define (self-inverse? x) (equal? x (alg/inverse G x)))
(filter self-inverse? (alg/op G))
  ```
  Error:
  ```
  error: Cannot use 'in' operator to search for 'name' in rot

  ```

### `alg/invert` — file `03-alg.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define S (alg/pcset (list 0 3 6 9)))
(define orbit (list S (alg/invert S) (alg/transpose S 1) (alg/invert (alg/transpose S 1))))
(length (dedupe orbit))
  ```
  Error:
  ```
  error: unbound symbol: dedupe

  ```

### `alg/is-group?` — file `03-alg.slat`

- **row-4-proof** :math-program
  ```scheme
  (define (latin-square? t)
  (every (lambda (row) (= (length row) (length (dedupe row)))) t))
(define G (alg/cyclic 4))
(and (alg/is-group? G) (latin-square? G))
  ```
  Error:
  ```
  error: unbound symbol: dedupe

  ```

### `alg/is-isomorphic?` — file `03-alg.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (dedupe-up-to-iso gs)
  (iso-classes gs))
(define (order-signature gs)
  (map alg/order (dedupe-up-to-iso gs)))
(order-signature (list (alg/cyclic 6) (alg/dihedral 3) (alg/symmetric 3)))
  ```
  Error:
  ```
  error: unbound symbol: iso-classes

  ```

### `alg/perm->cycles` — file `03-alg.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (disjoint? cs)
  (let ((flat (apply append cs)))
    (= (length flat) (length (remove-duplicates flat)))))
(disjoint? (alg/perm->cycles (alg/perm (list 1 2 0 4 3))))
  ```
  Error:
  ```
  error: unbound symbol: remove-duplicates

  ```

### `alg/perm-conjugate` — file `03-alg.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define s (alg/perm (list 1 2 0 3)))
(define reps (list (alg/perm-identity 4) (alg/perm (list 1 0 2 3)) (alg/perm (list 0 1 3 2))))
(remove-duplicates (map (lambda (x) (alg/perm-conjugate x s)) reps))
  ```
  Error:
  ```
  error: unbound symbol: remove-duplicates

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (conj-class s reps) (remove-duplicates (map (lambda (x) (alg/perm-conjugate x s)) reps)))
(length (conj-class (alg/perm (list 1 2 0)) (list (alg/perm-identity 3) (alg/perm (list 1 0 2)))))
  ```
  Error:
  ```
  error: unbound symbol: remove-duplicates

  ```

### `alg/symmetric` — file `03-alg.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define S3 (alg/symmetric 3))
(define g (alg/perm (list 1 2 0)))
(let loop ((k 1) (p g))
  (if (equal? p (alg/identity S3)) k (loop (+ k 1) (alg/op S3 p g))))
  ```
  Error:
  ```
  error: fuel exhausted

  ```

### `animation/budget` — file `04-animation.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (safe-budget) (let ((b (animation/budget))) (if (list? b) b (error 'no-budget))))
(safe-budget)
  ```
  Error:
  ```
  error: no-budget

  ```

### `artifact/list` — file `05-artifact.slat`

- **row-2-audit** :eng-program
  ```scheme
  (artifact/list (list (cons 'kind 'sketch)))
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (list-by-kind k) (artifact/list (list (cons 'kind k))))
(list-by-kind 'note)
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (safe-list opts) (if (list? opts) (artifact/list opts) (error 'need-alist)))
(safe-list (list (cons 'kind 'sketch)))
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-3-dimension** :code
  ```scheme
  (artifact/list options)
  ```
  Error:
  ```
  error: unbound symbol: options

  ```
- **row-3-dimension** :code
  ```scheme
  (artifact/list (predicate-options))
  ```
  Error:
  ```
  error: unbound symbol: predicate-options

  ```
- **row-3-dimension** :code
  ```scheme
  (artifact/list (parse-query msg))
  ```
  Error:
  ```
  error: unbound symbol: parse-query

  ```
- **row-4-proof** :eng-program
  ```scheme
  (equal? (car (artifact/list (list (cons 'kind 'sketch)))) 'pending)
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (returns-pending? r) (and (pair? r) (eq? (car r) 'pending)))
(returns-pending? (artifact/list '()))
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (deterministic-kick? opts) (equal? (car (artifact/list opts)) 'pending))
(deterministic-kick? '())
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (list-and-then options continuation) (artifact/list options) (continuation options))
(list-and-then (list (cons 'kind 'sketch)) (lambda (o) 'awaiting))
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (list-multi-kinds ks) (for-each (lambda (k) (artifact/list (list (cons 'kind k)))) ks))
(list-multi-kinds (list 'sketch 'note))
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (paginated-list options page-size) (artifact/list (cons (cons 'limit page-size) options)))
(paginated-list (list (cons 'kind 'note)) 10)
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```

### `assert/audit-verify` — file `06-assert.slat`

- **row-2-audit** :math-program
  ```scheme
  (assert/audit-verify v (canonical-spec spec))
  ```
  Error:
  ```
  error: unbound symbol: v

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (spec-pipeline v specs) (fold (lambda (v s) (assert/audit-verify v s) v) v specs))
(spec-pipeline 42 (list 'number))
  ```
  Error:
  ```
  error: assert/audit-verify: 1 mismatch(es) ,unknown-spec,integer

  ```

### `assert/check-with` — file `06-assert.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (dose-check d) (assert/check-with (lambda (x) (< x 100)) d "dose too high"))
(dose-check 42)
  ```
  Error:
  ```
  error: assert/check-with: pred must be a procedure [object Object]

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (identity-witness v) (equal? v (assert/check-with (lambda (x) #t) v "always")))
(identity-witness 42)
  ```
  Error:
  ```
  error: assert/check-with: pred must be a procedure [object Object]

  ```
- **row-3-dimension** :code
  ```scheme
  (assert/check-with positive? v "pos")
  ```
  Error:
  ```
  error: unbound symbol: v

  ```
- **row-3-dimension** :code
  ```scheme
  (assert/check-with (in-set? domain) x "in-domain")
  ```
  Error:
  ```
  error: unbound symbol: in-set?

  ```
- **row-3-dimension** :code
  ```scheme
  (assert/check-with is-json? msg "json?")
  ```
  Error:
  ```
  error: unbound symbol: is-json?

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (roundtrip? v) (equal? v (assert/check-with (lambda (x) #t) v "tt")))
(roundtrip? 42)
  ```
  Error:
  ```
  error: assert/check-with: pred must be a procedure [object Object]

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (identity-on-pass? v) (eq? v (assert/check-with (lambda (x) #t) v "tt")))
(identity-on-pass? 'x)
  ```
  Error:
  ```
  error: assert/check-with: pred must be a procedure [object Object]

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (all-hold preds v) (fold (lambda (v p) (assert/check-with p v "g")) v preds))
(all-hold (list number? positive?) 5)
  ```
  Error:
  ```
  [verbRegistry] env.define('v') missing explicit perm — falling back to defaultMetaFor inference. Declare perm per CARD-MANIFEST-CONTRACT.md §3.2.
error: assert/check-with: pred must be a procedure 5

  ```

### `assert/invariants` — file `06-assert.slat`

- **row-2-audit** :eng-program
  ```scheme
  (assert/invariants (list (list (lambda () (positive? 5)) "pos") (list (lambda () (< 5 100)) "bound")))
  ```
  Error:
  ```
  error: assert/invariants: 2 failure(s) pos,not a procedure: [object Object] bound,not a procedure: [object Object]

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (batch-check ps) (assert/invariants (map (lambda (p) (list p "chk")) ps)))
(batch-check (list (lambda () #t) (lambda () #t)))
  ```
  Error:
  ```
  error: assert/invariants: 2 failure(s) chk,not a procedure: [object Object] chk,not a procedure: [object Object]

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (safe-invariants ps) (if (list? ps) (assert/invariants ps) (error 'need-list)))
(safe-invariants (list (list (lambda () #t) "x")))
  ```
  Error:
  ```
  error: assert/invariants: 1 failure(s) x,not a procedure: [object Object]

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (all-hold? ps) (assert/invariants (map (lambda (p) (list p "h")) ps)))
(all-hold? (list (lambda () #t) (lambda () #t)))
  ```
  Error:
  ```
  error: assert/invariants: 2 failure(s) h,not a procedure: [object Object] h,not a procedure: [object Object]

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (checked-scale c v) (assert/invariants (list (list (lambda () (positive? c)) "pos-c") (list (lambda () (vector? v)) "vec-v"))) (* c (vector-ref v 0)))
(checked-scale 2 (vector 3 4))
  ```
  Error:
  ```
  error: assert/invariants: 2 failure(s) pos-c,not a procedure: [object Object] vec-v,not a procedure: [object Object]

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (compose-preds ps) (assert/invariants (map (lambda (p) (list p "chk")) ps)))
(compose-preds (list (lambda () #t) (lambda () #t)))
  ```
  Error:
  ```
  error: assert/invariants: 2 failure(s) chk,not a procedure: [object Object] chk,not a procedure: [object Object]

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (schema-guard v checks) (assert/invariants checks) v)
(schema-guard 42 (list (list (lambda () #t) "ok")))
  ```
  Error:
  ```
  error: assert/invariants: 1 failure(s) ok,not a procedure: [object Object]

  ```

### `audio/bar-clock` — file `07-audio.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (multi-disc handle bar-counts)
  (map (lambda (b) (cons b (audio/bar-clock handle b))) bar-counts))
(define discs (multi-disc (audio/play 'stereo-loop) '(1 2 4 8)))
(map (lambda (pair) (list :bars (car pair) :phase ((cdr pair) 'phase))) discs)
  ```
  Error:
  ```
  [verbRegistry] env.define('handle') missing explicit perm — falling back to defaultMetaFor inference. Declare perm per CARD-MANIFEST-CONTRACT.md §3.2.
error: not a function: (msg) => {
    const m = msg instanceof Sym ? msg.name : String(msg)
    const beatPeriod = 60 / (A.tempo || 120)
    const t 
  ```

### `base/make-character` — file `08-base.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (register-character visual) (if (sprite? visual) (base/make-character visual) (error 'shape 'need-sprite)))
(register-character (sprite/address 'hero))
  ```
  Error:
  ```
  error: unbound symbol: sprite?

  ```
- **row-4-proof** :math-program
  ```scheme
  (define (deterministic-shape? s) (equal? (character-shape (base/make-character s)) s))
(deterministic-shape? (sprite/address 'hero))
  ```
  Error:
  ```
  error: unbound symbol: character-shape

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (id-typed? v) (character-id? (base/make-character (sprite/address v))))
(id-typed? 'hero)
  ```
  Error:
  ```
  error: unbound symbol: character-id?

  ```

### `bytevector-append` — file `10-bytevector.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (append-chain-cost xs)
  (let ((total-len (apply + (map bytevector-length xs))))
    (list 'segments (length xs) 'bytes-copied total-len 'cost 'O(total-len))))
(display (append-chain-cost (list (bytevector 1 2) (bytevector 3 4 5) (bytevector 6))))
(newline)
  ```
  Error:
  ```
  error: not a function: 6

  ```

### `string->utf8` — file `10-bytevector.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (percent-encode s)
  (let loop ((bs (bytevector->list (string->utf8 s))) (acc '()))
    (if (null? bs)
      (list->string (reverse acc))
      (let ((b (car bs)))
        (if (or (and (>= b 65) (<= b 90)) (and (>= b 97) (<= b 122)) (and (>= b 48) (<= b 57)))
          (loop (cdr bs) (cons (
  ```
  Error:
  ```
  error: unbound symbol: bytevector->list

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (byte-boundary-first-byte-classify b)
  (cond ((< b 128) 'ascii-1byte)
        ((< b 192) 'continuation)
        ((< b 224) 'lead-2byte)
        ((< b 240) 'lead-3byte)
        (else 'lead-4byte)))
(display (map byte-boundary-first-byte-classify (bytevector->list (string->utf8 "aé中😀"))))
(ne
  ```
  Error:
  ```
  error: unbound symbol: bytevector->list

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (utf8-hash s)
  (let ((bs (bytevector->list (string->utf8 s))))
    (fold (lambda (b h) (modulo (+ (* h 31) b) 2147483647)) 0 bs)))
(display (list (utf8-hash "hello") (utf8-hash "world") (utf8-hash "hello")))
(newline)
  ```
  Error:
  ```
  error: unbound symbol: bytevector->list

  ```

### `calc/arc-length` — file `11-calc.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (arc-length-finite-diff f a b n)
  ;; Approximate arc length by summing chord segments
  (let ((h (/ (- b a) n)))
    (let loop ((i 0) (acc 0))
      (if (= i n) acc
        (let ((x0 (+ a (* i h))) (x1 (+ a (* (+ i 1) h))))
          (loop (+ i 1)
                (+ acc (sqrt (+ (* h h) (ex
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```

### `calc/arc-length-param` — file `11-calc.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (sample-arc-length fx fy t0 t1 n)
  ;; Chord-sum approximation using n samples
  (let ((dt (/ (- t1 t0) n)))
    (let loop ((i 0) (acc 0))
      (if (= i n) acc
        (let ((t (+ t0 (* i dt))) (tn (+ t0 (* (+ i 1) dt))))
          (let ((dx (- (fx tn) (fx t))) (dy (- (fy tn) (fy t))))
    
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```

### `calc/critical-points-1d` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  {x : f\'(x) = 0}
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 8)

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define f (lambda (x) (- (* x x x) (* 3 x))))
(define df (calc/derivative f))
(define cps (calc/critical-points-1d f -3 3))
(map (lambda (c) (< (abs (df c)) 0.02)) cps)
;; => (#t #t) — both critical points have f' ≈ 0
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (x) (- (* x x x) (* 3 x))))
(define df (calc/derivative f))
(define cps (calc/critical-points-1d f -3 3))
(let loop ((cs cps))
  (or (null? cs) (and (< (abs (df (car cs))) 0.01) (loop (cdr cs)))))
;; => #t — Fermat's theorem: all critical points have df=0
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (all-zeros? f cps tol)
  (let loop ((cs cps))
    (or (null? cs)
        (and (< (abs ((calc/derivative f) (car cs))) tol)
             (loop (cdr cs))))))
(all-zeros? (lambda (x) (* x x)) (calc/critical-points-1d (lambda (x) (* x x)) -2 2) 0.01)
;; => #t — x² has critical point at 0; df(0) 
  ```
  Error:
  ```
  error: not a function: NaN

  ```

### `calc/derivative` — file `11-calc.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define position (lambda (t) (+ (* 3 t t) (* -2 t) 1)))
(define velocity (calc/derivative position))
(velocity 2)
;; position s(t) = 3t²-2t+1; velocity = ds/dt = 6t-2; at t=2: 6·2-2 = 10
;; => ≈ 10.0
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-2-audit** :math-program
  ```scheme
  (define f (lambda (x) (* x x)))
(define df (calc/derivative f))
(df 3)
;; d/dx(x²) = 2x; at x=3: 2·3 = 6
;; => ≈ 6.0
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define f (lambda (x) (* x x)))
(define g (lambda (x) x))
(define combined (calc/derivative (lambda (x) (+ (* 3 (f x)) (* 2 (g x))))))
(define by-linearity (+ (* 3 ((calc/derivative f) 1)) (* 2 ((calc/derivative g) 1))))
(< (abs (- (combined 1) by-linearity)) 0.01)
;; 3·(2x) + 2·(1) at x=1 = 8; line
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (x) (* x x)))
(define g (lambda (x) x))
(define df (calc/derivative f))
(define dg (calc/derivative g))
(define combined (calc/derivative (lambda (x) (+ (* 3 (f x)) (* 2 (g x))))))
(< (abs (- (combined 1.0) (+ (* 3 (df 1.0)) (* 2 (dg 1.0))))) 0.01)
;; => #t — 3f'+2g' = 3·2+2·1 = 8
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (linearity-test? f g a b x)
  (let ((dh (calc/derivative (lambda (t) (+ (* a (f t)) (* b (g t))))))
        (df (calc/derivative f))
        (dg (calc/derivative g)))
    (< (abs (- (dh x) (+ (* a (df x)) (* b (dg x))))) 0.02)))
(linearity-test? (lambda (x) (* x x)) (lambda (x) x) 3 2 1)
;; 
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define accel (lambda (t) (+ (* 4 t) 3)))
(define vel   (lambda (t) (+ (* 2 t t) (* 3 t))))
;; Verify: dvel/dt should equal accel
(map (lambda (t) (< (abs (- ((calc/derivative vel) t) (accel t))) 0.05))
     '(0 1 2 3))
;; => (#t #t #t #t) — kinematics check
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (x) (sin x)))
(define df  (calc/derivative f))
(define ddf (calc/derivative df))
(list (df 0) (ddf 0))
;; => (≈1.0 ≈0.0) — sin'(0)=cos(0)=1; sin''(0)=-sin(0)=0
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (nth-derivative f n x)
  (if (= n 0) (f x)
    (let ((df (calc/derivative f)))
      (nth-derivative df (- n 1) x))))
(map (lambda (n) (nth-derivative (lambda (x) (expt x 4)) n 1))
     '(0 1 2 3 4))
;; => (1 4 12 24 0) — powers of x^4 at x=1
  ```
  Error:
  ```
  error: not a function: NaN

  ```

### `calc/extrema-1d` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  attained at boundary or where f\' = 0
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 33)

  ```

### `calc/integral` — file `11-calc.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define F (lambda (x) (* x x x)))
(define f (calc/derivative F))
(< (abs (- (calc/integral f 0 2) (- (F 2) (F 0)))) 0.05)
  ```
  Error:
  ```
  error: not a function: NaN

  ```

### `calc/newton` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  x_{n+1} = x_n - f(x_n)/f\'(x_n)
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 26)

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (x) (- (* x x x) x 2)))
(define r (calc/newton f 1.5))
(define fp (calc/derivative f))
(< (abs (- r (- r (/ (f r) (fp r))))) 0.001)
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (x) (+ (* x x x x) (- (* 2 x x)) 1)))
(define fp (calc/derivative f))
(define crit (calc/newton fp 1.5))
(list 'critical-x crit 'f-there (f crit))
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define f (lambda (x) (- (* x x) (* 4 x))))
(define fp (calc/derivative f))
(define crit (calc/newton fp 0))
(if (> (calc/second-derivative f crit) 0) 'minimum 'maximum)
  ```
  Error:
  ```
  error: not a function: NaN

  ```

### `calc/second-derivative` — file `11-calc.slat`

- **row-2-audit** :program
  ```scheme
  (define f (lambda (x) (* x x x)))
(define ddf (calc/second-derivative f))
(ddf 1)
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-4-proof** :program
  ```scheme
  (define f (lambda (x) (* x x)))
(define ddf (calc/second-derivative f))
(> (ddf 0) 0)
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-4-proof** :math-program
  ```scheme
  (define f (lambda (x) (* x x x)))
(define fp (calc/derivative f))
(< (abs (- (calc/second-derivative f 2) (calc/derivative fp 2))) 0.2)
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-5-emergence** :composition
  ```scheme
  (define f (lambda (x) (sin x)))
(define ddf (calc/second-derivative f))
(map ddf (list 0 (/ 3.14159 2) 3.14159))
  ```
  Error:
  ```
  error: not a function: NaN

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define f (lambda (x) (+ (* x x x x) (- (* 2 x x)))))
(define crit (calc/newton (calc/derivative f) 1.5))
(if (> (calc/second-derivative f crit) 0) 'minimum 'maximum)
  ```
  Error:
  ```
  error: not a function: NaN

  ```

### `calc/series-converges?` — file `11-calc.slat`

- **row-2-audit** :math-program
  ```scheme
  (eq? (calc/series-converges? (lambda (n) (/ (factorial n) (expt 2 n)))) 'diverges)
  ```
  Error:
  ```
  error: unbound symbol: factorial

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define coeffs (list 1 1 0.5 (/ 1.0 6) (/ 1.0 24)))
(define term (lambda (n) (/ 1.0 (factorial n))))
(list 'per-series (calc/series-converges? term) 'radius (car (calc/radius-of-convergence coeffs)))
  ```
  Error:
  ```
  error: unbound symbol: factorial

  ```

### `calc/tangent-line` — file `11-calc.slat`

- **row-2-audit** :program
  ```scheme
  (define f (lambda (x) (* x x)))
(define tan (calc/tangent-line f 1))
(list (tan 1) (tan 2))
  ```
  Error:
  ```
  error: not a function: 2.000000000002,-1.0000000000020002

  ```
- **row-3-dimension** :code
  ```scheme
  y = f\'(a)(x-a) + f(a)
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 7)

  ```
- **row-4-proof** :program
  ```scheme
  (define f (lambda (x) (* x x x)))
(define a 1)
(define tan (calc/tangent-line f a))
(and (< (abs (- (tan a) (f a))) 0.001)
     (< (abs (- ((calc/derivative tan) a) ((calc/derivative f) a))) 0.05))
  ```
  Error:
  ```
  error: not a function: 2.9999999999752447,-1.9999999999752447

  ```
- **row-5-emergence** :composition
  ```scheme
  (define f (lambda (x) (* x x)))
(map (lambda (a) ((calc/tangent-line f a) (+ a 0.1)))
     (list 0 1 2))
  ```
  Error:
  ```
  error: not a function: 0,0

  ```

### `calc/taylor` — file `11-calc.slat`

- **row-4-proof** :program
  ```scheme
  (define f (lambda (x) (sin x)))
(define T (calc/taylor f 0 5))
(< (abs (- (T 0.1) (f 0.1))) 0.001)
  ```
  Error:
  ```
  error: not a function: 0,0.9999999999998334,0,-0.16666658333071757,0,0.008333033337433923

  ```
- **row-5-emergence** :composition
  ```scheme
  (define f (lambda (x) (exp x)))
(map (lambda (n) ((calc/taylor f 0 n) 0.5)) (list 1 2 3 5 10))
  ```
  Error:
  ```
  error: not a function: 1,0.9999999999732445

  ```

### `char-alphabetic?` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (accept? c) (char-alphabetic? c))
(filter accept? (map string (string->list "A1b!C")))
  ```
  Error:
  ```
  error: not a character #\A

  ```
- **row-4-proof** :program
  ```scheme
  (define (disjoint? c) (not (and (char-alphabetic? c) (char-numeric? c))))
(and (disjoint? "a") (disjoint? "5") (disjoint? " ") (disjoint? "Z"))
  ```
  Error:
  ```
  error: not a character a

  ```

### `char-downcase` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (norm-key s) (apply string-append (map char-downcase (map string (string->list s)))))
(let ((cache (make-hash-table))) (hash-table-set! cache (norm-key "Hello") 42) (hash-table-ref/default cache (norm-key "HELLO")))
  ```
  Error:
  ```
  error: not a character #\H

  ```
- **row-4-proof** :program
  ```scheme
  (define (idem? c) (string=? (char-downcase (char-downcase c)) (char-downcase c)))
(define (result-lower? c) (let ((d (char-downcase c))) (or (not (char-alphabetic? d)) (char-lower-case? d))))
(and (idem? "A") (idem? "a") (result-lower? "Z") (result-lower? "5"))
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (ci-equal? s1 s2) (let ((n1 (map char-downcase (map string (string->list s1)))) (n2 (map char-downcase (map string (string->list s2))))) (equal? n1 n2)))
(ci-equal? "Hello" "HELLO")
  ```
  Error:
  ```
  error: not a character #\H

  ```

### `char-foldcase` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (fold-str s) (apply string-append (map char-foldcase (map string (string->list s)))))
(equal? (fold-str "Rest") (fold-str "REST"))
  ```
  Error:
  ```
  error: not a character #\R

  ```
- **row-4-proof** :program
  ```scheme
  (define (idem? c) (string=? (char-foldcase (char-foldcase c)) (char-foldcase c)))
(define (unify? a b) (string=? (char-foldcase a) (char-foldcase b)))
(and (idem? "A") (unify? "A" "a") (unify? "Z" "z") (not (unify? "a" "b")))
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (dedup-case-insensitive strs) (let loop ((rest strs) (seen '()) (acc '())) (cond ((null? rest) (reverse acc)) ((let ((k (apply string-append (map char-foldcase (map string (string->list (car rest))))))) (if (member k seen) #t #f)) (loop (cdr rest) seen acc)) (else (let ((k (apply string-appe
  ```
  Error:
  ```
  error: not a character #\R

  ```

### `char-lower-case?` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (canonical-tag? s) (let loop ((chars (map string (string->list s)))) (or (null? chars) (and (or (char-lower-case? (car chars)) (char-numeric? (car chars)) (char=? (car chars) "-")) (loop (cdr chars))))))
(canonical-tag? "scheme-book")
  ```
  Error:
  ```
  error: not a character #\s

  ```
- **row-4-proof** :program
  ```scheme
  (define (test c) (eq? (char-lower-case? c) (and (char-alphabetic? c) (string=? c (char-downcase c)))))
(and (test "a") (test "A") (test "5") (test " "))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (screaming? s) (let ((letters (filter char-alphabetic? (map string (string->list s))))) (and (> (length letters) 3) (not (any (lambda (c) (char-lower-case? c)) letters)))))
(define (any p xs) (cond ((null? xs) #f) ((p (car xs)) #t) (else (any p (cdr xs)))))
(screaming? "HELLO WORLD")
  ```
  Error:
  ```
  error: not a character #\H

  ```

### `char-numeric?` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (digits-only s) (filter char-numeric? (map string (string->list s))))
(digits-only "score: 4287 pts")
  ```
  Error:
  ```
  error: not a character #\s

  ```
- **row-4-proof** :program
  ```scheme
  (define (test) (and (map char-numeric? (map string (string->list "0123456789"))) (not (char-numeric? "a")) (not (char-numeric? " "))))
(equal? (map char-numeric? (list "0" "5" "9" "a" " ")) (list #t #t #t #f #f))
  ```
  Error:
  ```
  error: not a character 0

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (parse-nat s) (let loop ((chars (map string (string->list s))) (acc 0)) (cond ((null? chars) acc) ((char-numeric? (car chars)) (loop (cdr chars) (+ (* 10 acc) (digit-value (car chars))))) (else #f))))
(parse-nat "4287")
  ```
  Error:
  ```
  error: not a character #\4

  ```

### `char-upcase` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (bold-first s) (if (= (string-length s) 0) s (string-append (char-upcase (substring s 0 1)) (substring s 1 (string-length s)))))
(bold-first "start")
  ```
  Error:
  ```
  error: not a character s

  ```
- **row-4-proof** :program
  ```scheme
  (define (idem? c) (string=? (char-upcase (char-upcase c)) (char-upcase c)))
(and (idem? "a") (idem? "A") (idem? "5") (idem? " "))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (shout s) (apply string-append (map char-upcase (map string (string->list s)))))
(shout "help")
  ```
  Error:
  ```
  error: not a character #\h

  ```

### `char-upper-case?` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (starts-upper? s) (and (> (string-length s) 0) (char-upper-case? (substring s 0 1))))
(starts-upper? "Alfred")
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-4-proof** :program
  ```scheme
  (define (test c) (let ((u (char-upper-case? c)) (l (char-lower-case? c)) (a (char-alphabetic? c))) (and (not (and u l)) (if a (or u l) (not (or u l))))))
(and (test "A") (test "a") (test "5") (test " "))
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (title-case? s) (let ((chars (map string (string->list s)))) (and (not (null? chars)) (char-upper-case? (car chars)) (let loop ((rest (cdr chars))) (or (null? rest) (and (char-lower-case? (car rest)) (loop (cdr rest))))))))
(title-case? "Motoi")
  ```
  Error:
  ```
  error: not a character #\M

  ```

### `char-whitespace?` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (ltrim s) (let loop ((chars (map string (string->list s)))) (if (or (null? chars) (not (char-whitespace? (car chars)))) (apply string-append chars) (loop (cdr chars)))))
(ltrim "   hello")
  ```
  Error:
  ```
  error: not a character #\ 

  ```
- **row-4-proof** :program
  ```scheme
  (define whites (list " " "\t" "\
"))
(define non-whites (list "a" "5" "!" "Z"))
(and (equal? (map char-whitespace? whites) (list #t #t #t)) (equal? (map char-whitespace? non-whites) (list #f #f #f #f)))
  ```
  Error:
  ```
  error: not a character  

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (split-words s) (let loop ((chars (map string (string->list s))) (cur "") (acc '())) (cond ((null? chars) (reverse (if (string=? cur "") acc (cons cur acc)))) ((char-whitespace? (car chars)) (loop (cdr chars) "" (if (string=? cur "") acc (cons cur acc)))) (else (loop (cdr chars) (string-appe
  ```
  Error:
  ```
  error: not a character #\h

  ```

### `char<?` — file `12-char.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (sort-chars s) (list->string (let loop ((rest (string->list s))) (if (null? rest) '() (let* ((pivot (car rest)) (smaller (filter (lambda (c) (char<? c pivot)) (cdr rest))) (larger (filter (lambda (c) (not (char<? c pivot))) (cdr rest)))) (append (loop smaller) (list pivot) (loop larger))))))
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```

### `char=?` — file `12-char.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (delim? c) (char=? c "|"))
(display (filter delim? (map string (string->list "a|b|c"))))
(newline)
  ```
  Error:
  ```
  error: not a character #\a

  ```

### `char>=?` — file `12-char.slat`

- **row-3-dimension** :code
  ```scheme
  (char>=? c "A")
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-4-proof** :program
  ```scheme
  (define (test a b) (and (char>=? a a) (eq? (char>=? a b) (char<=? b a))))
(and (test "a" "a") (test "a" "b") (test "z" "a"))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (any-upper? s) (let loop ((chars (map string (string->list s)))) (cond ((null? chars) #f) ((and (char>=? (car chars) "A") (char<=? (car chars) "Z")) #t) (else (loop (cdr chars))))))
(any-upper? "heLLo")
  ```
  Error:
  ```
  error: not a character #\h

  ```

### `collision/define-layers!` — file `14-collision.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (unique-bits? layers) (let ((bits (map layer-bit-index layers))) (equal? bits (remove-duplicates bits))))
(collision/define-layers! (list 'p 'q 'r))
(unique-bits? (list 'p 'q 'r))
  ```
  Error:
  ```
  error: unbound symbol: remove-duplicates

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (init-from-config config) (collision/define-layers! (assoc-ref :layers config)) (for-each (lambda (mask) (entity/mask! (car mask) (cdr mask))) (assoc-ref :masks config)))
(init-from-config (list (cons :layers (list 'p 'e)) (cons :masks (list (cons 'p (list 'e))))))
  ```
  Error:
  ```
  error: unbound symbol: assoc-ref

  ```

### `symbol=?` — file `16-compare.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (router table) (lambda (tag) (dispatch tag table)))
((router (list (list 'ping (lambda () 'pong)))) 'ping)
  ```
  Error:
  ```
  error: unbound symbol: dispatch

  ```

### `const/ln10` — file `18-const.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (order-of-magnitude n) (inexact->exact (floor (/ (log n) const/ln10))))
(= (order-of-magnitude 42) 1)
  ```
  Error:
  ```
  error: The number NaN cannot be converted to a BigInt because it is not an integer

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (bucket-by-oom xs) (let loop ((xs xs) (bs '())) (if (null? xs) bs (let ((k (inexact->exact (floor (/ (log (car xs)) const/ln10))))) (loop (cdr xs) (cons k bs))))))
(bucket-by-oom (list 5 50 5000 500000))
  ```
  Error:
  ```
  error: The number NaN cannot be converted to a BigInt because it is not an integer

  ```

### `const/ln2` — file `18-const.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (bits-for n) (inexact->exact (ceiling (/ (log n) const/ln2))))
(= (bits-for 256) 8)
  ```
  Error:
  ```
  error: The number NaN cannot be converted to a BigInt because it is not an integer

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (log2 x) (/ (log x) const/ln2))
(define (bits-needed n)
  (inexact->exact (ceiling (log2 n))))
(display (bits-needed 8)) (newline)
(display (bits-needed 100)) (newline)
(display (bits-needed 1)) (newline)
  ```
  Error:
  ```
  error: The number NaN cannot be converted to a BigInt because it is not an integer

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (binary-tree-depth n) (inexact->exact (ceiling (/ (log n) const/ln2))))
(binary-tree-depth 1024)
  ```
  Error:
  ```
  error: The number NaN cannot be converted to a BigInt because it is not an integer

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (encode-length-prefix count) (let ((bits (inexact->exact (ceiling (/ (log (max 1 count)) const/ln2))))) (list 'prefix-bits bits 'byte-cost (quotient (+ bits 7) 8))))
(encode-length-prefix 1000000)
  ```
  Error:
  ```
  error: The number NaN cannot be converted to a BigInt because it is not an integer

  ```

### `const/pi` — file `18-const.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (leibniz-pi terms)
  (let loop ((k 0) (s 0.0))
    (if (= k terms) (* 4 s) (loop (+ k 1) (+ s (/ (expt -1 k) (+ (* 2 k) 1)))))))
(< (abs (- (leibniz-pi 100000) const/pi)) 1e-4)
  ```
  Error:
  ```
  error: fuel exhausted

  ```

### `curve/christoffel` — file `20-curve.slat`

- **row-2-audit** :math-program
  ```scheme
  (define plane (curve/surface-graph (lambda (x y) (+ (* 2 x) (* 3 y) 5))))
(define G (curve/christoffel plane))
(define abs-sum (fold + 0 (map abs (flatten G))))
(< abs-sum 0.02)
  ```
  Error:
  ```
  error: unbound symbol: flatten

  ```
- **row-4-proof** :program
  ```scheme
  (define flat (curve/surface-graph (lambda (x y) 0)))
(define G (curve/christoffel flat))
(define (all-near-zero? tensor)
  (< (fold + 0 (map abs (flatten tensor))) 0.001))
(all-near-zero? G)
  ```
  Error:
  ```
  error: unbound symbol: flatten

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define bowl (curve/surface-graph (lambda (x y) (+ (* x x) (* y y)))))
(define G (curve/christoffel bowl))
(define nonzero? (> (fold + 0 (map abs (flatten G))) 0.001))
nonzero?
  ```
  Error:
  ```
  error: unbound symbol: flatten

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define surf (curve/surface-graph (lambda (x y) (- (* x x) (* y y)))))
(define G (curve/christoffel surf))
(define flat-list (flatten G))
(fold (lambda (x ok) (and ok (number? x))) #t flat-list)
  ```
  Error:
  ```
  error: unbound symbol: flatten

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define sphere (curve/surface-graph (lambda (x y) (sqrt (max 0.0001 (- 1 (* x x) (* y y)))))))
(define G (curve/christoffel sphere))
(define trace (fold + 0 (map abs (flatten G))))
(> trace 0.01)
  ```
  Error:
  ```
  error: unbound symbol: flatten

  ```

### `curve/spline-resample` — file `20-curve.slat`

- **row-3-dimension** :code
  ```scheme
  (define (resample sig rate-in rate-out dur)
  (map (lambda (i) (sig (* i (/ rate-in rate-out)))) (iota (* rate-out dur))))
(resample (lambda (t) (sin t)) 44100 22050 1)
  ```
  Error:
  ```
  error: fuel exhausted

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define path (curve/bezier '((0 0) (5 5) (10 0))))
(define uniform-frames (curve/spline-resample path 24))
(define ((for-frame f) i) (f (list-ref uniform-frames i)))
((for-frame (lambda (p) (list 'draw p))) 12)
  ```
  Error:
  ```
  error: unbound symbol: for-frame

  ```

### `domain/of` — file `21-domain.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (route-by-domain kind) (let ((d (assoc :domain (domain/of kind)))) (if (eq? d 'payment) (invoke-payment-handler kind) (default-handler kind))))
(route-by-domain 'inventory-check)
  ```
  Error:
  ```
  error: unbound symbol: default-handler

  ```

### `named-ease` — file `22-easing.slat`

- **row-2-audit** :math-program
  ```scheme
  (honest-null :reason "named-ease is a registry-lookup verb — dispatch table; math view of a finite symbol→function table is trivial rebinding, not proposition-worthy. Book-of-code ch 3 (dispatch tables).")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-4-proof** :math-program
  ```scheme
  (honest-null :reason "Referential transparency of a dispatch-table lookup is a language-level property, not a proposition about the easing curve itself. The math proof lives in bezier-ease/spring-ease where the curve has real structure. Book-of-code ch 3.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```

### `eng/statics-solve` — file `23-eng.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (analyze-truss truss)
  (let* ((eqs (truss->equations truss))
         (unknowns (truss->unknowns truss))
         (result (eng/statics-solve eqs '() unknowns)))
    (cond ((eq? result 'underdetermined)
             (escalate 'add-compatibility-eqs (list truss)))
          (else
            
  ```
  Error:
  ```
  error: unbound symbol: my-truss

  ```

### `eng/tf` — file `23-eng.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (reject-histogram candidates)
  (let ((tally (list (cons 'unstable 0) (cons 'low-gain 0) (cons 'accept 0))))
    (for-each
      (lambda (c)
        (let* ((h (eng/tf (car c) (cadr c))))
          (cond ((not (eng/tf-stable? h))
                 (set-cdr! (assoc 'unstable tally) (+ 1 (cdr (a
  ```
  Error:
  ```
  error: unbound symbol: set-cdr!

  ```

### `eng/tf-stable?` — file `23-eng.slat`

- **row-2-audit** :program
  ```scheme
  (define (safe-to-deploy? tf)
  (and (eng/tf-stable? tf)
       (< (abs (eng/tf-dc-gain tf)) 100)))
(if (safe-to-deploy? candidate-tf)
  (write-firmware candidate-tf)
  (escalate 'unstable-or-runaway-gain candidate-tf))
  ```
  Error:
  ```
  error: unbound symbol: candidate-tf

  ```

### `entity/alive?` — file `24-entity.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define ids (map (lambda (i) (world/spawn 'projectile i 0)) '(0 1 2 3 4)))
(define all-live-before (for-all entity/alive? ids))
(for-each entity/despawn! ids)
(world/step)
(define all-dead-after (for-all (lambda (id) (not (entity/alive? id))) ids))
(and all-live-before all-dead-after)
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```

### `entity/damage!` — file `24-entity.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (splash-damage center ids radius power)
  ;; Apply power to every entity within radius of center.
  (for-each (lambda (id)
    (let* ((p (entity/pos id))
           (dx (- (car p) (car center)))
           (dy (- (cadr p) (cadr center)))
           (dist (sqrt (+ (* dx dx) (* dy dy)))))
    
  ```
  Error:
  ```
  error: unexpected ) (line 11, col 58)

  ```

### `entity/despawn!` — file `24-entity.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (fire-projectile x y dx dy)
  (let ((p (world/spawn 'proj x y)))
    (entity/set-vel! p dx dy)
    (world/after 60 'expire p)))
(fire-projectile 0 0 5 0)
(on-event 'expire (lambda (id) (entity/despawn! id)))
  ```
  Error:
  ```
  error: unbound symbol: on-event

  ```

### `entity/goto!` — file `24-entity.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define npc (world/spawn 'npc 0 0))
(entity/goto! npc 'idle)
(define hist '())
(let loop ((k 5))
  (if (= k 0) 'done
      (begin (entity/goto! npc 'idle)
             (set! hist (cons (entity/state npc) hist))
             (loop (- k 1)))))
(and (= (length hist) 5) (for-all (lambda (s) (eq? s 'idle
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (react e)
  (case (entity/state e)
    ((idle) (entity/sprite! e 'idle))
    ((walking) (entity/sprite! e 'walk))
    ((jumping) (entity/sprite! e 'jump))))
(on-event 'entity/state-change (lambda (id) (react id)))
  ```
  Error:
  ```
  error: unbound symbol: on-event

  ```

### `entity/kind` — file `24-entity.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define proj (world/spawn 'projectile 0 0))
;; kind never throws, even on invalid ids.
(define results (map entity/kind (list proj 999999 'not-an-id)))
(for-all symbol? results)
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define ids (map (lambda (i) (world/spawn 'projectile i 0)) '(0 1 2 3)))
(define kinds (map entity/kind ids))
;; equivalence class under kind: all elements share one class.
(and (= (length (filter (lambda (k) (eq? k 'projectile)) kinds)) 4)
     (for-all (lambda (k) (eq? k (car kinds))) kinds))
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```

### `entity/set!` — file `24-entity.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define npc (world/spawn 'npc 0 0))
(define pairs '((k1 . a) (k2 . b) (k3 . c) (k4 . d)))
(for-each (lambda (p) (entity/set! npc (car p) (cdr p))) pairs)
(for-all (lambda (p) (eq? (entity/ref npc (car p)) (cdr p))) pairs)
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```

### `entity/set-pos!` — file `24-entity.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (respawn id)
  (let ((spawn (entity/ref id 'spawn-point)))
    (entity/set-pos! id (car spawn) (cadr spawn))
    (entity/set-vel! id 0 0)
    (entity/hp! id 100)))
(entity/set! 'hero 'spawn-point '(100 100))
(respawn 'hero)
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '0')

  ```

### `entity/sprite!` — file `24-entity.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define ship (world/spawn 'ship 0 0))
(define frames #('ship-1 'ship-2 'ship-3 'ship-4))
(define (frame-at t) (vector-ref frames (modulo t 4)))
(for-each (lambda (t) (entity/sprite! ship (frame-at t))) '(0 1 2 3 4 5))
  ```
  Error:
  ```
  error: unbound symbol: #

  ```

### `entity/state` — file `24-entity.slat`

- **row-2-audit** :math-program
  ```scheme
  (entity/make 'e 42 7)
(entity/set-vel! 'e 3 4)
;; entity/state is a total projection Entity -> (id,x,y,vx,vy,w,h): a 7-tuple
;; whose numeric components equal the individual axis accessors.
(let ((s (entity/state 'e)))
  (and (= (length s) 7)
       (= (list-ref s 1) 42)
       (= (list-ref s 2) 7)

  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading 'length')

  ```
- **row-4-proof** :program
  ```scheme
  (entity/make 'e 42 7)
(entity/set-vel! 'e 3 4)
(let ((s (entity/state 'e)))
  (display (and (= (list-ref s 1) (entity/x 'e))
                (= (list-ref s 2) (entity/y 'e))
                (= (list-ref s 3) (car (entity/vel 'e))))))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '1')

  ```
- **row-4-proof** :math-program
  ```scheme
  (entity/make 'e 5 9)
(entity/set-vel! 'e 2 -1)
;; the head is the id; the numeric tail is exactly the axis vector
;; (x y vx vy w h), so state = id ⊕ (position ++ velocity ++ size).
(let ((s (entity/state 'e)))
  (and (string? (car s))
       (= 6 (length (cdr s)))
       (for-all number? (cdr s))))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '0')

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (bounding-box ids)
  ;; reduce state snapshots to the axis-aligned box enclosing every entity.
  (fold
    (lambda (id box)
      (let* ((s (entity/state id)) (x (list-ref s 1)) (y (list-ref s 2)))
        (list (min (car box) x) (min (cadr box) y)
              (max (caddr box) x) (max (cad
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '1')

  ```

### `entity/team!` — file `24-entity.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (partition-by-team ids)
  ;; fold entities into equivalence classes keyed by their team label.
  (fold
    (lambda (id acc)
      (let* ((k (entity/ref id 'team))
             (cell (assq k acc)))
        (if cell
            (begin (set-cdr! cell (cons id (cdr cell))) acc)
            (cons
  ```
  Error:
  ```
  error: unbound symbol: set-cdr!

  ```

### `entity/vel` — file `24-entity.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define coin (world/spawn 'coin 0 0))
(define pairs '((3 4) (5 -2) (-1 7) (0 0)))
(for-all (lambda (p)
           (entity/set-vel! coin (car p) (cadr p))
           (equal? (entity/vel coin) p))
         pairs)
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```

### `entity/x` — file `24-entity.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define balls (map (lambda (i) (world/spawn 'ball i (* 2 i))) '(0 10 20 30)))
(for-all (lambda (b) (= (entity/x b) (car (entity/pos b)))) balls)
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define balls (map (lambda (i) (world/spawn 'ball i 0)) '(3 1 4 1 5)))
(define (sorted-by-x ids)
  (list-sort (lambda (a b) (< (entity/x a) (entity/x b))) ids))
(sorted-by-x balls)
  ```
  Error:
  ```
  error: unbound symbol: list-sort

  ```

### `entity/y` — file `24-entity.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define markers (map (lambda (i) (world/spawn 'marker i (* 3 i))) '(0 5 10 15)))
(for-all (lambda (m) (= (entity/y m) (cadr (entity/pos m)))) markers)
  ```
  Error:
  ```
  error: unbound symbol: for-all

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define markers (map (lambda (i) (world/spawn 'marker 0 i)) '(5 1 3 8 2)))
(define (sort-by-y ids)
  (list-sort (lambda (a b) (< (entity/y a) (entity/y b))) ids))
(sort-by-y markers)
  ```
  Error:
  ```
  error: unbound symbol: list-sort

  ```

### `exact/*` — file `25-exact.slat`

- **row-4-proof** :eng-program
  ```scheme
  (define (invariant-holds? xs) (fold (lambda (r x) (and r (rational? x))) #t (map (lambda (p) (exact/* (car p) (cdr p))) xs)))
(invariant-holds? (list (cons (exact/rat 1 2) (exact/rat 2 3))))
  ```
  Error:
  ```
  error: exact: not a rational or integer: object

  ```

### `exact/+` — file `25-exact.slat`

- **row-5-emergence** :eng-composition
  ```scheme
  (define (total-billing items) (fold exact/+ (exact/rat 0 1) (map item-cost items)))
(total-billing (list))
  ```
  Error:
  ```
  error: unbound symbol: item-cost

  ```

### `exact/->string` — file `25-exact.slat`

- **row-4-proof** :math-program
  ```scheme
  (define (round-trip? a) (exact/= a (parse-rational-string (exact/->string a))))
(round-trip? (exact/rat 3 4))
  ```
  Error:
  ```
  error: unbound symbol: parse-rational-string

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (join-with-comma xs) (fold (lambda (acc x) (if (equal? acc "") (exact/->string x) (string-append acc ", " (exact/->string x)))) "" xs))
(join-with-comma (list (exact/rat 1 2) (exact/rat 3 4)))
  ```
  Error:
  ```
  error: exact: not a rational or integer: string

  ```

### `exact/<=` — file `25-exact.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (all-le? xs cap) (fold (lambda (r x) (and r (exact/<= x cap))) #t xs))
(all-le? (list (exact/rat 1 2)) (exact/rat 1 1))
  ```
  Error:
  ```
  error: exact: not a rational or integer: boolean

  ```

### `exact/=` — file `25-exact.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (hash-partition xs) (fold (lambda (h x) (let ((k (exact/= x x))) (hash-table-update! h k (lambda (v) (cons x v)) (lambda () '())) h)) (make-hash-table) xs))
(hash-partition (list (exact/rat 1 2)))
  ```
  Error:
  ```
  error: exact: not a rational or integer: object

  ```

### `exact/>=` — file `25-exact.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (all-ge? xs floor) (fold (lambda (r x) (and r (exact/>= x floor))) #t xs))
(all-ge? (list (exact/rat 3 4)) (exact/rat 1 2))
  ```
  Error:
  ```
  error: exact: not a rational or integer: boolean

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (meets-all mins xs) (every (lambda (m x) (exact/>= x m)) mins xs))
(meets-all (list (exact/rat 1 1)) (list (exact/rat 1 1)))
  ```
  Error:
  ```
  error: exact: not a rational or integer: undefined

  ```

### `exact/inverse` — file `25-exact.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (safe-inverses xs) (map (lambda (x) (if (equal? x (exact/rat 0 1)) 'skip (exact/inverse x))) xs))
(safe-inverses (list (exact/rat 1 2) (exact/rat 0 1)))
  ```
  Error:
  ```
  error: exact: inverse of zero

  ```

### `game/nim-sum` — file `28-game.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (winning-move-target heaps)
  ;; Compute the reduction target for each heap in one pass.
  (let ((s (game/nim-sum heaps)))
    (map (lambda (h) (list 'heap h 'move-to (bitwise-xor h s) 'valid? (< (bitwise-xor h s) h))) heaps)))
(winning-move-target '(3 5 7))
  ```
  Error:
  ```
  error: unbound symbol: bitwise-xor

  ```
- **row-5-emergence** :composition
  ```scheme
  (define heaps '(3 5 7))
(define s (game/nim-sum heaps))
(define (find-winning-move heaps s)
  (fold (lambda (h acc) (if (or (not (null? acc)) (>= h (bitwise-xor h s))) acc (cons (bitwise-xor h s) acc))) '() heaps))
(find-winning-move heaps s)
  ```
  Error:
  ```
  error: unbound symbol: bitwise-xor

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (multi-nim-strategy games-boards)
  ;; Chain multiple independent Nim games; total value is XOR of per-game nim-sums.
  (let* ((per-game (map game/nim-sum games-boards))
         (overall (fold (lambda (b a) (bitwise-xor a b)) 0 per-game)))
    (list 'per-game per-game 'overall overall 'losi
  ```
  Error:
  ```
  error: unbound symbol: bitwise-xor

  ```

### `game/star-n` — file `28-game.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (star-n-vs-nim-sum n1 n2)
  ;; *n1 + *n2 should be equivalent to *(n1 ⊕ n2) by the Sprague-Grundy theorem.
  (let* ((combined (game/surreal-add (game/star-n n1) (game/star-n n2)))
         (expected (game/star-n (bitwise-xor n1 n2))))
    (game/surreal-eq? combined expected)))
(star-n-vs-nim
  ```
  Error:
  ```
  error: unbound symbol: bitwise-xor

  ```

### `game/surreal-eq?` — file `28-game.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (test-suite-runner-eq axioms)
  (map (lambda (ax) (list (car ax) 'result ((cdr ax)))) axioms))
(test-suite-runner-eq (list (cons 'reflexive (lambda () (game/surreal-eq? (game/surreal-lit 1) (game/surreal-lit 1))))))
  ```
  Error:
  ```
  error: not a function: [object Object]

  ```

### `game/surreal-is-number?` — file `28-game.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (closed-under-arithmetic? xs)
  (let loop ((ops '((add . game/surreal-add) (mul . game/surreal-mul))) (results '()))
    (if (null? ops) results
        (loop (cdr ops)
              (cons (cons (car (car ops))
                          (map (lambda (x) (game/surreal-is-number? ((cdr (car op
  ```
  Error:
  ```
  error: not a function: .,game/surreal-add

  ```

### `game/surreal-mul` — file `28-game.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (scale-portfolio scalar values)
  ;; Scale each surreal value by a common scalar.
  (map (lambda (v) (game/surreal-mul scalar v)) values))
(scale-portfolio (game/surreal-lit 2) (list (game/surreal-lit 1) (game/surreal-lit 3) (game/surreal-lit 5)))
  ```
  Error:
  ```
  <timeout>
  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (distributivity-check a b c)
  ;; a · (b + c) = a·b + a·c
  (game/surreal-eq? (game/surreal-mul a (game/surreal-add b c))
                    (game/surreal-add (game/surreal-mul a b) (game/surreal-mul a c))))
(distributivity-check (game/surreal-lit 2) (game/surreal-lit 3) (game/surreal-lit 4
  ```
  Error:
  ```
  <timeout>
  ```
- **row-5-emergence** :composition
  ```scheme
  (define a (game/surreal-lit 2))
(define b (game/surreal-lit 3))
(define c (game/surreal-lit 4))
(define lhs (game/surreal-mul a (game/surreal-add b c)))
(define rhs (game/surreal-add (game/surreal-mul a b) (game/surreal-mul a c)))
(game/surreal-eq? lhs rhs)
  ```
  Error:
  ```
  <timeout>
  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (repeated-mul base n)
  ;; base^n via repeated multiplication.
  (let loop ((k n) (acc (game/surreal-lit 1)))
    (if (<= k 0) acc
        (loop (- k 1) (game/surreal-mul acc base)))))
(repeated-mul (game/surreal-lit 2) 3)
  ```
  Error:
  ```
  <timeout>
  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (associativity-mul a b c)
  ;; (a·b)·c = a·(b·c)
  (game/surreal-eq? (game/surreal-mul (game/surreal-mul a b) c)
                    (game/surreal-mul a (game/surreal-mul b c))))
(associativity-mul (game/surreal-lit 2) (game/surreal-lit 3) (game/surreal-lit 4))
  ```
  Error:
  ```
  <timeout>
  ```

### `game/surreal-simplest` — file `28-game.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (canonical-mid lo hi)
  (let ((s (game/surreal-simplest lo hi)))
    (if (eq? s 'nan) (error 'inverted-interval) s)))
(canonical-mid 0 1)
  ```
  Error:
  ```
  <timeout>
  ```
- **row-2-audit** :math-program
  ```scheme
  (define (born-early? lo hi)
  ;; Simplest = min-birthday surreal in (lo, hi). Between 0 and 1 the answer is 1/2 (born day 1).
  (let ((s (game/surreal-simplest lo hi)))
    (= (game/surreal-birthday s) 1)))
(born-early? 0 1)
  ```
  Error:
  ```
  <timeout>
  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (nan-guard lo hi)
  (let ((r (game/surreal-simplest lo hi)))
    (if (eq? r 'nan) 'invalid 'ok)))
(list (nan-guard 0 1) (nan-guard 1 0))
  ```
  Error:
  ```
  <timeout>
  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (regression-bracketed)
  (let ((s (game/surreal-simplest 0 1)))
    (list (game/surreal-le? (game/surreal-lit 0) s)
          (game/surreal-le? s (game/surreal-lit 1))
          (not (game/surreal-eq? s (game/surreal-lit 0)))
          (not (game/surreal-eq? s (game/surreal-lit 1))))))
(regr
  ```
  Error:
  ```
  <timeout>
  ```
- **row-4-proof** :math-program
  ```scheme
  (define (minimality-check lo hi)
  ;; Minimality of birthday: any strict-between surreal has ≥ this birthday.
  (let ((s (game/surreal-simplest lo hi)))
    (>= (game/surreal-birthday (game/surreal-lit (/ (+ lo hi) 4)))
        (game/surreal-birthday s))))
(minimality-check 0 1)
  ```
  Error:
  ```
  <timeout>
  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (bisect target n)
  (let loop ((lo 0) (hi 1) (i 0))
    (if (>= i n) (game/surreal-simplest lo hi)
        (let ((m (game/surreal-simplest lo hi)))
          (if (game/surreal-le? m target)
              (loop (game/to-real m) hi (+ i 1))
              (loop lo (game/to-real m) (+ i 1)))))))
  ```
  Error:
  ```
  <timeout>
  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (dyadic-tree depth)
  ;; Enumerate all dyadics of birth day ≤ depth by iterating simplest.
  (let loop ((intervals (list (list 0 1))) (d 0) (out '()))
    (if (>= d depth) (reverse out)
        (let ((next (fold append '()
                     (map (lambda (iv)
                            (l
  ```
  Error:
  ```
  <timeout>
  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (converge target epsilon)
  (let loop ((lo 0) (hi 1) (steps 0))
    (if (or (> steps 20) (< (- hi lo) epsilon))
        (list 'converged steps)
        (let ((m (game/surreal-simplest lo hi)))
          (if (game/surreal-le? m target)
              (loop (game/to-real m) hi (+ steps 1))
    
  ```
  Error:
  ```
  <timeout>
  ```

### `game/surreal-sub` — file `28-game.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (telescoping-sum snapshots)
  ;; Σ(a_{i+1} − a_i) = a_n − a_0.
  (let ((deltas (map game/surreal-sub (cdr snapshots) snapshots)))
    (fold game/surreal-add (game/surreal-lit 0) deltas)))
(telescoping-sum (map game/surreal-lit '(0 1 3 6 10)))
  ```
  Error:
  ```
  <timeout>
  ```

### `on-collision` — file `28-game.slat`

- **row-2-audit** :eng-program
  ```scheme
  (on-collision (lambda (a b) (display 'hit)))
(physics/step)
  ```
  Error:
  ```
  error: unbound symbol: on-collision

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (safe-install h)
  (if (or (procedure? h) (eq? h #f))
      (begin (on-collision h) 'installed)
      (error 'need-procedure-or-false h)))
(safe-install (lambda (a b) 'ok))
  ```
  Error:
  ```
  error: unbound symbol: on-collision

  ```
- **row-4-proof** :eng-program
  ```scheme
  (on-collision (lambda (a b) 'x))
(on-collision #f)
#t
  ```
  Error:
  ```
  error: unbound symbol: on-collision

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (replace-semantics?)
  (on-collision (lambda (a b) 'first))
  (on-collision (lambda (a b) 'second))
  ;; Only 'second remains — verifiable by observing dispatch on a controlled physics/step.
  #t)
(replace-semantics?)
  ```
  Error:
  ```
  error: unbound symbol: on-collision

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define score 0)
(on-collision (lambda (a b)
  (when (and (eq? a 'player) (eq? b 'coin)) (set! score (+ score 1)))))
(physics/step)
score
  ```
  Error:
  ```
  error: unbound symbol: on-collision

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (multi-listener handlers)
  ;; Compose N listeners into one slot by fanout inside the handler.
  (on-collision (lambda (a b)
    (for-each (lambda (h) (h a b)) handlers))))
(multi-listener (list (lambda (a b) 'log)
                      (lambda (a b) 'damage)))
  ```
  Error:
  ```
  error: unbound symbol: on-collision

  ```

### `geom/->degrees` — file `29-geom.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (clamp-bearing-deg rad) (modulo (inexact->exact (round (geom/->degrees rad))) 360))
(clamp-bearing-deg (* 5 math/pi))
  ```
  Error:
  ```
  error: The number NaN cannot be converted to a BigInt because it is not an integer

  ```

### `geom/arctan` — file `29-geom.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (quadrant-safe? y x) (let ((a1 (geom/arctan (/ y x))) (a2 (if (< x 0) (+ a1 3.14159265) a1))) (list 'ratio a1 'quadrant-fixed a2)))
(quadrant-safe? 1 -1)
  ```
  Error:
  ```
  error: unbound symbol: a1

  ```

### `geom/interior-angle-deg` — file `29-geom.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (angle-table-cached ns) (let ((tbl (map (lambda (n) (cons n (geom/interior-angle-deg n))) ns))) (lambda (n) (cond ((assoc n tbl) => cdr) (else (geom/interior-angle-deg n))))))
(let ((look (angle-table-cached (list 3 4 5 6)))) (list (look 4) (look 5) (look 100)))
  ```
  Error:
  ```
  error: unbound symbol: =>

  ```

### `geom/law-of-cosines-side` — file `29-geom.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (safe-cos-side a b theta) (if (and (> a 0) (> b 0) (> theta 0) (< theta math/pi)) (geom/law-of-cosines-side a b theta) (error 'invalid-triangle-sas)))
(safe-cos-side 3 4 (/ math/pi 3))
  ```
  Error:
  ```
  error: invalid-triangle-sas

  ```

### `geom/law-of-sines-side` — file `29-geom.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (safe-sines-side a A B) (if (and (> a 0) (> A 0) (< A math/pi) (> B 0) (< B math/pi) (< (+ A B) math/pi)) (geom/law-of-sines-side a A B) (error 'invalid-triangle-asa)))
(safe-sines-side 10 (/ math/pi 4) (/ math/pi 3))
  ```
  Error:
  ```
  error: invalid-triangle-asa

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (chain-solver-with-validation a A B) (cond ((not (and (> A 0) (> B 0))) (error 'nonpositive-angle)) ((>= (+ A B) math/pi) (error 'angle-sum-exceeds-pi)) (else (let* ((C (- math/pi A B)) (b (geom/law-of-sines-side a A B)) (c (geom/law-of-sines-side a A C))) (list a b c)))))
(chain-solver-with
  ```
  Error:
  ```
  error: nonpositive-angle

  ```

### `geom/regular-polygon-vertices` — file `29-geom.slat`

- **row-4-proof** :program
  ```scheme
  (define pts (geom/regular-polygon-vertices 8 10 0))
(every? (lambda (p) (< (abs (- (geom/distance 0 0 (car p) (cadr p)) 10)) 1e-9)) pts)
  ```
  Error:
  ```
  error: unbound symbol: every?

  ```

### `geom/right-triangle-angle` — file `29-geom.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (angle-cache-for-hyp hyp) (let ((tbl (list))) (lambda (opp) (cond ((assoc opp tbl) => cdr) (else (let ((v (geom/right-triangle-angle opp hyp))) (set! tbl (cons (cons opp v) tbl)) v))))))
(let ((f (angle-cache-for-hyp 5))) (list (f 3) (f 3) (f 4)))
  ```
  Error:
  ```
  error: unbound symbol: =>

  ```

### `geom/sector-area` — file `29-geom.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (sector-cache-per-radius radius) (let ((tbl (list))) (lambda (angle-deg) (cond ((assoc angle-deg tbl) => cdr) (else (let ((v (geom/sector-area radius angle-deg))) (set! tbl (cons (cons angle-deg v) tbl)) v))))))
(let ((s (sector-cache-per-radius 12))) (list (s 60) (s 60) (s 90)))
  ```
  Error:
  ```
  error: unbound symbol: =>

  ```

### `geom/solve-right` — file `29-geom.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (pythagoras-holds? config) (let ((r (geom/solve-right config))) (< (abs (- (+ (expt (list-ref r 3) 2) (expt (list-ref r 5) 2)) (expt (list-ref r 1) 2))) 1))
(pythagoras-holds? (list ':opp 3 ':adj 4))
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```

### `geom/sphere-volume` — file `29-geom.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (integrate-shells-witness r layers) (let ((dr (/ r layers))) (let loop ((k 0) (acc 0)) (if (= k layers) acc (let* ((r-inner (* k dr)) (shell-vol (* 4 math/pi r-inner r-inner dr))) (loop (+ k 1) (+ acc shell-vol)))))))
(< (abs (- (integrate-shells-witness 5 10000) (geom/sphere-volume 5))) 0.1
  ```
  Error:
  ```
  error: fuel exhausted

  ```

### `geom/transform-polygon` — file `29-geom.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (rotate-360-restores? pts) (let ((r (geom/transform-polygon pts 'geom/rotate 360))) (every? (lambda (pair) (and (< (abs (- (car (car pair))  (car (cadr pair)))) 1e-6) (< (abs (- (cadr (car pair)) (cadr (cadr pair)))) 1e-6))) (map list pts r))))
(rotate-360-restores? '((0 0) (1 0) (1 1) (0 1)
  ```
  Error:
  ```
  error: unbound symbol: every?

  ```

### `alist->hash-table` — file `32-hash.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (assoc-lookup-cost n) (list 'assoc-cost 'O(n)))
(define (hash-lookup-cost n) (list 'hash-cost 'O(1)))
(display (list 'compare (assoc-lookup-cost 1000) (hash-lookup-cost 1000)))
(newline)
  ```
  Error:
  ```
  error: not a function: 1000

  ```

### `hash-table-set!` — file `32-hash.slat`

- **row-3-dimension** :code
  ```scheme
  (erase-and-write board 'todo "buy milk")
  ```
  Error:
  ```
  error: unbound symbol: erase-and-write

  ```

### `linalg/gram-schmidt` — file `38-linalg.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define design-cols (list '(1 1 1 1) '(1 2 3 4) '(1 4 9 16)))
(define orthonormal-cols (linalg/gram-schmidt design-cols))
orth-cols
  ```
  Error:
  ```
  error: unbound symbol: orth-cols

  ```

### `linalg/lu` — file `38-linalg.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (lu-recomposition-check A)
  (let* ((lu (linalg/lu A))
         (L (car lu)) (U (cadr lu)) (P (caddr lu))
         (LU (matrix/multiply L U))
         (PA (matrix/multiply P A))
         (diff (matrix/sub LU PA)))
    (< (abs (matrix/get diff 0 0)) 1e-6)))
(lu-recomposition-check '((2 1)(1 3
  ```
  Error:
  ```
  error: matrix/multiply: shape mismatch (A is 0×0, B is 2×2)

  ```

### `linalg/qr` — file `38-linalg.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (orthonormal-basis-extraction vecs)
  (let* ((A (apply map list vecs))
         (qr (linalg/qr A))
         (Q (car qr))
         (n-cols (length (car Q))))
    (map (lambda (j) (map (lambda (row) (list-ref row j)) Q))
         (list 0 (- n-cols 1)))))
(orthonormal-basis-extraction (list '(1
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading 'length')

  ```

### `matrix/make` — file `41-matrix.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (import-or-report rows)
  ;; Import pipelines log OK or REJECT based on the ragged sentinel.
  (let ((M (matrix/make rows)))
    (if (equal? M 'ragged)
        (list ':status 'reject ':reason 'ragged)
        (list ':status 'ok ':shape (list (matrix/rows M) (matrix/cols M))))))
(import-or-re
  ```
  Error:
  ```
  error: matrix: ragged row 1 (expected 3, got 2)

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (detects-ragged? rows) (equal? (matrix/make rows) 'ragged))
(list (detects-ragged? '((1 2)(3 4 5))) (detects-ragged? '((1 2)(3 4))))
  ```
  Error:
  ```
  error: matrix: ragged row 1 (expected 2, got 3)

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (ragged-is-not-a-matrix? rows)
  ;; A ragged result must not pass as a shaped matrix.
  (equal? (matrix/make rows) 'ragged))
(ragged-is-not-a-matrix? '((1 2 3)(4 5)))
  ```
  Error:
  ```
  error: matrix: ragged row 1 (expected 3, got 2)

  ```

### `matrix/ref` — file `41-matrix.slat`

- **row-2-audit** :math-program
  ```scheme
  (define (out-of-bounds-is-nan? M)
  ;; Out-of-range access returns the symbol 'nan, not an error.
  (eq? (matrix/ref M 9 9) 'nan))
(out-of-bounds-is-nan? '((1 2)(3 4)))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '9')

  ```

### `motion/drop` — file `42-motion.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (unique-max? xs)
  (let* ((m (apply max xs))
         (count (length (filter (lambda (x) (= x m)) xs))))
    (= count 1)))
(define d (motion/drop 3 8))
(unique-max? (hash-table-ref/default d 'articulation #f))
  ```
  Error:
  ```
  error: lst.filter is not a function

  ```

### `motion/halt` — file `42-motion.slat`

- **row-2-audit** :math-program
  ```scheme
  (honest-null :reason "motion/halt is a state-termination operation (cancel active bindings/timers). Its 'math view' would be a projection onto v=0 in phase space — but that's a shape statement, not a proposition. The real content lives in CS (state termination) — see cs-program. Book-of-motion ch 5.
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-4-proof** :math-program
  ```scheme
  (honest-null :reason "Idempotence h∘h=h of state-cancellation is a fixed-point property; the math view is trivial (the fixed set is 'no motion'). The proof lives in CS as a property test — see cs-program.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (honest-null :reason "The 5-emergence math view of halt-composition would be 'sequential cancellation as identity in the state monoid.' That's a shape-name, not a proposition worth a witness. The real emergent composition lives in eng (evacuate) and cs (checkpoint). Book-of-composition ch 15.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```

### `motion/move-to` — file `42-motion.slat`

- **row-2-audit** :program
  ```scheme
  (define descriptor (motion/move-to 'card 200 100 400 'ease-out-cubic))
(card-do 'card 'animate descriptor)
  ```
  Error:
  ```
  error: unbound symbol: card-do

  ```

### `motion/with-feel` — file `42-motion.slat`

- **row-2-audit** :program
  ```scheme
  (define feel (motion/with-feel 'sweep-tensor 'staccato))
(card-do 'card 'animate feel)
  ```
  Error:
  ```
  error: unbound symbol: card-do

  ```
- **row-2-audit** :math-program
  ```scheme
  (honest-null :reason "motion/with-feel is a combinator-lift: it wraps a tensor with an articulation tag. The mathematical content lives in the underlying tensor + articulation-envelope shape; with-feel itself just packages them. Book-of-motion ch 9.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define feel (motion/with-feel 'sweep-tensor 'staccato))
(define (descriptor-shape? d) (or (hash? d) (list? d) (procedure? d)))
(descriptor-shape? feel)
  ```
  Error:
  ```
  error: unbound symbol: hash?

  ```
- **row-4-proof** :math-program
  ```scheme
  (honest-null :reason "Duration-invariance under articulation change is a preservation property of the wrapper; the mathematical content is 'wrapping preserves an underlying scalar' which is trivial. Book-of-motion ch 9.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (expressive-scene light-cards heavy-cards)
  (for-each (lambda (c)
              (card-do c 'animate (motion/with-feel 'light-bounce 'staccato)))
            light-cards)
  (for-each (lambda (c)
              (card-do c 'animate (motion/with-feel 'heavy-bounce 'marcato)))
            heavy-c
  ```
  Error:
  ```
  error: unbound symbol: card-do

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (orchestrate-scene sections)
  ;; sections = ((tag tensor articulation entities) ...) — apply articulated motion per section.
  (for-each (lambda (sec)
              (let ((tensor (cadr sec)) (art (caddr sec)) (ents (cadddr sec)))
                (for-each (lambda (e) (card-do e 'animate (mo
  ```
  Error:
  ```
  error: unbound symbol: card-do

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (honest-null :reason "Emergent composition of with-feel across a partition is 'parallel wrapping preserves per-part duration.' A structural preservation statement, not a proposition with witnesses. Book-of-composition ch 13.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```

### `motion/with-pace` — file `42-motion.slat`

- **row-2-audit** :program
  ```scheme
  (define energy 30)
(define intensity (/ energy 100.0))
(define pace-desc (motion/with-pace 'hero-tensor intensity))
(card-do 'hero 'animate pace-desc)
  ```
  Error:
  ```
  error: unbound symbol: card-do

  ```
- **row-2-audit** :math-program
  ```scheme
  (honest-null :reason "motion/with-pace is a scalar-multiplication combinator on the underlying tensor's IoI. Its math view — 'time-scaling preserves shape' — is trivial. The real math lives in the tensor itself and the intensity's clamping envelope. Book-of-motion ch 10.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-4-proof** :math-program
  ```scheme
  (honest-null :reason "Linearity invariant d(i)·i = base is a trivial algebraic identity (definition of scalar scaling). The proof is by construction — no witness beyond the definition. Book-of-motion ch 10.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (crescendo-scene entities tensor start-i end-i steps)
  ;; Gradually increase intensity across time — emergent 'building tension.'
  (let loop ((i 0))
    (cond ((>= i steps) 'done)
          (else (let ((intensity (+ start-i (* (/ i (- steps 1)) (- end-i start-i)))))
                  (for-
  ```
  Error:
  ```
  error: unbound symbol: card-do

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (honest-null :reason "Time-varying scalar composition (intensity as function of state) is a substitution pattern — the composition wraps whatever intensity is emitted. No propositional content beyond 'wrapping preserves evaluation order.' Book-of-composition ch 14.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```

### `nt/divmod` — file `44-nt.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (euclid-gcd-via-divmod a b)
  ;; Chain nt/divmod recursively; base case r=0.
  (if (zero? b) a
      (let ((qr (nt/divmod a b)))
        (euclid-gcd-via-divmod b (cdr (cadr qr))))))
(euclid-gcd-via-divmod 1729 89)
  ```
  Error:
  ```
  error: fuel exhausted

  ```

### `nt/prime?` — file `44-nt.slat`

- **row-2-audit** :program
  ```scheme
  (if (nt/prime? proposed-size) 'accept 'reject)
  ```
  Error:
  ```
  error: unbound symbol: proposed-size

  ```

### `nt/totient` — file `44-nt.slat`

- **row-2-audit** :program
  ```scheme
  (nt/totient (* p q))
  ```
  Error:
  ```
  error: unbound symbol: p

  ```

### `ops/dijkstra` — file `47-ops.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define g '((A . ((B . 1) (C . 4))) (B . ((C . 2) (D . 5))) (C . ((D . 1))) (D . ())))
(let ((t (ops/dijkstra g 'A)))
  (list 'dist-to-D (cdr (assoc 'D (car t)))
        'path-A-to-D 'A-B-C-D))
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define g '((A . ((B . 1) (C . 4))) (B . ((C . 2) (D . 5))) (C . ((D . 1))) (D . ())))
(let ((t (ops/dijkstra g 'A)))
  (= 0 (cdr (assoc 'A (car t)))))
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-4-proof** :math-program
  ```scheme
  (define g '((A . ())))
(define t (ops/dijkstra g 'A))
(= 0 (cdr (assoc 'A (car t))))
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define g '((A . ((B . 1) (C . 4))) (B . ((C . 2) (D . 5))) (C . ((D . 1))) (D . ())))
(define (reconstruct-path table src dst)
  (let loop ((node dst) (path (list dst)))
    (if (eq? node src)
      (reverse path)
      (let ((pred (cdr (assoc node (cadr table)))))
        (loop pred (cons pred pat
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (all-distances g src)
  (let ((table (ops/dijkstra g src)))
    (map (lambda (entry) (list (car entry) (cdr entry))) (car table))))
(all-distances '((A . ((B . 1) (C . 4))) (B . ((C . 2))) (C . ())) 'A)
  ```
  Error:
  ```
  error: a.slice is not a function

  ```

### `ops/johnson` — file `47-ops.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (schedule-two-stage jobs)
  (let ((seq (ops/johnson jobs)))
    (if (pair? seq)
      (list 'ok seq)
      (escalate 'johnson-failed seq))))
(schedule-two-stage '((a . ((m1 . 2) (m2 . 8))) (b . ((m1 . 5) (m2 . 3)))))
  ```
  Error:
  ```
  error: escalate: johnson-failed 

  ```

### `ops/knapsack` — file `47-ops.slat`

- **row-2-audit** :eng-program
  ```scheme
  (let* ((items '((2 3) (3 4) (4 5) (5 6)))
       (picks (ops/knapsack 10 items))
       (weight (apply + (map (lambda (i) (car (list-ref items i))) picks)))
       (value (apply + (map (lambda (i) (cadr (list-ref items i))) picks))))
  (list 'take picks 'weight weight 'value value))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '0')

  ```
- **row-4-proof** :eng-program
  ```scheme
  (let* ((cap 5) (items '((2 3) (4 5) (3 4)))
       (sol (ops/knapsack cap items))
       (used (apply + (map (lambda (i) (car (list-ref items i))) sol))))
  (<= used cap))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '0')

  ```
- **row-4-proof** :math-program
  ```scheme
  (let* ((cap 7) (items '((1 2) (2 3) (3 5) (5 7)))
       (sol (ops/knapsack cap items)))
  (<= (apply + (map (lambda (i) (car (list-ref items i))) sol)) cap))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '0')

  ```
- **row-4-proof** :cs-program
  ```scheme
  (define (feasible? cap items)
  (let* ((sol (ops/knapsack cap items))
         (w (apply + (map (lambda (i) (car (list-ref items i))) sol))))
    (<= w cap)))
(feasible? 5 '((2 3) (4 5)))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '0')

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (best-of-budgets items budgets)
  (map (lambda (cap)
    (let* ((sol (ops/knapsack cap items))
           (v (apply + (map (lambda (i) (cadr (list-ref items i))) sol))))
      (list 'cap cap 'value v))) budgets))
(best-of-budgets '((2 3) (3 4) (4 5)) '(3 6 9))
  ```
  Error:
  ```
  error: Cannot read properties of undefined (reading '1')

  ```

### `ops/max-flow` — file `47-ops.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (throughput-check g s t required)
  (let ((flow (ops/max-flow g s t)))
    (if (< flow required)
      (escalate 'insufficient-capacity (list 'flow flow 'need required))
      flow)))
(throughput-check '((0 . ((1 . 10) (2 . 5))) (1 . ((3 . 9))) (2 . ((3 . 10)))) 0 3 15)
  ```
  Error:
  ```
  error: escalate: insufficient-capacity flow,0,need,15

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define sources '(0 1 2))
(define g '((0 . ((1 . 5))) (1 . ((2 . 3))) (2 . ())))
(map (lambda (s) (list s (ops/max-flow g s 2))) sources)
  ```
  Error:
  ```
  <timeout>
  ```

### `ops/mip-solve` — file `47-ops.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (solve-mip constraints objective opts)
  (let ((r (ops/mip-solve constraints objective opts)))
    (cond ((pair? r) r)
          ((memq r '(infeasible unbounded fuel-budget)) (escalate r null))
          (else (escalate 'unknown r)))))
(solve-mip (list (list 1 1 '<= 5)) (list 3 2) (list ':in
  ```
  Error:
  ```
  error: escalate: unknown invalid-mip

  ```

### `ops/pagerank` — file `47-ops.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (rank-report edges)
  (let ((ranks (ops/pagerank edges)))
    (if (> (length (hash-table-keys ranks)) 0)
      (list 'nodes (length (hash-table-keys ranks)) 'ranks ranks)
      (escalate 'empty-graph null))))
(rank-report (list (list 'a 'b) (list 'b 'c) (list 'c 'a)))
  ```
  Error:
  ```
  error: unbound symbol: null

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define ranks (ops/pagerank '((a b) (b a))))
(define total (apply + (map (lambda (k) (hash-table-ref/default ranks k #f)) (hash-table-keys ranks))))
(if (< (abs (- total 1)) 0.01)
  (list 'sums-to-one-ok total)
  (escalate 'unnormalized-ranks null))
  ```
  Error:
  ```
  error: unbound symbol: null

  ```

### `ops/simplex` — file `47-ops.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (solve-and-report c A b)
  (let* ((lp (ops/lp c 'max A b))
         (sol (ops/simplex lp)))
    (list 'x (cdr (assoc 'x sol)) 'obj (cdr (assoc 'obj-value sol)))))
(solve-and-report '(3 2) '((1 1)) '(4))
  ```
  Error:
  ```
  error: alist.find is not a function

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (obj-of c A b)
  (cdr (assoc 'obj-value (ops/simplex (ops/lp c 'max A b)))))
(obj-of '(3 2) '((1 1)) '(4))
  ```
  Error:
  ```
  error: alist.find is not a function

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define sol (ops/simplex (ops/lp '(1) 'max '((1)) '(1))))
(if (pair? sol)
  (list 'terminated-ok sol)
  (escalate 'no-solution null))
  ```
  Error:
  ```
  error: unbound symbol: null

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (batch-solve problems)
  (map (lambda (p)
         (let ((sol (ops/simplex (ops/lp (car p) 'max (cadr p) (caddr p)))))
           (list 'obj (cdr (assoc 'obj-value sol)))))
       problems))
(batch-solve (list (list '(3 2) '((1 1)) '(4)) (list '(1) '((1)) '(1))))
  ```
  Error:
  ```
  error: alist.find is not a function

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (objs-over problems)
  (map (lambda (p)
         (cdr (assoc 'obj-value (ops/simplex (ops/lp (car p) 'max (cadr p) (caddr p))))))
       problems))
(objs-over (list (list '(3 2) '((1 1)) '(4))))
  ```
  Error:
  ```
  error: alist.find is not a function

  ```

### `part/bow` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (define (bow-and-check npc) (let ((before (sprite-angle npc))) (part/bow npc) (world/step) (world/step) (world/step) (let ((after (sprite-angle npc))) (= before after))))
(display (bow-and-check 'hero))
  ```
  Error:
  ```
  error: unbound symbol: sprite-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (spam-safe npc n)
  (let ((before (sprite-angle npc)))
    (let loop ((k 0))
      (cond ((= k n) 'sent)
            (else (part/bow npc) (loop (+ k 1)))))
    (world/step) (world/step) (world/step)
    (= (sprite-angle npc) before)))
(spam-safe 'violinist 10)
  ```
  Error:
  ```
  error: unbound symbol: sprite-angle

  ```

### `part/breathe` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (define (test-nostack s) (part/breathe s) (part/breathe s) (part/breathe s) (loop-count s 'breathe))
(display (= 1 (test-nostack 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: loop-count

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-many-owners entities)
  (for-each (lambda (e) (part/breathe e) (part/breathe e) (part/breathe e)) entities)
  (map (lambda (e) (loop-count e 'breathe)) entities))
(test-many-owners '(wyrm cub matriarch))
  ```
  Error:
  ```
  error: unbound symbol: loop-count

  ```

### `part/expression` — file `48-part.slat`

- **row-2-audit** :math-program
  ```scheme
  (honest-null :reason "part/expression is a symbol-set assignment (categorical variable). Its math view is a total function from a finite alphabet to a rendering — trivial. The real content is in CS (register semantics) and eng (dramatic sequencing). Book-of-code ch 3 (tagged unions).")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```
- **row-4-proof** :program
  ```scheme
  (part/expression 'hero 'sad) (part/expression 'hero 'happy) (part/expression 'hero 'calm)
(display (eq? (face-tag 'hero) 'calm))
  ```
  Error:
  ```
  error: unbound symbol: face-tag

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-permutations tags final)
  ;; Different orderings, same last tag → same final face.
  (for-each (lambda (t) (part/expression 'test-actor t)) tags)
  (eq? (face-tag 'test-actor) final))
(test-permutations '(joyful contemplative sorrowful) 'sorrowful)
  ```
  Error:
  ```
  error: unbound symbol: face-tag

  ```
- **row-4-proof** :math-program
  ```scheme
  (honest-null :reason "'Last-write-wins' on a register is a definitional property of assignment. Not a mathematical proposition requiring a witness. See eng and cs for operational proof.")
  ```
  Error:
  ```
  error: unbound symbol: honest-null

  ```

### `part/grasp` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/grasp 'hero 'firm 'lantern) (part/grasp 'hero 'firm 'lantern)
(display (= 1 (queue-count 'hero 'grasp)))
  ```
  Error:
  ```
  error: unbound symbol: queue-count

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (safe-regrasp npc obj)
  ;; scene re-enter may re-issue grasp; idempotence keeps it clean
  (part/grasp npc 'firm obj)
  (part/grasp npc 'firm obj)
  (display (= 1 (queue-count npc 'grasp))))
(safe-regrasp 'hero 'lantern)
  ```
  Error:
  ```
  error: unbound symbol: queue-count

  ```

### `part/lean` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/lean 'hero 'left 10) (part/lean 'hero 'left 20)
(display (<= (lean-angle 'hero) 30))
  ```
  Error:
  ```
  error: unbound symbol: lean-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-cap-across-rigs rigs sum-attempts)
  ;; Verify no rig ever accepts an angle beyond its max, however many leans stack.
  (let loop ((rs rigs) (ok #t))
    (cond ((null? rs) ok)
          (else (let ((r (car rs)))
                  (part/lean 'skater 'left sum-attempts)
                 
  ```
  Error:
  ```
  error: unbound symbol: lean-angle

  ```

### `part/look-toward` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/look-toward 'hero 'villain) (part/look-toward 'villain 'hero) (world/step)
(display (and (gaze-locked? 'hero 'villain) (gaze-locked? 'villain 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: gaze-locked?

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (mutual-gaze-many pairs)
  ;; Verify symmetry across a list of gaze pairs.
  (let loop ((ps pairs) (ok #t))
    (cond ((null? ps) ok)
          (else (let* ((p (car ps)) (a (car p)) (b (cadr p)))
                  (part/look-toward a b)
                  (part/look-toward b a)
              
  ```
  Error:
  ```
  error: unbound symbol: gaze-locked?

  ```

### `part/lower` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/lower 'hero) (part/lower 'hero) (part/lower 'hero)
(display (= 0 (arm-angle 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (defensive-lower cranes)
  ;; Call lower on every crane regardless of current state — safe defensive cleanup.
  (for-each (lambda (c) (part/lower c) (part/lower c) (part/lower c)) cranes)
  (map (lambda (c) (arm-angle c)) cranes))
(defensive-lower '(crane-1 crane-2 crane-3))
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```

### `part/nod` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/nod 'hero) (part/nod 'hero) (part/nod 'hero) (world/step) (world/step) (world/step)
(display (= 3 (nod-count-observed 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: nod-count-observed

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-emphatic-nod-counts counts)
  (map (lambda (n)
         (let loop ((k 0)) (when (< k n) (part/nod 'chef) (loop (+ k 1))))
         (let loop ((k 0)) (when (< k n) (world/step) (loop (+ k 1))))
         (nod-count-observed 'chef))
       counts))
(test-emphatic-nod-counts '(1 3 5))
  ```
  Error:
  ```
  error: unbound symbol: nod-count-observed

  ```

### `part/point` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/point 'hero) (part/lower 'hero) (world/step)
(display (= 0 (arm-angle 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-point-lower-cycles n)
  ;; Cycle point/lower N times; final angle must be 0.
  (let loop ((k 0))
    (cond ((= k n)
           (world/step)
           (= (arm-angle 'teacher) 0))
          (else (part/point 'teacher) (part/lower 'teacher) (loop (+ k 1))))))
(test-point-lower-cycles 20)
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```

### `part/raise` — file `48-part.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (classroom-vote question students)
  ;; Students raise hands in favor of a proposition — check for majority.
  (for-each (lambda (s) (when (favors? s question) (part/raise s))) students)
  (list :vote-taken question))
(classroom-vote 'add-more-recess '(alice bob carol dave))
  ```
  Error:
  ```
  error: unbound symbol: favors?

  ```
- **row-4-proof** :program
  ```scheme
  (part/raise 'hero) (part/lower 'hero) (world/step)
(display (= 0 (arm-angle 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (raise-lower-loop student cycles)
  ;; N cycles of raise-then-lower must end at rest (no accumulated offset).
  (let loop ((k 0))
    (cond ((= k cycles) (= (arm-angle student) 0))
          (else (part/raise student) (part/lower student) (loop (+ k 1))))))
(raise-lower-loop 'student 50)
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (count-raised-arms students)
  ;; Sum of indicator function over the class: |{s | raised?(s)}|.
  (length (filter (lambda (s) (raised? s)) students)))
(count-raised-arms '(alice bob carol dave))
  ```
  Error:
  ```
  error: unbound symbol: raised?

  ```

### `part/reach` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/reach 'hero) (part/lower 'hero) (world/step)
(display (= 0 (arm-angle 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-failed-reaches n)
  ;; N failed reaches (no grasp) must each end at rest after lower.
  (let loop ((k 0))
    (cond ((= k n) 'all-ok)
          (else (part/reach 'climber) (part/lower 'climber) (world/step)
                (if (= (arm-angle 'climber) 0) (loop (+ k 1)) 'failed)))))
(tes
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (route-with-fallbacks climber holds fallback-hold)
  ;; Try each hold in sequence; if grasp fails, reach for fallback.
  (let loop ((hs holds))
    (cond ((null? hs) (part/reach climber) (part/grasp climber 'firm fallback-hold))
          (else (part/reach climber)
                (if (grasp
  ```
  Error:
  ```
  error: unbound symbol: grasp-succeeded?

  ```

### `part/shake` — file `48-part.slat`

- **row-2-audit** :eng-program
  ```scheme
  (define (mark-wrong npc answer)
  (unless (correct? answer)
    (part/shake npc)
    (part/expression npc 'disappointed)))
(mark-wrong 'teacher 'guess-42)
  ```
  Error:
  ```
  error: unbound symbol: correct?

  ```
- **row-4-proof** :program
  ```scheme
  (part/shake 'hero) (part/nod 'hero) (world/step) (world/step)
(display (and (observed-shake? 'hero) (observed-nod? 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: observed-shake?

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (yes-but-no hero)
  ;; ambiguous head gesture: pitch and yaw both animate, neither overwrites
  (part/nod hero)
  (part/shake hero)
  (display (and (observed-nod? hero) (observed-shake? hero))))
(yes-but-no 'hero)
  ```
  Error:
  ```
  error: unbound symbol: observed-nod?

  ```

### `part/shrug` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/raise 'hero) (part/shrug 'hero) (world/step) (world/step)
(display (= (arm-angle 'hero) (arm-angle-raised)))
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (shrug-preserves-arm hero)
  (part/raise hero)
  (part/shrug hero)
  (display (= (arm-angle hero) (arm-angle-raised))))
(shrug-preserves-arm 'hero)
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```

### `part/step` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (define x0 (entity/x 'hero)) (part/step 'hero) (part/step 'hero) (part/step 'hero) (world/step)
(display (= (entity/x 'hero) (+ x0 (* 3 (stride-length 'hero)))))
  ```
  Error:
  ```
  error: unbound symbol: stride-length

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (walk-to hero target-x)
  (let loop ((x (entity/x hero)))
    (when (< x target-x)
      (part/step hero) (world/step)
      (loop (entity/x hero)))))
(walk-to 'hero 200)
  ```
  Error:
  ```
  error: fuel exhausted

  ```

### `part/sway` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (for-each (lambda (n) (part/sway n)) '(a b c d e))
(world/step) (world/step) (world/step)
(display (phase-coherent? '(a b c d e)))
  ```
  Error:
  ```
  error: unbound symbol: phase-coherent?

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-coherence-across-groups groups)
  (map (lambda (g)
         (for-each (lambda (n) (part/sway n)) g)
         (world/step) (world/step) (world/step)
         (phase-coherent? g))
       groups))
(test-coherence-across-groups '((a b c) (d e f g) (h i)))
  ```
  Error:
  ```
  error: unbound symbol: phase-coherent?

  ```

### `part/tilt` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/turn 'hero) (part/tilt 'hero) (world/step)
(display (= (body-angle 'hero) (body-angle-turned)))
  ```
  Error:
  ```
  error: unbound symbol: body-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-orthogonality operators)
  ;; Body angle preserved across tilt for each operator.
  (map (lambda (op)
         (part/turn op) (let ((before (body-angle op)))
           (part/tilt op) (world/step)
           (= (body-angle op) before)))
       operators))
(test-orthogonality '(op-a op-
  ```
  Error:
  ```
  error: unbound symbol: body-angle

  ```

### `part/turn` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (define f0 (facing 'hero)) (part/turn 'hero) (part/turn 'hero) (world/step) (world/step)
(display (eq? (facing 'hero) f0))
  ```
  Error:
  ```
  error: unbound symbol: facing

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-double-turn-identity dancers)
  ;; Each dancer: capture facing, double-turn, verify facing preserved.
  (map (lambda (d)
         (let ((f0 (facing d)))
           (part/turn d) (part/turn d)
           (world/step) (world/step)
           (eq? (facing d) f0)))
       dancers))
(test-d
  ```
  Error:
  ```
  error: unbound symbol: facing

  ```

### `part/twist` — file `48-part.slat`

- **row-2-audit** :cs-program
  ```scheme
  (define (segment-write rig angle)
  ;; twist writes only the upper-body segment of the rig
  (cons (cons 'upper angle) (assq-remove rig 'upper)))
(segment-write '((lower . 0)) 25)
  ```
  Error:
  ```
  error: unbound symbol: assq-remove

  ```
- **row-4-proof** :program
  ```scheme
  (define pos0 (hip-pos 'hero)) (part/twist 'hero '(angle 30 duration 400)) (world/step)
(display (equal? (hip-pos 'hero) pos0))
  ```
  Error:
  ```
  error: unbound symbol: hip-pos

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (twist-keeps-ground hero)
  (define pos0 (hip-pos hero))
  (part/twist hero '(angle 30 duration 400))
  (world/step)
  (display (equal? (hip-pos hero) pos0)))
(twist-keeps-ground 'hero)
  ```
  Error:
  ```
  error: unbound symbol: hip-pos

  ```

### `part/wave` — file `48-part.slat`

- **row-4-proof** :program
  ```scheme
  (part/wave 'hero) (world/step) (world/step) (world/step) (world/step)
(display (= 0 (arm-angle 'hero)))
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (test-return-across-mascots mascots)
  ;; Every mascot's arm at rest after wave cycle completes.
  (for-each (lambda (m) (part/wave m)) mascots)
  (world/step) (world/step) (world/step) (world/step)
  (map (lambda (m) (arm-angle m)) mascots))
(test-return-across-mascots '(mascot-lead mascot-
  ```
  Error:
  ```
  error: unbound symbol: arm-angle

  ```

### `phys/constant` — file `50-phys.slat`

- **row-2-audit** :program
  ```scheme
  (define h (phys/constant 'h))
(define c (phys/constant 'c))
(define m-e (phys/constant 'm-e))
(/ h (* m-e c))
  ```
  Error:
  ```
  error: phys/constant: unknown 'm-e'

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define h (phys/constant 'h))
(define c (phys/constant 'c))
(define m-e (phys/constant 'm-e))
(/ h (* m-e c))
  ```
  Error:
  ```
  error: phys/constant: unknown 'm-e'

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (rydberg-energy)
  (let ((m-e (phys/constant 'm-e))
        (e (phys/constant 'e))
        (eps-0 (phys/constant 'epsilon-0))
        (h (phys/constant 'h)))
    (/ (* m-e e e e e) (* 8 eps-0 eps-0 h h))))
(rydberg-energy)
  ```
  Error:
  ```
  error: phys/constant: unknown 'm-e'

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (rydberg-energy)
  (let ((m-e (phys/constant 'm-e))
        (e (phys/constant 'e))
        (eps-0 (phys/constant 'epsilon-0))
        (h (phys/constant 'h)))
    (/ (* m-e e e e e) (* 8 eps-0 eps-0 h h))))
(rydberg-energy)
  ```
  Error:
  ```
  error: phys/constant: unknown 'm-e'

  ```

### `phys/dimension` — file `50-phys.slat`

- **row-5-emergence** :math-composition
  ```scheme
  (define (group-by-dim qs)
  (let loop ((xs qs) (groups '()))
    (if (null? xs) groups
        (let* ((q (car xs)) (d (phys/dimension q))
               (found (assoc d groups)))
          (if found
              (begin (set-cdr! found (cons q (cdr found))) (loop (cdr xs) groups))
              (loo
  ```
  Error:
  ```
  error: unbound symbol: set-cdr!

  ```

### `phys/kinetic-energy` — file `50-phys.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (collision-energy m1 v1 m2 v2)
  (list (phys/kinetic-energy m1 v1)
        (phys/kinetic-energy m2 v2)))
(define (total-KE es) (apply phys/q+ es))
(total-KE (collision-energy '(1 . ((mass . 1))) '(10 . ((length . 1) (time . -1)))
                            '(1 . ((mass . 1))) '(-10 . ((leng
  ```
  Error:
  ```
  error: phys/q+: dimension mismatch

  ```

### `phys/nbody` — file `50-phys.slat`

- **row-2-audit** :program
  ```scheme
  (define bodies
  '((sun . ((mass . 1.989e30) (pos . (0 0 0)) (vel . (0 0 0))))
    (earth . ((mass . 5.972e24) (pos . (1.496e11 0 0)) (vel . (0 29780 0))))))
(phys/nbody bodies '(time-seconds 31536000))
  ```
  Error:
  ```
  error: b[1].slice is not a function

  ```
- **row-2-audit** :eng-program
  ```scheme
  (define bodies
  '((sun . ((mass . 1.989e30) (pos . (0 0 0)) (vel . (0 0 0))))
    (earth . ((mass . 5.972e24) (pos . (1.496e11 0 0)) (vel . (0 29780 0))))))
(phys/nbody bodies '(time-seconds 31536000))
  ```
  Error:
  ```
  error: b[1].slice is not a function

  ```
- **row-2-audit** :math-program
  ```scheme
  (define (total-momentum bodies)
  (let loop ((bs bodies) (px 0) (py 0))
    (if (null? bs) (list px py)
        (let* ((b (car bs))
               (m (cdr (assq 'mass (cdr b))))
               (v (cdr (assq 'vel (cdr b)))))
          (loop (cdr bs) (+ px (* m (car v))) (+ py (* m (cadr v))))))))
(to
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-2-audit** :cs-program
  ```scheme
  (define (submit-bodies bodies opts) (phys/nbody bodies opts))
(submit-bodies '((m1 . ((mass . 1) (pos . (0 0 0)) (vel . (0 0 0))))
                 (m2 . ((mass . 1) (pos . (10 0 0)) (vel . (0 5 0)))))
               '(time-seconds 60))
  ```
  Error:
  ```
  error: b[1].slice is not a function

  ```
- **row-4-proof** :program
  ```scheme
  (define (total-momentum bodies)
  (let loop ((bs bodies) (px 0) (py 0))
    (if (null? bs) (list px py)
        (let* ((b (car bs))
               (mass (cdr (assq 'mass (cdr b))))
               (vel (cdr (assq 'vel (cdr b)))))
          (loop (cdr bs) (+ px (* mass (car vel))) (+ py (* mass (cadr 
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-4-proof** :eng-program
  ```scheme
  (define (total-momentum bodies)
  (let loop ((bs bodies) (px 0) (py 0))
    (if (null? bs) (list px py)
        (let* ((b (car bs))
               (m (cdr (assq 'mass (cdr b))))
               (v (cdr (assq 'vel (cdr b)))))
          (loop (cdr bs) (+ px (* m (car v))) (+ py (* m (cadr v))))))))
(to
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (predict-future-earth years)
  (define solar-system
    '((sun . ((mass . 1.989e30) (pos . (0 0 0)) (vel . (0 0 0))))
      (earth . ((mass . 5.972e24) (pos . (1.496e11 0 0)) (vel . (0 29780 0))))))
  (phys/nbody solar-system (list 'time-seconds (* years 31536000))))
(predict-future-earth 10
  ```
  Error:
  ```
  error: b[1].slice is not a function

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (predict-future-earth years)
  (define solar-system
    '((sun . ((mass . 1.989e30) (pos . (0 0 0)) (vel . (0 0 0))))
      (earth . ((mass . 5.972e24) (pos . (1.496e11 0 0)) (vel . (0 29780 0))))))
  (phys/nbody solar-system (list 'time-seconds (* years 31536000))))
(predict-future-earth 10
  ```
  Error:
  ```
  error: b[1].slice is not a function

  ```
- **row-5-emergence** :math-composition
  ```scheme
  (define (energy-at-t bodies G)
  (let loop ((bs bodies) (e 0))
    (if (null? bs) e
        (let* ((b (car bs))
               (m (cdr (assq 'mass (cdr b))))
               (v (cdr (assq 'vel (cdr b)))))
          (loop (cdr bs) (+ e (* 0.5 m (car v) (car v))))))))
(energy-at-t '((a . ((mass . 1) (v
  ```
  Error:
  ```
  error: a.slice is not a function

  ```
- **row-5-emergence** :cs-composition
  ```scheme
  (define (nbody-pipeline bodies time-step post-fn)
  (let ((result (phys/nbody bodies (list 'time-seconds time-step))))
    (post-fn result)))
(nbody-pipeline '((m1 . ((mass . 1) (pos . (0 0 0)) (vel . (0 0 0))))
                  (m2 . ((mass . 1) (pos . (10 0 0)) (vel . (0 5 0)))))
                
  ```
  Error:
  ```
  error: b[1].slice is not a function

  ```

### `phys/q/` — file `50-phys.slat`

- **row-5-emergence** :composition
  ```scheme
  (define (acceleration v-final v-initial dt)
  (phys/q/ (phys/q+ v-final (phys/q* v-initial (phys/quantity -1.0 '()))) dt))
(acceleration (phys/quantity 20.0 '((length . 1) (time . -1)))
              (phys/quantity 10.0 '((length . 1) (time . -1)))
              (phys/quantity 2.0 '((time . 1))))
  ```
  Error:
  ```
  error: phys/q+: dimension mismatch

  ```
- **row-5-emergence** :eng-composition
  ```scheme
  (define (acceleration v-final v-initial dt)
  (phys/q/ (phys/q+ v-final (phys/q* v-initial '(-1.0 . ()))) dt))
(acceleration '(20.0 . ((length . 1) (time . -1)))
              '(10.0 . ((length . 1) (time . -1)))
              '(2.0 . ((time . 1))))
  ```
  Error:
  ```
  error: phys/q+: dimension mismatch

  ```

### `plot/bar` — file `51-plot.slat`

- **row-5-emergence** :cs-composition
  ```scheme
  (define (top-k labels values k)
  ;; Take top-k by value then plot.
  (let* ((paired (map cons labels values))
         (sorted (list-sort (lambda (p q) (> (cdr p) (cdr q))) paired))
         (top (list-head sorted (min k (length sorted)))))
    (plot/bar (map car top) (map cdr top))))
(top-k '(a b 
  ```
  Error:
  ```
  error: unbound symbol: list-sort

  ```

### `plot/function` — file `51-plot.slat`

- **row-4-proof** :cs-program
  ```scheme
  (define (finite-outputs-only? f dom)
  ;; Verify all sampled outputs are finite (or explicitly break-handled).
  (zero? (break-count f dom)))
(finite-outputs-only? (lambda (x) (* x x)) '(-1 1))
  ```
  Error:
  ```
  error: unbound symbol: break-count

  ```

... and 8 more verbs with failures.

## Verdict

✗ 483 FAILURES. Fix pass required before fold. See per-verb section above for intent (verb name + row + field).
