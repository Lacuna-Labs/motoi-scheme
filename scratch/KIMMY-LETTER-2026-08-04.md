# Kimmy letter — 2026-08-04

For whoever picks this up next. Read the numbers, re-run the commands, don't
trust the prose.

## The headline, first

**Zero of the 588 eBay/Etsy carts run.** Two verbs were built and are live and
correct in both repos, and they do not make a single cart run. `cart` alone
blocks all 588. Alfred asked for "working eBay and Etsy carts"; that is not
delivered.

## What this is

Three repos, one language.

- **motoi-scheme** (`~/code/motoi-scheme`) — the base dialect. A Scheme written
  in JavaScript. `./bin/motoi eval "<expr>"`, `./bin/motoi run <file>`.
- **sakura-scheme** (`~/code/sakura-scheme`) — a *vendored independent copy* of
  the same engine, consumed by Curator through a symlink
  (`curator/curator-web/node_modules/sakura-scheme`). CLI is
  `./bin/sakura-scheme`, not `./bin/sakura`.
- **scheme-carts** (`~/code/scheme-carts`) — 10,762 `.sks` automation carts.
  **NOT a git repository. Read-only. Edits there are unrecoverable.**

There is **no merge path** between Motoi and Sakura. 13 core `src/` files have
diverged. Code moves by hand, file by file, and you must adapt it. `CONSUMERS.md`
calls this a language change, not a product change.

## What we're doing

Getting the eBay and Etsy carts to run on the Scheme engine. Not the whole
fleet — those two marketplaces only. That was Alfred's explicit scoping.

## Where I got

### Measured (re-runnable, no model, read-only)

```
cd ~/code/motoi-scheme
MOTOI_HOME=/tmp/mx node scratch/cart-verb-coverage-marketplace.mjs
MOTOI_HOME=/tmp/mx node scratch/cart-runnable-marketplace.mjs
```

- 588 marketplace carts parse; 44 do not parse at all.
- 49,269 call sites. 535 distinct verbs called; 131 resolve, 404 do not.
- Missing call sites: **17,912 → 16,665** after the two verbs landed. The drop
  is exactly 1,247 = 1,123 (`assoc-ref`) + 124 (`format`). Predicted and
  measured agree exactly.
- Carts where every verb resolves: **0**.

### Built and verified

`assoc-ref` and `format` (SRFI-48), in **both** repos.

- Motoi: `lib/base/alist.js`, `lib/std/srfi-48.js`, spec at `Spec/srfi-48.slatl`.
- Sakura: same three files, ported by hand.
- Suite: `node --test --test-reporter=tap tests/*.test.mjs tests/**/*.test.mjs`
  → **859 pass / 0 fail**. The `--test-reporter=tap` flag is required; without
  it the run lies.

Verify both in one shot:

```
MOTOI_HOME=/tmp/mx ./bin/motoi eval \
  '(list (assoc-ref (list (cons (quote a) 1) (cons (quote b) 2)) (quote b)) (format #f "~a|~s|~d" (list 1 "x") "q" 255))'
# => (2 "(1 x)|\"q\"|255")
```

Two traps that cost me time:

1. Registering a verb in `core/parts-registry.js` or `core/verb-manifest.js`
   does **not** bind it. The live boot paths are `src/r7rs-completions.js`
   (SRFIs) and `core/index.js`'s `runInstaller(...)` list (eager core). Wire
   both.
2. **Sakura predates Motoi's cons-cell flip.** In Motoi proper lists are real
   `Pair` cells from `lib/base/list.js`. In Sakura they are still JS arrays and
   `Pair` (in `src/reader.js`) covers only improper tails. `alist.js` keeps both
   branches so the two copies stay diffable; the *live* branch is opposite in
   each repo. There is a PORT NOTE in the file saying so.

Four `format` directives — `~w ~y ~h ~t` — **raise** rather than guess, and are
flagged `:status "needs-alfred"` in the spec. The SRFI-48 text is not vendored
here. Do not implement them from memory.

### The blocker, ranked by carts blocked

Call-site counts flatter the wrong verbs. This is the ranking that matters:

```
 588 carts blocked by  cart              253 blocked by  envelope-queue
 434 blocked by  act                     144 blocked by  card-emit
 427 blocked by  next                    144 blocked by  with-loam-gate
 426 blocked by  ctx-result              134 blocked by  check-act-result
 425 blocked by  ctx-get                 128 blocked by  surface
 422 blocked by  done                    103 blocked by  remember-and-render
 385 blocked by  ctx-set                  76 blocked by  table
```

These 14 are **Curator runtime-contract verbs, not language verbs.** They do
not belong in Motoi (see Motoi CLAUDE.md: "Not a place to put dialect verbs").
They belong in Curator's verb layer. They exist in neither repo — nothing to
port, they must be written once.

### The good news

The contract is **not unknown**. Read
`~/code/scheme-carts/automations-carts/dream-weekly-ebay-memo/dream-weekly-ebay-memo.sks`.
The carts are a consistent, heavily-commented state machine:

```scheme
(cart 'slug '((author . "…") (version . 1) (cadence . weekly) (tier . dream)))
(define (state-name ctx) …)     ; each state is a unary function of ctx
(act 'verb (list args) 'next)   ; effect + transition; result available downstream
(ctx-result ctx)                ; result of the previous act
(ctx-set 'key value ctx)        ; returns a NEW ctx — functional
(ctx-get ctx 'key)              ; read
(next 'state ctx)               ; transition, no effect
(done …)                        ; terminate
```

So step 3 is **specifiable from evidence**, not invention. Draft the contract
from the corpus, get Alfred's yes on it, then build. Do not build first.

## Not done

- Reference records for `assoc-ref` (`39-list.slat`) and `format`
  (`60-string.slat`). Doctrine here is "the reference IS the language" — a verb
  is not shipped until the reference documents it. `lib/base/alist.js` declares
  `BOOK = 'book-of-code/ch-lists-and-tables'`; **I did not verify that chapter
  exists.**
- Sakura's own regression suite (`npm test`, vitest). I proved the two verbs by
  execution, not by the suite.
- The 14 Curator verbs. All of step 3.

## Hard constraints — these are not suggestions

- **No agents. No background runs. Nothing that spends paid tokens without
  Alfred saying go, every time.** He is low on budget and cannot refill it.
- `~/code/scheme-carts` is **not a git repo**. Read-only. Do not touch the carts.
- **No deletes. Ever.** Archive under a dated `_archive/`.
- **No fabrication.** If you don't know, log `:status "needs-alfred"` and stop.
- No `--force`, no `--no-verify`. Never commit without Alfred saying so. No push
  authorization has ever been given.
- Never `git stash` — it silently reverted an edit here once. Use
  `git show HEAD:path > /tmp/pristine`.
- motoi-scheme is on `main` with a large dirty working tree. No worktrees, no
  resets.
- **Never certify from a proxy.** Name the check that would fail if you were
  wrong, or say it is unverified. This repo was certified R7RS-conformant about
  twelve times by a gate that only checked examples *ran*, not that they were
  *correct*. That put 85 divergences into a ~3M-pair corpus. It is the single
  worst thing that happened here.
- Answer short. Findings go in a file; chat gets a one-line pointer.

## The one thing to do next

Draft the 14-verb runtime contract from the cart corpus. Show it to Alfred.
Get a yes. Then build it — in Curator, not in Motoi.
