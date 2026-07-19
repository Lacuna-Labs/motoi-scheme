# Motoi Reference Compliance Check — code runnability

Total code blocks checked: 4951
Passes: 3169
Failures: 1782
Skipped (marked :runs "spec-only"): 1644

Pass rate: 64.0%

## Failures — grouped by verb


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

### `audio-band` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-band 3)
  ```
  Error:
  ```
  error: unbound symbol: audio-band

  ```

### `audio-bands` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-bands)
  ```
  Error:
  ```
  error: unbound symbol: audio-bands

  ```

### `audio-bar-clock` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-bar-clock (audio-play 'song))
  ```
  Error:
  ```
  error: unbound symbol: audio-bar-clock

  ```

### `audio-beat?` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (when (audio-beat?) 'kick)
  ```
  Error:
  ```
  error: unbound symbol: audio-beat?

  ```

### `audio-bpm` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-bpm)
  ```
  Error:
  ```
  error: unbound symbol: audio-bpm

  ```

### `audio-halt` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-halt h)
  ```
  Error:
  ```
  error: unbound symbol: audio-halt

  ```

### `audio-master-volume` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-master-volume 0.5)
  ```
  Error:
  ```
  error: unbound symbol: audio-master-volume

  ```

### `audio-peak` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-peak)
  ```
  Error:
  ```
  error: unbound symbol: audio-peak

  ```

### `audio-perceptual-bands` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-perceptual-bands)
  ```
  Error:
  ```
  error: unbound symbol: audio-perceptual-bands

  ```

### `audio-play` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-play 'bg-loop)
  ```
  Error:
  ```
  error: unbound symbol: audio-play

  ```

### `audio-playing?` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-playing?)
  ```
  Error:
  ```
  error: unbound symbol: audio-playing?

  ```

### `audio-rms` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-rms)
  ```
  Error:
  ```
  error: unbound symbol: audio-rms

  ```

### `audio-tempo` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-tempo 160)
  ```
  Error:
  ```
  error: unbound symbol: audio-tempo

  ```

### `audio-time` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (audio-time)
  ```
  Error:
  ```
  error: unbound symbol: audio-time

  ```

### `big-bang` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (big-bang '(0 0) ...)
  ```
  Error:
  ```
  error: unbound symbol: ...

  ```

### `camera-bring-to-view` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (camera-bring-to-view)
  ```
  Error:
  ```
  error: unbound symbol: camera-bring-to-view

  ```

### `camera-export` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (camera-export)
  ```
  Error:
  ```
  error: unbound symbol: camera-export

  ```

### `camera-fit-all` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (camera-fit-all)
  ```
  Error:
  ```
  error: unbound symbol: camera-fit-all

  ```

### `camera-record` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (camera-record)
  ```
  Error:
  ```
  error: unbound symbol: camera-record

  ```

### `camera-scale` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (camera-scale)
  ```
  Error:
  ```
  error: unbound symbol: camera-scale

  ```

### `camera-tilt` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (camera-tilt)
  ```
  Error:
  ```
  error: unbound symbol: camera-tilt

  ```

### `camera-trace` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (camera-trace)
  ```
  Error:
  ```
  error: unbound symbol: camera-trace

  ```

### `display` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (display 'scoreboard f)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```
- **row-4-proof** :program
  ```scheme
  (display 'w f)
(display 'w f)
(display 'idempotent-if-same-args)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `escalate` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (escalate 'timeout)
  ```
  Error:
  ```
  error: escalate: timeout

  ```

### `grid-step-3state` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (grid-step-3state)
  ```
  Error:
  ```
  error: unbound symbol: grid-step-3state

  ```

### `grid-step-4state` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (grid-step-4state)
  ```
  Error:
  ```
  error: unbound symbol: grid-step-4state

  ```

### `grid-step-aged` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (grid-step-aged)
  ```
  Error:
  ```
  error: unbound symbol: grid-step-aged

  ```

### `input-may-i?` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (input-may-i?)
  ```
  Error:
  ```
  error: unbound symbol: input-may-i?

  ```

### `note-dots` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (note-dots 60 4 100)
  ```
  Error:
  ```
  error: unbound symbol: note-dots

  ```

### `note-place` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (note-place 60 4 100)
  ```
  Error:
  ```
  error: unbound symbol: note-place

  ```

### `note-place-at` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (note-place-at 60 4 100)
  ```
  Error:
  ```
  error: unbound symbol: note-place-at

  ```

### `note-release` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (note-release 60 4 100)
  ```
  Error:
  ```
  error: unbound symbol: note-release

  ```

### `note-strike` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (note-strike 60 4 100)
  ```
  Error:
  ```
  error: unbound symbol: note-strike

  ```

### `on-canvas-trace` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (on-canvas-trace f)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```
- **row-4-proof** :program
  ```scheme
  (on-canvas-trace f)
(on-canvas-trace f)
(display 'stable-registration)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `on-frame` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (on-frame f)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `on-key` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (on-key f)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `on-tick` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (on-tick f)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `sprites` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (sprites 'card ...)
  ```
  Error:
  ```
  error: unbound symbol: ...

  ```

### `stop-when` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (stop-when p)
  ```
  Error:
  ```
  error: unbound symbol: p

  ```

### `to-draw` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (to-draw f)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `with-seed` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (with-seed 42 f)
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `with-spacing` — file `01-core.slat`

- **row-3-dimension** :code
  ```scheme
  (with-spacing 10 ...)
  ```
  Error:
  ```
  error: unbound symbol: ...

  ```

### `ai/bt-force` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/bt-force 'success (ai/bt-action 'try))
  ```
  Error:
  ```
  error: unbound symbol: ai/bt-force

  ```

### `ai/bt-invert` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/bt-invert (ai/bt-condition 'in-cover?))
  ```
  Error:
  ```
  error: unbound symbol: ai/bt-invert

  ```
- **row-3-dimension** :code
  ```scheme
  (define (invert cmd) (list 'shell '! cmd))
