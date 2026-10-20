# Cart verb coverage — the measured distance to running the automations on Motoi

2026-08-02. Static: every `.sks` parsed, never executed. No model. No network.
Read-only — no cart was modified. Script `scratch/cart-verb-coverage.mjs`,
raw data `scratch/cart-verb-coverage.json`.

## What was counted

Every **head of an application form** across `automations-carts/`, `user-carts/`
and `runtime/`. Names a cart defines itself are subtracted **per file**, so a
helper defined in one cart does not excuse the same name being unbound in
another. Plist keys (`:status`), syntax (`define`, `let`, …) and quoted data are
not calls and are excluded. `λ` counts as `lambda`.

| | |
|---|---|
| carts parsed | 10,007 (843 unparseable, skipped — the pre-existing paren backlog) |
| engine bindings | 1,763 |
| distinct verbs called | 3,168 |
| resolve today | 287 |
| call sites | 889,996 |
| **call sites that resolve today** | **590,667 — 66.4%** |
| call sites that do not | 299,329 — 33.6% |

## The number that matters

The gap is not 2,881 verbs. It is concentrated almost entirely in a handful of
names:

| top N missing verbs | share of the missing call sites |
|---|---|
| 5 | 71.4% |
| 10 | 88.8% |
| **15** | **92.9%** |
| 30 | 95.8% |
| 100 | 97.6% |

The fifteen:

| calls | verb |
|---:|---|
| 68,562 | `ctx-get` |
| 44,047 | `next` |
| 40,606 | `ctx-set` |
| 32,551 | `act` |
| 27,903 | `ctx-result` |
| 17,229 | `assoc-ref` |
| 12,941 | `done` |
| 9,938 | `cart` |
| 7,531 | `envelope-queue` |
| 4,397 | `surface` |
| 4,205 | `card-emit` |
| 2,738 | `table` |
| 2,451 | `check-act-result` |
| 1,540 | `with-loam-gate` |
| 1,463 | `format` |

Each was checked against the live engine (`./bin/motoi eval <name>`): all fifteen
are `unbound symbol`. Grep confirms none is defined in `motoi-scheme` or
`sakura-scheme` either. `ctx-get` is *called* by 8,286 carts and *defined* by 16
— it is a contract the carts were written against that was never built.

## What that means

These are not missing Scheme primitives. They are the **automation-cart runtime
contract**: per-run context (`ctx-get` / `ctx-set` / `ctx-result`), the step
protocol (`act` / `next` / `done` / `check-act-result`), and the surface/emit
layer (`cart` / `surface` / `card-emit` / `envelope-queue` / `table`). They
belong in the consumer, not in Motoi — Motoi's own doctrine says dialect verbs
live in their consumer repo.

Two of the fifteen are the exception and are plain library gaps: `assoc-ref`
(17,229 calls) and `format` (1,463).

Namespaced dialect verbs (`loam/*`, `cortex/*`, `model/*`) are a long thin tail:
1,323 distinct names but only 4,820 call sites — 1.6% of the gap. They are not
what is blocking anything.

## The honest caveat

Resolving a name is not the same as behaving correctly. This measures binding,
not semantics; a cart whose verbs all resolve can still be wrong. It also cannot
see the 843 carts that do not parse.
