// num-integrate.js — numerical integration via Simpson's rule.
//
// Installs 2 verbs:
//   num/nintegrate-2d — double integral over a rectangle
//   num/nintegrate-3d — triple integral over a box
//
// Reference: scheme/reference/45-num.slat.

import { apply } from '../../src/interp.js'

import { isList, seqVerb } from '../base/list.js'
// Composite Simpson's rule on 1D. n = number of subintervals (must be even).
function simpson1D(f, a, b, n) {
  const h = (b - a) / n
  let sum = f(a) + f(b)
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * f(a + i * h)
  }
  return (sum * h) / 3
}


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  "num/nintegrate-2d",
  "num/nintegrate-3d",
]
export const LAZY = true

export function installNumIntegrate(env, fuel) {
  const def = (name, fn) => {
    Object.defineProperty(fn, '__verbName', { value: name })
    env.define(name, seqVerb(fn), { perm: 'read' })
  }

  const call2 = (f) => (x, y) => {
    const r = apply(f, [x, y], fuel)
    if (typeof r !== 'number') throw new Error('integrand must return number')
    return r
  }
  const call3 = (f) => (x, y, z) => {
    const r = apply(f, [x, y, z], fuel)
    if (typeof r !== 'number') throw new Error('integrand must return number')
    return r
  }

  const asBounds = (b, name) => {
    if (!isList(b) || b.length < 2) throw new Error(`${name}: bounds must be [lo hi]`)
    return [Number(b[0]), Number(b[1])]
  }

  def('num/nintegrate-2d', (f, xb, yb, opts) => {
    const [x0, x1] = asBounds(xb, 'num/nintegrate-2d')
    const [y0, y1] = asBounds(yb, 'num/nintegrate-2d')
    const n = 20  // 20 subintervals per axis — reasonable smoothness assumption
    const fEval = call2(f)
    // Integrate over y for each x-sample, then over x
    return simpson1D((x) => simpson1D((y) => fEval(x, y), y0, y1, n), x0, x1, n)
  })

  def('num/nintegrate-3d', (f, xb, yb, zb, opts) => {
    const [x0, x1] = asBounds(xb, 'num/nintegrate-3d')
    const [y0, y1] = asBounds(yb, 'num/nintegrate-3d')
    const [z0, z1] = asBounds(zb, 'num/nintegrate-3d')
    const n = 12  // fewer per axis — 3D grows O(n^3)
    const fEval = call3(f)
    return simpson1D(
      (x) => simpson1D(
        (y) => simpson1D((z) => fEval(x, y, z), z0, z1, n),
        y0, y1, n),
      x0, x1, n)
  })

  return env
}

export default installNumIntegrate