(display (invert 'ping-succeeds)))
  ```
  Error:
  ```
  error: unexpected ) (line 2, col 34)

  ```

### `ai/bt-parallel` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/bt-parallel 2 'see? 'hear? 'smell?)
  ```
  Error:
  ```
  error: unbound symbol: ai/bt-parallel

  ```

### `ai/bt-tick` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/bt-tick tree 'entity)
  ```
  Error:
  ```
  error: unbound symbol: tree

  ```

### `ai/clear!` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/clear! grid 5 5)
  ```
  Error:
  ```
  error: unbound symbol: ai/clear!

  ```

### `ai/flock` — file `02-ai.slat`

- **row-2-audit** :program
  ```scheme
  (define (fly-all birds)
  (for-each (lambda (b) (ai/flock b 'bird 80 4.0)) birds))
(fly-all (list 'b1 'b2 'b3))
  ```
  Error:
  ```
  error: posns is not iterable

  ```
- **row-3-dimension** :code
  ```scheme
  (ai/flock 'bird 'flock 80 4.0)
  ```
  Error:
  ```
  error: posns is not iterable

  ```
- **row-5-emergence** :composition
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

### `ai/flow-at` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/flow-at field 5 5)
  ```
  Error:
  ```
  error: unbound symbol: ai/flow-at

  ```

### `ai/flow-field` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/flow-field grid 10 10)
  ```
  Error:
  ```
  error: unbound symbol: ai/flow-field

  ```

### `ai/follow-flow` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/follow-flow 'unit field 4.0)
  ```
  Error:
  ```
  error: unbound symbol: ai/follow-flow

  ```

### `ai/follow-path` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/follow-path 'g '((0 0) (10 10)) 2.0 4.0)
  ```
  Error:
  ```
  error: unbound symbol: ai/follow-path

  ```

### `ai/grid` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/grid 50 50)
  ```
  Error:
  ```
  error: unbound symbol: ai/grid

  ```

### `ai/max-force!` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/max-force! 4.0)
  ```
  Error:
  ```
  error: unbound symbol: ai/max-force!

  ```

### `ai/passable?` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/passable? grid 5 5)
  ```
  Error:
  ```
  error: unbound symbol: ai/passable?

  ```

### `ai/path` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/path grid 0 0 10 10)
  ```
  Error:
  ```
  error: unbound symbol: ai/path

  ```

### `ai/wall!` — file `02-ai.slat`

- **row-3-dimension** :code
  ```scheme
  (ai/wall! grid 5 5)
  ```
  Error:
  ```
  error: unbound symbol: ai/wall!

  ```
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

- **row-3-dimension** :code
  ```scheme
  (ai/waypoints grid '((0 0) (1 1)))
  ```
  Error:
  ```
  error: unbound symbol: ai/waypoints

  ```

### `alg/apply-symmetry` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (alg/apply-symmetry 1 (list 1 0))
  ```
  Error:
  ```
  error: unbound symbol: alg/apply-symmetry

  ```
- **row-3-dimension** :code
  ```scheme
  (scene/rotate stage (quarter-turn))
  ```
  Error:
  ```
  error: unbound symbol: scene/rotate

  ```
- **row-3-dimension** :code
  ```scheme
  (matrix/mul-vec R v)
  ```
  Error:
  ```
  error: unbound symbol: matrix/mul-vec

  ```

### `alg/center` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (alg/center (alg/dihedral 4))
  ```
  Error:
  ```
  error: unbound symbol: alg/center

  ```
- **row-3-dimension** :code
  ```scheme
  (input/quiet-listeners handlers)
  ```
  Error:
  ```
  error: unbound symbol: input/quiet-listeners

  ```
- **row-3-dimension** :code
  ```scheme
  (matrix/commutant M)
  ```
  Error:
  ```
  error: unbound symbol: matrix/commutant

  ```

### `alg/conjugacy-classes` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (alg/conjugacy-classes (alg/symmetric 4))
  ```
  Error:
  ```
  error: unbound symbol: alg/conjugacy-classes

  ```
- **row-3-dimension** :code
  ```scheme
  (collision/buckets space)
  ```
  Error:
  ```
  error: unbound symbol: collision/buckets

  ```
- **row-3-dimension** :code
  ```scheme
  (geom/homotopy-classes shape)
  ```
  Error:
  ```
  error: unbound symbol: geom/homotopy-classes

  ```

### `alg/cosets` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (alg/cosets G H)
  ```
  Error:
  ```
  error: unbound symbol: alg/cosets

  ```
- **row-3-dimension** :code
  ```scheme
  (grid/tile-plane tile-shape)
  ```
  Error:
  ```
  error: unbound symbol: grid/tile-plane

  ```
- **row-3-dimension** :code
  ```scheme
  (lattice/fundamental-domain L)
  ```
  Error:
  ```
  error: unbound symbol: lattice/fundamental-domain

  ```

### `alg/cycles->perm` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (alg/cycles->perm 5 '((0 3) (1 2 4)))
  ```
  Error:
  ```
  error: unbound symbol: alg/cycles->perm

  ```
- **row-3-dimension** :code
  ```scheme
  (animation/from-keys frames)
  ```
  Error:
  ```
  error: unbound symbol: animation/from-keys

  ```
- **row-3-dimension** :code
  ```scheme
  (matrix/from-coo triples)
  ```
  Error:
  ```
  error: unbound symbol: matrix/from-coo

  ```

### `alg/cyclic` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define C6 (alg/cyclic 6))
  ```
  Error:
  ```
  error: unbound symbol: alg/cyclic

  ```
- **row-3-dimension** :code
  ```scheme
  (beat/counter-mod 6)
  ```
  Error:
  ```
  error: unbound symbol: beat/counter-mod

  ```
- **row-3-dimension** :code
  ```scheme
  (modulo (+ a b) n)
  ```
  Error:
  ```
  error: unbound symbol: a

  ```

### `alg/dihedral` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define D5 (alg/dihedral 5))
  ```
  Error:
  ```
  error: unbound symbol: alg/dihedral

  ```
- **row-3-dimension** :code
  ```scheme
  (sprite/all-mirrors sp)
  ```
  Error:
  ```
  error: unbound symbol: sprite/all-mirrors

  ```
- **row-3-dimension** :code
  ```scheme
  D_n = ⟨r, s | r^n = s^2 = e, srs = r^-1⟩
  ```
  Error:
  ```
  error: unbound symbol: D_n

  ```

### `alg/direct-product` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define V (alg/direct-product (alg/cyclic 2) (alg/cyclic 2)))
  ```
  Error:
  ```
  error: unbound symbol: alg/direct-product

  ```
- **row-3-dimension** :code
  ```scheme
  (input/pair joy-a joy-b)
  ```
  Error:
  ```
  error: unbound symbol: input/pair

  ```
- **row-3-dimension** :code
  ```scheme
  G × H
  ```
  Error:
  ```
  error: unbound symbol: G

  ```

### `alg/element-order` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/cyclic 7))
  ```
  Error:
  ```
  error: unbound symbol: alg/cyclic

  ```
- **row-3-dimension** :code
  ```scheme
  (animation/loop-length clip)
  ```
  Error:
  ```
  error: unbound symbol: animation/loop-length

  ```
- **row-3-dimension** :code
  ```scheme
  ord(g) = min{k ≥ 1 : g^k = e}
  ```
  Error:
  ```
  error: unbound symbol: ord

  ```

### `alg/group-from-table` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/group-from-table '((0 1 2) (1 2 0) (2 0 1))))
  ```
  Error:
  ```
  error: unbound symbol: alg/group-from-table

  ```
- **row-3-dimension** :code
  ```scheme
  (sprite/atlas-from-table rows)
  ```
  Error:
  ```
  error: unbound symbol: sprite/atlas-from-table

  ```
- **row-3-dimension** :code
  ```scheme
  G defined by (i, j) ↦ i·j
  ```
  Error:
  ```
  error: unbound symbol: G

  ```

### `alg/identity` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/cyclic 6))
  ```
  Error:
  ```
  error: unbound symbol: alg/cyclic

  ```
- **row-3-dimension** :code
  ```scheme
  (scene/empty)
  ```
  Error:
  ```
  error: unbound symbol: scene/empty

  ```
- **row-3-dimension** :code
  ```scheme
  e ∈ M with e·x = x·e = x
  ```
  Error:
  ```
  error: unbound symbol: e

  ```

### `alg/image` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (input/reachable state actions)
  ```
  Error:
  ```
  error: unbound symbol: input/reachable

  ```
- **row-3-dimension** :code
  ```scheme
  im(φ) = {φ(g) : g ∈ G}
  ```
  Error:
  ```
  error: unbound symbol: im

  ```

### `alg/index` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/dihedral 4))
  ```
  Error:
  ```
  error: unbound symbol: alg/dihedral

  ```
- **row-3-dimension** :code
  ```scheme
  (scene/layer-ratio scene layer)
  ```
  Error:
  ```
  error: unbound symbol: scene/layer-ratio

  ```
- **row-3-dimension** :code
  ```scheme
  [G:H] = |G|/|H|
  ```
  Error:
  ```
  error: unbound symbol: [G:H]

  ```

### `alg/interval-vector` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (list (alg/interval-vector (alg/pcset (list 0 4 7)))
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```
- **row-3-dimension** :code
  ```scheme
  (color/interval-histogram px)
  ```
  Error:
  ```
  error: unbound symbol: color/interval-histogram

  ```
- **row-3-dimension** :code
  ```scheme
  ⟨ic_1, ic_2, ..., ic_6⟩
  ```
  Error:
  ```
  error: unbound symbol: ⟨ic_1,

  ```

### `alg/inverse` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/undo last-move)
  ```
  Error:
  ```
  error: unbound symbol: sprite/undo

  ```
- **row-3-dimension** :code
  ```scheme
  a·a^-1 = e
  ```
  Error:
  ```
  error: unbound symbol: a·a^-1

  ```

### `alg/invert` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (alg/invert (alg/pcset (list 0 4 7)))
  ```
  Error:
  ```
  error: unbound symbol: alg/invert

  ```
- **row-3-dimension** :code
  ```scheme
  (sprite/flip axis sp)
  ```
  Error:
  ```
  error: unbound symbol: sprite/flip

  ```
- **row-3-dimension** :code
  ```scheme
  I_k(p) = (k - p) mod 12
  ```
  Error:
  ```
  error: unbound symbol: I_k

  ```

### `alg/is-abelian?` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (list (alg/is-abelian? (alg/cyclic 8))
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```
- **row-3-dimension** :code
  ```scheme
  (fx/commutative? a b)
  ```
  Error:
  ```
  error: unbound symbol: fx/commutative?

  ```
- **row-3-dimension** :code
  ```scheme
  a·b = b·a ∀ a,b
  ```
  Error:
  ```
  error: unbound symbol: a·b

  ```

### `alg/is-field?` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (list (alg/is-field? 11) (alg/is-field? 12))
  ```
  Error:
  ```
  error: unbound symbol: alg/is-field?

  ```
- **row-3-dimension** :code
  ```scheme
  (color/alpha-invertible? px)
  ```
  Error:
  ```
  error: unbound symbol: color/alpha-invertible?

  ```
- **row-3-dimension** :code
  ```scheme
  n prime
  ```
  Error:
  ```
  error: unbound symbol: n

  ```

### `alg/is-group?` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/atlas-valid? atlas)
  ```
  Error:
  ```
  error: unbound symbol: sprite/atlas-valid?

  ```
- **row-3-dimension** :code
  ```scheme
  the group axioms
  ```
  Error:
  ```
  error: unbound symbol: the

  ```

### `alg/is-homomorphism?` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (collision/lift-sprite sp)
  ```
  Error:
  ```
  error: unbound symbol: collision/lift-sprite

  ```
- **row-3-dimension** :code
  ```scheme
  φ(a·b) = φ(a)·φ(b)
  ```
  Error:
  ```
  error: unbound symbol: φ

  ```

### `alg/is-isomorphic?` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define A (alg/direct-product (alg/cyclic 2) (alg/cyclic 3)))
  ```
  Error:
  ```
  error: unbound symbol: alg/direct-product

  ```
- **row-3-dimension** :code
  ```scheme
  (audio/patch-equivalent? p q)
  ```
  Error:
  ```
  error: unbound symbol: audio/patch-equivalent?

  ```
- **row-3-dimension** :code
  ```scheme
  A ≅ B
  ```
  Error:
  ```
  error: unbound symbol: A

  ```

### `alg/is-normal?` — file `03-alg.slat`

- **row-2-audit** :program
  ```scheme
  (define G (alg/symmetric 3))
(define A3 (filter (lambda (p) (even? (alg/perm-parity p))) (alg/op G)))
(alg/is-normal? G A3)
  ```
  Error:
  ```
  error: lst.filter is not a function

  ```
- **row-3-dimension** :code
  ```scheme
  (fx/preserves-layer? layer)
  ```
  Error:
  ```
  error: unbound symbol: fx/preserves-layer?

  ```
- **row-3-dimension** :code
  ```scheme
  gHg^-1 = H ∀ g
  ```
  Error:
  ```
  error: unbound symbol: gHg^-1

  ```

### `alg/kernel` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (input/no-op-inputs state)
  ```
  Error:
  ```
  error: unbound symbol: input/no-op-inputs

  ```
- **row-3-dimension** :code
  ```scheme
  ker(φ) = {g : φ(g) = e_H}
  ```
  Error:
  ```
  error: unbound symbol: ker

  ```

### `alg/normal-form` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (unicode/nfc s)
  ```
  Error:
  ```
  error: unbound symbol: unicode/nfc

  ```
- **row-3-dimension** :code
  ```scheme
  rotation-canonical(S)
  ```
  Error:
  ```
  error: unbound symbol: rotation-canonical

  ```

### `alg/nr-L` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/mirror-axis sp axis)
  ```
  Error:
  ```
  error: unbound symbol: sprite/mirror-axis

  ```
- **row-3-dimension** :code
  ```scheme
  L: T → T
  ```
  Error:
  ```
  error: unbound symbol: L:

  ```

### `alg/nr-P` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (mode/parallel-swap theme)
  ```
  Error:
  ```
  error: unbound symbol: mode/parallel-swap

  ```
- **row-3-dimension** :code
  ```scheme
  P: T → T
  ```
  Error:
  ```
  error: unbound symbol: P:

  ```

### `alg/nr-R` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (scene/relative-key-shift stage)
  ```
  Error:
  ```
  error: unbound symbol: scene/relative-key-shift

  ```
- **row-3-dimension** :code
  ```scheme
  R: T → T
  ```
  Error:
  ```
  error: unbound symbol: R:

  ```

### `alg/op` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/cyclic 5))
  ```
  Error:
  ```
  error: unbound symbol: alg/cyclic

  ```
- **row-3-dimension** :code
  ```scheme
  (sprite/overlay a b)
  ```
  Error:
  ```
  error: unbound symbol: sprite/overlay

  ```
- **row-3-dimension** :code
  ```scheme
  (g, h) ↦ g·h
  ```
  Error:
  ```
  error: unbound symbol: g,

  ```

### `alg/orbit` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define D4 (alg/dihedral 4))
  ```
  Error:
  ```
  error: unbound symbol: alg/dihedral

  ```
- **row-3-dimension** :code
  ```scheme
  (sprite/all-symmetric-copies sp)
  ```
  Error:
  ```
  error: unbound symbol: sprite/all-symmetric-copies

  ```
- **row-3-dimension** :code
  ```scheme
  G·x = {g·x : g ∈ G}
  ```
  Error:
  ```
  error: unbound symbol: G·x

  ```

### `alg/order` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/dihedral 5))
  ```
  Error:
  ```
  error: unbound symbol: alg/dihedral

  ```
- **row-3-dimension** :code
  ```scheme
  (scene/sprite-count stage)
  ```
  Error:
  ```
  error: unbound symbol: scene/sprite-count

  ```
- **row-3-dimension** :code
  ```scheme
  |X|
  ```
  Error:
  ```
  error: unbound symbol: |X|

  ```

### `alg/pcset` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (hash/canon key)
  ```
  Error:
  ```
  error: unbound symbol: hash/canon

  ```
- **row-3-dimension** :code
  ```scheme
  Z → Z/12Z
  ```
  Error:
  ```
  error: unbound symbol: Z

  ```

### `alg/perm` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/remap-indices arr)
  ```
  Error:
  ```
  error: unbound symbol: sprite/remap-indices

  ```
- **row-3-dimension** :code
  ```scheme
  π: {0,...,n-1} → {0,...,n-1}
  ```
  Error:
  ```
  error: unbound symbol: π:

  ```

### `alg/perm->cycles` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (graph/scc adj)
  ```
  Error:
  ```
  error: unbound symbol: graph/scc

  ```
- **row-3-dimension** :code
  ```scheme
  σ = ∏ c_i
  ```
  Error:
  ```
  error: unbound symbol: σ

  ```

### `alg/perm-apply` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (hash/get h key)
  ```
  Error:
  ```
  error: unbound symbol: hash/get

  ```
- **row-3-dimension** :code
  ```scheme
  σ(i)
  ```
  Error:
  ```
  error: unbound symbol: σ

  ```

### `alg/perm-compose` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/overlay t1 t2)
  ```
  Error:
  ```
  error: unbound symbol: sprite/overlay

  ```
- **row-3-dimension** :code
  ```scheme
  σ ∘ τ
  ```
  Error:
  ```
  error: unbound symbol: σ

  ```

### `alg/perm-conjugate` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/rebasis t new-frame)
  ```
  Error:
  ```
  error: unbound symbol: sprite/rebasis

  ```
- **row-3-dimension** :code
  ```scheme
  x σ x^-1
  ```
  Error:
  ```
  error: unbound symbol: x

  ```

### `alg/perm-identity` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/empty-frame)
  ```
  Error:
  ```
  error: unbound symbol: sprite/empty-frame

  ```
- **row-3-dimension** :code
  ```scheme
  e(i) = i
  ```
  Error:
  ```
  error: unbound symbol: e

  ```
- **row-5-emergence** :composition
  ```scheme
  (define seed (alg/perm-identity 4))
(define moves (list (alg/perm (list 1 0 2 3)) (alg/perm (list 0 2 1 3))))
(foldl (lambda (m acc) (alg/perm-compose acc m)) seed moves)
  ```
  Error:
  ```
  error: unbound symbol: foldl

  ```

### `alg/perm-inverse` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (animation/reverse clip)
  ```
  Error:
  ```
  error: unbound symbol: animation/reverse

  ```
- **row-3-dimension** :code
  ```scheme
  σ^-1
  ```
  Error:
  ```
  error: unbound symbol: σ^-1

  ```

### `alg/perm-order` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (animation/period clip)
  ```
  Error:
  ```
  error: unbound symbol: animation/period

  ```
- **row-3-dimension** :code
  ```scheme
  ord(σ) = lcm(|c_i|)
  ```
  Error:
  ```
  error: unbound symbol: ord

  ```

### `alg/perm-parity` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (scene/mirror-count-parity stack)
  ```
  Error:
  ```
  error: unbound symbol: scene/mirror-count-parity

  ```
- **row-3-dimension** :code
  ```scheme
  sgn: S_n → {±1}
  ```
  Error:
  ```
  error: unbound symbol: sgn:

  ```
- **row-5-emergence** :composition
  ```scheme
  (define S4 (alg/symmetric 4))
(define A4 (filter (lambda (p) (even? (alg/perm-parity p))) (alg/op S4)))
(length A4)
  ```
  Error:
  ```
  error: lst.filter is not a function

  ```

### `alg/perm-pow` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (animation/frame-at clip k)
  ```
  Error:
  ```
  error: unbound symbol: animation/frame-at

  ```
- **row-3-dimension** :code
  ```scheme
  σ^k
  ```
  Error:
  ```
  error: unbound symbol: σ^k

  ```

### `alg/perm-sign` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (geom/signed-area a b c)
  ```
  Error:
  ```
  error: unbound symbol: geom/signed-area

  ```
- **row-3-dimension** :code
  ```scheme
  sgn(σ) = (-1)^{parity(σ)}
  ```
  Error:
  ```
  error: unbound symbol: sgn

  ```
- **row-5-emergence** :composition
  ```scheme
  (define S3 (alg/symmetric 3))
(define signs (map alg/perm-sign (alg/op S3)))
signs
  ```
  Error:
  ```
  error: lists[0].map is not a function

  ```

### `alg/perm-support` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/frame-diff a b)
  ```
  Error:
  ```
  error: unbound symbol: sprite/frame-diff

  ```
- **row-3-dimension** :code
  ```scheme
  supp(σ) = {i : σ(i) ≠ i}
  ```
  Error:
  ```
  error: unbound symbol: supp

  ```

### `alg/poly-add` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/mix-samples w1 w2)
  ```
  Error:
  ```
  error: unbound symbol: audio/mix-samples

  ```
- **row-3-dimension** :code
  ```scheme
  (f + g)(x) = f(x) + g(x) mod p
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `alg/poly-mul` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/conv wave impulse)
  ```
  Error:
  ```
  error: unbound symbol: audio/conv

  ```
- **row-3-dimension** :code
  ```scheme
  (fg)(x) = Σ f_i g_j x^{i+j} mod p
  ```
  Error:
  ```
  error: unbound symbol: fg

  ```

### `alg/prime-form` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (string/canonical-fold s)
  ```
  Error:
  ```
  error: unbound symbol: string/canonical-fold

  ```
