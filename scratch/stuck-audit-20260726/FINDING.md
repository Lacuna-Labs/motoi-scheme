# Stuck audit finding — 2026-07-26

`ops/max-flow` infinite-loops (no termination) on:

    (define g '((0 1 5) (1 2 3)))
    (ops/max-flow g <source> 2)

An audit agent (reference runnability sweep) fired 4 `motoi run` procs on
/tmp/t_47-ops.slat_9.scm ~20h ago; all 4 pegged 100% CPU, never returned.
The CLI `run` path has NO fuel cap, so the loop ran unbounded (~1200 CPU-min each).

## Two real bugs
1. `ops/max-flow` has a non-terminating augmenting-path / residual loop on this graph.
2. `./bin/motoi run` has no fuel/wall-clock cap → a bad example hangs a core forever.

## Stuck PIDs (as of 2026-07-26)
80826, 81700, 78414, 78766 — all `node bin/motoi run /tmp/t_47-ops.slat_9.scm`

## Keep-broken-lane
Promote ops-max-flow-infinite-loop.scm into scheme/reference/broken-examples/
as a per-verb .slatl card (why-broken + fix + lesson + 3 sibling-lib examples).
