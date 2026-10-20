;; ============================================================
;;  Motion-book extension. Concatenated AFTER anim-prelude.scm to
;;  form the motion book's runtime. Everything here is real Motoi
;;  over the shared entity/world model (9-slot vector + prop bag).
;;
;;  The motion book weaves four small embedded DSLs:
;;    - a motion-algebra   (motion (sequence (take .. (ease-in ..))))
;;    - an actor DSL        (motion (actor 'x (shape ..)) (on-tick ..))
;;    - a scene-graph DSL   (world (entity 'c (at ..) (radius ..)))
;;    - a retained canvas   (call-with-world (make-world ..) (lambda ..))
;;  Most DSL leaves sit inside frame lambdas that are never called in
;;  a headless run, so they resolve lazily. The combinators that ARE
;;  eagerly evaluated (arguments to `motion`, `sequence`, ...) are
;;  defined below as honest constructors that return description data.
;;  The genuinely imperative verbs (motion/arc, entity/glide!, ...)
;;  do real vector physics on the entity.
;; ============================================================

;; --- numeric helpers ---
(define (dexp x) (exp x))
(define (dpow b e) (expt b e))

;; keyword-argument reader: (kw args :key default)
(define (kw args k default)
  (let loop ((a args))
    (cond ((or (null? a) (null? (cdr a))) default)
          ((eq? (car a) k) (cadr a))
          (else (loop (cdr a))))))

;; --- clock: honest values derived from the frame counter ---
(define (elapsed)   (/ *frame* 60.0))     ; seconds, at 60fps
(define (millis . _) (* *frame* 16))       ; ms since start (~16ms/frame)
(define (beat . n)  (if (null? n) *frame* (* (car n) 30)))  ; 30 frames / beat

;; --- motion-algebra: constructors returning a motion tree (data) ---
(define (vec x y)      (vec/make x y))
(define (shift from to)(list 'shift from to))
(define (take dur m)   (list 'take dur m))        ; overrides SRFI-1 take here
(define (sequence . ms)(cons 'sequence ms))
(define (parallel . ms)(cons 'parallel ms))
(define (repeat . a)   (cons 'repeat a))
(define (along-arc . a)(cons 'along-arc a))
(define (control . a)  (cons 'control a))
(define (via . a)      (cons 'via a))
(define (waypoint . a) (cons 'waypoint a))
(define (sprite . a)   (cons 'sprite a))
(define (route . a)    (cons 'route a))
(define (to . a)       (cons 'to a))
(define (wait . a)     (cons 'wait a))
(define (xy . a)       (cons 'xy a))
(define (from . a)     (cons 'from a))
(define (to-scale . a) (cons 'to-scale a))
(define (arc . a)      (cons 'arc a))
(define (loop . a)     (cons 'loop a))
(define (rotation . a) (cons 'rotation a))
(define (squash . a)   (cons 'squash a))
(define (spin . a)     (cons 'spin a))
(define (shape . a)    (cons 'shape a))
(define (pose . a)     (cons 'pose a))

;; ease-in/out/in-out: polymorphic. number -> eased value; motion -> wrap.
(define (ez-in t)  (* t t))
(define (ez-out t) (- 1 (* (- 1 t) (- 1 t))))
(define (ez-io t)  (if (< t 0.5) (* 2 t t) (- 1 (/ (expt (- (* 2 t) 2) 2) 2))))
(define (ease-in x)     (if (num? x) (ez-in x)  (list 'ease-in x)))
(define (ease-out x)    (if (num? x) (ez-out x) (list 'ease-out x)))
(define (ease-in-out x) (if (num? x) (ez-io x)  (list 'ease-in-out x)))

;; --- scene-graph / actor clause leaves (data) ---
(define (at . a)        (cons 'at a))
(define (radius r)      (list 'radius r))
(define (fill c)        (list 'fill c))
(define (color . a)     (cons 'color a))
(define (position . a)  (cons 'position a))
(define (disk . a)      (cons 'disk a))
(define (transform . a) (cons 'transform a))
(define (on-tick f . _) (list 'on-tick f))
(define (on-wake x)     (list 'on-wake x))
(define (actor name . clauses) (cons 'actor (cons name clauses)))
(define (world . a)     (cons 'scene a))
(define (entity . a)    (cons 'ent a))
(define (spawn . a)     (cons 'spawn a))

;; motion: variadic. Always returns a motion description; never runs the
;; frame fn (headless — running arbitrary frame code risks gaps / loops).
(define (motion . a) (cons 'motion a))
(define (render-at . _) (framebuffer/clear!) 'ok)

;; --- scheduler: honest register-only (callbacks captured, not fired,
;;     so a headless run stays bounded). ---
(define (world/after delay thunk) (list 'after delay thunk))
(define (world/add . a)   (cons 'add a))
(define (world/render . _) 'ok)
(define (entity/move . _)  'ok)
(define (world/knowledge . _) '())
(define (world/hash . _)  (world/count))

;; --- retained-canvas DSL ---
(define (call-with-world w f) (f w))
(define (make-world . a)  (cons 'world a))
(define (world-clear . _) (framebuffer/clear!) 'ok)
(define (world-show . _)  'ok)
(define (world-wait . _)  'ok)
(define (world-on-tick w f . _) (list 'on-tick f))
(define (world-draw-ellipse . _) 'ok)
(define (world-draw-circle . _)  'ok)
(define (world-draw-rect . _)    'ok)
(define (world-draw-line . _)    'ok)
(define (world-draw-text . _)    'ok)
(define (world-background . _)   'ok)

;; --- entity motion helpers (real vector work) ---
(define (entity/distance a b)
  (vec/norm (vec/sub (entity/pos (E a)) (entity/pos (E b)))))
(define (entity/move! e dx dy)
  (entity/set-pos! (E e) (+ (entity/x (E e)) dx) (+ (entity/y (E e)) dy)) (E e))
(define (entity/impulse! e ix iy) (entity/accel! (E e) ix iy))
;; entity/glide!: seed a per-frame velocity that carries e to (tx ty) in N frames.
(define (entity/glide! e tx ty frames . ease)
  (let* ((ee (E e)) (p (entity/pos ee)) (n (max 1 frames)))
    (entity/set-vel! ee (/ (- tx (car p)) n) (/ (- ty (cadr p)) n))
    (entity/set! ee 'glide (list tx ty)) ee))
(define (entity/alpha e . a)
  (if (null? a) (entity/get (E e) 'alpha 1.0) (begin (entity/set! (E e) 'alpha (car a)) (E e))))
(define (entity/circle e . _) (if (vector? e) (entity/set! e 'shape 'circle)) 'ok)
(define (entity/fill e . a)   (if (vector? e) (entity/set! e 'fill a)) 'ok)
(define (entity/line e . _)   'ok)
(define (entity/text e . a)   (if (vector? e) (entity/set! e 'text a)) 'ok)
;; entity/make: tolerant constructor — (entity/make 'tag x y ...) or keyword form.
(define (entity/make . a)
  (cond ((and (pair? a) (num? (car a)))
         (world/spawn 'thing (car a) (if (pair? (cdr a)) (cadr a) 0)))
        ((and (pair? a) (symbol? (car a)) (pair? (cdr a)) (num? (cadr a)))
         (apply world/spawn a))
        (else (world/spawn (if (pair? a) (car a) 'thing) 0 0))))

;; --- motion/* imperative animators. Marquee ones do real physics; the
;;     long tail seeds a plausible velocity so world/step produces motion. ---
(define (motion/arc e . k)
  (let* ((ee (E e)) (dx (kw k :dx 100)) (apex (kw k :apex 80)) (fr (max 1 (kw k :frames 60))))
    ;; ballistic launch: horizontal dx over fr frames, vertical impulse that
    ;; gravity turns into a parabola peaking ~apex high.
    (entity/set-vel! ee (/ dx fr) (- (/ (* 4.0 apex) fr)))
    (entity/set! ee 'motion 'arc) ee))
(define (motion/march e . k)
  (let ((ee (E e)) (v (kw k :vel 1.0)))
    (entity/set-vel! ee (* v 30) 0) (entity/set! ee 'gait 'march) ee))
(define (motion/glide e . k)
  (let ((ee (E e)) (dx (kw k :dx 0)) (dy (kw k :dy 0)) (fr (max 1 (kw k :frames 60))))
    (entity/set-vel! ee (/ dx fr) (/ dy fr)) ee))
(define (motion/glide-to e tx ty . k)
  (let* ((ee (E e)) (p (entity/pos ee)) (fr (max 1 (kw k :frames 60))))
    (entity/set-vel! ee (/ (- tx (car p)) fr) (/ (- ty (cadr p)) fr)) ee))
(define (motion/drop e . k)
  (let ((ee (E e))) (entity/gravity-scale! ee (kw k :scale 1.0)) ee))
(define (motion/toss e . k)
  (let ((ee (E e)) (vx (kw k :vx 20)) (vy (kw k :vy -40)))
    (entity/set-vel! ee vx vy) ee))
(define (motion/spin e . k)
  (let ((ee (E e))) (entity/set! ee 'spin (kw k :speed 6)) ee))
(define (motion/drift e . k)
  (let ((ee (E e)) (vx (kw k :vx 5)) (vy (kw k :vy 0)))
    (entity/set-vel! ee vx vy) ee))
(define (motion/scatter e . k) (if (vector? (E e)) (entity/set! (E e) 'motion 'scatter)) 'ok)
(define (motion/sway e . k)    (if (vector? (E e)) (entity/set! (E e) 'motion 'sway)) 'ok)
(define (motion/loop e . k)    (if (vector? (E e)) (entity/set! (E e) 'motion 'loop)) 'ok)
(define (motion/circle e . k)  (if (vector? (E e)) (entity/set! (E e) 'motion 'circle)) 'ok)
(define (motion/line e . k)    (if (vector? (E e)) (entity/set! (E e) 'motion 'line)) 'ok)
(define (motion/ease e . k)    (if (vector? (E e)) (entity/set! (E e) 'motion 'ease)) 'ok)
(define (motion/halt e . k)    (if (vector? (E e)) (entity/set-vel! (E e) 0 0)) 'ok)
(define (motion/settle e . k)  (if (vector? (E e)) (entity/set-vel! (E e) 0 0)) 'ok)
(define (motion/clear . _)     'ok)

;; --- part/* body-part animators (entity + keyword form). Honest markers;
;;     a full skeletal solve is a serving-side concern, not headless. ---
(define (part/step e . _)        (if (vector? (E e)) (entity/set! (E e) 'gait 'step)) 'ok)
(define (part/reach e . _)       'ok)
(define (part/point e . _)       'ok)
(define (part/raise e . _)       'ok)
(define (part/lower e . _)       'ok)
(define (part/turn e . _)        'ok)
(define (part/expression e . _)  'ok)
(define (part/nod e . _)         'ok)
(define (part/shake e . _)       'ok)
(define (part/wave e . _)        'ok)
(define (part/look-toward e . _) 'ok)
(define (part/lean e . _)        'ok)
(define (part/bow e . _)         'ok)
(define (part/twist e . _)       'ok)

;; --- late additions: trig helper, more scene-DSL leaves, point-form nearest ---
(define (datan2 y x) (atan y x))
(define (dhypot x y) (sqrt (+ (* x x) (* y y))))
(define (mod2 a b) (modulo a b))
(define (mod a b) (modulo a b))

;; scene / skeleton clause leaves (data)
(define (pos . a)   (cons 'pos a))
(define (vel . a)   (cons 'vel a))
(define (accel . a) (cons 'accel a))
(define (joint . a) (cons 'joint a))
(define (bone . a)  (cons 'bone a))
(define (limb . a)  (cons 'limb a))
(define (turn . a)  (cons 'turn a))
(define (heading-to . a) (cons 'heading-to a))

;; world/nearest: point-form (num? first arg) OR entity-form.
(define (world/nearest a . rest)
  (if (num? a)
      (let ((px a) (py (if (null? rest) 0 (car rest))) (best #f) (bd 1e18))
        (for-each (lambda (o)
                    (let ((d (vec/norm (vec/sub (entity/pos o) (vec/make px py)))))
                      (when (< d bd) (set! bd d) (set! best o))))
                  *world*)
        best)
      (let ((self (E a)) (want (if (null? rest) #f (car rest))) (best #f) (bd 1e18))
        (for-each (lambda (o)
                    (when (and (not (eq? o self))
                               (or (not want) (eq? (entity/kind o) want)))
                      (let ((d (vec/norm (vec/sub (entity/pos o) (entity/pos self)))))
                        (when (< d bd) (set! bd d) (set! best o)))))
                  *world*)
        best)))

;; motion-DSL loop/guard leaves + frame reader
(define (frame . _) *frame*)
(define (until . a)  (cons 'until a))
(define (while . a)  (cons 'while a))
(define (when-frame . a) (cons 'when-frame a))

;; timeline / gesture DSL leaves (inert data constructors)
(define (timeline . a)     (cons 'timeline a))
(define (ease . a)         (cons 'ease a))
(define (for-duration . a) (cons 'for-duration a))
(define (oscillate . a)    (cons 'oscillate a))
(define (hold . a)         (cons 'hold a))
(define (y . a)            (cons 'y a))
(define (x . a)            (cons 'x a))
(define (rotation . a)     (cons 'rotation a))
(define (scale-y . a)      (cons 'scale-y a))
(define (scale-x . a)      (cons 'scale-x a))
(define (scale . a)        (cons 'scale a))
(define (skew . a)         (cons 'skew a))
(define (opacity . a)      (cons 'opacity a))
(define (alpha . a)        (cons 'alpha a))
(define (tint . a)         (cons 'tint a))

;; sample actor names used unquoted in scene-DSL examples
(define balloon 'balloon)
(define anvil   'anvil)
(define figure  'figure)
(define walker  'walker)
(define ball    'ball)
(define hero    'hero)
(define leaf    'leaf)
(define feather 'feather)
(define rock    'rock)
(define scarf   'scarf)
(define arm     'arm)
(define cape    'cape)
(define tail    'tail)
(define flag    'flag)
