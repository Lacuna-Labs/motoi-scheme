// game-theory.js — combinatorial game theory kit.
//
// Provenance: scheme-lang/src/game-theory.js. Migrated to
// motoi-scheme/lib/game/ on 2026-07-16 (Pass-3 Wave 1). Dialect-
// neutral pure math; no content changes.
//
// Pure functions. No state, no I/O, no external deps.
//   · Nim arithmetic          — nim-sum (XOR), nim-outcome (P vs N)
//   · Mex + Grundy            — the recursive theory of impartial games
//   · Wythoff's game          — golden-ratio losing positions
//   · Star-n and surreals     — {L|R} construction, birthday, ordering
//   · Tic-tac-toe             — minimax value + best-move
//
// Everything here composes: nimbers are surreals, surreal-eq? is game-
// equality, game/temperature reads the hot part of a game value.
//
// Provenance: Conway (On Numbers and Games), Berlekamp/Conway/Guy
// (Winning Ways). Surreal internals as ({L|R}) records where L, R are
// lists of surreals. Value 0 = ({},{}). Value 1 = ({0},{}).
//
// Kid-readable comment: this is the "math of games where two players
// take turns and neither has hidden information" — Nim, tic-tac-toe,
// Wythoff. A surreal number is a game seen sideways: what values can
// each player reach next?

import { Sym } from '../../src/reader.js'
import { apply } from '../../src/interp.js'

// BUG (Zane-2, 2026-07-17): accept both JS functions and Scheme Closures.
// The same-shape check used across the codebase — matches game.js:355,
// scheduler.js, game-instances.js. Previously typeof-only, so passing a
// Scheme (lambda (state) …) to (game/grundy) silently returned 0.
const _isCallable = (fn) => typeof fn === 'function' || !!(fn && fn.params)
const _callFn = (fn, args) => (typeof fn === 'function'
  ? fn(...args)
  : apply(fn, args, { n: 200000 }))

// ── nimber / surreal shapes ────────────────────────────────────────────

// A nimber *n is represented as { kind: 'star', n }. game/nim-sum on
// nimbers returns a raw integer (their XOR), matching Conway's algebra.
export const isNimber = (x) =>
  x && typeof x === 'object' && !Array.isArray(x) && x.kind === 'star'

// A surreal number is { kind: 'surreal', L, R } where L and R are
// arrays of surreals. The two canonical constants: zero + one.
export function surreal(L, R) {
  return { kind: 'surreal', L: L || [], R: R || [] }
}
export const isSurreal = (x) =>
  x && typeof x === 'object' && !Array.isArray(x) && x.kind === 'surreal'

const ZERO = surreal([], [])
const ONE = surreal([ZERO], [])

// ── nim arithmetic ─────────────────────────────────────────────────────

// nim-sum = XOR fold. Works for a variadic call and for a list arg.
export function nimSum(...args) {
  let heaps = args
  if (args.length === 1 && Array.isArray(args[0])) heaps = args[0]
  let x = 0
  for (const h of heaps) x ^= (Number(h) | 0)
  return x
}

// Classify a Nim position: N-position if first player wins, P-position
// (previous-player-wins, i.e. losing for whoever moves) otherwise.
// Return a Sym so Scheme sees 'N or 'P.
export function nimOutcome(heaps) {
  const h = Array.isArray(heaps) ? heaps : [heaps]
  const x = nimSum(h)
  return x === 0 ? new Sym('P') : new Sym('N')
}

// mex — minimum excludant. Smallest non-negative integer not in the set.
// Used to compute Grundy numbers of impartial-game options.
export function mex(numbers) {
  if (!Array.isArray(numbers)) return 0
  const s = new Set(numbers.map((n) => Number(n) | 0).filter((n) => n >= 0))
  for (let i = 0; i < 1e6; i++) if (!s.has(i)) return i
  return 0
}

// game/grundy — Grundy number of an impartial-game position given a
// state (opaque token) and a move-generator (fn state -> list-of-states).
// Uses depth-first memoized recursion; blows up on infinite games so
// callers must ensure state-space is finite.
export function grundy(state, movesFn, memo = new Map()) {
  if (!_isCallable(movesFn)) return 0
  const key = grundyKey(state)
  if (memo.has(key)) return memo.get(key)
  memo.set(key, 0) // guard against self-cycles
  let moves
  try { moves = _callFn(movesFn, [state]) } catch { return 0 }
  if (!Array.isArray(moves) || moves.length === 0) {
    memo.set(key, 0)
    return 0
  }
  const childGrundys = moves.map((m) => grundy(m, movesFn, memo))
  const g = mex(childGrundys)
  memo.set(key, g)
  return g
}
function grundyKey(state) {
  if (Array.isArray(state)) return '[' + state.map(grundyKey).join(',') + ']'
  if (state && typeof state === 'object') return JSON.stringify(state)
  return String(state)
}

