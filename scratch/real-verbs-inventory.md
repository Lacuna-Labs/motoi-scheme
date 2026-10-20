# Real wired verbs (from lib/**/*.js + core/**/*.js VERBS arrays) — 2026-07-29

## ai (43)
ai/align  ai/arrive  ai/bb-del!  ai/bb-get  ai/bb-has?  ai/bb-set!  ai/bt-action  ai/bt-condition  ai/bt-force  ai/bt-invert  ai/bt-parallel  ai/bt-selector  ai/bt-sequence  ai/bt-tick  ai/classify  ai/clear!  ai/cohere  ai/decide  ai/embed  ai/evade  ai/flee  ai/flock  ai/flow-at  ai/flow-field  ai/follow-flow  ai/follow-path  ai/generate  ai/grid  ai/max-force!  ai/passable?  ai/path  ai/pursue  ai/rank  ai/rerank  ai/seek  ai/separate  ai/summarize  ai/translate  ai/utility  ai/vector-search  ai/wall!  ai/wander  ai/waypoints

## alg (84)
alg/action  alg/alternating  alg/apply-symmetry  alg/center  alg/centralizer  alg/commutator  alg/conjugacy-classes  alg/cosets  alg/cycles->perm  alg/cyclic  alg/derived-subgroup  alg/dihedral  alg/direct-product  alg/element-order  alg/exponent  alg/generate  alg/generators  alg/group-from-table  alg/homomorphism  alg/identity  alg/image  alg/index  alg/interval-vector  alg/inverse  alg/invert  alg/is-abelian?  alg/is-cyclic?  alg/is-field?  alg/is-group?  alg/is-homomorphism?  alg/is-isomorphic?  alg/is-normal?  alg/is-simple?  alg/is-solvable?  alg/is-subgroup?  alg/isomorphism?  alg/kernel  alg/left-cosets  alg/normal-form  alg/normalizer  alg/op  alg/orbit  alg/order  alg/pcset  alg/perm  alg/perm->cycles  alg/perm-apply  alg/perm-compose  alg/perm-conjugate  alg/perm-cycles  alg/perm-fixed-points  alg/perm-fixed?  alg/perm-identity  alg/perm-inverse  alg/perm-order  alg/perm-parity  alg/perm-pow  alg/perm-sign  alg/perm-support  alg/permutation-compose  alg/permutation-cycles  alg/poly-add  alg/poly-mul  alg/prime-form  alg/quotient  alg/random-element  alg/rank  alg/right-cosets  alg/rosette  alg/stabilizer  alg/subgroup  alg/subgroup-gen  alg/subgroup?  alg/subgroups  alg/symmetric  alg/symmetry-group  alg/torsion  alg/transpose  alg/triad  alg/zn  alg/zn-add  alg/zn-inverse  alg/zn-mul  alg/zn-units

## animation (6)
animation/budget  animation/clear!  animation/reflow-policy  animation/set-reflow-policy  animation/tick  animation/tweens

## artifact (3)
artifact/cite  artifact/delete  artifact/save

## assert (3)
assert/audit-verify  assert/check-with  assert/invariants

## audio (13)
audio/bar-clock  audio/halt  audio/key  audio/listen  audio/lufs  audio/master-volume  audio/onset-strength  audio/onset?  audio/play  audio/playing?  audio/spectrum  audio/tempo  audio/transcribe-with-cloud-help

## base (1)
base/make-character

## beat (1)
beat/on

## book (7)
book/example  book/list  book/next  book/prev  book/read  book/search  book/toc

## book-of-code (5)
book-of-code/chapter  book-of-code/read  book-of-code/run-code-block  book-of-code/table-of-contents  book-of-code/tutor

## calc (30)
calc/arc-length  calc/arc-length-param  calc/average-value  calc/continuous?  calc/critical-points-1d  calc/curl  calc/derivative  calc/differentiable?  calc/directional-derivative  calc/divergence  calc/extrema-1d  calc/gradient  calc/hessian  calc/integral  calc/jacobian  calc/laplacian  calc/limit  calc/line-integral  calc/newton  calc/partial  calc/radius-of-convergence  calc/riemann-sum  calc/second-derivative  calc/series-converges?  calc/surface-integral  calc/surface-revolution  calc/tangent-line  calc/taylor  calc/total-differential  calc/volume-revolution

