# Repurpose mapping — 9 broken chapters → pure-math application chapters
# Decision (Alfred, 2026-07-25): "Repurpose chapters to pure math."
# Constraint: every real math library ALREADY has a verb-reference chapter
# (17-complex, 38-linalg, 41-matrix, 59-stat, 20-curve, 22-easing, 29-geom,
# 11-calc, 40-math, 50-phys, 69-vec, 70-vector). So these 9 chapters CANNOT
# be verb-reference chapters (would duplicate). They become APPLICATION /
# COMPOSITION chapters: worked programs that COMPOSE documented primitives to
# do the thing the chapter is named for. Keep the number + evocative name.
# book-type: application (per BOOK-TYPES doctrine). Every program verified via
# ./bin/motoi run. No new JS (per Alfred's choice — not the "build layer" one).

| chapter     | new theme                        | composes (real, verified libs)                        |
|-------------|----------------------------------|-------------------------------------------------------|
| 42-motion   | Motion — position over time      | vec/* + easing/apply,bezier-ease,spring-ease + curve/bezier-eval,catmull-rom |
| 24-entity   | Bodies — a point with pos/vel/mass | vec/* + physics/apply-force,gravity,step (single-body kinematics/dynamics) |
| 72-world    | Worlds — many bodies + fields    | phys/nbody,gravitational-force + vec/* + calc/divergence,curl,gradient |
| 28-game     | Simulation — iterate a state     | math + calc (dynamical systems: fixed points, orbits, logistic map) |
| 48-part     | Articulated forms — hinges/joints | geom/rotate-about + matrix/* + curve/frenet-frame     |
| 55-scene    | Scenes — transform point-sets    | matrix/* + geom/transform-polygon,translate,rotate,dilate |
| 31-group    | Groups — aggregate a collection  | SRFI-1 lists + stat/mean,median,variance,histogram    |
| 53-prefab   | Templates — parametric families  | closures + lists (a spec-generator is a curried fn)   |
| 07-audio    | Waves — signal math              | math/sin + complex/* + synth (additive synthesis, frequency) |

# Pilot: 42-motion (flagship — "clever math replaces the stubs").
# Then scale to the other 8 via full-context lanes (judgment work; NOT
# phrase-locked Haiku templates — memory: parallel-templates-cause-phrase-lock).
