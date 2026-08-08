// verb-manifest.js — EXPLICIT registration of every lib.
//
// No auto-discovery. If it's here, it loads. If it's not, it doesn't. This
// is deliberate: dropping a broken file into lib/ should NOT crash boot for
// everyone else. Registration = author intent.
//
// Each lib file itself declares (via `export const VERBS = [...]` and
// `export const LAZY = true|false`) what verbs it defines and whether it
// wants eager or lazy install. The manifest below imports each installer +
// its metadata and pairs them.
//
// Doctrine (Alfred, 2026-07-22):
//   • Explicit is better than automatic. Broken files shouldn't crash boot.
//   • The manifest is small enough to read; adding a lib is one line.
//   • VERBS/LAZY live in the lib file (colocated with the code), NOT
//     in a separate central config. One source of truth per lib.
//
// See engineering/HOW-TO-REGISTER-A-VERB.md for the file-shape.
// See docs/EAGER-VS-LAZY.md for the doctrine.

import { makeGameState }               from '../lib/game/game.js'
import { installAnimation }            from '../lib/graphics/animation.js'
import { installAi }                   from '../lib/ai/ai.js'
import { installMathBasic }            from '../lib/math/basic.js'
import { installMathPedagogy }         from '../lib/math/pedagogy.js'
import { installConst }                from '../lib/math/const.js'
import { installMatrix }               from '../lib/math/matrix.js'
import { installExact }                from '../lib/math/exact.js'
import { installNumIntegrate }         from '../lib/math/num-integrate.js'
import { installPhys }                 from '../lib/math/phys.js'
import { installSolve }                from '../lib/math/solve.js'
import { installComb }                 from '../lib/math/comb.js'
import { installSeq }                  from '../lib/math/seq.js'
import { installStat }                 from '../lib/math/stat.js'
import { installPlot }                 from '../lib/graphics/plot.js'
import { installVec }                  from '../lib/graphics/vec.js'
import { installGeom }                 from '../lib/graphics/geom.js'
import { installCurve }                from '../lib/graphics/curve.js'
import { installGeomExtended }         from '../lib/graphics/geom-extended.js'
import { installSprite }               from '../lib/graphics/sprite.js'
import { installEasing }               from '../lib/graphics/easing.js'
import { installText }                 from '../lib/graphics/text.js'
import { installFramebufferVerbs }     from '../lib/graphics/framebuffer-verbs.js'
import { installAnimationBudget }      from '../lib/graphics/animation-budget.js'
import { installSystem }               from '../lib/system/system.js'
import { installTime }                 from '../lib/system/time-verbs.js'
import { installStack }                from '../lib/system/stack.js'
import { installIntrospection }        from '../lib/system/introspection.js'
import { installVerbStats }            from '../lib/system/verb-stats.js'
import { installArtifact }             from '../lib/system/artifact.js'
import { installChem }                 from '../lib/system/chem.js'
import { installDomainVerbs }          from '../lib/system/domain-verbs.js'
import { installEng }                  from '../lib/system/eng.js'
import { installOps }                  from '../lib/system/ops.js'
import { installCpu }                  from '../lib/system/cpu.js'
import { installReadingState }         from '../lib/system/reading-state.js'
import { installHackerMode }           from '../lib/system/hacker-mode.js'
import { installPairProgramming }      from '../lib/system/pair-programming.js'
import { installRequire }              from '../lib/system/require-verb.js'
import { installScheduler }            from '../lib/game/scheduler.js'
import { installMisc }                 from '../lib/game/misc.js'
import { installGameExtras }           from '../lib/game/game-extras.js'
import { installGrid }                 from '../lib/game/grid.js'
import { installJuggle }               from '../lib/game/juggle.js'
import { installGameTheory }           from '../lib/game/game-theory.js'
import { installSteering }             from '../lib/ai/steering.js'
import { installCompletions }          from '../lib/ai/completions.js'
import { installCoreToplevel }         from '../lib/system/core-toplevel.js'
import { installTick }                 from '../lib/audio/tick.js'
import { installSynth }                from '../lib/audio/synth.js'
import { installLLM }                  from '../lib/ai/llm.js'
import { installBookReader }           from '../lib/book/reader.js'
import { installBookOfCodeTutor }      from '../lib/book/tutor.js'
import { installAlg }                  from '../lib/base/alg.js'
import { installAlist }                from '../lib/base/alist.js'
import { installAssert }               from '../lib/base/assert.js'
import { installCalc }                 from '../lib/math/calc.js'
import { installNumberTheory }         from '../lib/math/nt.js'
import { installComplex }              from '../lib/math/complex.js'
import { installTopo }                 from '../lib/base/topo.js'
import { installAlgGroups }            from '../lib/math/alg-groups.js'
import { installSym }                  from '../lib/math/sym.js'
import { installLinalg }               from '../lib/math/linalg.js'

