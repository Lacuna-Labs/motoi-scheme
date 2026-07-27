// game-extras.js — eager wrapper around lib/game/game-theory.js.
//
// Provenance: 2026-07-22. The 21 game-theory verbs live in
// lib/game/game-theory.js and are registered as LAZY in the manifest.
// But `bin/motoi run` uses installCore() which does not include the
// lazy manifest. Games need these verbs at the prompt for
// arcade-game carts (Nim, tic-tac-toe, surreal-based puzzles) and for
// the Book of Arcade Games chapters on game theory.
//
// This module is imported eagerly by installCore so the verbs are
// bound at boot without any (require ...) dance. It delegates to the
// installer in game-theory.js — no logic duplication.
//
// Kid-readable comment: this is where nim, surreals, and tic-tac-toe
// get plugged into the language so you can just type (game/nim-sum 1 2 3)
// at the prompt and see the answer.

import { installGameTheory } from './game-theory.js'


// ── inline registration metadata (2026-07-22) ────────────────────
// See engineering/HOW-TO-REGISTER-A-VERB.md.
export const VERBS = [
  'game/grundy',
  'game/mex',
  'game/nim-outcome',
  'game/nim-sum',
  'game/star-n',
  'game/surreal',
  'game/surreal-add',
  'game/surreal-birthday',
  'game/surreal-eq?',
  'game/surreal-is-number?',
  'game/surreal-le?',
  'game/surreal-lit',
  'game/surreal-mul',
  'game/surreal-neg',
  'game/surreal-simplest',
  'game/surreal-sub',
  'game/temperature',
  'game/to-real',
  'game/ttt-best-move',
  'game/ttt-value',
  'game/wythoff-p?',
]
export const LAZY = false
export const BOOK = 'book-of-arcade-games/appendix-verbs-cookbook'
export const TESTS = [
  ['(game/nim-sum 1 2 3)', '0'],
  ['(game/mex (list 0 1 3))', '2'],
  ['(game/nim-outcome (list 1 2 3))', 'P'],
  ['(game/wythoff-p? 3 5)', '#t'],
  ['(game/ttt-value (list (quote x) (quote o) (quote -) (quote -) (quote x) (quote -) (quote -) (quote -) (quote o)))', 'draw'],
]

export function installGameExtras (env, ctx) {
  // Delegate to the canonical installer. game-theory.js takes only env.
  installGameTheory(env)
  return env
}

export default installGameExtras