- **row-3-dimension** :code
  ```scheme
  pf(S) = min under T/I action
  ```
  Error:
  ```
  error: unbound symbol: pf

  ```

### `alg/rosette` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/rotational-copies sp n)
  ```
  Error:
  ```
  error: unbound symbol: sprite/rotational-copies

  ```
- **row-3-dimension** :code
  ```scheme
  C_n
  ```
  Error:
  ```
  error: unbound symbol: C_n

  ```

### `alg/stabilizer` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define D4 (alg/dihedral 4))
  ```
  Error:
  ```
  error: unbound symbol: alg/dihedral

  ```
- **row-3-dimension** :code
  ```scheme
  (input/quiet-handlers event)
  ```
  Error:
  ```
  error: unbound symbol: input/quiet-handlers

  ```
- **row-3-dimension** :code
  ```scheme
  Stab_G(x) = {g : g·x = x}
  ```
  Error:
  ```
  error: unbound symbol: Stab_G

  ```

### `alg/subgroup-gen` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/dihedral 4))
  ```
  Error:
  ```
  error: unbound symbol: alg/dihedral

  ```
- **row-3-dimension** :code
  ```scheme
  (sprite/close-under-overlay set)
  ```
  Error:
  ```
  error: unbound symbol: sprite/close-under-overlay

  ```
- **row-3-dimension** :code
  ```scheme
  ⟨S⟩ = ∩{H ≤ G : S ⊆ H}
  ```
  Error:
  ```
  error: unbound symbol: ⟨S⟩

  ```

### `alg/subgroup?` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (define G (alg/cyclic 6))
  ```
  Error:
  ```
  error: unbound symbol: alg/cyclic

  ```
- **row-3-dimension** :code
  ```scheme
  (scene/closed-subset? sprites)
  ```
  Error:
  ```
  error: unbound symbol: scene/closed-subset?

  ```
- **row-3-dimension** :code
  ```scheme
  H ⊆ G, e ∈ H, a·b^-1 ∈ H
  ```
  Error:
  ```
  error: unbound symbol: H

  ```

### `alg/symmetric` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/all-permutations sprites)
  ```
  Error:
  ```
  error: unbound symbol: sprite/all-permutations

  ```
- **row-3-dimension** :code
  ```scheme
  S_n = Aut({1,...,n})
  ```
  Error:
  ```
  error: unbound symbol: S_n

  ```
- **row-5-emergence** :composition
  ```scheme
  (define S3 (alg/symmetric 3))
(define A3 (filter (lambda (p) (even? (alg/perm-parity p))) (alg/op S3)))
(length A3)
  ```
  Error:
  ```
  error: lst.filter is not a function

  ```

### `alg/symmetry-group` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/symmetries sp)
  ```
  Error:
  ```
  error: unbound symbol: sprite/symmetries

  ```
- **row-3-dimension** :code
  ```scheme
  Stab_{T/I}(S)
  ```
  Error:
  ```
  error: unbound symbol: Stab_{T/I}

  ```

### `alg/transpose` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (note/transpose-key clef n)
  ```
  Error:
  ```
  error: unbound symbol: note/transpose-key

  ```
- **row-3-dimension** :code
  ```scheme
  T_k(p) = (p + k) mod 12
  ```
  Error:
  ```
  error: unbound symbol: T_k

  ```

### `alg/triad` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (preset/instantiate 'major-triad)
  ```
  Error:
  ```
  error: unbound symbol: preset/instantiate

  ```
- **row-3-dimension** :code
  ```scheme
  {0, m3, m3+M3}
  ```
  Error:
  ```
  error: unbound symbol: {0,

  ```

### `alg/zn` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (hash/bucket-of key n-buckets)
  ```
  Error:
  ```
  error: unbound symbol: hash/bucket-of

  ```
- **row-3-dimension** :code
  ```scheme
  Z / nZ
  ```
  Error:
  ```
  error: unbound symbol: Z

  ```

### `alg/zn-add` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (beat/counter-mod n)
  ```
  Error:
  ```
  error: unbound symbol: beat/counter-mod

  ```
- **row-3-dimension** :code
  ```scheme
  (a + b) mod n
  ```
  Error:
  ```
  error: unbound symbol: a

  ```

### `alg/zn-inverse` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (color/inverse-scale a bits)
  ```
  Error:
  ```
  error: unbound symbol: color/inverse-scale

  ```
- **row-3-dimension** :code
  ```scheme
  a^-1 mod n
  ```
  Error:
  ```
  error: unbound symbol: a^-1

  ```

### `alg/zn-mul` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (color/mul-channel a b bits)
  ```
  Error:
  ```
  error: unbound symbol: color/mul-channel

  ```
- **row-3-dimension** :code
  ```scheme
  (a · b) mod n
  ```
  Error:
  ```
  error: unbound symbol: a

  ```

### `alg/zn-units` — file `03-alg.slat`

- **row-3-dimension** :code
  ```scheme
  (input/registered-handlers state)
  ```
  Error:
  ```
  error: unbound symbol: input/registered-handlers

  ```
- **row-3-dimension** :code
  ```scheme
  (Z/n)^× = {a : gcd(a, n) = 1}
  ```
  Error:
  ```
  error: unbound symbol: Z/n

  ```

### `animation/budget` — file `04-animation.slat`