## call (1)
call/cc

## chem (5)
chem/atomic-weight  chem/balance  chem/formula-counts  chem/molar-mass  chem/moles

## collision (1)
collision/define-layers!

## color (3)
color/name-of  color/named  color/palette-html-16

## comb (13)
comb/bell  comb/binomial-coeffs  comb/catalan  comb/choose  comb/derangement  comb/factorial  comb/multichoose  comb/multinomial  comb/partition-count  comb/pascal-row  comb/pascal-triangle  comb/permute  comb/stirling2

## completions (6)
completions/at-point  completions/body  completions/import-suggestions  completions/mode  completions/next-arg  completions/smart-at-point

## complex (17)
complex/*  complex/+  complex/-  complex/->polar  complex/->string  complex/=  complex/arg  complex/conjugate  complex/exp  complex/from-polar  complex/im  complex/make  complex/modulus  complex/neg  complex/pow  complex/re  complex/scale

## composer (26)
composer/adsr  composer/apply  composer/button  composer/canvas  composer/cart-apply  composer/cart-emit  composer/cart-empty  composer/color-picker  composer/emit  composer/fx-chain  composer/instrument-picker  composer/live-code  composer/load  composer/piano-roll  composer/render-tui  composer/save  composer/slider  composer/sprite-grid  composer/text-field  composer/tile-map  composer/timeline  composer/toggle  composer/tree-logo  composer/voice-assign  composer/voice-mix-set  composer/voice-pool

## const (8)
const/e  const/ln10  const/ln2  const/phi  const/pi  const/sqrt2  const/sqrt3  const/tau

## copilot (8)
copilot/ask  copilot/complete  copilot/explain  copilot/fix  copilot/pretty-error  copilot/rag  copilot/scaffold  copilot/what-is

## cortex (14)
cortex/associate  cortex/forget  cortex/keys  cortex/lookup  cortex/prune  cortex/query  cortex/read  cortex/recall  cortex/record  cortex/remember  cortex/search  cortex/size  cortex/topk  cortex/write

## cpu (12)
cpu/assemble  cpu/boot!  cpu/disassemble  cpu/display  cpu/halted?  cpu/load-program!  cpu/opcodes  cpu/read-mem  cpu/run!  cpu/state  cpu/step!  cpu/write-mem!

## curve (37)
curve/accel  curve/arc-length  curve/bezier  curve/bezier-eval  curve/binormal  curve/brachistochrone  curve/catmull-rom  curve/christoffel  curve/curvature  curve/curvature-2d  curve/cycloid  curve/descent-time  curve/euler-lagrange-residual  curve/eval  curve/fall-line  curve/fall-path  curve/first-form  curve/frenet-frame  curve/gaussian-curvature  curve/geodesic-distance  curve/gradient  curve/hermite  curve/mean-curvature  curve/normal  curve/osculating-circle  curve/principal-curvatures  curve/sample  curve/second-form  curve/slope-angle  curve/speed  curve/spline-length  curve/spline-resample  curve/surface-graph  curve/surface-normal  curve/torsion  curve/unit-tangent  curve/velocity

## domain (1)
domain/of

## draw-image (1)
draw-image/center

## easing (1)
easing/apply

## eng (6)
eng/beam-reactions  eng/bode  eng/statics-solve  eng/tf  eng/tf-dc-gain  eng/tf-stable?

## entity (47)
entity/alive?  entity/all  entity/apply-force!  entity/bounce!  entity/collides?  entity/count  entity/damage!  entity/despawn!  entity/distance  entity/drag!  entity/friction!  entity/gravity-scale!  entity/has-tag?  entity/hits-tag  entity/hp  entity/hp!  entity/id  entity/kind  entity/layer!  entity/make  entity/mask!  entity/mass!  entity/max-speed!  entity/move  entity/move!  entity/pin!  entity/ref  entity/remove!  entity/rotate!  entity/sensor!  entity/set!  entity/set-pos!  entity/set-vel!  entity/set-velocity!  entity/shape!  entity/solid!  entity/spawn  entity/state  entity/static?  entity/tag!  entity/team  entity/turn  entity/unpin!  entity/untag!  entity/vel  entity/x  entity/y

## exact (18)
exact/*  exact/+  exact/-  exact/->float  exact/->mixed  exact/->string  exact/<  exact/<=  exact/=  exact/>  exact/>=  exact/abs  exact/denominator  exact/float->rat  exact/inverse  exact/neg  exact/numerator  exact/rat

## fb (3)
fb/dump  fb/pixel  fb/text

## floor (2)
floor/mark!  floor/problem?

## font (4)
font/big  font/default  font/mono  font/tiny

## game (21)
game/grundy  game/mex  game/nim-outcome  game/nim-sum  game/star-n  game/surreal  game/surreal-add  game/surreal-birthday  game/surreal-eq?  game/surreal-is-number?  game/surreal-le?  game/surreal-lit  game/surreal-mul  game/surreal-neg  game/surreal-simplest  game/surreal-sub  game/temperature  game/to-real  game/ttt-best-move  game/ttt-value  game/wythoff-p?

## geom (57)
geom/->degrees  geom/->radians  geom/angle-between  geom/arc-length  geom/arccos  geom/arcsin  geom/arctan  geom/atan2  geom/circle  geom/circle-area  geom/circle-circumference  geom/collinear?  geom/cone-surface  geom/cone-volume  geom/cos  geom/cylinder-surface  geom/cylinder-volume  geom/dilate  geom/distance  geom/inscribed-angle  geom/interior-angle  geom/interior-angle-deg  geom/law-of-cosines-angle  geom/law-of-cosines-side  geom/law-of-sines-side  geom/midpoint  geom/perimeter  geom/point  geom/polygon-area  geom/polygon-perimeter  geom/prism-volume  geom/pyramid-volume  geom/pythagoras-hypotenuse  geom/pythagoras-leg  geom/reflect-line  geom/reflect-origin  geom/reflect-x  geom/reflect-y  geom/regular-polygon-area  geom/regular-polygon-vertices  geom/right-triangle-angle  geom/rotate  geom/rotate-about  geom/sector-area  geom/segment  geom/similar?  geom/sin  geom/slope  geom/solve-right  geom/sphere-surface  geom/sphere-volume  geom/tan  geom/transform-polygon  geom/translate  geom/triangle  geom/triangle-area  geom/triangle-area-heron

## grid (12)
grid/card-center  grid/clear  grid/dot  grid/flower-clear!  grid/flower-go-to!  grid/flower-list  grid/flower-move-to!  grid/flower-pos  grid/flower-settled?  grid/flower-spawn!  grid/flower-state!  grid/glow

## hash-table-ref (1)
hash-table-ref/default

## http (4)
http/serve  http/serve-info  http/stop  http/wait-until-ready

## img (9)
img/circle  img/ellipse  img/line  img/rectangle  img/regular-polygon  img/square  img/star  img/star-poly  img/triangle

## input (5)
input/buttons  input/down?  input/may-i?  input/pressed?  input/set!

## juggle (6)
juggle/balls  juggle/generate  juggle/max-throw  juggle/simulate  juggle/state  juggle/valid?

## linalg (21)
linalg/characteristic-poly  linalg/eigenvalues  linalg/eigenvalues-2x2  linalg/eigenvalues-3x3  linalg/eigenvectors  linalg/gram-schmidt  linalg/inverse  linalg/is-invertible?  linalg/is-orthogonal?  linalg/is-symmetric?  linalg/least-squares  linalg/lu  linalg/matrix-power  linalg/null-space  linalg/project  linalg/qr  linalg/rank  linalg/solve  linalg/svd  linalg/trace  linalg/vec-add

## llm (7)
llm/ask  llm/chat  llm/complete  llm/config  llm/embed  llm/stream  llm/tokens

## math (45)
math/acos  math/area-model  math/array  math/asin  math/atan  math/atan2  math/avg  math/ceil  math/clamp  math/compare  math/cos  math/count-on  math/cube  math/digit-at  math/e  math/exp  math/expanded-form  math/floor  math/fraction-bar  math/gcd  math/hypot  math/integer-line  math/lcm  math/lerp  math/log  math/log-base  math/log10  math/log2  math/mixed-number  math/number-line  math/pct  math/pi  math/place-value  math/pow  math/ratio-bar  math/round  math/round-half-up  math/round-to-place  math/sin  math/skip-count  math/sqrt  math/square  math/sum  math/tan  math/tau

## matrix (21)
matrix/*  matrix/+  matrix/-  matrix/->string  matrix/=  matrix/add  matrix/col  matrix/cols  matrix/determinant  matrix/get  matrix/identity  matrix/make  matrix/matvec  matrix/multiply  matrix/ref  matrix/row  matrix/rows  matrix/scale  matrix/sub  matrix/transpose  matrix/zero

## motion (11)
motion/anchor-to-input  motion/arc  motion/cadence  motion/drop  motion/follow-input  motion/halt  motion/move-to  motion/on-settle  motion/pocket  motion/with-feel  motion/with-pace

## motoi (29)
motoi/ambient-complete  motoi/bookmark!  motoi/bookmark-delete!  motoi/bookmarks  motoi/bug-spot  motoi/explain  motoi/explain-selection  motoi/hacker-mode-off!  motoi/hacker-mode-on!  motoi/hacker-mode?  motoi/highlight!  motoi/highlights  motoi/log-exchange!  motoi/mark-block-run!  motoi/mark-read!  motoi/pair-mode?  motoi/pair-narrate!  motoi/pair-off!  motoi/pair-on!  motoi/pair-set-mode!  motoi/pair-state  motoi/reading-progress  motoi/reading-state  motoi/refactor-suggest  motoi/session-log  motoi/stack  motoi/stack-clear!  motoi/stack-depth  motoi/stack-peak

## note (3)
note/place-at  note/release  note/strike

## nt (29)
nt/base-convert  nt/composite?  nt/continued-fraction  nt/coprime?  nt/crt  nt/digit-sum  nt/digital-root  nt/divisible?  nt/divisor-count  nt/divisor-sum  nt/divisors  nt/divmod  nt/even?  nt/extended-gcd  nt/factor  nt/factor-tree  nt/gcd  nt/is-perfect?  nt/lcm  nt/mod  nt/mod-inverse  nt/mod-pow  nt/next-prime  nt/nth-prime  nt/odd?  nt/prime-factorization  nt/prime?  nt/sieve  nt/totient

## num (2)
num/nintegrate-2d  num/nintegrate-3d

## object (2)
object/fetch  object/spawn

## part (19)
part/bow  part/breathe  part/expression  part/grasp  part/lean  part/look-toward  part/lower  part/nod  part/point  part/raise  part/reach  part/shake  part/shrug  part/step  part/sway  part/tilt  part/turn  part/twist  part/wave

## pattern (1)
pattern/clave

## phys (16)
phys/constant  phys/dimension  phys/gravitational-force  phys/kinematics  phys/kinetic-energy  phys/lagrange-residual  phys/lagrangian-action  phys/nbody  phys/q*  phys/q+  phys/quantity  phys/quantity->tag  phys/rlc-damping  phys/same-dimension?  phys/uncertainty-add  phys/uncertainty-mul

## physics (8)
physics/apply-force  physics/apply-gravity  physics/apply-impulse  physics/friction  physics/friction!  physics/gravity  physics/gravity!  physics/step

## plot (14)
plot/bar  plot/contour  plot/fit-grid  plot/from-series  plot/function  plot/histogram  plot/line  plot/nice-domain  plot/parametric  plot/phase-portrait  plot/render-svg  plot/scatter  plot/vector-field  plot/with

## prefab (2)
prefab/define  prefab/spawn

## route (1)
route/off-domain

## scale (1)
scale/xy

## scene (5)
scene/clear  scene/grid  scene/imagine  scene/load  scene/spawn-many

## sdf (3)
sdf/box  sdf/circle  sdf/segment

## seq (12)
seq/arithmetic  seq/arithmetic-sum  seq/fibonacci  seq/geometric  seq/geometric-inf-sum  seq/geometric-sum  seq/lucas  seq/nth-term  seq/partial-sums  seq/product  seq/recurrence  seq/sigma

## solve (13)
solve/completing-square  solve/distance  solve/interest  solve/linear  solve/midpoint  solve/percent-change  solve/proportion  solve/pythagorean-triple?  solve/quadratic  solve/slope-intercept  solve/system-2x2  solve/unit-circle  solve/vertex

## song (1)
song/config

## sprite (4)
sprite/address  sprite/define  sprite/landmarks  sprite/rasterize

## sprites (1)
sprites/clear

## stat (18)
stat/count  stat/histogram  stat/histogram-counts  stat/iqr  stat/max  stat/mean  stat/median  stat/min  stat/mode  stat/probability  stat/quartile  stat/range  stat/sd  stat/sd-sample  stat/sum  stat/variance  stat/variance-sample  stat/z-score

## stats (9)
stats/error-count-of  stats/error-counts  stats/error-novel  stats/error-summary  stats/flush!  stats/path  stats/summary  stats/verb-calls  stats/verb-calls-of

## sym (20)
sym/->string  sym/=  sym/add  sym/coeff  sym/const  sym/degree  sym/derivative  sym/evaluate  sym/expand  sym/factor  sym/mul  sym/poly  sym/pow  sym/scale  sym/solve-ineq  sym/solve-linear  sym/solve-quadratic  sym/sub  sym/substitute  sym/var

## synth (9)
synth/808  synth/chord  synth/kit  synth/load-score  synth/onset-tap  synth/orch  synth/orchestra  synth/play  synth/sp1200

## system (5)
system/cards  system/health  system/registry  system/scheduler  system/surface

## text (6)
text/draw  text/measure  text/overlay  text/overlay-clear  text/rasterize  text/wrap

## tick (9)
tick/ease  tick/lissajous  tick/mod-n  tick/osc  tick/pattern  tick/phase  tick/pulse  tick/sine  tick/triangle

## tilemap (7)
tilemap/cols  tilemap/get  tilemap/put!  tilemap/rows  tilemap/set!  tilemap/tile-at-pixel  tilemap/tile-size!

## time (11)
time/across  time/delta  time/during  time/every-ms  time/from-ms  time/iso  time/now  time/then  time/to-ms  time/until  time/when

## topo (50)
topo/adjacent?  topo/ball  topo/betti  topo/betti-curve  topo/betti-k  topo/bottleneck  topo/boundary  topo/boundary-matrix  topo/chain  topo/close  topo/closed?  topo/complex  topo/components  topo/connected?  topo/crossing-number  topo/dimension  topo/edges  topo/euler-char  topo/euler-characteristic  topo/euler-genus  topo/f-vector  topo/faces  topo/genus  topo/graph  topo/homology  topo/homology-gf2  topo/homotopy  topo/interior  topo/is-manifold?  topo/klein-bottle  topo/knot  topo/metric-space  topo/mobius  topo/nodes  topo/open?  topo/orientable?  topo/persistence  topo/persistence-entropy  topo/planar?  topo/rips-filtration  topo/simplex  topo/simplicial  topo/simply-connected?  topo/sphere  topo/torus  topo/total-persistence  topo/unknot?  topo/vertices  topo/vietoris-rips  topo/writhe

## transport (2)
transport/bpm  transport/tempo

## vec (18)
vec/+  vec/-  vec/->string  vec/=  vec/add  vec/angle-between  vec/cross  vec/dim  vec/distance  vec/dot  vec/lerp  vec/make  vec/norm  vec/normalize  vec/ref  vec/scale  vec/sub  vec/zero

## voice (2)
voice/compose  voice/mix

## weather (1)
weather/conjure

## world (29)
world/after  world/attract!  world/camera  world/camera-bounds!  world/camera-follow!  world/camera-pan-to  world/camera-shake!  world/camera-snap!  world/collisions  world/count  world/each  world/find  world/floor!  world/frame  world/gravity!  world/hash  world/reset!  world/running?  world/spawn  world/start  world/state  world/step  world/stop  world/tape-frames  world/tape-hash  world/tape-record!  world/tape-replay  world/tape-save  world/tape-stop!