// ── star-n construction ────────────────────────────────────────────────

export function starN(n) {
  return { kind: 'star', n: Number(n) | 0 }
}

// ── Wythoff's game — golden-ratio P-positions ─────────────────────────

// (a,b) is a P-position iff (a,b) = (⌊k·φ⌋, ⌊k·φ²⌋) for some k >= 0.
// Uses Beatty's theorem; runs in O(min(a,b)/φ) which is plenty fast.
export function wythoffP(a, b) {
  const A = Number(a) | 0
  const B = Number(b) | 0
  if (A < 0 || B < 0) return false
  const phi = (1 + Math.sqrt(5)) / 2
  const lo = Math.min(A, B)
  const hi = Math.max(A, B)
  for (let k = 0; k <= lo + 1; k++) {
    if (Math.floor(k * phi) === lo && Math.floor(k * phi * phi) === hi) return true
  }
  return false
}

// ── surreal equality + ordering ────────────────────────────────────────
//
// Two surreals x, y satisfy x ≤ y iff:
//   no left-option of x is ≥ y, and no right-option of y is ≤ x
// Conway's definition — recursion terminates because L/R chains bottom
// out at zero (empty lists). We memoize by JSON key; safe because
// surreal trees are finite in practice.
export function surrealLe(x, y) {
  const key = 'le:' + surrealKey(x) + '|' + surrealKey(y)
  if (LE_CACHE.has(key)) return LE_CACHE.get(key)
  LE_CACHE.set(key, true) // optimistic cycle guard
  if (!isSurreal(x) || !isSurreal(y)) {
    LE_CACHE.set(key, false)
    return false
  }
  for (const xl of x.L) {
    if (surrealLe(y, xl)) { LE_CACHE.set(key, false); return false }
  }
  for (const yr of y.R) {
    if (surrealLe(yr, x)) { LE_CACHE.set(key, false); return false }
  }
  LE_CACHE.set(key, true)
  return true
}
const LE_CACHE = new Map()

export function surrealEq(x, y) {
  return surrealLe(x, y) && surrealLe(y, x)
}

function surrealKey(x) {
  if (!isSurreal(x)) return 'nan'
  return '{' + x.L.map(surrealKey).join(',') + '|' + x.R.map(surrealKey).join(',') + '}'
}

// A surreal is a "number" (Conway) iff every left-option is strictly
// less than every right-option. Fuzzy games (like *) violate this.
export function surrealIsNumber(x) {
  if (!isSurreal(x)) return false
  for (const xl of x.L) {
    for (const xr of x.R) {
      if (!surrealLe(xl, xr) || surrealEq(xl, xr)) return false
    }
  }
  return true
}

// Birthday = 1 + max birthday of any option. Empty is day 0.
export function surrealBirthday(x) {
  if (!isSurreal(x)) return 0
  let max = -1
  for (const o of x.L.concat(x.R)) {
    const b = surrealBirthday(o)
    if (b > max) max = b
  }
  return max + 1
}

// Negation: −{L | R} = {−R | −L}. Swap sides, negate everything.
export function surrealNeg(x) {
  if (!isSurreal(x)) return ZERO
  return surreal(x.R.map(surrealNeg), x.L.map(surrealNeg))
}

// Addition: x + y = { xL+y ∪ x+yL | xR+y ∪ x+yR }. Memoized.
export function surrealAdd(x, y) {
  if (!isSurreal(x) || !isSurreal(y)) return ZERO
  const key = surrealKey(x) + '+' + surrealKey(y)
  if (ADD_CACHE.has(key)) return ADD_CACHE.get(key)
  const result = surreal(
    x.L.map((xl) => surrealAdd(xl, y)).concat(y.L.map((yl) => surrealAdd(x, yl))),
    x.R.map((xr) => surrealAdd(xr, y)).concat(y.R.map((yr) => surrealAdd(x, yr))),
  )
  ADD_CACHE.set(key, result)
  return result
}
const ADD_CACHE = new Map()

export function surrealSub(x, y) {
  return surrealAdd(x, surrealNeg(y))
}

// Multiplication: Conway's rule. Exponential worst case; memoize.
export function surrealMul(x, y) {
  if (!isSurreal(x) || !isSurreal(y)) return ZERO
  const key = surrealKey(x) + '*' + surrealKey(y)
  if (MUL_CACHE.has(key)) return MUL_CACHE.get(key)
  MUL_CACHE.set(key, ZERO) // cycle guard
  const term = (a, b) =>
    surrealSub(surrealAdd(surrealMul(a, y), surrealMul(x, b)), surrealMul(a, b))
  const newL = []
  const newR = []
  for (const xl of x.L) for (const yl of y.L) newL.push(term(xl, yl))
  for (const xr of x.R) for (const yr of y.R) newL.push(term(xr, yr))
  for (const xl of x.L) for (const yr of y.R) newR.push(term(xl, yr))
  for (const xr of x.R) for (const yl of y.L) newR.push(term(xr, yl))
  const result = surreal(newL, newR)
  MUL_CACHE.set(key, result)
  return result
}
const MUL_CACHE = new Map()