- **row-3-dimension** :code
  ```scheme
  (if (> (tickets-remaining) 2) 'take-order 'stop-seating)
  ```
  Error:
  ```
  error: unbound symbol: tickets-remaining

  ```
- **row-3-dimension** :code
  ```scheme
  (if (> (sem-permits) 0) 'acquire 'wait)
  ```
  Error:
  ```
  error: unbound symbol: sem-permits

  ```

### `animation/reflow-policy` — file `04-animation.slat`

- **row-3-dimension** :code
  ```scheme
  (let ((mode (kitchen-mode))) (list 'ticket-under mode))
  ```
  Error:
  ```
  error: unbound symbol: kitchen-mode

  ```
- **row-3-dimension** :code
  ```scheme
  (let ((lvl (getenv "LOG_LEVEL"))) (list 'log-at lvl))
  ```
  Error:
  ```
  error: unbound symbol: getenv

  ```

### `animation/set-reflow-policy` — file `04-animation.slat`

- **row-3-dimension** :code
  ```scheme
  (set-traffic-light! 'north-south 'green)
  ```
  Error:
  ```
  error: unbound symbol: set-traffic-light!

  ```
- **row-3-dimension** :code
  ```scheme
  (register-set-msb! r #t)
  ```
  Error:
  ```
  error: unbound symbol: register-set-msb!

  ```

### `artifact/delete` — file `05-artifact.slat`

- **row-2-audit** :program
  ```scheme
  (define ctx '())
(define scratches (list 'scratch-a 'scratch-b 'scratch-c))
(define (delete-each ids)
  (cond ((null? ids) 'done)
        (else (artifact/delete (car ids))
              (delete-each (cdr ids)))))
(delete-each scratches)
(next 'await-delete-confirmations ctx)
  ```
  Error:
  ```
  error: unbound symbol: next

  ```

### `artifact/list` — file `05-artifact.slat`

- **row-2-audit** :program
  ```scheme
  (define ctx '())
(artifact/list '((kind . sketch)
                 (bot  . my-agent)
                 (limit . 10)))
(next 'await-list-results ctx)
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```
- **row-3-dimension** :code
  ```scheme
  (artifact/list '((kind . sketch) (limit . 10)))
  ```
  Error:
  ```
  error: [artifact] 'artifact/list' called in a headless env — install browser verbs from site/apps/hello-surface/artifact/verbs.js first (installArtifactVerbs).

  ```

### `artifact/save` — file `05-artifact.slat`

- **row-3-dimension** :code
  ```scheme
  (artifact/save `((kind . sketch) (payload . ,svg)))
  ```
  Error:
  ```
  error: unbound symbol: svg

  ```

### `assert/check-with` — file `06-assert.slat`

- **row-4-proof** :program
  ```scheme
  (define (id-check v) (assert/check-with number? v "num"))
(display (= (id-check 42) 42)) (newline)
(display (= (id-check (id-check (id-check 3.14))) 3.14)) (newline)
(display (eq? (id-check 'ok-value-but-wrong) 'unreachable))

  ```
  Error:
  ```
  #t
#t
error: assert/check-with: num ok-value-but-wrong

  ```

### `audio/bar-clock` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  ((audio/bar-clock (audio/play 'loop)) 'phase)
  ```
  Error:
  ```
  error: unbound symbol: audio/bar-clock

  ```

### `audio/halt` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (card-close 'my-card)
  ```
  Error:
  ```
  error: unbound symbol: card-close

  ```

### `audio/key` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/key)
  ```
  Error:
  ```
  error: unbound symbol: audio/key

  ```
- **row-3-dimension** :code
  ```scheme
  (audio/onset?)
  ```
  Error:
  ```
  error: unbound symbol: audio/onset?

  ```
- **row-3-dimension** :code
  ```scheme
  (define (sign r) (if (exact/< r (exact/rat 0 1)) 'neg 'pos))
(sign (exact/rat 3 1))
  ```
  Error:
  ```
  error: unbound symbol: exact/rat

  ```

### `audio/listen` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/listen)
  ```
  Error:
  ```
  error: unbound symbol: audio/listen

  ```

### `audio/lufs` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/lufs)
  ```
  Error:
  ```
  error: unbound symbol: audio/lufs

  ```

### `audio/master-volume` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (surface/curtain 0.5)
  ```
  Error:
  ```
  error: unbound symbol: surface/curtain

  ```

### `audio/onset-strength` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/onset-strength)
  ```
  Error:
  ```
  error: unbound symbol: audio/onset-strength

  ```

### `audio/onset?` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/onset?)
  ```
  Error:
  ```
  error: unbound symbol: audio/onset?

  ```

### `audio/spectrum` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/spectrum)
  ```
  Error:
  ```
  error: unbound symbol: audio/spectrum

  ```

### `audio/transcribe-with-cloud-help` — file `07-audio.slat`

- **row-3-dimension** :code
  ```scheme
  (audio/transcribe-with-cloud-help)
  ```
  Error:
  ```
  error: unbound symbol: audio/transcribe-with-cloud-help

  ```
- **row-3-dimension** :code
  ```scheme
  (synth/load-score 'beethoven)
  ```
  Error:
  ```
  error: unbound symbol: synth/load-score

  ```

### `bytevector-copy` — file `10-bytevector.slat`

- **row-3-dimension** :code
  ```scheme
  (sprite/rasterize (sprite/frame 'walker 3))
  ```
  Error:
  ```
  error: unbound symbol: sprite/frame

  ```

### `bytevector-u8-set!` — file `10-bytevector.slat`

- **row-3-dimension** :code
  ```scheme
  (fb/pixel 10 20 'red)
  ```
  Error:
  ```
  error: unbound symbol: fb/pixel

  ```

### `make-bytevector` — file `10-bytevector.slat`

- **row-3-dimension** :code
  ```scheme
  (fb/rect 0 0 320 240 'black)
  ```
  Error:
  ```
  error: unbound symbol: fb/rect

  ```

### `utf8->string` — file `10-bytevector.slat`

- **row-3-dimension** :code
  ```scheme
  (let ((bytes (make-bytevector 32 128))) (audio/spectrum))
  ```
  Error:
  ```
  error: unbound symbol: audio/spectrum

  ```

### `calc/arc-length` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/arc-length (lambda (x) (* x x)) 0 1)
  ```
  Error:
  ```
  error: unbound symbol: calc/arc-length

  ```
- **row-3-dimension** :code
  ```scheme
  (curve/pixel-length spline)
  ```
  Error:
  ```
  error: unbound symbol: curve/pixel-length

  ```
- **row-3-dimension** :code
  ```scheme
  ∫_a^b √(1 + f\'(x)^2) dx
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 15)

  ```

### `calc/arc-length-param` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/arc-length-param (lambda (t) (cos t)) (lambda (t) (sin t)) 0 (/ 3.14159 2))
  ```
  Error:
  ```
  error: unbound symbol: calc/arc-length-param

  ```
- **row-3-dimension** :code
  ```scheme
  (motion/total-distance path)
  ```
  Error:
  ```
  error: unbound symbol: motion/total-distance

  ```
- **row-3-dimension** :code
  ```scheme
  ∫_a^b √(x\'(t)^2 + y\'(t)^2) dt
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 11)

  ```

### `calc/average-value` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/average-value (lambda (x) (* x x)) 0 1)
  ```
  Error:
  ```
  error: unbound symbol: calc/average-value

  ```
- **row-3-dimension** :code
  ```scheme
  (audio/mean-level window)
  ```
  Error:
  ```
  error: unbound symbol: audio/mean-level

  ```
- **row-3-dimension** :code
  ```scheme
  (1/(b-a)) ∫_a^b f(x) dx
  ```
  Error:
  ```
  error: unbound symbol: 1/

  ```

### `calc/continuous?` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (list (calc/continuous? (lambda (x) x) 0 1)
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```
- **row-3-dimension** :code
  ```scheme
  (audio/no-click? window)
  ```
  Error:
  ```
  error: unbound symbol: audio/no-click?

  ```
- **row-3-dimension** :code
  ```scheme
  ∀ ε > 0 ∃ δ > 0. |x-y| < δ ⇒ |f(x)-f(y)| < ε
  ```
  Error:
  ```
  error: unbound symbol: ∀

  ```

### `calc/critical-points-1d` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/critical-points-1d (lambda (x) (- (* x x x) (* 3 x))) -3 3)
  ```
  Error:
  ```
  error: unbound symbol: calc/critical-points-1d

  ```
- **row-3-dimension** :code
  ```scheme
  (curve/flat-points spline)
  ```
  Error:
  ```
  error: unbound symbol: curve/flat-points

  ```
- **row-3-dimension** :code
  ```scheme
  {x : f\'(x) = 0}
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 8)

  ```

### `calc/curl` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/curl (lambda (p) (list (- (cadr p)) (car p))) (list 0 0))
  ```
  Error:
  ```
  error: unbound symbol: calc/curl

  ```
- **row-3-dimension** :code
  ```scheme
  (motion/vorticity field)
  ```
  Error:
  ```
  error: unbound symbol: motion/vorticity

  ```
- **row-3-dimension** :code
  ```scheme
  (∂F_2/∂x - ∂F_1/∂y)
  ```
  Error:
  ```
  error: unbound symbol: ∂F_2/∂x

  ```

### `calc/derivative` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (motion/velocity samples t)
  ```
  Error:
  ```
  error: unbound symbol: motion/velocity

  ```
- **row-3-dimension** :code
  ```scheme
  lim_{h→0} (f(x+h)-f(x))/h
  ```
  Error:
  ```
  error: unbound symbol: lim_{h→0}

  ```

### `calc/differentiable?` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (list (calc/differentiable? (lambda (x) x) 0 1)
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```
- **row-3-dimension** :code
  ```scheme
  (audio/smooth-window? win)
  ```
  Error:
  ```
  error: unbound symbol: audio/smooth-window?

  ```
- **row-3-dimension** :code
  ```scheme
  ∀ x ∈ [a, b]. lim_{h→0} (f(x+h)-f(x))/h exists
  ```
  Error:
  ```
  error: unbound symbol: ∀

  ```

### `calc/directional-derivative` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (terrain/slope-in-direction map p dir)
  ```
  Error:
  ```
  error: unbound symbol: terrain/slope-in-direction

  ```
- **row-3-dimension** :code
  ```scheme
  (∇f)(x) · v
  ```
  Error:
  ```
  error: unbound symbol: ∇f

  ```

### `calc/divergence` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/divergence (lambda (p) (list (car p) (cadr p))) (list 1 2))
  ```
  Error:
  ```
  error: unbound symbol: calc/divergence

  ```
- **row-3-dimension** :code
  ```scheme
  (motion/flux-out cell)
  ```
  Error:
  ```
  error: unbound symbol: motion/flux-out

  ```
- **row-3-dimension** :code
  ```scheme
  (∂F_1/∂x + ∂F_2/∂y)
  ```
  Error:
  ```
  error: unbound symbol: ∂F_1/∂x

  ```

### `calc/extrema-1d` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/extrema-1d (lambda (x) (* x x)) -2 2)
  ```
  Error:
  ```
  error: unbound symbol: calc/extrema-1d

  ```
- **row-3-dimension** :code
  ```scheme
  (image/scanline-extrema line)
  ```
  Error:
  ```
  error: unbound symbol: image/scanline-extrema

  ```
- **row-3-dimension** :code
  ```scheme
  attained at boundary or where f\' = 0
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 33)

  ```

### `calc/gradient` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (shader/normal-map p)
  ```
  Error:
  ```
  error: unbound symbol: shader/normal-map

  ```
