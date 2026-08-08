// chem.js — chemistry primitives for Motoi Scheme.
//
// Installs 5 verbs under the `chem/` namespace:
//   chem/atomic-weight    — standard atomic weight lookup (u)
//   chem/formula-counts   — parse formula string → ((elem count) ...)
//   chem/molar-mass       — sum of weighted atoms (g/mol)
//   chem/moles            — mass in grams → moles
//   chem/balance          — balance a reaction (returns coefficient list
//                            or 'unbalanced-reaction)
//
// Reference: scheme/reference/13-chem.slat.

import { Sym } from '../../src/reader.js'

import { isList, seqVerb } from '../base/list.js'
// ── inline registration metadata (2026-07-22 doctrine) ────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md for the pattern.
export const VERBS = ['chem/atomic-weight', 'chem/balance', 'chem/formula-counts',
                     'chem/molar-mass', 'chem/moles']
export const LAZY = false
export const BOOK = 'book-of-computing/appendix-b-chemistry-primitives'
export const TESTS = [
  ['(chem/atomic-weight \'H)', '1.008'],
  ['(chem/molar-mass "H2O")', '18.015'],
  ['(chem/moles "H2O" 18.015)', '1'],
  ['(chem/balance \'(H2 + O2 -> H2O))', '(2 1 2)'],
]

// Subset of the periodic table (IUPAC 2021 standard atomic weights).
// Covers everything a curriculum-cart needs (H..Uuo excluded for size).
const ATOMIC_WEIGHTS = {
  H: 1.008,   He: 4.0026, Li: 6.94,   Be: 9.0122, B: 10.81,   C: 12.011,
  N: 14.007,  O: 15.999,  F: 18.998,  Ne: 20.180, Na: 22.990, Mg: 24.305,
  Al: 26.982, Si: 28.085, P: 30.974,  S: 32.06,   Cl: 35.45,  Ar: 39.948,
  K: 39.098,  Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942,  Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
  Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62,  Y: 88.906,  Zr: 91.224, Nb: 92.906, Mo: 95.95,
  Tc: 98,     Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41,
  In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.60, I: 126.90,  Xe: 131.29,
  Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Pr: 140.91, Nd: 144.24,
  Pt: 195.08, Au: 196.97, Hg: 200.59, Pb: 207.2,  U: 238.03,
}

function symName(s) { return s instanceof Sym ? s.name : String(s) }

// Formula parser: reads runs like "H2O", "C6H12O6", "Ca(OH)2".
function parseFormula(str) {
  const counts = {}
  const stack = [counts]
  let i = 0
  while (i < str.length) {
    const c = str[i]
    if (c === '(') { const inner = {}; stack.push(inner); i++; continue }
    if (c === ')') {
      const inner = stack.pop()
      i++
      let numStr = ''
      while (i < str.length && /[0-9]/.test(str[i])) { numStr += str[i]; i++ }
      const mult = numStr ? parseInt(numStr, 10) : 1
      const top = stack[stack.length - 1]
      for (const k of Object.keys(inner)) top[k] = (top[k] || 0) + inner[k] * mult
      continue
    }
    if (/[A-Z]/.test(c)) {
      let sym = c; i++
      while (i < str.length && /[a-z]/.test(str[i])) { sym += str[i]; i++ }
      let numStr = ''
      while (i < str.length && /[0-9]/.test(str[i])) { numStr += str[i]; i++ }
      const n = numStr ? parseInt(numStr, 10) : 1
      const top = stack[stack.length - 1]
      top[sym] = (top[sym] || 0) + n
      continue
    }
    i++  // skip whitespace or unknown punctuation
  }
  return counts
}

