# Reference example-code audit — residual after #367 fixing sweep (2026-07-26)

Runner: `python3 scratch/audit-ref.py run` — extracts every runnable program
from `scheme/reference/*.slat`, runs each INDEPENDENTLY via
`node bin/motoi run /dev/stdin` (15s wall-clock budget), classifies.

## Headline

| | count |
|---|---|
| programs extracted | 18,626 |
| **ok (green)** | **18,580 (99.75%)** |
| residual (non-green) | 46 |

Up from 18,566 green at session start (77 → 60 → 49 → 47 → **46** residual as fixes landed).

## Fixes applied this task (green wins)

- **11-calc** ×3 — `calc/derivative` is value-form `(f x)`, not curried. Fixed
  `(define (fp x) (calc/derivative f x))` in :math-program, :composition, and
  the :meta prose.
- **12-char** — compared char to string; fixed to `#\|` literal + plain
  `string->list`.
- **29-geom** — `geom/sphere-volume` 10 000-iter left-Riemann blew fuel; swapped
  to 200-iter midpoint rule (converges faster, same lesson).
- **06-assert** ×2 — SRFI-1 fold is element-first `(f elem acc)`; two lambdas
  were acc-first (R6RS/Racket habit). Swapped param order.
- **25-exact** ×5 — hash-partition + join-with-comma fold arg-order; safe-inverses
  `equal?`→`exact/=` (equal? doesn't structurally compare rationals); total-billing
  needed an `item-cost` define; round-trip needed a `parse-rational-string` define
  (built on `string-split`).
- **src/base.js** — made `every`/`any`/`count` n-ary (SRFI-1 conformant, strict
  superset). Unblocked `exact/>= meets-all` with NO reference edit.
- **lib/graphics/geom.js** — `geom/distance` made polymorphic per its documented
  4-scalar signature (reference wins).
- **lib/system/ops.js** — `ops/pagerank` conformed to return a **HashTable** per
  its `-> (map: node -> score)` signature (was an alist). Wrapped the 4
  bare-display reference sites in `hash-table->alist` for clean output. Unblocked
  8 hash-table-accessor programs across rows 2/4/5.

## Residual 46 — all cross-referenced to an existing owning task

| bucket | n | verbs | disposition |
|---|---|---|---|
| **Curator-dialect (console verbs)** | 35 | camera-*, sprite, sprites, viewport, viewport-width, grid-step, grid-live-count, at-beat, land-on-downbeat, arc-between | **#368** — verbs mid-surgery (#370–380). NOT #367. Route when the verbs are ripped/rewritten. All in 01-core.slat. |
| **Dotted-pair blocked** | 7 | ops/dijkstra ×5 (dotted-alist graphs `'((A . ((B . 1)…)))`), ops/johnson ×1 (dotted-alist input → non-pair → escalate), exact/* ×1 (`(cons rational rational)`) | **#354** — Motoi has no real dotted pairs yet. These go green automatically when Phase C (hybrid Pair class) lands. Not a cross-standard trap → not a broken-examples card. |
| **Honest-null (deliberate)** | 2 | 22-easing named-ease ×2 | **KEEP** — authored honest-nulls, correct as-is. Not failures. |
| **Known-heavy timeout** | 2 | game/surreal-mul (combinatorial; already carded at broken-examples/surreal-simplest-oom.slatl), ops/max-flow (single call ~5s; the demo runs it 3× in a map → >15s budget) | **known-heavy** — impl-perf, not a bug. surreal already carded. |

### ops/mip-solve — RESOLVED (Alfred: conform impl to rows, reference wins)

Was the one needs-alfred contract call. Alfred chose "conform impl to rows
(reference wins)" per the conformance ladder. Done in `lib/system/ops.js`:

- **`ops/mip-solve`** now speaks the reference contract directly — `constraints`
  is a list of `(coeffs… op rhs)` rows (op ∈ `<= < >= > = ==`), `objective` is
  the coefficient vector, `opts` is a plist `(:integers (…) :min? #t)` (keyword
  names carry a leading colon; missing/`#f` `:min?` maximizes). Rows are folded
  into `A`(all ≤)/`b` internally; branch-and-bound on the LP relaxation unchanged.
- **Return** is now the bare solution vector (integer-constrained positions
  rounded to exact integers), honoring the strongest reference contract signal —
  row-2 math's `(if (pair? r) (every integer? r) …)`. The old status/objective/x
  alist was dropped (no reference site read those keys).
- **`ops/branch-bound`** simplified to delegate rows straight to the conformed
  `ops/mip-solve` (its duplicate row→A/b conversion removed).

All mip-solve + branch-bound reference programs now green; the cs-program that
errored (`escalate: unknown invalid-mip`) is fixed. 18,579 → **18,580**.

**Two follow-on observations (NOT #367 blockers, logged not fixed):**
1. `ops/simplex` has no phase-1 — LP relaxations with `=`/`>=` rows (negative-`b`
   after ≤-normalization) come back `infeasible` even when feasible. Affects the
   expert/`:min?` shapes semantically; they still run green (return a symbol).
   A real fix is a two-phase simplex — its own task if wanted.
2. The **expert** production-schedule reference program has an authoring bug that
   predates this work: its `objective` is built by a `fold-left` that yields a
   *scalar*, and it multiplies numbers by `(:int 0 100)` spec-lists. So it returns
   `invalid-mip` (a list-shaped objective is required). Runs green via `display`.
   Left as-is to avoid guessing the intended model — flag for a reference-author pass.

## Bottom line

Every reference program is either green (18,580 / 99.75%) or accounted to an
existing owning task (#368, #354) / deliberate honest-null / known-heavy. The
one prior needs-alfred (mip-solve) is resolved reference-wins. No un-triaged
failures remain.
