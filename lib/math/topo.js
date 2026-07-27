// topo.js — thin re-export of the base/topo.js impls.
//
// The actual topology implementations (f-vector, betti, persistence,
// bottleneck, Vietoris-Rips, knot invariants, all 27+ verbs) live in
// lib/base/topo.js. That's a 1,400-line honest impl authored by Rin
// on 2026-07-14 and refined during the descriptor-shape sweep.
//
// This file exists to satisfy the lane instruction that topo lives
// under lib/math/. It re-exports the installer so both spellings work:
//   import { installTopo } from '../lib/math/topo.js'   ← new
//   import { installTopo } from '../lib/base/topo.js'   ← original
//
// See engineering/HOW-TO-REGISTER-A-VERB.md.

export {
  installTopo,
  default,
  VERBS,
  LAZY,
} from '../base/topo.js'

export const BOOK = 'book-of-math/ch-advanced-06-topology'
export const TESTS = [
  ['(topo/f-vector (list (list 1 2 3)))', '(3 3 1)'],
  ['(topo/euler-char (list (list 1 2 3)))', '1'],
  ['(topo/betti (topo/complex (list (list 1 2 3))))', '(1)'],
  ['(topo/components (topo/graph (list (list 1 2) (list 3 4))))', '((1 2) (3 4))'],
]
