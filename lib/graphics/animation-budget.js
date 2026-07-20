// animation-budget.js — declarative animation budget + reflow policy.
//
// Doctrine (Alfred, 2026-07-16): three verbs report a global "how much
// motion is OK per frame" budget and a reflow policy (how the layout
// engine should respond when content overflows). Pure state, mutated
// by set!, read by animation lanes.

import { Sym } from '../../src/reader.js'

const state = {
  budgetMs: 16,           // default per-frame animation budget
  reflow: 'auto',         // 'auto' | 'stable' | 'reset'
}

export function __resetAnimationBudget() {
  state.budgetMs = 16
  state.reflow = 'auto'
}

export function installAnimationBudget(env, fuel) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // (animation/budget ms?) → current budget (ms). If ms passed, set it.
  def('animation/budget', (ms) => {
    if (ms != null) state.budgetMs = Math.max(0, Number(ms))
    return state.budgetMs
  }, 'paint')

  // (animation/reflow-policy) → current policy symbol.
  def('animation/reflow-policy', () => new Sym(state.reflow))

  // (animation/set-reflow-policy policy) → policy set. Accepts 'auto,
  // 'stable, 'reset. Unknown values are silently rejected.
  def('animation/set-reflow-policy', (policy) => {
    const p = policy instanceof Sym ? policy.name : String(policy)
    if (p === 'auto' || p === 'stable' || p === 'reset') state.reflow = p
    return new Sym(state.reflow)
  }, 'paint')

  return env
}

export default installAnimationBudget