// surreal-lit — canonical surreal for a dyadic rational (n / 2^k).
// Returns the Sym 'nan for non-dyadic inputs.
export function surrealLit(q) {
  const n = Number(q)
  if (!Number.isFinite(n)) return new Sym('nan')
  if (Number.isInteger(n)) {
    if (n === 0) return ZERO
    if (n > 0) return surreal([surrealLit(n - 1)], [])
    return surreal([], [surrealLit(n + 1)])
  }
  let denom = 1
  let val = n
  while (!Number.isInteger(val) && denom < 1 << 20) {
    val *= 2
    denom *= 2
  }
  if (!Number.isInteger(val)) return new Sym('nan')
  const p = val, q2 = denom
  return simplestBetween((p - 1) / q2, (p + 1) / q2)
}

// simplest-between — the dyadic-rational surreal strictly between lo
// and hi, following the "simpler is earlier birthday" rule. Returns
// 'nan if lo >= hi.
export function simplestBetween(loRaw, hiRaw) {
  const lo = Number(loRaw)
  const hi = Number(hiRaw)
  if (!(lo < hi)) return new Sym('nan')
  if (lo < 0 && 0 < hi) return ZERO
  for (let n = Math.ceil(lo + 1e-12); n <= Math.floor(hi - 1e-12); n++) {
    if (lo < n && n < hi) {
      if (n === 0) return ZERO
      if (n > 0) return surreal([surrealLit(n - 1)], [])
      return surreal([], [surrealLit(n + 1)])
    }
  }
  for (let k = 1; k < 30; k++) {
    const d = 1 << k
    for (let p = Math.ceil(lo * d + 1e-12); p <= Math.floor(hi * d - 1e-12); p++) {
      if ((p & 1) === 0) continue
      const q = p / d
      if (lo < q && q < hi) {
        return surreal(
          [simplestBetween(lo, q)],
          [simplestBetween(q, hi)],
        )
      }
    }
  }
  return new Sym('nan')
}

// to-real — the real-number value of a surreal (if it's a number).
// Non-numbers → 'nan.
export function surrealToReal(x) {
  if (!isSurreal(x)) return new Sym('nan')
  if (!surrealIsNumber(x)) return new Sym('nan')
  if (x.L.length === 0 && x.R.length === 0) return 0
  const lVals = x.L.map(surrealToReal).filter((v) => typeof v === 'number')
  const rVals = x.R.map(surrealToReal).filter((v) => typeof v === 'number')
  const lMax = lVals.length ? Math.max(...lVals) : -Infinity
  const rMin = rVals.length ? Math.min(...rVals) : Infinity
  if (lMax >= rMin) return new Sym('nan')
  if (lMax < 0 && 0 < rMin) return 0
  for (let n = Math.ceil(lMax + 1e-12); n <= Math.floor(rMin - 1e-12); n++) {
    if (lMax < n && n < rMin) return n
  }
  for (let k = 1; k < 30; k++) {
    const d = 1 << k
    for (let p = Math.ceil(lMax * d + 1e-12); p <= Math.floor(rMin * d - 1e-12); p++) {
      if ((p & 1) === 0) continue
      const q = p / d
      if (lMax < q && q < rMin) return q
    }
  }
  return new Sym('nan')
}

// temperature — the "heat" of a game position. For number-valued
// surreals, temperature = 0. For fuzzy games, we return a
// Left-stop − Right-stop approximation (non-negative half).
// Full thermographic analysis is expensive and would need a backend.
export function temperature(x) {
  if (isNimber(x) && x.n > 0) return 1
  if (!isSurreal(x)) return 0
  if (surrealIsNumber(x)) return 0
  const lVals = x.L.map(surrealToReal).filter((v) => typeof v === 'number')
  const rVals = x.R.map(surrealToReal).filter((v) => typeof v === 'number')
  const lMax = lVals.length ? Math.max(...lVals) : -Infinity
  const rMin = rVals.length ? Math.min(...rVals) : Infinity
  if (!Number.isFinite(lMax) || !Number.isFinite(rMin)) return 0
  return Math.max(0, (lMax - rMin) / 2)
}

// ── tic-tac-toe ────────────────────────────────────────────────────────
//
// Board is a list of 9 cells, index 0..8 in row-major order.
// Each cell is 'x, 'o, or '- (or empty / nil / 0 for empty).