- **row-3-dimension** :code
  ```scheme
  ∇f(x)
  ```
  Error:
  ```
  error: unbound symbol: ∇f

  ```

### `calc/hessian` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (terrain/local-curvature map p)
  ```
  Error:
  ```
  error: unbound symbol: terrain/local-curvature

  ```
- **row-3-dimension** :code
  ```scheme
  H_{ij} = ∂²f / ∂x_i ∂x_j
  ```
  Error:
  ```
  error: unbound symbol: H_{ij}

  ```

### `calc/integral` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/integral (lambda (x) (* x x)) 0 1)
  ```
  Error:
  ```
  error: unbound symbol: calc/integral

  ```
- **row-3-dimension** :code
  ```scheme
  (audio/window-energy w)
  ```
  Error:
  ```
  error: unbound symbol: audio/window-energy

  ```
- **row-3-dimension** :code
  ```scheme
  ∫_a^b f(x) dx
  ```
  Error:
  ```
  error: unbound symbol: ∫_a^b

  ```

### `calc/jacobian` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (shader/local-warp p)
  ```
  Error:
  ```
  error: unbound symbol: shader/local-warp

  ```
- **row-3-dimension** :code
  ```scheme
  J_{ij} = ∂f_i / ∂x_j
  ```
  Error:
  ```
  error: unbound symbol: J_{ij}

  ```

### `calc/laplacian` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/laplacian (lambda (p) (+ (* (car p) (car p)) (* (cadr p) (cadr p)))) (list 0 0))
  ```
  Error:
  ```
  error: unbound symbol: calc/laplacian

  ```
- **row-3-dimension** :code
  ```scheme
  (image/laplacian-blur img)
  ```
  Error:
  ```
  error: unbound symbol: image/laplacian-blur

  ```
- **row-3-dimension** :code
  ```scheme
  Δf = ∇·∇f
  ```
  Error:
  ```
  error: unbound symbol: Δf

  ```

### `calc/limit` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/limit (lambda (x) (/ (- (* x x) 1) (- x 1))) 1)
  ```
  Error:
  ```
  error: unbound symbol: calc/limit

  ```
- **row-3-dimension** :code
  ```scheme
  (math/fixed-point-limit f x0)
  ```
  Error:
  ```
  error: unbound symbol: math/fixed-point-limit

  ```
- **row-3-dimension** :code
  ```scheme
  ε-δ limit
  ```
  Error:
  ```
  error: unbound symbol: ε-δ

  ```

### `calc/line-integral` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (motion/work-along-path field path)
  ```
  Error:
  ```
  error: unbound symbol: motion/work-along-path

  ```
- **row-3-dimension** :code
  ```scheme
  ∫_a^b F(γ(t)) · γ\'(t) dt
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 19)

  ```

### `calc/newton` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/newton (lambda (x) (- (* x x) 2)) 1.5)
  ```
  Error:
  ```
  error: unbound symbol: calc/newton

  ```
- **row-3-dimension** :code
  ```scheme
  (motion/binary-search-root f)
  ```
  Error:
  ```
  error: unbound symbol: motion/binary-search-root

  ```
- **row-3-dimension** :code
  ```scheme
  x_{n+1} = x_n - f(x_n)/f\'(x_n)
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 26)

  ```

### `calc/partial` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (shader/dcolor-dc chan p)
  ```
  Error:
  ```
  error: unbound symbol: shader/dcolor-dc

  ```
- **row-3-dimension** :code
  ```scheme
  partial derivative
  ```
  Error:
  ```
  error: unbound symbol: partial

  ```

### `calc/radius-of-convergence` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/radius-of-convergence (lambda (n) (/ 1.0 (factorial n))))
  ```
  Error:
  ```
  error: unbound symbol: calc/radius-of-convergence

  ```
- **row-3-dimension** :code
  ```scheme
  (motion/trust-radius-of-approx approx)
  ```
  Error:
  ```
  error: unbound symbol: motion/trust-radius-of-approx

  ```
- **row-3-dimension** :code
  ```scheme
  Cauchy-Hadamard formula
  ```
  Error:
  ```
  error: unbound symbol: Cauchy-Hadamard

  ```

### `calc/riemann-sum` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/riemann-sum (lambda (x) (* x x)) 0 1 100)
  ```
  Error:
  ```
  error: unbound symbol: calc/riemann-sum

  ```
- **row-3-dimension** :code
  ```scheme
  (audio/rms samples)
  ```
  Error:
  ```
  error: unbound symbol: audio/rms

  ```
- **row-3-dimension** :code
  ```scheme
  Σ f(x_i) Δx_i
  ```
  Error:
  ```
  error: unbound symbol: Σ

  ```

### `calc/second-derivative` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (motion/acceleration samples t)
  ```
  Error:
  ```
  error: unbound symbol: motion/acceleration

  ```
- **row-3-dimension** :code
  ```scheme
  d²f/dx²
  ```
  Error:
  ```
  error: unbound symbol: d²f/dx²

  ```

### `calc/series-converges?` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (list (calc/series-converges? (lambda (n) (/ 1.0 (* n n))))
  ```
  Error:
  ```
  error: missing ) (line 1, col 1)

  ```
- **row-3-dimension** :code
  ```scheme
  (motion/effect-bounded? loop)
  ```
  Error:
  ```
  error: unbound symbol: motion/effect-bounded?

  ```
- **row-3-dimension** :code
  ```scheme
  lim_{N→∞} Σ_{n=1}^N a_n exists
  ```
  Error:
  ```
  error: unbound symbol: lim_{N→∞}

  ```

### `calc/surface-integral` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (render/light-through-mesh mesh)
  ```
  Error:
  ```
  error: unbound symbol: render/light-through-mesh

  ```
- **row-3-dimension** :code
  ```scheme
  ∫∫ F · (r_u × r_v) du dv
  ```
  Error:
  ```
  error: unbound symbol: ∫∫

  ```

### `calc/surface-revolution` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/surface-revolution (lambda (x) x) 0 1)
  ```
  Error:
  ```
  error: unbound symbol: calc/surface-revolution

  ```
- **row-3-dimension** :code
  ```scheme
  (mesh/lathe-area profile)
  ```
  Error:
  ```
  error: unbound symbol: mesh/lathe-area

  ```
- **row-3-dimension** :code
  ```scheme
  surface of revolution
  ```
  Error:
  ```
  error: unbound symbol: surface

  ```

### `calc/tangent-line` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (curve/tangent-at spline t)
  ```
  Error:
  ```
  error: unbound symbol: curve/tangent-at

  ```
- **row-3-dimension** :code
  ```scheme
  y = f\'(a)(x-a) + f(a)
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 7)

  ```

### `calc/taylor` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/taylor (lambda (x) (exp x)) 0 3)
  ```
  Error:
  ```
  error: unbound symbol: calc/taylor

  ```
- **row-3-dimension** :code
  ```scheme
  (motion/predict-order state n)
  ```
  Error:
  ```
  error: unbound symbol: motion/predict-order

  ```
- **row-3-dimension** :code
  ```scheme
  Taylor formula
  ```
  Error:
  ```
  error: unbound symbol: Taylor

  ```

### `calc/total-differential` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (sensor/error-propagate sensors deltas)
  ```
  Error:
  ```
  error: unbound symbol: sensor/error-propagate

  ```
- **row-3-dimension** :code
  ```scheme
  total differential
  ```
  Error:
  ```
  error: unbound symbol: total

  ```

### `calc/volume-revolution` — file `11-calc.slat`

- **row-3-dimension** :code
  ```scheme
  (calc/volume-revolution (lambda (x) x) 0 1)
  ```
  Error:
  ```
  error: unbound symbol: calc/volume-revolution

  ```
- **row-3-dimension** :code
  ```scheme
  (mesh/lathe-volume profile)
  ```
  Error:
  ```
  error: unbound symbol: mesh/lathe-volume

  ```
- **row-3-dimension** :code
  ```scheme
  disk method volume
  ```
  Error:
  ```
  error: unbound symbol: disk

  ```

### `char=?` — file `12-char.slat`

- **row-2-audit** :program
  ```scheme
  (define (delim? c) (char=? c "|"))
(let ((line "a|b|c")) (filter delim? (map string (string->list line))))
  ```
  Error:
  ```
  error: not a character #\a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (test-eq a b c) (and (char=? a a) (eq? (char=? a b) (char=? b a)) (if (and (char=? a b) (char=? b c)) (char=? a c) #t)))
