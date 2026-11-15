// index.js — THE FLOOR'S RUNTIME SURFACE (lane F5-BC; RULINGS §1(b); REVIEW §5b; A8 §4.1). Owns: the one import a caller
// needs: the fold, the clock, the keyframe schema, the layout, the alarm rules, the curves, the seed, the summary, the
// vocabulary and the actors' kind table. Pure ESM: importable by the foreman under foreman.sb (this tree), by `node --test`
// and by the browser. Refuses: three, the DOM, a wall clock, `Math.random` (BC.11's purity test holds every file here to it).
// Implements: RULINGS §2 (the address) and §1(b) (the surface). Invariants (design §18): none of its own. Faults (§16): none.

export { createFold, fold, registry, actor, pose, snapshot, restore, keyframe, tick, seen, refused, readEvents, KINDS, KINDS_REACTED, EVENTS_RING } from './fold.js'
export * as clock from './clock.js'
export * as keyframeSchema from './keyframe.js'
export * as layout from './layout.js'
export * as alarms from './alarms.js'
export * as curves from './curves.js'
export * as seed from './seed.js'
export { summary, MAX_CHARS } from './summary.js'
export * as vocabulary from './vocabulary.js'
export * as actors from './actors/index.js'