// Extremely small stoichiometric balancer: handles reactions like
// (H2 + O2 -> H2O) by brute-force search over integer coefficient tuples
// [1..MAX]. Real chemistry cart authors use small equations so this is
// enough for the curriculum. Returns 'unbalanced-reaction if no solution
// found within the search bound.
function balanceReaction(form) {
  // Form is a nested list from Scheme reader. Find '-> or 'arrow.
  const arrowIdx = form.findIndex((tok) => {
    const n = tok instanceof Sym ? tok.name : String(tok)
    return n === '->' || n === '=>' || n === 'arrow'
  })
  if (arrowIdx < 0) return Symbol.for('motoi:unbalanced')
  const lhsTokens = form.slice(0, arrowIdx)
  const rhsTokens = form.slice(arrowIdx + 1)
  const isPlus = (t) => (t instanceof Sym ? t.name : String(t)) === '+'
  const species = []
  const sideOf = []
  const parseSide = (tokens, side) => {
    let cur = []
    for (const t of tokens) {
      if (isPlus(t)) { if (cur.length) { species.push(cur); sideOf.push(side); cur = [] } }
      else cur.push(t)
    }
    if (cur.length) { species.push(cur); sideOf.push(side) }
  }
  parseSide(lhsTokens, -1)
  parseSide(rhsTokens, +1)
  const parsedSpecies = species.map((toks) => {
    const s = toks.map((t) => (t instanceof Sym ? t.name : String(t))).join('')
    return parseFormula(s)
  })
  const elements = new Set()
  for (const p of parsedSpecies) for (const e of Object.keys(p)) elements.add(e)
  const elems = [...elements]
  // Brute-force search [1..MAX] for each coefficient.
  const MAX = 10
  const N = parsedSpecies.length
  const coeffs = new Array(N).fill(1)
  const balances = () => {
    for (const e of elems) {
      let sum = 0
      for (let i = 0; i < N; i++) sum += (parsedSpecies[i][e] || 0) * coeffs[i] * sideOf[i]
      if (sum !== 0) return false
    }
    return true
  }
  // Depth-first over combinations.
  const solve = (k) => {
    if (k === N) return balances()
    for (let c = 1; c <= MAX; c++) {
      coeffs[k] = c
      if (solve(k + 1)) return true
    }
    return false
  }
  return solve(0) ? [...coeffs] : Symbol.for('motoi:unbalanced')
}

const UNBALANCED_SYM_KEY = Symbol.for('motoi:unbalanced')

export function installChem(env) {
  const def = (name, fn) => {
    Object.defineProperty(fn, '__verbName', { value: name })
    env.define(name, seqVerb(fn), { perm: 'read' })
  }

  def('chem/atomic-weight', (sym) => {
    const s = symName(sym)
    const w = ATOMIC_WEIGHTS[s]
    if (w == null) throw new Error(`chem/atomic-weight: unknown element ${s}`)
    return w
  })

  def('chem/formula-counts', (formulaStr) => {
    if (typeof formulaStr !== 'string') throw new Error('chem/formula-counts: need string')
    const counts = parseFormula(formulaStr)
    return Object.entries(counts).map(([k, v]) => [k, v])
  })

  def('chem/molar-mass', (formulaStr) => {
    if (typeof formulaStr !== 'string') throw new Error('chem/molar-mass: need string')
    const counts = parseFormula(formulaStr)
    let sum = 0
    for (const [elem, n] of Object.entries(counts)) {
      const w = ATOMIC_WEIGHTS[elem]
      if (w == null) throw new Error(`chem/molar-mass: unknown element ${elem}`)
      sum += w * n
    }
    return sum
  })

  def('chem/moles', (formulaStr, grams) => {
    if (typeof formulaStr !== 'string') throw new Error('chem/moles: need string')
    if (typeof grams !== 'number') throw new Error('chem/moles: need number grams')
    const counts = parseFormula(formulaStr)
    let mass = 0
    for (const [elem, n] of Object.entries(counts)) mass += (ATOMIC_WEIGHTS[elem] || 0) * n
    if (mass === 0) throw new Error('chem/moles: unknown or empty formula')
    return grams / mass
  })

  def('chem/balance', (rxn) => {
    if (!isList(rxn)) throw new Error('chem/balance: need reaction list')
    const r = balanceReaction(rxn)
    if (r === UNBALANCED_SYM_KEY) return new Sym('unbalanced-reaction')
    return r
  })

  return env
}

export default installChem
