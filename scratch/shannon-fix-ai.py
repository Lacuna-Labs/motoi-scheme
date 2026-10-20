#!/usr/bin/env python3
import io

P = 'scheme/reference/02-ai.slat'
s = io.open(P, encoding='utf-8').read()

# ---------------------------------------------------------------- bb-get
# This example is the 1-of-33 call site written key-first; every other call in
# the chapter, and all four :signature fields, are id-first. It also tested the
# miss with (not target), but a miss is the symbol 'no-key, which is truthy.
A = ("(define my-entity 'my-entity)\\n(ai/bb-set! 'patrol-target (list 50 75) my-entity)\\n"
     "(let ((target (ai/bb-get 'patrol-target my-entity)))\\n  (if (not target)\\n"
     "      (display \\\"No target\\\")\\n      (ai/arrive my-entity (car target) (cadr target))))")
B = ("(define my-entity 'my-entity)\\n(ai/bb-set! my-entity 'patrol-target (list 50 75))\\n"
     "(let ((target (ai/bb-get my-entity 'patrol-target)))\\n  (if (eq? target 'no-key)\\n"
     "      (display \\\"No target\\\")\\n      (ai/arrive my-entity (car target) (cadr target))))")
assert s.count(A) == 1, ('bb-get example', s.count(A))
s = s.replace(A, B)

# ------------------------------------------------------------ ai/waypoints
HEAD = '  :name "ai/waypoints" :std "Motoi"\n  :library "ai"\n  :kind "pure"\n'
NOTE = (
  '  :status "needs-alfred"\n'
  '  :status-note "MISSING SUBSYSTEM (Shannon 2026-08-02) - not a bug, a feature that was '
  'never built. This record documents ai/waypoints as the converter from an A* cell path to '
  'world-space centres, and ai/path (:1734) as (ai/path grid sx sy tx ty) -> list-of-cells or '
  'the no-path sentinel, i.e. an A* pathfinder over a nav grid. NEITHER EXISTS. The only '
  'definitions in the tree are lib/ai/steering.js:424, where ai/waypoints is a SETTER that '
  'stores a named waypoint list and returns #t, and :431, where ai/path is a one-argument '
  'lookup of that stored list. There is no A* anywhere in lib/. Three examples here fail the '
  'chapter gate because they call length on the #t the setter returns. Closing this means '
  'writing a pathfinder and answering four things the reference does not settle. (a) ai/grid '
  'is documented (ai/grid cols rows [cell]) -> grid id at :1544 but implemented as (cols rows) '
  'returning the dims list, and ai/wall! / ai/passable? key off a single hard-coded default '
  'grid, so there is no grid id to pass and no cell size. (b) With no cell size there is no '
  'defined world coordinate for a cell centre. (c) 4-connected or 8-connected movement is '
  'unspecified. (d) This record contradicts itself on the arity of ai/path: the fifth example '
  'calls it with two coordinate PAIRS while the signature and the other examples pass five '
  'scalars. Replacing the existing ai/waypoints setter would also break the steering records '
  'that use it. Not inventable - needs a decision."\n')
assert s.count(HEAD) == 1, 'waypoints head'
s = s.replace(HEAD, HEAD + NOTE)

io.open(P, 'w', encoding='utf-8').write(s)
print('02-ai patched')