const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function tttCell(v) {
  if (v instanceof Sym) return v.name
  if (v === null || v === undefined) return '-'
  const s = String(v)
  if (s === 'x' || s === 'X') return 'x'
  if (s === 'o' || s === 'O') return 'o'
  return '-'
}

function tttWinner(board) {
  for (const [a, b, c] of TTT_LINES) {
    if (board[a] !== '-' && board[a] === board[b] && board[b] === board[c]) {
      return board[a]
    }
  }
  return null
}

function tttTurn(board) {
  let xs = 0, os = 0
  for (const c of board) { if (c === 'x') xs++; else if (c === 'o') os++ }
  return xs === os ? 'x' : 'o'
}

function tttMinimax(board, player, memo) {
  const key = board.join('') + player
  if (memo.has(key)) return memo.get(key)
  const w = tttWinner(board)
  if (w === 'x') { memo.set(key, 1); return 1 }
  if (w === 'o') { memo.set(key, -1); return -1 }
  const empties = []
  for (let i = 0; i < 9; i++) if (board[i] === '-') empties.push(i)
  if (empties.length === 0) { memo.set(key, 0); return 0 }
  const other = player === 'x' ? 'o' : 'x'
  let best = player === 'x' ? -Infinity : Infinity
  for (const i of empties) {
    board[i] = player
    const s = tttMinimax(board, other, memo)
    board[i] = '-'
    if (player === 'x') { if (s > best) best = s } else { if (s < best) best = s }
  }
  memo.set(key, best)
  return best
}

export function tttValue(rawBoard) {
  const board = tttNormalize(rawBoard)
  if (!board) return new Sym('nan')
  const w = tttWinner(board)
  if (w === 'x') return new Sym('x-win')
  if (w === 'o') return new Sym('o-win')
  const empties = board.filter((c) => c === '-').length
  if (empties === 0) return new Sym('draw')
  const memo = new Map()
  const s = tttMinimax(board.slice(), tttTurn(board), memo)
  if (s > 0) return new Sym('x-win')
  if (s < 0) return new Sym('o-win')
  return new Sym('draw')
}

export function tttBestMove(rawBoard) {
  const board = tttNormalize(rawBoard)
  if (!board) return new Sym('nan')
  const w = tttWinner(board)
  if (w) return new Sym('nan')
  const empties = []
  for (let i = 0; i < 9; i++) if (board[i] === '-') empties.push(i)
  if (empties.length === 0) return new Sym('nan')
  const player = tttTurn(board)
  const other = player === 'x' ? 'o' : 'x'
  const memo = new Map()
  let bestIdx = empties[0]
  let bestScore = player === 'x' ? -Infinity : Infinity
  for (const i of empties) {
    board[i] = player
    const s = tttMinimax(board, other, memo)
    board[i] = '-'
    if (player === 'x') {
      if (s > bestScore) { bestScore = s; bestIdx = i }
    } else {
      if (s < bestScore) { bestScore = s; bestIdx = i }
    }
  }
  return bestIdx
}

function tttNormalize(board) {
  if (!Array.isArray(board) || board.length !== 9) return null
  return board.map(tttCell)
}

// ── entry point — install into a Scheme env ────────────────────────────

export function installGameTheory(env) {
  const def = (n, f, perm = 'read') => env.define(n, f, { perm })

  // nim
  def('game/nim-sum', (...args) => nimSum(...args))
  def('game/nim-outcome', (...args) => {
    const heaps = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
    return nimOutcome(heaps)
  })
  def('game/mex', (xs) => mex(xs))
  def('game/grundy', (state, movesFn) => grundy(state, movesFn))
  def('game/star-n', (n) => starN(n))
  def('game/wythoff-p?', (a, b) => wythoffP(a, b))

  // surreal construction + predicates + arithmetic
  def('game/surreal', (L, R) => surreal(L, R))
  def('game/surreal-lit', (q) => surrealLit(q))
  def('game/surreal-simplest', (lo, hi) => simplestBetween(lo, hi))
  def('game/surreal-eq?', (x, y) => surrealEq(x, y))
  def('game/surreal-le?', (x, y) => surrealLe(x, y))
  def('game/surreal-is-number?', (x) => surrealIsNumber(x))
  def('game/surreal-birthday', (x) => surrealBirthday(x))
  def('game/surreal-neg', (x) => surrealNeg(x))
  def('game/surreal-add', (x, y) => surrealAdd(x, y))
  def('game/surreal-sub', (x, y) => surrealSub(x, y))
  def('game/surreal-mul', (x, y) => surrealMul(x, y))
  def('game/to-real', (x) => surrealToReal(x))
  def('game/temperature', (x) => temperature(x))

  // tic-tac-toe
  def('game/ttt-value', (board) => tttValue(board))
  def('game/ttt-best-move', (board) => tttBestMove(board))

  return env
}

export default installGameTheory