export const MANIFEST = [
  // EAGER — loads at boot
  { name: 'base/alist',        install: (env, ctx) => installAlist(env, ctx.fuel),       mode: 'eager' },
  { name: 'math/basic',        install: (env, ctx) => installMathBasic(env, ctx.fuel),   mode: 'eager' },
  { name: 'math/pedagogy',     install: installMathPedagogy,                              mode: 'eager' },
  { name: 'math/const',        install: installConst,                                     mode: 'eager' },
  { name: 'math/exact',        install: installExact,                                     mode: 'eager' },
  { name: 'system/system',     install: installSystem,                                    mode: 'eager' },
  { name: 'system/time',       install: installTime,                                      mode: 'eager' },
  { name: 'system/stack',      install: (env, ctx) => installStack(env, ctx.fuel),        mode: 'eager' },
  { name: 'system/introspection', install: installIntrospection,                         mode: 'eager' },
  { name: 'system/verb-stats', install: installVerbStats,                                 mode: 'eager' },
  { name: 'system/require',    install: installRequire,                                   mode: 'eager' },
  { name: 'game/scheduler',    install: installScheduler,                                 mode: 'eager' },
  { name: 'game/misc',         install: installMisc,                                      mode: 'eager' },
  { name: 'game/game-extras',  install: (env, ctx) => installGameExtras(env, ctx),        mode: 'eager' },
  { name: 'game/grid',         install: (env, ctx) => installGrid(env, ctx.game),         mode: 'eager' },
  { name: 'graphics/vec',      install: installVec,                                       mode: 'eager' },
  { name: 'graphics/geom',     install: (env, ctx) => installGeom(env, ctx.fuel),         mode: 'eager' },
  { name: 'graphics/animation', install: (env, ctx) => installAnimation(env, { game: ctx.game, getMedia: () => null }), mode: 'eager' },
  { name: 'graphics/animation-budget', install: installAnimationBudget,                   mode: 'eager' },
  { name: 'graphics/sprite',   install: installSprite,                                    mode: 'eager' },
  { name: 'graphics/easing',   install: installEasing,                                    mode: 'eager' },
  { name: 'graphics/text',     install: installText,                                      mode: 'eager' },
  { name: 'graphics/framebuffer', install: installFramebufferVerbs,                       mode: 'eager' },
  { name: 'system/artifact',   install: installArtifact,                                  mode: 'eager' },
  { name: 'system/chem',       install: installChem,                                      mode: 'eager' },
  { name: 'system/domain',     install: installDomainVerbs,                               mode: 'eager' },
  { name: 'system/eng',        install: installEng,                                       mode: 'eager' },
  { name: 'system/ops',        install: installOps,                                       mode: 'eager' },
  { name: 'system/cpu',        install: installCpu,                                       mode: 'eager' },
  { name: 'system/reading',    install: installReadingState,                              mode: 'eager' },
  { name: 'system/hacker',     install: installHackerMode,                                mode: 'eager' },
  { name: 'system/pair',       install: installPairProgramming,                           mode: 'eager' },
  { name: 'ai/ai',             install: installAi,                                        mode: 'eager' },
  { name: 'ai/steering',       install: installSteering,                                  mode: 'eager' },
  { name: 'ai/completions',    install: installCompletions,                               mode: 'eager' },
  { name: 'ai/llm',            install: installLLM,                                       mode: 'eager' },
  { name: 'book/reader',       install: installBookReader,                                mode: 'eager' },
  { name: 'book/tutor',        install: installBookOfCodeTutor,                           mode: 'eager' },
  { name: 'system/core-toplevel', install: installCoreToplevel,                           mode: 'eager' },
  { name: 'audio/tick',        install: installTick,                                      mode: 'eager' },
  { name: 'audio/synth',       install: installSynth,                                     mode: 'eager' },

  // LAZY — installer deferred until (require ...) or first verb reference
  { name: 'math/matrix',       install: (env, ctx) => installMatrix(env, ctx.fuel),       mode: 'lazy',
    verbs: ['matrix/make', 'matrix/rows', 'matrix/cols', 'matrix/ref', 'matrix/mul', 'matrix/add', 'matrix/transpose', 'matrix/scale',
            'matrix/*', 'matrix/+', 'matrix/-', 'matrix/=', 'matrix/->string', 'matrix/determinant', 'matrix/get'] },
  { name: 'math/num-integrate', install: (env, ctx) => installNumIntegrate(env, ctx.fuel), mode: 'lazy',
    verbs: ['num/nintegrate-2d', 'num/nintegrate-3d'] },
  { name: 'base/alg',          install: (env, ctx) => installAlg(env, ctx.fuel),          mode: 'lazy',
    verbs: ['alg/perm-identity', 'alg/perm-compose', 'alg/perm-apply', 'alg/perm-inverse', 'alg/perm-pow'] },
  { name: 'base/assert',       install: (env, ctx) => installAssert(env, ctx.fuel),       mode: 'lazy',
    verbs: ['assert/check-with', 'assert/invariants', 'assert/audit-verify'] },
  // ── Advanced math (2026-07-22) ──────────────────────────────────
  //   These are also EAGER-installed in core/index.js so `motoi run`
  //   sees them without an explicit (require ...). The manifest entry
  //   lets `(require 'calc)` / `(require 'nt)` / `(require 'complex)`
  //   round-trip in kids' carts and lists them in (available-libs).
  { name: 'math/calc',         install: (env, ctx) => installCalc(env, ctx),              mode: 'lazy',
    verbs: [
      'calc/arc-length', 'calc/arc-length-param', 'calc/average-value',
      'calc/continuous?', 'calc/critical-points-1d', 'calc/curl',
      'calc/derivative', 'calc/differentiable?', 'calc/directional-derivative',
      'calc/divergence', 'calc/extrema-1d', 'calc/gradient', 'calc/hessian',
      'calc/integral', 'calc/jacobian', 'calc/laplacian', 'calc/limit',
      'calc/line-integral', 'calc/newton', 'calc/partial',
      'calc/radius-of-convergence', 'calc/riemann-sum', 'calc/second-derivative',
      'calc/series-converges?', 'calc/surface-integral', 'calc/surface-revolution',
      'calc/tangent-line', 'calc/taylor', 'calc/total-differential',
      'calc/volume-revolution',
    ] },
  { name: 'math/nt',           install: (env, ctx) => installNumberTheory(env, ctx),      mode: 'lazy',
    verbs: [
      'nt/base-convert', 'nt/composite?', 'nt/continued-fraction', 'nt/coprime?',
      'nt/crt', 'nt/digit-sum', 'nt/digital-root', 'nt/divisible?',
      'nt/divisor-count', 'nt/divisor-sum', 'nt/divisors', 'nt/divmod',
      'nt/even?', 'nt/extended-gcd', 'nt/factor', 'nt/factor-tree', 'nt/gcd',
      'nt/is-perfect?', 'nt/lcm', 'nt/mod', 'nt/mod-inverse', 'nt/mod-pow',
      'nt/next-prime', 'nt/nth-prime', 'nt/odd?', 'nt/prime-factorization',
      'nt/prime?', 'nt/sieve', 'nt/totient',
    ] },
  { name: 'math/complex',      install: (env, ctx) => installComplex(env, ctx),           mode: 'lazy',
    verbs: [
      'complex/*', 'complex/+', 'complex/-', 'complex/->polar', 'complex/->string',
      'complex//', 'complex/=', 'complex/arg', 'complex/conjugate', 'complex/exp',
      'complex/from-polar', 'complex/im', 'complex/make', 'complex/modulus',
      'complex/neg', 'complex/pow', 'complex/re', 'complex/scale',
    ] },
  { name: 'game/game-theory',  install: installGameTheory,                                mode: 'lazy',
    verbs: ['game/grundy', 'game/mex', 'game/nim-outcome', 'game/nim-sum'] },
  { name: 'game/juggle',       install: installJuggle,                                    mode: 'lazy',
    verbs: ['juggle/pattern', 'juggle/valid?', 'juggle/period',
            'juggle/balls', 'juggle/generate', 'juggle/max-throw', 'juggle/simulate', 'juggle/state'] },
  { name: 'graphics/curve',    install: installCurve,                                     mode: 'lazy',
    verbs: [
      'curve/accel', 'curve/arc-length', 'curve/bezier', 'curve/bezier-eval',
      'curve/binormal', 'curve/brachistochrone', 'curve/catmull-rom',
      'curve/christoffel', 'curve/curvature', 'curve/curvature-2d',
      'curve/cycloid', 'curve/descent-time', 'curve/euler-lagrange-residual',
      'curve/eval', 'curve/fall-line', 'curve/fall-path', 'curve/first-form',
      'curve/frenet-frame', 'curve/gaussian-curvature', 'curve/geodesic-distance',
      'curve/gradient', 'curve/hermite', 'curve/mean-curvature', 'curve/normal',
      'curve/osculating-circle', 'curve/principal-curvatures', 'curve/sample',
      'curve/second-form', 'curve/slope-angle', 'curve/speed',
      'curve/spline-length', 'curve/spline-resample', 'curve/surface-graph',
      'curve/surface-normal', 'curve/torsion', 'curve/unit-tangent',
      'curve/velocity',
    ] },
  { name: 'graphics/geom-extended', install: installGeomExtended,                         mode: 'lazy',
    verbs: [
      'geom/arc-length', 'geom/arccos', 'geom/arcsin', 'geom/arctan',
      'geom/collinear?', 'geom/cone-surface', 'geom/cone-volume',
      'geom/cylinder-surface', 'geom/cylinder-volume', 'geom/dilate',
      'geom/inscribed-angle', 'geom/interior-angle', 'geom/interior-angle-deg',
      'geom/law-of-cosines-angle', 'geom/law-of-cosines-side',
      'geom/law-of-sines-side', 'geom/perimeter', 'geom/polygon-perimeter',
      'geom/prism-volume', 'geom/pyramid-volume', 'geom/pythagoras-hypotenuse',
      'geom/pythagoras-leg', 'geom/reflect-line', 'geom/reflect-origin',
      'geom/reflect-x', 'geom/reflect-y', 'geom/regular-polygon-area',
      'geom/regular-polygon-vertices', 'geom/right-triangle-angle',
      'geom/rotate-about', 'geom/sector-area', 'geom/similar?',
      'geom/solve-right', 'geom/sphere-surface', 'geom/sphere-volume',
      'geom/transform-polygon', 'geom/triangle-area-heron',
    ] },
  // ── Topology + advanced algebra + symbolic + linalg (2026-07-22) ──
  // Also EAGER-installed in core/index.js so audit + REPL see them without
  // an explicit require. Manifest entries let (require ...) round-trip.
  { name: 'base/topo',         install: (env, ctx) => installTopo(env, ctx.fuel),         mode: 'lazy',
    verbs: [
      'topo/adjacent?', 'topo/ball', 'topo/betti', 'topo/betti-curve',
      'topo/betti-k', 'topo/bottleneck', 'topo/boundary', 'topo/boundary-matrix',
      'topo/chain', 'topo/close', 'topo/closed?', 'topo/complex',
      'topo/components', 'topo/connected?', 'topo/crossing-number',
      'topo/dimension', 'topo/edges', 'topo/euler-char',
      'topo/euler-characteristic', 'topo/euler-genus', 'topo/f-vector',
      'topo/faces', 'topo/genus', 'topo/graph', 'topo/homology',
      'topo/homology-gf2', 'topo/homotopy', 'topo/interior',
      'topo/is-manifold?', 'topo/klein-bottle', 'topo/knot',
      'topo/metric-space', 'topo/mobius', 'topo/nodes', 'topo/open?',
      'topo/orientable?', 'topo/persistence', 'topo/persistence-entropy',
      'topo/planar?', 'topo/rips-filtration', 'topo/simplex',
      'topo/simplicial', 'topo/simply-connected?', 'topo/sphere',
      'topo/torus', 'topo/total-persistence', 'topo/unknot?',
      'topo/vertices', 'topo/vietoris-rips', 'topo/writhe',
    ] },
  { name: 'math/alg-groups',   install: (env, ctx) => installAlgGroups(env, ctx),         mode: 'lazy',
    verbs: [
      'alg/apply-symmetry', 'alg/center', 'alg/conjugacy-classes',
      'alg/cosets', 'alg/cycles->perm', 'alg/cyclic', 'alg/dihedral',
      'alg/direct-product', 'alg/element-order', 'alg/group-from-table',
      'alg/identity', 'alg/image', 'alg/index', 'alg/interval-vector',
      'alg/inverse', 'alg/invert', 'alg/is-abelian?', 'alg/is-field?',
      'alg/is-group?', 'alg/order',
    ] },
  { name: 'math/sym',          install: (env, ctx) => installSym(env, ctx),               mode: 'lazy',
    verbs: [
      'sym/->string', 'sym/=', 'sym/add', 'sym/coeff', 'sym/const',
      'sym/degree', 'sym/derivative', 'sym/evaluate', 'sym/expand',
      'sym/factor', 'sym/mul', 'sym/poly', 'sym/pow', 'sym/scale',
      'sym/solve-ineq', 'sym/solve-linear', 'sym/solve-quadratic',
      'sym/sub', 'sym/substitute', 'sym/var',
    ] },
  { name: 'math/linalg',       install: (env, ctx) => installLinalg(env, ctx),            mode: 'lazy',
    verbs: [
      'linalg/characteristic-poly', 'linalg/eigenvalues',
      'linalg/eigenvalues-2x2', 'linalg/eigenvalues-3x3',
      'linalg/eigenvectors', 'linalg/gram-schmidt', 'linalg/inverse',
      'linalg/is-invertible?', 'linalg/is-orthogonal?',
      'linalg/is-symmetric?', 'linalg/least-squares', 'linalg/lu',
      'linalg/matrix-power', 'linalg/null-space', 'linalg/project',
      'linalg/qr', 'linalg/rank', 'linalg/solve', 'linalg/svd',
      'linalg/trace', 'linalg/vec-add',
    ] },
  // ── Applied math (2026-07-22, completion sweep) ─────────────────
  //   All six libraries are LAZY; each carries its full VERBS list in the
  //   lib file itself. The verbs field below mirrors that for the loader
  //   to build thunks — expressing intent locally at the manifest.
  { name: 'math/phys',         install: (env, ctx) => installPhys(env, ctx.fuel),         mode: 'lazy',
    verbs: [
      'phys/L-free', 'phys/L-harmonic', 'phys/constant', 'phys/dimension',
      'phys/gravitational-force', 'phys/kinematics', 'phys/kinetic-energy',
      'phys/lagrange-residual', 'phys/lagrangian-action', 'phys/nbody',
      'phys/q*', 'phys/q+', 'phys/q/', 'phys/quantity', 'phys/quantity->tag',
      'phys/rlc-damping', 'phys/same-dimension?', 'phys/uncertainty-add',
      'phys/uncertainty-mul',
    ] },
  { name: 'math/solve',        install: (env, ctx) => installSolve(env, ctx.fuel),        mode: 'lazy',
    verbs: [
      'solve/completing-square', 'solve/distance', 'solve/interest',
      'solve/linear', 'solve/midpoint', 'solve/percent-change',
      'solve/proportion', 'solve/pythagorean-triple?', 'solve/quadratic',
      'solve/slope-intercept', 'solve/system-2x2', 'solve/unit-circle',
      'solve/vertex',
    ] },
  { name: 'math/comb',         install: (env, ctx) => installComb(env, ctx.fuel),         mode: 'lazy',
    verbs: [
      'comb/bell', 'comb/binomial-coeffs', 'comb/catalan', 'comb/choose',
      'comb/derangement', 'comb/factorial', 'comb/multichoose',
      'comb/multinomial', 'comb/partition-count', 'comb/pascal-row',
      'comb/pascal-triangle', 'comb/permute', 'comb/stirling2',
    ] },
  { name: 'math/seq',          install: (env, ctx) => installSeq(env, ctx.fuel),          mode: 'lazy',
    verbs: [
      'seq/arithmetic', 'seq/arithmetic-sum', 'seq/fibonacci', 'seq/geometric',
      'seq/geometric-inf-sum', 'seq/geometric-sum', 'seq/lucas', 'seq/nth-term',
      'seq/partial-sums', 'seq/product', 'seq/recurrence', 'seq/sigma',
    ] },
  { name: 'math/stat',         install: (env, ctx) => installStat(env, ctx.fuel),         mode: 'lazy',
    verbs: [
      'stat/count', 'stat/histogram', 'stat/histogram-counts', 'stat/iqr',
      'stat/max', 'stat/mean', 'stat/median', 'stat/min', 'stat/mode',
      'stat/probability', 'stat/quartile', 'stat/range', 'stat/sd',
      'stat/sd-sample', 'stat/sum', 'stat/variance', 'stat/variance-sample',
      'stat/z-score',
    ] },
  { name: 'graphics/plot',     install: (env, ctx) => installPlot(env, ctx.fuel),         mode: 'lazy',
    verbs: [
      'plot/bar', 'plot/contour', 'plot/fit-grid', 'plot/from-series',
      'plot/function', 'plot/histogram', 'plot/line', 'plot/nice-domain',
      'plot/parametric', 'plot/phase-portrait', 'plot/render-svg',
      'plot/scatter', 'plot/vector-field', 'plot/with',
    ] },
]

export const EAGER = MANIFEST.filter(m => m.mode === 'eager')
export const LAZY  = MANIFEST.filter(m => m.mode === 'lazy')

// DESIGN NOTE — auto-discovery (deferred, see 2026-07-22 conversation)
//   The intent (Alfred): every file in lib/**/*.js registers on boot; a
//   file can mark itself lazy via `export const LAZY = true` and list its
//   verbs via `export const VERBS = [...]`. Auto-discovery replaces this
//   manifest entirely. Blocked on: some lib files have module-load-time
//   side effects that hang top-level await. Once each installer is proven
//   side-effect-free at import time, switch to auto-discovery.