(and (test-eq "a" "a" "a") (test-eq "a" "b" "c") (test-eq "x" "x" "x"))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (word<? w1 w2) (let loop ((a (string->list w1)) (b (string->list w2))) (cond ((null? a) (not (null? b))) ((null? b) #f) ((char<? (string (car a)) (string (car b))) #t) ((char<? (string (car b)) (string (car a))) #f) (else (loop (cdr a) (cdr b))))))
(word<? "apple" "apricot")
  ```
  Error:
  ```
  error: not a character #\a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (trichotomy a b) (let ((lt (char<? a b)) (gt (char<? b a)) (eq (char=? a b))) (= 1 (+ (if lt 1 0) (if gt 1 0) (if eq 1 0)))))
(and (trichotomy "a" "b") (trichotomy "b" "a") (trichotomy "a" "a") (not (char<? "a" "a")))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (higher-rank? new tenth) (char>? new tenth))
(higher-rank? "Z" "M")
  ```
  Error:
  ```
  error: not a character Z

  ```
- **row-3-dimension** :program
  ```scheme
  (define (converse a b) (eq? (char>? a b) (char<? b a)))
(and (converse "a" "b") (converse "b" "a") (converse "x" "x"))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (in-range? c lo hi) (and (char<=? lo c) (char<=? c hi)))
(in-range? "5" "0" "9")
  ```
  Error:
  ```
  error: not a character 0

  ```
- **row-3-dimension** :program
  ```scheme
  (define (test a b) (and (char<=? a a) (eq? (char<=? a b) (or (char<? a b) (char=? a b)))))
(and (test "a" "a") (test "a" "b") (test "b" "a"))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (from-c-onwards? c) (char>=? c "C"))
(map from-c-onwards? '("A" "B" "C" "D" "E" "F" "G"))
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :program
  ```scheme
  (define (test a b) (and (char>=? a a) (eq? (char>=? a b) (char<=? b a))))
(and (test "a" "a") (test "a" "b") (test "z" "a"))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (accept? c) (char-alphabetic? c))
(filter accept? (map string (string->list "A1b!C")))
  ```
  Error:
  ```
  error: not a character #\A

  ```
- **row-3-dimension** :program
  ```scheme
  (define (disjoint? c) (not (and (char-alphabetic? c) (char-numeric? c))))
(and (disjoint? "a") (disjoint? "5") (disjoint? " ") (disjoint? "Z"))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (digits-only s) (filter char-numeric? (map string (string->list s))))
(digits-only "score: 4287 pts")
  ```
  Error:
  ```
  error: not a character #\s

  ```
- **row-3-dimension** :program
  ```scheme
  (define (test) (and (map char-numeric? (map string (string->list "0123456789"))) (not (char-numeric? "a")) (not (char-numeric? " "))))
(equal? (map char-numeric? (list "0" "5" "9" "a" " ")) (list #t #t #t #f #f))
  ```
  Error:
  ```
  error: not a character 0

  ```
- **row-3-dimension** :program
  ```scheme
  (define (ltrim s) (let loop ((chars (map string (string->list s)))) (if (or (null? chars) (not (char-whitespace? (car chars)))) (apply string-append chars) (loop (cdr chars)))))
(ltrim "   hello")
  ```
  Error:
  ```
  error: not a character #\ 

  ```
- **row-3-dimension** :program
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
- **row-3-dimension** :program
  ```scheme
  (define (starts-upper? s) (and (> (string-length s) 0) (char-upper-case? (substring s 0 1))))
(starts-upper? "Alfred")
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :program
  ```scheme
  (define (test c) (let ((u (char-upper-case? c)) (l (char-lower-case? c)) (a (char-alphabetic? c))) (and (not (and u l)) (if a (or u l) (not (or u l))))))
(and (test "A") (test "a") (test "5") (test " "))
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :program
  ```scheme
  (define (canonical-tag? s) (let loop ((chars (map string (string->list s)))) (or (null? chars) (and (or (char-lower-case? (car chars)) (char-numeric? (car chars)) (char=? (car chars) "-")) (loop (cdr chars))))))
(canonical-tag? "scheme-book")
  ```
  Error:
  ```
  error: not a character #\s

  ```
- **row-3-dimension** :program
  ```scheme
  (define (test c) (eq? (char-lower-case? c) (and (char-alphabetic? c) (string=? c (char-downcase c)))))
(and (test "a") (test "A") (test "5") (test " "))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (bold-first s) (if (= (string-length s) 0) s (string-append (char-upcase (substring s 0 1)) (substring s 1 (string-length s)))))
(bold-first "start")
  ```
  Error:
  ```
  error: not a character s

  ```
- **row-3-dimension** :program
  ```scheme
  (define (idem? c) (string=? (char-upcase (char-upcase c)) (char-upcase c)))
(and (idem? "a") (idem? "A") (idem? "5") (idem? " "))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (norm-key s) (apply string-append (map char-downcase (map string (string->list s)))))
(let ((cache (make-hash-table))) (hash-table-set! cache (norm-key "Hello") 42) (hash-table-ref cache (norm-key "HELLO")))
  ```
  Error:
  ```
  error: not a character #\H

  ```
- **row-3-dimension** :program
  ```scheme
  (define (idem? c) (string=? (char-downcase (char-downcase c)) (char-downcase c)))
(define (result-lower? c) (let ((d (char-downcase c))) (or (not (char-alphabetic? d)) (char-lower-case? d))))
(and (idem? "A") (idem? "a") (result-lower? "Z") (result-lower? "5"))
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :program
  ```scheme
  (define (fold-str s) (apply string-append (map char-foldcase (map string (string->list s)))))
(equal? (fold-str "Rest") (fold-str "REST"))
  ```
  Error:
  ```
  error: not a character #\R

  ```
- **row-3-dimension** :program
  ```scheme
  (define (idem? c) (string=? (char-foldcase (char-foldcase c)) (char-foldcase c)))
(define (unify? a b) (string=? (char-foldcase a) (char-foldcase b)))
(and (idem? "A") (unify? "A" "a") (unify? "Z" "z") (not (unify? "a" "b")))
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :program
  ```scheme
  (define (naive-hash s) (let loop ((chars (map string (string->list s))) (h 5381)) (if (null? chars) h (loop (cdr chars) (+ (* 33 h) (char->integer (car chars)))))))
(naive-hash "Alfred")
  ```
  Error:
  ```
  error: not a character #\A

  ```
- **row-3-dimension** :program
  ```scheme
  (define (round-trip c) (string=? (integer->char (char->integer c)) c))
(and (round-trip "a") (round-trip "Z") (round-trip "5") (round-trip " "))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :program
  ```scheme
  (define (rand-letter) (integer->char (+ 65 (modulo (system/rand) 26))))
(rand-letter)
  ```
  Error:
  ```
  error: unbound symbol: system/rand

  ```
- **row-3-dimension** :program
  ```scheme
  (define (parse-nat s) (let loop ((chars (map string (string->list s))) (acc 0)) (cond ((null? chars) acc) ((digit-value (car chars)) => (lambda (d) (loop (cdr chars) (+ (* 10 acc) d)))) (else #f))))
(parse-nat "4287")
  ```
  Error:
  ```
  error: not a character #\4

  ```
- **row-3-dimension** :program
  ```scheme
  (define (test c expect) (equal? (digit-value c) expect))
(and (test "0" 0) (test "5" 5) (test "9" 9) (test "a" #f) (test " " #f))
  ```
  Error:
  ```
  error: not a character 0

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (count-char c s) (length (filter (lambda (x) (char=? x c)) (map string (string->list s)))))
(count-char "e" "eleven")
  ```
  Error:
  ```
  error: not a character #\e

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (sort-chars s) (let ((chars (map string (string->list s)))) (let loop ((rest chars) (acc '())) (if (null? rest) acc (let* ((pivot (car rest)) (smaller (filter (lambda (c) (char<? c pivot)) (cdr rest))) (larger (filter (lambda (c) (not (char<? c pivot))) (cdr rest)))) (append (loop smaller '(
  ```
  Error:
  ```
  error: not a character #\u

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (find-max-char s) (let loop ((chars (map string (string->list s))) (best #f)) (cond ((null? chars) best) ((or (not best) (char>? (car chars) best)) (loop (cdr chars) (car chars))) (else (loop (cdr chars) best)))))
(find-max-char "hello")
  ```
  Error:
  ```
  error: not a character #\e

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (all-lower? s) (let loop ((chars (map string (string->list s)))) (or (null? chars) (and (char<=? "a" (car chars)) (char<=? (car chars) "z") (loop (cdr chars))))))
(all-lower? "hello")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (any-upper? s) (let loop ((chars (map string (string->list s)))) (cond ((null? chars) #f) ((and (char>=? (car chars) "A") (char<=? (car chars) "Z")) #t) (else (loop (cdr chars))))))
(any-upper? "heLLo")
  ```
  Error:
  ```
  error: not a character #\h

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (parse-nat s) (let loop ((chars (map string (string->list s))) (acc 0)) (cond ((null? chars) acc) ((char-numeric? (car chars)) (loop (cdr chars) (+ (* 10 acc) (digit-value (car chars))))) (else #f))))
(parse-nat "4287")
  ```
  Error:
  ```
  error: not a character #\4

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (split-words s) (let loop ((chars (map string (string->list s))) (cur "") (acc '())) (cond ((null? chars) (reverse (if (string=? cur "") acc (cons cur acc)))) ((char-whitespace? (car chars)) (loop (cdr chars) "" (if (string=? cur "") acc (cons cur acc)))) (else (loop (cdr chars) (string-appe
  ```
  Error:
  ```
  error: not a character #\h

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (title-case? s) (let ((chars (map string (string->list s)))) (and (not (null? chars)) (char-upper-case? (car chars)) (let loop ((rest (cdr chars))) (or (null? rest) (and (char-lower-case? (car rest)) (loop (cdr rest))))))))
(title-case? "Motoi")
  ```
  Error:
  ```
  error: not a character #\M

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (screaming? s) (let ((letters (filter char-alphabetic? (map string (string->list s))))) (and (> (length letters) 3) (not (any (lambda (c) (char-lower-case? c)) letters)))))
(define (any p xs) (cond ((null? xs) #f) ((p (car xs)) #t) (else (any p (cdr xs)))))
(screaming? "HELLO WORLD")
  ```
  Error:
  ```
  error: not a character #\H

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (shout s) (apply string-append (map char-upcase (map string (string->list s)))))
(shout "help")
  ```
  Error:
  ```
  error: not a character #\h

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (ci-equal? s1 s2) (let ((n1 (map char-downcase (map string (string->list s1)))) (n2 (map char-downcase (map string (string->list s2))))) (equal? n1 n2)))
(ci-equal? "Hello" "HELLO")
  ```
  Error:
  ```
  error: not a character #\H

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (dedup-case-insensitive strs) (let loop ((rest strs) (seen '()) (acc '())) (cond ((null? rest) (reverse acc)) ((let ((k (apply string-append (map char-foldcase (map string (string->list (car rest))))))) (if (member k seen) #t #f)) (loop (cdr rest) seen acc)) (else (let ((k (apply string-appe
  ```
  Error:
  ```
  error: not a character #\R

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (caesar-shift c n) (let ((code (char->integer c))) (cond ((and (>= code 97) (<= code 122)) (integer->char (+ 97 (modulo (+ (- code 97) n) 26)))) ((and (>= code 65) (<= code 90)) (integer->char (+ 65 (modulo (+ (- code 65) n) 26)))) (else c))))
(caesar-shift "a" 3)
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :composition
  ```scheme
  (define (sum-digits s) (let loop ((chars (map string (string->list s))) (sum 0)) (cond ((null? chars) sum) ((digit-value (car chars)) => (lambda (d) (loop (cdr chars) (+ sum d)))) (else (loop (cdr chars) sum)))))
(sum-digits "a1b2c3")
  ```
  Error:
  ```
  error: not a character #\a

  ```
- **row-3-dimension** :code
  ```scheme
  (char=? "a" "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (let ((n1 (note/mk 60 100)) (n2 (note/mk 60 100))) (= (note/pitch n1) (note/pitch n2)))
  ```
  Error:
  ```
  error: unbound symbol: note/mk

  ```
- **row-3-dimension** :code
  ```scheme
  a ≡ b (mod ≡)
  ```
  Error:
  ```
  error: unbound symbol: a

  ```
- **row-3-dimension** :code
  ```scheme
  (char<? "a" "b")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char<? "a" "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char<? "a" "b")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (time/before? t1 t2)
  ```
  Error:
  ```
  error: unbound symbol: time/before?

  ```
- **row-3-dimension** :code
  ```scheme
  a < b in a total order (D, ≤)
  ```
  Error:
  ```
  error: unbound symbol: a

  ```
- **row-3-dimension** :code
  ```scheme
  (char>? "b" "a")
  ```
  Error:
  ```
  error: not a character b

  ```
- **row-3-dimension** :code
  ```scheme
  (char>? "a" "b")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char>? "z" "a")
  ```
  Error:
  ```
  error: not a character z

  ```
- **row-3-dimension** :code
  ```scheme
  (> (phys/velocity a) (phys/velocity b))
  ```
  Error:
  ```
  error: unbound symbol: phys/velocity

  ```
- **row-3-dimension** :code
  ```scheme
  a > b ⇔ b < a
  ```
  Error:
  ```
  error: unbound symbol: a

  ```
- **row-3-dimension** :code
  ```scheme
  (char<=? "a" "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char<=? "a" "b")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char<=? "a" "m")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (time/before-or-equal? t deadline)
  ```
  Error:
  ```
  error: unbound symbol: time/before-or-equal?

  ```
- **row-3-dimension** :code
  ```scheme
  x ∈ [a,b] iff a ≤ x ≤ b
  ```
  Error:
  ```
  error: unbound symbol: x

  ```
- **row-3-dimension** :code
  ```scheme
  (char>=? "b" "b")
  ```
  Error:
  ```
  error: not a character b

  ```
- **row-3-dimension** :code
  ```scheme
  (char>=? "b" "a")
  ```
  Error:
  ```
  error: not a character b

  ```
- **row-3-dimension** :code
  ```scheme
  (char>=? c "A")
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (>= (beat/count) 4)
  ```
  Error:
  ```
  error: unbound symbol: beat/count

  ```
- **row-3-dimension** :code
  ```scheme
  x ≥ a iff a ≤ x
  ```
  Error:
  ```
  error: unbound symbol: x

  ```
- **row-3-dimension** :code
  ```scheme
  (char-alphabetic? "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char-alphabetic? "5")
  ```
  Error:
  ```
  error: not a character 5

  ```
- **row-3-dimension** :code
  ```scheme
  (char-alphabetic? c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (chem/is-metal? element)
  ```
  Error:
  ```
  error: unbound symbol: chem/is-metal?

  ```
- **row-3-dimension** :code
  ```scheme
  x ∈ A
  ```
  Error:
  ```
  error: unbound symbol: x

  ```
- **row-3-dimension** :code
  ```scheme
  (char-numeric? "5")
  ```
  Error:
  ```
  error: not a character 5

  ```
- **row-3-dimension** :code
  ```scheme
  (char-numeric? "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char-numeric? c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (phys/is-integer-mass? m)
  ```
  Error:
  ```
  error: unbound symbol: phys/is-integer-mass?

  ```
- **row-3-dimension** :code
  ```scheme
  x ∈ D where D = {0..9}
  ```
  Error:
  ```
  error: unbound symbol: x

  ```
- **row-3-dimension** :code
  ```scheme
  (char-whitespace? " ")
  ```
  Error:
  ```
  error: not a character  

  ```
- **row-3-dimension** :code
  ```scheme
  (char-whitespace? "\t")
  ```
  Error:
  ```
  error: not a character 	

  ```
- **row-3-dimension** :code
  ```scheme
  (char-whitespace? c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (tick/is-idle-frame? f)
  ```
  Error:
  ```
  error: unbound symbol: tick/is-idle-frame?

  ```
- **row-3-dimension** :code
  ```scheme
  silence(t) = amp(t) < ε
  ```
  Error:
  ```
  error: unbound symbol: t

  ```
- **row-3-dimension** :code
  ```scheme
  (char-upper-case? "A")
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :code
  ```scheme
  (char-upper-case? "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char-upper-case? c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (note/is-natural? n)
  ```
  Error:
  ```
  error: unbound symbol: note/is-natural?

  ```
- **row-3-dimension** :code
  ```scheme
  x ∈ A_U ⊂ A
  ```
  Error:
  ```
  error: unbound symbol: x

  ```
- **row-3-dimension** :code
  ```scheme
  (char-lower-case? "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char-lower-case? "A")
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :code
  ```scheme
  (char-lower-case? c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (input/is-secondary-key? k)
  ```
  Error:
  ```
  error: unbound symbol: input/is-secondary-key?

  ```
- **row-3-dimension** :code
  ```scheme
  x ∈ A_L = A \ A_U
  ```
  Error:
  ```
  error: unbound symbol: x

  ```
- **row-3-dimension** :code
  ```scheme
  (char-upcase "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char-upcase "z")
  ```
  Error:
  ```
  error: not a character z

  ```
- **row-3-dimension** :code
  ```scheme
  (char-upcase c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (note/octave-up n)
  ```
  Error:
  ```
  error: unbound symbol: note/octave-up

  ```
- **row-3-dimension** :code
  ```scheme
  join(x, ⊤) — lift to top
  ```
  Error:
  ```
  error: unbound symbol: join

  ```
- **row-3-dimension** :code
  ```scheme
  (char-downcase "A")
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :code
  ```scheme
  (char-downcase "Z")
  ```
  Error:
  ```
  error: not a character Z

  ```
- **row-3-dimension** :code
  ```scheme
  (char-downcase c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (note/octave-down n)
  ```
  Error:
  ```
  error: unbound symbol: note/octave-down

  ```
- **row-3-dimension** :code
  ```scheme
  meet(x, ⊥) — descend to bottom
  ```
  Error:
  ```
  error: unbound symbol: meet

  ```
- **row-3-dimension** :code
  ```scheme
  (char-foldcase "A")
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :code
  ```scheme
  (char-foldcase "z")
  ```
  Error:
  ```
  error: not a character z

  ```
- **row-3-dimension** :code
  ```scheme
  (char-foldcase c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (geom/normalize-angle a) ; wrap to [0, 2π)
  ```
  Error:
  ```
  error: unbound symbol: geom/normalize-angle

  ```
- **row-3-dimension** :code
  ```scheme
  quotient map q: X → X/≡
  ```
  Error:
  ```
  error: unbound symbol: q:

  ```
- **row-3-dimension** :code
  ```scheme
  (char->integer "a")
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (char->integer "A")
  ```
  Error:
  ```
  error: not a character A

  ```
- **row-3-dimension** :code
  ```scheme
  (char->integer c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (entity/id e)
  ```
  Error:
  ```
  error: unbound symbol: entity/id

  ```
- **row-3-dimension** :code
  ```scheme
  ϕ: A ↪ ℤ (injective embedding)
  ```
  Error:
  ```
  error: unbound symbol: ϕ:

  ```
- **row-3-dimension** :code
  ```scheme
  (integer->char (+ (char->integer "a") 1))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-3-dimension** :code
  ```scheme
  (entity/by-id world 42)
  ```
  Error:
  ```
  error: unbound symbol: entity/by-id

  ```
- **row-3-dimension** :code
  ```scheme
  ϕ⁻¹: ℤ → A (partial inverse)
  ```
  Error:
  ```
  error: unbound symbol: ϕ⁻¹:

  ```
- **row-3-dimension** :code
  ```scheme
  (digit-value "5")
  ```
  Error:
  ```
  error: not a character 5

  ```
- **row-3-dimension** :code
  ```scheme
  (digit-value c)
  ```
  Error:
  ```
  error: unbound symbol: c

  ```
- **row-3-dimension** :code
  ```scheme
  (io/read-int-line line) ; returns #f on non-numeric line
  ```
  Error:
  ```
  error: unbound symbol: io/read-int-line

  ```
- **row-3-dimension** :code
  ```scheme
  f: A → Maybe B
  ```
  Error:
  ```
  error: unbound symbol: f:

  ```
- **row-4-proof** :program
  ```scheme
  (define (test-eq a b c) (and (char=? a a) (eq? (char=? a b) (char=? b a)) (if (and (char=? a b) (char=? b c)) (char=? a c) #t)))
(and (test-eq "a" "a" "a") (test-eq "a" "b" "c") (test-eq "x" "x" "x"))
  ```
  Error:
  ```
  error: not a character a

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (count-char c s) (length (filter (lambda (x) (char=? x c)) (map string (string->list s)))))
(count-char "e" "eleven")
  ```
  Error:
  ```
  error: not a character #\e

  ```

### `char?` — file `12-char.slat`

- **row-3-dimension** :code
  ```scheme
  (and (pair? xs) (null? (cdr xs)))
  ```
  Error:
  ```
  error: unbound symbol: xs

  ```
- **row-3-dimension** :code
  ```scheme
  |S| = 1 (S has cardinality one)
  ```
  Error:
  ```
  error: unbound symbol: |S|

  ```

### `chem/atomic-weight` — file `13-chem.slat`

- **row-3-dimension** :code
  ```scheme
  (chem/atomic-weight 'C)
  ```
  Error:
  ```
  error: unbound symbol: chem/atomic-weight

  ```
- **row-3-dimension** :code
  ```scheme
  (unit-factor 'mm 'in)
  ```
  Error:
  ```
  error: unbound symbol: unit-factor

  ```
- **row-3-dimension** :code
  ```scheme
  special_value('pi')
  ```
  Error:
  ```
  error: apostrophe (') inside identifier — Motoi uses ' as quote; rename the identifier (banker-s, banker_s) or use spaces (line 1, col 18)

  ```

### `chem/balance` — file `13-chem.slat`

- **row-3-dimension** :code
  ```scheme
  (chem/balance "H2 + O2 -> H2O")
  ```
  Error:
  ```
  error: unbound symbol: chem/balance

  ```
- **row-3-dimension** :code
  ```scheme
  (allocate 'workers 'shifts constraints)
  ```
  Error:
  ```
  error: unbound symbol: allocate

  ```
- **row-3-dimension** :code
  ```scheme
  solve Ax = 0 for integer x
  ```
  Error:
  ```
  error: unbound symbol: solve

  ```

### `chem/formula-counts` — file `13-chem.slat`

- **row-3-dimension** :code
  ```scheme
  (chem/formula-counts "H2O")
  ```
  Error:
  ```
  error: unbound symbol: chem/formula-counts

  ```
- **row-3-dimension** :code
  ```scheme
  (parse-date "2026-07-19")
  ```
  Error:
  ```
  error: unbound symbol: parse-date

  ```
- **row-3-dimension** :code
  ```scheme
  parse: String → AST
  ```
  Error:
  ```
  error: unbound symbol: parse:

  ```

### `chem/molar-mass` — file `13-chem.slat`

- **row-3-dimension** :code
  ```scheme
  (chem/molar-mass "H2O")
  ```
  Error:
  ```
  error: unbound symbol: chem/molar-mass

  ```
- **row-3-dimension** :code
  ```scheme
  (cart-total items) ; parse cart, look up prices, sum
  ```
  Error:
  ```
  error: unbound symbol: cart-total

  ```
- **row-3-dimension** :code
  ```scheme
  L(x) = Σ aᵢxᵢ
  ```
  Error:
  ```
  error: unbound symbol: L

  ```

### `chem/moles` — file `13-chem.slat`

- **row-3-dimension** :code
  ```scheme
  (chem/moles "H2O" 18.015)
  ```
  Error:
  ```
  error: unbound symbol: chem/moles

  ```
- **row-3-dimension** :code
  ```scheme
  (convert 5 'kg 'g) ; 5 kg → 5000 g
  ```
  Error:
  ```
  error: unbound symbol: convert

  ```
- **row-3-dimension** :code
  ```scheme
  N mol = (m g) / (M g/mol)
  ```
  Error:
  ```
  error: unbound symbol: N

  ```

### `collision/define-layers!` — file `14-collision.slat`

- **row-3-dimension** :code
  ```scheme
  (collision/define-layers! '(player enemy wall))
  ```
  Error:
  ```
  error: unbound symbol: collision/define-layers!

  ```

### `comb/bell` — file `15-comb.slat`

- **row-2-audit** :program
  ```scheme
  (comb/bell 5)
  ```
  Error:
  ```
  error: unbound symbol: comb/bell

  ```
- **row-3-dimension** :code
  ```scheme
  (comb/bell 5)
  ```
  Error:
  ```
  error: unbound symbol: comb/bell

  ```
- **row-3-dimension** :code
  ```scheme
  (apply + (map audio/track-length audio/tracks))
  ```
  Error:
  ```
  error: unbound symbol: audio/track-length

  ```
- **row-3-dimension** :code
  ```scheme
  μ(X) = Σ μ(part)
  ```
  Error:
  ```
  error: unbound symbol: μ

  ```
- **row-4-proof** :program
  ```scheme
  (define (test n) (= (comb/bell (+ n 1)) (let loop ((k 0) (acc 0)) (if (> k n) acc (loop (+ k 1) (+ acc (* (comb/choose n k) (comb/bell k))))))))
(and (test 0) (test 1) (test 2) (test 3) (test 4))
  ```
  Error:
  ```
  error: unbound symbol: comb/bell

  ```
- **row-5-emergence** :composition
  ```scheme
  (define (bell-table k) (map (lambda (n) (list n (comb/bell n))) (iota (+ k 1))))
(define (iota n) (let loop ((i 0) (acc '())) (if (>= i n) (reverse acc) (loop (+ i 1) (cons i acc)))))
(bell-table 5)
  ```
  Error:
  ```
  error: unbound symbol: comb/bell

  ```

### `boolean=?` — file `16-compare.slat`

- **row-3-dimension** :code
  ```scheme
  (same-lane? 'expo 'expo)
  ```
  Error:
  ```
  error: unbound symbol: same-lane?

  ```
- **row-3-dimension** :code
  ```scheme
  (= (mod 1 2) (mod 1 2))
  ```
  Error:
  ```
  error: unbound symbol: mod

  ```

### `symbol=?` — file `16-compare.slat`

- **row-3-dimension** :code
  ```scheme
  (same-station? 'grill 'grill)
  ```
  Error:
  ```
  error: unbound symbol: same-station?

  ```
- **row-3-dimension** :code
  ```scheme
  (string=? (uri-scheme u1) (uri-scheme u2))
  ```
  Error:
  ```
  error: unbound symbol: uri-scheme

  ```

### `complex/*` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/* z1 z2)
  ```
  Error:
  ```
  error: unbound symbol: complex/*

  ```
- **row-3-dimension** :code
  ```scheme
  matrix rotation followed by scale
  ```
  Error:
  ```
  error: unbound symbol: matrix

  ```
- **row-3-dimension** :code
  ```scheme
  multiplicative group action on C
  ```
  Error:
  ```
  error: unbound symbol: multiplicative

  ```

### `complex/+` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/+ z1 z2)
  ```
  Error:
  ```
  error: unbound symbol: complex/+

  ```
- **row-3-dimension** :code
  ```scheme
  component-wise +
  ```
  Error:
  ```
  error: unbound symbol: component-wise

  ```

### `complex/-` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/- z1 z2)
  ```
  Error:
  ```
  error: unbound symbol: complex/-

  ```
- **row-3-dimension** :code
  ```scheme
  point − point = vector
  ```
  Error:
  ```
  error: unbound symbol: point

  ```

### `complex/->polar` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/->polar z)
  ```
  Error:
  ```
  error: unbound symbol: complex/->polar

  ```
- **row-3-dimension** :code
  ```scheme
  (x, y) → (r, θ)
  ```
  Error:
  ```
  error: unbound symbol: x,

  ```
- **row-3-dimension** :code
  ```scheme
  any bijective coord transform
  ```
  Error:
  ```
  error: unbound symbol: bijective

  ```

### `complex/->string` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/->string z)
  ```
  Error:
  ```
  error: unbound symbol: complex/->string

  ```
- **row-3-dimension** :code
  ```scheme
  (vec/->string v)
  ```
  Error:
  ```
  error: unbound symbol: vec/->string

  ```
- **row-3-dimension** :code
  ```scheme
  generic value-to-string
  ```
  Error:
  ```
  error: unbound symbol: generic

  ```

### `complex//` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex// z1 z2)
  ```
  Error:
  ```
  error: unbound symbol: complex//

  ```
- **row-3-dimension** :code
  ```scheme
  modular inverse
  ```
  Error:
  ```
  error: unbound symbol: modular

  ```
- **row-3-dimension** :code
  ```scheme
  g₁ · g₂⁻¹
  ```
  Error:
  ```
  error: unbound symbol: g₁

  ```

### `complex/=` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/= z1 z2)
  ```
  Error:
  ```
  error: unbound symbol: complex/=

  ```
- **row-3-dimension** :code
  ```scheme
  abs(x - y) < eps
  ```
  Error:
  ```
  error: unbound symbol: x

  ```
- **row-3-dimension** :code
  ```scheme
  d(x, y) < ε
  ```
  Error:
  ```
  error: unbound symbol: d

  ```

### `complex/arg` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/arg z)
  ```
  Error:
  ```
  error: unbound symbol: complex/arg

  ```
- **row-3-dimension** :code
  ```scheme
  atan2(y, x)
  ```
  Error:
  ```
  error: unbound symbol: y,

  ```
- **row-3-dimension** :code
  ```scheme
  θ component of (r, θ)
  ```
  Error:
  ```
  error: unbound symbol: θ

  ```

### `complex/conjugate` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/conjugate z)
  ```
  Error:
  ```
  error: unbound symbol: complex/conjugate

  ```
- **row-3-dimension** :code
  ```scheme
  reflection across x-axis
  ```
  Error:
  ```
  error: unbound symbol: reflection

  ```
- **row-3-dimension** :code
  ```scheme
  f such that f(f(x)) = x
  ```
  Error:
  ```
  error: unbound symbol: f

  ```

### `complex/exp` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/exp z)
  ```
  Error:
  ```
  error: unbound symbol: complex/exp

  ```
- **row-3-dimension** :code
  ```scheme
  e^x — real exponential
  ```
  Error:
  ```
  error: unbound symbol: e^x

  ```
- **row-3-dimension** :code
  ```scheme
  expm(A) — matrix exponential
  ```
  Error:
  ```
  error: unbound symbol: expm

  ```

### `complex/from-polar` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/from-polar r θ)
  ```
  Error:
  ```
  error: unbound symbol: complex/from-polar

  ```
- **row-3-dimension** :code
  ```scheme
  (r cos θ, r sin θ)
  ```
  Error:
  ```
  error: unbound symbol: r

  ```
- **row-3-dimension** :code
  ```scheme
  r · e^{iθ}
  ```
  Error:
  ```
  error: unbound symbol: r

  ```

### `complex/im` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/im z)
  ```
  Error:
  ```
  error: unbound symbol: complex/im

  ```
- **row-3-dimension** :code
  ```scheme
  (vec/ref v 1)
  ```
  Error:
  ```
  error: unbound symbol: v

  ```
- **row-3-dimension** :code
  ```scheme
  π_im: C → R
  ```
  Error:
  ```
  error: unbound symbol: π_im:

  ```

### `complex/make` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/make a b)
  ```
  Error:
  ```
  error: unbound symbol: complex/make

  ```
- **row-3-dimension** :code
  ```scheme
  (vec/make (list a b))
  ```
  Error:
  ```
  error: unbound symbol: a

  ```
- **row-3-dimension** :code
  ```scheme
  smart constructor for domain object
  ```
  Error:
  ```
  error: unbound symbol: smart

  ```

### `complex/modulus` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/modulus z)
  ```
  Error:
  ```
  error: unbound symbol: complex/modulus

  ```
- **row-3-dimension** :code
  ```scheme
  ‖.‖ satisfying norm axioms
  ```
  Error:
  ```
  error: unbound symbol: ‖.‖

  ```

### `complex/neg` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/neg z)
  ```
  Error:
  ```
  error: unbound symbol: complex/neg

  ```
- **row-3-dimension** :code
  ```scheme
  -x
  ```
  Error:
  ```
  error: unbound symbol: -x

  ```
- **row-3-dimension** :code
  ```scheme
  -g in additive group
  ```
  Error:
  ```
  error: unbound symbol: -g

  ```

### `complex/pow` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/pow z n)
  ```
  Error:
  ```
  error: unbound symbol: complex/pow

  ```
- **row-3-dimension** :code
  ```scheme
  (linalg/matrix-power M n)
  ```
  Error:
  ```
  error: unbound symbol: linalg/matrix-power

  ```
- **row-3-dimension** :code
  ```scheme
  g^n
  ```
  Error:
  ```
  error: unbound symbol: g^n

  ```

### `complex/re` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/re z)
  ```
  Error:
  ```
  error: unbound symbol: complex/re

  ```
- **row-3-dimension** :code
  ```scheme
  (vec/ref v 0)
  ```
  Error:
  ```
  error: unbound symbol: v

  ```
- **row-3-dimension** :code
  ```scheme
  π_re: C → R
  ```
  Error:
  ```
  error: unbound symbol: π_re:

  ```

### `complex/scale` — file `17-complex.slat`

- **row-3-dimension** :code
  ```scheme
  (complex/scale k z)
  ```
  Error:
  ```
  error: unbound symbol: complex/scale

  ```
- **row-3-dimension** :code
  ```scheme
  (vec/scale v k)
  ```
  Error:
  ```
  error: unbound symbol: v

  ```
- **row-3-dimension** :code
  ```scheme
  R action on C
  ```
  Error:
  ```
  error: unbound symbol: R

  ```

### `const/e` — file `18-const.slat`

- **row-3-dimension** :code
  ```scheme
  e ∈ ℝ ; e is the base of the natural exponential
  ```
  Error:
  ```
  error: unbound symbol: e

  ```

... and 648 more verbs with failures.

## Verdict

✗ 1782 FAILURES. Fix pass required before fold. See per-verb section above for intent (verb name + row + field).
