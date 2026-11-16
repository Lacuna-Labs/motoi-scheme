#!/usr/bin/env python3
"""layers-solve.py — THE LAYER ORDER'S INTEGER PROGRAM, A PROBE IN THE PRODUCT'S INTERPRETER (lane 13a).

Owns: one linear ordering problem, solved and proven by the interpreter's own solver (scipy's milp): the order of the
groups bottom to top with the fewest upward imports, ties to the group more depended-on. One 0/1 variable per pair of
groups says which of the two sits lower; one constraint per triple keeps the answers a single order. Why Python: the
proven order must stay exact, Node has no integer-program solver and the house adds no dependency; the owner allows
Python at a seam where it is necessary (the lead's ruling (a) in lane 13a). Without it (a product with no `(python …)`
row, or an interpreter without scipy, or a solver that stops before the optimum) layers.mjs keeps its local search and
writes `method: "local search, not proven"`, `proven: false`. Refuses: any table logic (layers.mjs does the rest); an
answer it did not prove (it prints null). Implements: the lane 13 brief, 13a step 2. Invariants: the same input gives
the same order. Faults: none.

    <interpreter> layers-solve.py <problem.json>     problem: {"groups": [...], "w": [[a, b, n], ...]}
                                                      prints: {"order": [...]} or null
"""
import collections
import json
import sys


def exact_order(groups, w, time_limit=120):
    try:
        import numpy as np
        from scipy.optimize import Bounds, LinearConstraint, milp
        from scipy.sparse import coo_matrix
    except ImportError:
        return None
    n = len(groups)
    if n < 2:
        return list(groups)
    at = {(i, j): k for k, (i, j) in enumerate((i, j) for i in range(n) for j in range(i + 1, n))}
    score = collections.Counter()
    for (a, b), m in w.items():
        score[b] += m
        score[a] -= m
    cost = np.zeros(len(at))
    tie = np.zeros(len(at))
    for (i, j), k in at.items():
        cost[k] = w.get((groups[i], groups[j]), 0) - w.get((groups[j], groups[i]), 0)
        tie[k] = score[groups[j]] - score[groups[i]]
    tie *= 0.5 / (np.abs(tie).sum() + 1)
    rows, cols, vals, r = [], [], [], 0
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                rows += [r, r, r]
                cols += [at[(i, j)], at[(j, k)], at[(i, k)]]
                vals += [1, 1, -1]
                r += 1
    cons = LinearConstraint(coo_matrix((vals, (rows, cols)), shape=(r, len(at))).tocsr(), 0, 1) if r else ()
    res = milp(cost + tie, integrality=np.ones(len(at)), bounds=Bounds(0, 1), constraints=cons,
               options={'mip_rel_gap': 0, 'time_limit': time_limit})
    if res.status != 0 or res.x is None:
        return None
    y = np.rint(res.x)
    below = [0] * n
    for (i, j), k in at.items():
        below[j if y[k] else i] += 1
    return [groups[i] for i in sorted(range(n), key=lambda i: below[i])]


if __name__ == '__main__':
    problem = json.load(open(sys.argv[1]))
    w = {(a, b): n for a, b, n in problem['w']}
    order = exact_order(problem['groups'], w)
    print(json.dumps(None if order is None else {'order': order}))
