# Getting the eBay + Etsy carts running — measured plan

**Date:** 2026-08-04
**Scope:** eBay and Etsy carts only. Not the fleet.
**Status:** measured, not started. Nothing has been built.

This doc is written to survive a model switch. Everything below is a number
read off disk today, with the command that produced it. If you are picking this
up cold, re-run the commands first — do not trust the numbers because they are
written down.

---

## 1. What was measured

```
node scratch/cart-verb-coverage-marketplace.mjs   # eBay + Etsy only
node scratch/cart-verb-coverage.mjs               # whole fleet, for contrast
```

Both are static: carts are parsed, never executed. No model, no network,
read-only. `scheme-carts` is NOT a git repo — nothing in this plan writes to it.

| | eBay + Etsy | whole fleet |
|---|---|---|
| carts parsed | 588 | 9,994 |
| unparseable, skipped | 44 | 856 |
| call sites | 49,269 | 888,293 |
| sites hitting a missing verb | 17,912 (36.4%) | 298,836 (33.6%) |

The marketplace carts are not a special case. They fail the same way the fleet
fails, in the same proportion.

## 2. The whole gap is 16 verbs

Missing verbs for eBay + Etsy, by call count:

```
  4135  ctx-get              301  check-act-result
  2612  next                 290  surface
  2255  ctx-set              256  card-emit
  1887  act                  165  with-loam-gate
  1689  ctx-result           125  remember-and-render
  1123  assoc-ref            124  format
   614  done                  92  table
   588  cart
   415  envelope-queue
```

Those 16 verbs are **16,671 of the 17,912 missing call sites — 93.1%**. The
remaining 390 missing verbs are a long tail of ~1,200 sites combined.

Verified unbound today in **both** repos:

```
./bin/motoi eval "(procedure? assoc-ref)"   -> unbound symbol
./bin/motoi eval "(procedure? format)"      -> unbound symbol
grep -ral "'ctx-get'" ~/code/sakura-scheme/src ~/code/sakura-scheme/lib  -> nothing
```

Sakura does not have them either. There is nothing to port. They have to be
written once, somewhere.

## 3. Where each verb belongs

The split is not a style preference — it follows the repo boundary in
`motoi-scheme/CLAUDE.md`: *"Not a place to put dialect verbs. `card/*`,
`shop/*`, `sys/*`, `net/*` live in their consumer repos, not here."*

**Motoi (language) — 2 verbs, 1,247 call sites:**

| verb | sites | why it is Motoi's |
|---|---|---|
| `assoc-ref` | 1,123 | plain alist accessor, no runtime concept in it |
| `format` | 124 | string formatting; check SRFI-28 before inventing a signature |

Conformance ladder applies to both: R7RS-small first, then a SRFI, then
Motoi-own. `format` is SRFI-28 (basic) / SRFI-48 (intermediate) — pick one,
cite it in `:provenance`, do not hand-roll a third dialect.

**Curator (runtime contract) — 14 verbs, ~15,424 call sites:**

`ctx-get` · `ctx-set` · `ctx-result` · `act` · `next` · `done` · `cart` ·
`surface` · `card-emit` · `envelope-queue` · `check-act-result` ·
`with-loam-gate` · `remember-and-render` · `table`

These encode the cart execution model — context, step sequencing, envelopes,
the loam gate. They are meaningless outside Curator. Putting them in Motoi
would make the base dialect depend on a product.

## 4. How the code actually moves to Sakura

There is no merge path. Confirmed today:

- Sakura is **not** a fork, submodule, or subtree of Motoi. It is an
  independent vendored copy, consumed by symlink:
  `curator/curator-web/node_modules/sakura-scheme -> ../../../sakura-scheme`
- `sakura-scheme/CONSUMERS.md:14-19` — *"Consumers pin a SemVer range…
  Consumers propose changes via PR — reviewed as a language change, not a
  product change."*
- **13 core `src/` files have diverged** between the two repos.
- Sakura carries **37 files Motoi does not have** — adapters, marionette,
  security, and the dialect verbs (`card/*`, `cortex/*`, `flower/*`,
  `marketplace/*`, `shop/*`, `surface/*`). None of those come back to Motoi.

So porting is manual, file by file, reviewed as a language change. Do not
attempt an automated sync. Do not `git merge` these repos.

## 5. Order of work

1. **Build `assoc-ref` + `format` in Motoi.** Two verbs. Reference records
   first (the reference IS the language), then the implementation, then the
   examples must run. This is small and it is the only part that is Motoi's.
2. **Port those two across to Sakura by hand**, as a reviewed language change,
   against the 13 diverged files.
3. **Build the 14 runtime-contract verbs in Curator.** This is the bulk of the
   work and the bulk of the payoff — ~15,400 of the 17,912 broken call sites.
4. **Re-run `cart-verb-coverage-marketplace.mjs`** and confirm the missing-site
   count actually dropped. Do not declare it done off the build succeeding —
   that is the exact failure mode that produced the fake conformance gate.
5. **Then look at the 44 unparseable carts.** They are a separate defect class:
   they do not fail on a missing verb, they fail in the reader. Census them
   before assuming they are the same problem.

## 6. What is NOT known

- Whether the 588 carts *run* once the 16 verbs exist. Coverage is static
  analysis: it proves the names resolve, not that the semantics are right. The
  only honest gate is executing the carts and checking their output.
- What the correct semantics of the 14 runtime verbs are. They are called, not
  defined, anywhere in the tree. Someone has to specify them — that is
  authoring work, not extraction. Do not invent them from the call sites and
  call it discovered.
- `format`'s intended dialect. 124 sites; read them before choosing SRFI-28 vs
  SRFI-48.

## 7. Hard constraints for whoever does this

- `~/code/scheme-carts` is **not a git repo**. Edits there are unrecoverable.
  Read-only. Do not touch the carts.
- No deletes, ever. Archive under a dated `_archive/`.
- No fabrication. If the semantics are unknown, log `:status "needs-alfred"`
  and stop.
- Never certify from a proxy. Name the check that would fail if the claim were
  wrong, or say it is unverified.
