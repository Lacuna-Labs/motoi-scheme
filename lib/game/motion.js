// motion.js — CORE motion verbs beyond motion/move-to (which lives in animation.js).
//
// Doctrine: pure motion clauses. Callers pass a target id + arguments;
// verbs return tagged clauses OR mutate entity velocities in-place.
//
// motion/with-feel and motion/with-pace are dynamic-extent wrappers —
// they run a thunk with a "feel" or "pace" recorded on a small stack
// so nested motion verbs pick up the value. For CORE, the effect is
// recorded but the actual interpolation is left to the tween engine
// in animation.js — see architect-motoi-pass-3 :motion.

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'

const nm = (x) => (x instanceof Sym ? x.name : x)

const _feelStack = []
const _paceStack = []

export function currentFeel() { return _feelStack.length ? _feelStack[_feelStack.length - 1] : null }
export function currentPace() { return _paceStack.length ? _paceStack[_paceStack.length - 1] : null }

export function installMotion(env, game, fuel) {
  const _fuel = fuel ?? { n: 1_000_000 }
  const def = (n, f, perm = 'state-change') => env.define(n, f, { perm })

  // (motion/halt id) → undefined. Zero the entity's velocity.
  def('motion/halt', (id) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.vx = 0
    e.vy = 0
    return undefined
  }, 'paint')

  // (motion/drop id gravity?) → apply gravity impulse to vy.
  def('motion/drop', (id, gravity) => {
    const e = game.entities.get(String(nm(id)))
    if (!e) return undefined
    e.vy = (e.vy || 0) + (gravity ?? (game.gravity || 0.5))
    return undefined
  }, 'paint')

  // (motion/arc id peak-y duration?) → tagged clause for a parabolic arc.
  def('motion/arc', (id, peakY, duration) => [
    new Sym('motion/arc'), nm(id), Number(peakY) || 0, Number(duration) || 30,
  ])

  // (motion/follow-input id?) → tagged clause. Consumer wires an input
  // adapter; CORE returns the descriptor.
  def('motion/follow-input', (id) => [
    new Sym('motion/follow-input'), id ? String(nm(id)) : null,
  ])

  // (motion/anchor-to-input id) → tagged clause. Similar shape.
  def('motion/anchor-to-input', (id) => [
    new Sym('motion/anchor-to-input'), String(nm(id)),
  ])

  // (motion/with-feel feel thunk) — run thunk with feel recorded.
  def('motion/with-feel', (feel, thunk) => {
    _feelStack.push(nm(feel))
    try {
      if (thunk != null) return apply(thunk, [], _fuel)
      return undefined
    } finally {
      _feelStack.pop()
    }
  }, 'paint')

  // (motion/with-pace pace thunk) — run thunk with pace recorded.
  def('motion/with-pace', (pace, thunk) => {
    _paceStack.push(nm(pace))
    try {
      if (thunk != null) return apply(thunk, [], _fuel)
      return undefined
    } finally {
      _paceStack.pop()
    }
  }, 'paint')

  return env
}

export default installMotion
