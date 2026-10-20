# MK-ULTRA — Fold readiness stats (for Alfred)

**Date:** 2026-07-30 · **Scope:** MOTOI ONLY · **Status:** base ready, fold HELD.
Answers: continuity of data · the explosion plan · do the regexes work · can we
see before/during/after on the dashboard · the stats.

---

## TL;DR

- **Input substrate (the books/reference/graphs) is intact and grounded.** Every
  base count re-traces to a disk command. Nothing our fixing touched broke it.
- **The regexes work** — assess.py runs clean and projects **~3.04M in-scope**;
  graph nodes re-trace to **exactly 25,222**. One caveat below (naive node regex).
- **The fold OUTPUT does not exist yet.** MK-ULTRA pairs have NOT been generated
  (only 3 sample jsonl on disk). The old Mk1/2/3 pairs were archived per your call.
- **One continuity break to fix before the dashboard means anything:** with the
  old SFT archived, the dashboard now scans the **CPT** files as if they were SFT
  lanes. All its current WARN/NO-GO flags are CPT content, not SFT nonsense.

---

## 1. Continuity of the data (before → during → after)

| Stage | State | Evidence |
|---|---|---|
| **BEFORE** (authored base) | ✅ intact | reference/books/graphs/word-books all present + countable |
| **DURING** (explosion → pairs) | ⛔ not run | no MK-ULTRA output lanes exist; only 3 sample jsonl |
| **AFTER** (fold on disk) | ⛔ empty | old pairs archived; new fold not fired |

The chain **base → explode → pairs → dashboard** is continuous in *design and
tooling*, but the middle (explode/author) has not been executed. assess.py is a
**projection**, not a generator — it sizes the fold, it does not produce it.

## 2. The explosion plan (00-BIG-FOLD-PLAN.md)

Grounded, coherent, 9 lanes, headline **~3.04M** (target ~5M via 3 flagged
additive levers). Two lanes each clear 1M:

| # | Lane | Base (disk) | Yield (HIGH) |
|---|---|---|---|
| 1 | Reference (+copilot R10) | 19,326 runnable seeds | ~1.32M |
| 3 | Graphs (4 Jung axes) | 25,222 nodes | ~1.14M |
| 4a | Book prose | 1,097 ch | ~0.24M |
| 4b | Book fenced code | 9,258 blocks | ~0.19M |
| 5 | Word books | per-span (needs-alfred) | ~0.10M+ |
| 2 | Broken code | 3,024 | ~0.035M |
| 8/9 | Music/Animation composer | 72/77 | ~0.024M |
| 6 | Engineering/self-knowledge | 19+32 | ~0.002M |
| 7 | Native carts (deferred) | 25 | ~0.002M |

## 3. Do the regexes work?

| Grounding regex | Plan value | Re-traced today | ✓ |
|---|---|---|---|
| assess.py headline | ~3.04M | **~3,040,000** (runs clean) | ✅ |
| graph nodes (`:id` per node) | 25,222 | 17203+6244+1100+675 = **25,222** | ✅ |
| reference `:code` keys | 7,268 | **8,218** (grew via retag #426) | ✅↑ |
| reference runnable keys | — | **22,019** | ✅ |
| book fenced scheme/lisp blocks | 9,258 | **9,495** (grew via book edits) | ✅↑ |

**Caveat (this is the "do the regexes work" gotcha):** a *naive* node-open regex
(`(:node`, `(node `) returns near-zero — the graph slat has no such delimiter.
The **only** correct node count is `:id` per node (or the header
`:total-node-count`). Grounding must use the proven regex, never a guessed one.
Counts drifted **up** since the plan (retag + equal-bug edits added substrate) —
consistent with only-add.

## 4. The dashboard — before/during/after

fold_report.py **runs** and prints the full go/no-go board. But right now it is
**pointed at the wrong input**: after archiving the old SFT, `find_lane_files()`
rglobs `training-data/` and picks up the 8 **CPT** files in `cpt-mk2/` + 3 sample
jsonl → "11 lanes, 130,813 records." Consequences:

- The **generation-artifact WARN** (emoji 1,665 · excess-bang 2,921; top offender
  `cpt-stream.jsonl` 3,550) is **CPT content** (axis-feeling emoji-easing etc.),
  NOT SFT nonsense.
- The **leakage NO-GO** (special=4) is CPT special-token content, not an SFT leak.

**Fix required before the dashboard is meaningful for MK-ULTRA:** exclude
`cpt-mk2/` (CPT) from SFT lane discovery in `fold_common._keep()`, and point the
dashboard at the MK-ULTRA output dir once pairs exist. `_keep()` already excludes
eval/heldout/manifest/sakura/bak — CPT-by-dir just needs adding. One-line change.

## 5. Did our fixing mess anything up?

No damage. The 302 modified book files + 22 reference files are legitimate
authoring (fake verb `cortex/recall-pattern` → real `cortex/search`; equal-bug
`(equal? x 'nan)` kill) — net-positive, "for the better." The archive correctly
preserved all CPT (3 copies safe: `cpt-mk2/`, `~/.forge/data/motoi-mk3-cpt*`).
The only side-effect is the dashboard-scans-CPT wiring above (fixable, not loss).

## 6. Book-readiness residue still to clear (from the earlier scan)

- Crew-name **leaks**: Priya ×30, Zain ×2 (+ maybe bare "Marcus" ×3; "Marcus "
  ×1 is likely Marcus Aurelius = keep). Must scrub before fold.
- `(equal? x 'nan)` antipattern: **638** true instances remain (triage: real bug
  vs kept-broken teaching); 1,033 other `'nan` mentions are legit sentinel prose.
- 1 file still names the fake `cortex/recall-pattern` (ch06-the-verb-pipeline).
- 24 files carry `needs-alfred` honest-null slots — fold must EXCLUDE, not train.
- 73 dangling `.slat.retag-new` litter in `scheme/reference/` — apply or remove.

---

## What "be ready to perform the fold" needs (execution, on your go)

1. Repoint dashboard off CPT (`_keep()` one-liner) — so before/during/after is real.
2. Scrub the crew-name leaks + finish the equal-bug/fake-verb residue in the books.
3. Run the per-lane **author + explode** (the pairs don't exist yet) — held for you.
4. Re-run fold_report on the produced lanes for the during/after view.

**HOLD:** no explosion, no SFT fired. Awaiting your go.
